# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Build System

**Dual-platform project**: ESP32 firmware (PlatformIO) + Preact web UI (Vite)
- Firmware: `pio run -e display` (display with UI) or `pio run -e display-headless` (no UI)
- Web UI must be built BEFORE firmware SPIFFS: `cd web && npm ci && npm run build` then run `scripts/build_spiffs.sh`
- Web assets are gzipped and placed in `data/w/` directory for SPIFFS filesystem
- Version auto-generated from git tags via `scripts/auto_firmware_version.py` into `src/version.h`

## Code Formatting

**C++ formatting excludes UI/driver code**: `scripts/format.sh` uses clang-format but explicitly excludes `src/display/ui/**` and `src/display/drivers/**` directories

## Architecture (Non-Obvious)

**Plugin-based event system**: Core uses `PluginManager` with string-based event IDs (e.g., `"system:dummy"`) and typed event data (`EventDataEntry` with int/float/string variants). Events support `stopPropagation` flag.

**BeanManager uses millis() timestamps**: `createdAt` and `updatedAt` are stored as `unsigned long` from `millis()`, NOT Unix timestamps. Files stored as `{uuid}.json` in configured directory.

**Profile schema has two types**: `"standard"` vs `"pro"` profiles with different phase structures. Pro profiles support complex pump control objects with `target`, `pressure`, and `flow` fields. Value `-1` means "use current value at phase start".

**WebSocket API uses `tp` field**: All messages have a `tp` (type) field like `"evt:status"`, `"req:profiles:list"`, `"res:profiles:save"`. Request/response pairs use `rid` (request ID) for correlation.

**Controller waits for BLE connection**: `waitingForController` state with 10-second timeout (`CONTROLLER_WAITING_TIMEOUT_MS`). Display can run headless without controller via `GAGGIMATE_HEADLESS` flag.

**Volumetric measurement has grace period**: Bluetooth scale measurements have 1.5-second grace period (`BLUETOOTH_GRACE_PERIOD_MS`) before switching sources between flow estimation and BLE.

## Web UI Specifics

**Preact with signals**: Uses `@preact/signals` for state management, NOT React hooks for global state
- `ApiService` manages WebSocket with exponential backoff (1s to 30s max delay)
- WebSocket auto-reconnects on close/error with `_scheduleReconnect()`

**Shot Analyzer uses IndexedDB**: `IndexedDBService` stores shot data locally. `AnalyzerService` has predictive window of 4 seconds (`PREDICTIVE_WINDOW_MS`) for phase exit detection.

**Extended profiles use adaptive transitions**: Phase transitions can be `"instant"`, `"linear"`, `"ease-in"`, `"ease-out"`, `"ease-in-out"` with optional `adaptive` flag (0 or 1).

## Testing

**No test framework configured**: `test/` directory exists but contains only PlatformIO boilerplate. No unit tests currently implemented.

## Local Libraries

**Custom libraries in lib/**: `GaggiMateController`, `NimBLEComm`, `NayrodPID`, `ble_ota_dfu` are project-specific libraries with `library.json` manifests. Controller lib depends on PSM library from GitHub.