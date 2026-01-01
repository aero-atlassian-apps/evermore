## Objective
- Establish zero-bug and zero-hallucination guarantees with fail-safe behavior, determinism, idempotency, and observability across Next.js app, API routes, and background worker.

## Current State Snapshot
- Frameworks: Next.js (App Router), React, Tailwind, Drizzle ORM, Vitest, Playwright, MSW, Zod, Winston.
- Entry points: `app/layout.tsx`, `app/page.tsx`, `app/error.tsx`, `app/api/**/route.ts`, `instrumentation.ts`, `lib/worker.ts`, `lib/infrastructure/di/container.ts`.
- Logging: `lib/core/application/Logger.ts` and `lib/infrastructure/logging/LoggerService.ts` with mixed `console.*` usage in routes and worker.
- Error handling: Global error UI `app/error.tsx`, runtime hooks in `instrumentation.ts`, recovery utilities in `lib/core/application/agent/recovery/ErrorRecovery.ts`.
- Security/ops: `proxy.ts` (auth/JWT), `RateLimiter`, `Idempotency`, `Metrics`, LLM usage tracking.

## Contracts Enforcement
- Introduce a `SafeRoute` wrapper for all `app/api/**/route.ts` handlers to enforce:
  - Structured results (`{ ok, data?, error?, reason, traceId }`) with no partial successes.
  - Sentinel outputs for missing/uncertain/unproven states (`reason: 'MISSING'|'UNCERTAIN'|'UNPROVEN'`).
  - Timeouts, cancellation, and consistent status mapping.
- Adopt a typed `Result<T,E>` utility and `ContractGuard` invariants for domain services.
- Replace `console.*` with structured logger; attach `traceId` and `operationId` to every log line.

## Error Boundaries & Recovery
- UI: Add route-level error boundaries to critical pages under `app/**/page.tsx` beyond global `app/error.tsx`.
- Server: Wrap all API handlers and `lib/worker.ts` steps with `ErrorRecovery` (classification, retries/backoff, circuit breakers, fallbacks, degradation paths).
- Global: Keep `process.on('uncaughtException'|'unhandledRejection')` but redirect to logger + metrics with explicit shutdown policies where required.

## Observability & Diagnostics
- Standardize logging via `lib/core/application/Logger.ts` with JSON output and level gating; remove `winston` duplication or unify behind one adapter.
- Add request/operation context middleware: generate `traceId`, propagate to handlers, worker, and external adapters.
- Expand `lib/core/application/observability/Metrics.ts` with counters/histograms for latency, errors, retries, circuit-breaker opens, idempotency hits/misses.
- Add health endpoints and diagnostics with fine-grained `reason` codes where missing.

## Configuration Safety
- Create `lib/core/config/Config.ts` using `Zod` schema validation for `.env` and runtime configuration.
- Fail-closed defaults; forbid boot without required secrets; sanitize and never log sensitive values.
- Document safe configuration changes; version configs and validate on deploy.

## Determinism & Idempotency
- Enforce idempotency on mutating API routes via `Idempotency-Key` and persistent dedupe store.
- Ensure worker jobs are idempotent: stable job identifiers, safe retries, transactional checkpoints (Drizzle).
- Remove non-deterministic behavior or gate it behind seeded randomness; record seeds in logs.

## Isolation, Backpressure, Timeouts
- Apply concurrency limits and backpressure to heavy endpoints and worker loops.
- Add per-adapter timeouts and cancellation tokens; implement circuit breakers around external services.
- Degrade gracefully to safe fallbacks (e.g., static messages, cached results) with explicit visibility.

## Testing & Guarantees
- Unit: Property-based and boundary tests for `Result`, `ContractGuard`, recovery utilities.
- Integration: DB/adapter tests covering retries, circuit-breakers, idempotency.
- E2E: Playwright flows for degraded modes and error UIs; include failure injection and golden datasets.
- Coverage gates and CI enforcement; add deterministic seeds and fixtures.

## Rollback & Feature Flags
- Introduce config-driven feature flags for wrappers/recovery/idempotency to stage rollout.
- Ensure all schema/data migrations are reversible; document rollback steps.
- Use blue-green or canary deploy strategies where supported.

## Implementation Phases
1. Observability normalization: logger unification, trace propagation, metrics expansion; remove `console.*` usages.
2. Contract wrappers: implement `SafeRoute`, `Result`, and `ContractGuard`; refactor API routes to use them.
3. Idempotency & rate limit: apply across POST endpoints and worker.
4. Recovery integration: wire `ErrorRecovery` into worker and external adapters with circuit breakers.
5. Configuration safety: build `Config.ts` with Zod validation; prohibit unsafe boots.
6. Test hardening: add unit/integration/E2E with failure injection and coverage gates.
7. Runbooks: SLOs, incident handling, degradation playbooks, and ops documentation.

## Acceptance Criteria
- No `console.*` calls in production code; structured logs with `traceId`.
- All API responses conform to contract with explicit `reason` on failures.
- Deterministic, idempotent behavior verified via tests and metrics.
- E2E passes including degraded/failure scenarios; CI coverage thresholds met.
- Config validation prevents unsafe boots; secrets never logged.

## Risks & Mitigations
- Regression risk from refactors → staged rollout via flags, exhaustive tests, and canaries.
- Performance overhead from wrappers → measure via metrics; optimize hotspots; keep fail-safe guarantees intact.

## Non-Goals
- No feature additions unrelated to reliability; preserve backward compatibility and public API semantics.