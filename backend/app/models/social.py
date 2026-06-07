"""Social and conversation models."""
from __future__ import annotations
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class Relationship(BaseModel):
    agent_a_id: str
    agent_b_id: str
    type: str = "acquaintance"  # family, friend, colleague, neighbor, acquaintance, romantic
    closeness: float = 0.3  # 0-1
    trust: float = 0.5  # 0-1
    last_contact: Optional[datetime] = None
    interaction_count: int = 0


class ConversationTurn(BaseModel):
    speaker_id: str
    speaker_name: str
    content: str
    timestamp: datetime = Field(default_factory=datetime.now)


class Conversation(BaseModel):
    id: str
    location_id: str
    participants: list[str]  # agent IDs
    turns: list[ConversationTurn] = Field(default_factory=list)
    started_at: datetime = Field(default_factory=datetime.now)
    topic: str = ""
