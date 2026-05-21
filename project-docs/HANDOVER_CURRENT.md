# Current Branch
gaggigo-mvp
# Current Status
Frontend operational.
Unsafe routes removed:
- /ota
- /scales
- /pidtune
Unsafe navigation removed:
- PID Autotune
- Bluetooth Devices
- System & Updates
Safe sections retained:
- Dashboard
- Profiles
- Shot History
- Shot Analyzer
- Statistics
- Settings
Home page replaced with safe informational landing page.
# Important Files
web/src/index.jsx
Main router/layout
web/src/components/Navigation.jsx
Desktop sidebar navigation
web/src/components/Header.jsx
Mobile dropdown navigation
web/src/pages/Home/index.jsx
Safe landing page
web/src/services/ApiService.js
Main API/WebSocket layer
# Important Architectural Discovery
Original upstream sidebar is responsive-only:
<nav className='hidden lg:col-span-2 lg:block'>
Meaning:
- sidebar hidden on smaller widths
- mobile dropdown used instead
Do NOT fight this architecture.
# Current Goal
Transform GaggiMate frontend into:
- safe observability frontend
- offline profile manager
- statistics/history frontend
NOT remote machine control software.
