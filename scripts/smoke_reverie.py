#!/usr/bin/env python3
"""Smoke-test the Reverie backend without entering the interactive CLI."""
from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "reverie" / "backend_server"
sys.path.insert(0, str(BACKEND))

from reverie import ReverieServer  # noqa: E402
from utils import fs_storage, fs_temp_storage  # noqa: E402


def assert_custom_llm_config() -> None:
    """Verify that gpt_structure reads custom provider settings."""
    os.environ["LLM_DISABLE_EMBEDDINGS"] = "1"
    from persona.prompt_template import gpt_structure  # noqa: E402

    banned = ("gpt-3.5-turbo", "text-davinci-")
    configured_models = (
        gpt_structure.CHAT_MODEL,
        gpt_structure.COMPLETION_MODEL,
        gpt_structure.EMBEDDING_MODEL,
    )
    assert not any(
        model and banned_model in model
        for model in configured_models
        for banned_model in banned
    ), f"Hardcoded OpenAI model detected: {configured_models}"
    embedding = gpt_structure.get_embedding("smallville smoke")
    assert len(embedding) == 1536
    assert embedding == gpt_structure.get_embedding("smallville smoke")
    print("custom llm config ok")


def main() -> None:
    os.chdir(BACKEND)
    assert_custom_llm_config()

    sim_code = "codex_smoke_test"
    target = Path(BACKEND / fs_storage).resolve() / sim_code
    temp_files = [
        Path(BACKEND / fs_temp_storage).resolve() / "curr_sim_code.json",
        Path(BACKEND / fs_temp_storage).resolve() / "curr_step.json",
    ]
    temp_snapshot = {
        path: path.read_text() if path.exists() else None
        for path in temp_files
    }

    try:
        if target.exists():
            shutil.rmtree(target)
        server = ReverieServer("base_the_ville_isabella_maria_klaus", sim_code)
        print(f"initialized {len(server.personas)} personas at step {server.step}")
        print(f"maze {server.maze.maze_name}: "
              f"{len(server.maze.tiles[0])}x{len(server.maze.tiles)}")
    finally:
        if target.exists():
            shutil.rmtree(target)
        for path, content in temp_snapshot.items():
            if content is None:
                if path.exists():
                    path.unlink()
            else:
                path.write_text(content)

    print("smoke ok")


if __name__ == "__main__":
    main()
