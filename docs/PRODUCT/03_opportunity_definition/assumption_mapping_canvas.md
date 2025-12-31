# Evermore Assumption Mapping Canvas

---

## Purpose

This canvas maps the key assumptions underlying Evermore's product and business model. Assumptions are categorized by risk and importance to guide validation priorities.

---

## Assumption Map

```
                        HIGH IMPORTANCE
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        │   VALIDATE NOW      │   VALIDATE NEXT     │
        │   (Leap of Faith)   │   (Strategic Bets)  │
        │                     │                     │
        │   A1, A2, A3        │   A6, A7            │
        │                     │                     │
HIGH ───┼─────────────────────┼─────────────────────┼─── LOW
RISK    │                     │                     │    RISK
        │   MONITOR           │   DEPRIORITIZE      │
        │   (Risky but minor) │   (Safe to assume)  │
        │                     │                     │
        │   A4, A5            │   A8, A9            │
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                        LOW IMPORTANCE
```

---

## Assumptions Inventory

### Validate Now (High Risk, High Importance)

#### A1: Seniors will talk to an AI

| Dimension | Detail |
|-----------|--------|
| Assumption | Seniors will engage in meaningful voice conversations with an AI system, sharing personal stories |
| Why important | Core product premise; if false, product fails |
| Risk level | High—limited precedent for this demographic |
| Validation method | Pilot with 50 seniors; measure session completion and return rate |
| Success criteria | >60% complete first session, >40% return within 7 days |
| Status | **Unvalidated** |

#### A2: Voice-first is preferable to typing

| Dimension | Detail |
|-----------|--------|
| Assumption | Seniors strongly prefer voice interaction over any text-based interface |
| Why important | Core UX decision; determines entire product architecture |
| Risk level | High—based on general accessibility claims, not product-specific data |
| Validation method | A/B test voice vs. hybrid interface with 100 seniors |
| Success criteria | Voice engagement >2x typing engagement |
| Status | **Unvalidated** |

#### A3: Families will pay for a senior service

| Dimension | Detail |
|-----------|--------|
| Assumption | Adult children will pay $20/month for a service that engages their senior parent |
| Why important | Revenue model depends on family as payer |
| Risk level | High—senior market has high willingness-to-try, low willingness-to-pay history |
| Validation method | Pre-launch signup with pricing, beta conversion test |
| Success criteria | >10% of trial families convert to paid |
| Status | **Unvalidated** |

---

### Validate Next (Low Risk, High Importance)

#### A6: Stories have long-term value

| Dimension | Detail |
|-----------|--------|
| Assumption | Captured stories remain valuable to families over years, not just during senior's lifetime |
| Why important | Legacy value proposition; LTV dependent on long-term retention |
| Risk level | Medium—emotionally intuitive but not tested |
| Validation method | Cohort analysis: do families maintain access after 12+ months? |
| Success criteria | >50% of accounts remain active 18 months post-signup |
| Status | **Unvalidated** |

#### A7: Photo triggers work

| Dimension | Detail |
|-----------|--------|
| Assumption | Sending photos to seniors effectively triggers story-sharing |
| Why important | Key engagement mechanism for family participation |
| Risk level | Low—supported by memory research on visual cues |
| Validation method | Track session quality when photos present vs. absent |
| Success criteria | Photo-triggered sessions produce 2x more story content |
| Status | **Unvalidated** |

---

### Monitor (High Risk, Low Importance)

#### A4: B2B is viable

| Dimension | Detail |
|-----------|--------|
| Assumption | Senior care facilities will pay for resident engagement tools |
| Why important | Potential revenue diversification |
| Risk level | High—long sales cycles, procurement complexity |
| Validation method | 10 facility discovery calls |
| Success criteria | 3+ facilities express budget and intent |
| Status | **Future validation** |

#### A5: Daily prompts don't annoy users

| Dimension | Detail |
|-----------|--------|
| Assumption | Proactive AI outreach is welcomed, not intrusive |
| Why important | Engagement mechanism |
| Risk level | Medium—could backfire if perceived as nagging |
| Validation method | Track response rate and explicit opt-outs |
| Success criteria | <10% disable prompts; >30% respond positively |
| Status | **Unvalidated** |

---

### Deprioritize (Low Risk, Low Importance)

#### A8: Users want printed books

| Dimension | Detail |
|-----------|--------|
| Assumption | Families will pay extra for printed story compilations |
| Why important | Potential upsell revenue |
| Risk level | Low—standard in oral history market |
| Validation method | Survey at beta launch |
| Success criteria | >30% express high interest |
| Status | **Future validation** |

#### A9: Multi-language is essential early

| Dimension | Detail |
|-----------|--------|
| Assumption | Non-English speakers represent significant early demand |
| Why important | Market expansion potential |
| Risk level | Low—can add later without re-architecture |
| Validation method | Analyze inbound interest by language |
| Success criteria | >15% of signups request non-English |
| Status | **Future validation** |

---

## Validation Plan

### Phase 1: Pre-Launch (Weeks 1-4)

| Assumption | Method | Owner |
|------------|--------|-------|
| A1: Seniors talk to AI | 50-senior pilot | Product |
| A2: Voice preference | A/B test | UX |
| A3: Families pay | Pre-launch pricing page | Growth |

### Phase 2: Beta (Weeks 5-12)

| Assumption | Method | Owner |
|------------|--------|-------|
| A5: Prompts accepted | In-product analytics | Product |
| A7: Photo triggers | Content analysis | Product |

### Phase 3: Post-Launch (Months 3-6)

| Assumption | Method | Owner |
|------------|--------|-------|
| A6: Long-term value | Cohort retention | Analytics |
| A4: B2B viability | Sales discovery | Business Dev |

---

## Leap of Faith Summary

If any of these prove false, the product requires significant pivot:

| Assumption | Pivot if false |
|------------|----------------|
| Seniors talk to AI | Shift to human-assisted model |
| Families pay | Shift to B2B-first or ad-supported |
| Voice preference | Add hybrid text/voice interface |
