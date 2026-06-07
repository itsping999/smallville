"""Social service — conversation triggering, gossip propagation."""
from __future__ import annotations
import random
from typing import Optional
from app.models.agent import AgentState
from app.models.social import Relationship, Conversation, ConversationTurn
from app.core.memory_stream import MemoryStore
from app.core.llm_gateway import LLMGateway


CONVERSATION_SYSTEM_PROMPT = """You are writing dialogue for a realistic suburban community simulation.
Each character speaks naturally, reflecting their personality, mood, and relationship.
Keep dialogue SHORT (2-4 exchanges per character, 1-2 sentences each).
Topics should relate to their shared context, recent events, or everyday life.
Include occasional small talk, opinions, and light gossip."""


class SocialService:
    def __init__(self, memory_store: MemoryStore, llm: LLMGateway):
        self.memory_store = memory_store
        self.llm = llm
        self.relationships: dict[str, Relationship] = {}  # key: "a_id:b_id"
        self.conversations: list[Conversation] = []

    def _rel_key(self, a_id: str, b_id: str) -> str:
        ids = sorted([a_id, b_id])
        return f"{ids[0]}:{ids[1]}"

    def get_relationship(self, a_id: str, b_id: str) -> Relationship:
        key = self._rel_key(a_id, b_id)
        if key not in self.relationships:
            self.relationships[key] = Relationship(agent_a_id=a_id, agent_b_id=b_id)
        return self.relationships[key]

    def should_converse(self, agent_a: AgentState, agent_b: AgentState) -> bool:
        """Determine if two agents should start a conversation."""
        prob = 0.35
        # Personality modifiers
        prob *= 1 + (agent_a.personality.extraversion * 0.3)
        prob *= 1 + (agent_b.personality.extraversion * 0.2)
        # Relationship modifier
        rel = self.get_relationship(agent_a.id, agent_b.id)
        prob *= 1 + (rel.closeness * 0.3)
        # Mood modifiers
        if agent_a.emotion.valence < -0.3:
            prob *= 0.5
        if agent_b.emotion.valence < -0.3:
            prob *= 0.7
        # Energy modifiers
        if agent_a.needs.energy < 20 or agent_b.needs.energy < 20:
            prob *= 0.3
        # Location modifier (social settings boost)
        social_places = {"cafe", "restaurant", "park", "bar", "community_center"}
        if agent_a.location_id in social_places or any(
            a.location_id in social_places for a in [agent_a, agent_b]
        ):
            prob *= 1.5
        return random.random() < min(prob, 0.85)

    async def generate_conversation(self, agent_a: AgentState, agent_b: AgentState,
                                      location_name: str, sim_time_str: str) -> Optional[Conversation]:
        """Generate and record a conversation between two agents."""
        rel = self.get_relationship(agent_a.id, agent_b.id)

        # Get relevant memories for context
        mem_a = self.memory_store.get(agent_a.id).retrieve(f"conversation with {agent_b.name}", k=3)
        mem_b = self.memory_store.get(agent_b.id).retrieve(f"conversation with {agent_a.name}", k=3)

        mem_context_a = "\n".join(f"- {m.content}" for m in mem_a) or "No recent relevant memories."
        mem_context_b = "\n".join(f"- {m.content}" for m in mem_b) or "No recent relevant memories."

        user_prompt = f"""Setting: {location_name}, {sim_time_str}

Characters:
1. {agent_a.name} (age {agent_a.age}, {agent_a.personality.description()}, feeling {agent_a.emotion.dominant})
   Recent memories: {mem_context_a}
2. {agent_b.name} (age {agent_b.age}, {agent_b.personality.description()}, feeling {agent_b.emotion.dominant})
   Recent memories: {mem_context_b}

Their relationship: {rel.type} (closeness: {rel.closeness:.1f})

Write their conversation as:
{agent_a.name}: [dialogue]
{agent_b.name}: [dialogue]
(2-4 exchanges total, natural and in-character)"""

        result = await self.llm.generate_conversation(CONVERSATION_SYSTEM_PROMPT, user_prompt)

        if not result:
            return None

        # Parse conversation
        conv = Conversation(
            id=f"conv_{agent_a.id}_{agent_b.id}_{sim_time_str}",
            location_id=agent_a.location_id,
            participants=[agent_a.id, agent_b.id],
        )
        for line in result.split("\n"):
            line = line.strip()
            if ":" in line:
                for agent in [agent_a, agent_b]:
                    if line.startswith(agent.name):
                        content = line.split(":", 1)[1].strip()
                        conv.turns.append(ConversationTurn(
                            speaker_id=agent.id, speaker_name=agent.name, content=content,
                        ))
                        break

        if conv.turns:
            self.conversations.append(conv)
            # Update relationship
            rel.closeness = min(1.0, rel.closeness + 0.02)
            rel.interaction_count += 1
            rel.last_contact = sim_time_str

            # Store as memories
            for agent in [agent_a, agent_b]:
                other = agent_b if agent.id == agent_a.id else agent_a
                dialogue = "; ".join(
                    f"{t.speaker_name}: {t.content}" for t in conv.turns
                )
                self.memory_store.get(agent.id).add(
                    content=f"Had a conversation with {other.name} at {location_name}: {dialogue}",
                    memory_type="conversation",
                    importance=4.0,
                    metadata={"other_agent": other.id, "location": agent.location_id},
                )

            # Gossip propagation: share interesting memories
            await self._propagate_gossip(agent_a, agent_b, rel)

        return conv

    async def _propagate_gossip(self, agent_a: AgentState, agent_b: AgentState,
                                  rel: Relationship) -> None:
        """Share interesting memories between agents during conversation."""
        for sharer, listener in [(agent_a, agent_b), (agent_b, agent_a)]:
            stream = self.memory_store.get(sharer.id)
            interesting = [m for m in stream.recent(10) if m.importance >= 5]
            for mem in interesting[:2]:  # Share at most 2
                if random.random() < 0.4 * (1 + rel.closeness):
                    self.memory_store.get(listener.id).add(
                        content=f"{sharer.name} told me: {mem.content}",
                        memory_type="conversation",
                        importance=mem.importance * 0.7,
                        metadata={"source": sharer.id, "original_memory": mem.id},
                    )
