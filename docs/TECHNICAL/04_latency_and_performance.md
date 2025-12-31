# Latency & Performance Targets

Evermore is a real-time conversational agent. Latency is the primary UX metric.

## ⏱️ Voice Latency Targets

**Primary Target: <1 second for first response acknowledgment**

See [VoiceLatencyBenchmarks.ts](file:///d:/rouca/DVM/workPlace/Evermore/Evermore-mvp/lib/core/application/services/VoiceLatencyBenchmarks.ts) for programmatic targets.

### Pipeline Phase Targets

| Component | Target (P50) | Hard Limit (P99) |
|-----------|--------------|------------------|
| **STT Processing** | 300ms | 2s |
| **Intent Recognition** | 300ms | 1s |
| **Memory Retrieval** | 200ms | 800ms |
| **LLM Inference** | 500ms | 3s |
| **TTS Generation** | 200ms | 2s |
| **First Response** | **<1s** | **<2s** |
| **Total TTFT** | **<2s** | **<8s** |

### Silence Timeout Handling

The [SpeechContextService](file:///d:/rouca/DVM/workPlace/Evermore/Evermore-mvp/lib/core/application/services/SpeechContextService.ts) handles:
- **Silence Timeout**: 10 seconds default
- **Graceful User Messaging**: Calm, encouraging prompts when timeout occurs
- **Explicit Context Passing**: `SpeechContext` object preserves all STT metadata for reasoning

---

## 🏎️ Optimization Strategy

### 1. Streaming Everywhere
We stream LLM tokens directly to the TTS engine. We do not wait for the full sentence to complete.
- **Agent**: `streamText()` via Vercel AI SDK.
- **Voice**: ElevenLabs Turbo v2.5 (avg latency ~300ms) or WebSpeechTTS fallback.

### 2. Parallel Execution (RAG)
During the "Intent Recognition" phase, we speculatively launch the Vector Store query in parallel.
- If the intent requires memory, we use the pre-fetched result.
- If not, we discard it.

### 3. Edge Deployment
- **Frontend**: Vercel Edge.
- **Database**: CockroachDB Serverless (Global distribution).
- **Redis**: Upstash Global.

---

## 📈 Scalability

| Tier | Concurrent Sessions | Bottleneck |
|------|---------------------|------------|
| **Starter** | ~50 | Database Connections |
| **Pro** | ~500 | LLM Rate Limits |
| **Enterprise** | 5,000+ | Custom Vercel Limits |

### Rate Limits
- **Messages**: 100/min per user.
- **Sessions**: 10/hour per user.
- **API Calls**: 1000/min (Org wide).

---

## 🧪 Latency Benchmarking

Use the `VoiceLatencyTracker` class to measure pipeline performance:

```typescript
import { VoiceLatencyTracker } from '@/lib/core/application/services/VoiceLatencyBenchmarks';

const tracker = new VoiceLatencyTracker(sessionId);
tracker.startPhase('stt');
// ... STT processing
tracker.endPhase('stt');

tracker.startPhase('reasoning');
// ... LLM processing
tracker.endPhase('reasoning');

const report = tracker.generateReport();
if (!report.allTargetsMet) {
    console.warn('Latency targets not met:', report.recommendations);
}
```

