# Manual Mode — Live Control + Trajectory Saving

## Status

**Draft** — Awaiting user approval to proceed to implementation plan.

## Overview

A 6th **Manual** mode tab. While active, sliders for **pressure**, **flow**, **temperature**, and **valve** adjust the pump live during a shot. When you stop the shot, you can optionally save it as a named profile. Replaying that profile plays back the exact recorded trajectory — every slider movement, every adjustment.

---

## User Experience

### Manual Mode Tab

- Added as a 6th tab in `ModeTabBar`, positioned after Water (mode 5).
- Only visible when the machine has pressure capability (`pressureAvailable === true`), same gating as PRO features in profile editing.
- Switching to Manual mode does not require a profile selection — it is profile-free.

### Idle State (before starting)

- Sliders display default values: **9 bar** pressure, **2 g/s** flow, **93°C** temperature, **valve open**.
- Status shows "Manual Mode — Press play to begin".
- Start button activates manual brew.

### Running State (while brewing)

- Sliders are live — dragging any slider sends `req:manual:update` to the backend.
- Status shows "Running — Live Control".
- Current measured values (pressure, flow, temperature) displayed alongside the slider setpoints.
- Play button becomes Stop button.

### Stopped State (after stopping)

- "Save Shot" button appears (replacing Stop).
- Opens a modal: "Save as Profile" with a text field for profile name, confirm/cancel buttons.
- On save: `req:manual:save { label }` sent → backend converts shot recording to profile → success toast.

### Saved Profile

- Appears in profile list with a "recorded" badge or type icon to distinguish it from standard/PRO profiles.
- Selecting it and hitting brew replays the full trajectory exactly as recorded.
- Recorded profiles are read-only in the profile editor (no editing UI for trajectories at v1).

---

## Architecture

### Backend — Constants

**`src/display/core/constants.h`**

- Add `#define MODE_MANUAL 5`

### Backend — ManualProcess (new file)

**`src/display/core/process/ManualProcess.h`**

```cpp
class ManualProcess : public Process {
  public:
    float livePressure = 9.0f;
    float liveFlow = 2.0f;
    float liveTemperature = 93.0f;
    int liveValve = 1; // 0=closed, 1=open

    float getPumpValue() override { return isActive() ? 100.f : 0.f; }
    bool isAdvancedPump() const override { return isActive(); }
    PumpTarget getPumpTarget() const override { return PumpTarget::PUMP_TARGET_PRESSURE; }
    float getPumpPressure() const override { return isActive() ? livePressure : 0.f; }
    float getPumpFlow() const override { return isActive() ? liveFlow : 0.f; }
    float getTemperature() const override { return liveTemperature; }
    bool isRelayActive() override { return isActive() && liveValve == 1; }
    void progress() override {} // Stateless — driven by live values
    bool isActive() override { return processPhase == ProcessPhase::RUNNING; }
    int getType() override { return MODE_MANUAL; }
};
```

- Safety max duration: `BREW_SAFETY_DURATION_MS` (5 minutes), same as BrewProcess.
- `updatePressure(float)` and `updateFlow(float)` called by Controller loop (inherited from BrewProcess pattern or added as needed).
- `updateLiveValues(pressure, flow, temperature, valve)` called from WebUIPlugin on `req:manual:update`.

### Backend — Controller Changes

**`src/display/core/Controller.cpp`**

In `activate()` switch:
```cpp
case MODE_MANUAL:
    startProcess(new ManualProcess());
    break;
```

In `getTargetTemp()` switch — add `case MODE_MANUAL:` that returns `profileManager->getSelectedProfile().temperature` (reuses the same temperature storage, since Manual mode has no profile).

Temperature setter (`setTargetTemp`) already stores to the selected profile for `MODE_BREW` — for `MODE_MANUAL`, it should store to `profileManager->getSelectedProfile().temperature` so the live temperature reads back correctly.

In `sendControl()` — the existing advanced pump path (`sendAdvancedOutputControl`) already handles pressure + flow + temperature simultaneously for `MODE_BREW`. The same path is used for `MODE_MANUAL`, just with different source values (live sliders vs. profile phase interpolation).

### Backend — WebUIPlugin Messages (new)

**`src/display/plugins/WebUIPlugin.cpp`**

Three new message types handled in the existing `else if (msgType.startsWith("req:"))` block:

**`req:manual:activate`**
```json
{ "tp": "req:manual:activate" }
```
- Calls `controller->setMode(MODE_MANUAL)` then `controller->activate()`
- Response: `evt:status` (normal status update follows)

**`req:manual:update`**
```json
{ "tp": "req:manual:update", "pressure": 9.5, "flow": 2.1, "temperature": 94.0, "valve": 1 }
```
- All fields optional — only provided fields are applied
- Writes directly to the active `ManualProcess` instance's live value fields
- No response sent; next `evt:status` reflects updated values

**`req:manual:save`**
```json
{ "tp": "req:manual:save", "label": "My First Espresso" }
```
- Backend: reads current `.slog` file for this shot from `ShotHistoryPlugin`
- Converts trajectory to a single-phase profile with type `"recorded"`:
  - `pressure[]`, `flow[]`, `temperature[]`, `valve[]` arrays stored in phase metadata
  - Phase `transition.type = INSTANT` (values read directly from trajectory)
- Saves via `profileManager->saveProfile(profile)`
- Triggers `profiles:profile:save` event
- Response: `{ "tp": "evt:manual:saved", "profileId": "...", "label": "..." }`

### Backend — Profile Trajectory Storage

**`src/display/models/profile.h`**

Add a `profile.type = "recorded"` variant alongside existing `"standard"` / `"pro"`.

In `Phase` struct, add trajectory fields (only used when parent profile type is "recorded"):
```cpp
std::vector<float> recordedPressure;  // sampled at SHOT_LOG_SAMPLE_INTERVAL_MS (250ms)
std::vector<float> recordedFlow;
std::vector<float> recordedTemperature;
std::vector<int>   recordedValve;
```

**`src/display/core/process/BrewProcess.h`**

When running a `profile.type == "recorded"` profile, `BrewProcess` reads from the trajectory vectors instead of interpolating phase start/end values. The `transitionAlpha()` and easing logic is bypassed — values come directly from trajectory arrays at the current sample index based on elapsed time.

### Backend — Shot History Integration

The `ShotHistoryPlugin` already records full trajectory data during every brew (sampled at 250ms) in `.slog` binary format. No changes needed to the recording pipeline.

On `req:manual:save`:
1. Read the current open `.slog` file path from `ShotHistoryPlugin` state (exposed via public method or event data)
2. Parse `.slog` binary → extract `pressure`, `flow`, `temperature`, `valve` arrays
3. Build `Profile` with one phase containing the trajectory arrays
4. Save via `profileManager->saveProfile()`
5. Return profile ID and label in `evt:manual:saved`

### Backend — Schema Updates

**`schema/profile.json`**

Add to `profile.type` enum:
```json
"recorded"
```

Add trajectory fields to phase schema (only valid when type is "recorded"):
```json
"recordedPressure": {
  "type": "array",
  "items": { "type": "number" }
},
"recordedFlow": {
  "type": "array",
  "items": { "type": "number" }
},
"recordedTemperature": {
  "type": "array",
  "items": { "type": "number" }
},
"recordedValve": {
  "type": "array",
  "items": { "type": "integer" }
}
```

### Frontend — ModeTabBar

**`web/src/components/ModeTabBar.jsx`**

```js
const MODE_TABS = [
  { id: 0, label: 'Standby' },
  { id: 1, label: 'Brew' },
  { id: 2, label: 'Steam' },
  { id: 3, label: 'Water' },
  { id: 5, label: 'Manual' }, // id 5, not 4 (Grind is still 4 when shown)
];
```

- Tab 5 (Manual) only rendered if `pressureAvailable` is true.
- Uses `changeMode(5)` on click.

### Frontend — ManualControls Component (new)

**`web/src/pages/Home/ManualControls.jsx`**

Sliders:

| Control | Range | Step | Default |
|---------|-------|------|---------|
| Pressure | 0 – 12 bar | 0.1 | 9.0 |
| Flow | 0 – 5 g/s | 0.01 | 2.0 |
| Temperature | 80 – 110 °C | 0.5 | 93.0 |
| Valve | Toggle button | — | Open |

- On slider `onInput`: `api.send({ tp: 'req:manual:update', [field]: value })` with 100ms debounce
- Valve is a toggle button, sends `{ tp: 'req:manual:update', valve: 0|1 }`
- Status indicator: "Idle / Running — Live Control / Finished"
- "Save Shot" button appears in Finished state → opens SaveModal
- Shows measured current values alongside slider setpoints when running

**SaveModal** component:
- Text input for profile label (placeholder: "My Manual Shot")
- "Save" and "Cancel" buttons
- On save: `api.send({ tp: 'req:manual:save', label: '...' })`
- On success: close modal, show success toast
- On error: show error message in modal

### Frontend — ProcessControls Integration

**`web/src/pages/Home/ProcessControls.jsx`**

When `mode === 5`, render `<ManualControls api={apiService} />` instead of the profile-based `ProcessDisplay` / `ModeIdleDisplay`.

### Frontend — ApiService Extensions

**`web/src/services/ApiService.js`**

```js
// In send() method, handle new types:
case 'req:manual:activate':
case 'req:manual:update':
case 'req:manual:save':
    // Already handled by generic JSON send
```

No new explicit methods needed — existing `send()` handles all JSON messages. But for cleaner calling code:
```js
manual: {
  activate: () => api.send({ tp: 'req:manual:activate' }),
  update: (params) => api.send({ tp: 'req:manual:update', ...params }),
  save: (label) => api.send({ tp: 'req:manual:save', label }),
}
```

### Frontend — Status Display Updates

**`web/src/services/ApiService.js`** — `machine.value.status` already includes `mode`, `currentPressure`, `currentFlow`, `currentTemperature`, `targetTemperature`. These display naturally in Manual mode without changes.

### Documentation — WebSocket API

**`docs/websocket-api.yaml`**

Add to `components/messages`:

```yaml
ManualActivateRequest:
  value:
    tp:
      type: string
      const: 'req:manual:activate'

ManualUpdateRequest:
  value:
    tp:
      type: string
      const: 'req:manual:update'
    pressure:
      type: number
    flow:
      type: number
    temperature:
      type: number
    valve:
      type: integer

ManualSaveRequest:
  value:
    tp:
      type: string
      const: 'req:manual:save'
    label:
      type: string

ManualSavedEvent:
  value:
    tp:
      type: string
      const: 'evt:manual:saved'
    profileId:
      type: string
    label:
      type: string
```

Add to `publish.message.oneOf` and `subscribe.message.oneOf` arrays respectively.

---

## Key Design Decisions

1. **Recorded profile replay via trajectory arrays, not re-executing the .slog** — The .slog is a closed format used by the shot analyzer. Converting it to a profile at save time means recorded profiles are fully portable, editable like any other profile (future work), and don't depend on .slog parsing at replay time.

2. **Live temperature via existing profile slot** — Manual mode reuses `profileManager->getSelectedProfile().temperature` for temperature control. This avoids a separate "manual temperature" storage and reuses the existing `setTargetTemp()` path.

3. **Debounced slider updates (100ms)** — Prevents flooding the WebSocket. The pump controller runs at ~10Hz (`PROGRESS_INTERVAL = 100ms`), so updates faster than 100ms would be redundant anyway.

4. **Recorded profiles are read-only at v1** — No trajectory editor UI. Users who want to edit can re-record. This avoids the complexity of timeline editing while still delivering the core value.

5. **Valve as toggle (0/1), not slider** — Valve is binary. Represented as integer in both WebSocket protocol and profile schema.

---

## Out of Scope

- Trajectory editing UI for recorded profiles
- Saving a manual shot mid-shot (must stop first)
- Multi-phase manual sequencing (the recording captures what would be multiple phases automatically)
- Manual mode without pressure capability (hidden when `pressureAvailable === false`)

---

## Dependencies

- `ShotHistoryPlugin` for recording (already implemented)
- `clientController.sendAdvancedOutputControl()` for simultaneous pressure + flow + temperature control (already implemented)
- `profileManager->saveProfile()` (already implemented)
- WebSocket JSON messaging (already implemented)
