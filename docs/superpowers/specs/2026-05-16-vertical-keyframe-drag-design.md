# Vertical Keyframe Drag — Design Spec

**Date:** 2026-05-16
**Branch:** feat/interactive-profile-keyframes
**Status:** Approved

## Problem

Keyframe markers in the profile editor can be dragged horizontally to adjust phase timing, but there is no way to drag them vertically to adjust pressure, flow, or temperature values. Users must go to the segment form to change these values.

## Goal

Add vertical drag handles to each keyframe marker so users can directly manipulate pressure/flow and temperature values on the chart.

## Scope

- Pressure/flow handle: one per marker, positioned at the marker's pressure or flow value on the appropriate y-axis (`y` for pressure, `y1` for flow), based on the phase's `targetMode`.
- Temperature handle: one per marker, always present, positioned on the `y2` axis.
- Existing horizontal time drag is unchanged.
- First marker (index 0) — time is locked but value and temperature handles are still draggable.

## Architecture

### 1. Logic Layer — `keyframeProfileLogic.js`

Add one new exported function:

```js
export function updateKeyframeValue(profile, markerIndex, patch)
```

- `patch`: `{ pressure?, flow?, temperature? }` — partial, apply only provided fields
- Calls `profileToKeyframes`, patches marker at `markerIndex`, rebuilds via `keyframesToProfile` with existing metadata preserved
- Returns `{ profile, selectedSegmentIndex }` consistent with all other logic functions
- No existing functions are modified

### 2. Coordinate Helpers — `ProfileKeyframeChart.jsx`

Four new private helpers:

| Helper | Purpose |
|---|---|
| `markerToValueTop(chart, marker)` | Pixel Y for pressure/flow handle. Uses `chart.scales.y` if `targetMode === 'pressure'`, else `chart.scales.y1`. |
| `markerToTempTop(chart, marker)` | Pixel Y for temperature handle. Uses `chart.scales.y2`. |
| `eventToValue(chart, event, marker)` | Converts `clientY` → pressure or flow value, clamped to scale min/max. |
| `eventToTemperature(chart, event)` | Converts `clientY` → temperature value, clamped to 80–105. |

### 3. Drag State — `ProfileKeyframeChart.jsx`

Replace `markerIndex | null` with a tagged object:

```js
// null | { markerIndex: number, type: 'time' | 'value' | 'temperature' }
const [dragging, setDragging] = useState(null);
```

Pointer move handler dispatches on `dragging.type`:
- `'time'` → existing `onMoveMarker(markerIndex, time)`
- `'value'` → `onUpdateMarkerValue(markerIndex, { pressure | flow, value })`
- `'temperature'` → `onUpdateMarkerValue(markerIndex, { temperature })`

### 4. New Prop — `ProfileKeyframeChart.jsx`

```js
onUpdateMarkerValue(markerIndex, patch)
// patch: { pressure?, flow?, temperature? }
```

### 5. Visual Handles — `ProfileKeyframeChart.jsx`

Each marker renders three interactive elements:

| Element | Size | Color | Cursor | Drag type |
|---|---|---|---|---|
| Line hit area (existing) | full height, `w-4` | transparent | `ew-resize` (or `default` for index 0) | `'time'` |
| Value handle | `w-4 h-4` circle | primary (selected) / base-100 (unselected) | `ns-resize` | `'value'` |
| Temperature handle | `w-3 h-3` circle | amber (`bg-amber-400 border-amber-500`) | `ns-resize` | `'temperature'` |

Both new handles:
- Use `position: absolute`, `left: 50%`, `translateX(-50%)`, `top` set to the computed pixel Y
- Call `event.stopPropagation()` on pointer down to prevent "add marker" trigger
- Call `event.currentTarget.setPointerCapture(event.pointerId)` to hold drag across pointer movement

### 6. Form Wiring — `ExtendedProfileForm.jsx`

Add `onUpdateMarkerValue` handler:

```js
const onMarkerValueUpdate = (markerIndex, patch) =>
  applyKeyframeResult(updateKeyframeValue(data, markerIndex, patch));
```

Pass to `ProfileKeyframeChart` as `onUpdateMarkerValue={onMarkerValueUpdate}`.

Import `updateKeyframeValue` from `keyframeProfileLogic.js`.

## Files Changed

| File | Change |
|---|---|
| `web/src/pages/ProfileEdit/keyframeProfileLogic.js` | Add `updateKeyframeValue` |
| `web/src/pages/ProfileEdit/ProfileKeyframeChart.jsx` | Helpers, drag state, two new handles, new prop |
| `web/src/pages/ProfileEdit/ExtendedProfileForm.jsx` | Wire `onUpdateMarkerValue` |

## Out of Scope

- Snapping to round values during drag
- Visual label showing the current value while dragging
- Temperature drag on the first marker having a distinct visual (it's treated the same as all others)
