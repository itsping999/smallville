"""Decision priority system — arbitration between competing needs."""
from __future__ import annotations
from app.models.agent import AgentState


# Priority weights per personality trait
PERSONALITY_WEIGHTS = {
    "energy": {"conscientiousness": 0.3, "neuroticism": 0.2},
    "hunger": {"conscientiousness": 0.1},
    "hygiene": {"conscientiousness": 0.4, "agreeableness": 0.1},
    "social": {"extraversion": 0.6, "agreeableness": 0.2},
    "health": {"conscientiousness": 0.3, "neuroticism": 0.3},
    "fun": {"openness": 0.4, "extraversion": 0.3},
}

# Time-of-day modifiers for need priorities
TIME_MODIFIERS = {
    "energy": {  # Sleep pressure peaks late night
        range(0, 6): 1.5,
        range(6, 8): 0.8,
        range(8, 22): 0.3,
        range(22, 24): 1.2,
    },
    "hunger": {  # Meal times
        range(6, 9): 1.3,   # Breakfast
        range(11, 14): 1.3,  # Lunch
        range(17, 20): 1.3,  # Dinner
    },
    "social": {
        range(9, 17): 0.5,   # Work hours, lower social priority
        range(17, 22): 1.2,  # Evening social time
    },
    "fun": {
        range(17, 22): 1.3,  # Evening entertainment
        range(9, 17): 0.5,   # Work hours
    },
}

# Activity context overrides
ACTIVITY_OVERRIDES = {
    "working": {"energy": 0.5, "social": 0.3, "fun": 0.4},
    "sleeping": {"energy": 0.1},  # Don't interrupt sleep
    "commuting": {"energy": 0.7, "hunger": 0.6},
    "socializing": {"social": 0.2},  # Already being social
}


def compute_priority(agent: AgentState, need_name: str, value: float) -> float:
    """Compute weighted priority for a need. Higher = more urgent."""
    # Base urgency: how far below comfort threshold (50)
    urgency = max(0, 50 - value) / 50.0  # 0 to 1

    # Personality modifier
    p_weights = PERSONALITY_WEIGHTS.get(need_name, {})
    p_mod = 1.0
    for trait, weight in p_weights.items():
        trait_val = getattr(agent.personality, trait, 0)
        p_mod += trait_val * weight

    # Time modifier
    t_mod = 1.0
    hour = 12  # Will be set from context
    time_map = TIME_MODIFIERS.get(need_name, {})
    for time_range, mod in time_map.items():
        if hasattr(time_range, '__contains__') and hour in time_range:
            t_mod = mod
            break

    # Activity override
    a_mod = ACTIVITY_OVERRIDES.get(agent.current_activity, {}).get(need_name, 1.0)

    return urgency * p_mod * t_mod * a_mod


def get_top_priorities(agent: AgentState, sim_hour: int, top_n: int = 3) -> list[tuple[str, float]]:
    """Get the top N priority needs for an agent."""
    needs = {
        "energy": agent.needs.energy,
        "hunger": agent.needs.hunger,
        "hygiene": agent.needs.hygiene,
        "social": agent.needs.social,
        "health": agent.needs.health,
        "fun": agent.needs.fun,
    }
    # Temporarily set hour for time modifiers
    priorities = []
    for name, value in needs.items():
        # Inline time calc
        urgency = max(0, 50 - value) / 50.0
        p_weights = PERSONALITY_WEIGHTS.get(name, {})
        p_mod = 1.0 + sum(getattr(agent.personality, t, 0) * w for t, w in p_weights.items())
        t_mod = 1.0
        for tr, m in TIME_MODIFIERS.get(name, {}).range if hasattr(TIME_MODIFIERS.get(name, {}), 'range') else TIME_MODIFIERS.get(name, {}).items():
            if hasattr(tr, '__contains__') and sim_hour in tr:
                t_mod = m
                break
        a_mod = ACTIVITY_OVERRIDES.get(agent.current_activity, {}).get(name, 1.0)
        priority = urgency * p_mod * t_mod * a_mod
        priorities.append((name, priority, value))

    priorities.sort(key=lambda x: x[1], reverse=True)
    return [(name, priority) for name, priority, _ in priorities[:top_n]]


def should_interrupt_current(agent: AgentState, new_need: str, new_value: float,
                              sim_hour: int) -> bool:
    """Decide if a need is urgent enough to interrupt current activity."""
    if agent.current_activity == "sleeping":
        return new_value < 5  # Only interrupt sleep for critical needs
    
    new_priority = compute_priority(agent, new_need, new_value)
    
    # Higher threshold to interrupt ongoing activities
    threshold = 0.6
    if agent.current_activity in ("socializing", "watching_tv", "reading"):
        threshold = 0.4  # Easier to interrupt leisure
    elif agent.current_activity in ("working", "commuting"):
        threshold = 0.8  # Harder to interrupt work
    
    return new_priority > threshold
