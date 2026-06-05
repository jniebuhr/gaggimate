# Current State — GaggiGo MVP

## Active Branch

```text
gaggigo-mvp
```

Do not work from `master`.

---

## Current Identity

GaggiGo is a merge-directed offline-first frontend/PWA layer for GaggiMate.

It is not a hostile fork and not a replacement runtime.

```text
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
= persistent archive layer later
= safe sync client later
```

Merge-back compatibility remains a hard requirement.

Do not reintroduce:

- machine controls
- OTA
- PID/autotune
- Bluetooth management
- raw websocket admin
- unrestricted settings writes

---

## Current Architecture

```text
GaggiMate ESP32 / API / WebSocket
↓
SafeGaggiMateClient + hydration/import path
↓
LibraryService
↓
IndexedDBService
↓
Shot History / Shot Analyzer / Statistics / Profiles
```

Current rule:

```text
GaggiMate hydrates the local mirror.
GaggiGo pages render from the local mirror.
```

Live GaggiMate access is valid for refreshing/hydrating IndexedDB.

Analyzer and Statistics should not depend on repeated live fetches during normal rendering.

Hydration is the sync model.

---

## Runtime State Confirmed

Confirmed working after recent fixes and validation:

- Shot History loads correctly online.
- Shot History remains available offline.
- Shot Analyzer graphs load online.
- Shot Analyzer works from cached full shot payloads offline after hydration.
- Profiles show current live GaggiMate profiles while connected.
- Profiles load from cache while offline.
- Full GaggiMate shot payloads hydrate into IndexedDB during shot index hydration.
- Statistics reads cached payloads instead of lazy live fetches.
- Statistics reports missing payload state instead of silent zero-result behaviour.
- Browser refresh preserves the local mirror.
- Connected → offline → refresh → reconnect lifecycle has been validated.
- Reconnect does not create duplicate shots.
- Reconnect does not show stale profile accumulation.
- Reconnect does not produce hydration spam.
- Reconnect does not produce websocket retry flood.
- Cache-first architecture is functioning as the active data model.

Important implementation point:

```text
hydrateGaggiMateShotIndex()
→ fetches /api/history/index.bin
→ saves metadata rows
→ detects missing/unloaded payloads
→ hydrates missing .slog payloads with low concurrency
→ stores full samples[] payloads in IndexedDB
```

---

## Storage / Archive Direction

The architecture direction is now moving toward persistent mirror and archive behaviour.

Confirmed direction:

```text
ESP32 / GaggiMate
= authoritative rolling datastore

GaggiGo
= hydrated mirror node
= historical continuity layer
= archive layer later
```

Archive retention model is defined by:`r`n`r`n```text`r`nproject-docs/ARCHIVE_ARCHITECTURE_SPECIFICATION.md`r`n``` `r`n`r`nCURRENT_STATE.md reflects current implementation status only.`r`n`r`nCurrent archive architecture decisions are defined by:

```text`r`nproject-docs/ARCHIVE_ARCHITECTURE_SPECIFICATION.md`r`n```

No backup/archive implementation should begin until pre-implementation requirements are complete.

Pre-implementation requirements:

```text
measure real shot payload sizes
measure IndexedDB growth
measure archive sizes
measure browser storage behaviour
define shot identity algorithm
define archive manifest schema
```

---

## Settings Model

Settings remain a filtered read-only snapshot.

Online behaviour:

```text
read live GaggiMate settings
filter unsafe/sensitive data
display safe snapshot
cache latest safe snapshot
```

Offline behaviour:

```text
display last safe cached settings snapshot
clearly treat as cached/offline context
```

Settings snapshots are context only.

They are not authority, backup, sync input, or restore target.

Do not store:

- WiFi credentials
- secrets
- HomeKit data
- private keys
- authentication data
- unsafe machine configuration

---

## Current Hardening Status

Architecture hardening completed:

- offline empty-state polish
- cache/source indicator clarity
- terminal/proxy noise review
- dead-code architecture pass
- ApiService safe-boundary mapping

Completed during hardening:

- LocalCacheService removed
- deprecated parallel localStorage persistence path removed
- IndexedDB confirmed as sole persistence authority
- SafeGaggiMateClient reviewed
- ApiService reviewed
- machine-state operations documented
- observer-safe operations documented
- sync/archive safety boundaries documented

Remaining before archive/sync implementation:

1. Runtime validation matrix review.
2. Pre-sync readiness review.
3. Archive pre-implementation measurements and identity/schema definition.

No new product features before these reviews complete.

---

## Completed Stabilisation Fixes

### Shot History / Analyzer

- Stopped metadata-only rows from pretending to contain loaded sample payloads.
- Fixed Analyzer loaded-payload check so `samples: []` is not treated as valid loaded data.
- Fixed cached GaggiMate shot routing so `gaggimate-cache` is treated as GaggiMate-origin for Analyzer routes.
- Added Shot History hydration before local shot-list rendering.

### Full Payload Hydration

- GaggiMate shot index hydration now also hydrates missing full `.slog` payloads into IndexedDB.
- Hydration uses low concurrency to avoid hammering the ESP32.
- Existing hydrated payloads are preserved when metadata refreshes.

### Statistics

- Statistics now reads cached payloads directly from IndexedDB.
- Statistics no longer lazily fetches payloads from GaggiMate during analysis runs.
- Statistics now reports missing payload states clearly.

### Profiles

- Online profile list now prefers live GaggiMate profiles.
- Cached/library fallback remains available when live profile load is unavailable.
- Mirrored GaggiMate profile snapshots are replaced cleanly rather than accumulated.
- Browser/import profiles remain preserved separately.

### Reconnect Lifecycle

- Online → offline → browser refresh → reconnect workflow validated.
- Profiles, History, Analyzer, and Statistics survive offline refresh from the local mirror.
- Reconnect does not duplicate shots or accumulate stale profiles.
- Reconnect does not cause hydration spam or websocket retry flood.

### Safe Data Boundary

- SafeGaggiMateClient is the named safe GaggiMate access layer.
- Safe profile operations are wrapped.
- GaggiGo remains observer/data-first, not controller-first.

### ApiService Boundary Map

Documented in:

```text
project-docs/API_SERVICE_BOUNDARY_MAP.md
```

Observer-safe operations:

- profile hydration
- profile loading
- history loading
- shot hydration
- analyzer/statistics hydration
- notes retrieval

Machine-state operations:

- profile save
- profile delete
- profile reorder
- profile select
- profile favorite
- profile unfavorite

Important:

```text
favorite/unfavorite affects ESP32 profile-slot state.

These operations must never be treated as passive sync.
They require explicit user intent.
```

---

## Authoritative Persistence Path

```text
LibraryService
↓
IndexedDBService
↓
IndexedDB browser persistence
```

Current persistence authority:

```text
LibraryService
↓
IndexedDBService
↓
IndexedDB
```

LocalCacheService has been removed as deprecated architecture.

Do not introduce:

- parallel cache systems
- localStorage persistence layers
- competing sync queues
- alternative storage authorities
- parallel archive systems

---

## Current Technical Focus

Current phase:

```text
Archive pre-implementation review before sync work.
```

Immediate next focus:

1. Runtime validation matrix review.
2. Archive measurement pass.
3. Shot identity algorithm definition.
4. Archive manifest schema definition.
5. Pre-sync readiness review.

Completed this phase:

- offline empty-state polish
- cache/source indicator clarity
- terminal/proxy review
- dead-code architecture pass
- ApiService safe-boundary mapping
- archive architecture specification

---

## Mandatory First Actions For New Work

Before any investigation, planning, patching, or coding:

1. Read `CURRENT_STATE.md`.
2. Read `ROADMAP.md`.
3. Read `project-docs/API_SERVICE_BOUNDARY_MAP.md`.
4. Read `project-docs/BACKUP_AND_ARCHIVE_STRATEGY.md`.
5. Read `project-docs/ARCHIVE_ARCHITECTURE_SPECIFICATION.md`.
6. Read `project-docs/GAGGIGO_PATCH_PROTOCOL.md`.
7. Check current GitHub branch state.
8. Confirm working branch is `gaggigo-mvp`.
9. Inspect actual runtime behaviour before theorising.
10. Validate that documentation matches repository reality.

Do not begin implementation from handover text alone.

Verify repository state first.

---

## Important Stable Files

Do not modify without reason:

- `web/src/index.jsx`
- `web/src/components/Navigation.jsx`
- `web/src/components/Header.jsx`
- `web/src/pages/Home/index.jsx`
- `web/src/pages/Settings/index.jsx`

Current files still worth watching:

- `web/src/pages/ShotAnalyzer/services/LibraryService.js`
- `web/src/pages/ShotAnalyzer/services/IndexedDBService.js`
- `web/src/pages/ShotAnalyzer/index.jsx`
- `web/src/pages/Statistics/components/StatisticsView.jsx`
- `web/src/services/ProfileCacheService.js`
- `web/src/services/SafeGaggiMateClient.js`
- `web/src/services/ApiService.js`

---

## Working Mental Model

GaggiMate remains the source authority and controls the machine.

GaggiGo observes, stores, analyses, archives, and later syncs safe data.

History, Analyzer, Statistics, and Profiles should operate from the local IndexedDB mirror once hydration has completed.

Current implementation rule:

```text
GaggiMate hydrates the local mirror.
GaggiGo renders from the local mirror.
```

