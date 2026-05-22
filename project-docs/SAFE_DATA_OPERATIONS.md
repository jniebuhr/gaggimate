# Safe Data Operations

## Purpose

Define which GaggiMate API/WebSocket operations GaggiGo may use before sync work begins.

This document exists to prevent drift.

GaggiGo is a PWA/offline client and local mirror for safe GaggiMate data.

The API bridge is required.

The rule is not "avoid APIs".

The rule is:

```text
Allow safe data transfer.
Block machine control and unrestricted administration.
```

---

## Required Merge Goal

GaggiGo must remain merge-directed.

The offline-first/PWA work is not a permanent incompatible fork.

The intended outcome is that useful GaggiGo frontend improvements can merge back into GaggiMate or remain cleanly upstream-compatible.

Therefore every new change should be assessed against:

```text
Can this map back to GaggiMate data contracts, services, routes, or feature gates?
```

Prefer:

- additive frontend improvements
- feature gates / app modes
- cache-first data loading
- IndexedDB mirroring
- safe adapter methods
- existing GaggiMate API/WebSocket contracts
- upstream-compatible file structure

Avoid:

- deleting upstream capability code
- replacing GaggiMate data contracts
- creating incompatible local-only schemas
- building sync logic that cannot map to GaggiMate APIs
- turning GaggiGo into a separate product architecture without need

---

## System Model

```text
GaggiMate
= source authority
= live machine runtime
= telemetry source
= canonical profile/history/settings source

GaggiGo
= offline-first PWA
= local mirror
= historical viewer
= analyser/statistics workspace
= safe sync client later
```

---

## Current Data Flow

```text
GaggiGo UI
↓
LibraryService
↓
SafeGaggiMateClient / IndexedDBService
↓
GaggiMate API/WebSocket + browser IndexedDB
```

GaggiGo should remain compatible with GaggiMate data contracts where possible.

Avoid creating incompatible parallel data structures unless explicitly justified.

---

## Allowed Read Operations

These are safe for GaggiGo MVP:

| Area | Operation | Source | Purpose |
|---|---|---|---|
| Profiles | list profiles | GaggiMate API/WebSocket | populate profile library |
| Profiles | load profile | GaggiMate API/WebSocket | view/analyse/export profile |
| Shot history | list shots | GaggiMate HTTP API | populate shot history |
| Shot history | load shot file | GaggiMate HTTP API | analyse shot offline/online |
| Settings | load settings snapshot | GaggiMate HTTP API | read-only visibility |
| Status | receive status event | GaggiMate WebSocket | observe current machine state |

---

## Allowed Local Browser Operations

These are safe and core to the PWA model:

| Area | Operation | Storage | Purpose |
|---|---|---|---|
| Profiles | cache mirrored profiles | IndexedDB | offline viewing |
| Shots | cache mirrored shots | IndexedDB | offline history/analyser |
| Settings | cache settings snapshot | local browser storage | offline visibility |
| Notes | save notes | IndexedDB | offline user metadata |
| Ratings | save ratings | IndexedDB | offline user metadata |
| Imports | store imported files | IndexedDB | browser library |

---

## Allowed Future Sync Operations

Safe Sync v1 may include:

| Area | Operation | Direction | Notes |
|---|---|---|---|
| Notes | push/pull notes | GaggiGo ↔ GaggiMate | manual sync first |
| Ratings | push/pull ratings | GaggiGo ↔ GaggiMate | manual sync first |
| Metadata | push/pull safe metadata | GaggiGo ↔ GaggiMate | labels, tags, annotations |
| Profile drafts | push profile draft | GaggiGo → GaggiMate | only after explicit user action |
| Imports | push imported shot/profile | GaggiGo → GaggiMate | only if format compatible |

Sync must be explicit and reviewable first.

Automatic sync can be considered later after manual sync is reliable.

---

## Remote Profile Writes

Profile writes are safe data operations only when clearly scoped.

Examples:

```text
profile save
profile import
profile reorder
profile favourite/unfavourite
profile delete
profile select
```

These are not machine actuation commands, but they do mutate GaggiMate data.

Therefore they must be treated as:

```text
safe data writes, not controls
```

Rules:

1. They may use GaggiMate-compatible APIs.
2. They should be routed through explicit named methods.
3. They should not be hidden behind raw `apiService.request()` calls in page components long term.
4. Offline versions should become local drafts or queued changes.
5. Push back to GaggiMate should be manual/reviewable first.

---

## Blocked Operations

GaggiGo must not expose:

```text
brew start/stop
steam/water controls
grinder control
PID/autotune
OTA/firmware updates
Bluetooth device management
raw websocket admin UI
unrestricted settings writes
external integration management
```

These remain outside GaggiGo scope.

In merge-back terms, these should be mode-gated or hidden from GaggiGo mode, not treated as code that must vanish from GaggiMate.

---

## Safe Adapter Requirement

Low-level transport may remain in:

```text
web/src/services/ApiService.js
```

But app code should move toward named adapter methods:

```text
SafeGaggiMateClient.listProfiles()
SafeGaggiMateClient.loadProfile(id)
SafeGaggiMateClient.saveProfileDraft(...)
SafeGaggiMateClient.pushProfile(...)
SafeGaggiMateClient.deleteRemoteProfile(id)
```

This keeps API compatibility while avoiding unrestricted websocket spread.

---

## Merge-Back Principle

Because GaggiGo must merge back or remain cleanly mergeable with GaggiMate, prefer:

- upstream-compatible service structure
- existing data contracts
- thin adapter layers
- `LibraryService` and `IndexedDBService` reuse
- minimal fork-specific abstractions
- feature gates over permanent removals

Avoid:

- replacing GaggiMate data contracts
- inventing parallel cache architecture
- deep UI rewrites
- sync logic that cannot map back to GaggiMate APIs
- permanent divergence where a feature gate would work

---

## MVP Sync Recommendation

Start with:

```text
manual sync
notes
ratings
safe metadata
profile drafts only after review
```

Do not start with:

```text
automatic bidirectional profile sync
conflict-heavy profile ordering sync
machine settings writes
control actions
```

---

## Decision Summary

APIs are required.

Safe data writes are allowed.

Machine control is not allowed in GaggiGo mode.

GaggiMate remains source authority.

GaggiGo becomes the offline PWA mirror and safe sync client.

Merge-back is a required architecture goal, not an optional future possibility.
