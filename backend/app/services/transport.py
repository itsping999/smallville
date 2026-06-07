"""Transport service — movement between locations."""
from __future__ import annotations
from typing import Optional
from app.models.world import WorldState, StreetEdge
from app.models.agent import AgentState
from app.data.world import get_travel_time


class TransportService:
    def __init__(self, world: WorldState):
        self.world = world
        self.active_movements: dict[str, dict] = {}  # agent_id -> movement info

    def find_path(self, from_id: str, to_id: str) -> list[str]:
        """Simple BFS shortest path between locations."""
        if from_id == to_id:
            return [from_id]
        
        # Build adjacency from street graph
        adj: dict[str, list[str]] = {}
        for edge in self.world.street_graph:
            adj.setdefault(edge.from_location, []).append(edge.to_location)
        
        # BFS
        from collections import deque
        visited = {from_id}
        queue = deque([(from_id, [from_id])])
        while queue:
            current, path = queue.popleft()
            for neighbor in adj.get(current, []):
                if neighbor == to_id:
                    return path + [neighbor]
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append((neighbor, path + [neighbor]))
        
        return [from_id, to_id]  # Direct if no path found

    def get_distance(self, from_id: str, to_id: str) -> float:
        """Get distance in km between two connected locations."""
        for edge in self.world.street_graph:
            if edge.from_location == from_id and edge.to_location == to_id:
                return edge.distance_km
        return 1.0  # Default distance

    def choose_transport(self, agent: AgentState, distance_km: float, urgency: str = "normal") -> str:
        """Choose transport mode based on agent state and personality."""
        if distance_km < 0.5:
            return "walking"
        if distance_km < 2.0:
            if agent.has_bicycle and self.world.weather.condition != "rainy":
                return "cycling"
            if urgency == "high" and agent.has_car:
                return "driving"
            return "walking"
        # Long distance
        if agent.has_car:
            if urgency == "high" or self.world.weather.condition in ("rainy", "snowy"):
                return "driving"
            if agent.has_bicycle and agent.personality.openness > 0.5:
                return "cycling"
            return "driving"
        if agent.has_bicycle:
            return "cycling"
        return "walking"

    def start_movement(self, agent: AgentState, destination: str, mode: str, hour: int = 12) -> dict:
        """Start agent movement to a destination."""
        distance = self.get_distance(agent.location_id, destination)
        travel_min = get_travel_time(distance, mode, hour)
        
        self.active_movements[agent.id] = {
            "origin": agent.location_id,
            "destination": destination,
            "mode": mode,
            "distance_km": distance,
            "travel_minutes": travel_min,
            "progress": 0.0,
        }
        agent.is_moving = True
        agent.move_destination = destination
        agent.move_progress = 0.0
        agent.current_activity = f"traveling_{mode}"
        return self.active_movements[agent.id]

    def update_movement(self, agent: AgentState, dt_minutes: float) -> bool:
        """Update movement progress. Returns True if arrived."""
        if agent.id not in self.active_movements:
            return True
        
        mov = self.active_movements[agent.id]
        if mov["travel_minutes"] <= 0:
            mov["progress"] = 1.0
        else:
            increment = dt_minutes / mov["travel_minutes"]
            mov["progress"] = min(1.0, mov["progress"] + increment)
        
        agent.move_progress = mov["progress"]
        
        if mov["progress"] >= 1.0:
            # Arrived
            agent.location_id = mov["destination"]
            agent.is_moving = False
            agent.move_destination = None
            agent.move_progress = 0.0
            del self.active_movements[agent.id]
            return True
        return False
