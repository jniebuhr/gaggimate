GaggiGo MVP Roadmap

Current Status

GaggiGo is an offline-first observer frontend and local mirror layer for GaggiMate.

Core cache-first architecture is implemented, validated, and stable.

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

The project has moved beyond analyzer/history recovery, hardening, archive engine implementation, archive UX planning, archive export validation, and ZIP compression hardening.

Current phase:

Archive Runtime Validation

⸻

Phase 1 — Safety + Live Observer Frontend

Status: Complete.

⸻

Phase 2 — Offline-First Behaviour + Cache Mirror Stabilisation

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

⸻

Phase 3 — Archive Architecture & Validation

Status: Complete.

Authoritative documents:

project-docs/BACKUP_AND_ARCHIVE_STRATEGY.md
project-docs/ARCHIVE_ARCHITECTURE_SPECIFICATION.md
project-docs/API_SERVICE_BOUNDARY_MAP.md

Archive architecture phase complete.
Archive engine phase complete.
Archive validation phase complete.

⸻

Phase 4 — Safe Sync

Status: Blocked.

Sync work must not begin until:

* archive UX implementation is complete
* archive runtime validation is complete
* manifest schema remains stable
* local mirror behaviour remains deterministic

⸻

Phase 5 — Archive UX + Archive Runtime Validation

Status: Active.

Completed:

* Storage page implemented
* Create Backup UI implemented
* Archive download workflow implemented
* Archive engine implementation complete
* Archive validation pipeline complete
* Archive import pipeline complete
* Unique archive filenames implemented
* Canonical archive shot authority implemented
* Archive count consistency validated
* Archive quality gate passed
* ZIP compression implemented and validated

Validated archive export:

* 141 shots
* 20,555 samples
* 5 profiles
* 0 warnings
* Canonical local mirror export
* Local-only export path
* Snapshot-consistent export path
* ZIP size reduced from ~7.05 MB to ~382 KB

Current active validation:

1. Restore Backup runtime validation
2. Import runtime validation
3. Large archive import behaviour testing
4. Browser storage behaviour testing

Deferred:

* Archive Browser
* Archive Management

⸻

Phase 6 — Hardening / PWA / Packaging

Status: Planned.

Planned:

* performance optimisation
* statistics indexing improvements
* installable PWA behaviour
* packaging/distribution
* runtime cleanup
* end-to-end testing
* feature gating/app-mode architecture

⸻

Architectural Direction

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

Important implementation rule:

GaggiMate controls the machine.
GaggiGo observes, stores, analyses, archives, and later syncs safe data.

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