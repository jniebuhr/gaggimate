# Local-First Architecture

Status: Candidate

This document captures the local-first architectural direction discovered during the GaggiGo MVP work.

---

# Core Discovery

Cache-first telemetry rendering feels dramatically faster and more responsive than live-only embedded machine UI.

This changes the experience from:

```text
embedded web UI lag
```

into:

```text
native-feeling telemetry workspace
```

---

# Core Model

```text
GaggiMate
= runtime authority
= telemetry source

GaggiGo
= local-first telemetry workspace
```

Meaning:

- render cached data first
- refresh live in background
- preserve offline access automatically
- avoid blocking UI on live machine responses

---

# Current Behaviour

Connected:

```text
show live data
mirror locally
```

Disconnected:

```text
show cached data
allow offline viewing/analyzer/statistics/settings
```

---

# Future Candidate Direction

Potential future architecture:

```text
connect once
↓
pull safe telemetry
↓
store locally
↓
work offline anytime
```

Examples:

- phone cache
- laptop cache
- tablet cache

No mandatory cloud dependency.

---

# Sync Philosophy

Potential future direction:

```text
device-first
sync optional
```

Not:

```text
cloud-first mandatory accounts
```

Potential stages:

1. local-only
2. export/import
3. same-network sync
4. optional safe sync later

---

# Export / Import Concepts

Status: Candidate

Potential portable bundles:

- shot package
- profile package
- telemetry archive
- replay package
- local vault backup

Potential uses:

- migration
- backup
- sharing
- offline archive
- regression fixtures

---

# Telemetry Storage Scaling

Status: Candidate

Long-term telemetry storage may eventually require:

- sample decimation
- archive mode
- compressed telemetry
- historical summaries
- storage cleanup policies

Reason:

High-frequency telemetry datasets will grow rapidly over years of use.

---

# Event Timeline Model

Status: Candidate

A unified event system may become a core architecture layer.

Potential event types:

- shot_start
- shot_stop
- phase_start
- phase_end
- adaptive_correction
- channeling_detected
- scale_disconnect
- user_annotation
- sensor_warning

Potential uses:

- replay
- telemetry debugging
- historical intelligence
- export packages
- clustering
- timeline views

---

# Observer Security Boundary

Status: Candidate

The observer boundary should remain explicit.

GaggiGo may:

- cache
- analyse
- visualise
- compare
- synchronise safe telemetry

GaggiGo should not:

- directly control brewing
- perform firmware management
- expose unrestricted admin surfaces
- become runtime authority

GaggiMate remains runtime authority.
