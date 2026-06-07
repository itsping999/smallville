# System Architecture

## Overview

Maplewood uses a layered architecture separating simulation, cognition, LLM integration, and presentation.

```
+--------------------------------------------------+
|           Frontend (Phaser 3 + HTML/JS)           |
|   Map View | Agent Panel | Controls | Event Log   |
+-----------------------+--------------------------+
                        | WebSocket + REST
+-----------------------+--------------------------+
|              API Layer (FastAPI)                   |
|   REST Routes | WebSocket Manager | CORS          |
+-----------------------+--------------------------+
                        |
+-----------------------+--------------------------+
|              Service Layer                        |
|  +-----------+ +-----------+ +---------------+   |
|  | Simulation | |  Agent    | |  Environment  |   |
|  | Engine     | |  Runtime  | |  Manager      |   |
|  +-----+------+ +-----+----+ +-------+-------+   |
|        |              |              |            |
|  +-----+------+ +-----+----+ +-------+-------+   |
|  | Memory     | |  LLM      | |  World State  |   |
|  | Stream     | |  Gateway  | |  + Events     |   |
|  +------------+ +----------+ +---------------+   |
+--------------------------------------------------+
                        |
+--------------------------------------------------+
|              Data Layer                           |
|   JSON Persistence | Config | Agent Definitions   |
+--------------------------------------------------+
```

## Layer Responsibilities

### API Layer
- FastAPI application with CORS
- REST endpoints for control (start/stop/speed), queries (agents, locations, events)
- WebSocket for real-time state push to frontend
- Static file serving for frontend assets

### Service Layer
- **Simulation Engine**: Tick-based loop, time management, agent scheduling, batch processing
- **Agent Runtime**: Per-agent cognitive cycle (perceive -> remember -> reflect -> plan -> decide -> act)
- **Environment Manager**: World state, location occupancy, object states, event injection
- **Memory Stream**: Per-agent memory CRUD, retrieval scoring, reflection triggering
- **LLM Gateway**: OpenAI-compatible client, rate limiting (semaphore), retry logic, prompt assembly

### Data Layer
- Agent definitions (identities, initial states)
- World data (locations, objects, connections)
- Runtime state (current agent positions, needs, plans)
- Persisted state (memories, events, relationships)

## Key Design Decisions

### 1. Deterministic Movement + LLM Decisions [Engineering]

Movement between locations follows deterministic schedules (occupation-based), but the *decision* to move, *what to do* upon arrival, and *conversation content* are all LLM-driven. This balances realism with LLM cost control.

```
Deterministic: Agent leaves home at 7:30 AM for work
LLM-driven:    Agent decides to stop at cafe on the way because they feel tired
LLM-driven:    Agent orders a specific drink and chats with the barista
```

### 2. Batch Processing [Engineering]

Not all agents are processed every tick. Sleeping agents are checked at reduced frequency. Active agents are processed in batches of 5 to limit concurrent LLM calls.

### 3. Event Chain via Plan Stack [Extended]

When an agent decides on a high-level action (e.g., "go to sleep"), the runtime generates a chain of sub-actions:
```
"go to sleep" -> [drive_home, enter_house, go_to_bedroom, use_bathroom, get_in_bed, sleep]
```
Each sub-action is executed sequentially. The LLM can interrupt the chain if a higher-priority need arises.

### 4. Personality as Prompt Weights [Extended]

Personality traits are not applied as numeric multipliers to outputs. Instead, they are injected into LLM prompts as natural language context:
```
You are Sarah. You are organized and conscientious. You prefer routine.
Right now you are feeling tired (energy: 25/100). You have work tomorrow.
What do you do next?
```
The LLM's inherent response variability provides the "uncertainty" the user requested — personality nudges the distribution, but doesn't deterministically select actions.

## Concurrency Model

```python
# Simulation tick loop
async def tick():
    sim_time = clock.current_time()
    batch = get_active_agents()[:5]  # Process 5 at a time
    
    tasks = [agent_cycle(agent, sim_time) for agent in batch]
    await asyncio.gather(*tasks)  # Concurrent within semaphore
    
    environment.update(sim_time)
    broadcast_state()  # WebSocket push

# LLM calls are bounded by semaphore
llm_semaphore = asyncio.Semaphore(3)
```

## File Structure (Backend)

```
backend/
├── app/
│   ├── main.py              # FastAPI app, lifespan, routes
│   ├── config.py            # Settings from env vars
│   ├── core/
│   │   ├── simulation.py    # Tick loop, clock, scheduling
│   │   ├── llm_gateway.py   # LLM client, semaphore, retries
│   │   ├── memory_stream.py # Memory CRUD, retrieval, reflection
│   │   ├── needs.py         # Needs system (energy, hunger, etc.)
│   │   ├── emotion.py       # Emotional state management
│   │   └── decision.py      # Priority arbitration
│   ├── models/
│   │   ├── agent.py         # Agent, Identity, Needs, Emotion models
│   │   ├── world.py         # Location, Object, WorldState models
│   │   ├── memory.py        # MemoryEntry, Reflection models
│   │   └── social.py        # Relationship, Conversation models
│   ├── services/
│   │   ├── agent_runtime.py # Agent cognitive cycle
│   │   ├── environment.py   # World state, perception builder
│   │   ├── social_service.py # Conversation, gossip, relationships
│   │   ├── financial.py     # Money management, transactions
│   │   ├── health.py        # Health/medical system
│   │   └── transport.py     # Movement, commuting
│   ├── data/
│   │   ├── agents.py        # Agent definitions
│   │   └── world.py         # Location/object definitions
│   └── templates/           # Jinja2 prompt templates
│       ├── importance_score.txt
│       ├── reflection.txt
│       ├── day_plan.txt
│       ├── action_decide.txt
│       ├── conversation.txt
│       ├── event_chain.txt
│       └── financial_decision.txt
├── tests/
│   ├── test_memory.py
│   ├── test_needs.py
│   ├── test_decision.py
│   └── test_transport.py
└── requirements.txt
```
