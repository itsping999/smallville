import json

from backend.app.services.reverie_runner import LiveReverieRunner


def test_reverie_runner_seeds_next_environment_from_latest_movement(tmp_path):
    storage = tmp_path / "storage"
    sim_dir = storage / "codex-live"
    (sim_dir / "movement").mkdir(parents=True)
    (sim_dir / "environment").mkdir()
    (sim_dir / "movement" / "5.json").write_text(
        json.dumps(
            {
                "persona": {
                    "Klaus Mueller": {"movement": [77, 18]},
                    "Maria Lopez": {"movement": [63, 14]},
                }
            }
        )
    )
    cfg = type(
        "Cfg",
        (),
        {
            "storage_dir": storage,
            "reverie_live_sim_code": "codex-live",
        },
    )()
    runner = LiveReverieRunner(cfg)
    runner._server = type("Server", (), {"step": 6})()

    runner._ensure_next_environment()

    assert json.loads((sim_dir / "environment" / "6.json").read_text()) == {
        "Klaus Mueller": {"maze": "the_ville", "x": 77, "y": 18},
        "Maria Lopez": {"maze": "the_ville", "x": 63, "y": 14},
    }
