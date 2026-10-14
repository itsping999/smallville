from fastapi import HTTPException

from backend.app.services.storage import (
    ensure_safe_segment,
    expand_environment_names,
    latest_live_step,
    persona_name_payload,
)


def test_ensure_safe_segment_rejects_path_traversal():
    try:
        ensure_safe_segment("../secret", "sim_code")
    except HTTPException as exc:
        assert exc.status_code == 400
    else:
        raise AssertionError("path traversal should be rejected")


def test_persona_name_payload_matches_frontend_contract():
    payload = persona_name_payload("Isabella Rodriguez")

    assert payload.original == "Isabella Rodriguez"
    assert payload.underscore == "Isabella_Rodriguez"
    assert payload.initial == "IR"


def test_latest_live_step_prefers_movement_files(tmp_path):
    storage = tmp_path / "storage"
    temp = tmp_path / "temp"
    sim_dir = storage / "live-demo"
    (sim_dir / "movement").mkdir(parents=True)
    (sim_dir / "environment").mkdir()
    (sim_dir / "movement" / "2.json").write_text("{}")
    (sim_dir / "environment" / "3.json").write_text("{}")

    cfg = type("Cfg", (), {"storage_dir": storage, "temp_storage_dir": temp})()

    assert latest_live_step("live-demo", cfg) == 2


def test_expand_environment_names_accepts_frontend_keys(tmp_path):
    storage = tmp_path / "storage"
    persona_dir = storage / "live-demo" / "personas" / "Klaus Mueller"
    persona_dir.mkdir(parents=True)
    cfg = type("Cfg", (), {"storage_dir": storage})()

    environment = {
        "Klaus_Mueller": {"maze": "the_ville", "x": 1, "y": 2},
    }

    assert expand_environment_names("live-demo", environment, cfg) == {
        "Klaus Mueller": {"maze": "the_ville", "x": 1, "y": 2},
    }


def test_list_all_saves_returns_demos_and_bases(tmp_path):
    storage = tmp_path / "storage"
    compressed = tmp_path / "compressed"
    (storage / "base_the_ville_isabella_maria_klaus" / "personas" / "Klaus Mueller").mkdir(parents=True)
    demo_dir = compressed / "July1_demo"
    (demo_dir / "personas" / "Klaus Mueller").mkdir(parents=True)
    demo_dir.mkdir(parents=True, exist_ok=True)
    (demo_dir / "meta.json").write_text('{"start_date": "July 1", "sec_per_step": 10, "step": 100, "persona_names": ["Klaus Mueller"]}')
    (demo_dir / "master_movement.json").write_text('{}')

    from backend.app.services.storage import list_all_saves

    cfg = type("Cfg", (), {"storage_dir": storage, "compressed_storage_dir": compressed})()
    saves = list_all_saves(cfg)

    assert len(saves["demos"]) == 1
    assert saves["demos"][0]["sim_code"] == "July1_demo"
    assert saves["demos"][0]["can_replay"] is True
    assert saves["demos"][0]["can_live"] is True
    assert len(saves["simulations"]) == 1
    assert saves["simulations"][0]["is_base"] is True
    assert saves["simulations"][0]["can_live"] is True


def test_friendly_title_expanded():
    from backend.app.services.storage import _friendly_title

    assert "Expanded" in _friendly_title("base_the_ville_expanded")
    assert "Expanded" in _friendly_title("live-the_ville_expanded")


def test_load_demo_data_supports_live_storage(tmp_path):
    storage = tmp_path / "storage"
    compressed = tmp_path / "compressed"
    sim_dir = storage / "live-sim"
    (sim_dir / "movement").mkdir(parents=True)
    (sim_dir / "reverie").mkdir(parents=True)
    (sim_dir / "reverie" / "meta.json").write_text(
        '{"start_date": "July 1, 2023", "sec_per_step": 10, "persona_names": ["Klaus Mueller"]}'
    )
    (sim_dir / "movement" / "0.json").write_text(
        '{"persona": {"Klaus Mueller": {"movement": [10, 20], "pronunciatio": "💬", "description": "walking"}}}'
    )
    (sim_dir / "movement" / "1.json").write_text(
        '{"persona": {"Klaus Mueller": {"movement": [11, 20], "pronunciatio": "💬", "description": "standing"}}}'
    )

    from backend.app.services.storage import load_demo_data

    cfg = type("Cfg", (), {"storage_dir": storage, "compressed_storage_dir": compressed})()
    data = load_demo_data("live-sim", 0, "2", cfg)

    assert data["sim_code"] == "live-sim"
    assert data["step"] == 0
    assert len(data["persona_names"]) == 1
    assert data["persona_init_pos"] == {"Klaus_Mueller": [10, 20]}
    assert 1 in data["all_movement"]


def test_delete_save(tmp_path):
    import pytest
    from fastapi import HTTPException
    from backend.app.services.storage import delete_save

    storage = tmp_path / "storage"
    compressed = tmp_path / "compressed"
    cfg = type("Cfg", (), {"storage_dir": storage, "compressed_storage_dir": compressed})()

    # Base template cannot be deleted
    with pytest.raises(HTTPException) as exc_info:
        delete_save("base_the_ville_expanded", cfg)
    assert exc_info.value.status_code == 400

    # User save deletion
    user_sim = storage / "my-live-sim"
    user_sim.mkdir(parents=True)
    (user_sim / "meta.json").write_text("{}")
    assert user_sim.exists()

    delete_save("my-live-sim", cfg)
    assert not user_sim.exists()

    # Non-existent save raises 404
    with pytest.raises(HTTPException) as exc_info:
        delete_save("non_existent_sim", cfg)
    assert exc_info.value.status_code == 404


def test_friendly_title_removes_demo():
    from backend.app.services.storage import _friendly_title

    assert _friendly_title("July1_the_ville_isabella_maria_klaus-step-3-20", count=25) == "July1 25-Villager Replay"
    assert "Demo" not in _friendly_title("July1_the_ville_isabella_maria_klaus-step-3-20", count=25)
    assert _friendly_title("July1_the_ville_isabella_maria_klaus-step-3-20", count=3) == "July1 3-Villager Replay"
    assert "Demo" not in _friendly_title("my_custom_demo_save")


def test_list_all_saves_deduplicates_by_sim_code(tmp_path):
    storage = tmp_path / "storage"
    compressed = tmp_path / "compressed"
    sim_name = "July1_the_ville_isabella_maria_klaus-step-3-20"

    # Save exists in compressed
    comp_dir = compressed / sim_name
    (comp_dir / "personas" / "Klaus Mueller").mkdir(parents=True)
    (comp_dir / "meta.json").write_text('{"start_date": "July 1", "sec_per_step": 10, "step": 100, "persona_names": ["Klaus Mueller"]}')
    (comp_dir / "master_movement.json").write_text('{}')

    # Same save exists in storage as a live simulation
    live_dir = storage / sim_name
    (live_dir / "personas" / "Klaus Mueller").mkdir(parents=True)
    (live_dir / "reverie").mkdir(parents=True)
    (live_dir / "reverie" / "meta.json").write_text('{"start_date": "July 1", "sec_per_step": 10, "step": 105, "persona_names": ["Klaus Mueller"]}')

    from backend.app.services.storage import list_all_saves

    cfg = type("Cfg", (), {"storage_dir": storage, "compressed_storage_dir": compressed})()
    saves = list_all_saves(cfg)

    # In saves list, it should appear exactly once
    matching = [s for s in saves["saves"] if s["sim_code"] == sim_name]
    assert len(matching) == 1
    assert matching[0]["title"] == "July1 25-Villager Replay"
    assert "Demo" not in matching[0]["title"]




