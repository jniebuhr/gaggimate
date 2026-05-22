# Non-Web Diff Audit

## Purpose

Classify non-web changes present on `gaggigo-mvp` before sync design and before any merge-back attempt.

This file does not approve or reject those changes.

It records that they exist and must be reviewed separately from the GaggiGo frontend/PWA work.

---

## Current Finding

`gaggigo-mvp` is ahead of repo `master` and includes changes outside `web/` and `project-docs/`.

These are not part of the core GaggiGo frontend MVP story and must not be blindly bundled into a future frontend merge-back.

---

## Classification Buckets

```text
A. Required for GaggiGo frontend data bridge
B. General GaggiMate improvement
C. Local machine/depatch compatibility
D. Unrelated drift, should revert or separate
E. Unknown, inspect before merge
```

---

## Inspected Classifications

### src/display/plugins/WebUIPlugin.cpp

Classification:

```text
A/B — telemetry bridge / general GaggiMate telemetry improvement
```

Observed change:

- adds scale battery telemetry to the existing websocket status payload when the connected scale reports a valid battery level.

Why it matters:

- useful to frontend telemetry display
- compatible with observer/PWA direction
- not machine control

Merge-back note:

- reasonable merge-back candidate as a standalone telemetry enhancement.

---

### src/display/plugins/BLEScalePlugin.cpp / BLEScalePlugin.h

Classification:

```text
B — BLE scale metadata runtime improvement
```

Observed change:

- exposes optional scale metadata such as battery, unit, flow rate, and timer where supported by the scale driver.
- caches metadata to avoid repeated unchanged events.
- adds unit/battery awareness around scale behaviour.

Why it matters:

- supports richer telemetry display
- partly supports GaggiGo visibility goals
- still belongs to runtime/peripheral code, not frontend-only work

Merge-back note:

- should be reviewed as a separate BLE scale enhancement PR/bucket.

---

### src/display/core/Settings.h / Settings.cpp

Classification:

```text
B/C — runtime setting expansion, not required for frontend MVP
```

Observed change:

- adds startup profile support.
- adds configurable button behaviour storage/accessors.

Why it matters:

- changes machine/runtime configuration surface.
- not required for GaggiGo offline/cache/sync work.

Merge-back note:

- should be separated from frontend/PWA merge unless explicitly needed by a runtime feature.

---

### src/display/core/Controller.cpp / Controller.h

Classification:

```text
B/C — runtime control behaviour change, not frontend/PWA work
```

Observed change:

- replaces fixed remote button callbacks with indexed configurable button behaviour.
- routes configured button behaviours into brew/steam/water/profile handling.

Why it matters:

- this touches machine/runtime behaviour.
- not a GaggiGo frontend change.

Merge-back note:

- must be reviewed separately as runtime feature work.
- do not bundle with frontend/PWA merge.

---

### lib/GaggiMateController/src/GaggiMateController.cpp
### lib/GaggiMateController/src/peripherals/DigitalInput.cpp
### lib/GaggiMateController/src/peripherals/DigitalInput.h

Classification:

```text
B/C — hardware button runtime change, not frontend/PWA work
```

Observed change:

- reports indexed button state instead of separate brew/steam button state.
- adds DigitalInput debounce/counting state.
- exposes current input state.

Why it matters:

- part of the same configurable button behaviour feature family.
- touches controller/runtime behaviour.
- not required for GaggiGo cache/offline/sync work.

Merge-back note:

- should be separated from frontend/PWA merge.
- review with the Settings/Controller button-behaviour runtime changes.

---

### lib/NimBLEComm/src/NimBLEClientController.cpp / .h
### lib/NimBLEComm/src/NimBLEServerController.cpp / .h
### lib/NimBLEComm/src/NimBLEComm.h

Classification:

```text
B/C — BLE protocol/runtime button abstraction change
```

Observed change:

- replaces separate button characteristics/callbacks with combined indexed button characteristic/callback.
- supports the configurable button behaviour feature family.

Why it matters:

- changes BLE protocol shape around button events.
- not frontend/PWA work.

Merge-back note:

- must be reviewed as runtime/protocol work.
- should not be bundled into frontend/PWA merge without explicit rationale.

---

### lib/OTA/src/ControllerOTA.cpp

Classification:

```text
C/D — unrelated OTA timeout change unless explicitly justified
```

Observed change:

- reduces HTTP timeout from 300000ms to 60000ms.

Why it matters:

- unrelated to GaggiGo frontend/PWA/offline work.
- could affect firmware update reliability.

Merge-back note:

- separate or revert unless there is a known reason/test result.

---

### src/display/core/ProfileManager.cpp

Classification:

```text
B/C — startup profile runtime behaviour
```

Observed change:

- applies configured startup profile at setup when valid.
- clears startup profile if invalid.
- clears startup profile when the linked profile is deleted.

Why it matters:

- part of runtime settings/profile behaviour.
- not needed for GaggiGo frontend/offline/sync.

Merge-back note:

- review with startup profile settings work.

---

### src/display/core/predictive.h

Classification:

```text
B — runtime correctness/performance improvement
```

Observed change:

- changes measurement storage to a bounded deque.
- trims old samples during measurement insert.
- uses rollover-safe unsigned millis arithmetic.

Why it matters:

- likely improves volumetric prediction stability/memory behaviour.
- not frontend/PWA work.

Merge-back note:

- reasonable standalone runtime improvement candidate.

---

## Merge-Back Rule

Before a merge-back PR or upstream sync:

1. Separate frontend/PWA changes from runtime/firmware changes where possible.
2. Do not bundle unrelated firmware/runtime patches into a frontend merge.
3. Keep GaggiGo frontend improvements independently reviewable.
4. Runtime/API changes should have their own rationale and test notes.

---

## Current Status

Classification complete enough for the current phase.

No non-web changes are required to begin frontend safe-sync design.

Runtime changes should be treated as separate merge-back buckets:

```text
1. Telemetry/scale metadata enhancements
2. Configurable button behaviour / startup profile runtime work
3. Predictive calculation improvement
4. OTA timeout change, likely separate or revert
```

For GaggiGo frontend work, continue without depending on these runtime changes unless explicitly required.
