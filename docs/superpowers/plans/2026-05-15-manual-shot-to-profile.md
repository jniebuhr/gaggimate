# Manual Shot → Profile Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users convert a manual-mode shot from shot history into a reusable Pro brew profile, using an auto-detected + user-adjustable phase segmentation of the shot telemetry.

**Architecture:** A new `/shots/:id/to-profile` page fetches and parses the shot binary, runs a JS phase-detection algorithm to propose segment boundaries, renders an interactive chart overlay for adjusting those boundaries, shows per-segment config cards, then hands the generated profile to the existing Pro profile editor via a module-level pending-profile store.

**Tech Stack:** Preact + preact-iso routing, Chart.js (via existing `HistoryChart`), Tailwind CSS, FontAwesome icons, existing `parseBinaryShot.js`, existing `ProfileEdit` page.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `web/src/pages/ShotToProfile/detectPhases.js` | Pure algorithm: samples → boundary indices |
| Create | `web/src/pages/ShotToProfile/buildProfile.js` | Pure builder: segments → profile object |
| Create | `web/src/state/pendingProfile.js` | Module-level store for profile handoff |
| Create | `web/src/pages/ShotToProfile/SegmentCard.jsx` | Per-phase config card component |
| Create | `web/src/pages/ShotToProfile/BoundaryChart.jsx` | HistoryChart + draggable marker overlay |
| Create | `web/src/pages/ShotToProfile/index.jsx` | Page: fetch shot, orchestrate flow |
| Modify | `web/src/pages/ShotHistory/HistoryCard.jsx` | Add "Save as Profile" button for manual shots |
| Modify | `web/src/pages/ProfileEdit/index.jsx` | Read pendingProfile on mount when id === 'new' |
| Modify | `web/src/index.jsx` | Add `/shots/:id/to-profile` route |

---

## Task 1: Phase Detection Algorithm

**Files:**
- Create: `web/src/pages/ShotToProfile/detectPhases.js`

- [ ] **Step 1: Create the file**

```javascript
// web/src/pages/ShotToProfile/detectPhases.js

const SMOOTH_WINDOW = 8;   // ~2 s rolling average at 250 ms/sample
const MIN_GAP = 20;        // ~5 s minimum between boundaries
const SUSTAIN = 3;         // derivative sign must hold for this many samples
const MAX_BOUNDARIES = 5;  // cap phases at 6

/**
 * @param {Array} samples - parsed ShotLogSample array (fields: cp, fl, t)
 * @param {boolean} isFlowTargeted - true when the shot used a flow target
 * @returns {number[]} sorted sample indices where phase boundaries are placed
 */
export function detectPhases(samples, isFlowTargeted = false) {
  if (samples.length < SMOOTH_WINDOW * 2) return [];

  const raw = samples.map(s => (isFlowTargeted ? s.fl : s.cp));

  // Rolling average smoothing
  const smoothed = raw.map((_, i) => {
    const lo = Math.max(0, i - SMOOTH_WINDOW);
    const hi = Math.min(raw.length, i + SMOOTH_WINDOW + 1);
    const slice = raw.slice(lo, hi);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });

  // First-order derivative
  const deriv = smoothed.map((v, i) => (i === 0 ? 0 : v - smoothed[i - 1]));

  // Detect sustained sign changes
  const candidates = [];
  let prevSign = Math.sign(deriv[1]) || 1;
  let run = 0;
  let runStart = 1;

  for (let i = 1; i < deriv.length; i++) {
    const s = Math.sign(deriv[i]);
    if (s !== 0 && s === prevSign) {
      run++;
    } else {
      if (s !== 0 && s !== prevSign && run >= SUSTAIN) {
        candidates.push({ index: runStart, magnitude: Math.abs(deriv[runStart]) });
      }
      if (s !== 0) {
        prevSign = s;
        runStart = i;
        run = 1;
      }
    }
  }

  // Merge boundaries closer than MIN_GAP (keep larger magnitude)
  const merged = [];
  for (const c of candidates) {
    if (merged.length === 0 || c.index - merged[merged.length - 1].index >= MIN_GAP) {
      merged.push({ ...c });
    } else if (c.magnitude > merged[merged.length - 1].magnitude) {
      merged[merged.length - 1] = { ...c };
    }
  }

  // Keep at most MAX_BOUNDARIES by magnitude, then re-sort by position
  return merged
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, MAX_BOUNDARIES)
    .sort((a, b) => a.index - b.index)
    .map(c => c.index);
}
```

- [ ] **Step 2: Verify the file exists and has no syntax errors**

```bash
cd web && node --input-type=module <<'EOF'
import { detectPhases } from './src/pages/ShotToProfile/detectPhases.js';
const samples = Array.from({ length: 100 }, (_, i) => ({
  cp: i < 30 ? i * 0.3 : 9,
  fl: 2,
  t: i * 250,
}));
console.log('boundaries:', detectPhases(samples, false));
EOF
```

Expected output: `boundaries: [ <one or more indices near 30> ]`

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/ShotToProfile/detectPhases.js
git commit -m "feat: add phase detection algorithm for shot-to-profile conversion"
```

---

## Task 2: Profile Builder

**Files:**
- Create: `web/src/pages/ShotToProfile/buildProfile.js`

- [ ] **Step 1: Create the file**

```javascript
// web/src/pages/ShotToProfile/buildProfile.js

/**
 * @typedef {Object} Segment
 * @property {string}  name           - Phase name (user-edited)
 * @property {number}  startIdx       - First sample index (inclusive)
 * @property {number}  endIdx         - Last sample index (exclusive)
 * @property {number}  durationSeconds
 * @property {'pressure'|'flow'} targetType
 * @property {number}  targetValue    - bar or ml/s
 * @property {number}  temperature    - °C
 */

/**
 * @param {string}    profileName
 * @param {Segment[]} segments
 * @returns {Object}  profile object ready to pass to ProfileEdit
 */
export function buildProfile(profileName, segments) {
  const firstTemp = segments[0]?.temperature ?? 93;

  return {
    id: crypto.randomUUID(),
    label: profileName,
    description: '',
    type: 'pro',
    temperature: Math.round(firstTemp),
    favorite: false,
    selected: false,
    utility: false,
    phases: segments.map(seg => ({
      name: seg.name,
      phase: 'brew',
      valve: 1,
      duration: seg.durationSeconds,
      temperature: Math.round(seg.temperature),
      pump: {
        target: seg.targetType,
        pressure: seg.targetType === 'pressure' ? seg.targetValue : -1,
        flow: seg.targetType === 'flow' ? seg.targetValue : -1,
      },
      transition: {
        type: 'linear',
        duration: 1.0,
        adaptive: false,
      },
      targets: [],
    })),
  };
}
```

- [ ] **Step 2: Verify the file parses correctly**

```bash
cd web && node --input-type=module <<'EOF'
import { buildProfile } from './src/pages/ShotToProfile/buildProfile.js';
const seg = { name: 'Brew', startIdx: 0, endIdx: 80, durationSeconds: 20, targetType: 'pressure', targetValue: 9, temperature: 93 };
const p = buildProfile('Test', [seg]);
console.log(JSON.stringify(p, null, 2));
EOF
```

Expected: valid JSON with `type: "pro"`, one phase with `pump.target === "pressure"` and `pump.pressure === 9`.

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/ShotToProfile/buildProfile.js
git commit -m "feat: add profile builder for shot-to-profile conversion"
```

---

## Task 3: Pending Profile Store

**Files:**
- Create: `web/src/state/pendingProfile.js`

This module bridges `ShotToProfile` (writer) and `ProfileEdit` (reader) without touching the router state.

- [ ] **Step 1: Create the file**

```javascript
// web/src/state/pendingProfile.js

let _profile = null;

/** Store a profile to be consumed once by ProfileEdit on next mount. */
export function setPendingProfile(profile) {
  _profile = profile;
}

/** Returns and clears the pending profile, or null if none. */
export function consumePendingProfile() {
  const p = _profile;
  _profile = null;
  return p;
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/state/pendingProfile.js
git commit -m "feat: add pending-profile store for shot-to-profile handoff"
```

---

## Task 4: Modify ProfileEdit to Accept Pending Profile

**Files:**
- Modify: `web/src/pages/ProfileEdit/index.jsx`

- [ ] **Step 1: Add the import at the top of the file (after the existing imports)**

In `web/src/pages/ProfileEdit/index.jsx`, add this import after line 11:

```javascript
import { consumePendingProfile } from '../../state/pendingProfile.js';
```

- [ ] **Step 2: Replace the `if (params.id === 'new')` branch inside `fetchData`**

Find this block (lines 24–76):
```javascript
      if (params.id === 'new') {
        setData({
          label: 'New Profile',
```

Replace the entire `if (params.id === 'new') { ... }` block with:

```javascript
      if (params.id === 'new') {
        const pending = consumePendingProfile();
        setData(
          pending ?? {
            label: 'New Profile',
            description: '',
            temperature: 93,
            phases: [
              {
                name: 'Pump',
                phase: 'preinfusion',
                valve: 1,
                pump: 100,
                duration: 3,
                transition: { type: 'instant', duration: 0, adaptive: true },
                targets: [],
              },
              {
                name: 'Bloom',
                phase: 'preinfusion',
                valve: 1,
                pump: 0,
                duration: 5,
                transition: { type: 'instant', duration: 0, adaptive: true },
                targets: [],
              },
              {
                name: 'Pump',
                phase: 'brew',
                valve: 1,
                pump: 100,
                duration: 20,
                targets: [{ type: 'volumetric', value: 36 }],
                transition: { type: 'instant', duration: 0, adaptive: true },
              },
            ],
          },
        );
        setLoading(false);
```

- [ ] **Step 3: Verify the file still renders at `/profiles/new` in the dev server**

```bash
cd web && npm run dev
```

Open `http://localhost:5173/profiles/new` — should show the normal "Create Profile" page with type selection. No errors in console.

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/ProfileEdit/index.jsx
git commit -m "feat: ProfileEdit reads pending profile when navigating to /profiles/new"
```

---

## Task 5: SegmentCard Component

**Files:**
- Create: `web/src/pages/ShotToProfile/SegmentCard.jsx`

- [ ] **Step 1: Create the file**

```jsx
// web/src/pages/ShotToProfile/SegmentCard.jsx
import { useCallback } from 'preact/hooks';

function avg(samples, field) {
  if (!samples.length) return 0;
  return samples.reduce((s, x) => s + (x[field] ?? 0), 0) / samples.length;
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * @param {{
 *   index: number,
 *   segment: import('./index.jsx').Segment,
 *   samples: object[],
 *   onChange: (patch: Partial<import('./index.jsx').Segment>) => void,
 * }} props
 */
export function SegmentCard({ index, segment, samples, onChange }) {
  const sliceSamples = samples.slice(segment.startIdx, segment.endIdx);
  const avgPressure = avg(sliceSamples, 'cp').toFixed(1);
  const avgFlow = avg(sliceSamples, 'fl').toFixed(2);
  const avgTemp = avg(sliceSamples, 'tt').toFixed(0);

  const handleTargetTypeChange = useCallback(
    e => {
      const t = e.target.value;
      const newVal =
        t === 'pressure'
          ? clamp(parseFloat(avgPressure) || 9, 0, 12)
          : clamp(parseFloat(avgFlow) || 2, 0, 6);
      onChange({ targetType: t, targetValue: newVal });
    },
    [avgPressure, avgFlow, onChange],
  );

  const handleTargetValueChange = useCallback(
    e => {
      const max = segment.targetType === 'pressure' ? 12 : 6;
      onChange({ targetValue: clamp(parseFloat(e.target.value) || 0, 0, max) });
    },
    [segment.targetType, onChange],
  );

  const handleTemperatureChange = useCallback(
    e => onChange({ temperature: clamp(parseInt(e.target.value) || 93, 80, 105) }),
    [onChange],
  );

  const handleNameChange = useCallback(e => onChange({ name: e.target.value }), [onChange]);

  return (
    <div className='flex flex-col gap-3 rounded border border-[var(--home-border,#222)] bg-[var(--dm-bg-1,#111)] p-4 min-w-[200px]'>
      <input
        type='text'
        value={segment.name}
        onInput={handleNameChange}
        className='font-nd-mono bg-transparent text-[13px] font-bold text-[var(--text-primary,#e8e8e8)] outline-none border-b border-[var(--home-border,#333)] pb-1'
      />

      <div className='font-nd-mono text-[11px] text-[var(--text-disabled,#666)] flex flex-col gap-1'>
        <span>{segment.durationSeconds.toFixed(1)}s</span>
        <span>~{avgPressure} bar avg</span>
        <span>~{avgFlow} ml/s avg</span>
        <span>~{avgTemp}°C avg</span>
      </div>

      <div className='flex flex-col gap-2'>
        <label className='font-nd-mono text-[11px] text-[var(--text-secondary,#999)] uppercase tracking-wider'>
          Target
        </label>
        <select
          value={segment.targetType}
          onChange={handleTargetTypeChange}
          className='font-nd-mono text-[12px] bg-[var(--dm-bg-0,#0a0a0a)] text-[var(--text-primary,#e8e8e8)] border border-[var(--home-border,#333)] rounded px-2 py-1'
        >
          <option value='pressure'>Pressure (bar)</option>
          <option value='flow'>Flow (ml/s)</option>
        </select>
        <input
          type='number'
          step={segment.targetType === 'pressure' ? 0.5 : 0.1}
          min={0}
          max={segment.targetType === 'pressure' ? 12 : 6}
          value={segment.targetValue}
          onInput={handleTargetValueChange}
          className='font-nd-mono text-[12px] bg-[var(--dm-bg-0,#0a0a0a)] text-[var(--text-primary,#e8e8e8)] border border-[var(--home-border,#333)] rounded px-2 py-1 w-full'
        />
      </div>

      <div className='flex flex-col gap-2'>
        <label className='font-nd-mono text-[11px] text-[var(--text-secondary,#999)] uppercase tracking-wider'>
          Temperature (°C)
        </label>
        <input
          type='number'
          step={1}
          min={80}
          max={105}
          value={segment.temperature}
          onInput={handleTemperatureChange}
          className='font-nd-mono text-[12px] bg-[var(--dm-bg-0,#0a0a0a)] text-[var(--text-primary,#e8e8e8)] border border-[var(--home-border,#333)] rounded px-2 py-1 w-full'
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/pages/ShotToProfile/SegmentCard.jsx
git commit -m "feat: add SegmentCard component for per-phase configuration"
```

---

## Task 6: BoundaryChart Component

**Files:**
- Create: `web/src/pages/ShotToProfile/BoundaryChart.jsx`

This component wraps `HistoryChart` in a `position: relative` container and overlays draggable vertical markers. Pixel positions are approximated from container width using Chart.js typical padding constants (left: 60px, right: 20px). Markers snap to the nearest sample on drag end.

- [ ] **Step 1: Create the file**

```jsx
// web/src/pages/ShotToProfile/BoundaryChart.jsx
import { useCallback, useRef, useState } from 'preact/hooks';
import { HistoryChart } from '../ShotHistory/HistoryChart.jsx';

const CHART_LEFT_PAD = 60;  // approximate Chart.js y-axis width
const CHART_RIGHT_PAD = 20; // approximate Chart.js right padding

function sampleToFraction(idx, total) {
  return idx / Math.max(1, total - 1);
}

function fractionToSample(frac, total) {
  return Math.round(Math.max(0, Math.min(1, frac)) * (total - 1));
}

/**
 * @param {{
 *   shot: object,
 *   boundaries: number[],
 *   onBoundariesChange: (boundaries: number[]) => void,
 * }} props
 */
export function BoundaryChart({ shot, boundaries, onBoundariesChange }) {
  const containerRef = useRef(null);
  const [dragging, setDragging] = useState(null); // { markerIdx, startX, origBoundary }

  const total = shot.samples?.length ?? 1;

  function getContentWidth() {
    const w = containerRef.current?.offsetWidth ?? 400;
    return Math.max(1, w - CHART_LEFT_PAD - CHART_RIGHT_PAD);
  }

  function pixelToSample(clientX) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const relX = clientX - rect.left - CHART_LEFT_PAD;
    const frac = relX / getContentWidth();
    return fractionToSample(frac, total);
  }

  const onOverlayMouseDown = useCallback(
    e => {
      // Clicking the overlay (not a marker) adds a new boundary
      if (e.target !== e.currentTarget) return;
      const newIdx = pixelToSample(e.clientX);
      if (boundaries.includes(newIdx)) return;
      const next = [...boundaries, newIdx].sort((a, b) => a - b);
      onBoundariesChange(next);
    },
    [boundaries, onBoundariesChange, total],
  );

  const onMarkerMouseDown = useCallback(
    (e, markerIdx) => {
      e.stopPropagation();
      e.preventDefault();
      setDragging({ markerIdx, origBoundary: boundaries[markerIdx] });

      function onMove(ev) {
        const newSample = pixelToSample(ev.clientX);
        const next = boundaries.map((b, i) => (i === markerIdx ? newSample : b));
        onBoundariesChange(next.sort((a, b) => a - b));
      }

      function onUp() {
        setDragging(null);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      }

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [boundaries, onBoundariesChange, total],
  );

  const onMarkerRemove = useCallback(
    (e, markerIdx) => {
      e.stopPropagation();
      e.preventDefault();
      onBoundariesChange(boundaries.filter((_, i) => i !== markerIdx));
    },
    [boundaries, onBoundariesChange],
  );

  const contentWidth = containerRef.current ? getContentWidth() : 0;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <HistoryChart shot={shot} />

      {/* Transparent overlay for clicks and markers */}
      <div
        onMouseDown={onOverlayMouseDown}
        style={{
          position: 'absolute',
          inset: 0,
          cursor: 'crosshair',
        }}
      >
        {containerRef.current &&
          boundaries.map((sampleIdx, i) => {
            const frac = sampleToFraction(sampleIdx, total);
            const left = CHART_LEFT_PAD + frac * contentWidth;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: `${left}px`,
                  width: '2px',
                  background: 'var(--color-primary, #d71921)',
                  cursor: 'ew-resize',
                  userSelect: 'none',
                }}
                onMouseDown={e => onMarkerMouseDown(e, i)}
              >
                {/* Remove button */}
                <button
                  onMouseDown={e => onMarkerRemove(e, i)}
                  style={{
                    position: 'absolute',
                    top: '4px',
                    left: '4px',
                    width: '16px',
                    height: '16px',
                    fontSize: '10px',
                    lineHeight: '16px',
                    textAlign: 'center',
                    background: 'var(--color-primary, #d71921)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                  aria-label={`Remove boundary ${i + 1}`}
                >
                  ×
                </button>
              </div>
            );
          })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/pages/ShotToProfile/BoundaryChart.jsx
git commit -m "feat: add BoundaryChart with draggable phase boundary markers"
```

---

## Task 7: ShotToProfile Page

**Files:**
- Create: `web/src/pages/ShotToProfile/index.jsx`

- [ ] **Step 1: Create the file**

```jsx
// web/src/pages/ShotToProfile/index.jsx
import { useCallback, useEffect, useState } from 'preact/hooks';
import { useLocation, useRoute } from 'preact-iso';
import { detectPhases } from './detectPhases.js';
import { buildProfile } from './buildProfile.js';
import { setPendingProfile } from '../../state/pendingProfile.js';
import { BoundaryChart } from './BoundaryChart.jsx';
import { SegmentCard } from './SegmentCard.jsx';
import { Spinner } from '../../components/Spinner.jsx';
import { parseBinaryShot } from '../ShotHistory/parseBinaryShot.js';

/** @typedef {{ name: string, startIdx: number, endIdx: number, durationSeconds: number, targetType: 'pressure'|'flow', targetValue: number, temperature: number }} Segment */

function avg(samples, field) {
  if (!samples.length) return 0;
  return samples.reduce((s, x) => s + (x[field] ?? 0), 0) / samples.length;
}

function boundariesToSegments(boundaries, samples) {
  const breakpoints = [0, ...boundaries, samples.length];
  return breakpoints.slice(0, -1).map((start, i) => {
    const end = breakpoints[i + 1];
    const slice = samples.slice(start, end);
    const durationSeconds = slice.length > 0
      ? (samples[end - 1].t - samples[start].t) / 1000
      : 0;
    const isFlow = avg(slice, 'tf') > 0 && avg(slice, 'tp') === 0;
    const targetType = isFlow ? 'flow' : 'pressure';
    const targetValue = parseFloat(
      (targetType === 'pressure' ? avg(slice, 'tp') : avg(slice, 'tf')).toFixed(
        targetType === 'pressure' ? 1 : 2,
      ),
    );
    return {
      name: `Phase ${i + 1}`,
      startIdx: start,
      endIdx: end,
      durationSeconds,
      targetType,
      targetValue: targetValue || (targetType === 'pressure' ? 9 : 2),
      temperature: Math.round(avg(slice, 'tt')) || 93,
    };
  });
}

export function ShotToProfile() {
  const { params } = useRoute();
  const location = useLocation();
  const shotId = parseInt(params.id, 10);

  const [shot, setShot] = useState(null);
  const [error, setError] = useState(null);
  const [boundaries, setBoundaries] = useState(null); // null = not yet computed
  const [segments, setSegments] = useState([]);
  const [profileName, setProfileName] = useState('');

  // Fetch and parse the shot binary
  useEffect(() => {
    async function load() {
      try {
        const paddedId = String(shotId).padStart(6, '0');
        const res = await fetch(`/api/history/${paddedId}.slog`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        const parsed = parseBinaryShot(buf, shotId);
        setShot(parsed);

        const date = new Date((parsed.timestamp ?? 0) * 1000);
        setProfileName(
          `Manual ${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        );

        // Run phase detection
        const isFlow =
          parsed.samples.length > 0 &&
          avg(parsed.samples, 'tf') > 0 &&
          avg(parsed.samples, 'tp') === 0;
        const detected = detectPhases(parsed.samples, isFlow);
        setBoundaries(detected);
        setSegments(boundariesToSegments(detected, parsed.samples));
      } catch (e) {
        setError(e.message);
      }
    }
    load();
  }, [shotId]);

  // Recompute segments whenever boundaries change
  const handleBoundariesChange = useCallback(
    next => {
      setBoundaries(next);
      if (shot) setSegments(boundariesToSegments(next, shot.samples));
    },
    [shot],
  );

  const handleSegmentChange = useCallback((idx, patch) => {
    setSegments(prev => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }, []);

  const handleGenerate = useCallback(() => {
    const profile = buildProfile(profileName, segments);
    setPendingProfile(profile);
    location.route('/profiles/new');
  }, [profileName, segments, location]);

  if (error) {
    return (
      <div className='flex flex-col items-center justify-center gap-4 py-16'>
        <p className='font-nd-mono text-[var(--color-error,#d71921)]'>Failed to load shot: {error}</p>
        <button className='nd-action-btn' onClick={() => location.route('/history')}>
          Back to History
        </button>
      </div>
    );
  }

  if (!shot || boundaries === null) {
    return (
      <div className='flex items-center justify-center py-16'>
        <Spinner size={8} />
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-6'>
      <div className='flex flex-row items-center gap-3'>
        <button
          className='nd-action-btn'
          onClick={() => location.route('/history')}
          aria-label='Back to history'
        >
          ←
        </button>
        <h2 className='flex-grow text-2xl font-bold'>Convert Shot to Profile</h2>
      </div>

      <p className='font-nd-mono text-[13px] text-[var(--text-secondary,#999)]'>
        Drag the red markers to adjust phase boundaries. Click on the chart to add a boundary. Click × on a marker to remove it.
      </p>

      <BoundaryChart shot={shot} boundaries={boundaries} onBoundariesChange={handleBoundariesChange} />

      <div className='flex flex-row gap-3 overflow-x-auto pb-2'>
        {segments.map((seg, i) => (
          <SegmentCard
            key={i}
            index={i}
            segment={seg}
            samples={shot.samples}
            onChange={patch => handleSegmentChange(i, patch)}
          />
        ))}
      </div>

      <div className='flex flex-row flex-wrap items-center gap-3 border-t border-[var(--home-border,#222)] pt-4'>
        <input
          type='text'
          value={profileName}
          onInput={e => setProfileName(e.target.value)}
          placeholder='Profile name'
          className='font-nd-mono flex-grow text-[13px] bg-[var(--dm-bg-0,#0a0a0a)] text-[var(--text-primary,#e8e8e8)] border border-[var(--home-border,#333)] rounded px-3 py-2 min-w-[200px]'
        />
        <button
          className='nd-action-btn'
          onClick={() => location.route('/history')}
        >
          Cancel
        </button>
        <button
          className='nd-action-btn nd-action-btn--primary'
          onClick={handleGenerate}
          disabled={!profileName.trim() || segments.length === 0}
        >
          Generate Profile →
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/pages/ShotToProfile/index.jsx
git commit -m "feat: add ShotToProfile page with phase segmentation UI"
```

---

## Task 8: Add "Save as Profile" Button to HistoryCard

**Files:**
- Modify: `web/src/pages/ShotHistory/HistoryCard.jsx`

- [ ] **Step 1: Add the icon import**

After line 10 (`import { faUpload ...`), add:

```javascript
import { faCodeBranch } from '@fortawesome/free-solid-svg-icons/faCodeBranch';
```

- [ ] **Step 2: Add the `useLocation` import**

At line 2, the file imports from `preact/hooks`. Add `useLocation` from preact-iso by inserting after line 16 (`import { useConfirmAction ...`):

```javascript
import { useLocation } from 'preact-iso';
```

- [ ] **Step 3: Add `isManualShot` detection and `useLocation` inside the component**

Inside `HistoryCard`, after line 33 (`const [isExporting, ...`), add:

```javascript
  const location = useLocation();
  const isManualShot = !shot.profileId || shot.profileId.trim() === '';
```

- [ ] **Step 4: Add the "Save as Profile" button**

In the button group (the `<div className='flex flex-wrap gap-1'>` around line 205), add this button before the delete button:

```jsx
                  {isManualShot && (
                    <button
                      onClick={() => location.route(`/shots/${shot.id}/to-profile`)}
                      className='nd-action-btn'
                      style={{ width: '32px', height: '32px' }}
                      aria-label='Save as profile'
                      title='Save as profile'
                    >
                      <FontAwesomeIcon icon={faCodeBranch} className='text-[12px]' />
                    </button>
                  )}
```

- [ ] **Step 5: Verify in dev server**

```bash
cd web && npm run dev
```

Open `/history`. Manual shots (no profile name) should show an extra branch icon button. Profile-based shots should not.

- [ ] **Step 6: Commit**

```bash
git add web/src/pages/ShotHistory/HistoryCard.jsx
git commit -m "feat: add Save as Profile button to manual shots in HistoryCard"
```

---

## Task 9: Register the New Route

**Files:**
- Modify: `web/src/index.jsx`

- [ ] **Step 1: Add the import**

After line 25 (`import { StatisticsPage } from './pages/Statistics/index.jsx';`), add:

```javascript
import { ShotToProfile } from './pages/ShotToProfile/index.jsx';
```

- [ ] **Step 2: Add the route**

Inside the `<Router>` block, before the `<Route default ...>` line (line 150), add:

```jsx
                  <Route
                    path='/shots/:id/to-profile'
                    component={props => (
                      <PageShell navOpen={navOpen} onNavToggle={onNavToggle}>
                        <ShotToProfile {...props} />
                      </PageShell>
                    )}
                  />
```

- [ ] **Step 3: Smoke test the full flow**

```bash
cd web && npm run dev
```

1. Open `/history`
2. Find a manual shot (no profile name) — click the branch icon button
3. Should navigate to `/shots/{id}/to-profile`
4. Chart should load with red boundary markers
5. Segment cards should appear below
6. Drag a marker — card durations should update
7. Click "Generate Profile →" — should navigate to `/profiles/new` pre-filled with phases
8. Profile editor should open in Pro mode with the generated phases

- [ ] **Step 4: Commit**

```bash
git add web/src/index.jsx
git commit -m "feat: register /shots/:id/to-profile route"
```

---

## Self-Review

**Spec coverage:**
- ✅ Entry point: "Save as Profile" button on manual shots only (Task 8)
- ✅ Route `/shots/:id/to-profile` (Task 9)
- ✅ Chart with draggable boundary markers (Task 6)
- ✅ Algorithm proposes splits, user adjusts (Tasks 1 + 6)
- ✅ Per-segment config: name, target type/value, temperature (Task 5)
- ✅ Profile generated and opened in Pro editor (Tasks 2 + 3 + 4 + 7)
- ✅ Cancel returns to history (Task 7)

**Placeholder scan:** None found. All steps contain actual code.

**Type consistency:**
- `Segment` typedef defined in `ShotToProfile/index.jsx`, used consistently in `SegmentCard` and `buildProfile`
- `boundaries` is always `number[]` (sample indices)
- `buildProfile(name, segments)` signature matches all call sites
- `consumePendingProfile()` / `setPendingProfile()` names match between Task 3 and all consumers
