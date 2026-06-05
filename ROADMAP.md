# GaggiGo MVP Roadmap

## Current Status

GaggiGo is an offline-first observer frontend and local mirror layer for GaggiMate.

Core cache-first architecture is implemented, validated, and stable.

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
= archive layer
= future safe sync client
```

The project has moved beyond analyzer/history recovery, hardening, and archive engine implementation.

Current phase:

```text
Archive UX Phase
```

---

## Phase 1 — Safety + Live Observer Frontend

Status: Complete.

---

## Phase 2 — Offline-First Behaviour + Cache Mirror Stabilisation

Status: Complete.

Validated:

* profiles online/offline
* history online/offline
* analyzer online/offline
* statistics from cached payloads
* hydration-once behaviour
* reconnect lifecycle
* duplicate prevention
* cache-first rendering
* settings snapshot fallback
* IndexedDB persistence authority

Hardening completed:

* offline empty-state polish
* cache/source indicator review
* terminal/proxy noise review
* dead-code audit
* ApiService boundary mapping
* LocalCacheService removal
* localStorage persistence removal

---

## Phase 3 — Archive Architecture & Validation

Status: Complete.

Authoritative documents:

```text
project-docs/BACKUP_AND_ARCHIVE_STRATEGY.md
project-docs/ARCHIVE_ARCHITECTURE_SPECIFICATION.md
project-docs/API_SERVICE_BOUNDARY_MAP.md
```

Approved archive direction remains defined by:

```text
project-docs/ARCHIVE_ARCHITECTURE_SPECIFICATION.md
```

Completed architecture and validation decisions:

* archive format is `.gaggigo.zip`
* archive facts, recompute insights
* generated videos are export artefacts, not archive source data
* raw shot data is the replay source
* GaggiMate-compatible profile JSON remains first-class
* all profiles are preserved, including utility profiles
* archive import is separate from existing profile import
* existing `.json` / `.tcl` profile import remains unchanged
* archive import rehydrates GaggiGo only
* profile restore from archive is explicit and restore-as-copy
* merge-only restore
* duplicate skipping and reporting
* idempotent imports
* automatic integrity verification
* archive health model
* local archive != backup
* single archive authority
* 6-month hot mirror
* 6-month archive bundle cadence
* sampled normal, long, and extreme shot payloads for architecture planning

Validation completed:

* runtime validation matrix review
* pre-sync readiness review
* archive ownership validation
* archive import boundary validation
* archive identity validation
* archive manifest validation
* storage projection review
* archive implementation audit
* end-to-end archive engine audit

Archive architecture phase is complete.

---

## Phase 4 — Safe Sync

Status: Blocked.

Sync work must not begin until:

* archive UX is complete
* archive runtime validation is complete
* archive measurements remain valid
* shot identity remains validated
* manifest schema remains stable
* local mirror behaviour remains deterministic

Initial sync scope when unblocked:

* notes
* ratings
* safe metadata
* profile drafts
* manual sync workflow

Do not start with:

* automatic two-way profile sync
* machine configuration sync
* machine restoration sync
* conflict-heavy sync behaviour
* unrestricted mutation

---

## Phase 5 — Archive UX

Status: Active.

Archive engine implementation is complete.

Current implementation includes:

* ArchiveService
* ArchiveValidationService
* ArchiveHealthService
* ArchiveExportService
* ArchiveZipService
* ArchiveZipImportService
* ArchiveImportValidationService
* ArchiveImportService
* ArchiveMergeService
* ArchiveExecutionService

Archive engine audit status:

```text
ZIP export        PASS
ZIP import        PASS
Validation        PASS
Health            PASS
Preview           PASS
Merge plan        PASS
Execution         PASS
Repository audit  PASS
```

Current UX implementation order:

1. Archive Export UI
2. Archive Import UI
3. Archive Browser
4. Archive Management Views
5. Runtime archive validation

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

* performance optimisation
* statistics indexing improvements
* installable PWA behaviour
* packaging/distribution
* runtime cleanup
* end-to-end testing
* feature gating/app-mode architecture

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

* brew control
* grinder control
* scales control
* PID/autotune
* OTA
* Bluetooth device management
* raw websocket admin
* unrestricted settings writes

Merge-back compatibility remains a hard requirement.
