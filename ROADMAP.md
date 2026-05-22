# GaggiGo MVP Roadmap

## Current Status

GaggiGo is now a working offline-first observer frontend for GaggiMate with a documented merge-back direction.

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
- source/cache visibility indicators
- safe data boundary wrapping
- ProfileEdit safe-client migration
- ProfileList safe-client migration
- ApiService request classification
- non-web diff audit
- pre-sync validation audit

---

## Phase 1 — Safety + Live Observer Frontend

Status: complete.

Completed:

- responsive shell retained
- desktop sidebar retained
- mobile dropdown retained
- safe informational homepage
- unsafe/admin-oriented routes removed from GaggiGo shell
- unsafe/admin-oriented navigation removed from GaggiGo shell
- live proxy integration
- websocket integration
- LibraryService abstraction reused
- ShotHistory migrated onto unified data layer
- Settings restored as read-only GaggiMate settings viewer
- safe observer-mode frontend direction established

Merge-back direction:

- long term this should become app mode / feature gating rather than permanent upstream deletion.

---

## Phase 2 — Offline-First Behaviour + Hardening

Status: functionally complete for MVP.

Current architecture:

```text
Browser
↓
LibraryService
↓
SafeGaggiMateClient + IndexedDBService
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
- cache-first rendering
- source-aware loading
- source badges
- safe websocket request classification
- safe profile operation wrapping
- ApiService hardening pass
- repository audit pass
- runtime/non-web diff classification

Remaining before sync:

- final local runtime validation
- connected/offline/reconnect verification
- final profile operation verification after migration

---

## Phase 3 — Safe Sync

Status: next planned phase.

Initial sync scope:

- notes
- ratings
- profile drafts
- safe metadata
- manual sync workflow first

Planned behaviour:

- dirty-state tracking
- manual sync queue
- safe merge behaviour
- export/import tooling

Do not start with:

- automatic two-way profile sync
- machine/runtime configuration sync
- conflict-heavy sync behaviour

---

## Phase 4 — Hardening / PWA / Packaging

Status: planned.

Planned:

- remove inherited dead services
- further source unification
- performance optimisation
- statistics indexing improvements
- installable PWA behaviour
- packaging/distribution
- runtime cleanup
- end-to-end testing
- feature-gating/app-mode architecture

---

## Architectural Direction

```text
GaggiMate
= runtime owner
= telemetry source
= source authority

GaggiGo
= observer frontend
= analysis layer
= historical viewer
= offline-first workspace
= safe sync client later
```

Merge-back compatibility remains a hard requirement.
