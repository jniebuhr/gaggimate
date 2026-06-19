# ARCHITECTURE_DISCOVERY_UPDATE_2026-06-19.md

## Purpose

This document records the architecture discovery update from 2026-06-19.

It supplements:

```text
project-docs/GAGGIGO_ARCHITECTURE_DISCOVERY.md
```

It does not authorise implementation.

---

## Discovery Session Outcome

Date:

```text
2026-06-19
```

Status:

```text
Architecture Discovery Active
```

Implementation status:

```text
Frozen
```

Architecture selection status:

```text
No architecture selected
```

---

## Master Branch Audit

Master branch was audited as the upstream/GaggiMate architecture authority source.

Result:

```text
No hidden complete architecture discovered.
```

The audit did not find an existing complete solution for:

```text
secure local HTTPS PWA path
trusted certificate flow
native or packaged app path
complete full-shot WebSocket hydration
public-free user-owned distribution path
complete offline app architecture
```

---

## Existing History Architecture

Verified:

```text
History list is available via WebSocket.
```

Verified:

```text
Full shot payload retrieval remains HTTP-based.
```

Interpretation:

```text
WebSocket can assist with history discovery and incremental sync decisions.
WebSocket does not currently remove the dependency on HTTP for full analyzer-quality shot data.
```

Conclusion:

```text
No existing history architecture solves the full hydration problem.
```

---

## GitHub Pages Architecture

Status:

```text
Validation complete
```

Result:

```text
Useful evidence only
```

GitHub Pages proved:

```text
public HTTPS shell can load
base routing can work
manual ws:// GaggiMate connection can open in tested browser
```

GitHub Pages also proved:

```text
HTTP history hydration from GitHub Pages to GaggiMate is blocked by CORS.
```

Product decision:

```text
GitHub Pages is not selected as final architecture.
```

Reasons:

```text
public hosted dependency
CORS restrictions on HTTP history hydration
not aligned with preferred user-owned data model
```

---

## Local PC / Proxy Architecture

Status:

```text
Rejected
```

Reason:

```text
Requires host machine.
Reintroduces dependency.
Fails intended offline-first product behaviour.
```

---

## Broad CORS Architecture

Status:

```text
Rejected
```

Reason:

```text
Security expansion.
Architecture patch rather than architecture solution.
```

Additional note:

```text
Settings endpoint exposure remains risky because settings handling includes sensitive fields and write behaviour.
```

---

## Architecture Candidates Remaining

Only two serious candidates remain based on current evidence.

---

## Architecture A — Local HTTPS GaggiMate-Hosted PWA

Status:

```text
Alive
```

Advantages:

```text
closest to original one-app vision
one install
no public dependency
user-owned data
GaggiMate remains local authority
GaggiGo cache remains local
```

Discovery findings:

```text
Plain http://192.168.x.x is not enough for reliable PWA/offline launch.
A trusted HTTPS origin is required for service worker/PWA behaviour.
iOS manual certificate trust is required for manually installed certificates.
The iOS certificate trust path is not automatically fatal for a prosumer audience.
```

Current critical unknown:

```text
After certificate trust is installed, does Safari treat the ESP32 HTTPS origin as a fully valid installable offline PWA origin?
```

Required validation:

```text
GaggiMate or test ESP32 serves HTTPS.
Certificate is installed and trusted on iPhone.
Safari accepts origin without certificate warning.
Service worker registers.
PWA installs.
PWA relaunches while GaggiMate is unavailable.
Cached GaggiGo data remains visible offline.
```

Current state:

```text
Not approved
Not rejected
Awaiting physical validation
```

---

## Architecture B — Packaged GaggiGo Companion App

Status:

```text
Alive
```

Advantages:

```text
avoids browser-origin restrictions
avoids CORS concerns when native HTTP layer is used
likely reuses existing React/Vite architecture
naturally aligns with offline-first behaviour
keeps user data local
```

Discovery findings:

```text
React/Vite packaging appears feasible.
IndexedDB/local storage model is likely reusable.
Local network communication appears feasible.
WebSocket communication appears feasible.
Packaged/native HTTP layers can avoid normal browser CORS restrictions.
```

Current critical unknown:

```text
Distribution burden, especially iOS.
```

Distribution findings:

```text
Windows distribution appears low risk.
Android distribution appears workable with medium friction.
iOS distribution is the main risk due to App Store/developer account/signing constraints.
```

Current state:

```text
Not approved
Not rejected
Awaiting further discovery
```

---

## Current Architecture Trade

Architecture A risk:

```text
Safari + trusted certificate + service worker + offline relaunch
```

Architecture B risk:

```text
iOS distribution and signing burden
```

Current conclusion:

```text
Neither architecture is rejected.
Neither architecture is selected.
Both remain viable.
```

---

## Governance Position

The project is no longer blocked by implementation uncertainty.

The project is currently blocked by architecture selection uncertainty.

No merge-back is authorised.

No feature development is authorised.

No architecture-specific implementation is authorised.

Do not start:

```text
HTTPS implementation
certificate implementation
Tauri implementation
Capacitor implementation
Electron implementation
CORS implementation
GitHub Pages finalisation
safe sync
merge-back
```

until architecture selection is complete.

---

## Updated Stop-Circling Rule

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
9. Master branch audit did not reveal a hidden complete architecture.
10. WebSocket history listing exists, but full shot payload still depends on HTTP.
11. Architecture A and Architecture B are the only serious candidates currently alive.
12. The next valid work is architecture discovery, not implementation.
```

---

## Highest-Value Next Evidence

The next highest-value validation item is:

```text
HTTPS_PWA_FEASIBILITY_TEST
```

Question:

```text
Can a trusted-cert HTTPS GaggiMate or ESP32 origin behave as a fully offline-capable iPhone PWA?
```

Pass condition:

```text
HTTPS trusted
service worker registered
PWA installed
offline relaunch works
cached data visible
```

Fail condition:

```text
certificate trust fails
Safari refuses service worker
PWA install fails
offline relaunch fails
cached data unavailable
```

If this passes:

```text
Architecture A becomes favourite.
```

If this fails:

```text
Architecture B becomes favourite.
```

---

## Discovery Conclusion

Current evidence suggests:

```text
Architecture A remains viable.
Architecture B remains viable.
No hidden third architecture has been discovered in the repository.
Future work should focus on selecting between A and B rather than creating additional implementation paths.
```
