# Frontend Design

## Visual Style

Cartoon/illustrated aesthetic. NOT pixel art. Warm, colorful, readable at small scale.

### Inspiration
- **Overcooked**: Colorful buildings, top-down perspective, clear silhouettes
- **Animal Crossing**: Warm community feel, seasonal decorations, character expressiveness
- **Stardew Valley**: Cozy suburban atmosphere, detailed but readable environments
- **江南百景图**: Rich environmental detail, bird's-eye perspective with depth

### Color Palette

| Element | Colors |
|---------|--------|
| Grass/Lawns | #4CAF50 (green), #66BB6A (light) |
| Roads | #78909C (gray), #B0BEC5 (sidewalk) |
| Sky | #87CEEB (day), #2C3E50 (night) |
| Buildings | Varied: #FFAB91 (terracotta), #81D4FA (blue), #FFF59D (yellow), #A5D6A7 (sage) |
| Trees | #2E7D32 (dark), #4CAF50 (medium), #81C784 (light) |
| Roofs | #5D4037 (brown), #D32F2F (red), #455A64 (slate) |
| UI Panel | #FAFAFA (bg), #37474F (text), #2196F3 (accent) |
| Agent markers | #FF5722 (adult), #FF9800 (senior), #2196F3 (young) |

### Typography
- UI Text: system font stack (San Francisco, Segoe UI, Roboto)
- Agent Names: 12px bold
- Event Log: 13px regular
- Panel Headers: 16px semibold

## Rendering

### Phaser 3 Scene Structure

```
MapScene (main game scene)
├── TilemapLayer (ground, roads, water)
├── BuildingGroup (all buildings as sprites)
├── DecorationGroup (trees, benches, lampposts)
├── AgentGroup (agent sprites with name labels)
├── VehicleGroup (cars, bikes on roads)
├── WeatherOverlay (rain particles, snow, etc.)
├── DayNightOverlay (tinted overlay for time of day)
└── UIOverlay (HTML-based, not Phaser)
    ├── TopBar (time, speed controls, weather)
    ├── LeftSidebar (agent list)
    ├── RightPanel (agent detail, on click)
    ├── BottomPanel (event log)
    └── MiniMap (top-right corner)
```

### Asset Requirements

#### Buildings (unique per structure)
Each building is a distinct sprite, not a tiled copy:
- `sunrise_cafe.png` — Warm-toned cafe with outdoor seating
- `greenleaf_grocery.png` — Supermarket with shopping cart area
- `birch_barrel.png` — Restaurant with wooden facade
- `pages_bookstore.png` — Cozy bookshop with window display
- `corner_pharmacy.png` — Green cross sign, pharmacy look
- `house_1.png` through `house_6.png` — Each unique house
- `apartment_complex.png` — Maple Court apartments
- `school.png` — Elementary school with playground
- `community_center.png` — Modern community building
- `fire_station.png` — Red fire station
- `town_hall.png` — Government building with flag
- `riverside_tech.png` — Modern office building
- `medical_center.png` — Medical building with parking
- `library.png` — Public library with columns

#### Environment
- `tree_oak.png`, `tree_pine.png`, `tree_maple.png` — Various trees
- `bench.png`, `fountain.png`, `playground_set.png`
- `car_sedan.png`, `car_suv.png`, `bicycle.png`
- `road_tile.png`, `sidewalk_tile.png`, `grass_tile.png`
- `pond.png`, `gazebo.png`

#### Agent Sprites
- 8-direction walk cycle (4 frames each) per agent
- Idle, walking, driving, sitting, sleeping states
- Simple cartoon style: ~32x48px per frame
- Color-coded by mood: halo/aura changes color

### Camera & Controls
- WASD or arrow keys to pan camera
- Mouse wheel to zoom (0.5x - 2x)
- Click on agent -> focus camera + open detail panel
- Click on location -> show info popup
- Drag to pan (touch and mouse)

## UI Panels (HTML Overlay)

### Top Bar
```
[Sim Clock: Mon Jun 8, 8:30 AM] [Weather: Sunny 72F] 
[Speed: |< Pause] [> 1x] [>> 10x] [>>> 60x] [>>>> 120x]
[Active Agents: 6/8] [Day 2]
```

### Left Sidebar — Agent List
```
+--------------------------+
| Agents                    |
| [Search: ____________]    |
|                           |
| 🟢 Sarah Chen    School   |
|    Teacher · Happy        |
|                           |
| 🟡 Marcus W.     Bookstore|
|    Owner · Neutral        |
|                           |
| 🔴 James H.      Home     |
|    Retired · Tired        |
|                           |
| 🟢 Aisha P.      Gym      |
|    Nurse · Energetic      |
| ...                       |
+--------------------------+
```

Color dots represent mood: green=happy/neutral, yellow=tired/bored, red=stressed/sad.

### Right Panel — Agent Detail (on click)
```
+----------------------------------+
| Sarah Chen, 34                   |
| Elementary School Teacher         |
|                                  |
| [Avatar]  Personality: Warm,     |
|           organized, loves routine|
|                                  |
| ── Needs ──                      |
| Energy    [████████░░] 78       |
| Hunger    [██████░░░░] 55       |
| Hygiene   [█████████░] 90       |
| Social    [███████░░░] 70       |
| Health    [█████████░] 95       |
| Fun       [█████░░░░░] 45       |
|                                  |
| ── Emotion ──                    |
| Mood: Content 😊                 |
| Valence: +0.4  Arousal: 0.3     |
|                                  |
| ── Current Activity ──           |
| Teaching math class              |
| Location: School - Classroom A   |
| Started: 8:15 AM                 |
|                                  |
| ── Financial ──                  |
| Cash: $245  Savings: $12,400    |
| Monthly Income: $4,200           |
|                                  |
| ── Recent Memories ──            |
| 8:00 - Drove Lily to school     |
| 7:30 - Had breakfast with David  |
| 6:30 - Woke up, morning routine  |
| Yesterday - Had coffee with Rosa |
|                                  |
| ── Relationships ──              |
| David Chen (Spouse) ♥ 0.95      |
| Lily Chen (Daughter) ♥ 0.98    |
| Rosa Moreno (Friend) 0.72       |
| Marcus Williams (Neighbor) 0.55 |
+----------------------------------+
```

### Bottom Panel — Event Log
```
+------------------------------------------------------------------+
| Community Events                              [Filter: All ▼]     |
|                                                                  |
| 8:28 AM  💬 Sarah and Mr. Park discussed the spring recital     |
| 8:25 AM  🚗 Marcus drove to Pages Bookstore                     |
| 8:20 AM  🍳 Tom Moreno cooked breakfast at home                 |
| 8:15 AM  📚 Kai arrived at Riverside Tech                       |
| 8:10 AM  🏃 Aisha jogged through Elm Park                       |
| 8:05 AM  ☕ James Henderson ordered coffee at Sunrise Cafe       |
| 8:00 AM  💰 Aisha deposited $500 into savings                   |
| 7:55 AM  🚗 David Chen drove to work (Town Hall)                |
+------------------------------------------------------------------+
```

## Responsive Behavior
- Minimum viewport: 1280x720
- Left sidebar: 240px fixed
- Right panel: 320px, slides in on click
- Bottom panel: 200px, collapsible
- Map fills remaining space
- On narrow screens: sidebar collapses to icons, panel becomes modal
