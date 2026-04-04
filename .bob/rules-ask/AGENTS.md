# Ask Mode Documentation Rules (Non-Obvious Only)

## Project Structure Context

**Dual-platform architecture**: ESP32 firmware in `src/display/` and `src/controller/`, Preact web UI in `web/`. These are separate build systems that integrate via SPIFFS filesystem.

**Web UI embedded in firmware**: Web assets built with Vite, gzipped, and placed in `data/w/` for SPIFFS. The firmware serves these via AsyncWebServer on `/ws` endpoint.

**Custom libraries are local**: `lib/GaggiMateController`, `lib/NimBLEComm`, `lib/NayrodPID`, `lib/ble_ota_dfu` are project-specific, not external packages. Controller lib depends on PSM from GitHub.

## Non-Standard Patterns

**Event system uses strings, not enums**: `PluginManager` uses string-based event IDs like `"system:dummy"` with typed data variants. This is intentional for plugin flexibility.

**Timestamps are millis(), not Unix time**: `BeanManager` stores `createdAt`/`updatedAt` as `unsigned long` from `millis()`. This is ESP32-specific for uptime tracking.

**Profile schema has dual formats**: `"standard"` profiles use simple pump on/off. `"pro"` profiles use complex objects with `target`, `pressure`, `flow` fields. Value `-1` means "use current value at phase start".

**WebSocket API uses `tp` field**: All messages have `tp` (type) field for routing. Request/response pairs use `rid` (request ID) for correlation. This is documented in `docs/websocket-api.yaml`.

**Controller waits for BLE**: Display has `waitingForController` state with 10-second timeout. Can run headless via `GAGGIMATE_HEADLESS` flag without controller hardware.

**Volumetric measurement switching**: Bluetooth scale has 1.5-second grace period before switching between flow estimation and BLE sources. This prevents rapid source switching.

## Documentation Locations

**WebSocket API spec**: `docs/websocket-api.yaml` contains AsyncAPI specification
**Profile schema**: `schema/profile.json` defines JSON schema for espresso profiles
**Shot data schemas**: `schema/shot_history.json` and `schema/shot_notes.json`
**Build scripts**: `scripts/` directory contains Python and Bash build automation