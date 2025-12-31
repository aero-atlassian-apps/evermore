# Prompt Engineering Guide

Evermore uses advanced prompting techniques to ensure empathy, safety, and high-quality storytelling.

## 🎭 Persona System

We do not use generic system prompts. Every interaction is grounded in a specific **Persona**.

### The "Empathetic Biographer"
*Used in: Conversation Mode*
- **Tone**: Warm, patient, curious, non-judgmental.
- **Technique**: Active Listening. Always validate before asking the next question.
- **Anti-Patterns**: Never interrupting, never being robotic, avoiding generic "Tell me more".

```typescript
// Core System Prompt Architecture
const SYSTEM_PROMPT = `
You are a warm, empathetic biographer interviewing a senior.
YOUR GOAL: Help them tell their life story.
RULES:
1. Ask one question at a time.
2. Validate their feelings first ("That sounds wonderful", "I am so sorry to hear that").
3. Use context from previous turns (Recursive Context).
`;
```

---

## ⚛️ Atom of Thought (AoT) Pattern

For complex generation tasks (like writing a Chapter), we use **Atom of Thought** decomposition. instead of one big prompt.

### Concept
Break a large creative task into atomic, verifiable units ("Atoms") before synthesis.

### Example: Storybook Generation
Instead of "Write a children's book", we run 4 parallel prompts:
1. **Atom 1: Key Moments** -> meaningful scenes.
2. **Atom 2: Visual Elements** -> consistent colors/objects.
3. **Atom 3: Narrative Beats** -> story structure.
4. **Atom 4: Character Details** -> consistent appearance.

**Synthesis**: The final prompt takes these 4 JSON outputs as input to write the final scenes. This guarantees consistency and reduces hallucinations.

---

## 🛡️ Hallucination Detection

We use a "Judge" prompt to verify generated content against the transcript.

**Prompt Strategy:**
- **Input**: Original Transcript + Generated Chapter.
- **Task**: "Identify any facts in the Chapter not supported by the Transcript."
- **Output**: Risk Score (High/Medium/Low) + List of hallucinations.

---

## 📚 Transformation Prompts

### Adult to Child Transformation
*Used in: Storybook Service*
Technique: **Tone Shift & Simplification**.
- **Rule**: "Transform difficult themes (War, Loss) into age-appropriate lessons (Courage, Saying Goodbye)."
- **Rule**: "Synthesize simplified vocabulary but keep emotional core."

---

## 🔧 Prompt Management
- All prompts are versioned in `lib/infrastructure/adapters/ai/prompts`.
- We use **TypeScript Interfaces** to enforce JSON output structures from the LLM.
