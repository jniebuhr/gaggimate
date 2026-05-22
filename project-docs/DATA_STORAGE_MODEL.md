# Data Storage Model

## Purpose

Define where GaggiGo data comes from, where it is stored, what is regenerated locally, and what may sync later.

This document is a pre-sync gate.

Sync work must not start until this model is understood and preserved.

---

## Core Rule

```text
GaggiMate is the canonical raw data source.
GaggiGo is the fast local working copy and offline analysis workspace.
```

GaggiMate produces the data.

GaggiGo mirrors, indexes, analyses, annotates, and later syncs safe user data.

---

## Source Authority

### GaggiMate owns

```text
raw shot telemetry
shot history files
profiles
live runtime state
settings source data
```

GaggiMate remains the origin for machine-produced data.

GaggiGo should not pretend to be the canonical runtime source.

---

## Local Working Store

### IndexedDB is the primary local database

GaggiGo stores working data in IndexedDB via:

```text
LibraryService
↓
IndexedDBService
```

IndexedDB is used for:

```text
mirrored GaggiMate shots
mirrored GaggiMate profiles
browser-imported shots
browser-imported profiles
notes
ratings
safe metadata
future sync queue
future profile drafts
```

This is the real offline database.

New offline/sync features must use `LibraryService` and `IndexedDBService` unless there is a documented reason not to.

---

## localStorage Policy

`localStorage` is not the main data store.

Allowed localStorage use:

```text
small UI preferences
small display settings
short-lived route/session hints
read-only settings snapshot fallback if already implemented
```

Do not use localStorage for:

```text
shot telemetry blobs
profile libraries
statistics data sets
sync queues
large metadata stores
raw GaggiMate mirrors
```

`LocalCacheService` is deprecated and must not become the sync foundation.

---

## Shot Data Model

### Raw shot telemetry

Source:

```text
GaggiMate /api/history and shot files
```

Local storage:

```text
IndexedDB
```

Usage:

```text
Shot History
Shot Analyzer
Statistics
Graphs
Offline viewing
```

Important rule:

```text
Analysis views should run from the local IndexedDB mirror once data has been pulled.
```

The machine should not be treated as the live backend for every graph/statistics render.

Correct flow:

```text
GaggiMate produces shot telemetry
↓
GaggiGo pulls/mirrors it
↓
IndexedDB stores it
↓
Analyzer/statistics/graphs read local cache
```

Live GaggiMate refreshes the mirror.

It should not be repeatedly hammered for every analysis view.

---

## Profiles

Source:

```text
GaggiMate profiles API/WebSocket
```

Local storage:

```text
IndexedDB profile mirror
```

Usage:

```text
profile list
analyzer profile matching
statistics grouping
offline profile viewing
future profile drafts
```

Profile writes are safe data writes when scoped and explicit.

Connected profile actions may still write to GaggiMate through the existing API contracts.

Offline profile edits should become drafts, not silent runtime overwrites.

---

## Settings

Settings are different from shots/profiles.

Source:

```text
GaggiMate /api/settings
```

GaggiGo behaviour:

```text
live read when connected
read-only filtered display
cached snapshot fallback when offline
```

Settings are not an offline editable control panel.

Sensitive/admin/runtime details must remain hidden from GaggiGo mode.

Examples of data that should not be surfaced in GaggiGo mode:

```text
WiFi credentials
network secrets
external integration credentials
private/admin runtime configuration
```

The cached settings snapshot is for offline visibility only.

---

## Statistics and Graphs

Statistics and graphs are generated locally from cached shot/profile data.

Correct model:

```text
IndexedDB mirror
↓
Analyzer/statistics services
↓
charts/tables/results
```

Do not repeatedly fetch from GaggiMate to calculate statistics.

If statistics caching is added later, it should cache derived summaries separately from raw shot telemetry.

Suggested split:

```text
raw shot telemetry = IndexedDB source data
statistics summary = derived cache, disposable/regeneratable
charts = generated from local data at render time
```

Derived statistics can always be rebuilt from raw cached shots.

---

## Compression Policy

Do not add compression before correctness.

Compression is not required for MVP sync design.

Correct priority:

```text
1. data ownership clear
2. IndexedDB model stable
3. avoid duplicate shot blobs
4. export/import and cleanup tools
5. then consider compression
```

Possible later compression approach:

```text
keep index/metadata uncompressed
compress large raw shot sample payloads
leave derived statistics disposable
support export before storage format gets complex
```

Compression must not make debugging or recovery harder during MVP.

---

## Sync Ownership Model

Safe Sync v1 should not sync everything.

Initial sync candidates:

```text
notes
ratings
safe metadata
tags/labels
profile drafts after explicit user review
```

Do not start with:

```text
automatic bidirectional profile sync
runtime setting sync
large conflict-heavy sync
implicit overwrites
```

---

## Pending Change Model

Future sync should track pending local changes in IndexedDB.

A pending change should include:

```text
local id
entity type
entity id
source reference
operation type
payload
created at
updated at
sync status
last error
```

Suggested statuses:

```text
pending
synced
conflict
failed
ignored
```

Manual sync comes before automatic sync.

---

## Conflict Rule

GaggiMate remains source authority for machine-produced data.

GaggiGo may own local annotations and drafts.

If both sides change the same safe data field, do not silently overwrite.

Prefer:

```text
show conflict
keep local copy
allow user choice
```

---

## Practical Storage Table

| Data | Source | Local Store | Offline Use | Sync Direction |
|---|---|---|---|---|
| Raw shot telemetry | GaggiMate | IndexedDB | yes | pull/mirror |
| Shot index | GaggiMate | IndexedDB | yes | pull/mirror |
| Profiles | GaggiMate | IndexedDB | yes | pull/mirror, safe writes when explicit |
| Notes | GaggiGo/GaggiMate notes API | IndexedDB | yes | future push/pull |
| Ratings | GaggiGo | IndexedDB | yes | future push/pull |
| Tags/metadata | GaggiGo | IndexedDB | yes | future push/pull |
| Profile drafts | GaggiGo | IndexedDB | yes | future explicit push |
| Settings | GaggiMate | filtered snapshot | view only | pull only |
| Statistics | derived locally | optional derived cache | yes | no canonical sync |
| Charts | derived locally | no persistent requirement | yes | no sync |
| UI preferences | browser | localStorage allowed | yes | no sync |

---

## Implementation Rule

Before adding any new persistence or sync feature, answer:

```text
What is the source of truth?
Where is it stored locally?
Is it raw data or derived data?
Can it be rebuilt?
Can it safely sync back?
What happens offline?
What happens on conflict?
```

If those answers are unclear, do not implement the feature yet.

---

## Decision Summary

GaggiMate produces canonical raw data.

GaggiGo mirrors that data into IndexedDB.

Analyzer, statistics, and graphs run from the local IndexedDB mirror for speed and offline use.

Settings are live-read and cached only as a filtered view-only snapshot.

localStorage is not the database.

Compression is later, not before correctness.

Safe Sync v1 starts with annotations/metadata/drafts, not full automatic runtime sync.
