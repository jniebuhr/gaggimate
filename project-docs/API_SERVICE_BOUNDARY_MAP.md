# ApiService Boundary Map — GaggiGo MVP

## Purpose

This document defines which GaggiMate API/WebSocket operations are safe for GaggiGo and which operations affect machine/runtime state.

GaggiGo remains:

```text
observer
IndexedDB mirror
historical viewer
analyzer/statistics workspace
future archive/sync client
```

GaggiGo must not become a machine controller.

---

## Read / Hydration Operations

Allowed for normal GaggiGo use:

```text
req:profiles:list
req:profiles:load
/api/history/index.bin
/api/history/*.slog
req:history:notes:get
```

Purpose:

```text
read from GaggiMate
hydrate IndexedDB
refresh local mirror
support offline viewing and analysis
```

These are observer-safe.

---

## User Data Writes

Allowed only where the UI explicitly represents user data editing:

```text
req:history:notes:save
```

Purpose:

```text
save notes/metadata linked to shot history
```

This is not machine control, but it is still a write and must remain explicit.

---

## Machine / ESP32 State Writes

These are not ordinary cache writes.

They affect GaggiMate or ESP32 profile state:

```text
req:profiles:save
req:profiles:reorder
req:profiles:select
req:profiles:favorite
req:profiles:unfavorite
req:profiles:delete
req:history:delete
```

Important context:

```text
favorite / unfavorite affects which profiles are stored in the ESP32 profile slots.
The ESP32 can only hold a limited active profile/program set.
```

These operations must not be treated as passive sync.

They require explicit UI intent and must not be triggered by automatic hydration, background sync, archive restore, or cache reconciliation.

---

## Forbidden / Out of Scope

Do not introduce or reintroduce:

```text
machine controls
brew controls
steam controls
grind controls
pump controls
heater controls
PID/autotune
OTA
Bluetooth management
raw websocket admin
unrestricted settings writes
automatic profile slot writes
automatic restore-to-machine behaviour
```

---

## Current Safe Rule

```text
GaggiMate hydrates the local mirror.
GaggiGo renders from the local mirror.
```

Hydration is allowed.

Automatic machine mutation is not.

---

## Implementation Notes

Current boundary files:

```text
web/src/services/ApiService.js
web/src/services/SafeGaggiMateClient.js
web/src/pages/ShotAnalyzer/services/LibraryService.js
web/src/pages/ShotAnalyzer/services/IndexedDBService.js
```

Current persistence authority:

```text
LibraryService
↓
IndexedDBService
↓
IndexedDB
```

Do not create a parallel cache/persistence service.

`LocalCacheService` has been removed as deprecated dead architecture.

---

## Future Sync Rule

When sync/archive work begins:

```text
sync safe metadata first
never auto-write profile slots
never restore machine state without explicit user action
prefer GaggiMate export/import flows where possible
```
