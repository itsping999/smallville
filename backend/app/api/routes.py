"""HTTP routes for simulation state, demos, and runtime configuration."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.encoders import jsonable_encoder

from backend.app.api.schemas import (
    EnvironmentProcessRequest,
    EnvironmentUpdateRequest,
    PathTesterUpdateRequest,
    SimulationStatus,
)
from backend.app.config import settings
from backend.app.services.storage import (
    ensure_safe_segment,
    list_compressed_demos,
    load_current_status,
    load_demo_data,
    load_persona_state,
    read_json,
    write_json,
)


router = APIRouter(prefix="/api")


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


@router.get("/simulation/status", response_model=SimulationStatus)
def simulation_status() -> dict[str, object]:
    return load_current_status()


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
    write_json(env_dir / f"{payload.step}.json", jsonable_encoder(payload.environment))
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
