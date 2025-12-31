# Evermore Product Canvas

> Current MVP scope and feature definition.

---

## Product Overview

| Dimension | Value |
|-----------|-------|
| Name | Evermore |
| Version | MVP (v1.0) |
| Category | AI-powered voice biographer |
| Primary platform | Web (responsive), voice-first |
| Target users | Seniors 65+, Family members |

---

## Problem Solved

Seniors have valuable life stories that are being lost to time, cognitive decline, and isolation. No accessible tool exists that lets them share stories through natural conversation and preserve them for family.

---

## Solution

An empathetic AI companion that engages seniors in patient voice conversations, captures and organizes their stories, and shares them with family through a dedicated dashboard.

---

## Core Features (MVP)

### 1. Voice Conversation Engine

| Component | Description |
|-----------|-------------|
| Speech-to-text | Real-time transcription of senior speech |
| Empathetic dialogue | Patient, curious, emotionally aware responses |
| Text-to-speech | Natural voice output with appropriate pacing |
| Session management | Start, pause, resume conversations |

### 2. Persistent Memory System

| Component | Description |
|-----------|-------------|
| Semantic memory | Vector-indexed facts about user's life |
| Episodic memory | Summaries of significant interactions |
| Context retrieval | RAG-powered Evermore of relevant past stories |
| Memory growth | Knowledge base expands with every session |

### 3. Photo Trigger System

| Component | Description |
|-----------|-------------|
| Image upload | Family sends photos via dashboard |
| Visual analysis | AI describes and contextualizes images |
| Story prompting | Photos trigger related memories and stories |
| Proustian triggers | Visual cues unlock deeper recollections |

### 4. Safety and Wellbeing

| Component | Description |
|-----------|-------------|
| Scam detection | Identifies suspicious requests or pressure |
| Crisis intervention | Recognizes distress markers, escalates appropriately |
| Medical guardrails | Never provides medical advice |
| Autonomy levels | Graduated control based on risk level |

### 5. Family Dashboard

| Component | Description |
|-----------|-------------|
| Story viewer | Browse captured stories and transcripts |
| Engagement tracking | See parent's session activity |
| Photo contribution | Upload images to trigger conversations |
| Account management | Subscription, settings, permissions |

---

## Technical Architecture

| Layer | Technology |
|-------|------------|
| Frontend | Next.js, React, TailwindCSS |
| Backend | Next.js API routes, serverless functions |
| AI core | Google Vertex AI (Gemini), ReAct agent loop |
| Memory | Pinecone vector database |
| Voice | Google Cloud STT/TTS |
| Database | PostgreSQL (Neon), Drizzle ORM |
| Auth | Clerk |
| Hosting | Vercel |

---

## AI Architecture

| Component | Description |
|-----------|-------------|
| Agent pattern | ReAct with Algorithm of Thoughts planning |
| State machine | FSM: Idle → Intent → Plan → Execute → Reflect → Synthesize |
| Persona | Empathetic biographer with adaptive warmth |
| Memory tiers | Working, short-term, semantic, episodic |
| Safety | Wellbeing guard, tool permission model |

---

## User Roles

| Role | Capabilities |
|------|--------------|
| Senior | Voice conversations, story sharing |
| Family | Dashboard access, photo uploads, prompts |
| Admin | System monitoring, safety oversight |

---

## Key Flows

### Senior: First Session

1. Onboarding: simple voice-guided setup
2. Greeting: Evermore introduces itself
3. Opening question: gentle, open-ended prompt
4. Story capture: patient listening, follow-ups
5. Closure: summary, preview of next time

### Family: Dashboard Engagement

1. Login: Clerk authentication
2. Overview: recent activity, engagement metrics
3. Stories: browse and search captured content
4. Contribute: upload photos, suggest prompts
5. Settings: notifications, export options

---

## Metrics

| Metric | Target |
|--------|--------|
| Session completion rate | >80% |
| Stories captured per session | 1+ |
| Weekly active seniors | 3,000 (Y1) |
| D7 return rate | >50% |
| Family dashboard engagement | 70% weekly |

---

## Out of Scope (MVP)

| Feature | Rationale |
|---------|-----------|
| Printed story books | Post-MVP upsell |
| Multi-language | English-first focus |
| Mobile app | Web-first, responsive |
| Video calls | Adds complexity, limited senior adoption |
| B2B facility portal | Future expansion |
| Voice cloning | Privacy and ethical concerns |

---

## Dependencies

| Dependency | Risk | Mitigation |
|------------|------|------------|
| Google Vertex AI | Medium | Abstracted via ports, multi-provider possible |
| Pinecone | Low | VectorStorePort allows swap to alternatives |
| Clerk | Low | Standard OAuth flows, replaceable |

---

## Success Criteria

MVP is successful if:

1. 100+ seniors complete 3+ sessions each
2. 60% of families access dashboard weekly
3. 0 critical safety incidents
4. 10% trial-to-paid conversion
5. Mean NPS score >40 from family users
