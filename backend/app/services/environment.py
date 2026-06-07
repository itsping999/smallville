"""Environment manager — world state, perception, events."""
from __future__ import annotations
from datetime import datetime
from typing import Optional
from app.models.world import WorldState, Weather, Location
from app.models.agent import AgentState


class EnvironmentManager:
    def __init__(self, world: WorldState):
        self.world = world
        self.events: list[dict] = []
        self.tick_count = 0

    def tick(self, sim_time: datetime) -> None:
        self.tick_count += 1
        # Simple weather updates every 100 ticks
        if self.tick_count % 100 == 0:
            self._update_weather(sim_time)

    def _update_weather(self, sim_time: datetime) -> None:
        import random
        conditions = [("sunny", 72), ("cloudy", 65), ("rainy", 58), ("sunny", 78), ("sunny", 70)]
        cond, temp = random.choice(conditions)
        self.world.weather = Weather(
            condition=cond,
            temperature_f=temp,
            description=f"{'A beautiful sunny day' if cond == 'sunny' else 'Overcast skies' if cond == 'cloudy' else 'Light rain falling'}",
        )

    def get_location(self, location_id: str) -> Optional[Location]:
        return self.world.locations.get(location_id)

    def get_agents_at(self, location_id: str, all_agents: list[AgentState]) -> list[AgentState]:
        return [a for a in all_agents if a.location_id == location_id]

    def get_objects_at(self, location_id: str) -> list:
        loc = self.world.locations.get(location_id)
        return loc.objects if loc else []

    def build_perception(self, agent: AgentState, all_agents: list[AgentState],
                          sim_time: datetime) -> dict:
        loc = self.get_location(agent.location_id)
        if not loc:
            return {"error": "Unknown location"}

        others = [a for a in self.get_agents_at(agent.location_id, all_agents) if a.id != agent.id]
        objects = self.get_objects_at(agent.location_id)

        return {
            "location_name": loc.name,
            "location_description": loc.description,
            "location_type": loc.type,
            "people_here": [{"name": a.name, "activity": a.current_activity, "mood": a.emotion.dominant} for a in others],
            "objects_here": [{"name": o.name, "actions": o.possible_actions} for o in objects],
            "time": sim_time.strftime("%A, %I:%M %p"),
            "weather": self.world.weather.description,
            "temperature": self.world.weather.temperature_f,
            "is_outdoor": loc.is_outdoor,
        }

    def inject_event(self, event_type: str, data: dict, sim_time: datetime) -> None:
        self.events.append({"type": event_type, "data": data, "time": sim_time, "handled": False})

    def get_due_events(self, sim_time: datetime) -> list[dict]:
        return [e for e in self.events if not e["handled"]]

    def mark_event_handled(self, event_idx: int) -> None:
        if 0 <= event_idx < len(self.events):
            self.events[event_idx]["handled"] = True
