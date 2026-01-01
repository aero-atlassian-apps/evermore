## Status
- No code changes made. Audit completed with precise targets; ready to implement under feature flags.

## Key Findings (Fail‑Safe + Performance)
- TTS endpoints surface failures to clients and block until full audio:
  - d:\rouca\DVM\workPlace\evermore\app\api\tts\route.ts:59
  - d:\rouca\DVM\workPlace\evermore\app\api\chat\text-to-speech\route.ts:27–41
- STT fallback shows visible failure cues and asks users to repeat:
  - d:\rouca\DVM\workPlace\evermore\app\api\chat\speech-to-text\route.ts:51–66
  - d:\rouca\DVM\workPlace\evermore\app\conversation\page.tsx:434–447
- Welcome route degrades gracefully but uses console logging:
  - d:\rouca\DVM\workPlace\evermore\app\api\chat\welcome\route.ts:51,81,92
- Streaming chat path is solid and needs no change:
  - d:\rouca\DVM\workPlace\evermore\app\api\chat\stream\route.ts:30–103

## Zero‑Risk Implementation (Phased, Feature‑Flagged)
1) Observability normalization (no behavior change)
- Replace console logging with structured `logger` and add `traceId` propagation in TTS, STT, Welcome, Worker.
- Add latency/error metrics counters/timers for TTS/STT operations.

2) Invisible fail‑safe UX (client only)
- When `useBrowserFallback=true`, suppress toasts/system warnings and switch silently to browser TTS/STT.
- Keep `onSpeakingStart/onSpeakingEnd` signals consistent across fallback.

3) Performance improvements (client only, opt‑in)
- Preconnect/prewarm providers; prefetch voices on app load.
- Fast TTS mode for short prompts: lower bitrate/sample rate without server changes.
- Chunked TTS playback: split text by sentence; request per-chunk; start playback on first chunk; cache by `hash(text, voice)` in IndexedDB.
- Dual‑path STT: start browser STT immediately; run server STT concurrently; reconcile results without user-visible failures.

4) Rollout controls
- Gate each behavior behind feature flags (`FEATURE_INVISIBLE_FALLBACK_UI`, `FEATURE_AUDIO_PREFETCH`, `FEATURE_TTS_FAST`, `FEATURE_TTS_CHUNK_PLAYBACK`, `FEATURE_STT_DUAL_PATH`). Default OFF; canary 1%→10%→50%→100%.
- Instant rollback by toggling flags; no schema or API changes.

## Verification
- Unit: logger/trace propagation; client fallback handlers.
- E2E: ensure users never see failure cues while flags ON; measure TTS start latency improvement.
- Metrics dashboards: p50/p95 latency for TTS/STT; error rates; fallback activation counts.

## Acceptance Criteria
- Failures in TTS/STT are invisible to users; experience continues seamlessly.
- Faster audio start for typical messages via prefetch/fast/chunked modes.
- Structured logs with `traceId`; metrics available; no regressions.

## Next Step
- Approve to implement Phase 1 (observability + invisible fallback UI) under flags, then incrementally enable Phase 2 performance features.