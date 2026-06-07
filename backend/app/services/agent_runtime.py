"""Agent runtime — the cognitive cycle for each agent per tick."""
from __future__ import annotations
import logging
import random
from datetime import datetime
from typing import Optional

from app.models.agent import AgentState
from app.models.memory import MemoryEntry
from app.core.memory_stream import MemoryStore
from app.core.llm_gateway import LLMGateway
from app.core.needs import tick_needs, get_needs_priority
from app.core.emotion import update_emotion
from app.services.environment import EnvironmentManager
from app.services.social_service import SocialService
from app.services.transport import TransportService
from app.config import REFLECTION_THRESHOLD

logger = logging.getLogger("smallville.runtime")

# Event chains: complex actions decomposed into sub-actions
EVENT_CHAINS = {
    "go_to_sleep": ["commute_home", "enter_house", "use_bathroom", "go_to_bedroom", "sleep"],
    "prepare_meal": ["go_to_kitchen", "cook", "eat", "clean_up"],
    "morning_routine": ["wake_up", "use_bathroom", "get_dressed", "make_breakfast", "eat_breakfast"],
    "go_to_work": ["commute_to_work", "arrive_at_work", "start_working"],
    "exercise_routine": ["go_to_gym", "exercise", "shower", "change_clothes"],
    "go_shopping": ["commute_to_store", "browse_store", "purchase_items", "commute_home"],
    "medical_visit": ["commute_to_clinic", "check_in", "see_doctor", "commute_home"],
    "social_outing": ["commute_to_location", "socialize", "commute_home"],
    "evening_routine": ["commute_home", "prepare_meal", "relax", "use_bathroom", "go_to_bedroom", "sleep"],
}


class AgentRuntime:
    def __init__(self, memory_store: MemoryStore, llm: LLMGateway,
                 environment: EnvironmentManager, social: SocialService,
                 transport: TransportService):
        self.memory_store = memory_store
        self.llm = llm
        self.environment = environment
        self.social = social
        self.transport = transport
        self.processed_this_tick: list[str] = []

    async def process_agent(self, agent: AgentState, sim_time: datetime,
                              all_agents: list[AgentState]) -> dict:
        """Main cognitive cycle for one agent."""
        import logging
        _log = logging.getLogger("smallville.runtime")
        result = {
            "agent_id": agent.id,
            "agent_name": agent.name,
            "actions": [],
            "conversations": [],
            "movements": [],
        }
        try:
            # 1. Handle ongoing movement
            if agent.is_moving:
                arrived = self.transport.update_movement(agent, dt_minutes=1.0)
                if arrived:
                    result["movements"].append(f"{agent.name} arrived at {agent.location_id}")
                    self.memory_store.get(agent.id).add(
                        f"Arrived at {agent.location_id}", "observation", 2.0, sim_time=sim_time
                    )
                    # After arrival, decide what to do
                    agent.current_activity = "idle"
                return result

            # 2. Check if we should wake up (time-based)
            hour = sim_time.hour
            if agent.current_activity == "sleeping":
                should_wake = self._should_wake(agent, hour)
                _log.info(f"WAKE_CHECK: {agent.name} hour={hour} should_wake={should_wake} energy={agent.needs.energy:.0f}")
                if should_wake:
                    await self._do_morning_routine(agent, sim_time, all_agents)
                    result["actions"].append(f"{agent.name} woke up and started morning routine")
                return result

            # 3. Tick needs
            tick_needs(agent, dt_hours=1.0 / 60)  # 1 sim-minute
            update_emotion(agent)

            # 4. Check if we should go to sleep
            if agent.needs.energy < 10 and hour >= 20:
                await self._do_sleep(agent, sim_time)
                result["actions"].append(f"{agent.name} went to sleep (exhausted)")
                return result
            if agent.needs.energy < 20 and hour >= 22:
                await self._do_sleep(agent, sim_time)
                result["actions"].append(f"{agent.name} went to sleep")
                return result

            # 5. Check for conversation opportunity
            others_at_location = [a for a in all_agents
                                   if a.location_id == agent.location_id and a.id != agent.id]
            if others_at_location and random.random() < 0.15:  # Check each tick
                other = random.choice(others_at_location)
                if self.social.should_converse(agent, other):
                    conv = await self.social.generate_conversation(
                        agent, other,
                        self.environment.get_location(agent.location_id).name,
                        sim_time.strftime("%A %I:%M %p"),
                    )
                    if conv and conv.turns:
                        result["conversations"].append({
                            "with": other.name,
                            "turns": len(conv.turns),
                            "summary": conv.turns[0].content[:60],
                        })

            # 6. Decide next action (LLM-driven or schedule-based)
            action = await self._decide_action(agent, sim_time, all_agents)
            if action:
                result["actions"].append(f"{agent.name}: {action}")

            # 7. Check reflection
            await self._check_reflection(agent, sim_time)

        except Exception as e:
            logger.error(f"Error processing {agent.name}: {e}")
            result["actions"].append(f"{agent.name}: error - {str(e)[:50]}")

        return result

    def _should_wake(self, agent: AgentState, hour: int) -> bool:
        """Determine if agent should wake up."""
        # Everyone wakes by 9 AM at latest (even night owls)
        if hour >= 9:
            return True
        # High energy + past 5 AM -> wake
        if agent.needs.energy > 70 and hour >= 5:
            return True
        # Workers with fixed schedules
        if "Retired" not in agent.occupation and agent.workplace_id:
            if hour >= 7:  # All workers up by 7
                return True
        # Conscientious agents wake early
        if agent.personality.conscientiousness > 0.3:
            return hour >= 6
        # Cafe owners get up early (they open at 6!)
        if "cafe" in agent.occupation.lower() or "cafe" in (agent.workplace_id or "").lower():
            return hour >= 5
        # Default
        return hour >= 7

    async def _do_morning_routine(self, agent: AgentState, sim_time: datetime,
                                    all_agents: list[AgentState]) -> None:
        agent.current_activity = "morning_routine"
        agent.needs.hygiene = min(100, agent.needs.hygiene + 30)  # Shower
        agent.needs.hunger = min(100, agent.needs.hunger + 25)  # Breakfast
        agent.needs.energy = min(100, agent.needs.energy + 5)  # Woke up

        self.memory_store.get(agent.id).add(
            f"Completed morning routine at {agent.home_location_id}",
            "observation", 2.0, sim_time=sim_time,
        )

        # Plan the day
        await self._plan_day(agent, sim_time)

        # Decide: go to work or stay home
        is_weekday = sim_time.weekday() < 5
        if is_weekday and agent.workplace_id and "Retired" not in agent.occupation:
            mode = self.transport.choose_transport(agent,
                self.transport.get_distance(agent.location_id, agent.workplace_id))
            self.transport.start_movement(agent, agent.workplace_id, mode, sim_time.hour)
            agent.current_activity = f"commuting_{mode}"
        else:
            agent.current_activity = "relaxing"

    async def _do_sleep(self, agent: AgentState, sim_time: datetime) -> None:
        # If not at home, commute home first
        if agent.location_id != agent.home_location_id:
            mode = self.transport.choose_transport(agent,
                self.transport.get_distance(agent.location_id, agent.home_location_id),
                urgency="high")
            self.transport.start_movement(agent, agent.home_location_id, mode, sim_time.hour)
            # Movement will complete on next tick, then sleep
            return
        
        agent.current_activity = "sleeping"
        self.memory_store.get(agent.id).add(
            "Went to sleep", "observation", 1.0, sim_time=sim_time,
        )

    async def _decide_action(self, agent: AgentState, sim_time: datetime,
                               all_agents: list[AgentState]) -> Optional[str]:
        """Use LLM to decide the agent's next action."""
        perception = self.environment.build_perception(agent, all_agents, sim_time)
        memories = self.memory_store.get(agent.id).retrieve(
            f"{agent.current_activity} at {perception.get('location_name', 'unknown')}", k=5
        )
        mem_text = "\n".join(f"- {m.content}" for m in memories) or "No recent memories."

        needs_summary = agent.needs.summary()
        hour = sim_time.hour

        # Time-based action hints
        time_hint = ""
        if 11 <= hour <= 13 and agent.needs.hunger < 60:
            time_hint = "It's around lunchtime."
        elif 17 <= hour <= 19 and agent.needs.hunger < 50:
            time_hint = "It's dinnertime."
        elif 12 <= hour <= 14 and sim_time.weekday() < 5:
            time_hint = "You're in the middle of your workday."

        people = perception.get("people_here", [])
        people_str = ", ".join(f"{p['name']} ({p['activity']}, {p['mood']})" for p in people) if people else "Nobody else here."
        objects = perception.get("objects_here", [])
        objects_str = ", ".join(f"{o['name']} ({', '.join(o['actions'])})" for o in objects) if objects else "Nothing to interact with."

        user_prompt = f"""You are {agent.name} ({agent.age}, {agent.occupation}). {agent.personality.description()}.

Location: {perception.get('location_name', 'unknown')} — {perception.get('location_description', '')}
Time: {perception.get('time', '')}, {perception.get('weather', '')}
Current activity: {agent.current_activity}
{time_hint}

Needs: {needs_summary}
Mood: {agent.emotion.dominant} (valence: {agent.emotion.valence:.2f})

People nearby: {people_str}
Objects: {objects_str}

Recent memories:
{mem_text}

What do you do next? Reply with ONE action and a brief reason. Format: ACTION:reason
Actions: move_to:<location>, use:<object>, converse:<person>, eat, work, exercise, relax, shop, read, sleep, idle"""

        result = await self.llm.decide_action(
            system="You are a decision engine for a character in a life simulation. Stay in character. Choose actions based on needs, personality, and context. Be realistic.",
            user=user_prompt,
        )

        if not result:
            return self._fallback_action(agent, hour)

        # Parse and execute
        action_text = result.strip()
        return await self._execute_action(agent, action_text, sim_time, all_agents)

    async def _execute_action(self, agent: AgentState, action_text: str,
                                sim_time: datetime, all_agents: list[AgentState]) -> str:
        """Parse and execute the LLM's chosen action."""
        hour = sim_time.hour
        # Clean up LLM output — extract just the action keyword
        raw = action_text.strip()
        cleaned = raw

        # Strip "ACTION:" prefix (case-insensitive)
        upper = cleaned.upper()
        if "ACTION:" in upper:
            idx = upper.index("ACTION:")
            cleaned = cleaned[idx + 7:].strip()

        # Strip leading "reason:" or "reason -" style
        for prefix in ["reason:", "reason -", "reason: "]:
            if cleaned.lower().startswith(prefix):
                cleaned = cleaned[len(prefix):].strip()

        # Take only the action:target part, discard everything after " - " or "Reason:" or first sentence
        for sep in [" - ", " -- ", " because ", " Reason:", " reason:", ". ", "\n"]:
            pos = cleaned.find(sep)
            if pos > 0:
                cleaned = cleaned[:pos].strip()
                break

        # If still verbose (>50 chars), try to extract just the use:/move_to:/converse: part
        if len(cleaned) > 50:
            import re
            m = re.search(r"(use|move_to|converse|eat|work|exercise|read|relax|shop|sleep|browse|chat|cook)[:\s_]([^:,;.(]{2,25})", cleaned, re.IGNORECASE)
            if m:
                cleaned = f"{m.group(1)}:{m.group(2).strip()}"

        # Final cap
        if len(cleaned) > 45:
            cleaned = cleaned[:42].rsplit(" ", 1)[0] + "..."

        action_lower = cleaned.lower()

        # Move to location
        if "move_to:" in action_lower:
            target = action_lower.split("move_to:")[1].split(",")[0].split("(")[0].strip()
            location = self._find_location_id(target)
            if location and location != agent.location_id:
                mode = self.transport.choose_transport(agent,
                    self.transport.get_distance(agent.location_id, location))
                self.transport.start_movement(agent, location, mode, sim_time.hour)
                return f"Moving to {location} ({mode})"

        if "sleep" in action_lower and agent.needs.energy < 40:
            await self._do_sleep(agent, sim_time)
            return "Going to sleep"

        if "eat" in action_lower:
            if agent.location_id == agent.home_location_id:
                agent.needs.hunger = min(100, agent.needs.hunger + 30)
                agent.current_activity = "eating"
                return "Eating at home"
            elif agent.location_id in ("sunrise_cafe", "birch_barrel"):
                agent.needs.hunger = min(100, agent.needs.hunger + 35)
                agent.needs.fun = min(100, agent.needs.fun + 5)
                agent.current_activity = "eating"
                cost = random.uniform(8, 25)
                agent.financial.cash = max(0, agent.financial.cash - cost)
                return f"Eating out (${cost:.0f})"
            else:
                # Try to go to a food place
                target = "sunrise_cafe" if hour < 14 else "birch_barrel"
                mode = self.transport.choose_transport(agent,
                    self.transport.get_distance(agent.location_id, target))
                self.transport.start_movement(agent, target, mode, sim_time.hour)
                return f"Going to eat at {target}"

        if "exercise" in action_lower or "workout" in action_lower:
            if agent.location_id in ("community_center", "elm_park"):
                agent.current_activity = "exercising"
                agent.needs.fun = min(100, agent.needs.fun + 15)
                return "Exercising"
            else:
                target = "elm_park" if agent.has_bicycle or agent.personality.openness > 0.3 else "community_center"
                mode = self.transport.choose_transport(agent,
                    self.transport.get_distance(agent.location_id, target))
                self.transport.start_movement(agent, target, mode, sim_time.hour)
                return f"Going to exercise at {target}"

        if "work" in action_lower and agent.workplace_id:
            if agent.location_id == agent.workplace_id:
                agent.current_activity = "working"
                agent.needs.fun = max(0, agent.needs.fun - 3)
                place = agent.workplace_id.replace("_", " ").title()
                return f"Working at {place}"
            elif sim_time.weekday() < 5 and 8 <= sim_time.hour <= 17:
                mode = self.transport.choose_transport(agent,
                    self.transport.get_distance(agent.location_id, agent.workplace_id))
                self.transport.start_movement(agent, agent.workplace_id, mode, sim_time.hour)
                return f"Commuting to work ({mode})"

        if "read" in action_lower:
            agent.current_activity = "reading"
            agent.needs.fun = min(100, agent.needs.fun + 8)
            return "Reading"

        if "relax" in action_lower or "rest" in action_lower:
            agent.current_activity = "relaxing"
            agent.needs.fun = min(100, agent.needs.fun + 3)
            return "Relaxing"

        if "shop" in action_lower:
            target = "greenleaf_grocery"
            if agent.location_id == target:
                agent.current_activity = "shopping"
                agent.needs.fun = min(100, agent.needs.fun + 5)
                return "Shopping for groceries"
            else:
                mode = self.transport.choose_transport(agent,
                    self.transport.get_distance(agent.location_id, target))
                self.transport.start_movement(agent, target, mode, sim_time.hour)
                return f"Going shopping at {target}"

        # Default — set activity and return cleaned text
        agent.current_activity = "idle"
        return cleaned if cleaned else "Idle"

    def _find_location_id(self, hint: str) -> Optional[str]:
        """Map a location hint to a known location ID."""
        hint = hint.lower().strip()
        mapping = {
            "home": None,  # Will be set per-agent
            "work": None,
            "neighborhood": "elm_park",
            "woodshed": "house_3",  # James's backyard
            "backyard": "house_3",
            "office": "riverside_tech",
            "tech": "riverside_tech",
            "cafe": "sunrise_cafe",
            "coffee": "sunrise_cafe",
            "store": "greenleaf_grocery",
            "grocery": "greenleaf_grocery",
            "park": "elm_park",
            "gym": "community_center",
            "library": "library",
            "bookstore": "pages_bookstore",
            "pharmacy": "corner_pharmacy",
            "school": "school",
            "medical": "medical_center",
            "doctor": "medical_center",
            "clinic": "medical_center",
            "bar": "birch_barrel",
            "restaurant": "birch_barrel",
            "downtown": "main_street",
            "cafe": "sunrise_cafe",
            "sunrise cafe": "sunrise_cafe",
            "coffee": "sunrise_cafe",
            "grocery": "greenleaf_grocery",
            "store": "greenleaf_grocery",
            "supermarket": "greenleaf_grocery",
            "bar": "birch_barrel",
            "restaurant": "birch_barrel",
            "bookstore": "pages_bookstore",
            "library": "library",
            "park": "elm_park",
            "gym": "community_center",
            "community center": "community_center",
            "pharmacy": "corner_pharmacy",
            "school": "school",
            "medical": "medical_center",
            "doctor": "medical_center",
            "clinic": "medical_center",
            "office": "riverside_tech",
            "tech": "riverside_tech",
        }
        for key, loc_id in mapping.items():
            if key in hint:
                return loc_id
        # Try direct ID match
        if hint in self.environment.world.locations:
            return hint
        return None

    def _fallback_action(self, agent: AgentState, hour: int) -> str:
        """Deterministic fallback when LLM is unavailable."""
        if agent.current_activity == "working":
            return "Continuing work"
        if 8 <= hour <= 17 and agent.workplace_id and agent.location_id == agent.workplace_id:
            agent.current_activity = "working"
            return "Working (fallback)"
        if 12 <= hour <= 13:
            agent.needs.hunger = min(100, agent.needs.hunger + 25)
            agent.current_activity = "eating"
            return "Eating lunch (fallback)"
        agent.current_activity = "idle"
        return "Idling (fallback)"

    async def _plan_day(self, agent: AgentState, sim_time: datetime) -> None:
        """Generate or refresh the agent's daily plan."""
        if agent.last_planning_date == sim_time.day:
            return  # Already planned today

        memories = self.memory_store.get(agent.id).retrieve(
            f"daily routine and plans for {sim_time.strftime('%A')}", k=5
        )
        mem_text = "\n".join(f"- {m.content}" for m in memories) or "No recent memories."

        user_prompt = f"""You are {agent.name} ({agent.occupation}). {agent.personality.description()}.

Today is {sim_time.strftime('%A, %B %d')}.
Your home is at {agent.home_location_id}. Your workplace is {agent.workplace_id}.
Your interests: {', '.join(agent.interests)}

Recent context:
{mem_text}

Create a brief schedule for today. List 5-8 key activities with approximate times.
Format each as: HH:MM - Activity (location)"""

        result = await self.llm.plan_day(
            system="You are a daily planner for a realistic community simulation character. Create a natural, personality-appropriate schedule.",
            user=user_prompt,
        )

        if result:
            agent.daily_plan = result
            agent.last_planning_date = sim_time.day
            self.memory_store.get(agent.id).add(
                f"Planned the day: {result[:200]}", "plan", 3.0, sim_time=sim_time,
            )

    async def _check_reflection(self, agent: AgentState, sim_time: datetime) -> None:
        """Check if agent should reflect on recent memories."""
        stream = self.memory_store.get(agent.id)
        importance_sum = stream.importance_sum_since(agent.last_reflection_time)

        if importance_sum >= REFLECTION_THRESHOLD:
            top_memories = sorted(stream.memories, key=lambda m: m.importance, reverse=True)[:5]
            mem_text = "\n".join(f"- [{m.type}] {m.content}" for m in top_memories)

            result = await self.llm.reflect(
                system="You are generating introspective reflections for a character in a life simulation. Write 1-2 sentences of insight based on their recent experiences.",
                user=f"Character: {agent.name} ({agent.personality.description()})\n\nRecent important memories:\n{mem_text}\n\nWhat insights or reflections does {agent.name} have?",
            )

            if result:
                stream.add(result, "reflection", 8.0, sim_time=sim_time)
                agent.last_reflection_time = sim_time
                agent.memory_importance_sum = 0
                logger.info(f"{agent.name} reflected: {result[:80]}")
