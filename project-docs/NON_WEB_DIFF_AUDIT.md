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

## Non-Web Changed Areas

### GaggiMate Controller Library

```text
lib/GaggiMateController/src/GaggiMateController.cpp
lib/GaggiMateController/src/peripherals/DigitalInput.cpp
lib/GaggiMateController/src/peripherals/DigitalInput.h
```

Needs classification:

- intentional runtime improvement
- local machine compatibility change
- upstream/depatch drift
- accidental unrelated change

---

### NimBLE Communication Library

```text
lib/NimBLEComm/src/NimBLEClientController.cpp
lib/NimBLEComm/src/NimBLEClientController.h
lib/NimBLEComm/src/NimBLEComm.h
lib/NimBLEComm/src/NimBLEServerController.cpp
lib/NimBLEComm/src/NimBLEServerController.h
```

Needs classification:

- intentional BLE/runtime improvement
- compatibility patch
- depatch residue
- unrelated to GaggiGo frontend MVP

---

### OTA Library

```text
lib/OTA/src/ControllerOTA.cpp
```

Needs classification:

- upstream-compatible fix
- local patch
- unrelated change

---

### Display/Core Runtime

```text
src/display/core/Controller.cpp
src/display/core/Controller.h
src/display/core/ProfileManager.cpp
src/display/core/Settings.cpp
src/display/core/Settings.h
src/display/core/predictive.h
```

Needs classification:

- required to expose data for GaggiGo
- runtime/API contract improvement
- accidental fork drift
- local GaggiMate patch

---

### Display Plugins

```text
src/display/plugins/BLEScalePlugin.cpp
src/display/plugins/BLEScalePlugin.h
src/display/plugins/WebUIPlugin.cpp
```

Needs classification:

- data/API bridge support
- BLE/scale runtime change
- unrelated local runtime work
- merge-back candidate

---

## Merge-Back Rule

Before a merge-back PR or upstream sync:

1. Separate frontend/PWA changes from runtime/firmware changes where possible.
2. Do not bundle unrelated firmware/runtime patches into a frontend merge.
3. Keep GaggiGo frontend improvements independently reviewable.
4. Runtime/API changes should have their own rationale and test notes.

---

## Recommended Classification Buckets

Use these labels when reviewing each file:

```text
A. Required for GaggiGo frontend data bridge
B. General GaggiMate improvement
C. Local machine/depatch compatibility
D. Unrelated drift, should revert or separate
E. Unknown, inspect before merge
```

---

## Current Status

Classification is not complete.

Do not start sync design until these files are reviewed or consciously deferred as separate from the frontend merge path.
