# Agent Instructions

## Project Purpose

Smallville is a modernized fork of `joonspk-research/generative_agents`. The active product surface is now a FastAPI backend plus React/Phaser frontend. The original Reverie engine remains under `reverie/` and is wrapped by the new API and data layout.

## Source Of Truth

- Human-facing setup and usage docs live in `README.md`.
- Agent-facing implementation notes live in this `AGENTS.md`.
- Do not add new human docs unless the user explicitly asks; fold durable user-facing information into `README.md`.

## Project Map

- `backend/app/` - FastAPI app factory, API routes, schemas, and storage services.
- `backend/static/` - served map, character, atlas, and Tiled assets. Frontend paths expect `/static/assets/...` and `/static/img/...`.
- `frontend/` - React + Vite client. `PhaserGame.tsx` owns map rendering, camera controls, movement replay, and live environment handoff.
- `reverie/backend_server/` - original persona cognition, memory, maze, pathfinding, prompt templates, and interactive CLI.
- `data/storage/` - base simulations and local live simulation output.
- `data/compressed_storage/` - compressed replay demos consumed by `/api/demo/...`.
- `data/temp_storage/` - live handoff files between Reverie and the frontend API; ignored by Git.
- `scripts/generate_utils.py` - reads `.env` and writes generated `reverie/backend_server/utils.py`.

## Configuration

LLM settings come from `.env` and environment variables:

```dotenv
LLM_BASE_URL=http://112.5.167.211:58788/v1
LLM_API_KEY=sk-placeholder
LLM_MODEL=gpt5.5
LLM_COMPLETION_MODEL=
LLM_DISABLE_EMBEDDINGS=1
LLM_EMBEDDING_MODEL=text-embedding-ada-002
KEY_OWNER=local
DEBUG=True
```

Never commit real API keys. `reverie/backend_server/utils.py` is generated and ignored; regenerate it with `python3 scripts/generate_utils.py` after changing `.env` or `scripts/generate_utils.py`.

## Commands

| Task | Command |
| --- | --- |
| Install Python deps | `pip install -r requirements.txt` |
| Install frontend deps | `cd frontend && npm install` |
| Generate Reverie config | `python3 scripts/generate_utils.py` |
| Run FastAPI | `uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000` |
| Run React dev server | `cd frontend && npm run dev` |
| Build frontend | `cd frontend && npm run build` |
| Run backend tests | `python -m pytest backend/tests` |
| Compile Python | `python -m compileall backend/app scripts reverie/backend_server` |
| Smoke Reverie | `python scripts/smoke_reverie.py` |
| Run Reverie CLI | `cd reverie/backend_server && python reverie.py` |

There are intentionally no root startup shell scripts.

## Engineering Notes

- Keep FastAPI route handlers thin. Put filesystem and simulation data shaping in `backend/app/services/`.
- Preserve the frontend API contract in `frontend/src/api.ts` when changing backend responses.
- Keep the React app usable in both modes: Vite dev server proxy and FastAPI-served production build.
- Camera behavior belongs in `frontend/src/components/PhaserGame.tsx`. Verify default zoom, drag pan, wheel zoom, `Fit`, and `Agents` after changes.
- Keep static asset paths stable unless you update both Phaser preload paths and backend static mounting.
- The Reverie engine still uses old import style from `reverie/backend_server`; prefer small compatibility patches over broad rewrites.
- Treat `data/storage/live-*`, `data/storage/codex-*`, and `data/temp_storage/*` as local runtime output.

## Verification Expectations

For backend/API changes, run:

```bash
python -m pytest backend/tests
python -m compileall backend/app scripts reverie/backend_server
python scripts/smoke_reverie.py
```

For frontend changes, run:

```bash
cd frontend && npm run build
```

For UI/camera changes, also start the backend and inspect the bundled demo in the browser:

```bash
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

Open `/demo/July1_the_ville_isabella_maria_klaus-step-3-20/1` and verify the map is nonblank, the default camera is comfortable, drag and zoom work, and `Fit` shows the whole map.
