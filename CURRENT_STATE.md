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

Current archive phase:

```text
Archive Validation Phase
```

Confirmed direction:

```text
ESP32 / GaggiMate
= authoritative rolling datastore

GaggiGo
= hydrated mirror node
= historical continuity layer
= archive layer later
```

Archive retention model and current archive architecture decisions are defined by:

```text
project-docs/ARCHIVE_ARCHITECTURE_SPECIFICATION.md
```

CURRENT_STATE.md reflects current implementation status only.

No backup/archive implementation should begin until pre-implementation requirements are complete.

Pre-implementation requirements:

```text
measure real shot payload sizes
measure IndexedDB growth
measure archive sizes
measure browser storage behaviour
define shot identity algorithm
define archive manifest schema
complete runtime validation matrix review
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
