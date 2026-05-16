# Interactive Profile Keyframes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an interactive Advanced Profile graph where time-based keyframe markers create and edit Pro profile phases for temperature, pressure, flow, target mode, and ramp style.

**Architecture:** Keep the saved profile format as the existing Pro `phases` array. Add pure keyframe conversion helpers, then wire an editable chart overlay into the existing `ExtendedProfileForm` while leaving read-only chart usages unchanged.

**Tech Stack:** Preact, Chart.js 4, chartjs-plugin-annotation, Node built-in test runner, Vite.

---

## File Structure

- Create `web/src/pages/ProfileEdit/keyframeProfileLogic.js`: pure conversion and editing helpers for markers and Pro phases.
- Create `web/src/pages/ProfileEdit/keyframeProfileLogic.test.js`: node:test coverage for conversion, add, move, delete, target mode, and ramp output.
- Modify `web/src/components/Chart.jsx`: optional `onChartReady` callback so editable overlays can read Chart.js chart bounds.
- Modify `web/src/components/ExtendedProfileChart.jsx`: export chart config helpers, add optional temperature dataset, and pass `onChartReady` through to `ChartComponent`.
- Create `web/src/pages/ProfileEdit/ProfileKeyframeChart.jsx`: editable overlay for marker add/select/drag and segment select.
- Modify `web/src/pages/ProfileEdit/ExtendedProfileForm.jsx`: integrate keyframe helpers and editable chart, keep `ExtendedPhase` as the detailed selected-segment editor.
- Modify `web/src/pages/ProfileEdit/ExtendedPhase.jsx`: harden pump mode changes for numeric pump phases and clarify selected segment labels where needed.

## Task 1: Keyframe Conversion Helpers

**Files:**
- Create: `web/src/pages/ProfileEdit/keyframeProfileLogic.js`
- Create: `web/src/pages/ProfileEdit/keyframeProfileLogic.test.js`

- [ ] **Step 1: Write failing conversion tests**

Create `web/src/pages/ProfileEdit/keyframeProfileLogic.test.js` with:

```js
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addKeyframeAtTime,
  keyframesToProfile,
  moveKeyframeTime,
  profileToKeyframes,
  removeKeyframeAtIndex,
  updateKeyframeSegment,
} from './keyframeProfileLogic.js';

const baseProfile = {
  label: 'Keyframe Espresso',
  type: 'pro',
  temperature: 93,
  phases: [
    {
      name: 'Start',
      phase: 'preinfusion',
      valve: 1,
      pump: { target: 'pressure', pressure: 9, flow: 4 },
      duration: 0,
      transition: { type: 'instant', duration: 0, adaptive: true },
      targets: [],
      temperature: 90,
    },
    {
      name: 'Ramp Down',
      phase: 'brew',
      valve: 1,
      pump: { target: 'pressure', pressure: 6, flow: 4 },
      duration: 10,
      transition: { type: 'linear', duration: 10, adaptive: true },
      targets: [],
      temperature: 90,
    },
  ],
};

test('converts profile phases to persisted keyframe markers', () => {
  const markers = profileToKeyframes(baseProfile);

  assert.deepEqual(markers.map(marker => marker.time), [0, 10]);
  assert.equal(markers[0].temperature, 90);
  assert.equal(markers[0].pressure, 9);
  assert.equal(markers[0].flow, 4);
  assert.equal(markers[1].pressure, 6);
  assert.equal(markers[1].rampType, 'linear');
});

test('converts legacy profiles without a setup phase by synthesizing a start marker', () => {
  const legacy = {
    ...baseProfile,
    phases: baseProfile.phases.slice(1),
  };
  const markers = profileToKeyframes(legacy);

  assert.deepEqual(markers.map(marker => marker.time), [0, 10]);
  assert.equal(markers[0].pressure, 6);
  assert.equal(markers[1].pressure, 6);
});

test('writes initial keyframe as zero-second setup phase', () => {
  const profile = keyframesToProfile(baseProfile, profileToKeyframes(baseProfile));

  assert.equal(profile.phases[0].duration, 0);
  assert.equal(profile.phases[0].pump.pressure, 9);
  assert.equal(profile.phases[1].duration, 10);
  assert.equal(profile.phases[1].pump.target, 'pressure');
  assert.equal(profile.phases[1].transition.type, 'linear');
});

test('adding a marker splits the matching segment and keeps sorted time', () => {
  const result = addKeyframeAtTime(baseProfile, 4);

  assert.deepEqual(result.profile.phases.map(phase => phase.duration), [0, 4, 6]);
  assert.equal(result.selectedSegmentIndex, 1);
});

test('moving a marker changes adjacent durations without crossing neighbors', () => {
  const withMarker = addKeyframeAtTime(baseProfile, 4).profile;
  const result = moveKeyframeTime(withMarker, 1, 7);

  assert.deepEqual(result.profile.phases.map(phase => phase.duration), [0, 7, 3]);
});

test('removing an interior marker merges the neighboring time span', () => {
  const withMarker = addKeyframeAtTime(baseProfile, 4).profile;
  const result = removeKeyframeAtIndex(withMarker, 1);

  assert.deepEqual(result.profile.phases.map(phase => phase.duration), [0, 10]);
  assert.equal(result.selectedSegmentIndex, 0);
});

test('editing segment target mode preserves the other value as a limit', () => {
  const result = updateKeyframeSegment(baseProfile, 0, {
    targetMode: 'flow',
    pressure: 8,
    flow: 3.2,
    rampType: 'ease-out',
  });

  const phase = result.profile.phases[1];
  assert.equal(phase.pump.target, 'flow');
  assert.equal(phase.pump.pressure, 8);
  assert.equal(phase.pump.flow, 3.2);
  assert.equal(phase.transition.type, 'ease-out');
  assert.equal(phase.transition.duration, 10);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
node --test web/src/pages/ProfileEdit/keyframeProfileLogic.test.js
```

Expected: fail with an import error because `keyframeProfileLogic.js` does not exist.

- [ ] **Step 3: Implement conversion helpers**

Create `web/src/pages/ProfileEdit/keyframeProfileLogic.js` with these exported functions and constants:

```js
export const MIN_PHASE_DURATION = 0.1;

const DEFAULT_MARKER = {
  temperature: 0,
  pressure: 9,
  flow: 4,
  targetMode: 'pressure',
  rampType: 'instant',
};

function toNumber(value, fallback = 0) {
  const next = Number.parseFloat(value);
  return Number.isFinite(next) ? next : fallback;
}

function isPumpObject(pump) {
  return pump && typeof pump === 'object';
}

function readPump(pump, fallback = DEFAULT_MARKER) {
  if (!isPumpObject(pump)) {
    return {
      pressure: fallback.pressure,
      flow: fallback.flow,
      targetMode: fallback.targetMode,
    };
  }
  return {
    pressure: toNumber(pump.pressure, fallback.pressure),
    flow: toNumber(pump.flow, fallback.flow),
    targetMode: pump.target === 'flow' ? 'flow' : 'pressure',
  };
}

function makePump(marker) {
  return {
    target: marker.targetMode === 'flow' ? 'flow' : 'pressure',
    pressure: toNumber(marker.pressure, DEFAULT_MARKER.pressure),
    flow: toNumber(marker.flow, DEFAULT_MARKER.flow),
  };
}

function compactPatch(patch) {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
}

function phaseToMarker(phase, time, fallback = DEFAULT_MARKER, index = 0) {
  const pump = readPump(phase?.pump, fallback);
  return {
    time,
    name: phase?.name || (index === 0 ? 'Start' : `Phase ${index}`),
    temperature: toNumber(phase?.temperature, 0),
    pressure: pump.pressure,
    flow: pump.flow,
    targetMode: pump.targetMode,
    rampType: phase?.transition?.type || 'instant',
    rampDuration: toNumber(phase?.transition?.duration, 0),
    phase: phase?.phase || 'brew',
    valve: phase?.valve ?? 1,
    targets: Array.isArray(phase?.targets) ? [...phase.targets] : [],
  };
}

export function profileToKeyframes(profile) {
  const phases = Array.isArray(profile?.phases) ? profile.phases : [];
  if (phases.length === 0) {
    return [
      { ...DEFAULT_MARKER, time: 0, name: 'Start' },
      { ...DEFAULT_MARKER, time: 10, name: 'Phase 1' },
    ];
  }

  const hasInitialSetupPhase = toNumber(phases[0]?.duration, MIN_PHASE_DURATION) === 0;
  const markers = [];
  let time = 0;

  if (hasInitialSetupPhase) {
    markers.push(phaseToMarker(phases[0], 0, DEFAULT_MARKER, 0));
    for (let index = 1; index < phases.length; index++) {
      time += Math.max(MIN_PHASE_DURATION, toNumber(phases[index].duration, MIN_PHASE_DURATION));
      markers.push(phaseToMarker(phases[index], time, readPump(phases[index - 1].pump), index));
    }
  } else {
    markers.push(phaseToMarker(phases[0], 0, DEFAULT_MARKER, 0));
    for (let index = 0; index < phases.length; index++) {
      time += Math.max(MIN_PHASE_DURATION, toNumber(phases[index].duration, MIN_PHASE_DURATION));
      markers.push(phaseToMarker(phases[index], time, index > 0 ? readPump(phases[index - 1].pump) : readPump(phases[0].pump), index + 1));
    }
  }

  if (markers.length === 1) {
    markers.push({ ...markers[0], time: markers[0].time + 10, name: 'Phase 1' });
  }

  markers[0] = { ...markers[0], time: 0, rampType: 'instant', rampDuration: 0 };
  return markers;
}

export function keyframesToProfile(profile, markers, segmentMetadata = []) {
  const sorted = normalizeKeyframes(markers);
  const phases = sorted.map((marker, index) => {
    const nextTime = sorted[index]?.time ?? 0;
    const prevTime = index === 0 ? 0 : sorted[index - 1].time;
    const duration = index === 0 ? 0 : Math.max(MIN_PHASE_DURATION, nextTime - prevTime);
    const metadata = segmentMetadata[index] || {};
    const rampType = index === 0 ? 'instant' : marker.rampType || 'instant';
    return {
      name: marker.name || (index === 0 ? 'Start' : `Phase ${index}`),
      phase: metadata.phase || marker.phase || (index === 0 ? 'preinfusion' : 'brew'),
      valve: metadata.valve ?? marker.valve ?? 1,
      pump: makePump(marker),
      duration,
      transition: {
        type: rampType,
        duration: rampType === 'instant' ? 0 : duration,
        adaptive: metadata.transition?.adaptive ?? true,
      },
      targets: Array.isArray(metadata.targets) ? metadata.targets : Array.isArray(marker.targets) ? marker.targets : [],
      temperature: toNumber(marker.temperature, 0),
    };
  });

  return {
    ...profile,
    type: 'pro',
    phases,
  };
}

export function normalizeKeyframes(markers) {
  const sorted = [...markers].sort((a, b) => toNumber(a.time, 0) - toNumber(b.time, 0));
  return sorted.map((marker, index) => {
    const minTime = index === 0 ? 0 : sorted[index - 1].time + MIN_PHASE_DURATION;
    return {
      ...DEFAULT_MARKER,
      ...marker,
      time: index === 0 ? 0 : Math.max(minTime, toNumber(marker.time, minTime)),
    };
  });
}

export function addKeyframeAtTime(profile, time) {
  const markers = profileToKeyframes(profile);
  const clampedTime = Math.max(MIN_PHASE_DURATION, toNumber(time, MIN_PHASE_DURATION));
  let insertAfter = 0;
  for (let index = 0; index < markers.length; index++) {
    if (markers[index].time < clampedTime) insertAfter = index;
  }
  const source = markers[Math.min(insertAfter + 1, markers.length - 1)] || markers[markers.length - 1];
  const nextMarkers = normalizeKeyframes([
    ...markers,
    { ...source, time: clampedTime, name: `Phase ${markers.length}` },
  ]);
  return {
    profile: keyframesToProfile(profile, nextMarkers, profile.phases),
    selectedSegmentIndex: Math.max(0, nextMarkers.findIndex(marker => marker.time === clampedTime) - 1),
  };
}

export function moveKeyframeTime(profile, markerIndex, time) {
  const markers = profileToKeyframes(profile);
  if (markerIndex <= 0 || markerIndex >= markers.length) {
    return { profile, selectedSegmentIndex: Math.max(0, markerIndex - 1) };
  }
  const previous = markers[markerIndex - 1].time + MIN_PHASE_DURATION;
  const next = markers[markerIndex + 1]?.time - MIN_PHASE_DURATION;
  const maxTime = Number.isFinite(next) ? next : Number.POSITIVE_INFINITY;
  const clamped = Math.min(maxTime, Math.max(previous, toNumber(time, previous)));
  const nextMarkers = markers.map((marker, index) => index === markerIndex ? { ...marker, time: clamped } : marker);
  return {
    profile: keyframesToProfile(profile, nextMarkers, profile.phases),
    selectedSegmentIndex: markerIndex - 1,
  };
}

export function removeKeyframeAtIndex(profile, markerIndex) {
  const markers = profileToKeyframes(profile);
  if (markers.length <= 2 || markerIndex <= 0 || markerIndex >= markers.length) {
    return { profile, selectedSegmentIndex: 0 };
  }
  const nextMarkers = markers.filter((_, index) => index !== markerIndex);
  return {
    profile: keyframesToProfile(profile, nextMarkers, profile.phases),
    selectedSegmentIndex: Math.max(0, markerIndex - 1),
  };
}

export function updateKeyframeSegment(profile, segmentIndex, patch) {
  const markers = profileToKeyframes(profile);
  const markerIndex = Math.min(markers.length - 1, Math.max(1, segmentIndex + 1));
  const nextMarkers = markers.map((marker, index) => index === markerIndex ? { ...marker, ...compactPatch(patch) } : marker);
  return {
    profile: keyframesToProfile(profile, nextMarkers, profile.phases),
    selectedSegmentIndex: segmentIndex,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```powershell
node --test web/src/pages/ProfileEdit/keyframeProfileLogic.test.js
```

Expected: all six tests pass.

- [ ] **Step 5: Commit**

```powershell
git add -- web/src/pages/ProfileEdit/keyframeProfileLogic.js web/src/pages/ProfileEdit/keyframeProfileLogic.test.js
git commit -m "test: cover profile keyframe conversion"
```

## Task 2: Chart Plumbing And Temperature Display

**Files:**
- Modify: `web/src/components/Chart.jsx`
- Modify: `web/src/components/ExtendedProfileChart.jsx`

- [ ] **Step 1: Add chart lifecycle callback support**

Modify `ChartComponent` signature:

```js
export function ChartComponent({ data, className, chartClassName, onChartReady }) {
```

Inside the chart creation effect, after `const newChart = new Chart(...)`, call:

```js
onChartReady?.(newChart);
```

Inside cleanup, before destroy:

```js
onChartReady?.(null);
```

Include `onChartReady` in the creation effect dependency array.

- [ ] **Step 2: Export chart config helpers and add temperature dataset**

In `ExtendedProfileChart.jsx`, export `prepareData` and `makeChartData`:

```js
export function prepareData(phases, target) {
```

```js
export function makeChartData(data, selectedPhase, isDarkMode = false) {
```

Add a temperature dataset after flow:

```js
const temperatureDatasetDefaults = {
  label: 'Temperature',
  borderColor: 'rgb(255, 206, 86)',
  tension: 0.25,
  cubicInterpolationMode: 'monotone',
  spanGaps: true,
  yAxisID: 'y2',
};
```

For temperature data, add:

```js
function prepareTemperatureData(phases, profileTemperature = 93) {
  let time = 0;
  const data = [{ x: 0, y: profileTemperature }];
  for (const phase of phases || []) {
    const duration = Number.parseFloat(phase.duration) || 0;
    const temperature = Number.parseFloat(phase.temperature) || profileTemperature;
    data.push({ x: time, y: temperature });
    time += duration;
    data.push({ x: time, y: temperature });
  }
  return data;
}
```

Add the dataset:

```js
{
  ...temperatureDatasetDefaults,
  data: prepareTemperatureData(data.phases, Number.parseFloat(data.temperature) || 93),
},
```

Add hidden-by-default temperature axis:

```js
y2: {
  type: 'linear',
  display: true,
  position: 'right',
  title: {
    display: true,
    text: 'Temp (C)',
  },
  min: 80,
  max: 105,
  grid: {
    drawOnChartArea: false,
  },
  ticks: {
    font: {
      size: window.innerWidth < 640 ? 10 : 12,
    },
  },
},
```

- [ ] **Step 3: Pass chart ready callback through**

Update `ExtendedProfileChart` signature:

```js
export function ExtendedProfileChart({
  data,
  className = 'max-h-36 w-full',
  selectedPhase = null,
  onChartReady,
}) {
```

Pass to `ChartComponent`:

```jsx
<ChartComponent
  className='max-w-full flex-shrink flex-grow'
  chartClassName={className}
  data={config}
  onChartReady={onChartReady}
/>
```

- [ ] **Step 4: Verify build still passes**

Run:

```powershell
npm.cmd run build
```

from `web`.

Expected: Vite build completes successfully.

- [ ] **Step 5: Commit**

```powershell
git add -- web/src/components/Chart.jsx web/src/components/ExtendedProfileChart.jsx
git commit -m "feat: expose profile chart editing hooks"
```

## Task 3: Editable Keyframe Chart Overlay

**Files:**
- Create: `web/src/pages/ProfileEdit/ProfileKeyframeChart.jsx`
- Modify: `web/src/pages/ProfileEdit/ExtendedProfileForm.jsx`

- [ ] **Step 1: Create editable chart component**

Create `ProfileKeyframeChart.jsx` with:

```jsx
import { useCallback, useMemo, useRef, useState } from 'preact/hooks';
import { ExtendedProfileChart } from '../../components/ExtendedProfileChart.jsx';
import { profileToKeyframes } from './keyframeProfileLogic.js';

function getChartArea(chart) {
  return chart?.chartArea || null;
}

function markerToLeft(chart, marker) {
  const area = getChartArea(chart);
  const xScale = chart?.scales?.x;
  if (!area || !xScale) return null;
  return xScale.getPixelForValue(marker.time);
}

function eventToTime(chart, event) {
  const area = getChartArea(chart);
  const xScale = chart?.scales?.x;
  if (!area || !xScale) return null;
  const rect = chart.canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  if (x < area.left || x > area.right) return null;
  return xScale.getValueForPixel(x);
}

export function ProfileKeyframeChart({
  data,
  selectedSegmentIndex,
  onAddMarker,
  onMoveMarker,
  onSelectSegment,
  className = 'max-h-72 w-full',
}) {
  const [chart, setChart] = useState(null);
  const [dragging, setDragging] = useState(null);
  const overlayRef = useRef(null);
  const markers = useMemo(() => profileToKeyframes(data), [data]);

  const handleOverlayPointerDown = useCallback(
    event => {
      if (event.target !== event.currentTarget) return;
      const time = eventToTime(chart, event);
      if (time === null) return;
      onAddMarker(time);
    },
    [chart, onAddMarker],
  );

  const handleMarkerPointerDown = useCallback(
    (event, markerIndex) => {
      event.preventDefault();
      event.stopPropagation();
      onSelectSegment(Math.max(0, markerIndex - 1));
      setDragging(markerIndex);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [onSelectSegment],
  );

  const handleMarkerPointerMove = useCallback(
    event => {
      if (dragging === null) return;
      const time = eventToTime(chart, event);
      if (time === null) return;
      onMoveMarker(dragging, time);
    },
    [chart, dragging, onMoveMarker],
  );

  const stopDragging = useCallback(() => setDragging(null), []);

  return (
    <div ref={overlayRef} className='relative'>
      <ExtendedProfileChart
        data={data}
        selectedPhase={selectedSegmentIndex + 1}
        className={className}
        onChartReady={setChart}
      />
      <div
        className='absolute inset-0'
        onPointerDown={handleOverlayPointerDown}
        onPointerMove={handleMarkerPointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        style={{ cursor: 'crosshair', touchAction: 'none' }}
      >
        {chart &&
          markers.map((marker, index) => {
            const left = markerToLeft(chart, marker);
            if (left === null) return null;
            const selected = Math.max(0, index - 1) === selectedSegmentIndex;
            return (
              <button
                key={`${index}-${marker.time}`}
                type='button'
                className={`absolute top-8 bottom-8 w-4 -translate-x-1/2 border-0 bg-transparent p-0 ${index === 0 ? 'cursor-default' : 'cursor-ew-resize'}`}
                style={{ left: `${left}px` }}
                onPointerDown={event => index > 0 && handleMarkerPointerDown(event, index)}
                onClick={event => {
                  event.stopPropagation();
                  onSelectSegment(Math.max(0, index - 1));
                }}
                aria-label={`Select marker ${index + 1}`}
              >
                <span
                  className={`absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 ${selected ? 'bg-primary' : 'bg-base-content/50'}`}
                />
                <span
                  className={`absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border ${selected ? 'border-primary bg-primary' : 'border-base-content/70 bg-base-100'}`}
                />
              </button>
            );
          })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire chart component into form imports**

In `ExtendedProfileForm.jsx`, replace:

```js
import { ExtendedProfileChart } from '../../components/ExtendedProfileChart.jsx';
```

with:

```js
import { ProfileKeyframeChart } from './ProfileKeyframeChart.jsx';
import {
  addKeyframeAtTime,
  moveKeyframeTime,
  removeKeyframeAtIndex,
} from './keyframeProfileLogic.js';
```

- [ ] **Step 3: Add graph handlers in `ExtendedProfileForm`**

Add inside the component:

```js
const applyKeyframeResult = result => {
  onChange(result.profile);
  setCurrentPhaseIndex(result.selectedSegmentIndex + 1);
};

const onMarkerAdd = time => applyKeyframeResult(addKeyframeAtTime(data, time));
const onMarkerMove = (markerIndex, time) => applyKeyframeResult(moveKeyframeTime(data, markerIndex, time));
const onSegmentSelect = segmentIndex => setCurrentPhaseIndex(segmentIndex + 1);
```

- [ ] **Step 4: Render the editable chart**

Replace the `ExtendedProfileChart` JSX with:

```jsx
<ProfileKeyframeChart
  data={data}
  selectedSegmentIndex={Math.max(0, currentPhaseIndex - 1)}
  onAddMarker={onMarkerAdd}
  onMoveMarker={onMarkerMove}
  onSelectSegment={onSegmentSelect}
  className='max-h-72 w-full'
/>
```

- [ ] **Step 5: Update delete behavior to preserve initial marker**

Change the trash button handler:

```jsx
onClick={() => applyKeyframeResult(removeKeyframeAtIndex(data, currentPhaseIndex))}
```

Disable when deleting is not valid:

```jsx
disabled={data.phases.length <= 2 || currentPhaseIndex === 0}
```

- [ ] **Step 6: Run build**

Run from `web`:

```powershell
npm.cmd run build
```

Expected: Vite build completes successfully.

- [ ] **Step 7: Commit**

```powershell
git add -- web/src/pages/ProfileEdit/ProfileKeyframeChart.jsx web/src/pages/ProfileEdit/ExtendedProfileForm.jsx
git commit -m "feat: add interactive profile keyframe chart"
```

## Task 4: Form Semantics And Segment Editing

**Files:**
- Modify: `web/src/pages/ProfileEdit/ExtendedProfileForm.jsx`
- Modify: `web/src/pages/ProfileEdit/ExtendedPhase.jsx`
- Modify: `web/src/pages/ProfileEdit/keyframeProfileLogic.js`
- Modify: `web/src/pages/ProfileEdit/keyframeProfileLogic.test.js`

- [ ] **Step 1: Add test for editing selected segment values**

Append to `keyframeProfileLogic.test.js`:

```js
test('updates selected segment values through next marker semantics', () => {
  const result = updateKeyframeSegment(baseProfile, 0, {
    temperature: 91,
    pressure: 5.5,
    flow: 3,
    targetMode: 'pressure',
    rampType: 'ease-in-out',
  });

  assert.equal(result.profile.phases[1].temperature, 91);
  assert.equal(result.profile.phases[1].pump.pressure, 5.5);
  assert.equal(result.profile.phases[1].pump.flow, 3);
  assert.equal(result.profile.phases[1].transition.type, 'ease-in-out');
});
```

- [ ] **Step 2: Run test to verify current behavior**

Run:

```powershell
node --test web/src/pages/ProfileEdit/keyframeProfileLogic.test.js
```

Expected: pass if Task 1 already implemented `updateKeyframeSegment`; otherwise fail until Step 3.

- [ ] **Step 3: Route `ExtendedPhase` changes through keyframe update for runnable segments**

In `ExtendedProfileForm.jsx`, import `updateKeyframeSegment`.

Change `onPhaseChange`:

```js
const onPhaseChange = (index, value) => {
  if (index > 0) {
    const pumpPatch = value.pump && typeof value.pump === 'object'
      ? {
          pressure: value.pump.pressure,
          flow: value.pump.flow,
          targetMode: value.pump.target,
        }
      : {};
    const result = updateKeyframeSegment(data, index - 1, {
      name: value.name,
      phase: value.phase,
      valve: value.valve,
      temperature: value.temperature,
      ...pumpPatch,
      rampType: value.transition?.type,
      targets: value.targets,
    });
    onChange(result.profile);
    return;
  }

  const newData = { ...data, phases: [...data.phases] };
  newData.phases[index] = value;
  onChange(newData);
};
```

- [ ] **Step 4: Guard numeric pump mode changes**

In `ExtendedPhase.jsx`, update pressure and flow mode button handlers so they do not read `phase.pump.pressure` when `phase.pump` is numeric:

```js
const currentPressure = !isNumber(phase.pump) ? phase.pump.pressure : 0;
const currentFlow = !isNumber(phase.pump) ? phase.pump.flow : 0;
```

Use `currentPressure` and `currentFlow` in all pump object creation paths.

- [ ] **Step 5: Clarify selected segment labels**

In `ExtendedProfileForm.jsx`, change the phase card title from:

```jsx
<h2 className='card-title flex-grow text-lg sm:text-xl'>Phases</h2>
```

to:

```jsx
<h2 className='card-title flex-grow text-lg sm:text-xl'>Selected Segment</h2>
```

Keep the count display, but show segment count excluding the initial setpoint:

```jsx
{Math.max(1, currentPhaseIndex)} / {Math.max(1, data.phases.length - 1)}
```

- [ ] **Step 6: Run focused tests and build**

Run:

```powershell
node --test web/src/pages/ProfileEdit/keyframeProfileLogic.test.js
```

Expected: all tests pass.

Run from `web`:

```powershell
npm.cmd run build
```

Expected: Vite build completes successfully.

- [ ] **Step 7: Commit**

```powershell
git add -- web/src/pages/ProfileEdit/ExtendedProfileForm.jsx web/src/pages/ProfileEdit/ExtendedPhase.jsx web/src/pages/ProfileEdit/keyframeProfileLogic.js web/src/pages/ProfileEdit/keyframeProfileLogic.test.js
git commit -m "feat: edit profile segments from keyframes"
```

## Task 5: Final Verification And Cleanup

**Files:**
- Review: all touched files

- [ ] **Step 1: Run focused node tests**

Run:

```powershell
node --test web/src/pages/ProfileEdit/keyframeProfileLogic.test.js
```

Expected: all tests pass.

- [ ] **Step 2: Run web build**

Run from `web`:

```powershell
npm.cmd run build
```

Expected: Vite build completes successfully.

- [ ] **Step 3: Run diff whitespace check**

Run:

```powershell
git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 4: Inspect final diff scope**

Run:

```powershell
git diff --stat HEAD~4..HEAD
```

Expected: changes are limited to the profile editor, chart components, tests, and docs.

- [ ] **Step 5: Commit verification-only fixes if needed**

If Step 1, Step 2, or Step 3 required fixes, commit only those fixes:

```powershell
git add -- web/src/pages/ProfileEdit web/src/components/Chart.jsx web/src/components/ExtendedProfileChart.jsx
git commit -m "fix: stabilize profile keyframe editor"
```

If no fixes were needed, do not create an empty commit.
