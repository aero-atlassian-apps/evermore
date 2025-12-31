# Security & Safety Guardrails

Security is a prerequisite, not a feature. Evermore protects vulnerable senior users through a multi-layered defense system.

## 🛡️ Threat Model

| Asset | Risk Level | Protection |
|-------|------------|------------|
| **Life Stories** | High | Row-level security (Only Owner + Family can read) |
| **PII/Identity** | Critical | Input scanning, never sent to LLM if detected |
| **Wallet/Bank** | Critical | Financial advice strictly blocked |

---

## 🚨 Wellbeing Guard

The `WellbeingGuard` monitors every interaction for 12 core risks.

| Risk Category | Severity | Response |
|---------------|----------|----------|
| **Crisis** (Self-harm) | CRITICAL | Immediate halt. Provide crisis resources. User cannot continue. |
| **Scam** (Money request) | HIGH | Warning issued. Topic shift mandated. |
| **Distress** (Confusion) | MEDIUM | Simplify language. Suggest taking a break. |
| **Medical** (Symptoms) | MEDIUM | "I cannot give medical advice. Please call your doctor." |

---

## 👮 Input/Output Safety

### Input Scanning
1. **Prompt Injection**: "Ignore previous instructions" is detected and sanitized.
2. **PII Filters**: Credit card and SSN patterns are redacted before LLM context.

### Tool Permissions
- **READ_ONLY**: `RetrieveMemories` (Auto-approved)
- **READ_WRITE**: `SaveFact` (Auto-approved)
- **SENSITIVE**: `NotifyFamily` (Requires explicit user confirmation)

### Hallucination Detection
Every generated Chapter runs through a **Judge LLM**:
- **Input**: Source Transcript + Generated Text.
- **Task**: "Find claims in Text not supported by Transcript".
- **Action**: If hallucinations found -> Regenerate or Flag for review.
