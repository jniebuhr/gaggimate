# WEBSOCKET_ONLY_FEASIBILITY_AUDIT.md

## Purpose

Audit whether the hosted HTTPS GaggiGo direction could avoid local HTTP API fetch limitations by relying on standard GaggiMate WebSocket behaviour.

This is evidence collection only.

It does not authorise:

```text
feature development
architecture selection
safe sync
merge-back
machine-control changes
OTA changes
Bluetooth administration
raw websocket administration
unrestricted settings writes
```

---

## Trigger

The HTTPS feasibility evidence gate established:

```text
HTTPS app shell: PASS
Service worker availability: PASS
Service worker registration: PASS
Service worker control: PASS
Local WebSocket access: PASS
Local HTTP API fetch: FAIL
HTTP endpoint availability: PASS, response observed as 200 OK but blocked from script access
Root cause classification: Mixed-content warning plus CORS policy block
```

The remaining question is whether the working WebSocket path is enough to preserve the GaggiGo observer model without HTTP API access.

---

## Evidence Sources

Repository files reviewed:

```text
CURRENT_STATE.md
web/src/services/ApiService.js
web/src/services/SafeGaggiMateClient.js
src/display/plugins/WebUIPlugin.cpp
project-docs/HTTPS_FEASIBILITY_EVIDENCE_GATE.md
```

---

## Evidence 1 — Manual WebSocket Feasibility

The HTTPS evidence page successfully opened:

```text
ws://192.168.0.129/ws
```

Result:

```text
PASS
```

This proves the tested browser/device context can open a local `ws://` GaggiMate WebSocket from a GitHub-hosted HTTPS page.

---

## Evidence 2 — Current Frontend WebSocket URL Builder

Current `ApiService.js` behaviour:

```javascript
if (configuredHost) {
  const isSecurePage = globalThis.location.protocol === 'https:';
  const wsProtocol = isSecurePage ? 'wss://' : 'ws://';
  return `${wsProtocol}${configuredHost}/ws`;
}
```

Implication:

```text
A GitHub-hosted HTTPS GaggiGo build configured with VITE_GAGGIMATE_HOST=192.168.0.129 would attempt:

wss://192.168.0.129/ws
```

But standard GaggiMate exposes:

```text
ws://192.168.0.129/ws
```

Therefore the manual WebSocket evidence does not yet prove the current frontend app can connect without a frontend URL-building adjustment.

---

## Evidence 3 — WebSocket Status Data Coverage

`ApiService.js` handles `evt:status` WebSocket messages and maps them into machine state.

Covered status fields include:

```text
currentTemperature
targetTemperature
currentPressure
targetPressure
targetWeight
currentFlow
mode
selectedProfile
selectedProfileId
brewTarget
brewTargetDuration
volumetricAvailable
grindTargetDuration
grindTargetVolume
grindTarget
currentWeight
bluetoothConnected
process
rssi
tofDistance
capabilities
short rolling in-memory status history
```

This is useful for live observer/status display.

---

## Evidence 4 — WebSocket Request Path Exists

`SafeGaggiMateClient.js` supports WebSocket request/response calls for:

```text
req:profiles:list
req:profiles:load
req:profiles:save
req:profiles:reorder
req:profiles:select
req:profiles:favorite
req:profiles:unfavorite
req:history:delete
req:profiles:delete
```

However, several of these are data-write operations and remain outside the immediate evidence need.

The read-relevant operations are:

```text
req:profiles:list
req:profiles:load
```

This indicates profiles may be recoverable through WebSocket request/response if the HTTPS-hosted frontend is allowed to use `ws://` rather than forced `wss://`.

---

## Evidence 5 — Historical Hydration Still Depends On HTTP API

Repository authority currently states:

```text
hydrateGaggiMateShotIndex()
→ fetches /api/history/index.bin
→ saves metadata rows
→ detects missing/unloaded payloads
→ hydrates missing .slog payloads with low concurrency
→ stores full samples[] payloads in IndexedDB
```

This means the validated History / Analyzer / Statistics offline model currently depends on HTTP-accessible history index and `.slog` payload hydration.

The audited WebSocket path does not currently prove equivalent historical hydration.

---

## Audit Findings

### Finding A — WebSocket Alone Is Not Currently Equivalent To Full Hydration

WebSocket live status can provide current machine telemetry.

It does not currently replace:

```text
/api/history/index.bin
/api/history/*.slog
full shot payload hydration
IndexedDB historical mirror construction
```

Therefore WebSocket-only operation is not currently enough to preserve the validated GaggiGo MVP capabilities.

### Finding B — Current App Would Not Use The Manual Successful WebSocket Form

Manual test:

```text
ws://192.168.0.129/ws
PASS
```

Current app under HTTPS with configured host:

```text
wss://192.168.0.129/ws
EXPECTED FAIL AGAINST STANDARD GAGGIMATE
```

Therefore a narrow frontend evidence change would be required to test actual hosted-app WebSocket behaviour against standard GaggiMate.

### Finding C — Profiles May Be Testable Via WebSocket

Profile reads are exposed through SafeGaggiMateClient:

```text
req:profiles:list
req:profiles:load
```

This may allow an additional non-HTTP evidence test for profile loading through WebSocket.

However, this does not solve history/analyzer/statistics hydration.

### Finding D — HTTP API Remains Required For Current MVP Data Model

Because the active architecture hydrates local IndexedDB from GaggiMate history files, local HTTP API readability remains a core blocker for a full hosted HTTPS + live GaggiMate authority model.

---

## Current Classification

```text
HTTPS hosted app shell: PASS
Manual local ws:// access: PASS
Current app configured WebSocket behaviour: NOT PROVEN / likely blocked by forced wss://
Profile read via WebSocket: POSSIBLE, untested in hosted app
Historical hydration via WebSocket only: NOT PROVEN
HTTP API hydration: BLOCKED by mixed-content/CORS under standard GaggiMate master
```

---

## Decision Impact

Hosted HTTPS + local GaggiMate authority remains partially viable, but not complete.

It requires at least one of the following to preserve full MVP behaviour:

```text
1. Safe HTTP API readability from HTTPS hosted frontend
2. A validated WebSocket replacement for history index and shot payload hydration
3. A different architecture such as archive-only handoff or mediated access
```

Current evidence does not support selecting Hosted HTTPS + full live GaggiMate authority yet.

---

## Recommended Next Evidence Step

Do not select an architecture yet.

Next narrow investigation:

```text
Audit and test whether the hosted evidence page can send read-only WebSocket request messages to standard GaggiMate master, specifically:

req:profiles:list
req:profiles:load
```

Reason:

```text
This can be tested against the currently running standard GaggiMate master without firmware changes.
```

If profile reads work, the project will know that some GaggiMate authority reads are recoverable over WebSocket.

If they fail, Hosted HTTPS + live GaggiMate authority weakens further.

This does not solve historical hydration but improves the evidence map.

---

## Boundaries

Do not test write requests as part of this audit.

Do not send:

```text
req:profiles:save
req:profiles:reorder
req:profiles:select
req:profiles:favorite
req:profiles:unfavorite
req:history:delete
req:profiles:delete
```

Do not introduce machine control, OTA, PID/autotune, Bluetooth management, raw websocket admin, unrestricted settings writes, or duplicate persistence authority.
