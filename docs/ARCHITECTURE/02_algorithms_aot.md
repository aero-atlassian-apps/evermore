# Algorithms: Atom of Thought (AoT)

Evermore implements an advanced cognitive architecture called **Atom of Thought (AoT)** to handle complex creative tasks.

## Why AoT?
Large Language Models (LLMs) struggle with "long-horizon" tasks (e.g., "Write a perfect book chapter with consistency"). They forget earlier constraints or hallucinate details.

**AoT** solves this by breaking the task into atomic, parallel sub-tasks ("Atoms") that are verified before synthesis.

---

## 1. Chapter Generation Algorithm (5 Atoms)

Used in: `AgenticChapterGenerator.ts`

### Inputs
- Raw Conversation Transcript
- User Profile (Name, Age, Bio) - **Context Injection**
- Previous Chapter Summaries

### The Decomposition (Parallel Execution)
1. **Atom 1: Narrative Arc** (`extract-narrative-arc`)
   - *Goal*: Extract the core theme and storyline (10-20 words).
2. **Atom 2: Emotional Tone** (`detect-emotion`)
   - *Goal*: Determine the emotional valence (Joy, Nostalgia, Pride) to guide the writing voice.
3. **Atom 3: Best Quotes** (`extract-quotes`)
   - *Goal*: Find specific verbatim phrases to preserve the authentic voice.
4. **Atom 4: Setting** (`extract-setting`)
   - *Goal*: Deduce Time Period (e.g., "1960s"), Location, and Atmosphere.
5. **Atom 5: Sensory Details** (`extract-sensory`)
   - *Goal*: Extract 5 vivid sensory details (Sights, Sounds, Smells) for "Show Don't Tell" immersion.

### The Synthesis
A final **Context-Engineered Prompt** combines these 5 atoms with the **User Profile** to ghostwrite the chapter. It explicitly differentiates between the *Narrator* (User's current age) and the *Protagonist* (User in the memory).

---

## 2. Storybook Generation Algorithm (6-Step Pipeline)

Used in: `StorybookService` / `AoTStorybookGenerator`

### The Pipeline
1. **Transformation**: Adult Transcript -> Children's Narrative (Age appropriate filter).
2. **Decomposition (AoT)**:
   - *Key Moments* (Visual scenes to draw)
   - *Visual Elements* (Consistent style guide)
   - *Narrative Beats* (Pacing)
   - *Character Details* (Appearance consistency)
3. **Contraction**: Select exactly 6 best scenes to fit standard booklet format.
4. **Layout Optimization**: AI decides layout (`full-bleed` vs `text-heavy`) based on emotional intensity.
5. **Illustration**: Parallel generation of 6 images using Vertex Imagen 2 + Style Transfer Prompting.
6. **Assembly**: Compile into PDF.

---

## 3. Hallucination Detection Algorithm

A "Observer-Critic" loop runs after generation.

1. **Judge LLM** reads: (A) Original Transcript, (B) Generated Chapter.
2. **Task**: list every statement in (B) not supported by (A).
3. **Scoring**:
   - *High Risk*: Flag for human review.
   - *Low Risk*: Auto-publish.

This ensures we never fabricate details about a senior's life.
