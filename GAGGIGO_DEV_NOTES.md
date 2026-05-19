# GaggiGo Dev Notes

## Project Position

GaggiGo is an offline-first companion PWA for GaggiMate.

The goal is to preserve the existing GaggiMate UI/UX while removing unsafe machine-control functionality and adding offline caching and safe synchronisation.

GaggiGo is not remote machine control software.

---

# Core Safety Rule

GaggiGo must never:
- start brewing
- activate grinder
- activate steam
- activate hot water
- change live machine modes
- trigger OTA updates
- expose raw unrestricted WebSocket control remotely

GaggiGo may:
- view profiles
- edit/create profiles
- analyse shot history
- cache settings/history/profiles locally
- synchronise approved safe data when locally connected

---

# Confirmed Frontend Stack

Inherited from existing GaggiMate frontend:

- Preact
- Vite
- TailwindCSS
- DaisyUI
- Chart.js

Likely storage approach:
- IndexedDB
- local sync queue
- cached profile/history/settings state

---

# Confirmed Main Files

## App Entry
web/src/index.jsx

## WebSocket/API Layer
web/src/services/ApiService.js

## Desktop Navigation
web/src/components/Navigation.jsx

## Mobile/Header Navigation
web/src/components/Header.jsx

---

# Current Important Repo Areas

web/src/index.jsx

web/src/components/

web/src/pages/

web/src/services/

web/public/

schema/

---

# Current Navigation Structure

## Safe Sections To Keep

- Profiles
- Shot History
- Shot Analyzer
- Statistics
- Settings View

## Unsafe Sections To Remove/Disable

- PID Autotune
- Bluetooth Devices
- OTA/System Updates

Dashboard route `/` requires review because it may expose live controls.

---

# Critical Safety Boundary

All GaggiMate communication flows through:

web/src/services/ApiService.js

All GaggiMate communication must pass through a single allowlisted adapter layer.

No UI component should directly send unsafe WebSocket commands.

---

# Known Current WebSocket Risks

Existing WebSocket layer can likely:
- activate/deactivate process
- activate grinder
- change machine mode
- raise/lower temperature
- start OTA
- trigger autotune
- flush machine
- save/delete/select profiles

GaggiGo must not expose unrestricted command sending.

---

# Safe Features

- Profiles
- Shot History
- Shot Analyzer
- Statistics
- Settings View
- Offline cache
- Pending sync queue
- Manual sync
- Automatic local sync while app is active

---

# Unsafe Features To Remove

- Brew activation
- Grinder activation
- Steam activation
- Hot water activation
- Flush activation
- PID Autotune
- Bluetooth device control
- OTA update controls
- Live machine mode switching
- Raw WebSocket passthrough
- Temperature adjustment controls

---

# MVP Architecture

## Current GaggiMate Model

GaggiMate ESP32 → Local Web UI → Direct WebSocket/API

## GaggiGo Model

GaggiGo PWA → Local Cache → Safe Sync Adapter → GaggiMate Local API

---

# Core Architecture Layers

## 1. UI Layer
Reused GaggiMate frontend/pages/components.

## 2. Local Data Layer
IndexedDB/local persistence.

Stores:
- cached profiles
- cached settings
- cached shot history
- pending edits
- last sync state

## 3. Sync Adapter
Responsible for:
- detecting GaggiMate availability
- pulling safe data
- pushing approved profile edits
- conflict handling
- blocking unsafe operations

## 4. Safety Gate
Explicit allowlist only.

No unrestricted raw command passthrough.

---

# Allowed Operations (MVP)

Likely allowed:
- profile list/load/save
- profile import/export
- history list/read
- settings read
- statistics/history analysis
- cached offline review

Settings writes disabled initially unless explicitly approved later.

---

# Blocked Operations (MVP)

Must block:
- req:process:*
- req:grind:*
- req:change-mode
- req:raise-temp
- req:lower-temp
- req:ota-start
- req:autotune-start
- req:flush:start

---

# Automatic Sync Behaviour

## Pull Logic

When app opens:

1. Load cached local data immediately.
2. Attempt local connection to GaggiMate.
3. If reachable:
   - pull settings
   - pull profiles
   - pull history
   - cache new data
4. Update last sync timestamp.

## Push Logic

When connected:
- push pending safe profile edits
- prevent unsafe writes
- re-pull latest machine state afterwards

---

# Conflict Handling

Never blindly overwrite profiles.

If:
- local profile changed
- AND machine copy also changed

Then:
- pause automatic push
- show conflict state
- allow user to:
  - keep local
  - keep machine version
  - duplicate local as new profile

---

# Permanent Non-Goals

- Remote brewing
- Cloud-first architecture
- Live machine control
- OTA management
- Always-on bridge devices
- Home Assistant dependency
- Rewriting GaggiMate frontend from scratch
- Native iOS app initially
- App Store release initially

---

# Known Good State

- Repo clones correctly
- npm install succeeds
- npm run dev succeeds
- Vite frontend reachable at localhost:5173
- Branch gaggigo-mvp active
- Git push/pull verified
- Local branding edits verified
- Hot reload verified

---

# Development Rules

This project must not be vibe-coded.

Rules:
- small commits
- one feature per commit
- reversible changes
- preserve working logic until understood
- safety before polish
- adapter-first architecture
- no uncontrolled rewrites

Preferred commit examples:
- map frontend structure
- remove unsafe navigation routes
- add safe api adapter
- add local cache skeleton
- add profile sync queue

---

# Immediate Next Goal

1. Remove unsafe navigation entries.
2. Preserve profiles/history/settings/analyzer/statistics.
3. Review dashboard for unsafe live controls.
4. Create safe API adapter layer.
5. Keep app booting cleanly throughout.

---

# First Real Technical Milestone

GaggiGo:
- boots locally
- looks like GaggiMate
- connects locally to GaggiMate
- pulls profiles/history/settings
- caches data offline
- reloads offline successfully
- exposes no unsafe machine controls

That proves the MVP architecture works.