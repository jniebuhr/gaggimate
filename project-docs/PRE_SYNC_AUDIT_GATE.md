# Pre-Sync Audit Gate

## Purpose

Define what must be checked before Safe Sync v1 begins.

This is a stopping gate, not an implementation document.

---

## Current Build Position

GaggiGo is now a merge-directed frontend evolution of GaggiMate.

The goal is not to permanently fork or strip GaggiMate.

The goal is to add:

- offline-first/PWA behaviour
- faster cache-first rendering
- IndexedDB local mirroring
- historical analysis
- statistics
- safe data sync
- clearer frontend data boundaries

while keeping GaggiMate as the source authority and machine runtime.

---

## Confirmed Completed Before Sync Design

- Safe data operation boundary documented.
- Merge-back is documented as required, not optional.
- `SafeGaggiMateClient` exists for named safe data operations.
- `ProfileEdit` uses `SafeGaggiMateClient` for profile load/save.
- `ApiService` classifies documented safe data websocket request types.
- `LocalCacheService` is marked deprecated and should not be used for new sync work.
- `LibraryService` and `IndexedDBService` remain the authoritative offline/cache path.
- `NotesService` already demonstrates the desired dual-persistence pattern.

---

## Known Remaining Pre-Sync Work

### 1. ProfileList migration

File:

```text
web/src/pages/ProfileList/index.jsx
```

Status:

- audited
- documented in `PROFILELIST_MIGRATION_AUDIT.md`
- not yet changed, because it is a large central page and should be edited locally/patch-safely

Goal:

Move direct profile data calls to `SafeGaggiMateClient` without changing UI behaviour or API contracts.

---

### 2. Non-web diff audit

`gaggigo-mvp` includes non-web changes compared with repo `master`.

Files include:

```text
lib/GaggiMateController/...
lib/NimBLEComm/...
lib/OTA/...
src/display/core/...
src/display/plugins/...
```

These must be classified before merge-back:

- intentional upstream/runtime improvement
- depatching/local environment change
- unrelated accidental drift
- safe to keep
- should be reverted/separated

Do not start sync until this is understood.

---

### 3. Feature-gating plan

GaggiGo mode should hide or disable control/admin surfaces.

GaggiMate mode should preserve the full upstream feature set.

Do not delete GaggiMate feature code for the sake of GaggiGo mode if a feature gate/app mode can solve the problem.

---

### 4. App sanity test

Before sync design, manually confirm:

- live profile loading
- cached profile fallback
- profile edit/save
- shot history live loading
- shot history cached fallback
- analyzer live/cached shot loading
- statistics from cached shots
- settings live/cached loading
- no unexpected console warnings for documented safe data operations

---

## Sync Design Can Start Only After

- ProfileList is migrated or consciously accepted as temporary technical debt.
- non-web diffs are classified.
- feature-gating plan is agreed.
- basic app sanity passes.

---

## Recommended Safe Sync v1 Scope

Start with:

```text
manual sync
notes
ratings
safe metadata
explicit profile drafts only
```

Do not start with:

```text
automatic two-way profile sync
conflict-heavy ordering sync
machine settings writes
control/admin sync
```

---

## Stop Point

This document marks the stop point before sync design.

Next session should audit this gate before implementing sync.
