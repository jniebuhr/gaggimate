# Current State — GaggiGo MVP

## Active Branch

```text
gaggigo-mvp
```

Do not work from `master`.

---

## Current Identity

GaggiGo is now a merge-directed offline-first frontend evolution layer for GaggiMate.

It is not a hostile fork and not a replacement architecture.

Required direction:

```text
GaggiMate
= source authority
= runtime owner
= telemetry source

GaggiGo
= offline-first frontend/PWA layer
= local mirror
= historical viewer
= analyser/statistics workspace
= safe sync client later
```

Merge-back is a required architecture goal.

Useful GaggiGo frontend improvements must remain capable of mapping back to GaggiMate contracts, services, routes, or feature gates.

---

## Current Architecture

```text
GaggiGo UI
↓
LibraryService
↓
SafeGaggiMateClient / IndexedDBService
↓
GaggiMate API/WebSocket + browser IndexedDB
```

Rules:

- APIs are required.
- Safe data transfer is allowed.
- Safe data writes are valid when explicitly scoped.
- GaggiGo mode keeps its visible surface limited to observer/data workflows.
- Use feature gates/app modes for merge-back rather than deleting upstream capability code.

---

## Completed

### Stable Shell

- responsive sidebar preserved
- mobile dropdown preserved
- stable layout retained
- safe informational homepage retained

### GaggiGo Mode Route/Nav Scope

GaggiGo active shell currently exposes:

- Dashboard
- Profiles
- Shot History
- Shot Analyzer
- Statistics
- Settings

Admin/runtime-oriented surfaces are hidden from the active GaggiGo shell.

Merge-back note:

- these should become mode/feature-gated rather than treated as permanent upstream deletions.

### Live Integration Confirmed Earlier

Confirmed working during the MVP phase:

- local Vite proxy
- live GaggiMate API access
- websocket integration
- profile loading
- shot history loading
- analyzer routing
- statistics generation
- read-only settings loading

### Offline Persistence Layer

Completed:

- IndexedDB persistence integrated
- cached GaggiMate shot mirroring
- cached GaggiMate profile mirroring
- cached settings snapshot mirroring
- offline history fallback
- offline analyzer fallback
- offline statistics fallback
- offline settings fallback
- expanded shot persistence
- fast cached startup behaviour
- cache-first rendering behaviour

Current behaviour:

Connected + live data:

- show live data
- mirror locally

Disconnected + cache exists:

- show cached data
- allow offline analysis
- allow offline statistics
- allow offline settings viewing

Disconnected + no cache:

- show empty-state behaviour

### Safe Data Boundary

Completed:

- `SafeGaggiMateClient` added.
- safe read operations wrapped.
- safe profile data writes wrapped.
- `ProfileEdit` migrated to safe client.
- `ProfileList` migrated to safe client.
- `ApiService` now classifies known safe websocket data requests and warns for requests outside the documented set.

### Source / Cache Visibility

Completed:

- Shot History source badges added:
  - Live
  - Cached
  - Browser
  - Local fallback
- Settings displays Live/Cached snapshot status.

### Audits Completed

Completed docs:

- `project-docs/SAFE_DATA_OPERATIONS.md`
- `project-docs/PRE_SYNC_AUDIT_GATE.md`
- `project-docs/NON_WEB_DIFF_AUDIT.md`
- `project-docs/SANITY_VALIDATION.md`
- `project-docs/PROFILELIST_MIGRATION_AUDIT.md`

Non-web diffs are classified into separate merge-back buckets:

1. telemetry/scale metadata enhancements
2. configurable button behaviour / startup profile runtime work
3. predictive runtime improvement
4. OTA timeout change, likely separate or revert unless justified

### Deprecated Architecture

`LocalCacheService` is marked deprecated.

Do not build sync on it.

Authoritative persistence path remains:

```text
LibraryService
↓
IndexedDBService
↓
IndexedDB browser persistence
```

---

## Current Technical Focus

The project is now at the pre-sync validation gate.

Remaining before sync design:

1. local runtime validation against real GaggiMate
2. connected/offline/reconnect test
3. confirm profile actions after safe-client migration
4. confirm no unexpected ApiService warnings for documented safe operations
5. then begin Safe Sync v1 design

---

## Important Stable Files

Do not modify without reason:

- `web/src/index.jsx`
- `web/src/components/Navigation.jsx`
- `web/src/components/Header.jsx`
- `web/src/pages/Home/index.jsx`

Recently changed and must be locally validated:

- `web/src/pages/ProfileList/index.jsx`
- `web/src/pages/ProfileEdit/index.jsx`
- `web/src/services/SafeGaggiMateClient.js`
- `web/src/services/ApiService.js`

---

## Working Mental Model

GaggiMate remains the source authority.

GaggiGo observes, stores, analyses, caches, and later synchronises safe data.

Merge-back has to happen, so preserve GaggiMate compatibility at every step.
