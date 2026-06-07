# Maplewood — AI Agent Community Simulation

An autonomous multi-agent simulation where LLM-driven agents live realistic lives in a US suburban community.

## Quick Start

```bash
cd maplewood
./run.sh
# Open http://localhost:8080
```

## Architecture

- **Backend**: Python 3.11+ / FastAPI / asyncio
- **Frontend**: Phaser 3 (2D cartoon map) + HTML/CSS overlay
- **LLM**: OpenAI-compatible API (configurable via `.env`)
- **Docs**: OpenSpec format in `openspec/`

## Agents

8 predefined residents of Maplewood, each with unique personality, occupation, financial situation, and life story.

## Systems

- **Memory**: Observation, conversation, reflection storage with retrieval scoring
- **Needs**: Energy, hunger, hygiene, social, health, fun
- **Emotion**: Valence/arousal model with personality-dependent dynamics
- **Social**: Relationship evolution, conversation generation, gossip propagation
- **Financial**: Income, expenses, savings, investment decisions
- **Health**: Conditions, medication, medical visits, exercise
- **Transport**: Walking, cycling, driving with travel time simulation

## Configuration

Edit `.env`:
```
LLM_BASE_URL=http://your-api-endpoint/v1
LLM_API_KEY=your-key
LLM_MODEL=your-model
```

## Design Documents

See `openspec/` for full PRD, architecture, and feature specs.
