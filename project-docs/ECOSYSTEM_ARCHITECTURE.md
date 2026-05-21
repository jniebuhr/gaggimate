# Gaggi Ecosystem Architecture

## Purpose

This document captures the long-term ecosystem direction discovered during the GaggiGo offline-first MVP work.

These are architectural direction notes and candidate concepts.

This document is not an implementation roadmap.

---

# Core Separation Model

## GaggiMate

Role:

- machine runtime
- realtime controller
- telemetry source
- source authority
- machine safety layer

Responsibilities:

- brewing
- PID/runtime control
- pump control
- steam/water control
- live telemetry generation
- machine execution
- safety shutdown logic

GaggiMate remains the authority.

---

## GaggiBre

Role:

- adaptive intelligence layer
- advanced brew runtime
- experimental control logic
- telemetry enrichment

Potential responsibilities:

- adaptive brew controller
- channeling detection
- adaptive pressure/flow correction
- advanced telemetry events
- experimental runtime logic

Important:

GaggiBre should generate intelligence and telemetry metadata.

It should not become the historical analysis workspace.

---

## GaggiGo

Role:

- offline-first observer frontend
- local cache layer
- historical analysis workspace
- statistics frontend
- telemetry viewer
- safe sync client later

Responsibilities:

- profile viewing
- shot history
- shot analysis
- statistics
- offline viewing
- local persistence
- cache-first rendering
- future safe sync

GaggiGo intentionally avoids:

- machine control
- firmware management
- unrestricted admin surfaces
- runtime authority

Long-term candidate direction:

GaggiGo may become the primary user-facing telemetry frontend even while online.

Meaning:

- render local-first
- refresh live in background
- use cache-first behaviour
- preserve offline functionality automatically

---

## GaggiStop

Role:

- weight telemetry node
- scale hardware runtime
- telemetry peripheral

Responsibilities:

- weight measurement
- HX711 filtering
- telemetry packets
- websocket streaming
- brew-by-weight telemetry

Important:

GaggiStop should not own machine stop logic.

Machine stop logic belongs inside GaggiMate runtime.

GaggiGo may later visualise and analyse scale telemetry.

---

# Shared Ecosystem Direction

## Important Discovery

The ecosystem should not merge into one monolithic repo.

Better direction:

- shared telemetry contracts
- shared profile schema
- shared shot-history schema
- shared metadata contracts

This allows:

- GaggiBre to generate intelligence
- GaggiMate to execute safely
- GaggiStop to generate telemetry
- GaggiGo to analyse/store/synchronise

without collapsing responsibilities together.

---

# Long-Term Candidate Direction

Potential future ecosystem architecture:

```text
GaggiStop
→ weight telemetry

GaggiMate
→ machine telemetry
→ runtime authority

GaggiBre
→ adaptive intelligence
→ telemetry enrichment

GaggiGo
→ unified telemetry workspace
→ cache
→ analysis
→ statistics
→ historical review
→ safe sync
```

---

# Current Reality

Current active development phase remains:

```text
cleanup + hardening before sync
```

These ecosystem notes are architectural parking only.

They are not immediate implementation instructions.
