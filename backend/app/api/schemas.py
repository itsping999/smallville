"""Request and response schemas for the Smallville API."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class PersonaName(BaseModel):
    original: str
    underscore: str
    initial: str


class PersonaPosition(BaseModel):
    name: str
    x: int
    y: int


class SimulationStatus(BaseModel):
    sim_code: str
    step: int
    persona_names: list[PersonaName]
    persona_init_pos: list[PersonaPosition]


class EnvironmentEntity(BaseModel):
    maze: str
    x: int
    y: int


class EnvironmentProcessRequest(BaseModel):
    sim_code: str
    step: int = Field(ge=0)
    environment: dict[str, EnvironmentEntity]


class EnvironmentUpdateRequest(BaseModel):
    sim_code: str
    step: int = Field(ge=0)


class PathTesterUpdateRequest(BaseModel):
    camera: dict[str, Any]


class SimulationStartRequest(BaseModel):
    fork_sim_code: str
    sim_code: str | None = None

