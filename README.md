# GaggiGo

Offline-first companion frontend for GaggiMate.

GaggiGo focuses on:

- profiles
- shot history
- statistics
- analysis
- local-first workflows
- safe synchronisation
- observability

GaggiGo is intentionally not:

- remote machine control software
- firmware management software
- OTA management
- unrestricted WebSocket administration
- brew/steam/grinder/water control UI

---

# Current Direction

GaggiGo reuses parts of the existing GaggiMate frontend shell while removing unsafe machine-control functionality.

The long-term goal is a stable offline-first PWA capable of:

- caching profiles locally
- viewing shot history offline
- analysing historical brew data
- synchronising approved safe data locally
- preserving a familiar frontend experience

---

# Current MVP Status

Working:

- frontend boots successfully
- responsive navigation restored
- mobile dropdown navigation working
- safe landing page active
- unsafe routes removed
- Settings page hardened
- local cache foundation added
- profile cache helper added
- offline-aware profile loading added
- blank-slate cache empty state added
- git workflow verified

Removed:

- /ota
- /scales
- /pidtune

Removed navigation:

- PID Autotune
- Bluetooth Devices
- System & Updates

---

# Current Offline-First Behaviour

Profiles now support:

- cache-aware loading
- local fallback when offline
- blank-slate empty-state messaging

Current model:

Connected + live data:
- show live profiles
- cache locally

Disconnected + cache exists:
- show cached profiles

Disconnected + no cache:
- show helpful empty-state message

---

# Architecture Direction

Current upstream architecture:

ESP32
↓
WebSocket/API
↓
Frontend

GaggiGo direction:

GaggiGo Frontend
↓
Local Cache Layer
↓
Safe Adapter Layer
↓
Allowlisted Operations
↓
GaggiMate API/WebSocket

Core rule:

GaggiGo must never expose unrestricted machine control.

---

# Current Main Areas

web/src/index.jsx
App shell/router

web/src/services/ApiService.js
API/WebSocket boundary

web/src/services/LocalCacheService.js
Offline cache layer

web/src/services/ProfileCacheService.js
Profile cache/fallback handling

web/src/pages/
Frontend pages

web/src/components/
Shared UI/navigation

project-docs/
Architecture + handover documentation

---

# Development Rules

- small commits
- reversible changes
- preserve stable architecture
- avoid uncontrolled rewrites
- safety before polish
- adapter-first design

Do not fight the original responsive shell architecture.

Desktop:
- sidebar navigation

Mobile:
- dropdown navigation

---

# Current Build Focus

Current focus areas:

1. Shot History caching
2. Offline history viewing
3. Analyzer integration with cached data
4. Statistics integration with cached data
5. Manual sync workflow
6. ApiService allowlisting and hardening

---

# License

Inherited upstream licensing remains applicable.