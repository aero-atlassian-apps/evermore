# 10. CI/CD & Testing Strategy

## 10.1 Testing Philosophy: The Pyramid

We strictly adhere to the **Test Pyramid**. We do not rely on slow E2E tests to catch logic bugs.

### **1. Unit Tests (70% of Volume)**
-   **Scope:** Domain Entities, Domain Services, Utility Functions.
-   **Speed:** < 5ms per test.
-   **Mocking:** PURE. No DB, No Network.
-   **Example:** `TimeFormatter.test.ts`, `Chapter.validate()`.

### **2. Integration Tests (20% of Volume)**
-   **Scope:** Use Cases + Adapters.
-   **Speed:** < 500ms per test.
-   **Mocking:** DB is "In-Memory" (or Dockerized Postgres). External APIs (Vertex/ElevenLabs) are **Mocked**.
-   **Why:** Verifies that the Application Layer correctly orchestrates the Adapters.

### **3. E2E Tests (10% of Volume)**
-   **Scope:** Critical User Journeys (Login -> Record -> Save).
-   **Speed:** > 10s per test.
-   **Mocking:** Minimal. Runs against "Preview" environment.
-   **Tool:** Playwright.

---

## 10.2 CI Pipeline (GitHub Actions)

**Trigger:** Push to `main` or PR.

1.  **Static Analysis:**
    -   `pnpm lint` (ESLint: strict rules).
    -   `pnpm type-check` (TypeScript: no `any`).
2.  **Unit/Integration:**
    -   `pnpm test:unit` (Vitest).
    -   **Gate:** Must pass 100%.
3.  **Build:**
    -   `pnpm build` (Next.js production build).
    -   **Gate:** Zero warnings.
4.  **E2E (Nightly/Release):**
    -   `pnpm test:e2e` (Playwright).

---

## 10.3 Regression Strategy

### **Golden Datasets**
We maintain a set of "Golden Transcripts" (`tests/fixtures/transcripts/`) with known correct outputs.
-   **Drift Detection:** If the prompt changes, we run the Golden Set. If the generated Chapter differs significantly (Semantic Distance > 0.1) from the Golden Chapter, the PR is flagged.

### **Snapshot Testing**
-   UI Components are snapshot-tested to prevent visual regressions in generic components.
