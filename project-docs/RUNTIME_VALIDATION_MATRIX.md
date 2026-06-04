# Runtime Validation Matrix — GaggiGo MVP

## Purpose

This matrix defines the expected runtime behaviour for GaggiGo during the hardening phase.

Use it after any patch that touches:

- cache reads
- hydration
- source indicators
- offline empty states
- profile mirroring
- shot history
- Analyzer
- Statistics
- ApiService / websocket paths

The goal is to prevent regressions while keeping GaggiGo aligned with the project rule:

```text
GaggiMate hydrates the local mirror.
GaggiGo renders cache-first.
```

---

## Required Branch

```text
gaggigo-mvp
```

Do not validate hardening work from `master` or `GaggiStop`.

---

## Pre-Test Commands

From repo root:

```powershell
cd C:\Users\ed\GaggiGo

git checkout gaggigo-mvp

git pull origin gaggigo-mvp

git status
```

Expected:

```text
On branch gaggigo-mvp
nothing to commit, working tree clean
```

Then launch from the frontend folder:

```powershell
cd C:\Users\ed\GaggiGo\web
npm run dev -- --host
```

---

# Test Matrix

## 1. Online Cold Load

State:

```text
GaggiMate ON
Browser open/reloaded
```

Validate:

- Profiles load.
- Shot History loads.
- Shot Analyzer opens.
- Analyzer graph renders for a selected shot.
- Statistics builds.
- Statistics does not slowly batch by repeatedly fetching live payloads.
- Current GaggiMate profiles are visible.
- No obvious console errors.

Expected result:

```text
PASS: Online live-to-local mirror works.
```

---

## 2. Offline Refresh With Existing Mirror

State:

```text
GaggiMate OFF
Browser refreshed
IndexedDB mirror already hydrated from earlier online use
```

Validate:

- Profiles show last mirrored snapshot.
- Shot History shows cached shots.
- Analyzer opens cached shots.
- Analyzer graph renders from cached full payloads.
- Statistics builds from cached payloads.
- Offline empty states do not appear when valid cached data exists.
- No retry flood.

Expected result:

```text
PASS: Offline mirror survives browser refresh.
```

---

## 3. Offline First Run / No Mirror

State:

```text
GaggiMate OFF
No usable IndexedDB mirror for the tested browser/profile
```

Validate:

- Profiles shows clear no-cache message.
- Shot History shows clear no-cache message.
- Analyzer does not pretend missing data is loaded.
- Statistics reports missing payload / no selectable data clearly.
- UI remains stable and usable.

Expected result:

```text
PASS: Offline no-cache state is clear, not broken-looking.
```

---

## 4. Online → Offline → Refresh → Reconnect

State sequence:

```text
GaggiMate ON
Open GaggiGo
Confirm data loads
Turn GaggiMate OFF
Refresh browser
Confirm cached data works
Turn GaggiMate ON
Refresh or allow reconnect
```

Validate:

- No duplicate shots.
- No stale profile accumulation.
- Profiles refresh to current mirrored snapshot.
- Shot History remains stable.
- Analyzer still opens shots correctly.
- Statistics still builds from cache.
- No hydration spam.
- No websocket retry flood.

Expected result:

```text
PASS: Reconnect lifecycle is deterministic.
```

---

## 5. Browser Restart Persistence

State sequence:

```text
GaggiMate previously connected and mirror hydrated
Close browser completely
Reopen browser
Open GaggiGo
```

Validate:

- IndexedDB mirror remains available.
- Profiles show last mirrored snapshot when offline.
- Shot History remains available when offline.
- Analyzer cached payloads remain available.
- Statistics can build from cached payloads.

Expected result:

```text
PASS: Browser restart does not destroy mirror.
```

---

## 6. Machine Restart / ESP32 Restart

State sequence:

```text
GaggiGo already has mirror
Restart GaggiMate / ESP32
Reload GaggiGo after machine returns
```

Validate:

- GaggiGo reconnects cleanly.
- Profile mirror refresh does not accumulate stale profiles.
- Shot index hydration does not duplicate shots.
- Existing hydrated full payloads are preserved.
- Analyzer and Statistics still work.

Expected result:

```text
PASS: Machine restart does not corrupt mirror.
```

---

## 7. Source / Cache Indicator Sanity

Validate visible labels and markers:

- Live means current GaggiMate-origin data while connected.
- Last mirrored means cached GaggiMate-origin data.
- Imported means browser/local imported user files.
- GM marker is used for both `gaggimate` and `gaggimate-cache` origins.
- WEB marker is used for browser/imported items only.

Expected result:

```text
PASS: Indicators describe source state without implying separate architectures.
```

---

## 8. Missing Payload Behaviour

State:

```text
Shot metadata exists but full samples[] payload is missing
```

Validate:

- Analyzer does not treat metadata-only rows as loaded shots.
- Statistics skips missing full payloads clearly.
- Statistics reports when selected shots lack cached full payloads.
- User guidance says to connect to GaggiMate and open Shot History to hydrate.

Expected result:

```text
PASS: Missing payloads are explicit and recoverable.
```

---

## 9. Search / Filter Empty Results

Validate:

- Shot History search with no matches shows filter/search empty state, not no-cache state.
- Profiles search with no matches remains stable.
- Analyzer library search with no matches remains stable.
- Empty states do not imply data loss when filters are active.

Expected result:

```text
PASS: Filter-empty and cache-empty states are not confused.
```

---

## 10. Console / Terminal Noise Check

During the above tests, watch browser console and Vite terminal.

Acceptable:

- one-off connection messages
- one-off hydration messages
- meaningful warnings for blocked or unsafe operations

Not acceptable:

- repeated hydration spam
- websocket retry flood
- repeated missing payload spam
- warnings for expected safe reads
- noisy errors during normal offline use

Expected result:

```text
PASS: Runtime is understandable and not noisy.
```

---

# Pass Criteria

Before moving to archive/sync design:

```text
All core matrix sections must pass:
1. Online cold load
2. Offline refresh with mirror
3. Offline no-cache clarity
4. Reconnect lifecycle
5. Browser restart persistence
6. Source/cache indicator sanity
7. Missing payload behaviour
8. Console/terminal noise check
```

---

# Failure Handling

If a validation fails:

1. Stop feature work.
2. Record the exact state transition that failed.
3. Identify whether failure is data, UI, cache, websocket, or route related.
4. Patch narrowly.
5. Re-run only the failed section.
6. Re-run full matrix before marking complete.

---

# Current Project Boundary

Do not use validation failures as a reason to add new features.

Current phase remains:

```text
Hardening and cleanup before sync/archive work.
```
