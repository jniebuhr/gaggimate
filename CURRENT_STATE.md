Current State — GaggiGo MVP

Active Branch

gaggigo-mvp

Do not work from master.

⸻

Current Identity

GaggiGo is a merge-directed offline-first frontend/PWA layer for GaggiMate.

It is not a hostile fork and not a replacement runtime.

GaggiMate
= source authority
= runtime owner
= live telemetry source
= machine controller
= rolling operational datastore

GaggiGo
= offline-first observer frontend
= IndexedDB mirror
= historical viewer
= analyser/statistics workspace
= archive layer
= safe sync client later

Merge-back compatibility remains a hard requirement.

Do not reintroduce:

* machine controls
* OTA
* PID/autotune
* Bluetooth management
* raw websocket admin
* unrestricted settings writes

⸻

Current Architecture

GaggiMate ESP32 / API / WebSocket
↓
SafeGaggiMateClient + hydration/import path
↓
LibraryService
↓
IndexedDBService
↓
Shot History / Shot Analyzer / Statistics / Profiles / Storage Archive

Current rule:

GaggiMate hydrates the local mirror.
GaggiGo pages render from the local mirror.

Live GaggiMate access is valid for refreshing/hydrating IndexedDB.

Analyzer and Statistics should not depend on repeated live fetches during normal rendering.

Storage/archive export must not hydrate, fetch, call GaggiMate, or mutate local storage during backup creation.

Hydration is the sync model for the current frontend MVP.

⸻

Runtime State Confirmed

Confirmed working after recent fixes and validation:

* Shot History loads correctly online.
* Shot History remains available offline.
* Shot Analyzer graphs load online.
* Shot Analyzer works from cached full shot payloads offline after hydration.
* Profiles show current live GaggiMate profiles while connected.
* Profiles load from cache while offline.
* Full GaggiMate shot payloads hydrate into IndexedDB during shot index hydration.
* Statistics reads cached payloads instead of lazy live fetches.
* Statistics reports missing payload state instead of silent zero-result behaviour.
* Browser refresh preserves the local mirror.
* Full browser close and offline restart have been personally validated.
* Connected → offline → refresh → reconnect lifecycle has been validated.
* Machine unavailable behaviour has been validated against cached data.
* Reconnect does not create duplicate shots.
* Reconnect does not show stale profile accumulation.
* Reconnect does not produce hydration spam.
* Reconnect does not produce websocket retry flood.
* Cache-first architecture is functioning as the active data model.

Important implementation point:

hydrateGaggiMateShotIndex()
→ fetches /api/history/index.bin
→ saves metadata rows
→ detects missing/unloaded payloads
→ hydrates missing .slog payloads with low concurrency
→ stores full samples[] payloads in IndexedDB

⸻

Storage / Archive State

Archive status:

Archive Engine Implementation Complete
Archive UX Planning Complete
Storage Page / Create Backup UI Implemented
Archive Export Hardening Active
Restore UX Blocked Pending Export Hardening Completion

Archive architecture is defined by:

project-docs/ARCHIVE_ARCHITECTURE_SPECIFICATION.md

UX authority is defined by:

project-docs/ARCHIVE_UX_SPECIFICATION.md

CURRENT_STATE.md reflects current implementation status only.

The archive engine now implements the documented backend/domain flow while preserving the existing authority model:

GaggiMate
= authoritative rolling datastore
= live machine/runtime authority

GaggiGo
= hydrated mirror node
= historical continuity layer
= archive layer
= ZIP import/export engine
= IndexedDB-only archive restore target

Implemented archive services:

web/src/services/ArchiveService.js
web/src/services/ArchiveValidationService.js
web/src/services/ArchiveHealthService.js
web/src/services/ArchiveExportService.js
web/src/services/ArchiveZipService.js
web/src/services/ArchiveZipImportService.js
web/src/services/ArchiveImportValidationService.js
web/src/services/ArchiveImportService.js
web/src/services/ArchiveMergeService.js
web/src/services/ArchiveExecutionService.js

Archive engine capabilities now present:

* Build archive payloads from the canonical local IndexedDB mirror.
* Use LibraryService.getAllShots('both') for the same merged/deduped local shot list used by History/Analyzer.
* Generate manifest data.
* Generate SHA256 section and overall integrity data.
* Validate archive manifest, schema, counts, and integrity.
* Evaluate archive health as Good / Warning / Critical.
* Prepare .gaggigo.zip archive exports.
* Read .gaggigo.zip archive imports.
* Validate ZIP-backed imports.
* Preview archive imports without mutation.
* Generate deterministic merge plans.
* Execute approved imports into IndexedDB only.
* Skip duplicate shots.
* Preserve existing profiles.
* Restore archived profiles as copies.
* Preserve existing notes and import only new notes.

End-to-end archive engine flow:

Export:
ArchiveService
↓
ArchiveExportService
↓
ArchiveZipService
↓
.gaggigo.zip

Import:
.gaggigo.zip
↓
ArchiveZipImportService
↓
ArchiveImportValidationService
↓
ArchiveValidationService
↓
ArchiveHealthService
↓
ArchiveImportService
↓
ArchiveMergeService
↓
ArchiveExecutionService
↓
IndexedDBService / IndexedDB

Archive engine audit result:

ZIP export        PASS
ZIP import        PASS
Validation        PASS
Health            PASS
Preview           PASS
Merge plan        PASS
Execution         PASS
Build             PASS
Repository sync   PASS

No GaggiMate write path was introduced by archive import.

No parallel persistence system was introduced.

Archive import restores GaggiGo data only.

Archive UX planning has been completed.

⸻

Archive Export Hardening — Validated Findings

Validated archive export after canonical-count fix:

* Archive file: 2026-H1-20260606-151133.gaggigo.zip
* Shots: 141
* Profiles: 5
* Notes: 0
* Hydrated shots: 141
* Summary-only shots: 0
* Samples: 20,555
* Warnings: 0
* ZIP size: 7,049,579 bytes, about 6.72 MB
* shots/shots.json size: 7,040,356 bytes, about 6.71 MB

Defects fixed during archive hardening:

* Download generation path repaired.
* Browser download path repaired.
* File save fallback repaired.
* Size unit display bug fixed.
* Archive export made local-only; backup no longer hydrates or fetches from GaggiMate.
* LibraryService/exportItem hydration path removed from backup export.
* Unique timestamped archive filenames implemented.
* Pretty-printed JSON replaced with compact JSON for archive files.
* Archive shot enumeration switched from raw IndexedDB rows to canonical LibraryService.getAllShots('both') output.
* Count mismatch between raw IndexedDB rows and History/Analyzer canonical rows fixed.

Current validated export authority:

ArchiveService
→ LibraryService.getAllShots('both')
→ IndexedDBService
→ IndexedDB

Current export rule:

Backup export is local-only and must not repair, hydrate, fetch, or mutate data.

Current remaining archive hardening item:

* Enable real ZIP compression. Current ZIP container stores files effectively uncompressed.

Restore workflow remains blocked until archive export hardening is complete and revalidated after compression.

⸻

Current phase:

Archive Export Hardening

Next implementation targets:

1. Enable actual ZIP compression.
2. Revalidate archive size, contents, manifest, and hydration counts.
3. Confirm Storage review count, Archive ZIP count, History count, and Analyzer count remain identical.
4. Then resume Restore Backup UI / restore runtime validation.

⸻

Settings Model

Settings remain a filtered read-only snapshot.

Online behaviour:

read live GaggiMate settings
filter unsafe/sensitive data
display safe snapshot
cache latest safe snapshot

Offline behaviour:

display last safe cached settings snapshot
clearly treat as cached/offline context

Settings snapshots are context only.

They are not authority, backup, sync input, or restore target.

Do not store:

* WiFi credentials
* secrets
* HomeKit data
* private keys
* authentication data
* unsafe machine configuration

⸻

Current Hardening Status

Architecture hardening completed:

* offline empty-state polish
* cache/source indicator clarity
* terminal/proxy noise review
* dead-code architecture pass
* ApiService safe-boundary mapping

Completed during hardening:

* LocalCacheService removed
* deprecated parallel localStorage persistence path removed
* IndexedDB confirmed as sole persistence authority
* SafeGaggiMateClient reviewed
* ApiService reviewed
* machine-state operations documented
* observer-safe operations documented
* sync/archive safety boundaries documented

Completed during archive validation / implementation:

* Runtime validation matrix review.
* Pre-sync readiness review.
* Archive manifest shape implemented.
* Archive ZIP import/export implemented.
* Archive validation and health implemented.
* Archive merge and execution implemented.
* Archive Storage page shell implemented.
* Create Backup UI implemented.
* Archive download flow implemented.
* Archive filename uniqueness implemented.
* Canonical archive shot count implemented and validated.

Remaining before safe sync implementation:

1. Archive export compression and revalidation.
2. Restore Backup UI implementation and validation.
3. Manual archive import/export runtime validation.
4. Large archive import behaviour testing.
5. Browser storage behaviour testing.

Deferred:

* Archive Browser
* Archive Management

These remain future enhancements and are not required for Archive UX v1.

No safe sync implementation should begin before archive UX and archive runtime validation are complete.

⸻

Completed Stabilisation Fixes

Shot History / Analyzer

* Stopped metadata-only rows from pretending to contain loaded sample payloads.
* Fixed Analyzer loaded-payload check so samples: [] is not treated as valid loaded data.
* Fixed cached GaggiMate shot routing so gaggimate-cache is treated as GaggiMate-origin for Analyzer routes.
* Added Shot History hydration before local shot-list rendering.
* Archive export now uses the same canonical merged shot list as History/Analyzer instead of raw IndexedDB rows.
