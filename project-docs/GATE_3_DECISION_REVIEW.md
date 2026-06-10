# GATE_3_DECISION_REVIEW.md

## Purpose

This document applies the Gate 3 decision rules from:

```text
project-docs/GAGGIMATE_HOSTED_PWA_ROADMAP.md
```

to the runtime findings recorded in:

```text
project-docs/GATE_3_RUNTIME_FINDINGS.md
```

---

## Decision Inputs

Runtime findings established:

```text
Gate 3A Static Asset Audit: PARTIAL PASS
Gate 3C Service Worker Registration Audit: FAIL
Gate 3D iPhone Home Screen And Offline Relaunch Validation: FAIL
```

The GaggiMate device serves:

```text
/
/sw.js
/app.webmanifest
/assets/
```

by direct IP address.

The iPhone can add the app to Home Screen and launch it while GaggiMate is reachable.

The installed app opens to a blank black or white screen when GaggiMate is unavailable.

Desktop browser evidence shows:

```text
window.isSecureContext = false
navigator.serviceWorker = undefined
```

---

## Roadmap Decision Rule Applied

The relevant roadmap rule is:

```text
If Service Worker Fails Due To Browser Security / Local-Origin Limitation

Pause merge-back.

Re-evaluate:

hosted HTTPS PWA linked from GaggiMate
archive-only handoff
local bridge
other constrained alternatives
```

---

## Classification

Current failure classification:

```text
Browser security / local-origin limitation
```

Supporting evidence:

```text
The direct-IP HTTP origin is not a secure context in the tested desktop browser.
The Service Worker API is unavailable on that origin.
The iPhone Home Screen installation path works while online but does not produce an offline-survivable app shell.
```

This confirms the issue is not currently proven to be:

```text
build failure
missing service worker file
missing manifest
filesystem packaging failure
archive failure
IndexedDB failure
History/Analyzer/Statistics rendering failure
```

---

## Governance Decision

Gate 3 remains open.

Merge-back remains blocked.

Safe Sync remains blocked.

Feature development remains blocked.

Application logic should not be patched blindly.

The intended GaggiMate-hosted single-app PWA model is not proven viable yet.

---

## Architecture Decision

The architecture is not fully abandoned yet.

The correct status is:

```text
GaggiMate-hosted single-app PWA model:
NOT PROVEN
BLOCKED BY OFFLINE APP-SHELL RELAUNCH FAILURE
```

Reason:

```text
Device-hosted assets and install path work.
Offline survival does not.
```

This preserves the validated positives while accurately recording the blocker.

---

## Re-Evaluation Options

The roadmap-approved alternatives are:

```text
1. Hosted HTTPS PWA linked from GaggiMate
2. Archive-only handoff
3. Local bridge
4. Other constrained alternatives
```

### Option 1 — Hosted HTTPS PWA Linked From GaggiMate

Potential benefit:

```text
HTTPS origin should satisfy browser secure-context and service-worker requirements.
Offline app shell may become viable.
```

Trade-off:

```text
Introduces external hosting dependency for install/update path.
Must preserve offline-first local IndexedDB mirror and GaggiMate-as-authority model.
```

### Option 2 — Archive-Only Handoff

Potential benefit:

```text
Avoids service-worker/local-origin problem.
Uses already validated archive import/export path.
```

Trade-off:

```text
Does not deliver the intended single installed app experience.
More manual user workflow.
```

### Option 3 — Local Bridge

Potential benefit:

```text
Could provide a secure or stable local access layer between GaggiMate and browser.
```

Trade-off:

```text
Adds complexity and another runtime component.
Must be heavily justified under governance.
```

### Option 4 — Other Constrained Alternatives

Potential benefit:

```text
Keeps options open while avoiding blind architecture expansion.
```

Trade-off:

```text
Must not reintroduce machine controls, OTA, unrestricted settings writes, raw websocket admin, Bluetooth management, or duplicate persistence authority.
```

---

## Current Recommendation

Recommended next validation path:

```text
Evaluate hosted HTTPS PWA linked from GaggiMate as the first alternative.
```

Reason:

```text
The current blocker appears tied to local HTTP origin / service-worker availability.
An HTTPS origin directly tests that blocker while reusing the existing GaggiGo offline-first frontend and IndexedDB architecture.
```

This should be treated as architecture validation, not feature development.

---

## Immediate Next Task

Define a minimal validation plan for the hosted HTTPS PWA alternative.

The plan must prove only:

```text
HTTPS-hosted app shell loads
Service worker registers
Service worker controls the page
App can be added to Home Screen
Installed app relaunches offline
History/Analyzer/Statistics render from IndexedDB when GaggiMate is unavailable
Machine-control surfaces remain unavailable or GaggiMate-owned
```

Do not implement Safe Sync.

Do not merge back.

Do not add new product features.
