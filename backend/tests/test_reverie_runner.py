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


def test_reverie_runner_forks_from_compressed(tmp_path):
    storage = tmp_path / "storage"
    compressed = tmp_path / "compressed"
    demo_dir = compressed / "July1_demo"
    (demo_dir / "personas" / "Klaus Mueller" / "bootstrap_memory").mkdir(parents=True)
    (demo_dir / "personas" / "Klaus Mueller" / "bootstrap_memory" / "scratch.json").write_text(
        json.dumps({"curr_tile": [50, 60], "curr_time": "February 13, 2023, 00:00:00"})
    )
    (demo_dir / "meta.json").write_text(
        json.dumps({
            "step": 100,
            "curr_time": "February 13, 2023, 00:00:00",
            "sec_per_step": 10,
            "maze_name": "the_ville",
            "persona_names": ["Klaus Mueller"],
        })
    )
    (demo_dir / "master_movement.json").write_text(
        json.dumps({
            "99": {"Klaus Mueller": {"movement": [50, 60]}}
        })
    )

    cfg = type(
        "Cfg",
        (),
        {
            "storage_dir": storage,
            "compressed_storage_dir": compressed,
            "reverie_live_sim_code": "live-July1_demo",
            "reverie_fork_sim_code": "July1_demo",
            "temp_storage_dir": tmp_path / "temp",
        },
    )()
    runner = LiveReverieRunner(cfg)
    runner.start("July1_demo", "live-July1_demo", force=False)
    # Trigger _ensure_live_storage
    runner._ensure_live_storage()

    target = storage / "live-July1_demo"
    assert (target / "personas" / "Klaus Mueller").exists()
    assert (target / "environment" / "100.json").exists()
    env = json.loads((target / "environment" / "100.json").read_text())
    assert env["Klaus Mueller"]["x"] == 50
    assert env["Klaus Mueller"]["y"] == 60


def test_reverie_runner_stop_signals_server(tmp_path):
    class MockServer:
        def __init__(self):
            self.stop_requested = False
            self.saved = False

        def save(self):
            self.saved = True

    cfg = type(
        "Cfg",
        (),
        {
            "storage_dir": tmp_path / "storage",
            "reverie_live_sim_code": "my-sim",
            "reverie_fork_sim_code": "my-sim",
        },
    )()
    runner = LiveReverieRunner(cfg)
    mock_server = MockServer()
    runner._server = mock_server

    runner.stop()

    assert mock_server.stop_requested is True
    assert mock_server.saved is True
    assert runner._stop.is_set()
    assert runner.is_running is False
    assert runner.status()["running"] is False

