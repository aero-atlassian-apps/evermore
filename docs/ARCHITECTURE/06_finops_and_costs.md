# FinOps & Cost Management

Evermore implements a strict financial operating model to ensure economic sustainability.

## 💰 Unit Economics

| Metric | Est. Value |
|--------|------------|
| Revenue per session | ~$0.50 (Subscription/usage based) |
| Cost per session | ~$0.003 (Token costs) |
| **Gross Margin** | **~99%** |

### Cost Breakdown (Per Session)

| Phase | Model | Avg Tokens | Est. Cost |
|-------|-------|------------|-----------|
| Intent | Gemini 1.5 Flash | 500 | $0.0001 |
| Planning | Gemini 1.5 Pro | 800 | $0.0012 |
| Execution | Flash (Tools) | 1,200 | $0.0003 |
| Reflection | Gemini 1.5 Pro | 600 | $0.0009 |
| Synthesis | Gemini 1.5 Flash | 400 | $0.0001 |

---

## 🚦 Model Routing Strategy

The `ModelRouter` dynamically selects models based on task complexity.

| Task Type | Model Tier | Why? |
|-----------|------------|------|
| **Classification** (Intent) | **Flash** | Speed/Cost, high accuracy on simple tasks. |
| **Extraction** (Entities) | **Flash** | Low reasoning requirement. |
| **Reasoning** (Planning) | **Pro** | Requires complex logic and safety constraints. |
| **Safety** (Wellbeing) | **Pro** | Accuracy is critical for liability. |
| **Creative** (Stories) | **Pro** | Nuance and tone matching required. |

---

## 🛑 Budget Guards

The `AgentLoopMonitor` enforces hard limits to prevent "runaway agents".

### Default Limits
- **Max Cost**: $0.20 per session
- **Max Tokens**: 8,000 per session
- **Max Steps**: 5 agent loops
- **Timeout**: 30 seconds

### Graceful Degradation
- If budget < 50%: Normal operation.
- If budget < 10%: Switch to **Flash Only** and force synthesis.
