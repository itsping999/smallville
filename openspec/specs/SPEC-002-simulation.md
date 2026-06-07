# SPEC-002: Simulation Engine
**Traces to**: PRD Section 2, Architecture

## Time Model

```python
class SimulationClock:
    sim_start: datetime         # e.g., 2026-06-08 06:00:00 (a Monday)
    real_start: float           # time.monotonic() when started
    speed: float                # multiplier: 1x, 10x, 60x, 120x
    paused: bool
    
    def current_time(self) -> datetime:
        if self.paused:
            return self._paused_at
        elapsed_real = time.monotonic() - self.real_start
        elapsed_sim = elapsed_real * self.speed
        return self.sim_start + timedelta(seconds=elapsed_sim)
```

Speed presets:
| Preset | 1 real second = | Use case |
|--------|----------------|----------|
| 1x | 1 sim second | Detailed observation |
| 10x | 10 sim seconds | Normal watching |
| 60x | 1 sim minute | Default — minutes pass quickly |
| 120x | 2 sim minutes | Fast forward |

## Tick Loop

```python
async def run_simulation():
    while running:
        sim_time = clock.current_time()
        
        # 1. Environment update (weather, lighting, events)
        environment.tick(sim_time)
        
        # 2. Select agents to process this tick
        active = select_active_agents(sim_time)  # skip sleeping agents (every Nth tick)
        batch = active[:BATCH_SIZE]  # 5 agents per tick
        
        # 3. Process agent cognitive cycles concurrently
        tasks = [process_agent(agent, sim_time) for agent in batch]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 4. Handle exceptions gracefully
        for agent, result in zip(batch, results):
            if isinstance(result, Exception):
                agent.fallback_behavior(sim_time)
        
        # 5. Process scheduled events
        events = environment.get_due_events(sim_time)
        for event in events:
            await handle_event(event)
        
        # 6. Update needs/health/financial state
        for agent in all_agents:
            agent.needs.tick(sim_time)
            agent.health.tick(sim_time)
        
        # 7. Auto-save periodically
        if should_save(sim_time):
            await save_state()
        
        # 8. Broadcast state to frontend
        await broadcast_ws(get_world_state())
        
        # 9. Wait for next tick
        await asyncio.sleep(TICK_INTERVAL)  # 1 second real-time default
```

## Agent Selection

```python
def select_active_agents(sim_time):
    active = []
    for agent in all_agents:
        if agent.needs.energy < 10:  # Critical fatigue
            active.append(agent)  # Always process critical states
        elif agent.state == "sleeping" and tick_count % 30 != 0:
            continue  # Check sleeping agents every 30th tick
        else:
            active.append(agent)
    return active
```

## Tick Interval

Default: 1 second real-time. At 60x speed, that's 1 sim-minute per tick.
A full sim-day (24 hours = 1440 minutes) takes 24 real minutes at 60x.

## State Serialization

```python
class WorldState(BaseModel):
    sim_time: datetime
    speed: float
    agents: list[AgentState]
    locations: list[LocationState]
    events: list[Event]
    stats: SimulationStats  # conversations count, movements, etc.
```
