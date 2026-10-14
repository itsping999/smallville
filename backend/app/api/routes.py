"""HTTP routes for simulation state, demos, and runtime configuration."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from fastapi.encoders import jsonable_encoder

from backend.app.api.schemas import (
    EnvironmentProcessRequest,
    EnvironmentUpdateRequest,
    PathTesterUpdateRequest,
    SimulationStartRequest,
    SimulationStatus,
)
from backend.app.config import settings
from backend.app.services.reverie_runner import LiveReverieRunner
from backend.app.services.storage import (
    delete_save,
    ensure_safe_segment,
    expand_environment_names,
    list_all_saves,
    list_compressed_demos,
    load_current_status,
    load_demo_data,
    load_persona_state,
    read_json,
    write_json,
)


router = APIRouter(prefix="/api")


def _get_runner(request: Request) -> LiveReverieRunner:
    runner = getattr(request.app.state, "reverie_runner", None)
    if runner is not None:
        return runner
    from backend.app.main import runner as fallback_runner

    return fallback_runner


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/config/llm")
def llm_config() -> dict[str, object]:
    return {
        "base_url": settings.llm_base_url,
        "model": settings.llm_model,
        "completion_model": settings.llm_completion_model or settings.llm_model,
        "embedding_model": settings.llm_embedding_model,
        "disable_embeddings": settings.llm_disable_embeddings,
        "api_key_configured": settings.llm_api_key_configured,
    }


@router.get("/demos")
def demos() -> dict[str, object]:
    return {"demos": list_compressed_demos()}


@router.get("/saves")
def get_saves() -> dict[str, object]:
    return list_all_saves()


@router.delete("/saves/{sim_code}")
def delete_save_endpoint(sim_code: str, request: Request) -> dict[str, str]:
    runner = _get_runner(request)
    safe_code = ensure_safe_segment(sim_code, "sim_code")
    if runner.is_running and runner.live_sim_code == safe_code:
        raise HTTPException(status_code=400, detail="Cannot delete currently running simulation")
    delete_save(safe_code)
    return {"status": "ok", "deleted": safe_code}



@router.get("/simulation/status", response_model=SimulationStatus)
def simulation_status() -> dict[str, object]:
    return load_current_status()


@router.get("/reverie/status")
def reverie_status(request: Request) -> dict[str, object]:
    return _get_runner(request).status()


@router.post("/simulation/start")
def start_simulation(payload: SimulationStartRequest, request: Request) -> dict[str, object]:
    runner = _get_runner(request)
    fork_code = ensure_safe_segment(payload.fork_sim_code, "fork_sim_code")
    if payload.sim_code:
        live_code = ensure_safe_segment(payload.sim_code, "sim_code")
    elif fork_code.startswith("base_"):
        live_code = f"live-{fork_code.replace('base_', '')}"
    else:
        live_code = fork_code
    runner.start(fork_sim_code=fork_code, sim_code=live_code, force=True)
    return {"status": "ok", "sim_code": live_code, "fork_sim_code": fork_code}


@router.post("/simulation/stop")
def stop_simulation(request: Request) -> dict[str, object]:
    _get_runner(request).stop()
    return {"status": "ok"}


@router.get("/demo/{sim_code}/{step}")
def demo_data(sim_code: str, step: int, play_speed: str = "2") -> dict[str, object]:
    if step < 0:
        raise HTTPException(status_code=400, detail="step must be >= 0")
    return load_demo_data(sim_code, step, play_speed)


@router.get("/persona/{sim_code}/{step}/{persona_name}")
def persona_state(sim_code: str, step: int, persona_name: str) -> dict[str, object]:
    if step < 0:
        raise HTTPException(status_code=400, detail="step must be >= 0")
    return load_persona_state(sim_code, step, persona_name)


@router.post("/environment/process")
def process_environment(payload: EnvironmentProcessRequest) -> dict[str, str]:
    sim_code = ensure_safe_segment(payload.sim_code, "sim_code")
    env_dir = settings.storage_dir / sim_code / "environment"
    environment = expand_environment_names(
        sim_code,
        jsonable_encoder(payload.environment),
    )
    write_json(env_dir / f"{payload.step}.json", environment)
    return {"status": "ok"}


@router.post("/environment/update")
def update_environment(payload: EnvironmentUpdateRequest) -> dict[str, object]:
    sim_code = ensure_safe_segment(payload.sim_code, "sim_code")
    move_file = settings.storage_dir / sim_code / "movement" / f"{payload.step}.json"
    if move_file.exists():
        response = read_json(move_file)
        response["<step>"] = payload.step
        return response
    return {"<step>": -1}


@router.post("/path_tester/update")
def path_tester_update(payload: PathTesterUpdateRequest) -> dict[str, str]:
    write_json(settings.temp_storage_dir / "path_tester_env.json", payload.camera)
    return {"status": "ok"}
