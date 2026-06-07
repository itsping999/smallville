"""Memory stream — storage, retrieval, reflection."""
from __future__ import annotations
import hashlib
import math
from datetime import datetime
from typing import Optional
from app.models.memory import MemoryEntry
from app.config import MEMORY_ALPHA, MEMORY_BETA, MEMORY_GAMMA, MEMORY_K


def hash_embed(text: str, dim: int = 128) -> list[float]:
    """Deterministic hash-based pseudo-embedding for similarity search."""
    tokens = text.lower().split()
    vec = [0.0] * dim
    for token in tokens:
        h = hashlib.sha256(token.encode()).digest()
        for i in range(dim):
            vec[i] += (h[i % 32] / 255.0 - 0.5)
    norm = math.sqrt(sum(x * x for x in vec))
    if norm > 0:
        vec = [x / norm for x in vec]
    return vec


def cosine_similarity(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


class MemoryStream:
    """Per-agent memory store."""

    def __init__(self, agent_id: str):
        self.agent_id = agent_id
        self.memories: list[MemoryEntry] = []

    def add(self, content: str, memory_type: str = "observation",
            importance: float = 5.0, metadata: Optional[dict] = None,
            sim_time: Optional[datetime] = None) -> MemoryEntry:
        entry = MemoryEntry(
            agent_id=self.agent_id,
            type=memory_type,
            content=content,
            importance=importance,
            created_at=sim_time or datetime.now(),
            last_accessed_at=sim_time or datetime.now(),
            metadata=metadata or {},
            embedding=hash_embed(content),
        )
        self.memories.append(entry)
        return entry

    def retrieve(self, query: str, k: int = MEMORY_K,
                 current_time: Optional[datetime] = None) -> list[MemoryEntry]:
        if not self.memories:
            return []
        now = current_time or datetime.now()
        query_emb = hash_embed(query)
        scored = []
        for m in self.memories:
            hours = max(0.01, (now - m.last_accessed_at).total_seconds() / 3600) if m.last_accessed_at else 1.0
            recency = 0.99 ** hours
            importance = m.importance / 10.0
            relevance = cosine_similarity(query_emb, m.embedding)
            score = MEMORY_ALPHA * recency + MEMORY_BETA * importance + MEMORY_GAMMA * relevance
            scored.append((score, m))
        scored.sort(key=lambda x: x[0], reverse=True)
        top = [m for _, m in scored[:k]]
        for m in top:
            m.access_count += 1
            m.last_accessed_at = now
        return top

    def recent(self, count: int = 10) -> list[MemoryEntry]:
        return sorted(self.memories, key=lambda m: m.created_at, reverse=True)[:count]

    def importance_sum_since(self, since: Optional[datetime]) -> float:
        if since is None:
            return sum(m.importance for m in self.memories)
        return sum(m.importance for m in self.memories if m.created_at > since)

    def to_list(self) -> list[dict]:
        return [m.model_dump() for m in self.memories]

    def load_from_list(self, data: list[dict]) -> None:
        self.memories = [MemoryEntry(**d) for d in data]


class MemoryStore:
    """Global store of all agent memory streams."""

    def __init__(self):
        self.streams: dict[str, MemoryStream] = {}

    def get(self, agent_id: str) -> MemoryStream:
        if agent_id not in self.streams:
            self.streams[agent_id] = MemoryStream(agent_id)
        return self.streams[agent_id]

    def save_all(self) -> dict:
        return {aid: s.to_list() for aid, s in self.streams.items()}

    def load_all(self, data: dict) -> None:
        for aid, memories in data.items():
            stream = MemoryStream(aid)
            stream.load_from_list(memories)
            self.streams[aid] = stream
