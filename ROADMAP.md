# GaggiGo MVP Roadmap

## Current Status

GaggiGo is an offline-first observer frontend and local mirror layer for GaggiMate.

Core cache-first architecture direction is now functioning.

```text
GaggiMate
= runtime owner
= telemetry source
= machine authority
= rolling operational datastore

GaggiGo
= offline-first observer frontend
= local IndexedDB mirror
= historical viewer
= analyzer/statistics workspace
= persistent archive layer later
= safe sync client later
```

The project has now moved out of broad analyzer/history regression territory and into cleanup + hardening before sync.

---

## Phase 1 — Safety + Live Observer Frontend

Status: complete.

Completed:

- responsive shell retained
- desktop sidebar retained
- mobile dropdown retained
- safe informational homepage
- unsafe/admin-oriented routes removed from active GaggiGo shell
- websocket integration
- live proxy integration
- LibraryService abstraction reused
- safe observer frontend direction established
- Settings retained as filtered read-only viewer
- SafeGaggiMateClient integration

Merge-back direction:

- long term this should become app mode / feature gating rather than permanent upstream deletion.

---

## Phase 2 — Offline-First Behaviour + Cache Mirror Stabilisation

Status: core architecture stable, hardening ongoing.

Current architecture:

```text
GaggiMate API/WebSocket
↓
hydration/import path
↓
IndexedDB local mirror
↓
LibraryService
↓
History / Analyzer / Statistics / Profiles
```

Integrated and confirmed:

- fast offline UI boot
- cached startup behaviour
- shot history cache fallback
- analyzer cache fallback
- full shot payload hydration into IndexedDB
- profile cache fallback
- live profile refresh path
- settings snapshot fallback
- cache-first rendering model
- source/cache indicators
- safe websocket request classification
- safe profile operation wrapping
- ApiService hardening pass
- repository audit pass
- statistics cache-only payload reads
- statistics missing-payload reporting
- deterministic mirrored GaggiMate profile snapshots
- offline profile consistency model

Critical architecture fixes completed:

```text
hydrateGaggiMateShotIndex()
→ hydrates missing .slog payloads into IndexedDB

replaceCachedGaggiMateProfiles()
→ replaces stale mirrored profile snapshots
→ preserves browser/import profiles
```

This allows:

- offline analyzer graphs
- local full-payload persistence
- cache-first statistics direction
- deterministic offline profile behaviour
- proper mirror behaviour

Recent fixes completed:

- fixed metadata-only payload handling
- fixed analyzer empty-sample detection
- fixed cached GaggiMate analyzer routing
- fixed shot history hydration timing
- fixed live profile preference while connected
- added eager full-payload hydration during cache refresh
- removed lazy live statistics payload loading
- added statistics missing-payload warnings
- replaced stale mirrored profile accumulation

---

## Current Hardening Targets

Still actively being stabilised:

1. Connected/offline/reconnect workflow validation.
2. Offline empty-state polish.
3. Cache/source indicator clarity.
4. Terminal/proxy noise reduction.
5. Dead-code audit.
6. ApiService safe-boundary mapping.
7. Backup/archive architecture review before implementation.
8. Runtime validation matrix across refresh/reopen/offline transitions.

Rules:

```text
No sync work before hardening completes.
No new product features before hardening completes.
No parallel cache architecture.
No backup/archive implementation before architecture review.
```

---

## Phase 3 — Persistent Mirror + Archive Layer

Status: architecture planning.

Direction:

```text
GaggiMate
= live authoritative rolling datastore

GaggiGo
= hydrated mirror node
= persistent archive
= continuity/recovery layer
```

Planned:

- rolling 3-month hot mirror
- monthly cold archive strategy
- optional 6-month archive consolidation later
- firmware-update continuity prompts
- backup/export architecture
- archive search/view behaviour
- restore workflows
- storage pressure handling
- archive schema/version manifests

Important rules:

```text
Hydration is the sync model.
ESP32 rotation deletion must not delete archived GaggiGo history.
Restore/import actions must remain explicit.
Reuse existing GaggiMate export/import flows where possible.
```

See:

```text
project-docs/BACKUP_AND_ARCHIVE_STRATEGY.md
```

---

## Phase 4 — Safe Sync

Status: blocked behind hardening validation.

Sync work must not begin until:

- connected/offline/reconnect behaviour is validated.
- profile cache behaviour is stable.
- no unexpected ApiService warnings remain.
- local mirror behaviour is deterministic.
- archive architecture is stable.
- restore model is defined.

Initial sync scope when unblocked:

- notes
- ratings
- safe metadata
- profile drafts
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
- unrestricted live mutation

---

## Phase 5 — Hardening / PWA / Packaging

Status: planned.

Planned:

- remove inherited dead services
- statistics indexing improvements
- performance optimisation
- installable PWA behaviour
- packaging/distribution
- runtime cleanup
- end-to-end testing
- feature-gating/app-mode architecture

---

## Architectural Direction

```text
GaggiMate
= machine controller
= telemetry authority
= runtime owner
= rolling operational datastore

GaggiGo
= observer frontend
= analysis layer
= offline-first workspace
= historical viewer
= local mirror
= persistent archive layer later
= safe sync client later
```

Important implementation rule:

```text
GaggiMate controls the machine.
GaggiGo observes, stores, analyses, archives, and later syncs safe data.
```

Do not reintroduce:

- brew control
- grinder control
- scales control
- PID/autotune
- OTA
- Bluetooth device management
- raw websocket admin
- unrestricted settings writes

Merge-back compatibility remains a hard requirement.
