## Objective
- Make AI and audio features fail-safe and performance-optimized so users do not perceive failures or slowdowns while preserving determinism, idempotency, and observability.

## Current Constraints
- Next.js App Router with server components; API routes under `app/api/**/route.ts` for chat/tts/stt.
- Audio features: `speech-to-text`, `text-to-speech`, `interjection`, client audio processors in `public/audio-processor.js` and `public/speech-test.html`.
- Recovery utilities exist but UX degradation paths are limited and mixed `console.*` logging persists.

## Fail‑Safe AI UX
- Introduce deterministic AI fallbacks that render instantly:
  - Prebuilt templates for greetings, acknowledgements, safe summaries, and confirmations.
  - Local synthetic responses gated by `reason: 'MISSING'|'UNCERTAIN'|'UNPROVEN'` but presented as normal content.
- Shadow retry architecture:
  - On timeout/error, immediately return fallback; retry AI in background; if retry succeeds, seamlessly replace with upgraded content.
- Streaming continuity:
  - Always start with a pre-streamed header chunk; append AI output when available.
  - For `chat/stream`, begin stream with safe prefix to avoid perceived delay.
- Deterministic content seeds:
  - Use seeded generators for placeholders to keep consistency across reloads.

## Fail‑Safe Audio
- Dual-path TTS:
  - Primary provider → timeboxed; fallback provider → shorter samples; ultimate fallback → local pre-recorded phrases.
- Audio sprites and prefetch:
  - Preload common phrases/audio sprites on route load; cache via Service Worker.
- Streamed playback:
  - Start playback with a short buffered chunk; continue streaming; if provider is slow, finish with fallback audio.
- Non-fatal STT:
  - If STT fails, capture waveform locally and keep UI responsive; show transcript placeholder updated when retries succeed.

## Performance Optimizations
- Caching  edge/CDN:
  - Cache static prompts/assets; set `Cache-Control` on API content where safe; leverage ISR for content pages.
- Client responsiveness:
  - Use React Suspense skeletons; optimistic UI for chat send; defer non-critical hydration.
- Streaming responses:
  - Convert slow endpoints to streamed `ReadableStream` responses with early head chunk.
- Preload/prefetch:
  - Warm critical endpoints on route transition; prefetch audio/text assets.
- Database  Drizzle:
  - Add indexes for hot queries; eliminate N+1 by pre-joining; paginate consistently.
- Concurrency budgets:
  - Limit concurrent AI/audio requests per session; queue with priority; cancel stale requests.

## Observability  Invisible Failures
- Structured logs only; attach `traceId`/`operationId` to AI/audio flows.
- Metrics: p50/p90/p99 latency for chat/TTS/STT; error counts; fallback hit rates; shadow-retry success rates.
- Synthetic tests watch p95 chat time-to-first-byte and audio start latency.

## Contract Enforcement
- `SafeRoute` wrappers for AI/audio APIs to enforce:
  - Strict timeouts; idempotency keys; clear `reason` codes; standardized payloads.
- Result invariants in services; forbid partial successes; degrade explicitly yet invisibly to users.

## Implementation Phases
1. Observability  unify logger, add `traceId`, expand metrics for AI/audio; remove `console.*`.
2. UX fallbacks  implement deterministic content templates and shadow-retry for chat and TTS.
3. Audio pipeline  prefetch sprites, implement streamed playback with dual-provider fallback.
4. Performance  enable streaming on slow endpoints, caching/ISR, indexes, and concurrency limits.
5. Contracts  add `SafeRoute`, idempotency, and standardized response schema across AI/audio routes.
6. Tests  unit/integration/E2E for degraded/streaming paths; latency budgets enforced in CI.

## Acceptance Criteria
- Chat: time-to-first-chunk ≤ 300ms with fallback; p95 end-to-end ≤ 2s.
- Audio: playback starts ≤ 300ms using buffer/sprite; dual-path fallback observed.
- Zero visible hard failures for AI/audio; logs/metrics show explicit reasons.
- All AI/audio APIs return standardized payload with `reason` when degraded; idempotency enforced.

## Rollout  Safe Guards
- Gate new behavior behind feature flags; canary routes; rollback via config toggle.
- Document runbooks for provider outages and audio degradation handling.
