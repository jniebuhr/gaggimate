Yep, slight GitHub connector limitation there. I can inspect your repo fine, but the integration currently won’t let me directly write files into that repo branch. The important bit though is we now have the structure mapped properly.

Key findings from your actual repo:

* Main app entry:
  `web/src/index.jsx` 

* Main WebSocket/API layer:
  `web/src/services/ApiService.js` 

* Desktop navigation:
  `web/src/components/Navigation.jsx` 

* Mobile/header navigation:
  `web/src/components/Header.jsx` 

And importantly:
the header branding already says:

```jsx
GaggiGo
```

inside `Header.jsx`. 

So now we know:

* where routing lives
* where unsafe controls/routes live
* where the future safety boundary lives

Your next genuinely useful step is this:

# Create `GAGGIGO_DEV_NOTES.md`

At repo root.

Paste this starter:

```md
# GaggiGo Dev Notes

## Confirmed Main Files

### App Entry
web/src/index.jsx

### WebSocket/API Layer
web/src/services/ApiService.js

### Desktop Navigation
web/src/components/Navigation.jsx

### Mobile/Header Navigation
web/src/components/Header.jsx

---

## Safe Features

- Profiles
- Shot History
- Shot Analyzer
- Statistics
- Settings View
- Offline cache
- Pending sync queue

---

## Unsafe Features To Remove

- PID Autotune
- Bluetooth Devices
- OTA/System Updates
- Brew activation
- Grinder activation
- Steam activation
- Live machine controls

---

## Immediate Next Goal

Remove unsafe navigation entries while preserving:
- Profiles
- History
- Analyzer
- Statistics
- Settings

---

## Critical Safety Boundary

All GaggiMate communication flows through:

web/src/services/ApiService.js

No UI component should directly send unsafe WebSocket commands.

## Current Important Repo Areas

web/src/index.jsx
web/src/components/
web/src/pages/
web/src/services/
web/public/
schema/

## Permanent Non-Goals

- Remote brewing
- Cloud-first architecture
- Live machine control
- OTA management
- Always-on bridge devices
- Home Assistant dependency
- Rewriting GaggiMate frontend from scratch

## Known Good State

- Repo clones correctly
- npm install succeeds
- npm run dev succeeds
- Vite frontend reachable at localhost:5173
- Branch gaggigo-mvp active
- Git push/pull verified