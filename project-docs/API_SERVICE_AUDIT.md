# ApiService Audit

## Purpose

Map the current websocket and API boundary before safe sync work begins.

GaggiMate remains the live machine authority.

GaggiGo observes, caches, analyses, and later syncs approved safe data only.

---

## Current File

```text
web/src/services/ApiService.js
```

Current responsibilities:

- opens websocket connection to `/ws`
- reconnects with exponential backoff
- receives websocket messages
- publishes listener callbacks by message type
- maintains the `machine` signal from `evt:status`
- exposes generic `send(event)`
- exposes generic `request(data)`

---

## Current Risk

`send(event)` and `request(data)` accept arbitrary websocket payloads.

That is inherited transport behaviour. It should remain in the low-level service for now, but future page code and sync code should not call raw websocket primitives directly.

Risk:

- read-only behaviour and remote-write behaviour are not separated
- future UI could accidentally depend on broad websocket access
- safe sync needs explicit method boundaries before it is built

---

## Current Repo Observations

Observed read operations through `LibraryService`:

```text
req:profiles:list
req:profiles:load
```

Observed remote-write operations through `LibraryService`:

```text
req:history:delete
req:profiles:delete
```

Observed HTTP read endpoints:

```text
/api/history/index.bin
/api/history/{id}.slog
/api/settings
```

---

## Status Stream

`evt:status` currently feeds the local `machine` signal with live telemetry and state.

This is acceptable for observation.

It must remain display/analysis data only inside GaggiGo.

---

## Proposed Boundary

Do not rewrite `ApiService` yet.

Add an explicit safe adapter first:

```text
web/src/services/SafeGaggiMateClient.js
```

Initial allowed methods should be read-oriented:

```text
listProfiles()
loadProfile(id)
listShots()
loadShot(id)
loadSettingsSnapshot()
getConnectionStatus()
```

Remote delete/write methods, if kept, should be named explicitly and separated from read methods.

---

## Next Engineering Step

Create the safe adapter as a thin wrapper.

Then migrate callers gradually away from direct raw `apiService.request()` usage.

Do not delete `ApiService` or change websocket transport in this phase.
