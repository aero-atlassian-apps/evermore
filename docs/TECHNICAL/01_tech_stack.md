# Tech Stack & Dependencies

## Core Framework
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5.x
- **Styling**: TailwindCSS + Framer Motion (Animations)
- **State Management**: Zustand

## Backend & Database
- **Database**: PostgreSQL (CockroachDB Serverless)
- **ORM**: Drizzle ORM (Schema-first, type-safe)
- **Caching**: Redis (Upstash) - used for session state and rate limiting

## AI & ML
- **LLM Provider**: Google Vertex AI (Gemini 1.5 Pro)
- **Image Generation**: Google Vertex Imagen 2
- **Embeddings**: Google text-embedding-004
- **Vector Store**: Pinecone (Serverless)
- **Speech-to-Text**: Google Cloud Speech / OpenAI Whisper
- **Text-to-Speech**: ElevenLabs (latency optimized)

## Infrastructure
- **Deployment**: Vercel (Production) / Docker (Staging)
- **Cron Jobs**: Vercel Cron / Background Worker
- **Email**: Resend (Transactional emails)
- **PDF Generation**: jsPDF

## Key Libraries
- `ai`: Vercel AI SDK for streaming
- `zod`: Schema validation
- `lucide-react`: Iconography
- `date-fns`: Date manipulation
