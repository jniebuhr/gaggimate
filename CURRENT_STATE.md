# Current State — GaggiGo MVP

## Active Branch

gaggigo-mvp

## Current Identity

GaggiGo is now transitioning from an inherited GaggiMate frontend fork into an offline-first observer frontend.

Current direction:

- profiles
- shot history
- statistics
- shot analysis
- local cache
- offline viewing
- safe sync later

GaggiGo is not machine control software.

---

## Completed

### Stable Shell

- responsive sidebar preserved
- mobile dropdown preserved
- stable layout retained
- landing page replaced with safe informational dashboard

### Unsafe Surfaces Removed

Routes removed:

- /ota
- /scales
- /pidtune

Navigation removed:

- PID Autotune
- Bluetooth Devices
- System & Updates

### Live Integration Confirmed

Confirmed working:

- local Vite proxy
- live GaggiMate API access
- websocket integration
- profile loading
- shot history loading
- analyzer routing

### Offline Persistence Layer

Current architecture:

Browser
↓
LibraryService
↓
GaggiMate + IndexedDB

Completed:

- IndexedDB persistence integrated
- cached GaggiMate shot mirroring
- cached GaggiMate profile mirroring
- offline history fallback
- offline analyzer fallback
- expanded shot persistence
- fast cached startup behaviour

Current behaviour:

Connected + live data:
- show live machine data
- mirror locally

Disconnected + cache exists:
- show cached data
- allow offline analysis

Disconnected + no cache:
- show empty-state behaviour

---

## Current Technical Focus

Current focus is now:

1. Statistics integration
2. Settings cleanup
3. Offline-first startup hardening
4. Background refresh behaviour
5. Local-first editing model
6. Manual sync workflow
7. ApiService hardening

---

## Important Stable Files

Do not modify without reason:

- web/src/index.jsx
- web/src/components/Navigation.jsx
- web/src/components/Header.jsx
- web/src/pages/Home/index.jsx

---

## Working Mental Model

GaggiMate controls the machine.

GaggiGo observes, stores, analyses, caches, and later synchronises safe data.
