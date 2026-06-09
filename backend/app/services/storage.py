"""Filesystem-backed simulation storage helpers."""
from __future__ import annotations

import datetime as dt
import json
import re
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from backend.app.api.schemas import PersonaName
from backend.app.config import Settings, settings


SAFE_SEGMENT_RE = re.compile(r"^[A-Za-z0-9_. -]+$")


def ensure_safe_segment(value: str, field_name: str) -> str:
    """Reject path traversal while allowing upstream Smallville names."""
    if not value or not SAFE_SEGMENT_RE.fullmatch(value):
        raise HTTPException(status_code=400, detail=f"Invalid {field_name}")
    return value


def read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text())
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Not found: {path.name}") from None
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail=f"Invalid JSON: {path.name}") from exc


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2))


def persona_name_payload(name: str) -> PersonaName:
    parts = name.split()
    initials = (parts[0][0] + parts[-1][0]).upper() if parts else ""
    return PersonaName(
        original=name,
        underscore=name.replace(" ", "_"),
        initial=initials,
    )


def find_persona_names(sim_code: str, base: Path | None = None) -> tuple[list[PersonaName], set[str]]:
    base_dir = base or settings.storage_dir
    sim_code = ensure_safe_segment(sim_code, "sim_code")
    persona_dir = base_dir / sim_code / "personas"
    if not persona_dir.exists():
        return [], set()

    names = [
        persona_name_payload(entry.name)
        for entry in sorted(persona_dir.iterdir())
        if entry.is_dir() and not entry.name.startswith(".")
    ]
    return names, {name.original for name in names}


def environment_files_desc(sim_code: str, base: Path | None = None) -> list[Path]:
    base_dir = base or settings.storage_dir
    sim_code = ensure_safe_segment(sim_code, "sim_code")
    env_dir = base_dir / sim_code / "environment"
    if not env_dir.exists():
        return []

    steps: list[int] = []
    for candidate in env_dir.iterdir():
        if candidate.suffix != ".json" or candidate.name.startswith("."):
            continue
        try:
            steps.append(int(candidate.stem))
        except ValueError:
            continue
    return [env_dir / f"{step}.json" for step in sorted(steps, reverse=True)]


def numbered_json_steps(path: Path) -> list[int]:
    if not path.exists():
        return []

    steps: list[int] = []
    for candidate in path.iterdir():
        if candidate.suffix != ".json" or candidate.name.startswith("."):
            continue
        try:
            steps.append(int(candidate.stem))
        except ValueError:
            continue
    return sorted(steps)


def latest_live_step(sim_code: str, cfg: Settings = settings) -> int | None:
    sim_code = ensure_safe_segment(sim_code, "sim_code")
    movement_steps = numbered_json_steps(cfg.storage_dir / sim_code / "movement")
    if movement_steps:
        return movement_steps[-1]

    env_steps = numbered_json_steps(cfg.storage_dir / sim_code / "environment")
    if env_steps:
        return env_steps[-1]

    return None


def normalize_persona_key(name: str) -> str:
    return name.replace("_", " ")


def expand_environment_names(
    sim_code: str,
    environment: dict[str, Any],
    cfg: Settings = settings,
) -> dict[str, Any]:
    """Accept frontend underscore keys while preserving Reverie's display names."""
    persona_names, _ = find_persona_names(sim_code, cfg.storage_dir)
    display_by_key = {
        persona.underscore: persona.original
        for persona in persona_names
    }
    display_by_key.update({persona.original: persona.original for persona in persona_names})

    normalized: dict[str, Any] = {}
    for key, value in environment.items():
        display_key = display_by_key.get(key, normalize_persona_key(key))
        normalized[display_key] = value
    return normalized


def list_compressed_demos(cfg: Settings = settings) -> list[dict[str, Any]]:
    if not cfg.compressed_storage_dir.exists():
        return []

    demos: list[dict[str, Any]] = []
    for demo_dir in sorted(cfg.compressed_storage_dir.iterdir()):
        meta_file = demo_dir / "meta.json"
        movement_file = demo_dir / "master_movement.json"
        if not demo_dir.is_dir() or not meta_file.exists() or not movement_file.exists():
            continue
        meta = read_json(meta_file)
        demos.append(
            {
                "sim_code": demo_dir.name,
                "start_date": meta.get("start_date"),
                "sec_per_step": meta.get("sec_per_step"),
                "default_step": 1,
            }
        )
    return demos


def load_current_status(cfg: Settings = settings) -> dict[str, Any]:
    sim_file = cfg.temp_storage_dir / "curr_sim_code.json"
    step_file = cfg.temp_storage_dir / "curr_step.json"
    if not sim_file.exists() or not step_file.exists():
        raise HTTPException(status_code=503, detail="backend_not_started")

    sim_code = read_json(sim_file)["sim_code"]
    step = read_json(step_file)["step"]
    latest_step = latest_live_step(sim_code, cfg)
    if latest_step is not None:
        step = latest_step

    persona_names, persona_set = find_persona_names(sim_code, cfg.storage_dir)
    persona_init_pos: list[dict[str, Any]] = []
    movement_file = cfg.storage_dir / sim_code / "movement" / f"{step}.json"
    if movement_file.exists():
        movement_data = read_json(movement_file)
        for key, val in (movement_data.get("persona") or {}).items():
            display_key = normalize_persona_key(key)
            if display_key in persona_set:
                persona_init_pos.append(
                    {"name": display_key, "x": val["movement"][0], "y": val["movement"][1]}
                )

    for env_file in environment_files_desc(sim_code, cfg.storage_dir):
        if persona_init_pos:
            break
        env_data = read_json(env_file)
        for key, val in env_data.items():
            display_key = normalize_persona_key(key)
            if display_key in persona_set:
                persona_init_pos.append({"name": display_key, "x": val["x"], "y": val["y"]})
        if persona_init_pos:
            break

    if persona_names and not persona_init_pos:
        raise HTTPException(status_code=503, detail="backend_not_started")

    return {
        "sim_code": sim_code,
        "step": step,
        "persona_names": persona_names,
        "persona_init_pos": persona_init_pos,
    }


def load_demo_data(sim_code: str, step: int, play_speed: str, cfg: Settings = settings) -> dict[str, Any]:
    sim_code = ensure_safe_segment(sim_code, "sim_code")
    demo_dir = cfg.compressed_storage_dir / sim_code
    move_file = demo_dir / "master_movement.json"
    meta_file = demo_dir / "meta.json"
    if not move_file.exists() or not meta_file.exists():
        raise HTTPException(status_code=404, detail="simulation_not_found")

    speed_map = {"1": 1, "2": 2, "3": 4, "4": 8, "5": 16, "6": 32}
    speed = speed_map.get(play_speed, 2)
    meta = read_json(meta_file)
    sec_per_step = int(meta["sec_per_step"])
    start_dt = dt.datetime.strptime(
        meta["start_date"] + " 00:00:00", "%B %d, %Y %H:%M:%S"
    )
    start_dt += dt.timedelta(seconds=sec_per_step * step)

    raw = read_json(move_file)
    first_frame = raw.get("0", {})
    persona_names = [persona_name_payload(persona) for persona in first_frame.keys()]
    persona_set = {persona.original for persona in persona_names}

    init_prep: dict[str, Any] = {}
    for i in range(step + 1):
        frame = raw.get(str(i), {})
        for persona in persona_set:
            if persona in frame:
                init_prep[persona] = frame[persona]

    persona_init_pos = {
        persona.replace(" ", "_"): init_prep[persona]["movement"]
        for persona in persona_set
        if persona in init_prep
    }

    all_movement: dict[int, Any] = {step: init_prep}
    for i in range(step + 1, len(raw)):
        frame = raw.get(str(i))
        if frame:
            all_movement[i] = frame

    return {
        "sim_code": sim_code,
        "step": step,
        "persona_names": persona_names,
        "persona_init_pos": persona_init_pos,
        "all_movement": all_movement,
        "start_datetime": start_dt.strftime("%Y-%m-%dT%H:%M:%S"),
        "sec_per_step": sec_per_step,
        "play_speed": speed,
        "mode": "demo",
    }


def load_persona_state(sim_code: str, step: int, persona_name: str, cfg: Settings = settings) -> dict[str, Any]:
    del step
    sim_code = ensure_safe_segment(sim_code, "sim_code")
    persona_name = ensure_safe_segment(persona_name, "persona_name")
    display = persona_name.replace("_", " ")
    memory = cfg.storage_dir / sim_code / "personas" / display / "bootstrap_memory"
    if not memory.exists():
        memory = cfg.compressed_storage_dir / sim_code / "personas" / display / "bootstrap_memory"
    if not memory.exists():
        raise HTTPException(status_code=404, detail="persona_not_found")

    scratch = read_json(memory / "scratch.json")
    spatial = read_json(memory / "spatial_memory.json")
    nodes = read_json(memory / "associative_memory" / "nodes.json")

    events: list[dict[str, Any]] = []
    chats: list[dict[str, Any]] = []
    thoughts: list[dict[str, Any]] = []
    buckets = {"event": events, "chat": chats, "thought": thoughts}

    for i in range(len(nodes), 0, -1):
        node = nodes.get(f"node_{i}")
        if node and node.get("type") in buckets:
            buckets[node["type"]].append(node)

    return {
        "sim_code": sim_code,
        "step": step,
        "persona_name": display,
        "persona_name_underscore": persona_name,
        "scratch": scratch,
        "spatial": spatial,
        "a_mem_event": events,
        "a_mem_chat": chats,
        "a_mem_thought": thoughts,
    }
