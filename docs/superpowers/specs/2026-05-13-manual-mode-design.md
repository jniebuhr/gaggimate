# Manual Mode - Real Mode Live Control

## Status

Approved for implementation planning.

This spec supersedes `docs/superpowers/specs/2026-04-16-manual-mode-design.md`. The older draft included valve controls, save-as-profile behavior, and recorded-profile replay. This version keeps the first implementation focused on a real Manual machine mode with saved defaults, live pressure/flow/temperature control, and shot-history recording.

## Goal

Add a Manual operating mode to the current Web UI and firmware so a user can:

- Select `Manual` beside the existing Brew, Steam, Water, and Grind modes.
- Adjust pressure, flow, and temperature manually.
- Keep output off while Manual is armed.
- Press Start to begin a manual run.
- Adjust targets live while the run is active.
- Stop the run and have it recorded in Shot History / Shot Analyzer.

Manual mode is for espresso experimentation. It should feel like part of the current home dashboard, not a separate tool or profile editor.

## Decisions

- Manual is a real firmware mode: `MODE_MANUAL = 5`.
- Manual has a real process: `ManualProcess`.
- Manual starts armed with pump/valve output off.
- Output starts only after pressing `START MANUAL`.
- Pressure and flow use an explicit target type:
  - Pressure mode regulates pressure and treats flow as the limit.
  - Flow mode regulates flow and treats pressure as the limit.
- Manual has its own saved defaults for target type, pressure, flow, and temperature.
- First-version limits are fixed:
  - Temperature: `80-105 C`
  - Pressure: `0-12 bar`
  - Flow: `0-6 g/s`
- Manual runs are recorded as manual shot-history entries.
- Manual does not create reusable profiles in the first version.

## Out Of Scope

- Saving Manual runs as reusable profiles.
- Replaying Manual target trajectories.
- Timeline editing for manual adjustments.
- Manual valve open/close controls.
- User-configurable Manual limits.
- Manual mode on machines without advanced pressure capability.

## Architecture

Add `MODE_MANUAL = 5` to the shared firmware constants and to the Web UI mode constants.

Selecting Manual uses the existing `req:change-mode` flow. The controller deactivates and clears any active process, switches to Manual, and applies the Manual temperature target. No pump output starts during mode selection.

Pressing Start creates a `ManualProcess`. The process owns:

- Target type: pressure or flow.
- Target pressure.
- Target flow.
- Target temperature.
- Start time.
- Safety duration.

While the process is active, WebSocket target update requests modify the active `ManualProcess` immediately. The controller output loop then sends the current Manual targets through the existing advanced pump control path.

Manual defaults are stored in `Settings`, not in the selected brew profile. This keeps Manual independent from the currently selected recipe while still letting it return with the last-used values.

## Firmware Behavior

### Constants

Add:

```cpp
#define MODE_MANUAL 5
```

Existing modes remain unchanged:

- `0` Standby
- `1` Brew
- `2` Steam
- `3` Water
- `4` Grind
- `5` Manual

### Settings

Persist Manual defaults:

- `manualTargetType`: pressure or flow.
- `manualPressure`: default `9.0`.
- `manualFlow`: default `2.0`.
- `manualTemperature`: default `93`.

Settings setters should clamp to the approved first-version limits.

### ManualProcess

Add `src/display/core/process/ManualProcess.h`.

The process should be state-light, similar to the existing water and steam utility processes, but with advanced pump targets:

- `getType()` returns `MODE_MANUAL`.
- `isRelayActive()` returns true only while active.
- `getPumpValue()` returns `100` while active.
- `getTemperature()` returns the manual temperature target.
- `getPumpTarget()` returns pressure or flow.
- `getPumpPressure()` returns target pressure.
- `getPumpFlow()` returns target flow.
- `isActive()` returns true until stopped or the safety timeout expires.

Use `BREW_SAFETY_DURATION_MS` for the v1 Manual safety timeout.

### Controller

`Controller::activate()` starts `ManualProcess` when the current mode is Manual.

`Controller::getTargetTemp()` returns the saved Manual temperature in Manual mode.

`Controller::setTargetTemp()` updates the saved Manual temperature in Manual mode.

The output loop should treat active `ManualProcess` like advanced brew output:

- If target type is pressure:
  - `pressureTarget = true`
  - `pressure = manualPressure`
  - `flow = manualFlow`
- If target type is flow:
  - `pressureTarget = false`
  - `pressure = manualPressure`
  - `flow = manualFlow`

Then call:

```cpp
clientController.sendAdvancedOutputControl(relayActive, targetTemp, pressureTarget, pressure, flow);
```

When Manual is armed but inactive:

- Maintain only the Manual target temperature.
- Report status target pressure and target flow as `0`.
- Include saved Manual defaults separately so the UI controls can render their values without implying output is active.

Changing away from Manual while active should use the existing mode-change behavior: deactivate, clear, then switch.

## WebSocket API

Keep `req:change-mode` for entering Manual:

```json
{ "tp": "req:change-mode", "mode": 5 }
```

Add a request to update saved Manual defaults while armed and active process targets while running:

```json
{
  "tp": "req:manual:update",
  "targetType": "pressure",
  "pressure": 8.0,
  "flow": 3.0,
  "temperature": 93
}
```

Fields are optional. Supplied values are clamped server-side.

If Manual is active, updates apply to the running process and persist as defaults. If Manual is armed but inactive, updates only persist as defaults and update the target temperature.

Status payloads should include Manual defaults with compact fields that match the existing `evt:status` style:

```json
{
  "mtp": "pressure",
  "mp": 8.0,
  "mf": 3.0,
  "mt": 93
}
```

`ApiService.js` should map those compact fields into readable status keys:

- `manualTargetType`
- `manualPressure`
- `manualFlow`
- `manualTemperature`

## Web UI

Manual appears in the current home dashboard mode rail beside Brew, Steam, Water, and Grind where Grind is available.

The selected layout is "Replace Recipe Panel":

- Keep the left ring.
- Keep the bottom live graph.
- Replace the right recipe/target panel with a Manual console when mode is Manual.

### Manual Console

The console contains:

- Target type segmented control: `Pressure` / `Flow`.
- Pressure slider and numeric input.
- Flow slider and numeric input.
- Temperature slider and numeric input.
- Current-value readouts beside each control.
- Primary action button:
  - Armed: `START MANUAL`
  - Running: `STOP MANUAL`
  - Finished, if applicable: `CLEAR`

The pressure/flow labels should make the active regulation mode clear:

- Pressure target type:
  - Pressure label: `PRESSURE TARGET`
  - Flow label: `FLOW LIMIT`
- Flow target type:
  - Flow label: `FLOW TARGET`
  - Pressure label: `PRESSURE LIMIT`

### Armed State

Manual armed means:

- Mode is Manual.
- No process is active.
- Pump/valve output is off.
- Manual controls edit saved defaults.
- The ring shows temperature progress toward the Manual target.
- Target pressure and target flow indicators should read as planned/default values, not active output.

### Running State

Manual running means:

- `ManualProcess` is active.
- Slider changes send `req:manual:update`.
- Target updates are applied immediately and persisted as defaults.
- The ring shows elapsed run time and Manual state.
- The graph shows live pressure, flow, temperature, and target lines.

### Existing Home Dashboard Integration

Update these likely Web UI seams:

- `web/src/pages/Home/dashboardLogic.js`
- `web/src/pages/Home/DashboardMerged.jsx`
- `web/src/services/ApiService.js`
- `web/src/utils/homeConstants.jsx`
- Any legacy compact components that still reference the mode enum.

The UI should preserve the current Nothing-style ring language and mode rail.

## Shot History And Analyzer

Manual runs should be saved as real shot-history entries. The implementation should make Manual distinguishable from Brew in metadata so Shot History and Shot Analyzer can label it as a Manual run.

At minimum, the recorded run should include:

- Mode/process type: Manual.
- Target type at run start.
- Starting pressure target.
- Starting flow target/limit.
- Temperature target.
- Live sensor samples already captured by the existing history pipeline.

If target changes during the run are already represented by per-sample target pressure/flow/temperature fields, reuse those. If not, add the smallest metadata extension needed so the analyzer can show the target trajectory.

Manual history does not need to create or reference a reusable profile in v1. A synthetic profile label such as `Manual` is enough for display and analysis.

## Error Handling And Safety

- Clamp all Manual target values in firmware.
- Ignore `req:manual:update` if Manual mode is unavailable.
- Ignore `req:manual:update` when the current mode is not Manual.
- Stop output when the safety timeout expires.
- Stop output when changing mode.
- Stop output when the WebSocket sends the existing process deactivate request.
- If advanced pressure capability is absent, hide Manual mode in the Web UI and reject `MODE_MANUAL` in firmware.

## Verification Plan

Run focused Web UI checks:

- Manual mode option appears in the mode list when supported.
- `getAvailableModeOptions` includes Manual.
- `getPrimaryActionState` returns `START MANUAL` / `STOP MANUAL` / `CLEAR` as appropriate.
- Manual target clamping and labels work for both target types.

Run build checks:

- `cd web && npm run build`
- `pio run -e display` if PlatformIO is available in the environment.

Run manual browser checks:

- Manual appears in the home mode rail.
- Selecting Manual does not start output.
- `START MANUAL` changes to `STOP MANUAL`.
- Sliders and numeric values fit on desktop and mobile.
- Target type toggle clearly changes pressure/flow labels.
- Live graph and ring continue to render.

Because this repo has limited firmware unit tests, firmware validation is primarily compile-time plus manual behavior review unless a test harness is added later.

## Implementation Notes

- Avoid committing `.superpowers/` companion mockup artifacts.
- Keep the change scoped to Manual mode. Do not redesign the home dashboard outside the selected right-panel swap.
- Prefer small helper functions around target clamping and target type mapping so UI and firmware logic stay easy to test.
