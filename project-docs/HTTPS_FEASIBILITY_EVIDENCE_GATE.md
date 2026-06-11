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

Interpretation:

```text
The HTTPS-hosted page could not fetch the local HTTP GaggiMate API endpoint.
The observed browser-level failure is consistent with one or more of:

- mixed-content blocking
- CORS failure
- local-network fetch restriction
- network/browser policy failure
```

This result does not prove the GaggiMate API endpoint itself is down.

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
```

---

## Updated Feasibility Assessment

Hosted HTTPS PWA + local GaggiMate authority is no longer blocked by service-worker availability.

However, it is currently blocked for live API hydration because the HTTPS-hosted frontend failed to fetch the local HTTP `/api/status` endpoint.

The WebSocket result is better than expected and remains viable based on the current evidence.

Primary remaining unknown:

```text
Can local HTTP API fetch failure be resolved safely without heavy architecture changes or unsafe GaggiMate modification?
```

Likely investigation targets:

```text
1. Browser console/network details for the failed fetch
2. Direct HTTP endpoint availability from the same device/browser
3. CORS response headers from GaggiMate HTTP API
4. Mixed-content classification for local HTTP fetch from HTTPS page
5. Whether a narrow GaggiMate CORS/header change would be sufficient
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
HTTP API fetch failed.
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
Local API access appears blocked from HTTPS-hosted page.
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
CURRENT LEANING, PENDING ROOT-CAUSE CONFIRMATION
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

Investigate the failed HTTP API fetch narrowly before selecting an architecture.

Do not modify GaggiMate runtime code yet.

Do not modify application logic yet.

Do not implement Safe Sync.

Do not merge back.

Immediate evidence task:

```text
Collect browser console/network evidence for the failed fetch to classify whether it is mixed-content, CORS, local-network restriction, or endpoint availability.
```
