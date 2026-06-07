"""World, Location, and Object models."""
from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional


class WorldObject(BaseModel):
    id: str
    name: str
    description: str = ""
    possible_actions: list[str] = Field(default_factory=list)
    state: dict = Field(default_factory=dict)
    can_be_moved: bool = False


class Location(BaseModel):
    id: str
    name: str
    type: str  # "house", "apartment", "cafe", "grocery", "school", "park", "office", etc.
    description: str = ""
    parent_id: Optional[str] = None
    children: list[str] = Field(default_factory=list)
    objects: list[WorldObject] = Field(default_factory=list)
    # Map position (tile coordinates)
    x: int = 0
    y: int = 0
    width: int = 4
    height: int = 4
    # Properties
    is_outdoor: bool = False
    is_public: bool = True
    capacity: int = 20  # Max agents comfortably
    opening_hours: Optional[tuple[int, int]] = None  # (open_hour, close_hour), None=always


class StreetEdge(BaseModel):
    from_location: str
    to_location: str
    distance_km: float
    is_drivable: bool = True
    is_walkable: bool = True
    is_bikeable: bool = True


class Weather(BaseModel):
    condition: str = "sunny"  # sunny, cloudy, rainy, snowy, hot, cold
    temperature_f: int = 72
    description: str = "A pleasant sunny day"

    def affects_transport(self) -> bool:
        return self.condition in ("rainy", "snowy")


class WorldState(BaseModel):
    locations: dict[str, Location] = Field(default_factory=dict)
    street_graph: list[StreetEdge] = Field(default_factory=list)
    weather: Weather = Field(default_factory=Weather)
    day_of_week: int = 0  # 0=Monday
