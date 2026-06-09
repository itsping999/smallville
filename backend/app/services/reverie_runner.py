"""In-process Reverie runner for FastAPI-managed live simulations."""
from __future__ import annotations

import contextlib
import datetime as dt
import json
import os
import traceback
import shutil
import sys
import threading
import time
from pathlib import Path
from typing import Any

from backend.app.config import Settings, settings
from backend.app.services.storage import numbered_json_steps


class LiveReverieRunner:
    """Owns a single background Reverie simulation loop."""

    def __init__(self, cfg: Settings = settings) -> None:
        self.cfg = cfg
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()
        self._server: Any | None = None
        self._error: Exception | None = None

    @property
    def error(self) -> Exception | None:
        return self._error

    def status(self) -> dict[str, Any]:
        thread_alive = bool(self._thread and self._thread.is_alive())
        server_step = getattr(self._server, "step", None)
        server_time = getattr(self._server, "curr_time", None)
        return {
            "enabled": self.cfg.reverie_auto_start,
            "running": thread_alive and self._error is None,
            "thread_alive": thread_alive,
            "sim_code": self.cfg.reverie_live_sim_code,
            "fork_sim_code": self.cfg.reverie_fork_sim_code,
            "step": server_step,
            "curr_time": server_time.strftime("%B %d, %Y, %H:%M:%S") if server_time else None,
            "error": repr(self._error) if self._error else None,
        }

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        if not self.cfg.reverie_auto_start:
            return

        self._stop.clear()
        self._thread = threading.Thread(
            target=self._run,
            name="smallville-reverie",
            daemon=True,
        )
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5)
        if self._server is not None:
            with contextlib.suppress(Exception):
                self._server.save()

    def _run(self) -> None:
        previous_cwd = Path.cwd()
        try:
            os.chdir(self.cfg.project_root / "reverie" / "backend_server")
            self._server = self._build_server()
            while not self._stop.is_set():
                self._server.start_server(1)
                self._ensure_next_environment()
                self._write_current_step()
                with contextlib.suppress(Exception):
                    self._server.save()
                time.sleep(0.05)
        except Exception as exc:  # pragma: no cover - surfaced via logs/status.
            self._error = exc
            traceback.print_exc()
        finally:
            os.chdir(previous_cwd)

    def _build_server(self) -> Any:
        backend_dir = self.cfg.project_root / "reverie" / "backend_server"
        if str(backend_dir) not in sys.path:
            sys.path.insert(0, str(backend_dir))

        import global_methods  # type: ignore
        import reverie  # type: ignore
        import utils  # type: ignore
        from reverie import ReverieServer  # type: ignore

        self._patch_reverie_paths(utils, global_methods, reverie)
        self._ensure_live_storage()
        return ReverieServer(
            self.cfg.reverie_live_sim_code,
            self.cfg.reverie_live_sim_code,
        )

    def _patch_reverie_paths(self, utils: Any, global_methods: Any, reverie_module: Any) -> None:
        static_assets = self.cfg.static_dir / "assets"
        storage = self.cfg.storage_dir
        temp_storage = self.cfg.temp_storage_dir

        values = {
            "maze_assets_loc": str(static_assets),
            "env_matrix": str(static_assets / "the_ville" / "matrix"),
            "env_visuals": str(static_assets / "the_ville" / "visuals"),
            "fs_storage": str(storage),
            "fs_temp_storage": str(temp_storage),
        }
        for module in tuple(sys.modules.values()) + (utils, global_methods, reverie_module):
            if module is None:
                continue
            for key, value in values.items():
                if hasattr(module, key):
                    setattr(module, key, value)

    def _ensure_live_storage(self) -> None:
        source = self.cfg.storage_dir / self.cfg.reverie_fork_sim_code
        target = self.cfg.storage_dir / self.cfg.reverie_live_sim_code
        if not target.exists():
            shutil.copytree(source, target)

        self._synchronize_meta(target)
        self._write_current_sim()

    def _synchronize_meta(self, target: Path) -> None:
        meta_path = target / "reverie" / "meta.json"
        meta = json.loads(meta_path.read_text())
        latest_steps = numbered_json_steps(target / "movement")
        if latest_steps and self._has_saved_persona_state(target):
            step = latest_steps[-1] + 1
            last_move = json.loads((target / "movement" / f"{latest_steps[-1]}.json").read_text())
            curr_time = (last_move.get("meta") or {}).get("curr_time")
            if curr_time:
                last_time = dt.datetime.strptime(curr_time, "%B %d, %Y, %H:%M:%S")
                meta["curr_time"] = (
                    last_time + dt.timedelta(seconds=int(meta["sec_per_step"]))
                ).strftime("%B %d, %Y, %H:%M:%S")
            meta["step"] = step
            self._ensure_environment_for_step(target, step, last_move)

        meta["fork_sim_code"] = self.cfg.reverie_fork_sim_code
        meta_path.write_text(json.dumps(meta, indent=2))

    def _has_saved_persona_state(self, target: Path) -> bool:
        persona_dir = target / "personas"
        if not persona_dir.exists():
            return False
        for scratch in persona_dir.glob("*/bootstrap_memory/scratch.json"):
            try:
                data = json.loads(scratch.read_text())
            except json.JSONDecodeError:
                return False
            if not data.get("curr_time") or not data.get("curr_tile"):
                return False
        return True

    def _ensure_environment_for_step(self, target: Path, step: int, movement: dict[str, Any]) -> None:
        env_file = target / "environment" / f"{step}.json"
        if env_file.exists():
            existing = json.loads(env_file.read_text())
            normalized = {
                key.replace("_", " "): value
                for key, value in existing.items()
            }
            if normalized != existing:
                env_file.write_text(json.dumps(normalized, indent=2))
            return

        environment = {}
        for name, data in (movement.get("persona") or {}).items():
            movement_xy = data.get("movement") or [0, 0]
            environment[name] = {
                "maze": "the_ville",
                "x": movement_xy[0],
                "y": movement_xy[1],
            }
        env_file.write_text(json.dumps(environment, indent=2))

    def _ensure_next_environment(self) -> None:
        if self._server is None:
            return

        target = self.cfg.storage_dir / self.cfg.reverie_live_sim_code
        next_step = int(self._server.step)
        previous_step = next_step - 1
        movement_file = target / "movement" / f"{previous_step}.json"
        if not movement_file.exists():
            return

        movement = json.loads(movement_file.read_text())
        self._ensure_environment_for_step(target, next_step, movement)

    def _write_current_sim(self) -> None:
        self.cfg.temp_storage_dir.mkdir(parents=True, exist_ok=True)
        (self.cfg.temp_storage_dir / "curr_sim_code.json").write_text(
            json.dumps({"sim_code": self.cfg.reverie_live_sim_code}, indent=2)
        )

    def _write_current_step(self) -> None:
        if self._server is None:
            return
        self.cfg.temp_storage_dir.mkdir(parents=True, exist_ok=True)
        (self.cfg.temp_storage_dir / "curr_step.json").write_text(
            json.dumps({"step": self._server.step}, indent=2)
        )
