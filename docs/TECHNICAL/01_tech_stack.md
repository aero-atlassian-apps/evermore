# Tech Stack & Dependencies

## Core Framework
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript 5.x
- **Styling**: TailwindCSS + Framer Motion
- **State Management**: Zustand
- **Observability**: OpenTelemetry

## Backend & Database
- **Database**: Supabase (Postgres) - Managed
- **ORM**: Drizzle ORM (Schema-first, type-safe)
- **Caching**: Redis (Upstash / Local Docker)
- **Queues**: In-memory (MMP) -> Temporal (Planned)

## AI & ML
- **Orchestration**: Custom ReAct Agent (EnhancedReActAgent)
- **Cloud Providers**: 
    - LLM: Google Vertex AI (Gemini 1.5 Pro)
    - Image: Google Imagen 3
    - T2S: ElevenLabs
- **Local Stack (MMP Feature)**: 
    - LLM: Ollama (Llama 3 8B)
    - T2S: Kokoro-FastAPI
    - S2T: Faster-Whisper
    - Image: LocalAI (SDXL Turbo)

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
