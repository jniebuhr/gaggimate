# Vertical Keyframe Drag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add vertical drag handles to each keyframe marker so users can directly manipulate pressure/flow and temperature values by dragging up/down on the chart.

**Architecture:** Three files change: (1) `keyframeProfileLogic.js` gets a new `updateKeyframeValue` function that patches marker values and rebuilds the profile; (2) `ProfileKeyframeChart.jsx` gets coordinate helpers, a tagged drag state, updated pointer handlers, and two new visual handles per marker (value circle and temperature circle); (3) `ExtendedProfileForm.jsx` wires up the new callback. All existing horizontal time-drag behavior is preserved.

**Tech Stack:** Preact, Chart.js scales API (pixel↔value conversion), Tailwind CSS, Node.js native test runner

---

### Task 1: Add `updateKeyframeValue` to keyframeProfileLogic.js

**Files:**
- Modify: `web/src/pages/ProfileEdit/keyframeProfileLogic.js`
- Modify: `web/src/pages/ProfileEdit/keyframeProfileLogic.test.js`

- [ ] **Step 1.1: Add `updateKeyframeValue` to the import in the test file**

At the top of `web/src/pages/ProfileEdit/keyframeProfileLogic.test.js`, add `updateKeyframeValue` to the import:

```js
import {
  addKeyframeAtTime,
  keyframesToProfile,
  moveKeyframeTime,
  normalizeKeyframes,
  profileToKeyframes,
  removeKeyframeAtIndex,
  updateKeyframeSegment,
  updateKeyframeValue,
} from './keyframeProfileLogic.js';
```

- [ ] **Step 1.2: Write the failing tests**

Append these tests at the end of `web/src/pages/ProfileEdit/keyframeProfileLogic.test.js`. They use the existing `baseProfile` fixture (setup phase at index 0 with duration 0, brew phase at index 1 with duration 10, both with pump.pressure=9/6, pump.flow=4, temperature=90).

```js
test('updateKeyframeValue patches pressure on marker 1', () => {
  const result = updateKeyframeValue(baseProfile, 1, { pressure: 9.5 });
  assert.equal(result.profile.phases[1].pump.pressure, 9.5);
  assert.equal(result.selectedSegmentIndex, 0);
});

test('updateKeyframeValue patches flow on marker 1', () => {
  const result = updateKeyframeValue(baseProfile, 1, { flow: 7 });
  assert.equal(result.profile.phases[1].pump.flow, 7);
});

test('updateKeyframeValue patches temperature on marker 1', () => {
  const result = updateKeyframeValue(baseProfile, 1, { temperature: 96 });
  assert.equal(result.profile.phases[1].temperature, 96);
});

test('updateKeyframeValue preserves other marker values when patching only pressure', () => {
  const result = updateKeyframeValue(baseProfile, 1, { pressure: 9.5 });
  assert.equal(result.profile.phases[1].pump.flow, 4);
  assert.equal(result.profile.phases[1].temperature, 90);
});

test('updateKeyframeValue returns original profile for out-of-range markerIndex', () => {
  const result = updateKeyframeValue(baseProfile, 99, { pressure: 9.5 });
  assert.equal(result.profile, baseProfile);
  assert.equal(result.selectedSegmentIndex, 0);
});

test('updateKeyframeValue on marker 0 updates start phase and returns selectedSegmentIndex 0', () => {
  const result = updateKeyframeValue(baseProfile, 0, { pressure: 5 });
  assert.equal(result.profile.phases[0].pump.pressure, 5);
  assert.equal(result.selectedSegmentIndex, 0);
});
```

- [ ] **Step 1.3: Run tests to confirm they fail**

Run from the `web/` directory (all test commands assume `web/` as working directory):

```bash
node --test src/pages/ProfileEdit/keyframeProfileLogic.test.js
```

Expected: The six new tests fail with `TypeError: updateKeyframeValue is not a function`. Existing tests still pass.

- [ ] **Step 1.4: Implement `updateKeyframeValue`**

Add this function at the end of `web/src/pages/ProfileEdit/keyframeProfileLogic.js`, after `updateKeyframeSegment`:

```js
export function updateKeyframeValue(profile, markerIndex, patch) {
  const markers = profileToKeyframes(profile);

  if (markerIndex < 0 || markerIndex >= markers.length) {
    return { profile, selectedSegmentIndex: 0 };
  }

  const nextMarkers = markers.map((m, i) => (i === markerIndex ? { ...m, ...patch } : m));

  return {
    profile: keyframesToProfile(profile, nextMarkers, getMarkerAlignedMetadata(profile)),
    selectedSegmentIndex: Math.max(0, markerIndex - 1),
  };
}
```

- [ ] **Step 1.5: Run tests to confirm they pass**

```bash
node --test src/pages/ProfileEdit/keyframeProfileLogic.test.js
```

Expected: All tests pass, output shows `✓` for every test including the six new ones.

- [ ] **Step 1.6: Commit**

```bash
git add src/pages/ProfileEdit/keyframeProfileLogic.js src/pages/ProfileEdit/keyframeProfileLogic.test.js
git commit -m "feat: add updateKeyframeValue for direct marker value editing"
```

---

### Task 2: Add coordinate helpers and update drag state in ProfileKeyframeChart

**Files:**
- Modify: `web/src/pages/ProfileEdit/ProfileKeyframeChart.jsx`

All edits are within the `web/` directory.

- [ ] **Step 2.1: Add four coordinate helper functions**

In `web/src/pages/ProfileEdit/ProfileKeyframeChart.jsx`, add these four helpers immediately after the existing `eventToTime` function (around line 24):

```js
function markerToValueTop(chart, marker) {
  const isFlow = marker.targetMode === 'flow';
  const scale = isFlow ? chart?.scales?.y1 : chart?.scales?.y;
  if (!scale) return null;
  return scale.getPixelForValue(isFlow ? marker.flow : marker.pressure);
}

function markerToTempTop(chart, marker) {
  const scale = chart?.scales?.y2;
  if (!scale) return null;
  return scale.getPixelForValue(marker.temperature);
}

function eventToValue(chart, event, marker) {
  const isFlow = marker.targetMode === 'flow';
  const scale = isFlow ? chart?.scales?.y1 : chart?.scales?.y;
  if (!scale) return null;
  const rect = chart.canvas.getBoundingClientRect();
  const y = event.clientY - rect.top;
  const value = scale.getValueForPixel(y);
  return Math.min(scale.max, Math.max(scale.min, value));
}

function eventToTemperature(chart, event) {
  const scale = chart?.scales?.y2;
  if (!scale) return null;
  const rect = chart.canvas.getBoundingClientRect();
  const y = event.clientY - rect.top;
  const value = scale.getValueForPixel(y);
  return Math.min(scale.max, Math.max(scale.min, value));
}
```

- [ ] **Step 2.2: Update the `ProfileKeyframeChart` function signature to accept `onUpdateMarkerValue`**

Change the destructured props of `ProfileKeyframeChart` from:

```js
export function ProfileKeyframeChart({
  data,
  selectedSegmentIndex,
  onAddMarker,
  onMoveMarker,
  onSelectSegment,
  className = 'max-h-72 w-full',
}) {
```

to:

```js
export function ProfileKeyframeChart({
  data,
  selectedSegmentIndex,
  onAddMarker,
  onMoveMarker,
  onUpdateMarkerValue,
  onSelectSegment,
  className = 'max-h-72 w-full',
}) {
```

- [ ] **Step 2.3: Replace the drag state and all pointer handlers**

Inside `ProfileKeyframeChart`, replace:
- The `const [dragging, setDragging] = useState(null);` line
- The `handleMarkerPointerDown` callback
- The `handleMarkerPointerMove` callback
- The `stopDragging` callback

with this complete replacement block:

```js
const [dragging, setDragging] = useState(null);
// null | { markerIndex: number, type: 'time' | 'value' | 'temperature' }

const handleMarkerPointerDown = useCallback(
  (event, markerIndex) => {
    event.preventDefault();
    event.stopPropagation();
    onSelectSegment(Math.max(0, markerIndex - 1));
    setDragging({ markerIndex, type: 'time' });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  },
  [onSelectSegment],
);

const handleValuePointerDown = useCallback(
  (event, markerIndex) => {
    event.preventDefault();
    event.stopPropagation();
    onSelectSegment(Math.max(0, markerIndex - 1));
    setDragging({ markerIndex, type: 'value' });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  },
  [onSelectSegment],
);

const handleTempPointerDown = useCallback(
  (event, markerIndex) => {
    event.preventDefault();
    event.stopPropagation();
    onSelectSegment(Math.max(0, markerIndex - 1));
    setDragging({ markerIndex, type: 'temperature' });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  },
  [onSelectSegment],
);

const handleMarkerPointerMove = useCallback(
  event => {
    if (dragging === null) return;
    const { markerIndex, type } = dragging;
    if (type === 'time') {
      const time = eventToTime(chart, event);
      if (time === null) return;
      onMoveMarker(markerIndex, time);
    } else if (type === 'value') {
      const marker = markers[markerIndex];
      if (!marker) return;
      const value = eventToValue(chart, event, marker);
      if (value === null) return;
      const isFlow = marker.targetMode === 'flow';
      onUpdateMarkerValue(markerIndex, isFlow ? { flow: value } : { pressure: value });
    } else if (type === 'temperature') {
      const temp = eventToTemperature(chart, event);
      if (temp === null) return;
      onUpdateMarkerValue(markerIndex, { temperature: temp });
    }
  },
  [chart, dragging, markers, onMoveMarker, onUpdateMarkerValue],
);

const stopDragging = useCallback(() => setDragging(null), []);
```

- [ ] **Step 2.4: Verify the build**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in X.XXs` with no errors (there will be a chunk size warning — that's pre-existing and fine).

- [ ] **Step 2.5: Commit**

```bash
git add src/pages/ProfileEdit/ProfileKeyframeChart.jsx
git commit -m "feat: add vertical drag coordinate helpers and dispatch to ProfileKeyframeChart"
```

---

### Task 3: Add value and temperature visual handles to marker rendering

**Files:**
- Modify: `web/src/pages/ProfileEdit/ProfileKeyframeChart.jsx`

- [ ] **Step 3.1: Add `Fragment` import**

At the top of `web/src/pages/ProfileEdit/ProfileKeyframeChart.jsx`, change:

```js
import { useCallback, useMemo, useRef, useState } from 'preact/hooks';
```

to:

```js
import { Fragment } from 'preact';
import { useCallback, useMemo, useRef, useState } from 'preact/hooks';
```

- [ ] **Step 3.2: Replace the marker rendering block**

Find the `{chart && markers.map(...)}` block in the JSX (currently renders `<button>` elements with a line span and a circle span inside). Replace the entire block with:

```jsx
{chart &&
  markers.map((marker, index) => {
    const left = markerToLeft(chart, marker);
    const valueTop = markerToValueTop(chart, marker);
    const tempTop = markerToTempTop(chart, marker);
    if (left === null) return null;
    const selected = Math.max(0, index - 1) === selectedSegmentIndex;
    return (
      <Fragment key={`${index}-${marker.time}`}>
        <button
          type='button'
          className={`absolute top-8 bottom-8 w-4 -translate-x-1/2 border-0 bg-transparent p-0 ${index === 0 ? 'cursor-default' : 'cursor-ew-resize'}`}
          style={{ left: `${left}px` }}
          onPointerDown={event => {
            event.stopPropagation();
            if (index > 0) handleMarkerPointerDown(event, index);
          }}
          onClick={event => {
            event.stopPropagation();
            onSelectSegment(Math.max(0, index - 1));
          }}
          aria-label={`Select marker ${index + 1}`}
        >
          <span
            className={`absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 ${selected ? 'bg-primary' : 'bg-base-content/50'}`}
          />
        </button>
        {valueTop !== null && (
          <span
            className={`absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize rounded-full border ${selected ? 'border-primary bg-primary' : 'border-base-content/70 bg-base-100'}`}
            style={{ left: `${left}px`, top: `${valueTop}px` }}
            onPointerDown={event => handleValuePointerDown(event, index)}
          />
        )}
        {tempTop !== null && (
          <span
            className='absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize rounded-full border border-amber-500 bg-amber-400'
            style={{ left: `${left}px`, top: `${tempTop}px` }}
            onPointerDown={event => handleTempPointerDown(event, index)}
          />
        )}
      </Fragment>
    );
  })}
```

Key differences from the original:
- Each marker is now a `<Fragment>` containing three elements instead of a single `<button>`
- The button keeps the line span but loses the circle span (circle is now the `valueTop` handle)
- `valueTop` handle: absolutely positioned at the pressure/flow value, styled with primary/base-100 colors matching the selected state
- `tempTop` handle: absolutely positioned at the temperature value, always amber (`bg-amber-400 border-amber-500`), smaller (`h-3 w-3`)
- Both new handles stop propagation on pointer down so the overlay's "add marker" handler doesn't fire

- [ ] **Step 3.3: Verify the build**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in X.XXs` with no errors.

- [ ] **Step 3.4: Commit**

```bash
git add src/pages/ProfileEdit/ProfileKeyframeChart.jsx
git commit -m "feat: add value and temperature drag handles to keyframe markers"
```

---

### Task 4: Wire onUpdateMarkerValue in ExtendedProfileForm

**Files:**
- Modify: `web/src/pages/ProfileEdit/ExtendedProfileForm.jsx`

- [ ] **Step 4.1: Add `updateKeyframeValue` to the import**

In `web/src/pages/ProfileEdit/ExtendedProfileForm.jsx`, update the import from `keyframeProfileLogic.js`:

```js
import {
  addKeyframeAtTime,
  hasInitialSetupPhase,
  moveKeyframeTime,
  removeKeyframeAtIndex,
  updateKeyframeSegment,
  updateKeyframeValue,
} from './keyframeProfileLogic.js';
```

- [ ] **Step 4.2: Add the `onMarkerValueUpdate` handler**

Add this handler immediately after the `onSegmentSelect` line (around line 110):

```js
const onMarkerValueUpdate = (markerIndex, patch) =>
  applyKeyframeResult(updateKeyframeValue(data, markerIndex, patch));
```

- [ ] **Step 4.3: Pass the new prop to `ProfileKeyframeChart`**

Find the `<ProfileKeyframeChart>` JSX element and add `onUpdateMarkerValue`:

```jsx
<ProfileKeyframeChart
  data={data}
  selectedSegmentIndex={Math.max(0, currentPhaseIndex - 1)}
  onAddMarker={onMarkerAdd}
  onMoveMarker={onMarkerMove}
  onUpdateMarkerValue={onMarkerValueUpdate}
  onSelectSegment={onSegmentSelect}
  className='max-h-72 w-full'
/>
```

- [ ] **Step 4.4: Run the full test suite**

```bash
node --test src/pages/ProfileEdit/keyframeProfileLogic.test.js
```

Expected: All tests pass.

- [ ] **Step 4.5: Verify the build**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in X.XXs` with no errors.

- [ ] **Step 4.6: Commit**

```bash
git add src/pages/ProfileEdit/ExtendedProfileForm.jsx
git commit -m "feat: wire vertical keyframe drag to profile form"
```
