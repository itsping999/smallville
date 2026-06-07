"""Simulation engine — tick loop, clock, state management."""
from __future__ import annotations
import asyncio
import json
import logging
import os
import time
from datetime import datetime, timedelta
from typing import Optional, Callable, Any

from app.models.agent import AgentState
from app.core.memory_stream import MemoryStore
from app.core.llm_gateway import LLMGateway
from app.services.agent_runtime import AgentRuntime
from app.services.environment import EnvironmentManager
from app.services.social_service import SocialService
from app.services.transport import TransportService
from app.data.agents import create_agents
from app.data.world import create_world
from app.config import TICK_INTERVAL, BATCH_SIZE, SAVE_INTERVAL_MINUTES, SAVES_DIR

logger = logging.getLogger("maplewood.sim")


class SimulationClock:
    def __init__(self, sim_start: Optional[datetime] = None, speed: float = 60.0):
        self.sim_start = sim_start or datetime(2026, 6, 8, 6, 0, 0)  # Monday 6 AM
        self.real_start = time.monotonic()
        self.speed = speed  # sim-seconds per real-second
        self.paused = False
        self._paused_at = self.sim_start

    def current_time(self) -> datetime:
        if self.paused:
            return self._paused_at
        elapsed_real = time.monotonic() - self.real_start
        elapsed_sim = elapsed_real * self.speed
        return self.sim_start + timedelta(seconds=elapsed_sim)

    def set_speed(self, speed: float) -> None:
        if self.paused:
            return
        # Preserve current sim time
        current = self.current_time()
        self.speed = speed
        self.sim_start = current
        self.real_start = time.monotonic()

    def pause(self) -> None:
        if not self.paused:
            self._paused_at = self.current_time()
            self.paused = True

    def resume(self) -> None:
        if self.paused:
            self.sim_start = self._paused_at
            self.real_start = time.monotonic()
            self.paused = False

    def day_number(self) -> int:
        return (self.current_time().date() - self.sim_start.date()).days + 1


class SimulationEngine:
    def __init__(self):
        self.clock = SimulationClock(speed=60.0)
        self.running = False
        self.tick_count = 0

        # Core systems
        self.memory_store = MemoryStore()
        self.llm = LLMGateway()

        # World
        self.world = create_world()
        self.agents = create_agents()

        # Services
        self.environment = EnvironmentManager(self.world)
        self.transport = TransportService(self.world)
        self.social = SocialService(self.memory_store, self.llm)
        self.runtime = AgentRuntime(
            self.memory_store, self.llm, self.environment, self.social, self.transport
        )

        # Event log for frontend
        self.event_log: list[dict] = []
        self.stats = {
            "total_conversations": 0,
            "total_movements": 0,
            "total_actions": 0,
            "total_llm_calls": 0,
        }

        # WebSocket broadcast callback
        self._broadcast: Optional[Callable] = None

    def set_broadcast(self, fn: Callable) -> None:
        self._broadcast = fn

    async def start(self) -> None:
        if self.running:
            return
        self.running = True
        self.clock.resume()
        logger.info("Simulation started at speed %.0fx", self.clock.speed)
        asyncio.create_task(self._run_loop())

    async def stop(self) -> None:
        self.running = False
        self.clock.pause()
        logger.info("Simulation paused")

    async def _run_loop(self) -> None:
        while self.running:
            await self._tick()
            await asyncio.sleep(TICK_INTERVAL)

    async def _tick(self) -> None:
        self.tick_count += 1
        sim_time = self.clock.current_time()
        hour = sim_time.hour

        # Environment tick
        self.environment.tick(sim_time)

        # Update movement for ALL moving agents first
        for agent in self.agents:
            if agent.is_moving:
                arrived = self.transport.update_movement(agent, dt_minutes=TICK_INTERVAL * self.clock.speed / 60)
                if arrived:
                    self.event_log.append({
                        "time": sim_time.strftime("%I:%M %p"),
                        "type": "movement", "icon": "\U0001f6b6",
                        "text": f"{agent.name} arrived at {self.world.locations[agent.location_id].name if agent.location_id in self.world.locations else agent.location_id}",
                        "agent_id": agent.id,
                    })
                    self.memory_store.get(agent.id).add(
                        f"Arrived at {agent.location_id}", "observation", 2.0, sim_time=sim_time
                    )
                    agent.current_activity = "idle"

        # Select active agents
        active = self._select_active_agents()
        batch = active[:BATCH_SIZE]

        # Process agents concurrently
        tasks = [self.runtime.process_agent(a, sim_time, self.agents) for a in batch]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for agent, result in zip(batch, results):
            if isinstance(result, Exception):
                logger.error(f"Agent {agent.name} error: {result}")
            elif isinstance(result, dict):
                self._process_result(result, sim_time)

        # Update emotions for agents whose needs changed
        for agent in self.agents:
            from app.core.emotion import update_emotion
            update_emotion(agent)

        # Auto-save
        if self.tick_count % (SAVE_INTERVAL_MINUTES * 60 // max(1, TICK_INTERVAL)) == 0:
            await self.save_state()

        # Broadcast
        if self._broadcast and self.tick_count % 3 == 0:  # Every 3 ticks
            try:
                await self._broadcast(self.get_state())
            except Exception:
                pass

    def _select_active_agents(self) -> list[AgentState]:
        import random
        active = []
        sleeping = []
        for agent in self.agents:
            if agent.needs.energy < 10:
                active.append(agent)
            elif agent.current_activity == "sleeping" and self.tick_count % 5 != 0:
                continue
            elif agent.current_activity == "sleeping":
                sleeping.append(agent)
            else:
                active.append(agent)
        # Prioritize sleeping agents so they get processed
        random.shuffle(active)
        return sleeping + active

    def _process_result(self, result: dict, sim_time: datetime) -> None:
        agent_name = result["agent_name"]
        for action in result.get("actions", []):
            self.event_log.append({
                "time": sim_time.strftime("%I:%M %p"),
                "type": "action",
                "icon": self._action_icon(action),
                "text": action,
                "agent_id": result["agent_id"],
            })
            self.stats["total_actions"] += 1

        for conv in result.get("conversations", []):
            self.event_log.append({
                "time": sim_time.strftime("%I:%M %p"),
                "type": "conversation",
                "icon": "\U0001f4ac",
                "text": f"{agent_name} talked with {conv['with']}: {conv['summary']}",
                "agent_id": result["agent_id"],
            })
            self.stats["total_conversations"] += 1

        for mov in result.get("movements", []):
            self.event_log.append({
                "time": sim_time.strftime("%I:%M %p"),
                "type": "movement",
                "icon": "\U0001f697",
                "text": mov,
                "agent_id": result["agent_id"],
            })
            self.stats["total_movements"] += 1

        # Keep event log manageable
        if len(self.event_log) > 500:
            self.event_log = self.event_log[-300:]

    def _action_icon(self, action: str) -> str:
        al = action.lower()
        if "sleep" in al: return "\U0001f4a4"
        if "eat" in al: return "\U0001f374"
        if "work" in al: return "\U0001f4bb"
        if "walk" in al or "moving" in al or "commut" in al: return "\U0001f6b6"
        if "drive" in al or "driv" in al: return "\U0001f697"
        if "exercise" in al or "jog" in al: return "\U0001f3c3"
        if "shop" in al: return "\U0001f6d2"
        if "read" in al: return "\U0001f4d6"
        if "cook" in al: return "\U0001f468\u200d\U0001f373"
        if "talk" in al or "chat" in al or "social" in al: return "\U0001f4ac"
        if "wake" in al or "morning" in al: return "\u2600\ufe0f"
        if "relax" in al: return "\U0001f60c"
        return "\U0001f464"

    def get_state(self) -> dict:
        sim_time = self.clock.current_time()
        return {
            "sim_time": sim_time.isoformat(),
            "sim_time_display": sim_time.strftime("%a %b %d, %I:%M %p"),
            "speed": self.clock.speed,
            "paused": self.clock.paused,
            "day_number": self.clock.day_number(),
            "tick_count": self.tick_count,
            "weather": self.world.weather.model_dump(),
            "stats": {**self.stats, "llm_calls": self.llm.call_count, "llm_errors": self.llm.error_count},
            "agents": [self._agent_summary(a) for a in self.agents],
            "event_log": self.event_log[-50:],
            "locations": {
                lid: {"name": loc.name, "type": loc.type, "x": loc.x, "y": loc.y,
                       "agents": [a.id for a in self.agents if a.location_id == lid]}
                for lid, loc in self.world.locations.items()
            },
        }

    def _agent_summary(self, agent: AgentState) -> dict:
        return {
            "id": agent.id,
            "name": agent.name,
            "age": agent.age,
            "occupation": agent.occupation,
            "location_id": agent.location_id,
            "current_activity": agent.current_activity,
            "is_moving": agent.is_moving,
            "move_progress": agent.move_progress,
            "move_destination": agent.move_destination,
            "emotion": agent.emotion.model_dump(),
            "needs": agent.needs.model_dump(),
            "personality": agent.personality.model_dump(),
            "interests": agent.interests,
            "bio": agent.bio,
            "financial": {
                "cash": agent.financial.cash,
                "savings": agent.financial.savings,
                "disposition": agent.financial.disposition,
            },
            "health": agent.health.model_dump(),
            "has_car": agent.has_car,
            "has_bicycle": agent.has_bicycle,
            "home_location_id": agent.home_location_id,
            "workplace_id": agent.workplace_id,
        }

    async def save_state(self) -> None:
        os.makedirs(SAVES_DIR, exist_ok=True)
        state = {
            "sim_time": self.clock.current_time().isoformat(),
            "speed": self.clock.speed,
            "day_number": self.clock.day_number(),
            "tick_count": self.tick_count,
            "agents": [a.model_dump() for a in self.agents],
            "memories": self.memory_store.save_all(),
            "stats": self.stats,
            "event_log": self.event_log[-100:],
        }
        path = os.path.join(SAVES_DIR, "state.json")
        with open(path, "w") as f:
            json.dump(state, f, default=str, indent=2)
        logger.info("State saved to %s", path)
