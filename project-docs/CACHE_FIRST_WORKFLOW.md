# Cache-First Workflow

## Purpose

Define the correct GaggiGo data workflow before any further analyzer, statistics, history, or sync work.

This document supersedes any older mental model where pages choose directly between live GaggiMate data and cached data.

---

## Core Ownership Model

```text
GaggiMate
= machine authority
= runtime owner
= source of truth for raw machine-produced data
= stores profiles, shot history, and shot files on the ESP32

GaggiGo
= observer/frontend workspace
= local device mirror
= offline analysis and statistics layer
= safe sync client later
```

GaggiGo must not become a machine-control frontend.

GaggiMate controls the machine.

GaggiGo observes, stores, analyses, annotates, and later synchronises safe user data.

---

## Correct Data Flow

### Shots, history, profiles, analyzer, statistics

```text
GaggiMate ESP32 files/API/WebSocket
↓
hydration/import/refresh layer
↓
IndexedDB local mirror
↓
LibraryService local read API
↓
Shot History / Shot Analyzer / Statistics
```

The UI should not decide whether to use live data or cached data.

The UI should read through `LibraryService`, and `LibraryService` should return the best local mirror data available.

Live GaggiMate access exists to hydrate or refresh IndexedDB, not to act as the render backend for analyzer/statistics.

---

## Page Rules

### Shot History

Shot History should render from the local IndexedDB mirror.

When connected, GaggiMate should refresh the mirror.

When disconnected, the same page should continue reading the same local mirror.

The page may show source/cache badges, but source badges are presentation only. They must not drive separate data architectures.

---

### Shot Analyzer

Shot Analyzer must receive full shot payloads from IndexedDB.

Required payload:

```text
id
storageKey
gaggimateId when applicable
source
profile/profileId
loaded
samples[]
metadata
```

If a shot entry has no `samples`, it is metadata only and is not enough for charting.

Analyzer graphs must never depend on repeated live `.slog` fetches during render.

Live `.slog` fetch is allowed only as a hydration step that saves the full payload into IndexedDB.

---

### Statistics

Statistics must run from full local shot payloads in IndexedDB.

Statistics must not calculate from live GaggiMate responses directly.

Statistics may trigger hydration for missing full payloads while connected, but the result must be saved locally first and then analysed from the local model.

If no full payloads are present, statistics should report missing hydrated shot payloads rather than silently showing zeroes.

---

### Profiles

Profiles should also be mirrored locally.

Connected profile writes may go to GaggiMate only when explicitly scoped through safe profile operations.

Offline profile edits should become drafts later, not silent machine overwrites.

---

## Settings Exception

Settings are different.

```text
GaggiMate = read/write settings authority
GaggiGo = read-only filtered settings viewer
Offline GaggiGo = filtered cached snapshot viewer only
```

GaggiGo must not cache or expose raw sensitive settings.

Connected behaviour:

```text
read settings from GaggiMate
filter/remove sensitive/admin/runtime-only fields
display read-only safe view
optionally cache only the filtered snapshot
```

Offline behaviour:

```text
display filtered cached snapshot only
no writes
no edits
no raw values
```

Never store full raw settings locally just to hide them in the UI.

Sensitive data that must not be surfaced or cached raw:

```text
WiFi SSID/password
network secrets
HomeKit data
MQTT credentials
tokens/API keys
external integration secrets
admin/runtime-only configuration
```

Settings must not be part of Safe Sync v1.

---

## Implementation Boundary

The code should move toward these roles:

```text
SafeGaggiMateClient
= safe named GaggiMate reads/writes
= hydration source only for shots/history/profiles
= filtered source for settings

IndexedDBService
= local persistent mirror
= full shot/profile payload storage
= future pending sync queue storage

LibraryService
= single local read abstraction for pages
= refresh/hydration orchestration through existing services
= no parallel cache architecture

Pages
= render local model
= ask LibraryService for data
= do not contain live-vs-cache decision trees
```

---

## Anti-Pattern To Remove

Avoid page-level logic like:

```text
if live then fetch GaggiMate
else fetch IndexedDB
```

Avoid treating `gaggimate` and `gaggimate-cache` as two competing UI data worlds.

Preferred model:

```text
GaggiMate-origin shot
↓
local mirror record
↓
UI reads local mirror record
```

The record may keep origin/source metadata for display, but analyzer/statistics should care primarily about whether a full local payload exists.

---

## Current Fix Target

Before sync, polish, or empty-state work, fix this path:

```text
GaggiMate shot file
↓
full payload saved to IndexedDB
↓
Shot Analyzer loads full local payload
↓
Statistics loads full local payloads
↓
graphs and metrics run offline from samples[]
```

Do not proceed to sync until this works reliably.

---

## Decision Summary

GaggiMate supplies machine data.

GaggiGo stores a full local mirror.

History, analyzer, graphs, and statistics read local mirror data.

Live GaggiMate refreshes and hydrates the mirror.

Settings remain a filtered read-only exception.
