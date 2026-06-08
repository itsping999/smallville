"""Smallville FastAPI application."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.app.api.routes import router
from backend.app.config import settings


def create_app() -> FastAPI:
    app = FastAPI(
        title="Smallville",
        description="FastAPI backend for the Smallville generative agents demo.",
        version="1.0.0",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(router)

    if settings.static_dir.exists():
        app.mount("/static", StaticFiles(directory=str(settings.static_dir)), name="static")

    if settings.frontend_dist_dir.exists():

        @app.get("/{full_path:path}")
        async def serve_spa(full_path: str):
            candidate = settings.frontend_dist_dir / full_path
            if candidate.is_file():
                return FileResponse(candidate)
            return FileResponse(settings.frontend_dist_dir / "index.html")

    return app


app = create_app()
