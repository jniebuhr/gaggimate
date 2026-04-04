# Advance Mode Rules (Non-Obvious Only)

## C++ Firmware Rules

**Event system requires string IDs**: Use `PluginManager::trigger("event:name")` with string-based event IDs, not enums. Event data uses typed variants (`EventDataEntry`) with `setInt()`, `setFloat()`, `setString()` methods.

**BeanManager timestamps are millis()**: `createdAt` and `updatedAt` use `millis()` (unsigned long), NOT Unix timestamps. Files are `{uuid}.json` format.

**Profile pump field has two formats**: Can be `0`/`1` (simple on/off) OR object with `{"target": "pressure"|"flow", "pressure": number, "flow": number}`. Value `-1` means "use current value at phase start".

**Formatting excludes UI/drivers**: `scripts/format.sh` explicitly skips `src/display/ui/**` and `src/display/drivers/**` - do not format these directories.

**Version header is auto-generated**: `src/version.h` is created by `scripts/auto_firmware_version.py` from git tags - never edit manually.

## Web UI Rules

**Use Preact signals, not useState for global state**: Import from `@preact/signals` and use `.value` property. Local component state can use `useState`.

**WebSocket messages require `tp` field**: All messages need `tp` (type) like `"req:profiles:list"` or `"evt:status"`. Request/response pairs use `rid` for correlation.

**ApiService handles reconnection**: WebSocket auto-reconnects with exponential backoff (1s to 30s). Don't implement custom reconnection logic.

**Shot Analyzer uses 4-second predictive window**: `PREDICTIVE_WINDOW_MS = 4000` for phase exit detection. Don't change without understanding impact on analysis accuracy.

**Extended profile transitions**: Use `"instant"`, `"linear"`, `"ease-in"`, `"ease-out"`, `"ease-in-out"` with optional `adaptive` flag (0 or 1).

## Build Order Critical

**Web UI must build before firmware SPIFFS**: Always run `cd web && npm ci && npm run build` then `scripts/build_spiffs.sh` before `pio run`. Web assets are gzipped into `data/w/`.

## MCP & Browser Tools Available

This mode has access to MCP servers and browser automation tools for enhanced capabilities beyond standard code mode.