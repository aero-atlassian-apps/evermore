# Evermore (formerly Recall)

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](file:///d:/rouca/DVM/workPlace/evermore/LICENSE)

**Every senior can preserve and share their life story, creating a lasting legacy for generations to come.**

**Evermore** is a voice-first, AI-agentic application designed to preserve family stories. It allows "Seniors" (Storytellers) to record memories via natural conversation with an empathetic AI, and "Family Members" to curate and cherish these stories.

---

## 🧠 Agentic AI Architecture: The Evermore Brain

Evermore's "intelligence" is a multi-layered cognitive architecture designed for safety, emotional resonance, and long-term memory.

- **FSM (Agent State Machine)**: The "Nervous System" that maintains conversation flow and state guardrails.
- **ReAct Loop (Reason + Act)**: The "Frontal Lobe" that thinks before speaking, deciding when to query memories or save details.
- **RAG (Semantic Episodic Memory)**: The "Hippocampus" using Pinecone vector embeddings to remember details from past conversations.
- **AoT (Atom of Thought)**: The "Creative Cortex" that decomposes complex tasks like storybook generation into verifiable sub-tasks.

---

## 🛠 Tech Stack

### Core Framework
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5.x
- **Styling**: TailwindCSS + Framer Motion (Animations)
- **State Management**: Zustand

### AI & ML
- **LLM**: Google Gemini 1.5 Pro (Vertex AI)
- **Image Gen**: Google Imagen 2 (Vertex AI)
- **Vector Store**: Pinecone (Serverless)
- **Speech-to-Text**: Google Cloud Speech / OpenAI Whisper
- **Text-to-Speech**: ElevenLabs (Latency optimized)

### Backend & Infrastructure
- **Database**: PostgreSQL (CockroachDB Serverless)
- **ORM**: Drizzle ORM
- **Caching**: Redis (Upstash) for session state and rate limiting
- **Deployment**: Vercel (Production) / Docker (Staging)

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18+
- Docker Desktop (for local DB/Redis)

### 2. Setup
```bash
# Clone the repository
git clone https://github.com/your-org/evermore.git
cd evermore

# Install dependencies
npm install

# Environment setup
cp docs/env-template.txt .env.local
# Fill in your API keys in .env.local
```

### 3. Database & Infrastructure
Start the local database and redis containers:
```bash
docker compose up -d
```
Push the schema to your local database:
```bash
npm run db:push
```

### 4. Running Development
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

---

## 📊 Database Management

| Command | Description |
|---------|-------------|
| `npm run db:push` | Syncs schema with database (safe for development). |
| `npm run db:studio` | Opens Drizzle Studio (web UI) to browse data. |
| `npm run seed` | Populates local DB with sample stories (wipes existing data). |
| `npm run db:generate` | Generates SQL migrations for production. |

---

## 🧪 Testing

### Unit & Integration (Vitest)
```bash
npm run test           # Run all tests
npm run test:unit      # Run unit tests
npm run test:coverage  # Run coverage report
```

### End-to-End (Playwright)
```bash
npx playwright install # Install browsers first time
npm run test:e2e       # Run E2E tests
```

---

## 🚢 Deployment & Staging

### Docker Staging
To run a production-like environment locally:
```bash
docker compose -f docker-compose.staging.yml up --build -d
```

### Production
Deployment is optimized for **Vercel**. Ensure all environment variables from `.env.example` are configured in the Vercel dashboard.

---

## 📄 License

This project is licensed under the **GNU General Public License v3.0**. See the [LICENSE](file:///d:/rouca/DVM/workPlace/evermore/LICENSE) file for details.
