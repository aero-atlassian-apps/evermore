# 14. Future Evolution & Roadmap

## 14.1 Known Limitations (MMP)

1.  **Memory Window:** The AI uses a tiered memory system (Short-term + RAG). Deeper continuity is improved but still evolving.
2.  **Voice Interruption:** Standard VAD is tuned for seniors but network latency can still cause occasional overlaps.
3.  **Language:** English only.

---

## 14.2 Roadmap & Evolution

### **Phase 1: The MMP (Completed)**
-   **Core:** Data Flywheel (Signals + Feedback).
-   **Infra:** Local AI Stack (Ollama, Kokoro, LocalAI) for privacy-first option.
-   **Validation:** Full E2E Test Suite (Playwright) + Accessibility Compliance.

### **Phase 2: The Biographer's Studio (Q3)**
-   **Feature:** Edit Chapters manually.
-   **Feature:** Add photos to existing chapters.
-   **Tech:** Move Chapter Generation to Temporal.io for better reliability.

### **Phase 3: Multi-Modal Deepening (Q4)**
-   **Feature:** "Show me" - User can point camera at objects during talk.
-   **Feature:** Video Interviews (recording face).

### **Phase 4: The Legacy Book (Next Year)**
-   **Feature:** One-click print service (integration with Blurb/Lulu).
-   **Feature:** "Voice Clone" - AI reads the book in the Senior's voice (Consent required).

---

## 14.3 Technical Debt Strategy

-   **Refactoring:** `ProcessMessageUseCase` is getting large. Plan to split into `VoiceOrchestrator` and `TextChatService`.
-   **Testing:** E2E coverage is **COMPLETE**. Continue maintaining Playwright suites for new features.
-   **Database:** JSONB is flexible. Normalization planned for Phase 3.
