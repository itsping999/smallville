"""Filesystem-backed simulation storage helpers."""
from __future__ import annotations

import contextlib
import datetime as dt
import json
import re
import shutil
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
    if not persona_dir.exists() and base is None and (settings.compressed_storage_dir / sim_code / "personas").exists():
        persona_dir = settings.compressed_storage_dir / sim_code / "personas"
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
                "default_step": int(meta.get("default_step", 1)),
            }
        )
    return demos


def _friendly_title(name: str, count: int | None = None) -> str:
    cleaned = name
    if cleaned.startswith("live-"):
        cleaned = cleaned[5:]
    if "expanded" in cleaned:
        return "Smallville Expanded (With Clinic, Library, Arcade & Park)"
    if "isabella_maria_klaus" in cleaned:
        if cleaned.startswith("base_"):
            return "3-Villager Smallville (Isabella, Maria, Klaus)"
        if count == 3:
            return "July1 3-Villager Replay"
        if count == 25 or "step-3-20" in cleaned:
            return "July1 25-Villager Replay"
        return "July1 3-Villager Replay"
    if "n25" in cleaned or cleaned == "the_ville_25_personas":
        return "25-Villager Full Town (Smallville)"
    title = cleaned.replace("_", " ").title()
    title = re.sub(r"\bDemo\b", "", title, flags=re.IGNORECASE).strip()
    return title


def list_all_saves(cfg: Settings = settings) -> dict[str, Any]:
    demos: list[dict[str, Any]] = []
    if cfg.compressed_storage_dir.exists():
        for demo_dir in sorted(cfg.compressed_storage_dir.iterdir()):
            meta_file = demo_dir / "meta.json"
            movement_file = demo_dir / "master_movement.json"
            if not demo_dir.is_dir() or not meta_file.exists() or not movement_file.exists():
                continue
            meta = read_json(meta_file)
            persona_names = [persona_name_payload(name) for name in meta.get("persona_names", [])]
            if not persona_names:
                names, _ = find_persona_names(demo_dir.name, cfg.compressed_storage_dir)
                persona_names = names

            demos.append({
                "sim_code": demo_dir.name,
                "title": _friendly_title(demo_dir.name, len(persona_names)),
                "category": "save",
                "is_base": False,
                "start_date": meta.get("start_date"),
                "sec_per_step": meta.get("sec_per_step", 10),
                "step": meta.get("step", 0),
                "default_step": int(meta.get("default_step", 1)),
                "persona_names": [
                    p.model_dump() if hasattr(p, "model_dump") else p.dict()
                    for p in persona_names
                ],
                "can_replay": True,
                "can_live": bool((demo_dir / "personas").exists()),
            })

    simulations: list[dict[str, Any]] = []
    if cfg.storage_dir.exists():
        for sim_dir in sorted(cfg.storage_dir.iterdir()):
            if not sim_dir.is_dir() or sim_dir.name.startswith("."):
                continue
            persona_names, _ = find_persona_names(sim_dir.name, cfg.storage_dir)
            if not persona_names:
                continue
            is_base = sim_dir.name.startswith("base_")
            step = latest_live_step(sim_dir.name, cfg) or 0
            has_moves = bool(
                ((sim_dir / "movement").exists() and numbered_json_steps(sim_dir / "movement"))
                or (sim_dir / "master_movement.json").exists()
                or (cfg.compressed_storage_dir / sim_dir.name / "master_movement.json").exists()
            )

            meta_file = sim_dir / "reverie" / "meta.json"
            if not meta_file.exists():
                meta_file = sim_dir / "meta.json"
            start_date = None
            sec_per_step = 10
            default_step = 1
            if meta_file.exists():
                with contextlib.suppress(Exception):
                    meta = read_json(meta_file)
                    start_date = meta.get("start_date")
                    sec_per_step = meta.get("sec_per_step", 10)
                    default_step = int(meta.get("default_step", 1))
            elif (cfg.compressed_storage_dir / sim_dir.name / "meta.json").exists():
                with contextlib.suppress(Exception):
                    comp_meta = read_json(cfg.compressed_storage_dir / sim_dir.name / "meta.json")
                    start_date = comp_meta.get("start_date")
                    sec_per_step = comp_meta.get("sec_per_step", 10)
                    default_step = int(comp_meta.get("default_step", 1))

            simulations.append({
                "sim_code": sim_dir.name,
                "title": _friendly_title(sim_dir.name, len(persona_names)),
                "category": "base" if is_base else "live",
                "is_base": is_base,
                "start_date": start_date,
                "sec_per_step": sec_per_step,
                "step": step,
                "default_step": default_step,
                "persona_names": [
                    p.model_dump() if hasattr(p, "model_dump") else p.dict()
                    for p in persona_names
                ],
                "can_replay": has_moves,
                "can_live": True,
            })

    templates = [s for s in simulations if s.get("is_base")]

    seen: set[str] = set()
    saves_list: list[dict[str, Any]] = []

    for s in simulations:
        if not s.get("is_base"):
            saves_list.append(s)
            seen.add(s["sim_code"])

    for d in demos:
        if d["sim_code"] not in seen:
            saves_list.append(d)
            seen.add(d["sim_code"])

    return {
        "demos": demos,
        "simulations": simulations,
        "templates": templates,
        "saves": saves_list,
    }


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
    speed_map = {"1": 1, "2": 2, "3": 4, "4": 8, "5": 16, "6": 32}
    speed = speed_map.get(play_speed, 2)

    demo_dir = cfg.compressed_storage_dir / sim_code
    live_dir = cfg.storage_dir / sim_code

    if demo_dir.exists() and (demo_dir / "master_movement.json").exists() and (demo_dir / "meta.json").exists():
        meta = read_json(demo_dir / "meta.json")
        raw = dict(read_json(demo_dir / "master_movement.json"))
        if live_dir.exists() and (live_dir / "movement").exists():
            for s in numbered_json_steps(live_dir / "movement"):
                step_file = live_dir / "movement" / f"{s}.json"
                if step_file.exists():
                    with contextlib.suppress(Exception):
                        raw[str(s)] = read_json(step_file)
    elif live_dir.exists() and (live_dir / "master_movement.json").exists():
        meta_file = live_dir / "reverie" / "meta.json"
        if not meta_file.exists():
            meta_file = live_dir / "meta.json"
        meta = read_json(meta_file)
        raw = dict(read_json(live_dir / "master_movement.json"))
        if (live_dir / "movement").exists():
            for s in numbered_json_steps(live_dir / "movement"):
                step_file = live_dir / "movement" / f"{s}.json"
                if step_file.exists():
                    with contextlib.suppress(Exception):
                        raw[str(s)] = read_json(step_file)
    elif live_dir.exists() and (live_dir / "movement").exists():
        meta_file = live_dir / "reverie" / "meta.json"
        if not meta_file.exists():
            meta_file = live_dir / "meta.json"
        if not meta_file.exists():
            raise HTTPException(status_code=404, detail="simulation_not_found")
        meta = read_json(meta_file)
        movement_dir = live_dir / "movement"
        steps = numbered_json_steps(movement_dir)
        if not steps:
            raise HTTPException(status_code=404, detail="no_movement_data")
        raw = {}
        for s in steps:
            step_file = movement_dir / f"{s}.json"
            if step_file.exists():
                with contextlib.suppress(Exception):
                    raw[str(s)] = read_json(step_file)
    else:
        raise HTTPException(status_code=404, detail="simulation_not_found")

    sec_per_step = int(meta.get("sec_per_step", 10))
    start_date_str = meta.get("start_date") or "January 1, 2023"
    try:
        start_dt = dt.datetime.strptime(f"{start_date_str} 00:00:00", "%B %d, %Y %H:%M:%S")
    except Exception:
        try:
            start_dt = dt.datetime.fromisoformat(start_date_str)
        except Exception:
            start_dt = dt.datetime(2023, 1, 1, 0, 0, 0)
    start_dt += dt.timedelta(seconds=sec_per_step * step)

    persona_names: list[PersonaName] = []
    if "persona_names" in meta and meta["persona_names"]:
        persona_names = [persona_name_payload(p) for p in meta["persona_names"]]
    else:
        first_frame = raw.get("0", {})
        if isinstance(first_frame, dict):
            p_dict = first_frame.get("persona") if "persona" in first_frame else first_frame
            if isinstance(p_dict, dict):
                persona_names = [persona_name_payload(p) for p in p_dict.keys()]
    if not persona_names:
        names, _ = find_persona_names(sim_code, cfg.storage_dir)
        persona_names = names

    persona_set = {persona.original for persona in persona_names}

    sorted_steps: list[int] = []
    for s_str in raw.keys():
        try:
            sorted_steps.append(int(s_str))
        except ValueError:
            continue
    sorted_steps.sort()

    current_persona_state: dict[str, Any] = {}
    all_movement: dict[int, Any] = {}
    init_prep: dict[str, Any] = {}

    for s_int in sorted_steps:
        frame = raw[str(s_int)]
        p_dict = frame.get("persona") if isinstance(frame, dict) and "persona" in frame else frame

        has_updates = False
        if isinstance(p_dict, dict) and p_dict:
            for p, p_data in p_dict.items():
                if isinstance(p_data, dict):
                    if p in current_persona_state:
                        current_persona_state[p].update(p_data)
                    else:
                        current_persona_state[p] = dict(p_data)
                    has_updates = True

        if s_int <= step:
            init_prep = {p: dict(current_persona_state[p]) for p in persona_set if p in current_persona_state}

        if s_int == step or (s_int >= step and has_updates):
            frame_meta = frame.get("meta") if isinstance(frame, dict) else {}
            all_movement[s_int] = {
                "persona": {p: dict(current_persona_state[p]) for p in persona_set if p in current_persona_state},
                "meta": frame_meta or {},
            }

    if step not in all_movement and init_prep:
        all_movement[step] = {"persona": init_prep, "meta": {}}

    persona_init_pos = {
        persona.replace(" ", "_"): init_prep[persona]["movement"]
        for persona in persona_set
        if persona in init_prep and isinstance(init_prep[persona], dict) and "movement" in init_prep[persona]
    }

    return {
        "sim_code": sim_code,
        "step": step,
        "persona_names": [
            p.model_dump() if hasattr(p, "model_dump") else p.dict()
            for p in persona_names
        ],
        "persona_init_pos": persona_init_pos,
        "all_movement": all_movement,
        "start_datetime": start_dt.strftime("%Y-%m-%dT%H:%M:%S"),
        "sec_per_step": sec_per_step,
        "play_speed": speed,
        "mode": "demo",
    }


def load_persona_state(sim_code: str, step: int, persona_name: str, cfg: Settings = settings) -> dict[str, Any]:
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


def delete_save(sim_code: str, cfg: Settings = settings) -> None:
    sim_code = ensure_safe_segment(sim_code, "sim_code")
    if sim_code.startswith("base_"):
        raise HTTPException(status_code=400, detail="Cannot delete base world templates")

    deleted = False
    target_dir = cfg.storage_dir / sim_code
    if target_dir.exists() and target_dir.is_dir():
        shutil.rmtree(target_dir)
        deleted = True

    demo_dir = cfg.compressed_storage_dir / sim_code
    if demo_dir.exists() and demo_dir.is_dir():
        shutil.rmtree(demo_dir)
        deleted = True

    if not deleted:
        raise HTTPException(status_code=404, detail="Save not found")

