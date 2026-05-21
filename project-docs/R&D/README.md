# R&D Workspace

## Purpose

The R&D folder is a structured architectural memory area for candidate ideas, ecosystem concepts, telemetry models, and future directions discovered during active development.

This folder exists to preserve important discoveries without polluting the active roadmap or contaminating implementation threads.

---

# Important Distinction

R&D documents are:

- research
- parked ideas
- ecosystem concepts
- architecture candidates
- future possibilities

R&D documents are NOT:

- active roadmap work
- implementation requirements
- build instructions
- automatic commitments

---

# Current Active Development Phase

Current real roadmap work remains:

```text
cleanup + hardening before sync
```

Always read before using R&D docs:

- CURRENT_STATE.md
- ROADMAP.md
- latest handover card

The active roadmap always overrides R&D ideas.

---

# Core Engineering Rules

1. Prefer extending existing systems over creating new systems.
2. Do not redesign stable shell/layout unnecessarily.
3. Preserve separation of responsibilities between repos.
4. Avoid merging repos into one monolith.
5. Shared contracts are preferred over duplicated implementations.
6. GaggiGo remains observer-first.
7. GaggiMate remains runtime authority.
8. Cleanup/hardening takes priority over feature expansion.

---

# Ecosystem Separation Model

```text
GaggiMate
= runtime authority
= machine controller

GaggiBre
= adaptive intelligence
= telemetry enrichment

GaggiGo
= offline telemetry workspace
= analysis/cache/statistics frontend

GaggiStop
= weight telemetry node

GaggiCore (future candidate)
= shared contracts/specifications
```

---

# Recommended R&D Structure

```text
R&D/
├── README.md
├── FEATURE_MAP.md
├── ECOSYSTEM_IDEAS.md
├── LOCAL_FIRST_ARCHITECTURE.md
├── TELEMETRY_CONTRACTS_IDEAS.md
├── GAGGIBRE_INTEGRATION.md
├── GAGGISTOP_INTEGRATION.md
├── SHOT_INTELLIGENCE_IDEAS.md
└── PARKED/
```

---

# R&D Status Labels

Use one of the following statuses at the top of every R&D document.

```text
Research
Candidate
Parked
Experimental
Rejected
Archived
```

Example:

```text
Status: Candidate
```

---

# Suggested R&D Template

Example JSON-style structure:

```json
{
  "documentType": "R&D Idea",
  "status": "Parked",
  "category": "Telemetry",
  "affects": [
    "GaggiGo",
    "GaggiBre"
  ],
  "requires": [
    "Shared telemetry contracts"
  ],
  "priority": "Low",
  "implementationState": "Not Started",
  "notes": [
    "Architecture candidate only",
    "Not current roadmap work"
  ]
}
```

---

# How Ideas Graduate Into Roadmap Work

Ideas only move from R&D into roadmap when:

1. architecture is stable
2. cleanup/hardening phase is complete
3. implementation boundaries are understood
4. repo responsibility remains clear
5. explicit decision is made

Until then:

```text
R&D stays parked.
```

---

# Important Final Rule

R&D exists to preserve:

```text
vision
```

without destroying:

```text
focus
```
