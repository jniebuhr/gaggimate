# GATE_3_RUNTIME_FINDINGS.md

## Purpose

This document records target-device Gate 3 runtime validation findings for the GaggiMate-hosted GaggiGo PWA architecture.

These findings were gathered after repository-side deployment architecture validation and before any implementation change.

---

## Status

```text
ACTIVE FINDING
```

Gate 3 runtime validation has identified a blocker.

The blocker is not missing build artifacts or missing device-served PWA files.

The blocker is offline app-shell survival.

---

## Tested Device Origin

```text
http://192.168.0.129/
```

mDNS result:

```text
http://gaggimate.local/
FAIL — browser could not find host
```

Direct IP result:

```text
PASS — GaggiMate web UI loads
```

---

## Gate 3A — Static Asset Audit

Result:

```text
PARTIAL PASS
```

Validated:

```text
http://192.168.0.129/
PASS — GaggiMate Web UI loads

http://192.168.0.129/sw.js
PASS — service worker file is served

http://192.168.0.129/app.webmanifest
PASS — web manifest serves JSON

http://192.168.0.129/assets/
RESPONDS — no missing-server failure observed
```

Interpretation:

```text
Missing sw.js: ruled out
Missing app.webmanifest: ruled out
Missing app shell: ruled out
Static device serving: pass by direct IP
mDNS: fail
```

---

## Gate 3C — Service Worker Registration Audit

Desktop browser console evidence:

```text
window.isSecureContext
false

await navigator.serviceWorker.getRegistrations()
Uncaught TypeError: Cannot read properties of undefined (reading 'getRegistrations')
```

Result:

```text
FAIL
```

Failure classification:

```text
origin/security issue
```

Interpretation:

```text
The tested direct-IP HTTP origin is not a secure context.
The browser does not expose navigator.serviceWorker on that origin.
```

---

## Gate 3D — iPhone Home Screen And Offline Relaunch Validation

Validated on iPhone Safari:

```text
http://192.168.0.129/
PASS — GaggiMate Web UI loads

http://192.168.0.129/sw.js
PASS — service worker file is served as blank JavaScript response

http://192.168.0.129/app.webmanifest
PASS — web manifest serves JSON

Add to Home Screen
PASS — option is available

Installed Home Screen app launch while GaggiMate reachable
PASS — app opens

Installed Home Screen app launch while GaggiMate unavailable
FAIL — app opens to blank black or white screen
```

Additional iPhone storage observation:

```text
Safari website data shows approximately 1.1 MB stored for the site.
No further service-worker or cache detail was available from the device UI.
```

Result:

```text
FAIL
```

Failure classification:

```text
PWA runtime / service-worker control failure
```

---

## Current Interpretation

The GaggiMate device serves the required app files.

The iPhone can install the app shell to Home Screen.

The installed app opens while GaggiMate is reachable.

The installed app does not relaunch offline when GaggiMate is unavailable.

Current observed behaviour is consistent with an installed launcher that still depends on the GaggiMate HTTP origin being reachable.

---

## Not Failed

The current evidence does not indicate failure of:

```text
Archive
IndexedDB
History rendering
Analyzer rendering
Statistics rendering
PWA asset generation
Device static-file serving
Manifest availability
Home Screen installation availability
```

---

## Current Blocker

```text
Offline app-shell relaunch from the GaggiMate-hosted direct-IP HTTP origin fails on the target iPhone test.
```

---

## Governance Decision

Feature development remains blocked.

Safe Sync remains blocked.

Merge-back remains blocked.

Do not patch application logic until this runtime failure is evaluated against:

```text
project-docs/GAGGIMATE_HOSTED_PWA_ROADMAP.md
```

Next action:

```text
Evaluate whether the failure is caused by local-origin security limitations, service-worker registration/control failure, iOS local-network behaviour, or an architectural limitation of the GaggiMate-hosted PWA model.
```
