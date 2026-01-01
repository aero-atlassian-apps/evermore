## Scope

* Audit every critical path and representative files across app, API, lib, adapters, worker, config, and tests.

* Validate world‑class criteria: zero‑bug/fail‑safe, zero‑hallucination, determinism, idempotency, observability, security hardening, performance.

* No changes; produce actionable findings with file references and severity ratings.

## Methodology

* Repository survey and mapping: components, API routes, DI container, worker, adapters, security middleware.

* Static analysis: TypeScript strictness, ESLint compliance, dead code, error handling patterns, `console.*` usage, unsafe casts.

* Contracts audit: API response shapes, error boundaries, fallback behavior, trace propagation, logging consistency.

* Security: auth/proxy coverage, JWT handling, rate limiting, idempotency, input validation, secrets/config, headers.

* Reliability: retries/backoff, circuit breakers, worker safety, concurrency controls, resource cleanup, graceful degradation.

* Performance: streaming paths, audio pipeline latency, TTS/STT generation, caching/dedup, preconnect, client rendering.

* Observability: metrics coverage, traceId propagation, structured logs, health endpoints.

* Tests: unit/integration/E2E breadth, failure injection, coverage gates.

* Dependencies: risky libs, native modules, external services configs.

## Deep‑Dive Checks

* App Router pages and errors: `app/**/page.tsx`, `app/error.tsx`, `app/not-found.tsx`.

* API endpoints: `app/api/**/route.ts` with focus on chat/tts/stt/stream/sessions, rate limit, idempotency, health.

* Worker: `lib/worker.ts` processing loop, retries, backpressure.

* DI & adapters: `lib/infrastructure/di/container.ts`, adapters for LLM, speech, storage, vector, email; configuration selection.

* Security middleware: `proxy.ts`, `lib/auth/jwt.ts`.

* Observability: `lib/core/application/Logger.ts`, `lib/core/application/observability/Metrics.ts`.

* Performance: `components/audio/**`, `lib/audio/AudioPipeline.ts`, streaming hook `lib/stores/useStreamingChat.ts`.

* Configs: `next.config.ts`, `tailwind.config.ts`, `vitest.config.ts`, `playwright.config.ts`, Docker files.

## Deliverables

* Audit report per area with findings, file\_path:line references, severity (critical/high/medium/low), and fix proposals.

* Summary verdict: World‑Class, Needs Work, or Red Flag per category and overall.

* Risk register and prioritized remediation plan with estimated effort.

## World‑Class Criteria

* Fail‑safe: users never see AI failures; seamless fallbacks; no partial successes.

* Security: fail‑closed API, strong JWT, rate limiting/idempotency, sanitized inputs, strict headers, no secret leakage.

* Reliability: robust retries/backoff, circuit breakers, deterministic/idempotent worker jobs, bounded concurrency.

* Observability: consistent structured logs with traceId; latency/error metrics; health endpoints.

* Performance: streaming where applicable; fast audio start; preconnect/warmup; caching/dedup; responsive UI.

* Testing: meaningful unit/integration/E2E with failure injection and coverage gates.

## Reporting Format

* Findings list with: description, evidence, severity, impact, recommended fix, estimated effort, rollback considerations.

* Executive summary with overall verdict and quick wins.

## Constraints

* Read‑only audit; no code changes.

* Prioritize high‑risk areas first, then breadth coverage; ensure complete mapping and representative line‑by‑line reviews.

## Next Step

* On approval, perform the audit and deliver the report with concrete file references and severity ratings.

