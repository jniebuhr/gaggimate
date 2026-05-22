# Sanity Validation

## Purpose

Record the pre-sync sanity pass for the current `gaggigo-mvp` branch.

This is repo/code-path validation plus a manual test checklist.

Full runtime validation still requires running the app against the user's local GaggiMate instance.

---

## Validation Scope

Checked:

- active router and navigation
- Shot History data path
- Shot Analyzer data path
- Statistics data path
- Settings cache/read-only path
- safe data boundary position
- remaining known blockers

---

## Current Result

Status:

```text
Architecturally sound.
Repo paths coherent.
Runtime manual test still required.
```

No new architectural blocker was found during this pass.

---

## Router / Navigation

Status:

```text
PASS — GaggiGo mode routes are coherent.
```

Active routed pages:

- Dashboard
- Profiles
- Profile edit
- Settings
- Shot History
- Shot Analyzer
- Statistics

Control/admin surfaces are not exposed in the active GaggiGo shell.

Merge-back note:

- long term this should become mode/feature gating rather than permanent upstream deletion.

---

## Shot History

Status:

```text
PASS — code path coherent.
```

Observed:

- uses `LibraryService` for shot list loading.
- supports merged GaggiMate/browser sources.
- uses `LibraryService.loadShot()` for detail loading.
- uses `LibraryService.deleteShot()` for delete path.
- source badges are shown per shot card.
- empty state exists.

Manual test still required:

- live shot list loads from GaggiMate.
- cached shot list loads when GaggiMate is offline.
- expanding a cached shot opens chart/analyser data.
- delete behaviour is still correct for live and browser shots.

---

## Shot Analyzer

Status:

```text
PASS — code path coherent.
```

Observed:

- uses `LibraryService` for shot/profile loading.
- supports source-aware GaggiMate/browser shot loading.
- profile auto-match uses source-aware profile lookup.
- no direct raw machine control path observed in analyzer flow.

Manual test still required:

- live GaggiMate shot opens in analyzer.
- cached/offline shot opens in analyzer.
- browser-imported shot opens in analyzer.
- profile auto-match still works.

---

## Statistics

Status:

```text
PASS — code path coherent.
```

Observed:

- Statistics route context is source-aware.
- `StatisticsView` imports `LibraryService` as the data abstraction.
- statistics can run from the same merged/cached source model as history/analyzer.

Manual test still required:

- statistics runs while connected.
- statistics runs offline from cached shots.
- profile deep links still resolve.

---

## Settings

Status:

```text
PASS — code path coherent.
```

Observed:

- cache-first settings snapshot.
- live `/api/settings` refresh path.
- live/cached badge.
- read-only boundary message.
- grouped settings display.
- sensitive values are masked by default.

Manual test still required:

- live settings load.
- offline cached settings load.
- refresh updates snapshot when GaggiMate is available.

---

## Known Remaining Blockers

### 1. ProfileList migration

Status:

```text
OPEN
```

`ProfileList` still has direct low-level profile data calls.

This is audited in:

```text
project-docs/PROFILELIST_MIGRATION_AUDIT.md
```

It should be patched locally or with a safer code-editing environment.

---

### 2. Non-web diff audit

Status:

```text
PARTIAL
```

Some runtime changes have been classified in:

```text
project-docs/NON_WEB_DIFF_AUDIT.md
```

Unknowns remain in controller library, NimBLE library, OTA, ProfileManager, and predictive code.

---

### 3. Manual runtime test

Status:

```text
OPEN
```

Requires local app + GaggiMate instance.

---

## Manual Test Checklist

Run locally:

```text
cd C:\Users\ed\GaggiGo

git checkout gaggigo-mvp
git pull origin gaggigo-mvp
cd web
npm install
npm run dev -- --host
```

Then test connected:

- Dashboard loads.
- Profiles load.
- Profile edit/save works.
- Shot History loads.
- Shot History cards show source badges.
- Analyzer opens live shot.
- Statistics runs.
- Settings loads live snapshot.

Then test offline/disconnected:

- Profiles cached fallback loads.
- Shot History cached fallback loads.
- Analyzer opens cached shot.
- Statistics runs from cache.
- Settings cached snapshot loads.
- Empty states are understandable when no cache exists.

---

## Current Verdict

```text
Ready to continue cleanup.
Not yet sync-ready.
```

The app is structurally coherent, but the final pre-sync blockers remain:

1. complete or consciously defer `ProfileList` migration.
2. finish/non-block defer non-web diff classification.
3. run local live/offline sanity test.
