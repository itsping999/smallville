# SPEC-007: Transportation System
**Traces to**: PRD Section 4.7

## Transport Modes

```python
class TransportMode(Enum):
    WALKING = "walking"      # 5 km/h, always available
    DRIVING = "driving"      # 30-60 km/h, requires vehicle
    CYCLING = "cycling"      # 15 km/h, requires bicycle
```

## Movement Model

```python
class Movement:
    agent_id: str
    origin: str              # Location ID
    destination: str         # Location ID
    mode: TransportMode
    distance_km: float
    started_at: SimTime
    estimated_arrival: SimTime
    route: list[str]         # Waypoint location IDs
    progress: float          # 0.0 - 1.0
```

## Street Network

```python
STREET_GRAPH = {
    "oak_lane": {"main_street": 0.8, "community_drive": 0.5},
    "main_street": {"oak_lane": 0.8, "riverside_tech": 0.6, "school": 0.4, "town_hall": 0.7},
    "community_drive": {"oak_lane": 0.5, "elm_park": 0.3, "community_center": 0.2, "medical_center": 0.4},
    "elm_park": {"community_drive": 0.3},
    "maple_court": {"main_street": 0.5, "riverside_tech": 0.4},
    # ... edges with distances in km
}
```

## Transport Decision

```python
def choose_transport(agent, origin, destination, urgency):
    distance = get_distance(origin, destination)
    
    if distance < 0.5:  # 500m
        return TransportMode.WALKING  # Almost always walk short distances
    
    if distance < 2.0:
        if agent.has_bicycle and weather != "rainy":
            if agent.personality.openness > 0.3:  # Eco-conscious tendency
                return TransportMode.CYCLING
        return TransportMode.WALKING if not urgency else TransportMode.DRIVING
    
    # Long distance
    if agent.has_car:
        if urgency == "high" or weather == "rainy":
            return TransportMode.DRIVING
        # Personality: eco-conscious agents might still bike
        if agent.personality.openness > 0.6 and agent.has_bicycle:
            return TransportMode.CYCLING
        return TransportMode.DRIVING
    
    return TransportMode.WALKING  # No vehicle, must walk
```

## Travel Time Calculation

```python
def calculate_travel_time(distance_km, mode, time_of_day):
    base_speed = {
        TransportMode.WALKING: 5,    # km/h
        TransportMode.CYCLING: 15,
        TransportMode.DRIVING: 40,   # Urban average
    }[mode]
    
    # Rush hour modifier (7-9 AM, 5-7 PM)
    if mode == TransportMode.DRIVING:
        hour = time_of_day.hour
        if hour in range(7, 9) or hour in range(17, 19):
            base_speed *= 0.6  # 40% slower in rush hour
    
    # Weather modifier
    if weather == "rainy" and mode in [TransportMode.WALKING, TransportMode.CYCLING]:
        base_speed *= 0.8
    
    hours = distance_km / base_speed
    return timedelta(hours=hours)
```

## Fuel/Effort Cost

| Mode | Cost | Notes |
|------|------|-------|
| Walking | Free | Exercise benefit (+2 fun) |
| Cycling | Free | Exercise benefit (+3 fun) |
| Driving | $0.15/km | Gas + wear, deducted from cash |

## Vehicle Ownership

```python
class Vehicle(BaseModel):
    id: str
    type: str           # "sedan" | "suv" | "truck" | "bicycle"
    owner_id: str
    fuel_level: float   # 0-100 (cars only)
    condition: float    # 0-100
    location_id: str    # Where it's currently parked
```

Phase 1: All agents have assigned vehicles. Phase 2+: vehicle purchase/maintenance decisions.
