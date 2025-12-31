# System Design & Architecture

## 1. High-Level Architecture

Evermore is built on a **Clean Architecture** backbone, prioritizing separation of concerns and dependency injection.

```mermaid
graph TD
    User[User (Web/Voice)] --> NextJS[Next.js App Router]
    
    subgraph "Frontend Layer"
        NextJS --> UI[React Components]
        NextJS --> State[Zustand Stores]
        NextJS --> Audio[Web Audio API]
    end

    subgraph "Application Layer (Use Cases)"
        API[API Routes] --> UC_Chat[Conversation Use Cases]
        API --> UC_Story[Story Generation Use Cases]
        API --> UC_Bio[Biographer Use Cases]
    end

    subgraph "Domain Layer (Core Logic)"
        Entities[Entities (Chapter, User)]
        Ports[Ports / Interfaces]
    end

    subgraph "Infrastructure Layer (Adapters)"
        Repo[Repositories (Drizzle)]
        LLM[LLM Adapter (Vertex AI)]
        Voice[Speech Adapter (ElevenLabs)]
        Memory[Vector Store (Pinecone)]
        Image[Image Gen (Vertex Imagen)]
    end

    UC_Chat --> Ports
    Ports -.-> LLM
    Ports -.-> Voice
    Ports -.-> Memory
    Ports -.-> Repo
```

---

## 2. Cognitive Architecture (The "Brain")

Evermore uses a **ReAct (Reasoning + Acting)** loop extended with **AoT (Atom of Thought)** for complex tasks.

### Biographer Agent
The core agent that drives conversation.
- **Capabilities**: Interviewing, Active Listening, Topic Discovery.
- **Memory**: 
  - *Short-term*: Current conversation buffer.
  - *Long-term*: Pinecone vector store (Semantic Evermore of past stories).
- **Tools**: Can trigger "Save Memory", "Generate Chapter", "Suggest Topic".

### AoT (Atom of Thought) Pattern
We do not rely on single large constraints. Complex tasks are broken down into atomic, verifyable units.
*(See [ALGORITHMS_AOT.md](./ALGORITHMS_AOT.md) for details)*

---

## 3. Service Integration

Evermore orchestrates multiple high-performance AI services:

| Capability | Provider | Fallback |
|------------|----------|----------|
| **LLM / Brain** | **Google Vertex AI** (Gemini 1.5 Pro) | OpenAI GPT-4 (Optional) |
| **Voice Synthesis** | **ElevenLabs** (Turbo v2.5) | HuggingFace / Web Speech API |
| **Vector Memory** | **Pinecone** | In-Memory (Dev) |
| **Image Generation** | **Vertex Imagen 2** | SVG Placeholders |
| **Database** | **CockroachDB** (PostgreSQL) | Local Docker Postgres |
| **Caching/Queue** | **Upstash Redis** | Local Redis |

---

## 4. Security & Privacy

- **Encryption**: All data in transit (TLS 1.2+).
- **Secrets**: Managed via environment variables (Vercel/Docker).
- **Hallucination Detection**: automated verification layer before publishing any chapter.
- **Role-Based Access**: Segregation between "Senior" (Storyteller) and "Family" (Viewer) roles.
