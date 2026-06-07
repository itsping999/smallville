"""Memory models."""
from __future__ import annotations
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
import uuid


class MemoryEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    agent_id: str
    type: str = "observation"  # observation, conversation, reflection, plan, emotion, financial
    content: str
    importance: float = 5.0  # 1-10
    created_at: datetime = Field(default_factory=datetime.now)
    last_accessed_at: Optional[datetime] = None
    access_count: int = 0
    metadata: dict = Field(default_factory=dict)
    embedding: list[float] = Field(default_factory=list)
