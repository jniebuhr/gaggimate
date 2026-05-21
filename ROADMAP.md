# GaggiGo MVP Roadmap

## Current Status

GaggiGo is now a working offline-first observer frontend for GaggiMate.

Confirmed working:

- live GaggiMate connection through local Vite proxy
- profiles loading from GaggiMate
- shot history loading from GaggiMate
- IndexedDB persistence
- cached profile mirror
- cached shot mirror
- offline history fallback
- offline shot analyzer routing
- offline statistics from cached data
- read-only GaggiMate settings viewer
- cached settings snapshot fallback
- unsafe machine/integration settings filtered from Settings

---

## Phase 1 — Safety + Live Observer Frontend

Status: complete.

Completed:

- responsive shell retained
- desktop sidebar retained
- mobile dropdown retained
- safe informational homepage
- unsafe routes removed
- unsafe navigation removed
- live proxy integration
- websocket integration
- LibraryService abstraction reused
- ShotHistory migrated onto unified data layer
- Settings restored as read-only GaggiMate settings viewer
- System Preferences and plugin/integration settings removed from Settings view

GaggiGo remains observer-only.

No:

- brew control
- grinder control
- PID control
- OTA
- firmware management
- machine admin
- external integration management

---

## Phase 2 — Offline-First Behaviour

Status: mostly complete for read/view/analyse MVP.

Current architecture:

```text
Browser
↓
LibraryService
↓
GaggiMate + IndexedDB
```

Completed:

- cached startup behaviour
- background live refresh attempts
- fast offline UI boot
- profile cache fallback
- shot history cache fallback
- analyzer cache fallback
- statistics cache fallback
- settings snapshot fallback

Remaining:

- improve offline empty states
- reduce remaining terminal proxy noise
- add cache status indicators where useful
- continue performance cleanup

---

## Phase 3 — Safe Sync

Status: planned.

Potential sync targets:

- notes
- ratings
- profile drafts
- safe metadata

Planned behaviour:

- dirty-state tracking
- manual sync queue
- safe merge behaviour
- export/import tooling

Never sync machine-control actions.

---

## Phase 4 — Hardening

Status: planned.

Planned:

- search for and remove sensitive data
- remove inherited dead services
- unify source handling further
- improve statistics indexing
- performance optimisation
- PWA behaviour
- packaging/distribution
- runtime cleanup
- end-to-end testing

---

## Architectural Direction

GaggiMate:

- machine runtime
- control layer
- telemetry source
- source authority

GaggiGo:

- observer frontend
- analysis layer
- historical viewer
- cache layer
- offline-first workspace
- safe sync client later
