# Smallville — AI Agent Community Simulation

An autonomous multi-agent simulation where LLM-driven agents live realistic lives in a US suburban community. Each agent has independent identity, memory, reflection, planning, and decision-making driven by a Large Language Model. Social relationships, collective events, financial behaviors, and cultural norms emerge organically from individual actions.

Inspired by *Generative Agents: Interactive Simulacra of Human Behavior* (Stanford, Park et al., UIST 2023), expanded with real-world systems: nutrition, emotion, health, finance, transportation, and occupation.

## Core Concepts

- **Autonomous Agents**: Each agent is an independent entity with personality, preferences, life stage, and goals. All decisions are LLM-driven with inherent uncertainty.
- **Emergent Behavior**: Social gatherings, market trends, relationship dynamics, and community events arise naturally from individual agent actions.
- **Realistic Systems**: Agents eat, sleep, work, commute, exercise, socialize, manage finances, experience emotions, and respond to health conditions.
- **Location-Aware Actions**: Actions require physical presence — sleeping happens in bed, cooking in a kitchen, conversations require co-location.
- **Event Chain Logic**: Single desires trigger multi-step action chains with priority arbitration (e.g., feeling sleepy -> drive home -> wash up -> get in bed -> sleep).
- **Observable & Interactive**: Users can watch agents in real-time, inspect memories, plans, conversations, and optionally intervene.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11+ + FastAPI + asyncio |
| Frontend | Phaser 3 (2D cartoon map) + vanilla JS/HTML |
| Communication | WebSocket (real-time) + REST |
| LLM | OpenAI-compatible API (configurable) |
| Storage | JSON persistence (Phase 1), SQLite (Phase 2+) |
| Prompt Engine | Jinja2 templates |

## Quick Start

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example ../.env   # set LLM_BASE_URL + LLM_API_KEY
python -m uvicorn app.main:app --host 0.0.0.0 --port 8080
# open http://localhost:8080
```

## OpenSpec Conventions

- [Paper] — directly from the Stanford Generative Agents paper
- [Extended] — Smallville-specific extensions for realism
- [Engineering] — implementation decisions not in the paper

## Scope Phases

| Phase | Scope |
|-------|-------|
| Phase 1 (Current) | 5-8 agents, small US suburban community, core cognitive loop, basic social/health/financial systems, cartoon frontend |
| Phase 2 | 15-25 agents, expanded community, transportation system, advanced financial instruments, save/load |
| Phase 3 | 50+ agents, city-scale, emergent organizations, market dynamics, multiplayer observation |
