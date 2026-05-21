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

### Settings Hardened

Settings page converted into:

- safe/local preference focused
- informational
- non-machine-control UI

### Cache Foundation Added

Added:

- LocalCacheService.js
- ProfileCacheService.js

Current cache areas:

- profiles
- drafts
- shot history
- statistics
- sync queue

### Profiles Page

Profiles page now:

- supports cache-aware loading
- supports offline fallback
- supports blank-slate empty state

Current behaviour:

Connected + live data:
- show live profiles
- cache locally

Disconnected + cache exists:
- show cached profiles

Disconnected + no cache:
- show helpful empty-state message

---

## Current Technical Focus

Current focus is now:

1. Shot History caching
2. Offline history viewing
3. Analyzer integration with cached history
4. Statistics integration with cached history
5. Local-first profile draft handling
6. Manual sync workflow
7. ApiService allowlisting and hardening

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
