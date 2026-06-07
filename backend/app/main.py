"""Smallville — FastAPI application."""
from __future__ import annotations
import asyncio
import json
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware

from app.core.simulation import SimulationEngine
from app.config import FRONTEND_DIR, HOST, PORT

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger("smallville")

engine = SimulationEngine()
ws_clients: set[WebSocket] = set()


async def broadcast(state: dict):
    """Broadcast state to all WebSocket clients."""
    dead = set()
    msg = json.dumps(state, default=str)
    for ws in ws_clients:
        try:
            await ws.send_text(msg)
        except Exception:
            dead.add(ws)
    ws_clients -= dead


@asynccontextmanager
async def lifespan(app: FastAPI):
    engine.set_broadcast(broadcast)
    logger.info("Smallville backend starting...")
    yield
    await engine.llm.close()
    logger.info("Smallville backend stopping...")


app = FastAPI(title="Smallville", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── REST API ───────────────────────────────────────────────

@app.get("/api/v1/state")
async def get_state():
    return engine.get_state()

@app.get("/api/v1/agents")
async def get_agents():
    return [engine._agent_summary(a) for a in engine.agents]

@app.get("/api/v1/agents/{agent_id}")
async def get_agent(agent_id: str):
    for a in engine.agents:
        if a.id == agent_id:
            state = engine._agent_summary(a)
            # Add memories
            memories = engine.memory_store.get(agent_id).recent(20)
            state["recent_memories"] = [
                {"content": m.content, "type": m.type, "importance": m.importance,
                 "time": m.created_at.isoformat() if m.created_at else None}
                for m in memories
            ]
            # Add relationships
            rels = []
            for key, rel in engine.social.relationships.items():
                if agent_id in key:
                    other_id = rel.agent_b_id if rel.agent_a_id == agent_id else rel.agent_a_id
                    other = next((a for a in engine.agents if a.id == other_id), None)
                    if other:
                        rels.append({
                            "name": other.name,
                            "type": rel.type,
                            "closeness": rel.closeness,
                            "trust": rel.trust,
                        })
            state["relationships"] = rels
            return state
    return {"error": "Agent not found"}

@app.get("/api/v1/locations")
async def get_locations():
    return {
        lid: {"name": loc.name, "type": loc.type, "description": loc.description,
               "x": loc.x, "y": loc.y, "width": loc.width, "height": loc.height,
               "is_outdoor": loc.is_outdoor, "agents": [a.id for a in engine.agents if a.location_id == lid]}
        for lid, loc in engine.world.locations.items()
    }

@app.get("/api/v1/events")
async def get_events():
    return engine.event_log[-100:]

@app.post("/api/v1/simulation/start")
async def sim_start():
    await engine.start()
    return {"status": "running", "speed": engine.clock.speed}

@app.post("/api/v1/simulation/stop")
async def sim_stop():
    await engine.stop()
    return {"status": "paused"}

@app.post("/api/v1/simulation/speed/{speed}")
async def sim_speed(speed: float):
    engine.clock.set_speed(speed)
    return {"speed": engine.clock.speed}

@app.post("/api/v1/simulation/save")
async def sim_save():
    await engine.save_state()
    return {"status": "saved"}

@app.post("/api/v1/events/inject")
async def inject_event(event_type: str = "custom", message: str = ""):
    from datetime import datetime
    engine.environment.inject_event(event_type, {"message": message}, engine.clock.current_time())
    return {"status": "injected"}

# ── WebSocket ──────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    ws_clients.add(ws)
    logger.info(f"WebSocket client connected ({len(ws_clients)} total)")
    try:
        # Send initial state
        await ws.send_text(json.dumps(engine.get_state(), default=str))
        while True:
            data = await ws.receive_text()
            msg = json.loads(data)
            if msg.get("action") == "start":
                await engine.start()
                await ws.send_text(json.dumps(engine.get_state(), default=str))
            elif msg.get("action") == "stop":
                await engine.stop()
                await ws.send_text(json.dumps(engine.get_state(), default=str))
            elif msg.get("action") == "speed":
                engine.clock.set_speed(float(msg.get("value", 60)))
                await ws.send_text(json.dumps(engine.get_state(), default=str))
    except WebSocketDisconnect:
        pass
    finally:
        ws_clients.discard(ws)
        logger.info(f"WebSocket client disconnected ({len(ws_clients)} total)")

# ── Static files ───────────────────────────────────────────

@app.get("/")
async def index():
    return FileResponse(f"{FRONTEND_DIR}/index.html")

# Mount static files after routes
app.mount("/assets", StaticFiles(directory=f"{FRONTEND_DIR}/assets"), name="assets")
app.mount("/css", StaticFiles(directory=f"{FRONTEND_DIR}/css"), name="css")
app.mount("/js", StaticFiles(directory=f"{FRONTEND_DIR}/js"), name="js")
app.mount("/lib", StaticFiles(directory=f"{FRONTEND_DIR}/../lib"), name="lib")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=HOST, port=PORT, reload=True)
