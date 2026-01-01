## Principles
- Backwards‑compatible, reversible, feature‑flagged changes only.
- Canary rollout with instant rollback via env flags.
- No API contract changes; default behavior unchanged.

## Phase 1 — Observability (No Behavior Change)
- Expand request latency + traceId to critical APIs:
  - Add `recordHttpRequest` and propagate `x-trace-id` in:
    - `app/api/chat/route.ts`
    - `app/api/chat/interjection/route.ts`
    - `app/api/chapters/[id]/pdf/route.ts`
    - `app/api/conversation/save-audio/route.ts`
    - `app/api/family/chapters/route.ts`
    - `app/api/stories/route.ts`
- Unify logging (replace `console.*` with `logger`) without changing logic:
  - `lib/infrastructure/services/AudioConverter.ts:125,132,138,170`
  - `lib/infrastructure/services/RedisService.ts:44–62,84–94,100–104`
- Add adapter/gateway counters (no flow change):
  - Failure/retry/circuit state metrics in `lib/infrastructure/adapters/ai/LLMGateway.ts`, speech adapters.

## Phase 2 — Security Hardening (Minimal Touch)
- Rate limiting and idempotency for mutating endpoints:
  - Apply `checkRateLimit` + `withIdempotency` to:
    - `app/api/conversation/save-audio/route.ts`
    - `app/api/chapters/[id]/favorite/route.ts`
    - `app/api/chapters/[id]/pdf/route.ts`
    - `app/api/users/route.ts` (POST)
- Input validation with zod schemas on request bodies across these routes.

## Phase 3 — Performance (Flags: default OFF)
- Server TTS streaming:
  - Stream `audio/mpeg` via `ReadableStream` in:
    - `app/api/tts/route.ts`
    - `app/api/chat/text-to-speech/route.ts`
  - Client consumes via `MediaSource` or `AudioContext`; gated by `NEXT_PUBLIC_FEATURE_TTS_STREAMING`.
- Client sentence‑chunk TTS playback:
  - Split text by sentence; request per‑sentence; start playback on first chunk.
  - Cache chunks in IndexedDB keyed by `hash(text, voice)`; gate via `NEXT_PUBLIC_FEATURE_TTS_CHUNK_PLAYBACK`.
- STT dual‑path:
  - Start browser STT immediately for interim text; keep server STT for final accuracy.
  - Reconcile transparently in `app/conversation/page.tsx`; gate via `NEXT_PUBLIC_FEATURE_STT_DUAL_PATH`.

## Phase 4 — Reliability (No Contract Changes)
- Worker telemetry:
  - Track job queue depth, processing duration, retries, error reasons; export to `Metrics` in `lib/worker.ts`.
- Concurrency controls:
  - Keep single concurrency for chapter generation; add config + backpressure detection metrics.
- Adapter circuit breakers:
  - Expose counters for open/half‑open/closed in LLM/speech adapters; no behavior change.

## Phase 5 — Testing & CI
- Enforce coverage gates in `vitest.config.ts`; add CI steps for `lint`, `typecheck`, unit/integration/e2e.
- E2E scenarios for fail‑safe:
  - Credentials/quota failures → invisible fallback
  - Streaming TTS latency < 500ms for short sentences
  - STT dual‑path interim → final reconciliation
- Failure injection tests for adapters and worker retries.

## Rollout & Flags
- Enable immediately (safe):
  - `NEXT_PUBLIC_FEATURE_INVISIBLE_FALLBACK_UI=true`
  - `NEXT_PUBLIC_FEATURE_AUDIO_PREFETCH=true`
- Canary flags (start 1%):
  - `NEXT_PUBLIC_FEATURE_TTS_STREAMING=false`
  - `NEXT_PUBLIC_FEATURE_TTS_CHUNK_PLAYBACK=false`
  - `NEXT_PUBLIC_FEATURE_STT_DUAL_PATH=false`
- Monitor latency/error metrics dashboards; rollback by toggling flags.

## Acceptance Criteria
- Users never see failure cues; seamless audio/STT under failures.
- Audio start latency improves measurably; streaming/chunking gated.
- Uniform logs/metrics across APIs/adapters; traceId propagated.
- Rate limits/idempotency enforced on mutation routes; tests green with coverage thresholds.

## Timeline & Safety
- Deliver Phase 1–2 first (no behavior change, minimal risk).
- Phase 3–4 behind flags with canary; validate via metrics and E2E.
