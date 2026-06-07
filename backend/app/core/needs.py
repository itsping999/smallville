"""Needs system — energy, hunger, hygiene, social, health, fun."""
from __future__ import annotations
from app.models.agent import AgentState, NeedsState


def tick_needs(agent: AgentState, dt_hours: float) -> None:
    """Update agent needs based on elapsed time and current activity."""
    n = agent.needs
    act = agent.current_activity

    # Energy: deplete when awake, restore when sleeping
    if act == "sleeping":
        n.energy = min(100, n.energy + 15 * dt_hours)
    else:
        n.energy = max(0, n.energy - 3 * dt_hours)

    # Hunger: always depletes
    n.hunger = max(0, n.hunger - 4 * dt_hours)

    # Hygiene: depletes, faster during exercise
    hygiene_loss = 2
    if act in ("exercising", "jogging"):
        hygiene_loss = 12
    n.hygiene = max(0, n.hygiene - hygiene_loss * dt_hours)

    # Social: depletes, modulated by extraversion
    social_rate = 1.0 + (agent.personality.extraversion * 0.5)
    if act in ("socializing", "conversing"):
        n.social = min(100, n.social + 8 * dt_hours)
    else:
        n.social = max(0, n.social - social_rate * dt_hours)

    # Fun: depletes during routine, restored by entertainment
    if act in ("working", "commuting", "idle"):
        n.fun = max(0, n.fun - 1.5 * dt_hours)
    elif act in ("watching_tv", "reading", "socializing", "exercising", "gaming"):
        n.fun = min(100, n.fun + 5 * dt_hours)
    else:
        n.fun = max(0, n.fun - 0.5 * dt_hours)

    # Health: slowly affected by lifestyle
    if n.hunger < 15:
        n.health = max(0, n.health - 2 * dt_hours)
    if n.energy < 10:
        n.health = max(0, n.health - 3 * dt_hours)
    if n.hygiene < 20:
        n.health = max(0, n.health - 0.5 * dt_hours)
    # Exercise boosts health
    if act in ("exercising", "jogging"):
        n.health = min(100, n.health + 3 * dt_hours)


def get_needs_priority(needs: NeedsState) -> list[tuple[str, float]]:
    """Return needs sorted by urgency (lowest first = most urgent)."""
    pairs = [
        ("energy", needs.energy),
        ("hunger", needs.hunger),
        ("hygiene", needs.hygiene),
        ("social", needs.social),
        ("health", needs.health),
        ("fun", needs.fun),
    ]
    pairs.sort(key=lambda x: x[1])
    return pairs
