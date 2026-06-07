"""LLM Gateway — OpenAI-compatible client with rate limiting."""
from __future__ import annotations
import asyncio
import logging
import httpx
from app.config import LLM_BASE_URL, LLM_API_KEY, LLM_MODEL, LLM_TIMEOUT, LLM_MAX_RETRIES, LLM_CONCURRENCY

logger = logging.getLogger("maplewood.llm")


class LLMGateway:
    def __init__(self):
        self.client = httpx.AsyncClient(
            base_url=LLM_BASE_URL,
            timeout=LLM_TIMEOUT,
            headers={"Authorization": f"Bearer {LLM_API_KEY}"},
        )
        self.semaphore = asyncio.Semaphore(LLM_CONCURRENCY)
        self.call_count = 0
        self.error_count = 0

    async def complete(self, system: str, user: str,
                       temperature: float = 0.7, max_tokens: int = 500) -> str:
        async with self.semaphore:
            for attempt in range(LLM_MAX_RETRIES):
                try:
                    self.call_count += 1
                    resp = await self.client.post("/chat/completions", json={
                        "model": LLM_MODEL,
                        "messages": [
                            {"role": "system", "content": system},
                            {"role": "user", "content": user},
                        ],
                        "temperature": temperature,
                        "max_tokens": max_tokens,
                    })
                    resp.raise_for_status()
                    return resp.json()["choices"][0]["message"]["content"].strip()
                except httpx.HTTPStatusError as e:
                    if e.response.status_code == 429:
                        wait = 2 ** attempt
                        logger.warning(f"Rate limited, waiting {wait}s (attempt {attempt+1})")
                        await asyncio.sleep(wait)
                    else:
                        logger.error(f"LLM HTTP error: {e}")
                        self.error_count += 1
                        break
                except Exception as e:
                    logger.error(f"LLM error: {e}")
                    self.error_count += 1
                    break
            return ""

    async def score_importance(self, content: str) -> float:
        """Score memory importance 1-10 via LLM."""
        result = await self.complete(
            system="You are a memory importance scorer. Rate the following memory on a scale of 1-10 where 1 is mundane and 10 is life-changing. Reply with ONLY a number.",
            user=f"Memory: {content}",
            temperature=0.1,
            max_tokens=10,
        )
        try:
            score = float(result.strip().split()[0].rstrip("."))
            return max(1.0, min(10.0, score))
        except (ValueError, IndexError):
            return 5.0  # Default middle importance

    async def generate_conversation(self, system: str, context: str) -> str:
        """Generate conversation dialogue."""
        return await self.complete(
            system=system,
            user=context,
            temperature=0.9,
            max_tokens=400,
        )

    async def decide_action(self, system: str = "", user: str = "", **kw) -> str:
        """Generate action decision."""
        return await self.complete(
            system=system,
            user=user,
            temperature=0.8,
            max_tokens=300,
        )

    async def plan_day(self, system: str = "", user: str = "", **kw) -> str:
        """Generate daily plan."""
        return await self.complete(
            system=system,
            user=user,
            temperature=0.7,
            max_tokens=600,
        )

    async def reflect(self, system: str = "", user: str = "", **kw) -> str:
        """Generate reflection from memories."""
        return await self.complete(
            system=system,
            user=user,
            temperature=0.7,
            max_tokens=300,
        )

    async def close(self):
        await self.client.aclose()

    def stats(self) -> dict:
        return {"calls": self.call_count, "errors": self.error_count}
