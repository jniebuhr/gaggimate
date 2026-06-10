# GAGGIMATE_HOSTED_PWA_ROADMAP.md

## Purpose

This document defines the concrete roadmap for validating the intended GaggiMate-hosted GaggiGo PWA architecture.

The goal is to prove, before merge-back, whether the existing GaggiMate web UI can become one user-facing app that behaves as:

```text
GaggiMate when online / reachable
GaggiGo cached observer when offline / unreachable
```

This document exists to prevent:

- blind patching
- GitHub-hosted PWA drift
- second-app installation drift
- assumptions about offline PWA behaviour
- premature merge-back into master
- reintroduction of machine-control behaviour into GaggiGo observer code

---

## Intended User Experience

The intended user flow is:

```text
Turn on GaggiMate
↓
Connect through the existing GaggiMate setup / network flow
↓
Open the GaggiMate web UI
↓
Save/install the same app to the phone or PC home screen
↓
Use the same app online and offline
```

No normal user should need to:

```text
Visit GitHub
Install from GitHub Pages
Install a second app manually
Understand Vite, PWA, service workers, or IndexedDB
```

---

## Product Model

### GaggiMate

```text
Machine authority
Live runtime authority
Telemetry authority
Setup/network authority
API authority
Web UI host
```

### GaggiGo Layer

```text
Offline-first observer layer
IndexedDB mirror
Historical viewer
Analyzer workspace
Statistics workspace
Archive layer
Future safe sync client
```

### Combined Target

```text
One app shell
One user-facing web UI
Online mode uses GaggiMate authority
Offline mode uses GaggiGo local mirror
```

---

## Non-Negotiable Boundaries

Never reintroduce into the GaggiGo observer layer:

- machine controls
- OTA
- PID/autotune
- Bluetooth management
- raw websocket admin
- unrestricted settings writes

Live-control surfaces remain GaggiMate-owned.

Cache-first/offline observer surfaces may be handled by the GaggiGo layer.

---

## Proven Repository Evidence

### Master Branch Evidence

The master branch already contains the original GaggiMate web application structure:

```text
web/src/index.jsx
```

It includes routes for:

- Home
- Profiles
- Settings
- OTA
- Scales
- Autotune
- Shot History
- Shot Analyzer
- Statistics

The master branch Vite config already proxies development traffic:

```text
/api -> http://gaggimate.local
/ws  -> ws://gaggimate.local
```

This proves the existing GaggiMate web app already follows a web-UI-to-GaggiMate-API model.

### GaggiGo MVP Branch Evidence

The gaggigo-mvp branch adds the PWA/offline layer through:

```text
vite-plugin-pwa
service worker generation
manifest inclusion
precache rules
navigateFallback
IndexedDB mirror
LibraryService authority
Archive services
cache-first History / Analyzer / Statistics
```

### Firmware Static Serving Evidence

The GaggiMate firmware already serves a web UI from device storage.

Observed in:

```text
src/display/plugins/WebUIPlugin.cpp
```

Relevant serving behaviour:

```cpp
server.serveStatic("/", SPIFFS, "/w")
  .setDefaultFile("index.html")
  .setCacheControl("max-age=0");
```

Fallback behaviour:

```cpp
server.onNotFound([](AsyncWebServerRequest *request) {
  request->send(SPIFFS, "/w/index.html");
});
```

History API serving behaviour:

```cpp
server.serveStatic("/api/history/", *fs, "/h/")
  .setCacheControl("no-store");
```

This proves the target architecture is not speculative. GaggiMate already hosts web assets and exposes stored history data. The unresolved question is whether the PWA app shell and service worker can be correctly packaged, served, installed, and relaunched offline from this same device-hosted origin.

---

## Proven Validated GaggiGo Capabilities

Already validated in the project state:

```text
History rendering: PASS
Analyzer rendering: PASS
Statistics rendering: PASS
IndexedDB authority: PASS
Archive export: PASS
Archive restore: PASS
Duplicate protection: PASS
Offline data layer: PASS
Production build: PASS
Lint: PASS
Sonar cleanup: PASS
```

Therefore the remaining blocker is not the cache model itself.

The remaining blocker is deployment/install/runtime validation of the GaggiMate-hosted app shell.

---

## Known Unknowns

The following must not be assumed:

### Unknown 1 — SPIFFS PWA Asset Presence

We do not yet know whether the final flashed `/w/` filesystem contains:

```text
/w/index.html
/w/sw.js
/w/workbox-*.js
/w/app.webmanifest
/w/gm.svg
/w/gm.png
/w/assets/*
```

### Unknown 2 — Service Worker Registration From GaggiMate Origin

We do not yet know whether the GaggiMate-served web UI successfully registers a service worker on the target device.

### Unknown 3 — Service Worker Control

We do not yet know whether the registered service worker controls the page after install/reload.

### Unknown 4 — Offline Shell Relaunch

We do not yet know whether the saved/installed app shell opens when GaggiMate is unreachable.

### Unknown 5 — iPhone Home Screen Behaviour

We do not yet know whether iOS Safari/Home Screen preserves the service worker and IndexedDB behaviour for this local-device-hosted app shell.

---

## Gate 3A — Static Asset Audit

### Objective

Prove what is actually served from the GaggiMate device.

### Required Manual Checks

With GaggiMate running and reachable, open these URLs from a browser:

```text
http://gaggimate.local/
http://gaggimate.local/index.html
http://gaggimate.local/sw.js
http://gaggimate.local/app.webmanifest
http://gaggimate.local/assets/
```

Where `gaggimate.local` fails, repeat using the device IP address.

### Pass Criteria

```text
index.html loads
sw.js loads
app.webmanifest loads
hashed assets load
no missing PWA build files
```

### Fail Criteria

```text
sw.js missing
manifest missing
assets missing
404 for generated files
```

### Result Handling

If this gate fails, fix build packaging / filesystem upload before touching application logic.

---

## Gate 3B — Static Serving Header Audit

### Objective

Prove GaggiMate serves app shell assets with headers compatible with offline PWA caching.

### Current Known Risk

The current firmware serves the web app with:

```text
Cache-Control: max-age=0
```

This is acceptable for a live web UI but may be insufficient for a durable offline app shell.

### Required Review

Confirm serving behaviour for:

```text
index.html
sw.js
workbox-*.js
app.webmanifest
hashed JS/CSS assets
/api/*
/api/history/*
```

### Target Policy

```text
index.html: no-cache or short cache
sw.js: no-cache
app.webmanifest: no-cache or short cache
hashed assets: long cache acceptable
/api/*: no-store
/api/history/*: no-store or explicit live-data policy
```

### Boundary

Do not apply `no-store` to the entire app shell.

Live API data and static PWA shell assets must be treated separately.

---

## Gate 3C — Service Worker Registration Audit

### Objective

Prove the service worker registers from the actual GaggiMate-served origin.

### Required Browser Console Checks

After loading the device-hosted app:

```javascript
window.isSecureContext
```

```javascript
await navigator.serviceWorker.getRegistrations()
```

```javascript
navigator.serviceWorker.controller
```

### Pass Criteria

```text
Service worker registration exists
Service worker activates
Controller is assigned after reload
```

### Fail Criteria

```text
No registration
Registration error
SSL/security error
Controller remains null after reload
```

### Result Handling

If this gate fails, do not merge further.

Classify the failure as one of:

```text
origin/security issue
asset path issue
service worker scope issue
manifest/build issue
browser limitation
```

---

## Gate 3D — Offline App Shell Relaunch

### Objective

Prove the app shell survives loss of the host.

### Procedure

```text
1. Load GaggiMate web UI.
2. Confirm service worker active and controlling page.
3. Save/install app to Home Screen.
4. Open installed app once while GaggiMate is reachable.
5. Turn off or disconnect GaggiMate.
6. Reopen installed app.
```

### Pass Criteria

```text
App shell opens
Navigation renders
Offline/cached status is visible
No blank screen
No browser fatal error
```

### Fail Criteria

```text
App cannot open
Blank screen
Browser tries only to reload from unavailable host
Service worker does not serve shell
```

---

## Gate 3E — IndexedDB Offline Data Validation

### Objective

Prove cached project data survives and renders when GaggiMate is unavailable.

### Procedure

```text
1. Load app while GaggiMate is reachable.
2. Hydrate shots/profiles/settings/history.
3. Confirm data exists in IndexedDB.
4. Disconnect GaggiMate.
5. Reopen installed app.
6. Validate offline pages.
```

### Pass Criteria

```text
History loads from IndexedDB
Analyzer loads from IndexedDB
Statistics loads from IndexedDB
Archive page loads
Profiles show cached state
Settings show safe cached/read-only state
```

### Fail Criteria

```text
Pages require live API to render
Analyzer waits on GaggiMate
Statistics waits on GaggiMate
History waits on live files
Cached data unavailable
```

---

## Gate 3F — Machine-Control Boundary Validation

### Objective

Prove offline observer mode does not expose unsafe machine-control actions.

### Required Behaviour

When GaggiMate is unreachable:

```text
Home/live machine controls unavailable
OTA unavailable
PID/autotune unavailable
Bluetooth/scales management unavailable
Raw websocket admin unavailable
Settings writes unavailable
```

Allowed offline behaviour:

```text
History viewing
Analyzer viewing
Statistics viewing
Archive export/import
Cached profile/settings viewing
```

---

## Gate 3G — SPA Fallback Review

### Objective

Ensure single-page-app routing works without swallowing API errors.

### Current Risk

Current fallback behaviour sends `/w/index.html` for all unknown paths.

This supports browser routes but may incorrectly handle API failures.

### Target Behaviour

```text
If path starts with /api:
  return API 404/error

Else:
  return /w/index.html
```

### Pass Criteria

```text
/profile routes reload correctly
/history routes reload correctly
/analyzer routes reload correctly
/api/missing returns API error, not index.html
```

---

## Gate 3H — Packaging / Filesystem Build Audit

### Objective

Prove the production build is copied into the firmware filesystem image correctly.

### Required Checks

Identify and validate the build path:

```text
web/dist
↓
SPIFFS / filesystem source
↓
/w/
↓
flashed device storage
```

### Required Files

```text
/w/index.html
/w/sw.js
/w/workbox-*.js
/w/app.webmanifest
/w/assets/*.js
/w/assets/*.css
/w/gm.svg
/w/gm.png
```

### Pass Criteria

```text
All required files present after filesystem upload/firmware flash
Paths match service worker scope
Manifest start_url resolves correctly
```

---

## Merge Strategy

Do not merge gaggigo-mvp wholesale into master.

Use a staged integration approach:

```text
1. PWA build plumbing
2. Filesystem packaging validation
3. Static serving/header adjustments
4. IndexedDBService
5. LibraryService/cache authority
6. Hydration logic
7. Cache-first History
8. Cache-first Analyzer
9. Cache-first Statistics
10. Archive/storage surfaces
11. Offline indicators and empty states
12. Documentation and validation gates
```

Live control surfaces remain GaggiMate-owned.

Observer/cache surfaces become GaggiGo-enhanced.

---

## Proof-of-Concept Definition

A valid proof of concept is not a visual demo.

A valid proof of concept must prove:

```text
Device-hosted app shell loads
Service worker registers
Service worker controls page
App is saved/installed to Home Screen
GaggiMate is turned off/unreachable
Installed app relaunches
History renders from IndexedDB
Analyzer renders from IndexedDB
Statistics renders from IndexedDB
Machine controls are unavailable while offline
```

If any of those fail, Gate 3 remains open.

---

## Decision Rules

### If All Gate 3 Tests Pass

Proceed to merge-back readiness audit.

Selected architecture becomes:

```text
GaggiMate-hosted single app
with GaggiGo offline observer layer
```

### If Service Worker Fails Due To Packaging

Fix filesystem packaging and retry Gate 3.

### If Service Worker Fails Due To Serving Headers

Fix WebUIPlugin static serving/header policy and retry Gate 3.

### If Service Worker Fails Due To Browser Security / Local-Origin Limitation

Pause merge-back.

Re-evaluate:

```text
hosted HTTPS PWA linked from GaggiMate
archive-only handoff
local bridge
other constrained alternatives
```

### If IndexedDB Rendering Fails

Do not modify firmware.

Fix cache authority/hydration/rendering paths in GaggiGo first.

---

## Current Decision

Current decision is not yet implementation.

Current decision is:

```text
Validate GaggiMate-hosted single-app PWA feasibility before merge-back.
```

Feature development remains blocked.

Merge-back remains blocked.

Safe Sync remains blocked.

---

## Next Action

Run Gate 3A through Gate 3H in order.

Do not patch application logic until the failing gate is identified.

Do not merge into master until the proof of concept passes on the target device.
