# Current State — GaggiGo MVP

## Active Branch

```text
gaggigo-mvp
```

Do not work from `master`.

---

## Current Identity

GaggiGo is a merge-directed offline-first frontend evolution layer for GaggiMate.

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

## Active Debug State

Analyzer and Statistics are currently the active blocking issue.

Observed current problem:

- Shot Analyzer opens but graphs do not render for affected shots.
- Statistics can report zeroes.
- Statistics may batch many shots slowly and still produce little or no usable output.

Do not treat analyzer/statistics cache fallback as fully complete until this is fixed and validated.

Current likely cause, documented in `project-docs/ANALYZER_STATISTICS_DEBUG_HANDOVER.md`:

```text
UI still assumes two source types:
- gaggimate
- browser

Data layer introduced a third source:
- gaggimate-cache
```

This creates contract drift between Shot History, Shot Analyzer, Statistics, LibraryService, and IndexedDBService.

Immediate rule:

```text
No sync design or new product features until Analyzer graphs and Statistics work correctly from cached full shot payloads.
```

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

Confirmed working earlier during the MVP phase:

- local Vite proxy
- live GaggiMate API access
- websocket integration
- profile loading
- shot history loading
- analyzer routing
- statistics generation
- read-only settings loading

Important:

- current analyzer/statistics behaviour has regressed during offline/cache data-path work.
- do not rely on older successful tests as proof that the current branch is healthy.

### Offline Persistence Layer

Completed or partially integrated:

- IndexedDB persistence integrated
- cached GaggiMate shot mirroring introduced
- cached GaggiMate profile mirroring introduced
- cached settings snapshot mirroring introduced
- offline history fallback introduced
- offline settings fallback introduced
- expanded shot persistence introduced
- fast cached startup behaviour introduced
- cache-first rendering behaviour introduced

Not currently proven healthy:

- offline analyzer graph rendering from cached full payloads
- offline statistics from cached full payloads
- metadata-only shot handling
- `gaggimate-cache` source handling across all callers

Current intended behaviour:

Connected + live data:

- live data can refresh the local mirror
- UI should render through the local model where applicable

Disconnected + cache exists:

- show cached data
- allow offline analysis only when full shot payloads exist
- allow offline statistics only when full shot payloads exist
- allow offline settings viewing from filtered cached snapshot

Disconnected + no cache:

- show clear empty-state behaviour

### Safe Data Boundary

Completed:

- `SafeGaggiMateClient` added.
- safe read operations wrapped.
- safe profile data writes wrapped.
- `ProfileEdit` migrated to safe client.
- `ProfileList` migrated to safe client.
- `ApiService` classifies known safe websocket data requests and warns for requests outside the documented set.

### Source / Cache Visibility

Completed or introduced:

- Shot History source badges added:
  - Live
  - Cached
  - Browser
  - Local fallback
- Settings displays Live/Cached snapshot status.

Still needs validation:

- source badges must remain presentation-only.
- source badges must not create separate live/cache UI architectures.
- cached GaggiMate shots must not be routed as browser uploads.

### Audits Completed

Completed docs:

- `project-docs/SAFE_DATA_OPERATIONS.md`
- `project-docs/PRE_SYNC_AUDIT_GATE.md`
- `project-docs/NON_WEB_DIFF_AUDIT.md`
- `project-docs/SANITY_VALIDATION.md`
- `project-docs/PROFILELIST_MIGRATION_AUDIT.md`
- `project-docs/ANALYZER_STATISTICS_DEBUG_HANDOVER.md`

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

The project is paused at an analyzer/statistics debug gate.

Current focus:

1. understand the current GitHub state
2. read current project docs
3. confirm branch `gaggigo-mvp`
4. compare with `master` where needed
5. fix Analyzer/Statistics source-contract drift with minimal targeted patches
6. validate online and offline cached full-payload behaviour

Only after this passes should the project return to pre-sync validation.

Remaining before sync design:

1. Analyzer graphs render from cached full shot payloads.
2. Statistics runs from cached full shot payloads.
3. metadata-only rows do not pretend to be loaded.
4. `gaggimate-cache` handling is explicit and stable.
5. local runtime validation against real GaggiMate.
6. connected/offline/reconnect test.
7. confirm profile actions after safe-client migration.
8. confirm no unexpected ApiService warnings for documented safe operations.

---

## Important Stable Files

Do not modify without reason:

- `web/src/index.jsx`
- `web/src/components/Navigation.jsx`
- `web/src/components/Header.jsx`
- `web/src/pages/Home/index.jsx`
- `web/src/pages/Settings/index.jsx`

Current analyzer/statistics suspect files:

- `web/src/pages/ShotAnalyzer/services/LibraryService.js`
- `web/src/pages/ShotAnalyzer/services/IndexedDBService.js`
- `web/src/pages/ShotHistory/index.jsx`
- `web/src/pages/ShotHistory/HistoryCard.jsx`
- `web/src/pages/ShotAnalyzer/index.jsx`
- `web/src/pages/Statistics/components/StatisticsView.jsx`

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

Do not reintroduce machine controls, OTA, PID/autotune, Bluetooth management, raw websocket admin, or unrestricted settings writes.
