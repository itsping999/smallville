# SPEC-004: Social System
**Traces to**: PRD Section 4.6, Paper Conversation System

## Relationship Model

```python
class Relationship(BaseModel):
    agent_a_id: str
    agent_b_id: str
    type: str              # family | friend | colleague | neighbor | acquaintance | romantic | rival
    closeness: float       # 0.0 - 1.0
    trust: float           # 0.0 - 1.0
    interactions: list[InteractionRecord]
    last_contact: SimTime
    sentiment_history: list[SentimentPoint]  # Track trend
```

## Relationship Evolution

| Event | Closeness Change | Trust Change |
|-------|-----------------|--------------|
| Positive conversation | +0.02 to +0.05 | +0.01 |
| Negative conversation | -0.03 to -0.08 | -0.05 |
| Shared activity (meal, walk) | +0.03 | +0.02 |
| Help given/received | +0.05 | +0.08 |
| Gossip about someone else | +0.02 (bonding) | varies |
| Betrayal/broken promise | -0.10 to -0.20 | -0.15 to -0.30 |
| No contact (1 week) | -0.01 | 0 |
| No contact (1 month) | -0.05 | -0.02 |

## Conversation System

### Trigger Conditions
1. Two agents are at the same location
2. They can see each other (not in separate rooms)
3. Base probability: 35% per opportunity

### Probability Modifiers
```python
conv_probability = BASE_PROBABILITY  # 0.35
conv_probability *= 1 + (agent.extraversion * 0.3)    # Extraverts talk more
conv_probability *= 1 + (other.extraversion * 0.2)
conv_probability *= 1 + (relationship.closeness * 0.3)  # Closer friends talk more
conv_probability *= 0.5 if agent.emotion.valence < -0.3 else 1.0  # Sad agents less social
conv_probability *= 0.3 if agent.needs.energy < 20 else 1.0  # Tired agents skip
conv_probability *= 1.5 if location.type in ["cafe", "park", "bar"] else 1.0  # Social settings
```

### Conversation Generation

LLM prompt includes:
- Both agents' identities and personalities
- Their relationship history
- Recent relevant memories (top 3 each)
- Current location and context
- Both agents' current moods
- Instruction to generate 2-4 turns of natural dialogue

### Information Propagation (Gossip)

During conversations, agents may share memories:
```python
def should_share_memory(memory, listener, relationship):
    # More likely to share high-importance memories
    prob = memory.importance / 15.0  # Max ~0.67 for importance 10
    # More likely to share with close friends
    prob *= (1 + relationship.closeness)
    # More likely to share "interesting" types
    if memory.type in ["conversation", "reflection"]:
        prob *= 1.3
    return random.random() < min(prob, 0.8)
```

When a memory is shared:
1. Listener creates a new memory: "{agent_name} told me that {content}"
2. New memory has reduced importance (0.7x original)
3. This enables 3+ hop gossip chains

## Social Norms [Extended]

Agents follow implicit social rules via prompt context:
- Don't discuss private matters with strangers
- Family members are more tolerant of bad moods
- Colleagues discuss work topics at work
- Neighbors make small talk about neighborhood events
- Friends share personal problems
