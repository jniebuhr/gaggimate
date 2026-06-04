# GaggiGo MVP Roadmap

## Current Status

GaggiGo is an offline-first observer frontend and local mirror layer for GaggiMate.

Core cache-first architecture direction is functioning and validated.

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

The project has moved beyond analyzer/history recovery and hardening.

Current phase:

```text
Archive pre-implementation review.
```

---

## Phase 1 — Safety + Live Observer Frontend

Status: Complete.

---

## Phase 2 — Offline-First Behaviour + Cache Mirror Stabilisation

Status: Complete.

Validated:

- profiles online/offline
- history online/offline
- analyzer online/offline
- statistics from cached payloads
- hydration-once behaviour
- reconnect lifecycle
- duplicate prevention
- cache-first rendering
- settings snapshot fallback
- IndexedDB persistence authority

Hardening completed:

- offline empty-state polish
- cache/source indicator review
- terminal/proxy noise review
- dead-code audit
- ApiService boundary mapping
- LocalCacheService removal
- localStorage persistence removal

---

## Phase 3 — Archive Architecture

Status: In review.

Authoritative documents:

```text
project-docs/BACKUP_AND_ARCHIVE_STRATEGY.md
project-docs/ARCHIVE_ARCHITECTURE_SPECIFICATION.md
project-docs/API_SERVICE_BOUNDARY_MAP.md
```

Approved direction:

```text
Tier 1
ESP32 rolling operational store

Tier 2
6-month IndexedDB hot mirror

Tier 3
6-month archive bundles

Tier 4
Portable exported backups
```

Completed review decisions:

- archive format is `.gaggigo.zip`
- archive facts, recompute insights
- generated videos are export artefacts, not archive source data
- raw shot data is the replay source
- GaggiMate-compatible profile JSON remains first-class
- all profiles are preserved, including utility profiles
- archive import is separate from existing profile import
- existing `.json` / `.tcl` profile import remains unchanged
- archive import rehydrates GaggiGo only
- profile restore from archive is explicit and restore-as-copy
- merge-only restore
- silent duplicate skipping
- idempotent imports
- automatic integrity verification
- archive health model
- local archive != backup
- single archive authority
- 6-month hot mirror
- 6-month archive bundle cadence
- sampled normal, long, and extreme shot payloads for architecture planning

Not approved for implementation yet.

Remaining review work:

1. Real-life storage validation with larger datasets.
2. Measure IndexedDB growth.
3. Measure browser storage behaviour.
4. Define deterministic shot identity.
5. Define archive manifest schema.
6. Complete runtime validation matrix review.
7. Validate archive import boundary against existing profile import behaviour.

Implementation must not begin until those items are complete.

---

## Phase 4 — Safe Sync

Status: Blocked.

Sync work must not begin until:

- archive architecture is stable
- archive measurements are complete
- shot identity is defined
- manifest schema is defined
- runtime validation review is complete
- local mirror behaviour remains deterministic

Initial sync scope when unblocked:

- notes
- ratings
- safe metadata
- profile drafts
- manual sync workflow

Do not start with:

- automatic two-way profile sync
- machine configuration sync
- machine restoration sync
- conflict-heavy sync behaviour
- unrestricted mutation

---

## Phase 5 — Archive Implementation

Status: Not started.

Expected implementation order:

1. Archive identity layer.
2. Manifest schema.
3. Archive storage model.
4. Archive import/export boundary layer.
5. Archive creation workflow.
6. Archive health system.
7. Export workflow.
8. Import workflow.
9. Restore-as-copy profile workflow.

Rules:

```text
Simple by default.
Deterministic by design.
Archive facts.
Recompute insights.
Protect data.
Avoid complexity.
```

---

## Phase 6 — Hardening / PWA / Packaging

Status: Planned.

Planned:

- performance optimisation
- statistics indexing improvements
- installable PWA behaviour
- packaging/distribution
- runtime cleanup
- end-to-end testing
- feature gating/app-mode architecture

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
= archive layer
= future safe sync client
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
