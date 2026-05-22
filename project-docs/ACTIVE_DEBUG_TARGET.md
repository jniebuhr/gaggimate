# ACTIVE DEBUG TARGET

## Current Priority

Analyzer and Statistics regression.

This is the current blocker for the project.

Do not start:

- Safe Sync work
- new frontend features
- UI redesign work
- architecture rewrites
- new cache systems

until this is stable.

---

## First Instructions Before Any Work

1. Check current GitHub state.
2. Confirm branch is `gaggigo-mvp`.
3. Read current project docs.
4. Compare against `TyrLabsOS/GaggiGo` `master` where needed.
5. Do not rely on memory or old thread assumptions.

Commands:

```powershell
cd C:\Users\ed\GaggiGo
git checkout gaggigo-mvp
git pull origin gaggigo-mvp
git status
```

Read:

- `CURRENT_STATE.md`
- `ROADMAP.md`
- `project-docs/CACHE_FIRST_WORKFLOW.md`
- `project-docs/DATA_STORAGE_MODEL.md`
- `project-docs/PRE_SYNC_AUDIT_GATE.md`
- `project-docs/ANALYZER_STATISTICS_DEBUG_HANDOVER.md`
- `project-docs/ACTIVE_DEBUG_TARGET.md`

---

## Current Confirmed Problem

Analyzer:

- graphs may not render

Statistics:

- may report zeroes
- may batch extremely slowly
- may skip shots with missing payloads

Known likely cause:

```text
Original UI contract:
- gaggimate
- browser

New data-layer source:
- gaggimate-cache
```

This source model was introduced without fully updating all consumers.

Result:

- cached GaggiMate shots may be treated as browser uploads
- metadata-only rows may pretend to be loaded payloads
- analyzer graphs may receive empty sample arrays
- statistics may skip payloads and produce invalid output

---

## Current Architectural Rule

Correct model:

```text
GaggiMate
↓
IndexedDB mirror
↓
LibraryService
↓
Analyzer / Statistics / History
```

Analyzer and Statistics should run from full local IndexedDB payloads.

Live `.slog` fetches are hydration operations only.

The UI should not maintain separate live-vs-cache architectures.

---

## Do Not Modify Without Strong Reason

- `web/src/index.jsx`
- `web/src/components/Navigation.jsx`
- `web/src/components/Header.jsx`
- `web/src/pages/Home/index.jsx`
- `web/src/pages/Settings/index.jsx`

---

## Primary Suspect Files

- `web/src/pages/ShotAnalyzer/services/LibraryService.js`
- `web/src/pages/ShotAnalyzer/services/IndexedDBService.js`
- `web/src/pages/ShotHistory/index.jsx`
- `web/src/pages/ShotHistory/HistoryCard.jsx`
- `web/src/pages/ShotAnalyzer/index.jsx`
- `web/src/pages/Statistics/components/StatisticsView.jsx`

---

## Rules

- minimal targeted edits only
- no broad rewrites
- no speculative architecture changes
- no duplicate cache architecture
- patch one file at a time
- validate after every patch
- keep merge-back compatibility

---

## Important Product Boundary

GaggiMate controls the machine.

GaggiGo observes, stores, analyses, and later syncs safe data.

Never reintroduce:

- brew control
- grinder control
- scales control
- PID/autotune
- OTA
- Bluetooth management
- raw websocket admin
- unrestricted settings writes
