# PWA_DEPLOYMENT_VALIDATION.md

## Purpose

This document defines the deployment validation phase for GaggiGo.

The purpose is to validate that the application can operate as an installable offline-first PWA on the intended target platform.

This phase exists to prevent:

- assuming offline data validation equals offline PWA validation
- merge-back before deployment validation
- project completion before target-device validation
- deployment architecture drift

---

## Gate 3 Authority

```text
project-docs/GAGGIMATE_HOSTED_PWA_ROADMAP.md
```

This document is the authoritative roadmap for:

```text
Deployment architecture validation
Single-app feasibility validation
GaggiMate-hosted PWA validation
Proof-of-concept definition
Gate 3 pass/fail criteria
```

---

## Current Status

Status:

```text
ACTIVE
```

Current phase:

```text
PWA Deployment Validation
```

Repository status:

```text
Build: PASS
Lint: PASS
Documentation: PASS
Archive Validation: PASS
Branch Synchronisation: PASS
```

---

## Problem Statement

GaggiGo was designed as:

```text
Offline-first observer frontend
Local IndexedDB mirror
Historical viewer
Analyzer workspace
Statistics workspace
Archive layer
Future safe sync client
```

The intended workflow is:

```text
Open application
↓
Hydrate data
↓
Install PWA
↓
Disconnect network
↓
Continue using application
```

This workflow has not yet been validated on the target platform.

---

## Successfully Validated

### History

Status:

```text
PASS
```

Validated:

- online rendering
- offline rendering
- archive restore rendering

### Analyzer

Status:

```text
PASS
```

Validated:

- online rendering
- offline rendering
- archive restore rendering

### Statistics

Status:

```text
PASS
```

Validated:

- online rendering
- offline rendering
- archive restore rendering

### IndexedDB Authority

Status:

```text
PASS
```

Authority chain:

```text
LibraryService
↓
IndexedDBService
↓
IndexedDB
```

Validated.

### Archive Engine

Status:

```text
PASS
```

Validated:

- export
- compression
- preview
- restore
- duplicate protection

### Offline Data Layer

Status:

```text
PASS
```

Validated:

- cached shots
- cached profiles
- analyzer data
- statistics data

Data survives network loss.

---

## Ruled Out

### Archive Failure

Status:

```text
RULED OUT
```

Reason:

Archive validation complete.

### IndexedDB Failure

Status:

```text
RULED OUT
```

Reason:

Local mirror validated.

### Cache Authority Failure

Status:

```text
RULED OUT
```

Reason:

History, analyzer and statistics all operate from the same authority chain.

### Build Failure

Status:

```text
RULED OUT
```

Reason:

Build currently passes.

### Lint Failure

Status:

```text
RULED OUT
```

Reason:

Lint currently passes.

### Missing Service Worker Build Artifacts

Status:

```text
RULED OUT
```

Reason:

Build output contains:

```text
dist/sw.js
dist/workbox-*.js
```

### Missing Registration Code

Status:

```text
RULED OUT
```

Reason:

Service worker registration exists in source.

### Missing Device-Served PWA Assets

Status:

```text
RULED OUT
```

Reason:

Target-device Gate 3A validation confirmed the GaggiMate device serves the app shell, service worker file, and web manifest by direct IP address.

---

## Investigated And Reverted

### SSL Development Experiment

Purpose:

```text
Force HTTPS
Enable service worker testing
Validate mobile install path
```

Result:

```text
FAILED
```

Observed:

```text
SSL certificate error occurred when fetching script.
```

Decision:

```text
REVERTED
```

Repository restored to known-good state.

---

## Validation Progress

### Gate 1 — Dist Output Audit

Status:

```text
PASS
```

### Gate 2 — Desktop Localhost Validation

Status:

```text
PASS
```

### Gate 3A — Target Device Static Asset Audit

Status:

```text
PARTIAL PASS
```

Validated on GaggiMate device:

```text
http://gaggimate.local/
FAIL — browser could not find host

http://192.168.0.129/
PASS — GaggiMate Web UI loads

http://192.168.0.129/sw.js
PASS — service worker file is served

http://192.168.0.129/app.webmanifest
PASS — web manifest is served and parses as JSON

http://192.168.0.129/assets/
RESPONDS — directory listing not exposed; no missing-server failure observed
```

Interpretation:

```text
mDNS discovery: FAIL
Direct IP access: PASS
Web UI serving: PASS
Service worker asset presence: PASS
Manifest asset presence: PASS
Missing PWA assets: RULED OUT for sw.js and app.webmanifest
```

Gate 3A did not prove installable PWA behaviour.

It did prove that the immediate failure is not missing `sw.js` or missing `app.webmanifest` on the flashed GaggiMate web filesystem.

### Gate 3C — Service Worker Registration Audit

Status:

```text
FAIL
```

Target origin tested:

```text
http://192.168.0.129/
```

Browser console evidence:

```text
window.isSecureContext
false

await navigator.serviceWorker.getRegistrations()
Uncaught TypeError: Cannot read properties of undefined (reading 'getRegistrations')
```

Interpretation:

```text
navigator.serviceWorker is unavailable on the direct-IP HTTP origin.
The browser does not expose the Service Worker API because the origin is not a secure context.
```

Failure classification:

```text
origin/security issue
```

This is not a failure of:

```text
IndexedDB
Archive
History rendering
Analyzer rendering
Statistics rendering
PWA asset generation
Device static-file serving
```

---

## Current Risk

The following workflow cannot currently be proven:

```text
Install GaggiGo
↓
Disconnect network
↓
Launch from home screen
↓
History loads
↓
Analyzer loads
↓
Statistics loads
```

Therefore deployment validation remains incomplete.

Current blocker:

```text
The GaggiMate-hosted direct-IP HTTP origin is not a secure context in the tested browser.
Service worker registration is unavailable from that origin.
```

---

## Governance Decision

Current active phase:

```text
PWA Deployment Validation
```

Current active gate:

```text
Gate 3
Deployment Architecture Validation
```

Feature development:

```text
NOT AUTHORISED
```

Safe Sync:

```text
NOT AUTHORISED
```

Merge Back:

```text
NOT AUTHORISED
```

Next action:

```text
Evaluate Gate 3C origin/security failure against project-docs/GAGGIMATE_HOSTED_PWA_ROADMAP.md decision rules before patching application logic.
```
