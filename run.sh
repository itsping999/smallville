#!/bin/bash
set -e
cd "$(dirname "$0")/backend"

# Create venv if needed
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
    .venv/bin/pip install -r requirements.txt
fi

# Copy .env if needed
if [ ! -f "../.env" ]; then
    cp ../.env.example ../.env
    echo "Created .env from .env.example — edit with your LLM endpoint"
fi

echo "Starting Maplewood on http://localhost:8080"
exec .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload
