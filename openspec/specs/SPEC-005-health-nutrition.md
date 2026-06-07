# SPEC-005: Health & Nutrition System
**Traces to**: PRD Sections 4.3, 4.8

## Health Model

```python
class HealthState(BaseModel):
    overall: float           # 0-100
    conditions: list[str]    # ["seasonal_allergies", "mild_back_pain"]
    energy_level: float      # Derived from sleep quality + quantity
    last_checkup: SimTime | None
    medication: list[str]    # Active medications
    exercise_weekly: float   # Hours of exercise this week
    nutrition_quality: float # 0-100, rolling average of meal quality
```

## Needs System

```python
class NeedsState(BaseModel):
    energy: float       # 0-100, -3/hr awake, +15/hr sleep
    hunger: float       # 0-100, -4/hr, restored by eating
    hygiene: float      # 0-100, -2/hr, -10/hr exercise, restored by showering
    social: float       # 0-100, -1/hr base (varies by extraversion), restored by interaction
    health: float       # 0-100, context-dependent
    fun: float          # 0-100, -1.5/hr during routine, restored by entertainment

    def tick(self, dt_hours: float, agent):
        self.energy -= 3 * dt_hours if agent.state != "sleeping" else -15 * dt_hours
        self.hunger -= 4 * dt_hours
        self.hygiene -= (2 + (10 if agent.state == "exercising" else 0)) * dt_hours
        self.social -= (1 + (0.5 if agent.personality.extraversion > 0.5 else 0)) * dt_hours
        self.fun -= (1.5 if agent.state in ["working", "commuting"] else 0.5) * dt_hours
        
        # Clamp all to [0, 100]
        for attr in ["energy", "hunger", "hygiene", "social", "health", "fun"]:
            setattr(self, attr, max(0, min(100, getattr(self, attr))))
```

## Effects of Low Needs

| Need | Below 30 | Below 15 | At 0 |
|------|----------|----------|------|
| Energy | Yawning, reduced focus, seek rest | Must sleep, impaired decisions | Forced sleep (collapse) |
| Hunger | Seek food, irritability | Can't focus, stomach growling | Health degradation |
| Hygiene | Self-conscious, avoid social | Others react negatively | Social isolation |
| Social | Loneliness, sadness | Depression symptoms | Mental health decline |
| Health | Reduced activity, pain | Must seek medical | Hospitalization |
| Fun | Boredom, restlessness | Procrastination, distraction | Mood crash |

## Meal System

Agents eat 2-3 times per day based on schedule:
- **Breakfast**: 6:00-9:00 AM (at home or cafe)
- **Lunch**: 11:30 AM-1:30 PM (at work, cafe, or home)
- **Dinner**: 5:30-8:00 PM (usually at home)

Meal quality depends on:
- Location: home-cooked > cafe > fast food (healthwise)
- Skill: agent's cooking ability
- Budget: frugal agents may eat cheaper/less varied
- Time: rushed meals are lower quality

```python
class MealQuality:
    location_type: str      # "home_cooked", "cafe", "restaurant", "fast_food"
    nutrition_score: float   # 0-100
    cost: float             # Financial cost
    enjoyment: float        # Fun factor
```

## Exercise

Agents exercise 0-5 times per week based on personality:
- Health-conscious: 4-5x/week
- Average: 2-3x/week
- Sedentary: 0-1x/week

Exercise types:
- Jog in Elm Park (free, outdoor)
- Gym at Community Center (membership or drop-in fee)
- Yoga at home (free)
- Cycling (free, also transportation)

Exercise effects: +10-20 health, -30 hygiene, +5-10 fun, -20 energy

## Medical System

Medical visits triggered when:
- health < 30 for 24+ hours
- Acute event (injury, illness)
- Annual checkup due (health-conscious agents)

Medical visit flow:
1. Commute to Maplewood Medical Center
2. Check in at reception (wait 10-30 sim-minutes)
3. See doctor (30-60 sim-minutes)
4. Receive treatment/prescription
5. Fill prescription at Corner Pharmacy if needed
6. Recovery period at home

Cost: doctor visit $50-200, medication $10-50 (impacts financial state)
