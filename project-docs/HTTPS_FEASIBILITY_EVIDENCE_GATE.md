# HTTPS_FEASIBILITY_EVIDENCE_GATE.md

## Purpose

Define the next evidence gate before any architecture selection or implementation.

This gate tests whether an HTTPS-hosted GaggiGo frontend can practically communicate with a local GaggiMate device while preserving the existing authority model.

---

## Governance Status

This is evidence collection.

It is not:

```text
feature development
safe sync
merge-back preparation
production deployment
architecture selection
```

---

## Current Question

```text
Can an HTTPS-hosted GaggiGo frontend:

1. register and control a service worker
2. fetch local GaggiMate API data
3. open a local GaggiMate WebSocket
4. preserve offline app-shell relaunch
```

---

## Evidence Required

### Test 1 — HTTPS Secure Context

From the hosted HTTPS page console:

```javascript
window.isSecureContext
```

Pass:

```text
true
```

Fail:

```text
false
```

### Test 2 — Service Worker Availability

From the hosted HTTPS page console:

```javascript
navigator.serviceWorker
```

Pass:

```text
ServiceWorkerContainer exists
```

Fail:

```text
undefined
```

### Test 3 — Local GaggiMate HTTP API Fetch

From the hosted HTTPS page console:

```javascript
await fetch('http://<GAGGIMATE_IP>/api/status')
```

Pass:

```text
Request succeeds and returns a readable response
```

Fail:

```text
Mixed-content error
CORS error
network error
blocked request
```

### Test 4 — Local GaggiMate WebSocket

From the hosted HTTPS page console:

```javascript
const ws = new WebSocket('ws://<GAGGIMATE_IP>/ws')
```

Pass:

```text
WebSocket opens
```

Fail:

```text
Mixed-content error
security error
connection blocked
connection refused
```

### Test 5 — Current App WebSocket Behaviour

Using the current frontend configuration:

```text
VITE_GAGGIMATE_HOST=<GAGGIMATE_IP>
```

verify whether the HTTPS-hosted app attempts:

```text
wss://<GAGGIMATE_IP>/ws
```

Expected risk:

```text
GaggiMate currently exposes ws://, not wss://
```

---

## Evidence Results — 2026-06-11

Test page:

```text
https://tyrlabsos.github.io/GaggiGo/https-feasibility/
```

Local GaggiMate host tested:

```text
192.168.0.129
```

### Test 1 — HTTPS Secure Context

Result:

```text
PASS
```

Observed:

```json
{
  "windowIsSecureContext": true,
  "locationProtocol": "https:",
  "locationOrigin": "https://tyrlabsos.github.io"
}
```

### Test 2 — Service Worker Availability

Result:

```text
PASS
```

Observed:

```json
{
  "available": true,
  "navigatorServiceWorkerType": "object"
}
```

### Test 3 — Service Worker Registration

Result:

```text
PASS
```

Observed:

```json
{
  "scope": "https://tyrlabsos.github.io/GaggiGo/https-feasibility/",
  "active": true,
  "installing": false,
  "waiting": false
}
```

### Test 4 — Service Worker Control

Result:

```text
PASS
```

Observed:

```json
{
  "controllerPresent": true
}
```

### Test 5 — Local GaggiMate HTTP API Fetch

Result:

```text
FAIL
```

Observed:

```json
{
  "url": "http://192.168.0.129/api/status",
  "name": "TypeError",
  "message": "Failed to fetch"
}
```

Detailed browser console evidence:

```text
Mixed Content: The page at 'https://tyrlabsos.github.io/GaggiGo/https-feasibility/' was loaded over HTTPS, but requested an insecure resource 'http://192.168.0.129/api/status'. This content should also be served over HTTPS.

Access to fetch at 'http://192.168.0.129/api/status' from origin 'https://tyrlabsos.github.io' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.

GET http://192.168.0.129/api/status net::ERR_FAILED 200 (OK)

Uncaught TypeError: Failed to fetch
```

Interpretation:

```text
The local GaggiMate HTTP API endpoint responded with HTTP 200 OK, but the HTTPS-hosted page was not allowed to read the response.

The failure is now classified as browser policy blocking, specifically:

1. Mixed-content warning / insecure HTTP request from HTTPS origin
2. CORS blocking because GaggiMate does not return Access-Control-Allow-Origin for the GitHub Pages origin

This is not endpoint downtime.
This is not a missing /api/status endpoint.
This is not an app-shell/service-worker failure.
```

### Test 6 — Local GaggiMate WebSocket

Result:

```text
PASS
```

Observed:

```json
{
  "url": "ws://192.168.0.129/ws",
  "opened": true
}
```

Interpretation:

```text
The HTTPS-hosted evidence page can open a local ws:// GaggiMate WebSocket from the tested browser/device context.
```

---

## Evidence Summary

```text
HTTPS app shell: PASS
Secure context: PASS
Service worker availability: PASS
Service worker registration: PASS
Service worker control: PASS
Local HTTP API fetch: FAIL
Local WebSocket access: PASS
HTTP endpoint availability: PASS, response observed as 200 OK but blocked from script access
Root cause classification: Mixed-content warning plus CORS policy block
```

---

## Updated Feasibility Assessment

Hosted HTTPS PWA + local GaggiMate authority is no longer blocked by service-worker availability.

However, it is currently blocked for live API hydration because the HTTPS-hosted frontend cannot read the local HTTP `/api/status` response under current GaggiMate server headers and browser policy.

The WebSocket result is better than expected and remains viable based on the current evidence.

Primary remaining unknown:

```text
Can the local HTTP API fetch failure be resolved safely with a narrow, auditable serving/header adjustment without creating architecture drift or unsafe authority expansion?
```

Likely investigation targets:

```text
1. CORS handling in GaggiMate WebUIPlugin / API responses
2. Whether adding narrow Access-Control-Allow-Origin support is sufficient
3. Whether mixed-content remains a hard blocker after CORS is addressed
4. Whether Safari/iOS behaves the same as the tested browser
5. Whether hosted HTTPS frontend should be demoted to archive-only if API fetch remains blocked
```

---

## Pass Criteria

Option 2 remains a strong candidate only if:

```text
HTTPS app shell works
Service worker is available
Local GaggiMate API fetch is allowed
Local GaggiMate WebSocket is allowed or can be safely adapted without heavy architecture changes
```

Current result:

```text
PARTIAL PASS / BLOCKED
```

Reason:

```text
HTTPS app shell and WebSocket passed.
HTTP API endpoint responded 200 OK but fetch response access was blocked by browser policy / CORS.
```

---

## Fail Criteria

Option 2 drops in ranking if:

```text
HTTPS shell works but local API access is blocked
HTTPS shell works but local WebSocket access is blocked
CORS blocks required data access
mixed content blocks required data access
```

Current risk:

```text
Local API access is blocked from the HTTPS-hosted page under current GaggiMate server headers.
```

---

## Decision Outcomes

### Outcome A — HTTPS + Local API Works

```text
Hosted HTTPS PWA + local GaggiMate authority becomes leading candidate.
```

Status:

```text
NOT ACHIEVED
```

### Outcome B — HTTPS Shell Works But Live API Fails

```text
Hosted HTTPS app remains viable only as archive-only viewer or mediated-access model.
```

Status:

```text
CURRENT LEANING, PENDING CORS/MIXED-CONTENT REMEDIATION FEASIBILITY
```

### Outcome C — HTTPS Shell Fails

```text
Move to archive-only handoff or other constrained alternatives.
```

Status:

```text
NOT APPLICABLE
```

The HTTPS shell did not fail.

---

## Next Action

Investigate whether the API fetch failure can be resolved safely and narrowly without committing to architecture selection.

Do not implement Safe Sync.

Do not merge back.

Do not expand product features.

Implementation remains blocked except for narrowly scoped evidence work if explicitly approved.

Immediate evidence task:

```text
Audit GaggiMate WebUIPlugin / API response handling for whether a minimal CORS/header evidence patch could safely allow the HTTPS evidence page to read /api/status.

Any such patch must remain evidence-only until validated and must not introduce new machine control, OTA, PID/autotune, Bluetooth management, raw websocket admin, unrestricted settings writes, or duplicate persistence authority.
```
