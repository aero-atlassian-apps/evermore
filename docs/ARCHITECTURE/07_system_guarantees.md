# Evermore System Guarantees

This document clearly states what Evermore guarantees and what it does NOT guarantee.

## ✅ What We Guarantee

### Memory & Continuity
- **Memory Bounds**: Working memory is hard-capped at 10 items and 50KB
- **Decay Control**: Episodic memories have bounded decay (max 0.8 after 30 days)
- **Session Persistence**: Sessions persist for 24 hours with Redis + fallback
- **Correction Support**: User corrections update memory confidence and create supersession chains

### Safety
- **WellbeingGuard Coverage**: 12 concern types + 10 scam types actively monitored
- **Escalation Paths**: Crisis → 988, Emergency → 911, Elder Abuse → 1-800-677-1116
- **Hallucination Detection**: All generated content can be validated against source transcripts
- **Content Safety**: PII detection, prompt injection prevention, medical advice blocking

### Failure Recovery
- **Graceful Degradation**: Every external dependency has a fallback
  - Redis → In-memory cache
  - Vector DB → Substring search
  - Image generation → Placeholder images/CSS art
  - **TTS (Server)** → **Browser Speech Synthesis** (Zero-downtime fallback)
  - **STT (Server)** → **Browser Speech Recognition** (Zero-downtime fallback)
  - **Cloud Auth Failure** → **Safe Startup Mode** (Server boots without crashing)
- **No Silent Failures**: All errors are logged; user UX degrades gracefully but remains functional.
- **No Session Corruption**: Failures never mutate session state

### Voice Experience
- **Latency Targets**: <1 second first response acknowledgment (target)
- **Silence Handling**: 10-second silence timeout with calm, encouraging prompts
- **Context Preservation**: Explicit `SpeechContext` object passed from STT → reasoning

---

## ⚠️ What We Do NOT Guarantee

### Accuracy
- **LLM Responses**: AI responses may contain errors despite hallucination detection
- **Transcript Accuracy**: Speech-to-text may misinterpret words, especially names
- **Memory Evermore**: Long-term memory retrieval is probabilistic, not guaranteed
- **Emotional Interpretation**: Voice indicators are inferred, not measured

### Availability
- **100% Uptime**: External dependencies (Google Cloud, Redis) may experience outages
- **Real-Time Performance**: Latency targets are goals, not SLAs
- **Voice Quality**: Browser-based TTS quality varies by device and browser

### Medical/Legal
- **Not Medical Advice**: Evermore explicitly blocks medical advice and symptom interpretation
- **Not Legal Advice**: No legal guidance or financial advice
- **Not Emergency Service**: Evermore may suggest calling 911 but cannot call for users

### Privacy
- **End-to-End Encryption**: Audio is processed by external STT services
- **Data Retention**: Stories and memories are stored persistently
- **Third-Party Access**: Google Cloud, Pinecone process user data

---

## 🔄 Behavioral Expectations

### Under Normal Conditions
- Response within 2 seconds (target)
- Memory retrieval from last 100 sessions
- Consistent persona across interactions
- Empathetic, clear communication style

### Under Stress
- Graceful degradation to in-memory only
- Extended response times (up to 8 seconds)
- Simplified responses if LLM unavailable
- Text-only output if TTS unavailable

### Under Failure
- Clear user messaging: "I'm having trouble right now"
- No data loss or corruption
- Automatic retry with exponential backoff
- Fallback to cached/placeholder content

---

## 📊 Monitoring & Accountability

All critical behaviors are logged and traceable:

| Event | Logged | Traceable |
|-------|--------|-----------|
| Safety alerts | ✅ | ✅ |
| Hallucination flags | ✅ | ✅ |
| Memory updates | ✅ | ✅ |
| Latency exceeds target | ✅ | ✅ |
| External service failures | ✅ | ✅ |

---

> *"If something goes wrong at 2am, we can explain it the next morning."*
