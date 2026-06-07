# SPEC-003: LLM Integration
**Traces to**: PRD Section 7

## Configuration

```python
LLM_BASE_URL = env("LLM_BASE_URL", "http://112.5.167.211:58788/v1")
LLM_API_KEY = env("LLM_API_KEY", "sk-placeholder")
LLM_MODEL = env("LLM_MODEL", "gpt-5.5")
LLM_TIMEOUT = env_int("LLM_TIMEOUT", 30)
LLM_MAX_RETRIES = env_int("LLM_MAX_RETRIES", 3)
LLM_CONCURRENCY = env_int("LLM_CONCURRENCY", 3)
```

## Client

OpenAI-compatible HTTP client using `httpx.AsyncClient`:

```python
class LLMGateway:
    def __init__(self):
        self.client = httpx.AsyncClient(base_url=LLM_BASE_URL, timeout=LLM_TIMEOUT)
        self.semaphore = asyncio.Semaphore(LLM_CONCURRENCY)
    
    async def complete(self, system: str, user: str, temperature: float = 0.7) -> str:
        async with self.semaphore:
            for attempt in range(LLM_MAX_RETRIES):
                try:
                    resp = await self.client.post("/chat/completions", json={
                        "model": LLM_MODEL,
                        "messages": [
                            {"role": "system", "content": system},
                            {"role": "user", "content": user},
                        ],
                        "temperature": temperature,
                        "max_tokens": 500,
                    })
                    resp.raise_for_status()
                    return resp.json()["choices"][0]["message"]["content"]
                except httpx.HTTPStatusError as e:
                    if e.response.status_code == 429:
                        await asyncio.sleep(2 ** attempt)  # Exponential backoff
                    else:
                        raise
            return ""  # Fallback on exhaustion
```

## Prompt Templates

Jinja2 templates in `backend/app/templates/`:

| Template | Purpose | Temperature |
|----------|---------|-------------|
| `importance_score.txt` | Score memory importance 1-10 | 0.1 |
| `reflection.txt` | Generate insights from memories | 0.7 |
| `day_plan.txt` | Generate daily schedule | 0.7 |
| `action_decide.txt` | Choose next action | 0.8 |
| `conversation.txt` | Generate dialogue turns | 0.9 |
| `event_chain.txt` | Decompose complex action into steps | 0.5 |
| `financial_decision.txt` | Investment/spending decisions | 0.6 |
| `mood_update.txt` | Assess emotional state change | 0.3 |

## Fallback Behavior

When LLM is unavailable or times out:
- Action decision: follow pre-defined schedule
- Conversation: use template-based greeting ("Hi {name}, how are you?")
- Importance scoring: use heuristic based on action type
- Reflection: skip until LLM available
- Financial: use personality-based defaults

## Rate Limiting

- Semaphore limits concurrent calls to LLM_CONCURRENCY (default: 3)
- Per-agent cooldown: minimum 5 seconds between LLM calls for same agent
- Global rate: respect API 429s with exponential backoff
