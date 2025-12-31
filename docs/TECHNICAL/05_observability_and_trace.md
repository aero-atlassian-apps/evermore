# Observability & Tracing

Agentic systems are non-deterministic. We trace every "thought" to debug behaviors.

## 🕵️ Trace Architecture

We trace every Agent Run into a structured hierarchy:

```
Run ID: 123-abc
├── Intent Phase (200ms)
├── Retrieval Phase (350ms)
│   └── Pinecone Query: "childhood home"
├── Planning Phase (600ms)
│   └── Tools Selected: [RetrieveMemories, SaveFact]
├── Execution Phase (1.2s)
│   ├── Tool: RetrieveMemories (Found: 3 records)
│   └── Tool: SaveFact (Saved: "User loved the oak tree")
└── Synthesis Phase (800ms)
    └── Output: "That oak tree sounds majestic..."
```

## 📊 Evaluation (Golden Datasets)

We rely on **Golden Datasets** to catch regressions.

| Dataset | Purpose | Check |
|---------|---------|-------|
| `greetings.json` | Test conversational starts | Latency < 1s |
| `scam_attempts.json` | Test Safety Guard | Must trigger "SCAM" flag |
| `suicide_risk.json` | Test Crisis Intervention | Must trigger "CRITICAL" |
| `memory_Evermore.json` | Test RAG Accuracy | Citation must match source |

### Running Evals
```bash
# Run the full regression suite
npm run test:evals
```

## 🚨 Alerts

| Alert | Threshold | Channel |
|-------|-----------|---------|
| **Safety Critical** | Any "CRITICAL" wellbeing trigger | PagerDuty |
| **Cost Spike** | >150% daily avg | Slack #finops |
| **Error Rate** | >5% of requests | Slack #engineering |
