# 14. Future Evolution & Roadmap

## 14.1 Known Limitations (MVP)

1.  **Memory Window:** The AI only "remembers" the last 5 turns + RAG context. Deep, multi-session continuity is imperfect.
2.  **Voice Interruption:** Standard VAD (Voice Activity Detection) can sometimes cut off slow speakers (common in seniors).
3.  **Language:** English only.

---

## 14.2 Planned Evolution

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
-   **Testing:** E2E coverage is low. dedicate 20% of sprint time to Playwright tests.
-   **Database:** JSONB is flexible but hard to migrate. Plan to normalize `entities` if search performance degrades.
