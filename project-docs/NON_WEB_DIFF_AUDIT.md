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

## Still Needs Inspection

### GaggiMate Controller Library

```text
lib/GaggiMateController/src/GaggiMateController.cpp
lib/GaggiMateController/src/peripherals/DigitalInput.cpp
lib/GaggiMateController/src/peripherals/DigitalInput.h
```

Current classification:

```text
E — unknown, inspect before merge
```

---

### NimBLE Communication Library

```text
lib/NimBLEComm/src/NimBLEClientController.cpp
lib/NimBLEComm/src/NimBLEClientController.h
lib/NimBLEComm/src/NimBLEComm.h
lib/NimBLEComm/src/NimBLEServerController.cpp
lib/NimBLEComm/src/NimBLEServerController.h
```

Current classification:

```text
E — unknown, inspect before merge
```

---

### OTA Library

```text
lib/OTA/src/ControllerOTA.cpp
```

Current classification:

```text
E — unknown, inspect before merge
```

---

### Remaining Display/Core

```text
src/display/core/ProfileManager.cpp
src/display/core/predictive.h
```

Current classification:

```text
E — unknown, inspect before merge
```

---

## Merge-Back Rule

Before a merge-back PR or upstream sync:

1. Separate frontend/PWA changes from runtime/firmware changes where possible.
2. Do not bundle unrelated firmware/runtime patches into a frontend merge.
3. Keep GaggiGo frontend improvements independently reviewable.
4. Runtime/API changes should have their own rationale and test notes.

---

## Current Status

Partially classified.

Known safe frontend/PWA work remains separate from runtime changes.

Do not start sync design until remaining unknown non-web files are either inspected or consciously deferred as a separate runtime review bucket.
