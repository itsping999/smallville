#!/usr/bin/env python3
"""Generate the_ville_expanded map and base simulation preset without touching the_ville."""
from __future__ import annotations

import csv
import json
import os
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC_ASSETS = ROOT / "backend" / "static" / "assets" / "the_ville"
DST_ASSETS = ROOT / "backend" / "static" / "assets" / "the_ville_expanded"

SRC_BASE = ROOT / "data" / "storage" / "base_the_ville_isabella_maria_klaus"
DST_BASE = ROOT / "data" / "storage" / "base_the_ville_expanded"

# 4 New Sectors definitions
NEW_SECTORS = [
    ("32301", "the Ville", "Smallville Community Clinic"),
    ("32302", "the Ville", "Oak Hill Central Library"),
    ("32303", "the Ville", "Pixel Arcade and Lounge"),
    ("32304", "the Ville", "Sunset Lakeside Garden"),
]

NEW_ARENAS = [
    # Clinic
    ("32311", "the Ville", "Smallville Community Clinic", "consultation room"),
    ("32312", "the Ville", "Smallville Community Clinic", "pharmacy and storage"),
    ("32313", "the Ville", "Smallville Community Clinic", "waiting lobby"),
    # Library
    ("32321", "the Ville", "Oak Hill Central Library", "reading hall"),
    ("32322", "the Ville", "Oak Hill Central Library", "archive stacks"),
    ("32323", "the Ville", "Oak Hill Central Library", "digital research lab"),
    # Arcade
    ("32331", "the Ville", "Pixel Arcade and Lounge", "arcade zone"),
    ("32332", "the Ville", "Pixel Arcade and Lounge", "party lounge"),
    ("32333", "the Ville", "Pixel Arcade and Lounge", "snack corner"),
    # Lakeside Garden
    ("32341", "the Ville", "Sunset Lakeside Garden", "lakeside pavilion"),
    ("32342", "the Ville", "Sunset Lakeside Garden", "picnic lawn"),
]

NEW_OBJECTS = [
    # Clinic
    ("32351", "the Ville", "<all>", "doctor desk"),
    ("32352", "the Ville", "<all>", "examination bed"),
    ("32353", "the Ville", "<all>", "pharmacy counter"),
    ("32354", "the Ville", "<all>", "medicine shelf"),
    ("32355", "the Ville", "<all>", "waiting bench"),
    ("32356", "the Ville", "<all>", "water dispenser"),
    # Library
    ("32361", "the Ville", "<all>", "reading table"),
    ("32362", "the Ville", "<all>", "catalog desk"),
    ("32363", "the Ville", "<all>", "archive shelf"),
    ("32364", "the Ville", "<all>", "computer workstation"),
    ("32365", "the Ville", "<all>", "printer station"),
    # Arcade
    ("32371", "the Ville", "<all>", "arcade cabinet"),
    ("32372", "the Ville", "<all>", "pinball machine"),
    ("32373", "the Ville", "<all>", "lounge sofa"),
    ("32374", "the Ville", "<all>", "foosball table"),
    ("32375", "the Ville", "<all>", "vending machine"),
    ("32376", "the Ville", "<all>", "counter stool"),
    # Garden
    ("32381", "the Ville", "<all>", "scenic telescope"),
    ("32382", "the Ville", "<all>", "picnic table"),
    ("32383", "the Ville", "<all>", "barbecue grill"),
    ("32384", "the Ville", "<all>", "park bench"),
]

# Spawning locations for new arenas
NEW_SPAWNS = [
    ("32391", "the Ville", "Smallville Community Clinic", "waiting lobby", "waiting lobby entrance"),
    ("32392", "the Ville", "Oak Hill Central Library", "reading hall", "reading hall entrance"),
    ("32393", "the Ville", "Pixel Arcade and Lounge", "arcade zone", "arcade entrance"),
    ("32394", "the Ville", "Sunset Lakeside Garden", "lakeside pavilion", "pavilion entrance"),
]


def create_asset_directories() -> None:
    (DST_ASSETS / "visuals").mkdir(parents=True, exist_ok=True)
    (DST_ASSETS / "matrix" / "special_blocks").mkdir(parents=True, exist_ok=True)
    (DST_ASSETS / "matrix" / "maze").mkdir(parents=True, exist_ok=True)

    # Symlink or copy map_assets
    src_map_assets = SRC_ASSETS / "visuals" / "map_assets"
    dst_map_assets = DST_ASSETS / "visuals" / "map_assets"
    if not dst_map_assets.exists():
        try:
            os.symlink(src_map_assets, dst_map_assets)
        except OSError:
            shutil.copytree(src_map_assets, dst_map_assets)


def copy_and_extend_csvs() -> None:
    # 1. meta info
    meta = json.loads((SRC_ASSETS / "matrix" / "maze_meta_info.json").read_text())
    meta["maze_name"] = "the_ville_expanded"
    (DST_ASSETS / "matrix" / "maze_meta_info.json").write_text(json.dumps(meta, indent=2))

    # 2. world blocks
    shutil.copy2(
        SRC_ASSETS / "matrix" / "special_blocks" / "world_blocks.csv",
        DST_ASSETS / "matrix" / "special_blocks" / "world_blocks.csv",
    )

    # 3. sector blocks
    lines = (SRC_ASSETS / "matrix" / "special_blocks" / "sector_blocks.csv").read_text().splitlines()
    for row in NEW_SECTORS:
        lines.append(f"{row[0]}, {row[1]}, {row[2]}")
    (DST_ASSETS / "matrix" / "special_blocks" / "sector_blocks.csv").write_text("\n".join(lines) + "\n")

    # 4. arena blocks
    lines = (SRC_ASSETS / "matrix" / "special_blocks" / "arena_blocks.csv").read_text().splitlines()
    for row in NEW_ARENAS:
        lines.append(f"{row[0]}, {row[1]}, {row[2]}, {row[3]}")
    (DST_ASSETS / "matrix" / "special_blocks" / "arena_blocks.csv").write_text("\n".join(lines) + "\n")

    # 5. game object blocks
    lines = (SRC_ASSETS / "matrix" / "special_blocks" / "game_object_blocks.csv").read_text().splitlines()
    for row in NEW_OBJECTS:
        lines.append(f"{row[0]}, {row[1]}, {row[2]}, {row[3]}")
    (DST_ASSETS / "matrix" / "special_blocks" / "game_object_blocks.csv").write_text("\n".join(lines) + "\n")

    # 6. spawning blocks
    lines = (SRC_ASSETS / "matrix" / "special_blocks" / "spawning_location_blocks.csv").read_text().splitlines()
    for row in NEW_SPAWNS:
        lines.append(f"{row[0]}, {row[1]}, {row[2]}, {row[3]}, {row[4]}")
    (DST_ASSETS / "matrix" / "special_blocks" / "spawning_location_blocks.csv").write_text("\n".join(lines) + "\n")


def build_expanded_map_and_matrices() -> None:
    orig_map = json.loads((SRC_ASSETS / "visuals" / "the_ville_jan7.json").read_text())
    w, h = orig_map["width"], orig_map["height"]

    # Read original maze CSVs
    def read_csv(name: str) -> list[int]:
        raw = (SRC_ASSETS / "matrix" / "maze" / name).read_text().strip().split(",")
        return [int(x.strip()) for x in raw if x.strip()]

    collision_maze = read_csv("collision_maze.csv")
    sector_maze = read_csv("sector_maze.csv")
    arena_maze = read_csv("arena_maze.csv")
    game_obj_maze = read_csv("game_object_maze.csv")
    spawn_maze = read_csv("spawning_location_maze.csv")

    layers = orig_map["layers"]
    layer_map = {l["name"]: l["data"] for l in layers}

    floor_data = layer_map["Interior Ground"]
    wall_data = layer_map["Wall"]
    furn1_data = layer_map["Interior Furniture L1"]
    furn2_data = layer_map["Interior Furniture L2 "]
    fore_data = layer_map["Foreground L1"]
    coll_data = layer_map["Collisions"]
    obj_data = layer_map["Object Interaction Blocks"]
    arena_layer_data = layer_map["Arena Blocks"]
    sector_layer_data = layer_map["Sector Blocks"]
    spawn_layer_data = layer_map["Spawning Blocks"]

    COLLISION_ID = 32125
    FLOOR_GID = 490

    def set_cell(x: int, y: int, sector: int = 0, arena: int = 0, obj: int = 0,
                 wall_gid: int = 0, floor_gid: int = 0, furn1_gid: int = 0, furn2_gid: int = 0,
                 spawn: int = 0, collide: bool = False):
        idx = y * w + x
        if sector:
            sector_maze[idx] = sector
            sector_layer_data[idx] = sector
        if arena:
            arena_maze[idx] = arena
            arena_layer_data[idx] = arena
        if obj:
            game_obj_maze[idx] = obj
            obj_data[idx] = obj
        if spawn:
            spawn_maze[idx] = spawn
            spawn_layer_data[idx] = spawn

        if floor_gid:
            floor_data[idx] = floor_gid

        if wall_gid:
            wall_data[idx] = wall_gid
            collision_maze[idx] = COLLISION_ID
            coll_data[idx] = COLLISION_ID
        elif collide:
            collision_maze[idx] = COLLISION_ID
            coll_data[idx] = COLLISION_ID

        if furn1_gid:
            furn1_data[idx] = furn1_gid
        if furn2_gid:
            furn2_data[idx] = furn2_gid

    def build_room_shell(x_start: int, x_end: int, y_start: int, y_end: int, door_x: int, sector: int):
        for x in range(x_start, x_end + 1):
            for y in range(y_start, y_end + 1):
                set_cell(x, y, sector=sector, floor_gid=FLOOR_GID)
                if y == y_start:
                    wall = 5535 if x == x_start else (5538 if x == x_end else 5688)
                    set_cell(x, y, sector=sector, wall_gid=wall)
                elif y == y_end:
                    if x in (door_x, door_x + 1):
                        set_cell(x, y, sector=sector, floor_gid=FLOOR_GID)
                    else:
                        wall = 5613 if x != x_end else 5462
                        set_cell(x, y, sector=sector, wall_gid=wall)
                elif x == x_start:
                    set_cell(x, y, sector=sector, wall_gid=5611)
                elif x == x_end:
                    set_cell(x, y, sector=sector, wall_gid=5614)

    # 1. BUILD CLINIC: (21, 75) to (37, 87), door at (29, 87)
    build_room_shell(21, 37, 75, 87, door_x=29, sector=32301)
    for y in range(76, 83):
        set_cell(29, y, sector=32301, wall_gid=5611 if y != 80 else 0)
    for x in range(22, 29):
        set_cell(x, 82, sector=32301, wall_gid=5613 if x != 25 else 0)

    for x in range(21, 38):
        for y in range(75, 88):
            if x <= 29 and y <= 82:
                arena = 32311
            elif x <= 29 and y > 82:
                arena = 32312
            else:
                arena = 32313
            idx = y * w + x
            arena_maze[idx] = arena
            arena_layer_data[idx] = arena

    # Clinic: Doctor desk & examination bed & pharmacy & waiting lobby
    set_cell(23, 77, sector=32301, arena=32311, obj=32351, furn1_gid=15909, furn2_gid=15910, collide=True)
    set_cell(24, 77, sector=32301, arena=32311, furn1_gid=15925, collide=True)
    set_cell(23, 78, sector=32301, arena=32311, furn1_gid=15986)
    set_cell(26, 77, sector=32301, arena=32311, obj=32352, furn1_gid=18347, collide=True)
    set_cell(27, 77, sector=32301, arena=32311, furn1_gid=18348, collide=True)
    set_cell(26, 78, sector=32301, arena=32311, furn1_gid=18363, collide=True)
    set_cell(27, 78, sector=32301, arena=32311, furn1_gid=18364, collide=True)
    set_cell(24, 85, sector=32301, arena=32312, obj=32353, furn1_gid=18570, collide=True)
    set_cell(25, 85, sector=32301, arena=32312, furn1_gid=18571, collide=True)
    set_cell(24, 83, sector=32301, arena=32312, obj=32354, furn1_gid=15608, collide=True)
    set_cell(25, 83, sector=32301, arena=32312, furn1_gid=15609, collide=True)
    set_cell(26, 83, sector=32301, arena=32312, furn1_gid=15610, collide=True)
    set_cell(33, 80, sector=32301, arena=32313, obj=32355, furn1_gid=15951, collide=True)
    set_cell(34, 80, sector=32301, arena=32313, furn1_gid=15952, collide=True)
    set_cell(33, 83, sector=32301, arena=32313, furn1_gid=15951, collide=True)
    set_cell(34, 83, sector=32301, arena=32313, furn1_gid=15952, collide=True)
    set_cell(35, 77, sector=32301, arena=32313, obj=32356, furn1_gid=16017, collide=True)
    set_cell(29, 86, sector=32301, arena=32313, spawn=32391)

    # 2. BUILD LIBRARY: (107, 6) to (125, 16), door at (115, 16)
    build_room_shell(107, 125, 6, 16, door_x=115, sector=32302)
    for y in range(7, 13):
        set_cell(115, y, sector=32302, wall_gid=5611 if y != 10 else 0)

    for x in range(107, 126):
        for y in range(6, 17):
            if x < 115:
                arena = 32322
            elif y <= 11:
                arena = 32323
            else:
                arena = 32321
            idx = y * w + x
            arena_maze[idx] = arena
            arena_layer_data[idx] = arena

    # Library: Archive Stacks & Digital Lab & Reading Hall
    set_cell(109, 7, sector=32302, arena=32322, obj=32363, furn1_gid=15508, collide=True)
    set_cell(110, 7, sector=32302, arena=32322, furn1_gid=15509, collide=True)
    set_cell(111, 7, sector=32302, arena=32322, furn1_gid=15510, collide=True)
    set_cell(109, 8, sector=32302, arena=32322, furn1_gid=15524, collide=True)
    set_cell(110, 8, sector=32302, arena=32322, furn1_gid=15525, collide=True)
    set_cell(111, 8, sector=32302, arena=32322, furn1_gid=15526, collide=True)
    set_cell(119, 7, sector=32302, arena=32323, obj=32364, furn1_gid=15909, furn2_gid=15910, collide=True)
    set_cell(120, 7, sector=32302, arena=32323, furn1_gid=15925, furn2_gid=15926, collide=True)
    set_cell(123, 7, sector=32302, arena=32323, obj=32365, furn1_gid=16013, collide=True)
    set_cell(119, 13, sector=32302, arena=32321, obj=32361, furn1_gid=19128, collide=True)
    set_cell(120, 13, sector=32302, arena=32321, furn1_gid=19129, collide=True)
    set_cell(119, 14, sector=32302, arena=32321, furn1_gid=19144, collide=True)
    set_cell(120, 14, sector=32302, arena=32321, furn1_gid=19145, collide=True)
    set_cell(118, 13, sector=32302, arena=32321, furn1_gid=14915)
    set_cell(121, 13, sector=32302, arena=32321, furn1_gid=14931)
    set_cell(123, 14, sector=32302, arena=32321, obj=32362, furn1_gid=18570, collide=True)
    set_cell(115, 15, sector=32302, arena=32321, spawn=32392)

    # 3. BUILD ARCADE: (47, 31) to (61, 39), door at (53, 39)
    build_room_shell(47, 61, 31, 39, door_x=53, sector=32303)
    for y in range(32, 36):
        set_cell(55, y, sector=32303, wall_gid=5611)

    for x in range(47, 62):
        for y in range(31, 40):
            if x <= 55:
                arena = 32331
            elif y <= 35:
                arena = 32333
            else:
                arena = 32332
            idx = y * w + x
            arena_maze[idx] = arena
            arena_layer_data[idx] = arena

    # Pool table (3x3)
    pt_rows = [
        [16365, 16366, 16367],
        [16381, 16382, 16383],
        [16397, 16398, 16399],
    ]
    for dy, prow in enumerate(pt_rows):
        for dx, pgid in enumerate(prow):
            is_obj = (dy == 1 and dx == 1)
            set_cell(49 + dx, 33 + dy, sector=32303, arena=32331,
                     obj=32371 if is_obj else 0, furn1_gid=pgid, collide=True)
    # Cue rack
    set_cell(48, 33, sector=32303, arena=32331, obj=32372, furn1_gid=16416, collide=True)
    set_cell(48, 34, sector=32303, arena=32331, furn1_gid=16432, collide=True)
    set_cell(48, 35, sector=32303, arena=32331, furn1_gid=16448, collide=True)
    # Foosball / gaming table
    set_cell(49, 37, sector=32303, arena=32331, obj=32374, furn1_gid=16002, collide=True)
    set_cell(50, 37, sector=32303, arena=32331, furn1_gid=16003, collide=True)
    # Snack corner vending machine & counter stool
    set_cell(57, 32, sector=32303, arena=32333, obj=32375, furn1_gid=16645, collide=True)
    set_cell(58, 32, sector=32303, arena=32333, furn1_gid=16646, collide=True)
    set_cell(57, 33, sector=32303, arena=32333, furn1_gid=16661, collide=True)
    set_cell(58, 33, sector=32303, arena=32333, furn1_gid=16662, collide=True)
    set_cell(59, 35, sector=32303, arena=32333, obj=32376, furn1_gid=18570, collide=True)
    # Lounge sofa (party lounge)
    set_cell(57, 36, sector=32303, arena=32332, obj=32373, furn1_gid=16178, collide=True)
    set_cell(58, 36, sector=32303, arena=32332, furn1_gid=16179, collide=True)
    set_cell(57, 37, sector=32303, arena=32332, furn1_gid=16194, collide=True)
    set_cell(58, 37, sector=32303, arena=32332, furn1_gid=16195, collide=True)
    set_cell(57, 38, sector=32303, arena=32332, furn1_gid=16210, collide=True)
    set_cell(58, 38, sector=32303, arena=32332, furn1_gid=16211, collide=True)
    set_cell(53, 38, sector=32303, arena=32331, spawn=32393)

    # 4. BUILD LAKESIDE GARDEN: (82, 86) to (103, 95)
    for x in range(82, 104):
        for y in range(86, 96):
            if x <= 92:
                arena = 32341
            else:
                arena = 32342
            idx = y * w + x
            sector_maze[idx] = 32304
            sector_layer_data[idx] = 32304
            arena_maze[idx] = arena
            arena_layer_data[idx] = arena

    # Big shade tree (4x5)
    tree_gids = [
        [10413, 10414, 10415, 10416],
        [10429, 10430, 10431, 10432],
        [10445, 10446, 10447, 10448],
        [10461, 10462, 10463, 10464],
        [10477, 10478, 10479, 10480],
    ]
    dec2_data = layer_map["Exterior Decoration L2"]
    for dy, trow in enumerate(tree_gids):
        for dx, tgid in enumerate(trow):
            t_idx = (86 + dy) * w + (84 + dx)
            dec2_data[t_idx] = tgid
            if dy >= 3:
                collision_maze[t_idx] = COLLISION_ID
                coll_data[t_idx] = COLLISION_ID

    # Park benches & scenic telescope
    set_cell(89, 89, sector=32304, arena=32341, obj=32381, furn1_gid=15951, collide=True)
    set_cell(90, 89, sector=32304, arena=32341, obj=32384, furn1_gid=15952, collide=True)
    set_cell(96, 89, sector=32304, arena=32342, obj=32382, furn1_gid=16579, collide=True)
    set_cell(97, 89, sector=32304, arena=32342, furn1_gid=16580, collide=True)
    set_cell(100, 89, sector=32304, arena=32342, obj=32383, furn1_gid=18570, collide=True)
    dec1_data = layer_map["Exterior Decoration L1"]
    for fx, fgid in [(83, 8), (84, 16), (92, 7), (93, 76), (98, 9), (99, 92)]:
        dec1_data[87 * w + fx] = fgid
    set_cell(88, 92, sector=32304, arena=32341, spawn=32394)

    # Write expanded Tiled map
    (DST_ASSETS / "visuals" / "the_ville_expanded.json").write_text(json.dumps(orig_map, indent=2))

    # Write CSV matrices
    def write_csv(name: str, values: list[int]):
        (DST_ASSETS / "matrix" / "maze" / name).write_text(",".join(map(str, values)) + "\n")

    write_csv("collision_maze.csv", collision_maze)
    write_csv("sector_maze.csv", sector_maze)
    write_csv("arena_maze.csv", arena_maze)
    write_csv("game_object_maze.csv", game_obj_maze)
    write_csv("spawning_location_maze.csv", spawn_maze)


def create_base_simulation_preset() -> None:
    if DST_BASE.exists():
        shutil.rmtree(DST_BASE)
    shutil.copytree(SRC_BASE, DST_BASE)

    # Update meta.json
    meta_path = DST_BASE / "reverie" / "meta.json"
    meta = json.loads(meta_path.read_text())
    meta["maze_name"] = "the_ville_expanded"
    meta["fork_sim_code"] = "base_the_ville_expanded"
    meta_path.write_text(json.dumps(meta, indent=2))

    # Add new sectors to each persona's spatial memory
    clinic_knowledge = {
        "Smallville Community Clinic": {
            "consultation room": ["doctor desk", "examination bed"],
            "pharmacy and storage": ["pharmacy counter", "medicine shelf"],
            "waiting lobby": ["waiting bench", "water dispenser"],
        },
        "Oak Hill Central Library": {
            "reading hall": ["reading table", "catalog desk"],
            "archive stacks": ["archive shelf"],
            "digital research lab": ["computer workstation", "printer station"],
        },
        "Pixel Arcade and Lounge": {
            "arcade zone": ["arcade cabinet", "pinball machine", "foosball table"],
            "party lounge": ["lounge sofa"],
            "snack corner": ["vending machine", "counter stool"],
        },
        "Sunset Lakeside Garden": {
            "lakeside pavilion": ["scenic telescope", "park bench"],
            "picnic lawn": ["picnic table", "barbecue grill"],
        },
    }

    for persona_dir in (DST_BASE / "personas").iterdir():
        spatial_path = persona_dir / "bootstrap_memory" / "spatial_memory.json"
        if spatial_path.exists():
            data = json.loads(spatial_path.read_text())
            world_key = "the Ville" if "the Ville" in data else list(data.keys())[0]
            for sec_name, arenas in clinic_knowledge.items():
                data[world_key][sec_name] = arenas
            spatial_path.write_text(json.dumps(data, indent=2))


def main() -> None:
    print("1. Creating asset directories...")
    create_asset_directories()
    print("2. Extending metadata and block CSVs...")
    copy_and_extend_csvs()
    print("3. Building the_ville_expanded.json and maze matrices...")
    build_expanded_map_and_matrices()
    print("4. Creating base_the_ville_expanded simulation preset...")
    create_base_simulation_preset()
    print("SUCCESS: the_ville_expanded generated cleanly without modifying the_ville!")


if __name__ == "__main__":
    main()
