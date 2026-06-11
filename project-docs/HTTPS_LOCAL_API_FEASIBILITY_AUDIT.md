# HTTPS_LOCAL_API_FEASIBILITY_AUDIT.md

## Purpose

Audit whether a hosted HTTPS GaggiGo frontend can communicate safely and practically with a local GaggiMate HTTP/WebSocket API.

This document supports the architecture avenues audit and does not authorise implementation.

---

## Evidence Sources

Repository files inspected:

```text
web/src/services/ApiService.js
web/vite.config.js
src/display/plugins/WebUIPlugin.cpp
```

External browser-platform references checked:

```text
MDN Service Worker API
MDN Mixed Content
```

---

## Repository Evidence

### Frontend Host Configuration

`ApiService.js` supports a configured GaggiMate host:

```text
VITE_GAGGIMATE_HOST
```

If configured, WebSocket URL construction targets the configured host rather than same-origin.

Observed behaviour:

```text
If page protocol is https:
  use wss://configured-host/ws
else:
  use ws://configured-host/ws
```

Implication:

```text
The frontend has partial support for a separately hosted frontend and separately addressed GaggiMate device.
```

### Development Proxy Configuration

`vite.config.js` supports development-time proxying for:

```text
/api
/ws
```

This is useful during local development only.

It does not solve production HTTPS-hosted-to-local-GaggiMate access by itself.

### GaggiMate Web Server

`WebUIPlugin.cpp` starts an HTTP server on port 80:

```text
WebUIPlugin::WebUIPlugin() : server(80), ws("/ws")
```

It serves:

```text
/api/settings
/api/status
/api/scales/list
/api/scales/connect
/api/scales/scan
/api/scales/info
/api/history/
/api/history/index.bin
/ws
/
```

Static app shell serving:

```text
server.serveStatic("/", SPIFFS, "/w")
  .setDefaultFile("index.html")
  .setCacheControl("max-age=0")
```

History serving:

```text
server.serveStatic("/api/history/", *fs, "/h/")
  .setCacheControl("no-store")
```

No CORS headers were identified in the inspected serving path.

---

## Browser Platform Evidence

### Service Workers

Service workers require secure contexts.

Browser-platform evidence indicates service workers are available only over HTTPS, with localhost treated as secure for local development.

This aligns with Gate 3C runtime evidence:

```text
window.isSecureContext = false
navigator.serviceWorker = undefined
```

### Mixed Content Risk

A hosted HTTPS app communicating with local HTTP resources introduces mixed-content risk.

This affects:

```text
HTTPS page -> HTTP API fetch
HTTPS page -> ws:// WebSocket
```

---

## Feasibility Finding

A hosted HTTPS GaggiGo frontend is feasible for app-shell/service-worker validation.

However, a hosted HTTPS GaggiGo frontend is not yet proven feasible for live GaggiMate API/WebSocket hydration.

Primary blockers to prove or disprove:

```text
1. Mixed-content blocking for HTTP API fetches
2. Mixed-content / secure-context restrictions for ws:// WebSocket access
3. Missing CORS headers on GaggiMate HTTP responses
4. Frontend WebSocket URL builder currently upgrades configured host to wss:// when page is https
```

The current frontend logic may attempt:

```text
https hosted page
↓
wss://192.168.0.129/ws
```

but the GaggiMate server currently exposes:

```text
ws://192.168.0.129/ws
```

not a TLS WebSocket endpoint.

---

## Practical Ranking Impact

### Hosted HTTPS PWA + Live GaggiMate API

Status:

```text
PROMISING FOR APP SHELL
UNPROVEN / RISKY FOR LIVE HYDRATION
```

Reason:

```text
HTTPS likely fixes service-worker eligibility, but local API/WebSocket access may be blocked by browser security rules or require GaggiMate server/header changes.
```

### Hosted HTTPS Archive-Only Viewer

Status:

```text
STRONG FALLBACK
```

Reason:

```text
Avoids live HTTP/WebSocket access and reuses validated archive import/export paths.
```

---

## Current Governance Decision

No implementation authorised.

Next evidence task:

```text
Build or simulate the smallest HTTPS-hosted test page that attempts:

1. Service worker registration
2. HTTP fetch to local GaggiMate /api/status
3. WebSocket connection to local GaggiMate /ws
```

This should be treated as feasibility evidence only, not product development.

---

## Expected Decision Outcomes

If HTTPS shell works but HTTP/WebSocket access fails:

```text
Hosted HTTPS PWA remains viable only for archive-only or mediated access models.
```

If HTTPS shell works and local API/WebSocket access works:

```text
Hosted HTTPS PWA + local GaggiMate authority becomes the leading candidate.
```

If HTTPS shell fails:

```text
Move to archive-only handoff or other constrained alternatives.
```
