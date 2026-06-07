# SPEC-001: Memory Stream System
**Traces to**: PRD Section 4.1

## Data Model

```python
class MemoryEntry(BaseModel):
    id: str                        # UUID
    agent_id: str                  # Owner agent
    type: str                      # "observation" | "conversation" | "reflection" | "plan" | "emotion" | "financial"
    content: str                   # Natural language description
    importance: float              # 1-10, scored by LLM
    created_at: SimTime            # Simulation time
    last_accessed_at: SimTime      # Updated on retrieval
    access_count: int              # Number of times retrieved
    metadata: dict                 # location, related_agents, event_type
    embedding: list[float]         # 128-dim hash-based vector
```

## Importance Scoring

LLM prompt scores importance 1-1:
- 1: Mundane (brushed teeth, walked to kitchen)
- 3: Normal routine (ate breakfast, started work)
- 5: Notable (had good conversation, tried new restaurant)
- 7: Significant (argument with colleague, received promotion)
- 10: Life-changing (wedding, accident, job loss)

Heuristic fallback for observations:
- Movement: 1-2
- Object interaction: 2-3
- Conversation: 3-5
- Financial transaction: 2-4
- Health event: 4-7

## Retrieval Algorithm

```python
def retrieve(agent_id: str, query: str, k: int = 15) -> list[MemoryEntry]:
    memories = store.get_all(agent_id)
    query_emb = embed(query)
    
    scored = []
    for m in memories:
        recency = 0.99 ** hours_since(m.last_accessed_at)
        importance = m.importance / 10.0
        relevance = cosine_similarity(query_emb, m.embedding)
        score = ALPHA * recency + BETA * importance + GAMMA * relevance
        scored.append((score, m))
    
    scored.sort(reverse=True)
    top_k = [m for _, m in scored[:k]]
    
    # Update access tracking
    for m in top_k:
        m.access_count += 1
        m.last_accessed_at = current_sim_time()
    
    return top_k
```

## Reflection Trigger

```python
async def check_reflection(agent):
    recent = agent.memories.created_since(agent.last_reflection_time)
    importance_sum = sum(m.importance for m in recent)
    
    if importance_sum >= REFLECTION_THRESHOLD:  # 150
        top_memories = sorted(recent, key=lambda m: m.importance, reverse=True)[:5]
        insight = await llm.generate_reflection(agent.identity, top_memories)
        
        reflection = MemoryEntry(
            type="reflection",
            content=insight,
            importance=LLM.score_importance(insight),  # typically 7-9
        )
        agent.memories.add(reflection)
        agent.last_reflection_time = current_sim_time()
```

## Embedding (Hash-Based Fallback)

When no embedding API is available:

```python
def hash_embed(text: str, dim: int = 128) -> list[float]:
    """Deterministic hash-based pseudo-embedding for similarity search."""
    tokens = text.lower().split()
    vec = [0.0] * dim
    for token in tokens:
        h = hashlib.sha256(token.encode()).digest()
        for i in range(dim):
            vec[i] += (h[i % 32] / 255.0 - 0.5)
    # Normalize
    norm = sum(x*x for x in vec) ** 0.5
    return [x / norm for x in vec] if norm > 0 else vec
```

## Storage

Phase 1: In-memory dict per agent, serialized to JSON on save.
Phase 2: SQLite with FTS5 for content search.
