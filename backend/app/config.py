"""Maplewood configuration from environment variables."""
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))

# LLM
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "http://112.5.167.211:58788/v1")
LLM_API_KEY = os.getenv("LLM_API_KEY", "sk-placeholder")
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-5.5")
LLM_TIMEOUT = int(os.getenv("LLM_TIMEOUT", "30"))
LLM_MAX_RETRIES = int(os.getenv("LLM_MAX_RETRIES", "3"))
LLM_CONCURRENCY = int(os.getenv("LLM_CONCURRENCY", "3"))

# Simulation
SIM_SPEED = float(os.getenv("SIM_SPEED", "60"))  # seconds per sim-minute
TICK_INTERVAL = float(os.getenv("TICK_INTERVAL", "1.0"))  # real seconds per tick
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "5"))
SAVE_INTERVAL_MINUTES = int(os.getenv("SAVE_INTERVAL_MINUTES", "10"))
REFLECTION_THRESHOLD = float(os.getenv("REFLECTION_THRESHOLD", "150"))

# Memory retrieval weights
MEMORY_ALPHA = float(os.getenv("MEMORY_ALPHA", "1.0"))   # recency
MEMORY_BETA = float(os.getenv("MEMORY_BETA", "1.0"))     # importance
MEMORY_GAMMA = float(os.getenv("MEMORY_GAMMA", "1.0"))   # relevance
MEMORY_K = int(os.getenv("MEMORY_K", "15"))

# Server
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8080"))

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SAVES_DIR = os.path.join(BASE_DIR, "saves")
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend", "public")
