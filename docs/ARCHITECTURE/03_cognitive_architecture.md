# Cognitive Architecture

Evermore operates as a **Stateful, Context-Aware Agentic System**. It moves beyond simple "chatbot" mechanics by implementing a sophisticated cognitive hierarchy.

## 🧠 The Agentic Hierarchy

We employ a layered approach to reasoning, moving from fast, reactive patterns to slow, deliberative planning.

| Pattern | Speed | Use Case | Implementation |
|---------|-------|----------|----------------|
| **FSM (Finite State Machine)** | Instant | Guardrails, Flow Control | `AgentStateMachine` |
| **ReAct (Reason + Act)** | Fast | Conversation, Tool Use | `BiographerAgent` |
| **CoT (Chain of Thought)** | Medium | Complex Answers, Reflection | System Prompts |
| **AoT (Atom of Thought)** | Slow | Creative Generation (Chapters) | `AoTChapterGenerator` |

---

## 1. Finite State Machine (FSM)
**"The Nervous System"**

The agent is not just an LLM loop; it is a deterministic State Machine. This guarantees safety and prevents "doom loops".

**States:**
- `IDLE`: Waiting for user input.
- `INTENT_ANALYSIS`: Classifying user request (Is this a story? A question? A command?).
- `ACTIVE_LISTENING`: Asking follow-up questions.
- `REFLECTING`: Checking memory for connections.
- `GENERATING`: Writing a chapter (AoT mode).
- `SAFETY_HALT`: Triggered by `WellbeingGuard`.

**Transitions:**
- If *Safety Risk* > High -> Force transition to `SAFETY_HALT`.
- If *Token Budget* > Limit -> Force transition to `WRAP_UP`.

---

## 2. ReAct Loop (Reasoning + Acting)
**"The Working Memory"**

For standard conversation, we use the ReAct pattern:
1. **Thought**: "The user mentioned their brother. I should check if we know his name."
2. **Action**: `query_memory(query="brother name")`
3. **Observation**: "Found memory: Brother's name is Robert."
4. **Response**: "You mentioned Robert earlier..."

This loop allows the agent to "act" (query DB, save memory) before "speaking".

---

## 3. Context Awareness & Vector Memory (RAG)
**"The Hippocampus"**

Evermore possesses **Semantic Episodic Memory** via Pinecone.

### Architecture
- **Short-Term Context**: Last 10 conversation turns (Raw tokens).
- **Long-Term Memory**: Vector database of "Facts" and "Stories".
- **Retrieval**:
  - We do not just retrieve based on keywords.
  - We retrieve based on **Embedding Similarity** (Semantic meaning).
  - *Example*: User says "I miss the war days." -> Retrieves memories about "Army", "1945", "Uniforms".

### Integration
Before every response, the `ContextManager`:
1. Embeds the user's latest message.
2. Queries Pinecone for top-3 relevant past memories.
3. Injects them into the System Prompt as `[EvermoreED_MEMORIES]`.

---

## 4. Chain of Thought (CoT)
**"The Inner Monologue"**

To improve empathy and logic, we enforce **Hidden Reasoning**.
- The LLM is instructed to output a `<thinking>` block before the final answer.
- **Why?** It prevents impulsive hallucinations and allows the model to "plan" its tone.

*Prompt Example:*
```
User: "I'm feeling very lonely today."
Model:
<thinking>
  User expresses negative valence (Loneliness).
  Safety check: Is this a crisis? No, but needs comfort.
  Strategy: Validate feeling, then offer a nostalgic topic to pivot.
</thinking>
I'm so sorry to hear that. It's completely normal to feel that way...
```

---

## 5. Ahead-of-Time (AoT) Decomposition
**"The Creative Cortex"**

For our heavier tasks (Chapter & Storybook Generation), ReAct is too "short-sighted." We use **AoT** to plan the entire structure *before* writing a single word.

### The Algorithm
1. **Decompose**: Break the request into independent "Atoms" (Theme, Characters, Setting, Emotions).
2. **Generate**: Run parallel LLM calls for each Atom.
3. **Validate**: Check each Atom against the transcript (Hallucination Detection).
4. **Synthesize**: Combine validated Atoms into the final creative output.

*(See [ALGORITHMS_AOT.md](./ALGORITHMS_AOT.md) for the specific implementation details)*

---

## 6. Machine States & Safety
**"The Guardrails"**

We wrap the entire cognitive architecture in a **Safety Layer**:
- **Input Guard**: Regex & LLM checking for PII or Abuse.
- **Output Guard**: Verifies the tone is not dismissive or harmful.
- **Hallucination Judge**: A separate LLM call that purely acts as a critic.

This "Machine State" approach ensures that even if the refined cognitive model fails, the system falls back to a safe state.
