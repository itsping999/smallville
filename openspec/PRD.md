# Smallville — Product Requirements Document (PRD)

**Version**: 1.0
**Date**: 2026-06-07
**Reference**: *Generative Agents: Interactive Simulacra of Human Behavior* (Stanford, Park et al., UIST 2023)
**Status**: Active

---

## 1. Product Vision

Smallville simulates a small American suburban community where every resident is an AI agent driven by a Large Language Model. Each agent has a unique identity (name, age, occupation, personality, interests, financial disposition, health history), maintains a memory stream, reflects on experiences, makes plans, and executes decisions that chain into realistic multi-step behaviors.

Unlike the original paper's proof-of-concept, Smallville adds:
- Realistic body systems (hunger, fatigue, health, hygiene)
- Financial behaviors (earning, spending, saving, investing, housing)
- Emotional states that influence decision-making
- Transportation (walking, driving, cycling)
- Location-constrained actions (sleep in bed, cook in kitchen)
- Multi-factor decision arbitration with personality-dependent weights

### 1.1 Target Users

| User Type | Description |
|-----------|-------------|
| Observer | Watches the simulation, inspects agent states, explores emergent behaviors |
| Researcher | Analyzes agent interactions, memory propagation, collective action patterns |
| Participant | Joins as a resident, interacts with AI agents, influences community events |

### 1.2 Success Criteria

- 5+ agents sustain autonomous daily routines for 7+ sim-days without manual intervention
- Agents exhibit differentiated behavior based on personality (extrovert vs introvert, frugal vs spendthrift)
- At least one emergent social event occurs (unscheduled gathering, information propagation)
- Agents make location-appropriate decisions (sleep at home, eat at cafe/home, work at workplace)
- Frontend renders a recognizable US suburban community with cartoon aesthetics

---

## 2. World: Smallville Community

### 2.1 Setting

A small American suburban community inspired by neighborhoods in Portland, Oregon / Chapel Hill, NC. Tree-lined streets, detached houses with lawns, a main street with local shops, parks, and community facilities.

### 2.2 Locations

**Residential**
- Oak Lane (residential street): 6 detached houses, each with bedroom, kitchen, living room, bathroom, garage
- Maple Court: duplex/apartment complex for younger residents

**Commercial (Main Street)**
- Sunrise Cafe: coffee shop, breakfast spot, social hub
- Greenleaf Grocery: supermarket
- Birch & Barrel: restaurant/bar
- Pages Bookstore: bookshop with reading nook
- Corner Pharmacy: pharmacy + convenience items

**Community**
- Smallville Elementary School
- Community Center: meeting rooms, gym
- Elm Park: playground, walking trails, pond, gazebo
- Fire Station

**Workplaces**
- Town Hall: government offices
- Riverside Tech: small tech startup office
- Smallville Medical Center: clinic + pharmacy
- Community Library: public library with computers

**Transportation**
- Streets connecting all locations (drivable)
- Sidewalks along all streets
- Elm Park bike path
- Parking lots at commercial locations

### 2.3 Spatial Model [Paper]

Tree-structured hierarchy where each node is a Location:

```
Smallville (root)
├── Oak Lane (residential street)
│   ├── House 1 (Agent A's home)
│   │   ├── Bedroom
│   │   ├── Kitchen
│   │   ├── Living Room
│   │   ├── Bathroom
│   │   └── Garage
│   ├── House 2 ...
│   └── House 3 ...
├── Main Street
│   ├── Sunrise Cafe
│   │   ├── Counter
│   │   ├── Dining Area
│   │   └── Kitchen (staff only)
│   ├── Greenleaf Grocery
│   ├── Birch & Barrel
│   ├── Pages Bookstore
│   └── Corner Pharmacy
├── Community Facilities
│   ├── Smallville Elementary
│   │   ├── Classroom A/B/C
│   │   ├── Playground
│   │   └── Principal's Office
│   ├── Community Center
│   │   ├── Gym
│   │   ├── Meeting Room A/B
│   │   └── Lobby
│   ├── Elm Park
│   │   ├── Playground
│   │   ├── Walking Trail
│   │   ├── Pond
│   │   └── Gazebo
│   └── Fire Station
├── Workplaces
│   ├── Town Hall
│   │   ├── Mayor's Office
│   │   ├── Clerk's Office
│   │   └── Meeting Room
│   ├── Riverside Tech
│   │   ├── Open Office
│   │   ├── Conference Room
│   │   └── Kitchen
│   ├── Smallville Medical Center
│   │   ├── Reception
│   │   ├── Exam Room 1/2
│   │   └── Pharmacy
│   └── Community Library
│       ├── Reading Area
│       ├── Computer Lab
│       └── Children's Section
└── Streets & Parking
    ├── Oak Lane Street
    ├── Main Street
    └── Community Drive
```

### 2.4 Interactive Objects [Paper]

Each location contains objects agents can interact with:

| Object | Location | Actions |
|--------|----------|---------|
| Bed | Bedroom | Sleep, rest, read in bed |
| Stove/Oven | Kitchen | Cook, heat food |
| Refrigerator | Kitchen | Store food, get ingredients |
| Shower | Bathroom | Shower, wash |
| Toilet | Bathroom | Use restroom |
| Couch | Living Room | Watch TV, relax, read |
| Desk + Computer | Home Office / Riverside Tech | Work, browse, research |
| Car | Garage | Drive to destination |
| Bicycle | Garage/Bike Rack | Cycle to destination |
| Coffee Machine | Sunrise Cafe | Brew coffee, order |
| Dining Table | Cafe / Home | Eat meal |
| Bookshelf | Library / Bookstore | Browse, read, borrow |
| Treadmill | Community Center Gym | Exercise |
| Park Bench | Elm Park | Sit, rest, observe |
| Gazebo | Elm Park | Socialize, hold events |
| Cash Register | Shops | Purchase items |
| Medical Equipment | Medical Center | Examination, treatment |
| Whiteboard | School / Office | Teach, present |
| Playground | School / Park | Play (children), supervise |

---

## 3. Agent Design

### 3.1 Agent Identity [Paper + Extended]

Each agent has a rich natural-language identity:

```yaml
name: "Sarah Chen"
age: 34
occupation: "Elementary school teacher"
personality: "Warm, organized, slightly anxious, loves routine"
interests: ["gardening", "cooking", "reading mystery novels", "yoga"]
life_stage: "established adult"
financial_disposition: "moderate saver, cautious investor"
health: "generally healthy, mild seasonal allergies"
social_tendency: "friendly but selective, prefers small groups"
daily_routine: "Wake 6:30, school 7:30-3:30, home activities, bed by 10"
relationships:
  spouse: "David Chen"
  children: ["Lily Chen (age 7)"]
  neighbors: ["friendly with the Hendersons"]
  workplace: ["colleagues with Mr. Park, Mrs. Williams"]
```

### 3.2 Life Stages [Extended]

| Stage | Age Range | Characteristics |
|-------|-----------|----------------|
| Toddler/Child | 2-12 | Needs supervision, school, play, simple decisions |
| Teenager | 13-17 | School, social media, part-time work possible, peer influence |
| Young Adult | 18-25 | College/career start, apartment living, dating, establishing identity |
| Established Adult | 26-45 | Career, home ownership, family, community involvement |
| Middle Age | 46-60 | Career peak, children leaving, financial planning, health awareness |
| Senior | 60+ | Retirement, health focus, community involvement, legacy |

### 3.3 Personality Model [Extended]

Agents use the Big Five personality traits as weights for LLM prompt context:

| Trait | Low (-1.0) | High (+1.0) |
|-------|-----------|-------------|
| Openness | Practical, routine | Curious, creative |
| Conscientiousness | Spontaneous, flexible | Organized, disciplined |
| Extraversion | Reserved, solitary | Outgoing, energetic |
| Agreeableness | Skeptical, competitive | Cooperative, trusting |
| Neuroticism | Calm, resilient | Anxious, reactive |

These traits influence:
- Decision priority weighting (conscientiousness -> work priority)
- Social interaction frequency (extraversion -> seek company)
- Financial behavior (conscientiousness -> saving, openness -> investment risk)
- Stress resilience (neuroticism -> faster mood deterioration)
- Activity choices (openness -> try new restaurants, low openness -> routine)

### 3.4 Cognitive Pipeline [Paper]

```
Perceive Environment
    -> Retrieve Relevant Memories
    -> [If memory importance threshold met: Reflect]
    -> Assess Current State (needs, emotions, schedule)
    -> Generate/Update Plan
    -> Decide Next Action (with priority arbitration)
    -> Execute Action (possibly chaining sub-actions)
    -> Record Memory
```

---

## 4. Systems Design

### 4.1 Memory System [Paper]

**Memory Stream**: Chronological list of all agent experiences.
**Memory Types**: observation, conversation, reflection, plan, emotion.
**Retrieval**: `score = alpha * recency + beta * importance + gamma * relevance`
- recency: `0.99^(hours_since_access)`
- importance: LLM-scored 1-10
- relevance: cosine similarity of embeddings (hash-based fallback)

**Reflection**: When recent memories' importance sum exceeds threshold (150), agent generates high-level insights by asking LLM to synthesize top memories.

### 4.2 Planning System [Paper + Extended]

Three-tier planning:
1. **Daily Plan**: Generated each morning — rough schedule of major activities
2. **Hourly Plan**: Adjusted each hour based on current state
3. **Action Plan**: 5-15 minute granularity, reactive to immediate stimuli

Plan modification triggers:
- Encountering another agent
- Receiving environment event (weather, news)
- Current action blocked
- Needs threshold crossed (hunger, fatigue)
- Important new memory
- Emotional shift

### 4.3 Needs System [Extended]

| Need | Range | Decay Rate | Effects When Low |
|------|-------|------------|-----------------|
| Energy | 0-100 | -3/hr awake, -1/hr sleep | Cognitive decline, forced sleep |
| Hunger | 0-100 | -4/hr | Irritability, seek food priority rises |
| Hygiene | 0-100 | -2/hr, faster with exercise | Social discomfort, self-isolation |
| Social | 0-100 | -1/hr (varies by extraversion) | Loneliness, mood decline |
| Health | 0-100 | Context-dependent | Reduced activity, medical visits |
| Fun | 0-100 | -1.5/hr during work/routine | Boredom, seek entertainment |

Needs drive priority arbitration in the decision system.

### 4.4 Emotion System [Extended]

Agents have a current emotional state that influences all decisions:

```python
class EmotionalState:
    valence: float      # -1.0 (negative) to +1.0 (positive)
    arousal: float      # 0.0 (calm) to 1.0 (excited)
    dominant: str       # "content", "anxious", "excited", "sad", "angry", "neutral"
    stability: float    # 0.0 (volatile) to 1.0 (stable) — personality-dependent
```

Emotion modifiers:
- **Needs satisfaction**: Low energy -> negative valence, low arousal
- **Social interactions**: Positive conversation -> positive valence
- **Achievement**: Completing goals -> positive valence, high arousal
- **Conflict**: Disagreement -> negative valence, high arousal
- **Routine**: Boredom -> low arousal, slight negative valence

The LLM considers emotional state when making decisions. An anxious agent might choose safe options; an excited agent might be more adventurous.

### 4.5 Financial System [Extended]

Agents manage personal finances:

```python
class FinancialState:
    cash: float                    # Liquid money
    savings: float                 # Bank account
    investments: dict              # {"stocks": value, "bonds": value}
    income: float                  # Monthly income (occupation-dependent)
    expenses_history: list         # Record of purchases
    financial_disposition: str     # "frugal", "moderate", "spendthrift", "aggressive_investor"
    housing: str                   # "own", "rent", "family"
```

Financial behaviors:
- Daily expenses (food, transportation, entertainment)
- Monthly expenses (rent/mortgage, utilities, insurance)
- Savings decisions (personality-driven: frugal agents save more)
- Investment decisions (LMM-driven, personality-weighted)
- Major purchases (car, home renovation — triggered by life events)
- Financial stress when cash < threshold -> impacts emotion and decisions

### 4.6 Social System [Extended]

```python
class Relationship:
    agent_id: str
    type: str              # "family", "friend", "colleague", "neighbor", "acquaintance", "romantic"
    closeness: float       # 0.0-1.0
    trust: float           # 0.0-1.0
    recent_interactions: list
    shared_memories: list
```

Social dynamics:
- Relationships evolve through interactions (conversations strengthen bonds)
- Information propagation (gossip): agents share memories during conversations
- Social norms: agents adjust behavior based on relationship type
- Group formation: agents with high mutual closeness tend to coordinate activities
- Conflict: disagreements reduce closeness/trust, may lead to avoidance

### 4.7 Transportation System [Extended]

Agents move between locations using transport modes:

| Mode | Speed | Conditions |
|------|-------|-----------|
| Walking | 5 km/h | Default, always available |
| Driving | 30-60 km/h | Requires car, consumes fuel money |
| Cycling | 15 km/h | Requires bicycle, weather-dependent |
| Bus | 20 km/h | Scheduled, limited routes |

Movement rules:
- Agents must physically travel between locations (takes sim-time)
- Cannot teleport; must follow street network
- Transport choice depends on distance, weather, personality (eco-conscious -> prefer cycling), and urgency
- Traffic/delays possible during rush hours

### 4.8 Health System [Extended]

```python
class HealthState:
    overall: float         # 0-100
    conditions: list       # ["seasonal_allergies", "back_pain"]
    energy_level: float    # Derived from sleep quality
    last_checkup: datetime
    medication: list       # Current medications
```

Health influences:
- Low health -> reduced activity range, may skip work
- Chronic conditions -> periodic medication, adjusted activity limits
- Exercise improves health over time
- Poor nutrition / sleep degrades health
- Medical visits when health drops below threshold

### 4.9 Decision Priority System [Extended]

When multiple needs/desires compete, priority arbitration considers:

```python
def compute_action_priority(agent, need, context):
    base_priority = need.urgency  # How low the need is
    personality_weight = get_personality_weight(agent.personality, need.type)
    emotional_modifier = get_emotion_modifier(agent.emotion, need.type)
    situational_modifier = get_situational(context)  # e.g., at work, can't leave
    time_modifier = get_time_appropriateness(context.sim_time, need.type)
    
    return base_priority * personality_weight * emotional_modifier * situational_modifier * time_modifier
```

Example arbitration:
- Agent is driving home because they're sleepy (priority: 7/10)
- Suddenly realizes they're also very hungry (priority: 6/10)
- Personality: frugal (cooking > eating out weight: 0.8)
- Situation: passing by Greenleaf Grocery
- Decision: Continue driving home (sleep priority wins), but plan to cook dinner at home

---

## 5. Action System

### 5.1 Action Types

| Action | Prerequisites | Duration | Chains Into |
|--------|--------------|----------|------------|
| Sleep | In bedroom, at bed | 6-9 hrs | Wake -> Bathroom -> Kitchen |
| Eat | Has food or at restaurant | 15-45 min | Cleanup / Continue previous activity |
| Cook | In kitchen, has ingredients | 20-60 min | Eat |
| Work | At workplace, during work hours | Varies | Break, Lunch, Commute home |
| Commute | Has transport, destination set | 5-30 min | Arrive at destination |
| Shop | At store | 15-45 min | Commute home |
| Exercise | At gym/park/trail | 30-60 min | Shower -> Rest |
| Socialize | Another agent present | 15-120 min | Continue/End |
| Read | Has book or at library | 20-90 min | Continue/Stop |
| Watch TV | At home, couch | 30-120 min | Continue/Stop |
| Medical Visit | At clinic | 30-90 min | Commute home |
| Browse Phone | Anywhere | 5-30 min | Continue previous |
| Groom | At bathroom | 15-30 min | Next activity |
| Rest | At home / park bench | 15-60 min | Next activity |

### 5.2 Action Chain Examples

**Waking Up** (personality: organized, conscientious)
1. Wake in bed (trigger: alarm at 6:30)
2. Get out of bed -> walk to bathroom
3. Use toilet
4. Brush teeth
5. Shower
6. Walk to kitchen
7. Prepare breakfast
8. Eat breakfast
9. Get dressed
10. Walk to garage
11. Drive to work

**Waking Up** (personality: spontaneous, low conscientiousness)
1. Wake in bed (trigger: natural wake ~8:00)
2. Check phone for 15 min
3. Get out of bed -> bathroom
4. Quick bathroom routine
5. Walk to kitchen
6. Grab quick breakfast (cereal or skip)
7. Drive to work (slightly late)

**Feeling Sleepy While Driving** (urgent need)
1. Recognize fatigue (energy < 20)
2. Priority check: is there something more urgent? (no)
3. Decision: continue driving home (don't stop mid-route)
4. Arrive home
5. Park in garage
6. Enter house
7. Quick bathroom routine
8. Go to bedroom
9. Sleep

**Feeling Sleepy While Driving + Emergency** (conflict)
1. Recognize fatigue, but also received urgent call about child's school
2. Priority: child safety > fatigue
3. Decision: drive to school first
4. Handle situation
5. Then drive home and rest

---

## 6. Frontend Design

### 6.1 Visual Style

Cartoon/illustrated style (NOT pixel art). Inspired by:
- Overcooked (colorful, readable buildings)
- Animal Crossing (warm, inviting community feel)
- 江南百景图 (top-down perspective, detailed environment)

Color palette: warm earth tones with green foliage, blue sky, colorful building accents.
Tile size: 32x32px base, rendered at 2x for retina.
View: isometric or top-down 3/4 view.

### 6.2 Map Layout

Based on a US suburban neighborhood (Portland, OR / Chapel Hill, NC):
- Grid-based street layout with curved residential streets
- Trees, lawns, gardens as environmental decoration
- Buildings are unique (not clustered copies) — each house has different color/shape
- Cars visible on streets, bikes at bike racks
- Day/night cycle affecting lighting

### 6.3 UI Panels

| Panel | Position | Content |
|-------|----------|---------|
| World Map | Center | Phaser-rendered community with moving agents |
| Time Controls | Top bar | Sim clock, speed controls (1x/10x/60x/pause) |
| Agent List | Left sidebar | All agents with status indicators (color-coded mood) |
| Agent Detail | Right panel (on click) | Identity, needs bars, current activity, recent memories, relationships |
| Event Log | Bottom panel | Scrollable log of community events, conversations, decisions |
| Mini-map | Top-right | Overview of full map with agent positions |

### 6.4 Interaction

- Click agent on map or in sidebar -> open detail panel
- Click location -> show location info, agents present
- Hover agent -> tooltip with name, current activity, mood
- Search/filter agents by name, occupation, location
- Event log supports filtering by type (conversation, movement, decision, financial)

---

## 7. Non-Functional Requirements

| ID | Requirement | Target |
|----|------------|--------|
| NFR-1 | Simulation tick latency | < 5s per tick (including LLM calls) |
| NFR-2 | LLM concurrency | Handle 3-5 concurrent LLM calls |
| NFR-3 | Frontend FPS | Stable 30fps on modern browser |
| NFR-4 | Memory usage | < 500MB backend for 8 agents |
| NFR-5 | Persistence | Auto-save every 10 sim-minutes |
| NFR-6 | Error resilience | LLM failures degrade gracefully (use fallback behavior) |

---

## 8. OpenSpec Requirements Map

| Spec ID | Title | Covers |
|---------|-------|--------|
| SPEC-001 | Memory Stream System | Memory storage, retrieval, reflection |
| SPEC-002 | Simulation Engine | Tick loop, time model, agent scheduling |
| SPEC-003 | LLM Integration | API client, prompt templates, error handling |
| SPEC-004 | Social System | Relationships, conversations, gossip |
| SPEC-005 | Health & Nutrition | Health state, eating, exercise, medical |
| SPEC-006 | Financial System | Money management, transactions, housing |
| SPEC-007 | Transportation | Movement, commuting, vehicle management |
