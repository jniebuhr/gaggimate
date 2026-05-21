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

# License

Inherited upstream licensing remains applicable.
