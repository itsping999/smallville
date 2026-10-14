"""Tests for optimized path_finder BFS algorithm."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "reverie" / "backend_server"))

from path_finder import path_finder, path_finder_v2  # noqa: E402


def test_path_finder_same_tile():
    maze = [
        ["0", "0", "0"],
        ["0", "0", "0"],
        ["0", "0", "0"],
    ]
    path = path_finder(maze, (1, 1), (1, 1), "1")
    assert path == [(1, 1)]


def test_path_finder_navigates_around_obstacle():
    # Grid 5x5: obstacle at y=2, x=1,2,3
    maze = [["0"] * 5 for _ in range(5)]
    maze[2][1] = "1"
    maze[2][2] = "1"
    maze[2][3] = "1"

    start = (2, 0)
    end = (2, 4)

    path = path_finder(maze, start, end, "1")
    assert len(path) > 1
    assert path[0] == start
    assert path[-1] == end
    # Ensure no step in path hit obstacle
    for x, y in path:
        assert maze[y][x] != "1"


def test_path_finder_unreachable_target_returns_end():
    maze = [["0"] * 3 for _ in range(3)]
    maze[2][2] = "1"  # end is a wall

    start = (0, 0)
    end = (2, 2)

    path = path_finder(maze, start, end, "1")
    assert path == [end]


def test_path_finder_v2_coordinate_contract():
    maze = [
        [0, 0, 0],
        [0, 1, 0],
        [0, 0, 0],
    ]
    start = (0, 0)
    end = (2, 2)
    path = path_finder_v2(maze, start, end, 1)
    assert path[0] == start
    assert path[-1] == end
    for r, c in path:
        assert maze[r][c] != 1
