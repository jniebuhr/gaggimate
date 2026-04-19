# Process Controls Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove redundant ModeTabBar from ProcessControls card and replace with a Quick-Status strip showing mode dot, state, and contextual targets.

**Architecture:** Single-file change in `web/src/pages/Home/ProcessControls.jsx`. New `QuickStatusStrip` component added inline. ModeTabBar removed. No changes to other components or files.

**Tech Stack:** Preact, Tailwind CSS, FontAwesome icons

---

## File Map

- **Modify:** `web/src/pages/Home/ProcessControls.jsx`
  - Remove `ModeTabBar` import and usage
  - Add new `QuickStatusStrip` component (inline, before `ProcessControls` component)
  - Insert `QuickStatusStrip` JSX where `ModeTabBar` was

---

## Constants

Add these constants at the top of the file (after imports, before existing components):

```js
const MODE_DOT_COLORS = ['bg-base-content/30', 'bg-primary', 'bg-warning', 'bg-error', 'bg-secondary'];
const MODE_LABELS = ['Standby', 'Brew', 'Steam', 'Water', 'Grind'];
```

---

## Task 1: Add QuickStatusStrip Component

**Files:**
- Modify: `web/src/pages/Home/ProcessControls.jsx` — add component before `ProcessControls`

- [ ] **Step 1: Add MODE_DOT_COLORS and MODE_LABELS constants**

After line 22 (`useProcessActions`), add:

```js
const MODE_DOT_COLORS = ['bg-base-content/30', 'bg-primary', 'bg-warning', 'bg-error', 'bg-secondary'];
const MODE_LABELS = ['Standby', 'Brew', 'Steam', 'Water', 'Grind'];
```

- [ ] **Step 2: Add QuickStatusStrip component**

After the `StateIndicator` component (after line 106), add:

```js
const QuickStatusStrip = memo(({ mode, active, finished, targetTemperature, grindTarget, grindTargetVolume, grindTargetDuration }) => {
  const state = active ? 'Brewing' : finished ? 'Finished' : 'Idle';
  const stateClass = active
    ? 'bg-warning/20 text-warning border-warning'
    : finished
    ? 'bg-success/20 text-success border-success'
    : 'bg-base-300/50 text-base-content/60 border-base-300';

  const showTemp = mode === 2 || mode === 3;
  const showGrind = mode === 4;

  return (
    <div className='flex items-center justify-center gap-3 py-2 px-3 rounded-xl border border-base-300/40 bg-base-100/50'>
      {/* Mode dot */}
      <span className={`size-2.5 rounded-full ${MODE_DOT_COLORS[mode]}`} />

      {/* State badge */}
      <span className={`badge badge-sm badge-outline font-semibold ${stateClass}`}>
        {state}
      </span>

      {/* Contextual target */}
      {showTemp && (
        <span className='text-sm text-base-content/60'>
          · {targetTemperature}°C
        </span>
      )}
      {showGrind && (
        <span className='text-sm text-base-content/60'>
          · {grindTarget === 1 ? `${grindTargetVolume}g` : `${Math.round(grindTargetDuration / 1000)}s`}
        </span>
      )}
    </div>
  );
});

QuickStatusStrip.displayName = 'QuickStatusStrip';

QuickStatusStrip.propTypes = {
  mode: PropTypes.number.isRequired,
  active: PropTypes.bool.isRequired,
  finished: PropTypes.bool.isRequired,
  targetTemperature: PropTypes.number.isRequired,
  grindTarget: PropTypes.number.isRequired,
  grindTargetVolume: PropTypes.number.isRequired,
  grindTargetDuration: PropTypes.number.isRequired,
};
```

- [ ] **Step 3: Verify component is valid**

Open the file in editor and confirm no syntax errors. No test needed for UI component.

---

## Task 2: Remove ModeTabBar

**Files:**
- Modify: `web/src/pages/Home/ProcessControls.jsx`

- [ ] **Step 1: Remove ModeTabBar import**

Remove line 14:
```js
import { ModeTabBar } from '../../components/ModeTabBar.jsx';
```

- [ ] **Step 2: Remove ModeTabBar JSX**

In the `ProcessControls` component (around line 206-208), remove:
```jsx
<div className='mb-3'>
  <ModeTabBar mode={mode} changeMode={changeMode} showGrindTab={showGrindTab} />
</div>
```

- [ ] **Step 3: Remove changeMode prop from ProcessControls**

Remove `changeMode` from propTypes (around line 298):
```js
  changeMode: PropTypes.func.isRequired,
```

And from the function signature (line 148):
```js
const ProcessControls = ({ brew, mode, changeMode }) => {
```

Change to:
```js
const ProcessControls = ({ brew, mode }) => {
```

- [ ] **Step 4: Remove showGrindTab usage (no longer needed)**

Remove `showGrindTab` from the visibility call (around line 192-199):
```js
  const visibility = useControlsVisibility(
    mode,
    active,
    finished,
    isGrindAvailable,
    showGrindTab,
    statusValues.volumetricAvailable
  );
```

Change to:
```js
  const visibility = useControlsVisibility(
    mode,
    active,
    finished,
    isGrindAvailable,
    false, // showGrindTab - no longer needed since ModeTabBar removed
    statusValues.volumetricAvailable
  );
```

---

## Task 3: Add QuickStatusStrip to Render

**Files:**
- Modify: `web/src/pages/Home/ProcessControls.jsx`

- [ ] **Step 1: Add QuickStatusStrip where ModeTabBar was**

Replace the removed ModeTabBar div with QuickStatusStrip. In the return statement (around line 204-209), change:

```jsx
<div className='mb-3'>
  {/* ModeTabBar removed - now using QuickStatusStrip */}
</div>
```

To:

```jsx
<div className='mb-3'>
  <QuickStatusStrip
    mode={mode}
    active={active}
    finished={finished}
    targetTemperature={statusValues.targetTemperature}
    grindTarget={statusValues.grindTarget}
    grindTargetVolume={statusValues.grindTargetVolume}
    grindTargetDuration={statusValues.grindTargetDuration}
  />
</div>
```

- [ ] **Step 2: Update Home/index.jsx to remove changeMode prop**

Modify `web/src/pages/Home/index.jsx` line 61:

Change:
```jsx
<ProcessControls brew={mode === 1} mode={mode} changeMode={changeMode} />
```

To:
```jsx
<ProcessControls brew={mode === 1} mode={mode} />
```

Also remove the `changeMode` callback (lines 41-49) since it's no longer used, or verify it's not used elsewhere in the file before removing.

- [ ] **Step 3: Remove unused changeMode callback**

Check if `changeMode` is used elsewhere in `Home/index.jsx`. If not, remove it:

```js
const changeMode = useCallback(
  mode => {
    apiService.send({
      tp: 'req:change-mode',
      mode,
    });
  },
  [apiService],
);
```

can be removed.

- [ ] **Step 4: Verify all changes compile**

Run: `cd web && npm run build` (or dev server check)
Expected: No errors related to ProcessControls

---

## Task 4: Verify and Commit

- [ ] **Step 1: Run dev server and visually verify**

Run: `cd web && npm run dev`
Expected: Dashboard shows QuickStatusStrip (mode dot + state badge + target) instead of ModeTabBar

- [ ] **Step 2: Test mode change via Header**

Click mode selector in Header stat pill. Verify:
- Mode dot color changes appropriately
- QuickStatusStrip updates target display (temp for Steam/Water, grind for Grind)

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: replace ModeTabBar with QuickStatusStrip in ProcessControls

- Remove redundant ModeTabBar (mode now controlled via Header stat pills)
- Add QuickStatusStrip showing mode dot, state badge, contextual target
- No changes to control visibility logic or other components
- Clean up unused changeMode callback from Home page
"
```

---

## Spec Coverage Check

| Spec Requirement | Task |
|------------------|------|
| Remove ModeTabBar | Task 2 |
| QuickStatusStrip with mode dot | Task 1 |
| State: Idle/Brewing/Finished | Task 1 |
| Contextual target (temp/grind) | Task 1 |
| Visibility rules preserved | Task 2 (useControlsVisibility unchanged) |
| Mode indicator dot color | Task 1 (using MODE_DOT_COLORS) |
