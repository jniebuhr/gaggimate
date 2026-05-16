# Interactive Profile Keyframes Design

## Summary

Advanced profile creation should support an interactive graph where users build a Pro profile from time-based keyframe markers. Each marker represents temperature, pressure, and flow setpoints at a point in time. Each segment between two markers becomes one profile phase.

This keeps the saved profile compatible with the existing Pro profile schema. The UI can feel like editing a curve, while the firmware still receives the same `phases` array it already understands.

## Goals

- Let users create phases from graph markers instead of only from form rows.
- Show pressure, flow, and temperature setpoints together while editing a Pro profile.
- Let each segment choose whether pressure or flow is the active pump target.
- Let each segment choose a ramp style: `instant`, `linear`, `ease-in`, `ease-out`, or `ease-in-out`.
- Preserve existing profile save/load behavior and firmware compatibility.
- Keep the first version usable on touch devices by editing numeric values in controls rather than requiring vertical graph dragging.

## Non-Goals

- Do not introduce a new persisted profile schema.
- Do not make the graph the only way to edit phases.
- Do not implement vertical drag editing for temperature, pressure, or flow in the first version.
- Do not remove existing valve, stop condition, or detailed phase controls.

## Current Context

The advanced profile editor is implemented in `web/src/pages/ProfileEdit/ExtendedProfileForm.jsx`. It renders profile information, an `ExtendedProfileChart`, and one selected `ExtendedPhase` form.

`web/src/components/ExtendedProfileChart.jsx` already renders a Chart.js line chart with pressure and flow datasets, phase highlighting, and phase divider annotations. `web/src/components/Chart.jsx` wraps Chart.js and already registers `chartjs-plugin-annotation`.

The recent shot-to-profile flow has a `BoundaryChart` that demonstrates a marker interaction pattern for adding, dragging, and deleting boundaries. The new profile graph should use the same interaction idea, adapted to profile time markers instead of shot sample boundaries.

## Data Model

The editor derives keyframe markers from `data.phases` and writes marker edits back into `data.phases`. Markers are editor state, not a new saved format.

Each marker represents a boundary setpoint:

- `time`: cumulative time in seconds.
- `temperature`: target temperature, with `0` meaning use the profile default.
- `pressure`: pressure setpoint or limit in bar.
- `flow`: flow setpoint or limit in grams per second.
- `targetMode`: `pressure` or `flow`.
- `rampType`: transition shape for the segment from this marker to the next marker.
- `rampDuration`: `0` for `instant`, otherwise normally the full segment duration.

Each segment from marker `i` to marker `i + 1` becomes one phase:

- Phase duration is `marker[i + 1].time - marker[i].time`.
- Phase temperature comes from the next marker.
- Phase pump target values come from the next marker.
- Phase `pump.target` comes from the segment target mode.
- The non-target value remains available as the limit/restriction, matching the existing Pro profile semantics.
- Phase transition comes from the segment ramp style.

Example:

```text
0s: 90C / 9 bar / 4 g/s
10s: 90C / 6 bar / 4 g/s, linear
```

This creates a 10 second phase that ramps toward 6 bar while keeping 4 g/s as the flow limit.

## UI Behavior

The Advanced/Profile Pro editor keeps its current structure:

- Profile information at the top.
- Interactive graph in the middle.
- Selected phase/segment details below.

Graph interactions:

- Clicking the graph timeline adds a marker at that time.
- Dragging a marker horizontally changes phase timing.
- Clicking a marker or segment selects the matching phase.
- Deleting the selected marker/phase uses the existing trash action and keeps at least two markers so at least one segment remains.
- Editing values in the form immediately updates the selected marker/segment and redraws the graph.

The selected unit in the form should be described as a segment or phase between markers. The existing controls remain responsible for precise values:

- Temperature.
- Pressure and flow values.
- Active pump target mode: pressure or flow.
- Valve state.
- Ramp style and ramp duration.
- Stop conditions.

The graph should display:

- Pressure curve.
- Flow curve.
- Temperature as a visible line or marker track.
- Marker handles at phase boundaries.
- Segment highlighting for the selected phase.

## Compatibility Rules

- Existing Pro profiles open as keyframes by deriving markers from cumulative phase durations and phase target values.
- Saving writes the existing `phases` array; no backend or firmware schema change is required.
- Marker times are sorted and clamped so phase durations stay positive.
- A valid editable graph has at least two markers and one segment.
- `instant` uses `transition.duration = 0`.
- Linear/eased ramps default to the full segment duration.
- Stop conditions remain attached to the segment/phase they already belong to.
- Existing `hold-pressure` and `hold-flow` phase modes remain editable in the detailed form, but the graph-first keyframe flow focuses on explicit numeric setpoints.
- If pressure is unavailable, pressure-specific target controls continue to follow the existing `pressureAvailable` gating.

## Components

### Keyframe Conversion Helpers

Add pure helpers near the ProfileEdit code or in a focused utility module:

- Convert Pro profile phases to keyframe markers.
- Convert keyframe markers plus existing per-segment phase metadata back to Pro profile phases.
- Clamp and sort marker times.
- Preserve existing phase metadata such as name, valve, targets, and stop conditions.

### Interactive Profile Chart

Extend or wrap `ExtendedProfileChart` with edit capabilities:

- Render marker handles and selected segment state.
- Translate graph click/drag x positions to seconds.
- Emit marker add, move, select, and delete intents to `ExtendedProfileForm`.
- Keep non-edit chart usages, such as process display and profile list details, read-only.

### ExtendedProfileForm

`ExtendedProfileForm` remains the owner of profile data:

- Stores the selected segment index.
- Handles graph edit intents by updating `data.phases`.
- Passes selected segment state to the chart.
- Continues passing the selected phase to `ExtendedPhase`.

## Error Handling

- Ignore graph clicks outside the chart area.
- Clamp dragged markers so they cannot cross neighboring markers.
- Prevent deleting below the minimum marker count.
- If a loaded profile has missing or invalid durations, normalize to a small positive duration rather than producing zero-length phases.
- If pressure/flow values are missing, use conservative defaults that match current editor behavior.

## Testing And Verification

Add focused tests for the conversion helpers if the existing web test setup supports them. At minimum, verify manually and with build checks:

- Existing Pro profile phases convert into the expected marker timeline.
- Adding a marker splits one phase into two valid phases.
- Moving a marker updates adjacent phase durations.
- Deleting a marker merges/removes the expected segment without invalid durations.
- Editing pressure, flow, and target mode writes the correct `pump` object.
- Ramp styles write the expected `transition` object.
- `npm run build` passes in `web`.

## Open Implementation Notes

- The first version should prefer precise form editing over vertical drag editing because temperature, pressure, and flow use different scales.
- The current Chart.js wrapper may need an optional callback or ref bridge so the editable chart can read chart area bounds and translate pointer positions accurately.
- If annotation-based handles are awkward for dragging, an absolutely positioned overlay like `BoundaryChart` is acceptable as long as it uses real chart bounds instead of hard-coded padding.
