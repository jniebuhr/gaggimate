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

## Pass Criteria

Option 2 remains a strong candidate only if:

```text
HTTPS app shell works
Service worker is available
Local GaggiMate API fetch is allowed
Local GaggiMate WebSocket is allowed or can be safely adapted without heavy architecture changes
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

---

## Decision Outcomes

### Outcome A — HTTPS + Local API Works

```text
Hosted HTTPS PWA + local GaggiMate authority becomes leading candidate.
```

### Outcome B — HTTPS Shell Works But Live API Fails

```text
Hosted HTTPS app remains viable only as archive-only viewer or mediated-access model.
```

### Outcome C — HTTPS Shell Fails

```text
Move to archive-only handoff or other constrained alternatives.
```

---

## Next Action

Create the smallest possible external HTTPS-hosted test page or temporary deployment that can run the evidence checks above.

Do not modify GaggiMate runtime code.

Do not modify application logic until this evidence gate has results.
