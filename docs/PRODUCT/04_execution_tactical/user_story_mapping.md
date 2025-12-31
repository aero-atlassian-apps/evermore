# Evermore User Story Mapping

> Feature prioritization by release, organized around user activities.

---

## Backbone: Senior User Activities

```
┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│   DISCOVER   │   ONBOARD    │    CONVERSE  │   REMEMBER   │    SHARE     │
│              │              │              │              │              │
│  Learn about │  Set up and  │  Have voice  │  Evermore past │  Know family │
│   Evermore   │  first use   │ conversations│   stories    │  received it │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

---

## Walking Skeleton (MVP Core)

The minimum viable path through all activities:

| Activity | Story |
|----------|-------|
| Discover | As a senior, I receive Evermore as a gift from my family |
| Onboard | As a senior, I complete voice-guided setup in under 5 minutes |
| Converse | As a senior, I have a 10+ minute conversation where I share a story |
| Remember | As a senior, Evermore references something I said in a previous session |
| Share | As a senior, I know my family can see my stories in their dashboard |

---

## Release 1: MVP (Launch)

### Discover

| Priority | Story |
|----------|-------|
| P0 | Family member purchases and gifts Evermore subscription |
| P0 | Senior receives welcome email/message from family |

### Onboard

| Priority | Story |
|----------|-------|
| P0 | Senior completes voice-guided onboarding (name, preferences) |
| P0 | Senior hears Evermore's introduction and personality |
| P1 | Senior sets preferred time of day for prompts |

### Converse

| Priority | Story |
|----------|-------|
| P0 | Senior initiates conversation via voice command |
| P0 | Evermore asks open-ended, patient questions |
| P0 | Evermore responds empathetically to emotional content |
| P0 | Session is transcribed and stored |
| P1 | Session includes natural pacing and pauses |
| P1 | Senior can pause and resume mid-session |

### Remember

| Priority | Story |
|----------|-------|
| P0 | Evermore stores facts in semantic memory |
| P0 | Evermore references past stories in new conversations |
| P1 | Senior can ask "What have I told you about my mother?" |

### Share

| Priority | Story |
|----------|-------|
| P0 | Family views story transcripts in dashboard |
| P0 | Family sees engagement activity (sessions, duration) |
| P1 | Family receives weekly digest email |

### Story Management (Refinements)

| Priority | Story |
|----------|-------|
| P0 | Senior can delete a story they don't want to keep |
| P0 | Senior can mark a story as a Favorite for quick access |
| P0 | Senior can view a filtered list of Favorite stories |

### Safety

| Priority | Story |
|----------|-------|
| P0 | Evermore detects potential scam language and warns senior |
| P0 | Evermore detects crisis/distress markers and responds appropriately |
| P0 | Evermore never provides medical advice |

---

## Release 2: Family Engagement (v1.1)

### Enhanced Sharing

| Priority | Story |
|----------|-------|
| P0 | Family uploads photos that trigger senior's next session |
| P0 | Senior sees family-contributed photo and tells related story |
| P1 | Family suggests topics for Evermore to explore |
| P1 | Family adds context/notes to captured stories |

### Enhanced Dashboard

| Priority | Story |
|----------|-------|
| P0 | Family searches across all captured stories |
| P1 | Family tags stories by theme (childhood, career, travel) |
| P1 | Family shares individual stories with extended family |

### Engagement Loops

| Priority | Story |
|----------|-------|
| P1 | Senior receives gentle daily prompt if inactive |
| P1 | Family receives "New story" notification |
| P2 | Family sends audio message to senior via Evermore |

---

## Release 3: Story Organization (v1.2)

### Chapters

| Priority | Story |
|----------|-------|
| P0 | Stories are auto-organized into life chapters |
| P0 | Senior can guide chapter creation ("Let's talk about my career") |
| P1 | Family views story timeline by life period |

### Legacy Features

| Priority | Story |
|----------|-------|
| P1 | Family exports complete story archive |
| P2 | Family orders printed story book |
| P2 | Family generates video memorial with stories and photos |

### Advanced Memory

| Priority | Story |
|----------|-------|
| P1 | Evermore connects related stories across sessions |
| P1 | Evermore notices gaps and proactively asks filling questions |
| P2 | Senior reviews and corrects stored facts |

---

## Backbone: Family User Activities

```
┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│   PURCHASE   │    SETUP     │   MONITOR    │  CONTRIBUTE  │   PRESERVE   │
│              │              │              │              │              │
│ Buy for      │ Help parent  │ Track engage-│ Add photos & │ Export and   │
│ parent       │ get started  │ ment, safety │ prompts      │ share legacy │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

---

## Story Map Visualization

```
                    MVP                    v1.1                v1.2
                    │                      │                   │
DISCOVER            │ Gift subscription    │                   │
────────────────────┼──────────────────────┼───────────────────┤
                    │                      │                   │
ONBOARD             │ Voice setup          │                   │ 
                    │ Introduction         │                   │
────────────────────┼──────────────────────┼───────────────────┤
                    │                      │                   │
CONVERSE            │ Voice conversation   │ Photo triggers    │ Guided chapters
                    │ Empathetic responses │ Topic suggestions │ Gap detection
────────────────────┼──────────────────────┼───────────────────┤
                    │                      │                   │
REMEMBER            │ Semantic memory      │ Story connections │ Fact review
                    │ Past references      │                   │
────────────────────┼──────────────────────┼───────────────────┤
                    │                      │                   │
SHARE               │ Dashboard view       │ Photo uploads     │ Archive export
                    │ Story transcripts    │ Family sharing    │ Printed books
────────────────────┼──────────────────────┼───────────────────┤
                    │                      │                   │
SAFETY              │ Scam detection       │                   │
                    │ Crisis intervention  │                   │
```

---

## Dependencies

| Story | Depends On |
|-------|------------|
| Photo triggers | Photo upload capability |
| Past references | Semantic memory system |
| Story search | Story storage and indexing |
| Printed books | Archive export |
