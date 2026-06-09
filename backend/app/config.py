"""Runtime configuration for the Smallville API."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - python-dotenv is a runtime dependency.
    load_dotenv = None


PROJECT_ROOT = Path(__file__).resolve().parents[2]
ENV_FILE = PROJECT_ROOT / ".env"

if load_dotenv:
    load_dotenv(ENV_FILE)


def _bool_env(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    """Filesystem and LLM settings shared by API routes."""

    project_root: Path = PROJECT_ROOT
    storage_dir: Path = PROJECT_ROOT / "data" / "storage"
    compressed_storage_dir: Path = PROJECT_ROOT / "data" / "compressed_storage"
    temp_storage_dir: Path = PROJECT_ROOT / "data" / "temp_storage"
    static_dir: Path = PROJECT_ROOT / "backend" / "static"
    frontend_dist_dir: Path = PROJECT_ROOT / "frontend" / "dist"
    llm_base_url: str = os.getenv("LLM_BASE_URL", "")
    llm_model: str = os.getenv("LLM_MODEL", "")
    llm_completion_model: str = os.getenv("LLM_COMPLETION_MODEL", "")
    llm_embedding_model: str = os.getenv("LLM_EMBEDDING_MODEL", "")
    llm_disable_embeddings: bool = _bool_env(os.getenv("LLM_DISABLE_EMBEDDINGS"), False)
    llm_api_key_configured: bool = bool(os.getenv("LLM_API_KEY"))
    debug: bool = _bool_env(os.getenv("DEBUG"), False)
    reverie_auto_start: bool = _bool_env(os.getenv("REVERIE_AUTO_START"), True)
    reverie_fork_sim_code: str = os.getenv(
        "REVERIE_FORK_SIM_CODE", "base_the_ville_isabella_maria_klaus"
    )
    reverie_live_sim_code: str = os.getenv("REVERIE_LIVE_SIM_CODE", "codex-live")


settings = Settings()
