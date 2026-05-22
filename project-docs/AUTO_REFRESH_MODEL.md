# Auto Refresh Model

## Purpose

Define how GaggiGo should refresh live GaggiMate data into the local IndexedDB mirror without spamming the machine or forcing manual reloads.

This is not sync architecture.

This is live refresh / cache hydration policy.

---

## Problem

GaggiGo currently works well once data is loaded, but some pages may require manual refresh because live data loading is mostly tied to:

```text
page load
connection state changes
explicit user actions
```

That means GaggiGo can become stale while the machine has newer shots/profiles available.

---

## Core Rule

```text
GaggiMate should refresh the mirror.
GaggiGo should render from the mirror.
```

Do not make every graph/statistics render fetch directly from GaggiMate.

Correct flow:

```text
GaggiMate produces data
↓
throttled refresh pulls new data
↓
IndexedDB mirror updates
↓
UI renders from local/merged cache
```

---

## Refresh Types

### 1. Event-driven refresh

Use when possible.

Triggers:

```text
websocket reconnect
profile save/select/delete/favorite/reorder
shot delete
notes save
history rebuild complete
new shot detected later if event exists
```

Event-driven refresh should refresh only the relevant domain:

```text
profile event → refresh profiles
history event → refresh shot index
settings refresh → manual or timed only
```

---

### 2. Throttled background polling

Use as fallback when GaggiMate does not emit enough events.

Suggested intervals:

```text
profiles: every 30-60 seconds while connected
shot history index: every 10-20 seconds while connected and app visible
settings: manual refresh only, or every 5-10 minutes if needed
full shot payloads: never poll automatically
```

Only poll lightweight indexes/lists.

Do not poll full shot payloads repeatedly.

---

### 3. Visibility-aware refresh

When the browser tab becomes visible:

```text
if connected and last refresh is stale:
  refresh lightweight indexes
```

Suggested stale thresholds:

```text
shot index stale after 10 seconds
profile list stale after 30 seconds
settings stale after 5 minutes
```

---

### 4. User-triggered refresh

Manual refresh should remain available.

Manual refresh should:

```text
pull latest lightweight indexes
update IndexedDB mirror
rerender current view
```

Manual refresh must not clear cached data on failure.

---

## What Should Auto Refresh

### Shot history index

Yes.

Reason:

- users expect new shots to appear without browser reload
- index is lightweight compared with full shot payloads
- new shots can then be pulled only when opened/analyzed

Policy:

```text
poll /api/history/index.bin at a safe interval
mirror index metadata to IndexedDB
only load full shot payload on demand
```

---

### Profiles

Yes, but slower than shot index.

Reason:

- profile edits may happen from GaggiMate
- profile list is not changing every second

Policy:

```text
refresh profiles on connection/reconnect and safe profile write events
fallback poll every 30-60 seconds while connected
```

---

### Settings

Mostly no.

Reason:

- settings are read-only in GaggiGo
- settings may contain sensitive/admin/runtime data
- settings do not need high-frequency refresh

Policy:

```text
load live on Settings page open
manual refresh button
cached filtered snapshot for offline viewing
optional slow refresh only when Settings page is visible
```

---

### Full shot payloads

No automatic polling.

Reason:

- full shot telemetry can be larger
- analyzer/statistics should use cached data
- repeated full fetches cause lag/noise

Policy:

```text
load full shot when opened, selected for analysis, or included in statistics run
save loaded payload to IndexedDB
reuse cached payload afterward
```

---

### Statistics / Graphs

Do not auto-fetch from GaggiMate.

They should use cached data.

Policy:

```text
refresh shot/profile indexes in background
statistics run from IndexedDB/local merged data
user can manually rerun after refresh
```

---

## Anti-Spam Rules

A refresh manager must enforce:

```text
one in-flight refresh per domain
minimum interval per domain
skip polling when disconnected
skip polling when browser tab hidden, except maybe very slow refresh
never delete cache because live refresh failed
back off after repeated failures
```

Suggested initial limits:

```text
shot index: max once every 15 seconds
profiles: max once every 45 seconds
settings: max once every 5 minutes or manual only
```

---

## Suggested Implementation

Add a lightweight refresh coordinator, for example:

```text
web/src/services/RefreshCoordinator.js
```

Responsibilities:

```text
track last refresh times
track in-flight refreshes
call LibraryService refresh methods
notify UI when refreshed
avoid duplicate refreshes
listen for visibility/reconnect events
```

Do not create a new cache layer.

It should call existing services only:

```text
LibraryService
IndexedDBService
SafeGaggiMateClient
```

---

## Possible API Shape

```js
refreshCoordinator.refreshShots({ reason: 'timer' })
refreshCoordinator.refreshProfiles({ reason: 'reconnect' })
refreshCoordinator.refreshSettings({ reason: 'manual' })
refreshCoordinator.start()
refreshCoordinator.stop()
refreshCoordinator.subscribe(listener)
```

Refresh results should indicate:

```text
domain
source
updated count
refreshed at
reason
error if failed
```

---

## Page Behaviour

Pages should not each invent their own polling logic.

Pages should:

```text
load from LibraryService / IndexedDB
subscribe to refresh completion if needed
trigger manual refresh through coordinator
show last refreshed/source state
```

---

## MVP Implementation Order

1. Add refresh coordinator with throttled shot/profile refresh.
2. Hook app-level start/stop to connection and visibility.
3. Update Shot History when shot index refresh completes.
4. Update Profiles when profile refresh completes.
5. Leave Settings manual/cache-first.
6. Add UI last-refreshed indicator later if needed.

---

## Decision Summary

GaggiGo should auto-refresh lightweight live indexes into IndexedDB.

It should not repeatedly fetch full telemetry payloads.

It should not make statistics/graphs depend on live machine reads.

It should never clear good cached data because a live refresh fails.

Auto refresh is a cache hydration policy, not sync.
