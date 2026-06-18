# GAGGIGO_ARCHITECTURE_DISCOVERY.md

## Purpose

This document records the current architecture discovery state for GaggiGo.

It exists to prevent the project from circling back through already-tested deployment assumptions.

The goal is not to preserve conversation history.

The goal is to preserve:

- what GaggiGo is
- what has already been built
- what works
- what appears to work but does not satisfy the product architecture
- why deployment remains unresolved
- what must be audited before any new implementation path begins

---

## Governance Status

Current mode:

```text
Architecture Discovery
```

Current rule:

```text
No new implementation path is authorised until architecture selection is complete.
```

Blocked until architecture decision:

```text
Feature development
Safe Sync
Merge-back
GitHub Pages finalisation
CORS changes
Packaged app work
Local HTTPS work
```

This document is a discovery record, not an implementation plan.

---

## Product Objective

GaggiGo is intended to provide a reliable offline-first companion experience for GaggiMate.

Target user expectation:

```text
Open one app
See useful machine/history/profile/statistics information
No black screen
No public data dependency
No cloud requirement
Data remains with the user
```

Original preferred product model:

```text
GaggiMate reachable on local network
↓
Live GaggiMate experience is available
↓
GaggiGo mirrors safe data locally
↓
When GaggiMate is unavailable
↓
GaggiGo offline cache remains available
```

---

## Authority Boundary

GaggiMate remains:

```text
machine authority
runtime authority
live telemetry source
controller
firmware owner
```

GaggiGo remains:

```text
offline-first observer
local data mirror
history viewer
analyzer workspace
statistics workspace
archive/restore surface
future safe sync client
```

GaggiGo must not reintroduce:

```text
brew control
steam control
grinder control
water control
OTA
PID/autotune
Bluetooth management
raw websocket admin
unrestricted settings writes
```

---

## What Has Been Built And Validated

The following GaggiGo capabilities are implemented and validated within the project:

```text
IndexedDB local mirror
LibraryService authority path
cache-first History
cache-first Analyzer
cache-first Statistics
Archive export
Archive restore
ZIP compression
Duplicate restore protection
Empty-mirror restore
Populated-mirror restore
Profile cache path
Read-only settings snapshot behaviour
PWA build plumbing
Service worker build artifacts
Base-route support for GitHub Pages
Desktop/mobile navigation base-path fixes
```

Important validated result:

```text
The core offline data model works.
```

The current problem is not primarily:

```text
cache design
analyzer rendering
statistics rendering
archive restore
IndexedDB persistence
```

The current problem is:

```text
delivery architecture
secure origin behaviour
offline launch behaviour
user-owned distribution model
```

---

## Deployment Paths Tested Or Investigated

### 1. Local PC / Vite-Hosted Path

Observed model:

```text
Browser / PWA
↓
PC-hosted Vite app
↓
Vite proxy
↓
GaggiMate /api and /ws
```

Repository evidence:

```text
vite.config.js proxies:
/api -> configured GaggiMate HTTP target
/ws  -> configured GaggiMate WebSocket target
```

Interpretation:

```text
The PC/Vite host likely masked CORS and mixed-origin issues by presenting /api and /ws as same-origin to the browser.
```

What worked:

```text
live data exchange while PC host was available
shot updates after local/browser data was seeded
history/analyzer/statistics from cache
```

What failed:

```text
When the PC host was unavailable, the installed PWA could not reliably act as a standalone offline app shell.
```

Conclusion:

```text
Useful development path.
Not an acceptable final product architecture.
```

Reason:

```text
It depends on the PC host/proxy being available.
```

---

### 2. GaggiMate-Hosted HTTP PWA Path

Observed model:

```text
Browser
↓
http://192.168.0.129/
↓
GaggiMate-served app shell
```

What works:

```text
GaggiMate can serve web assets
GaggiMate can serve sw.js
GaggiMate can serve app.webmanifest
GaggiMate can serve history files
GaggiMate can serve websocket traffic
```

What fails or remains blocked:

```text
http://192.168.0.129 is not treated as a secure browser context
service worker API is unavailable or unreliable
true PWA install/offline relaunch cannot be proven from direct-IP HTTP origin
```

Conclusion:

```text
ESP32/GaggiMate can host GaggiGo files.
Plain local HTTP cannot be assumed to provide a valid offline PWA origin.
```

Reason:

```text
Browser secure-context rules.
```

---

### 3. GitHub Pages Hosted Path

Observed model:

```text
GitHub Pages HTTPS app shell
↓
Direct WebSocket to GaggiMate
↓
Direct HTTP fetch to GaggiMate
```

What works:

```text
GitHub Pages app shell loads
GitHub Pages provides secure context
base routing works
service worker/PWA shell can install
configured GaggiMate WebSocket host is present
manual ws://192.168.0.129/ws connection opens in tested browser
```

What fails:

```text
Direct HTTP fetch from GitHub Pages to GaggiMate /api/history/index.bin is blocked by CORS.
```

Observed evidence:

```text
GET http://192.168.0.129/api/history/index.bin net::ERR_FAILED 200 (OK)
No Access-Control-Allow-Origin header
TypeError: Failed to fetch
```

Interpretation:

```text
The endpoint exists and returns HTTP 200, but browser policy blocks the GitHub Pages origin from reading the response.
```

Security/product concern:

```text
GitHub Pages is public. It can be acceptable only as public static code, not as a user-owned product dependency.
```

Product conclusion:

```text
GitHub Pages is useful validation evidence.
It is not currently accepted as the selected final architecture.
```

Reason:

```text
User data must remain with the user, and the product should not depend on a public app shell unless explicitly accepted.
```

---

## Current Architecture Problem

GaggiGo has a working local data layer but no selected delivery architecture.

The delivery architecture must satisfy all of the following:

```text
user-owned data
offline launch
no black screen
cache-first information display
automatic or semi-automatic updates from GaggiMate
no public hosted dependency unless explicitly accepted
no unsafe machine-control exposure
reasonable installation/distribution burden
```

The project must not proceed by patching the latest failing path without first selecting the architecture.

---

## Why This Is Hard

The product requirement is simple:

```text
One reliable offline app that syncs with a local device.
```

The difficulty comes from platform trust boundaries:

```text
Browsers require a secure context for service workers and reliable PWA behaviour.
192.168.x.x over plain HTTP is local but not browser-trusted.
HTTPS requires a certificate trusted by the client device.
Public HTTPS solves browser trust but introduces public-hosting/product-trust concerns.
Native or packaged apps avoid browser-origin rules but introduce app distribution/signing concerns.
```

This is an architecture problem, not an analyzer/cache problem.

---

## Paths Currently Under Consideration

### A. Local HTTPS GaggiMate-Hosted PWA

Model:

```text
GaggiMate serves HTTPS app shell
User installs one PWA
GaggiMate online = live/local hydration
GaggiMate offline = service worker shell + IndexedDB cache
```

Potential benefit:

```text
Closest to original one-app vision.
No public hosting.
Data remains local.
```

Known risk:

```text
Local HTTPS requires trusted certificate flow.
iPhone/Safari trust process may be too complex.
ESP32 HTTPS/certificate handling may be constrained.
```

Discovery questions:

```text
Can GaggiMate realistically serve HTTPS?
Can the user trust the certificate with a simple flow?
Does Safari expose service worker APIs after trust?
Does installed PWA relaunch offline after GaggiMate is unreachable?
```

Status:

```text
Not selected.
Requires discovery audit.
```

---

### B. Packaged GaggiGo Companion App

Model:

```text
GaggiGo is installed as a local app
GaggiMate remains machine authority
GaggiGo stores data locally
When GaggiMate is reachable, GaggiGo syncs safe data
When offline, GaggiGo opens from local storage
```

Potential benefit:

```text
Avoids browser service worker trust problem.
Avoids GitHub Pages/public shell dependency.
Keeps user data local.
Better aligns with modern user expectation of an app.
```

Known risk:

```text
Distribution and signing burden.
Windows/Android likely manageable.
iOS is the hardest platform.
```

Discovery questions:

```text
Can the current React/Vite app be wrapped without major rewrite?
Which wrapper is lowest-risk: Tauri, Capacitor, Electron, other?
Can local storage/IndexedDB model survive packaging?
Can the app talk to GaggiMate over local network without browser CORS/service-worker issues?
What is the real iOS distribution barrier?
```

Status:

```text
Preferred fallback if Local HTTPS PWA is not simple.
Requires discovery audit.
```

---

### C. Public Static Shell With Import/Restore

Model:

```text
Public/static app shell
Manual archive restore on first use
Local IndexedDB cache thereafter
Optional later hydration path if safe
```

Potential benefit:

```text
Technically simple.
Already partly proven.
No firmware changes required for basic offline analysis after import.
```

Known risk:

```text
Public hosted dependency.
Not accepted as desired final product trust model.
Manual repeated import is unacceptable for ongoing use.
```

Status:

```text
Rejected as final architecture for now.
May remain as validation evidence or fallback demo only.
```

---

### D. Local PC/Bridge Proxy

Model:

```text
User runs a local bridge/proxy on PC
App talks to bridge
Bridge talks to GaggiMate
```

Potential benefit:

```text
Solves CORS and HTTPS issues technically.
```

Known risk:

```text
Reintroduces PC dependency.
Fails the no-black-screen/offline-access product requirement.
```

Status:

```text
Rejected for product architecture.
```

---

## Current Non-Selection

No final architecture is selected.

The project must not quietly fall back to any of the following without explicit architecture approval:

```text
GitHub Pages final architecture
broad CORS on /api/*
settings CORS exposure
WebSocket bulk-history transfer
local bridge/proxy dependency
full native rewrite
unrestricted machine-control app
```

---

## Current Best Direction

The next phase should compare only the serious candidates:

```text
A. Local HTTPS GaggiMate-hosted PWA
B. Packaged GaggiGo companion app
```

Candidate C remains useful as evidence only.

Candidate D is rejected.

---

## Discovery Gate Requirements

Before implementation resumes, the project must answer:

```text
1. Can Local HTTPS PWA be made practical for normal GaggiMate users?
2. If not, can packaged GaggiGo reuse the current frontend and local data architecture?
3. What is the real distribution burden for Windows, Android, and iOS?
4. Which option best satisfies user-owned data, offline-first behaviour, and no-black-screen reliability?
```

No code changes should be made to support either A or B until those questions are answered.

---

## Merge Position

Merge-back is not authorised.

Reason:

```text
Core GaggiGo capabilities are validated, but delivery architecture is unresolved.
```

Current safe merge statement:

```text
Do not merge GaggiGo as a completed MVP until architecture selection is complete and validated.
```

---

## Stop-Circling Rule

The following conclusions are now preserved and must not be re-litigated without new evidence:

```text
1. Core offline cache/analyzer/statistics/archive work is valid.
2. PC/Vite-hosted flow is not final because it depends on the PC host/proxy.
3. Plain HTTP direct-IP GaggiMate hosting is not enough for reliable PWA/offline launch.
4. GitHub Pages proves secure public shell feasibility but is not accepted as the final user-owned architecture.
5. GitHub Pages direct HTTP hydration fails due to CORS.
6. Broad CORS is not acceptable.
7. Settings endpoint exposure is risky because it includes sensitive/settings-write behaviour.
8. Local bridge/proxy is rejected because it recreates the PC dependency.
9. The next valid work is architecture discovery, not feature development.
```

---

## Next Immediate Task

Run an architecture discovery audit comparing:

```text
Local HTTPS GaggiMate-hosted PWA
vs
Packaged GaggiGo companion app
```

Deliverable:

```text
Architecture Selection Report
```

Required result:

```text
Select one architecture for validation
or explicitly reject both and define the next constrained alternative.
```
