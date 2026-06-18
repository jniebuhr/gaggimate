# GITHUB_PAGES_DIRECT_ACCESS_VALIDATION.md

## Purpose

This document records measured validation evidence for the GitHub Pages deployment path during PWA Deployment Validation.

The purpose is to separate proven browser/runtime behaviour from assumptions about deployment architecture.

---

## Scope

Repository:

```text
TyrLabsOS/GaggiGo
```

Branch:

```text
gaggigo-mvp
```

Deployment tested:

```text
https://tyrlabsos.github.io/GaggiGo/
```

GaggiMate target tested:

```text
192.168.0.129
```

---

## Current Phase

```text
PWA Deployment Validation
```

Current gate:

```text
Gate 3 — Deployment Architecture Validation
```

Feature development, safe sync, and merge-back remain blocked while this gate remains open.

---

## Evidence Summary

### GitHub Pages App Shell

Result:

```text
PASS
```

Evidence:

```text
location.href
'https://tyrlabsos.github.io/GaggiGo/'
```

Application shell rendered successfully and showed the GaggiGo dashboard content.

Observed app text included:

```text
GaggiGo
Welcome to GaggiGo
Offline-first companion for GaggiMate.
System Status
Frontend ONLINE
Local Cache READY
Sync Layer MVP
```

Interpretation:

```text
GitHub Pages deployment, base routing, and app shell loading are functioning.
```

---

### Secure Context

Result:

```text
PASS
```

Evidence:

```text
window.isSecureContext
true
```

Interpretation:

```text
GitHub Pages provides a secure HTTPS origin suitable for service worker/PWA testing.
```

---

### Configured GaggiMate WebSocket Host

Result:

```text
PASS
```

Evidence:

The deployed JavaScript attempted to connect to:

```text
ws://192.168.0.129/ws
```

Interpretation:

```text
The deployed build was compiled with a GaggiMate host value.
```

This rules out the earlier suspected cause:

```text
Missing VITE_GAGGIMATE_HOST
```

---

### Direct WebSocket From GitHub Pages To GaggiMate

Manual console test:

```javascript
const ws = new WebSocket('ws://192.168.0.129/ws');
ws.onopen = () => console.log('OPEN');
ws.onerror = e => console.log('ERROR', e);
ws.onclose = e => console.log('CLOSE', e);
```

Observed result:

```text
OPEN
```

Browser also emitted warnings:

```text
Mixed Content: The page at 'https://tyrlabsos.github.io/GaggiGo/' was loaded over HTTPS, but attempted to connect to the insecure WebSocket endpoint 'ws://192.168.0.129/ws'. This endpoint should be available via WSS.
Connecting to a non-secure WebSocket server from a secure origin is deprecated.
```

Validation result:

```text
PARTIAL PASS
```

Interpretation:

```text
Direct raw WebSocket access from GitHub Pages to GaggiMate works in the tested browser despite mixed-content/deprecation warnings.
```

Important limitation:

```text
This proves WebSocket transport only.
It does not prove full application data hydration.
```

---

### Direct HTTP API Fetch From GitHub Pages To GaggiMate

Manual console test:

```javascript
fetch('http://192.168.0.129/api/history/index.bin')
  .then(r => console.log('STATUS', r.status, r.type))
  .catch(e => console.error('FETCH ERROR', e));
```

Observed browser evidence:

```text
Mixed Content: The page at 'https://tyrlabsos.github.io/GaggiGo/' was loaded over HTTPS, but requested an insecure resource 'http://192.168.0.129/api/history/index.bin'. This content should also be served over HTTPS.

Access to fetch at 'http://192.168.0.129/api/history/index.bin' from origin 'https://tyrlabsos.github.io' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.

GET http://192.168.0.129/api/history/index.bin net::ERR_FAILED 200 (OK)

FETCH ERROR TypeError: Failed to fetch
```

Validation result:

```text
FAIL
```

Interpretation:

```text
The GaggiMate HTTP endpoint exists and returns HTTP 200, but the browser blocks the GitHub Pages app from reading the response because the GaggiMate HTTP API does not expose the required CORS headers for the GitHub Pages origin.
```

The browser also warns about HTTPS-to-HTTP mixed content.

---

## Source Split Identified

The deployment currently has a split result:

```text
GitHub Pages app shell: PASS
GitHub Pages secure context: PASS
Direct WebSocket to GaggiMate: PARTIAL PASS
Direct HTTP API fetch to GaggiMate: FAIL
```

Therefore:

```text
GitHub Pages + direct GaggiMate access is not currently a complete valid deployment architecture.
```

It is only partially valid because WebSocket access works but HTTP data hydration is blocked.

---

## Application Impact

The deployed app can attempt WebSocket connection to:

```text
ws://192.168.0.129/ws
```

However, current source still contains HTTP hydration paths such as:

```text
/api/history/index.bin
/api/history/*.slog
/api/settings
```

When hosted on GitHub Pages, relative HTTP paths resolve against the GitHub Pages origin unless explicitly redirected or rewritten.

Direct absolute HTTP calls to GaggiMate are blocked by browser CORS policy unless GaggiMate sends appropriate CORS response headers.

Expected impact:

```text
Live WebSocket telemetry/profile messages may work.
History hydration over HTTP fails.
Settings HTTP snapshot fetch fails.
Full offline mirror hydration from GitHub Pages is not proven.
```

---

## Ruled Out

The following are now ruled out as primary causes of the no-data deployment symptom:

```text
Missing GitHub Pages app shell
Missing base route support
Missing VITE_GAGGIMATE_HOST
Browser hard-blocking raw ws:// in the tested browser
Missing /api/history/index.bin on GaggiMate
```

---

## Current Blocker

Current blocker:

```text
GitHub Pages HTTPS origin cannot currently read GaggiMate HTTP API responses because the GaggiMate HTTP API does not provide CORS headers for the GitHub Pages origin.
```

Secondary risk:

```text
HTTPS-to-HTTP mixed-content warnings remain present.
```

---

## Governance Decision

Gate 3 remains open.

Feature development remains blocked.

Safe Sync remains blocked.

Merge-back remains blocked.

Do not treat GitHub Pages + direct GaggiMate access as fully validated until HTTP hydration is resolved or replaced.

---

## Candidate Resolution Paths

The following paths require audit before selection:

1. Add tightly scoped CORS headers to safe GaggiMate read endpoints.
2. Move required history/settings hydration through existing safe WebSocket read messages if supported.
3. Use same-origin GaggiMate-hosted deployment if service worker/origin constraints can be solved.
4. Use a constrained local bridge/proxy.
5. Reclassify GitHub Pages as app-shell-only and use import/restore as the data transfer path.

No implementation path is selected by this document.

---

## Required Next Audit

Audit the earlier local/PWA workflow before selecting a fix path.

Specific question:

```text
Did the previous locally served PWA work because Vite/dev-server proxy made /api and /ws same-origin, while the installed/offline shell failed once the PC host disappeared?
```

This must be compared against the current GitHub Pages setup before any architecture change is made.

---

## Next Immediate Task

Audit the previous local-hosted PWA/dev-server path against the current GitHub Pages path.

Focus:

```text
Previous path:
Browser/PWA -> PC/Vite host -> Vite proxy -> GaggiMate /api and /ws

Current path:
Browser/PWA -> GitHub Pages HTTPS -> direct GaggiMate ws:// and http://
```

Determine whether the old path worked because the PC/Vite proxy masked CORS and mixed-origin restrictions.
