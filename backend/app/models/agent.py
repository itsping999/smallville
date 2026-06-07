"""Agent models — identity, needs, emotion, financial state, health."""
from __future__ import annotations
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class Personality(BaseModel):
    openness: float = 0.5
    conscientiousness: float = 0.5
    extraversion: float = 0.5
    agreeableness: float = 0.5
    neuroticism: float = 0.5

    def description(self) -> str:
        traits = []
        if self.openness > 0.3:
            traits.append("curious and creative")
        elif self.openness < -0.3:
            traits.append("practical and routine-oriented")
        if self.conscientiousness > 0.3:
            traits.append("organized and disciplined")
        elif self.conscientiousness < -0.3:
            traits.append("spontaneous and flexible")
        if self.extraversion > 0.3:
            traits.append("outgoing and social")
        elif self.extraversion < -0.3:
            traits.append("reserved and introspective")
        if self.agreeableness > 0.3:
            traits.append("warm and cooperative")
        elif self.agreeableness < -0.3:
            traits.append("direct and skeptical")
        if self.neuroticism > 0.3:
            traits.append("somewhat anxious")
        elif self.neuroticism < -0.3:
            traits.append("calm and resilient")
        return ", ".join(traits) if traits else "balanced personality"


class NeedsState(BaseModel):
    energy: float = 80.0
    hunger: float = 70.0
    hygiene: float = 85.0
    social: float = 60.0
    health: float = 90.0
    fun: float = 50.0

    def summary(self) -> str:
        def level(v):
            if v < 20: return "critical"
            if v < 40: return "low"
            if v < 60: return "moderate"
            if v < 80: return "good"
            return "excellent"
        return (
            f"Energy: {level(self.energy)} ({self.energy:.0f}/100), "
            f"Hunger: {level(self.hunger)} ({self.hunger:.0f}/100), "
            f"Hygiene: {level(self.hygiene)} ({self.hygiene:.0f}/100), "
            f"Social: {level(self.social)} ({self.social:.0f}/100), "
            f"Health: {level(self.health)} ({self.health:.0f}/100), "
            f"Fun: {level(self.fun)} ({self.fun:.0f}/100)"
        )

    def most_urgent(self) -> tuple[str, float]:
        needs = {
            "energy": self.energy, "hunger": self.hunger,
            "hygiene": self.hygiene, "social": self.social,
            "health": self.health, "fun": self.fun,
        }
        name = min(needs, key=needs.get)
        return name, needs[name]


class EmotionalState(BaseModel):
    valence: float = 0.0
    arousal: float = 0.3
    dominant: str = "neutral"

    def emoji(self) -> str:
        m = {"content": "\U0001f60a", "anxious": "\U0001f615", "excited": "\U0001f929",
             "sad": "\U0001f622", "angry": "\U0001f620", "bored": "\U0001f610",
             "neutral": "\U0001f610", "happy": "\U0001f60a", "tired": "\U0001f634",
             "stressed": "\U0001f613"}
        return m.get(self.dominant, "\U0001f610")

    def color(self) -> str:
        if self.valence > 0.2: return "green"
        if self.valence < -0.2: return "red"
        return "yellow"


class FinancialState(BaseModel):
    cash: float = 200.0
    checking: float = 3000.0
    savings: float = 5000.0
    monthly_income: float = 4000.0
    disposition: str = "moderate"
    investment_style: str = "balanced"
    last_payday: Optional[datetime] = None


class HealthState(BaseModel):
    overall: float = 90.0
    conditions: list[str] = Field(default_factory=list)
    medication: list[str] = Field(default_factory=list)
    last_checkup: Optional[datetime] = None


class ScheduleEntry(BaseModel):
    time: str           # "07:00"
    activity: str       # "commute to work"
    location: str       # "riverside_tech"
    duration_min: int = 60


class DailySchedule(BaseModel):
    entries: list[ScheduleEntry] = Field(default_factory=list)


class AgentState(BaseModel):
    id: str
    name: str
    age: int
    occupation: str
    life_stage: str = "established adult"
    personality: Personality = Field(default_factory=Personality)
    interests: list[str] = Field(default_factory=list)
    bio: str = ""

    location_id: str = "home"
    current_activity: str = "idle"
    current_plan: list[str] = Field(default_factory=list)
    action_chain: list[str] = Field(default_factory=list)

    needs: NeedsState = Field(default_factory=NeedsState)
    emotion: EmotionalState = Field(default_factory=EmotionalState)
    financial: FinancialState = Field(default_factory=FinancialState)
    health: HealthState = Field(default_factory=HealthState)

    daily_plan: str = ""
    last_planning_date: Optional[int] = None

    is_moving: bool = False
    move_destination: Optional[str] = None
    move_progress: float = 0.0
    move_eta: Optional[datetime] = None

    has_car: bool = True
    has_bicycle: bool = False
    vehicle_id: Optional[str] = None
    home_location_id: str = ""
    workplace_id: str = ""

    last_reflection_time: Optional[datetime] = None
    memory_importance_sum: float = 0.0
