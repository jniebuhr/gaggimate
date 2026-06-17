# PWA_DEPLOYMENT_VALIDATION_STATUS.md

## Purpose

This document records the current GitHub Pages / PWA deployment validation state for GaggiGo.

The repo is the source of truth for the next thread.

---

## Current Phase

```text
Deployment Validation
```

This is evidence collection and deployment hardening.

It is not:

```text
production release
safe sync
merge-back
new feature development
machine control work
```

---

## Current Deployment Target

GitHub Pages publishes from:

```text
Branch: gaggigo-mvp
Folder: /docs
```

Hosted app URL:

```text
https://tyrlabsos.github.io/GaggiGo/
```

Feasibility harness URL:

```text
https://tyrlabsos.github.io/GaggiGo/https-feasibility/
```

---

## Completed Evidence

### HTTPS / PWA Shell

Status:

```text
PASS
```

Validated:

```text
Secure context
Service worker availability
Service worker registration
Service worker control
PWA installability
PWA launch
```

---

### GitHub Pages Application Deployment

Status:

```text
PASS
```

Validated:

```text
Actual GaggiGo frontend now deploys to GitHub Pages root path.
Pages root no longer serves only the feasibility page.
```

Latest deployment validation rebuild:

```text
d37f371 deploy: rebuild Pages app with base-aware navigation
```

---

### Pages Base Path Fixes

Status:

```text
PASS
```

Problem found:

```text
The app was deployed under /GaggiGo/ but internal routes and links assumed /.
```

Symptoms observed:

```text
/GaggiGo/ initially rendered app 404.
After router patch, dashboard worked but tabs routed to 404.
```

Fixes applied:

```text
fd162fb fix: support Pages base path in app routes
143fd67 fix: make desktop navigation links base-aware
f28c5f0 fix: make header navigation links base-aware
d37f371 deploy: rebuild Pages app with base-aware navigation
```

Current result:

```text
Dashboard loads.
Profiles loads.
History loads.
Analyzer loads.
Statistics loads.
Storage loads.
Settings loads.
No tab-level 404 remains.
```

---

### Local WebSocket From Hosted HTTPS Page

Status:

```text
PASS
```

Validated from hosted GitHub Pages page:

```javascript
const ws = new WebSocket('ws://192.168.0.129/ws');
```

Observed:

```text
MANUAL WS OPEN
MANUAL WS MESSAGE evt:status
```

Live status telemetry streamed repeatedly from GaggiMate.

Conclusion:

```text
GitHub Pages HTTPS origin can open the local GaggiMate ws:// WebSocket in the tested browser context.
```

---

### Local HTTP API From Hosted HTTPS Page

Status:

```text
FAIL / BLOCKED BY BROWSER POLICY
```

Observed:

```text
/api/status returned HTTP 200 at network level, but browser blocked script access due to mixed content and CORS.
```

Conclusion:

```text
Direct HTTP API fetch from hosted HTTPS frontend is not currently a viable hydration path.
WebSocket-only access remains the viable path under current evidence.
```

---

## Current Open Defect

Status:

```text
OPEN
```

Symptom:

```text
The hosted app loads and all tabs route correctly, but no live machine information is shown in the UI.
```

Evidence:

```text
Manual WebSocket works.
Application UI still does not populate live data.
```

Current likely cause:

```text
Deployment/runtime configuration or frontend data initialisation issue.
```

Highest-probability next check:

```text
Confirm whether the Pages build was compiled with VITE_GAGGIMATE_HOST=192.168.0.129.
```

Likely next rebuild command if missing:

```powershell
cd C:\Users\ed\GaggiGo\web
$env:VITE_BASE_URL="/GaggiGo/"
$env:VITE_GAGGIMATE_HOST="192.168.0.129"
npm run build
```

Then redeploy:

```powershell
cd C:\Users\ed\GaggiGo
Copy-Item web\dist\* docs\ -Recurse -Force
git status
```

---

## Next Thread Start Point

Start from:

```text
Hosted app loads.
All tabs work.
Manual WebSocket works.
No live app data appears.
```

Do not re-audit:

```text
GitHub Pages publishing path
PWA installability
Router /GaggiGo base path
Navigation base path
Manual WebSocket viability
HTTP API mixed-content/CORS failure
```

Next work:

```text
1. Inspect browser console on dashboard.
2. Confirm app bundle host configuration.
3. Rebuild with VITE_GAGGIMATE_HOST=192.168.0.129 if needed.
4. Redeploy docs.
5. Verify live data appears.
6. Only after live data works, test PWA offline relaunch behaviour again.
```

---

## Hard Boundaries

Do not add:

```text
machine controls
OTA
PID/autotune
Bluetooth management
raw websocket admin
unrestricted settings writes
safe sync
new product features
```

Continue using existing architecture:

```text
GaggiMate controls the machine.
GaggiGo observes, stores, analyses, archives, and later syncs safe data.
```
