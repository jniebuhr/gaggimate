# Plan Mode Architecture Rules (Non-Obvious Only)

## System Architecture Constraints

**Dual-platform with build dependency**: ESP32 firmware depends on web UI build output. Web UI must be built first (`cd web && npm ci && npm run build`), then `scripts/build_spiffs.sh` gzips assets into `data/w/` before firmware compilation.

**Plugin-based event system**: Core uses `PluginManager` with string-based event IDs (not enums) and typed event data variants. Events support `stopPropagation` flag. This enables runtime plugin registration without recompilation.

**Controller-Display separation**: Display can run headless (`GAGGIMATE_HEADLESS` flag) without controller hardware. Controller waits 10 seconds for BLE connection (`CONTROLLER_WAITING_TIMEOUT_MS`) before proceeding.

**Volumetric measurement has dual sources**: Flow estimation and Bluetooth scale with 1.5-second grace period (`BLUETOOTH_GRACE_PERIOD_MS`) before switching sources. This prevents rapid oscillation between sources.

## Data Model Constraints

**Timestamps use millis(), not Unix time**: `BeanManager` stores `createdAt`/`updatedAt` as `unsigned long` from `millis()`. This is ESP32 uptime-based, not wall-clock time. Files are `{uuid}.json` format.

**Profile schema has two incompatible types**: `"standard"` profiles use simple pump on/off (0/1). `"pro"` profiles use complex objects with `{"target": "pressure"|"flow", "pressure": number, "flow": number}`. Value `-1` means "use current value at phase start". These cannot be mixed.

**WebSocket uses type-based routing**: All messages require `tp` (type) field like `"evt:status"` or `"req:profiles:list"`. Request/response pairs use `rid` (request ID) for correlation. This is documented in `docs/websocket-api.yaml`.

## Web UI Architecture

**Preact signals for global state**: Uses `@preact/signals` (not React hooks) for global state management. `ApiService` manages WebSocket with exponential backoff (1s to 30s max delay) and auto-reconnection.

**Shot Analyzer uses IndexedDB**: `IndexedDBService` stores shot data locally. `AnalyzerService` has 4-second predictive window (`PREDICTIVE_WINDOW_MS`) for phase exit detection. This window is critical for accurate phase transition detection.

**Extended profiles use adaptive transitions**: Phase transitions support `"instant"`, `"linear"`, `"ease-in"`, `"ease-out"`, `"ease-in-out"` with optional `adaptive` flag (0 or 1). Adaptive transitions adjust based on actual pressure/flow response.

## Build System Constraints

**Version auto-generated from git tags**: `scripts/auto_firmware_version.py` creates `src/version.h` from git tags. Never edit this file manually - it's regenerated on every build.

**Formatting excludes UI/drivers**: `scripts/format.sh` explicitly skips `src/display/ui/**` and `src/display/drivers/**`. These directories use different formatting conventions.

**No test framework**: `test/` directory exists but contains only PlatformIO boilerplate. No unit tests are currently implemented.