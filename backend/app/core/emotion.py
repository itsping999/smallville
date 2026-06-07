"""Emotional state management."""
from __future__ import annotations
from app.models.agent import AgentState, EmotionalState


def update_emotion(agent: AgentState) -> None:
    """Update emotional state based on needs, activity, and personality."""
    emo = agent.emotion
    needs = agent.needs
    p = agent.personality

    # Baseline from needs
    need_avg = (needs.energy + needs.hunger + needs.hygiene + needs.social + needs.fun) / 5
    target_valence = (need_avg - 50) / 100  # -0.5 to +0.5

    # Activity modifier
    activity_mods = {
        "sleeping": (0.0, 0.0),
        "socializing": (0.15, 0.4),
        "exercising": (0.1, 0.6),
        "working": (-0.05, 0.3),
        "commuting": (-0.1, 0.2),
        "cooking": (0.05, 0.3),
        "eating": (0.1, 0.2),
        "reading": (0.05, 0.15),
        "watching_tv": (0.05, 0.15),
        "shopping": (0.05, 0.35),
        "conversing": (0.1, 0.45),
    }
    v_mod, a_mod = activity_mods.get(agent.current_activity, (0.0, 0.2))

    # Personality modifier: neuroticism pushes negative, agreeableness pushes positive
    p_mod = -p.neuroticism * 0.1 + p.agreeableness * 0.05

    # Smooth transition
    target_valence += v_mod + p_mod
    emo.valence = emo.valence * 0.7 + target_valence * 0.3  # Smooth
    emo.arousal = emo.arousal * 0.7 + a_mod * 0.3

    # Determine dominant emotion
    if emo.valence > 0.3 and emo.arousal > 0.5:
        emo.dominant = "excited"
    elif emo.valence > 0.2:
        emo.dominant = "content" if emo.arousal < 0.5 else "happy"
    elif emo.valence < -0.3 and emo.arousal > 0.5:
        emo.dominant = "angry" if needs.health > 50 else "stressed"
    elif emo.valence < -0.2:
        if needs.energy < 30:
            emo.dominant = "tired"
        elif needs.social < 20:
            emo.dominant = "sad"
        else:
            emo.dominant = "anxious"
    elif emo.arousal < 0.2:
        emo.dominant = "bored"
    else:
        emo.dominant = "neutral"

    # Clamp
    emo.valence = max(-1.0, min(1.0, emo.valence))
    emo.arousal = max(0.0, min(1.0, emo.arousal))
