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
