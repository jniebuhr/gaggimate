# Current State — GaggiGo MVP

## Active Branch

gaggigo-mvp

## Current Identity

GaggiGo has transitioned from an inherited GaggiMate frontend fork into an offline-first observer frontend.

Primary direction:

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
- safe informational homepage retained

### Unsafe Surfaces Removed

Routes removed:

- /ota
- /scales
- /pidtune

Navigation removed:

- PID Autotune
- Bluetooth Devices
- System & Updates

Settings cleanup completed.

### Live Integration Confirmed

Confirmed working:

- local Vite proxy
- live GaggiMate API access
- websocket integration
- profile loading
- shot history loading
- analyzer routing
- statistics generation
- read-only settings loading

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
- cached settings snapshot mirroring
- offline history fallback
- offline analyzer fallback
- offline statistics fallback
- offline settings fallback
- expanded shot persistence
- fast cached startup behaviour
- cache-first rendering behaviour

Current behaviour:

Connected + live data:
- show live machine data
- mirror locally

Disconnected + cache exists:
- show cached data
- allow offline analysis
- allow offline statistics
- allow offline settings viewing

Disconnected + no cache:
- show empty-state behaviour

---

## Current Technical Focus

Current focus is now:

1. Remaining live-only assumption cleanup
2. Performance optimisation
3. Empty-state refinement
4. Cache status visibility
5. Local-first editing model
6. Manual sync workflow
7. ApiService hardening
8. Repository audit

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
