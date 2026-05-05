# UI Text Color & Steam Ring Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the Web UI heating status labels and ring colors for Brew, Steam, and Water modes when temperature is reached.

**Architecture:** Modify `ProcessControls.jsx` to handle the "ready" state for each mode with white text labels and correct ring fill colors. Add CSS variable for the green steam ring.

**Tech Stack:** Preact, React-compatible JSX, CSS custom properties

---

## File Structure

| Purpose | File Path | Changes |
|---------|-----------|---------|
| Main ring display | `web/src/pages/Home/ProcessControls.jsx` | Modify `getDisplayState` and `getRingVisual` for ready states |
| Global CSS | `web/src/style.css` | Add `--home-ring-steam-ready` green color variable |

---

## Change Summary

1. **Brew mode ready** (`mode === 1`, `isTemperatureStable === true`): Title text `'BREW'` stays but should display in **white** (not red ring text). The ring already uses `--home-ring-brew` red fill — keep it.
2. **Steam mode ready** (`mode === 2`, `isTemperatureStable === true`): Title should be `'READY TO STEAM'` in **white**, ring filled with **green** (`var(--home-ring-steam-ready, #7cb876)`).
3. **Water mode ready** (`mode === 3`, `isTemperatureStable === true`): Title should be `'WATER READY'` in **white**, ring filled with **green** (`var(--home-ring-water-ready, #7cb876)`).

---

### Task 1: Add green color variable for steam/water ready state

**Files:**
- Modify: `web/src/style.css:761`

- [ ] **Step 1: Add green ready ring color variable**

Find line 761 in `web/src/style.css`:
```css
  --home-ring-water: #6699cc;
```

Add after line 761:
```css
  --home-ring-steam-ready: #7cb876;
  --home-ring-water-ready: #7cb876;
```

- [ ] **Step 2: Commit**

```bash
git add web/src/style.css
git commit -m "feat: add green ready ring color variables for steam and water"
```

---

### Task 2: Update getDisplayState for ready state labels

**Files:**
- Modify: `web/src/pages/Home/ProcessControls.jsx:216-247`

- [ ] **Step 1: Update getDisplayState function**

In `ProcessControls.jsx`, find the `getDisplayState` function (lines 216-247). Currently the function returns `MODE_LABELS[mode]` when no heating label is present. Add a condition for steam and water when temperature is stable but mode is not active/finished.

Replace the `return { title: MODE_LABELS[mode]` block (lines 243-246):
```javascript
  // Steam ready state
  if (mode === 2 && isTemperatureStable) {
    return { title: 'READY TO STEAM', subtitle: MODE_SUBTITLES[mode] };
  }

  // Water ready state
  if (mode === 3 && isTemperatureStable) {
    return { title: 'WATER READY', subtitle: MODE_SUBTITLES[mode] };
  }

  return {
    title: MODE_LABELS[mode] || 'STANDBY',
    subtitle: MODE_SUBTITLES[mode] || 'Ready',
  };
```

- [ ] **Step 2: Run to verify no syntax errors**

No test file exists for this component. Verify by checking if the app builds/renders without console errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/Home/ProcessControls.jsx
git commit -m "feat: show 'Ready to Steam' and 'Water Ready' labels when temp is reached"
```

---

### Task 3: Update getRingVisual for green steam ring

**Files:**
- Modify: `web/src/pages/Home/ProcessControls.jsx:189-196`

- [ ] **Step 1: Update steam ring fill color when temperature is stable**

In `getRingVisual`, the steam idle ring section is at lines 189-196:

```javascript
  // STEAM mode — show preheat progress toward steam target (~150°C)
  if (!active && mode === 2) {
    const steamTarget = targetTemperature > 120 ? targetTemperature : 150;
    const progress = getTemperatureProgress(currentTemperature, steamTarget);
    return {
      background: buildSolidRingBackground(progress, 'var(--home-ring-steam, #d4a843)'),
      progress,
    };
  }
```

Change it to check `isTemperatureStable` and use green when ready:

```javascript
  // STEAM mode — show preheat progress toward steam target (~150°C)
  if (!active && mode === 2) {
    const steamTarget = targetTemperature > 120 ? targetTemperature : 150;
    const progress = getTemperatureProgress(currentTemperature, steamTarget);
    const fillColor = isTemperatureStable
      ? 'var(--home-ring-steam-ready, #7cb876)'
      : 'var(--home-ring-steam, #d4a843)';
    return {
      background: buildSolidRingBackground(progress, fillColor),
      progress,
    };
  }
```

- [ ] **Step 2: Verify render**

Check visually in browser that steam ring turns green when temperature reaches target.

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/Home/ProcessControls.jsx
git commit -m "feat: fill steam ring in green when temperature is reached"
```

---

### Task 4: Update getRingVisual for green water ring

**Files:**
- Modify: `web/src/pages/Home/ProcessControls.jsx:199-207`

- [ ] **Step 1: Update water ring fill color when temperature is stable**

```javascript
  // WATER mode — show progress toward water target (~80°C)
  if (!active && mode === 3) {
    const waterTarget = targetTemperature > 0 ? targetTemperature : 80;
    const progress = getTemperatureProgress(currentTemperature, waterTarget);
    const fillColor = isTemperatureStable
      ? 'var(--home-ring-water-ready, #7cb876)'
      : 'var(--home-ring-water, #6699cc)';
    return {
      background: buildSolidRingBackground(progress, fillColor),
      progress,
    };
  }
```

- [ ] **Step 2: Verify render**

Check visually in browser that water ring turns green when temperature reaches target.

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/Home/ProcessControls.jsx
git commit -m "feat: fill water ring in green when temperature is reached"
```

---

### Task 5: Ensure brew text is white (not red)

**Files:**
- Modify: `web/src/pages/Home/ProcessControls.jsx:456`

- [ ] **Step 1: Check the brew ready state text color**

Look at line 456 in `ProcessControls.jsx`:
```jsx
<div className={`mt-2 font-nd-mono text-[10px] uppercase tracking-[0.1em]${heatingLabel ? ' text-white nd-ring-title--flashing' : ' text-[var(--text-disabled,#666)]'}`}>
  {displayState.title}
</div>
```

When heating label is null (brew at target temp), the title uses `text-[var(--text-disabled,#666)]` which is gray. The flashing class and white text only apply during heating. For brew at temp, the title `BREW` will show in disabled gray. The user wants it in white.

**Change to:**
```jsx
<div className={`mt-2 font-nd-mono text-[10px] uppercase tracking-[0.1em]${heatingLabel ? ' text-white nd-ring-title--flashing' : ' text-white'}`}>
  {displayState.title}
</div>
```

This makes the title always white when not flashing (during heating). The flashing animation gives the heating state visual interest while the ready state shows solid white.

- [ ] **Step 2: Verify render**

Check in browser that brew title shows in white text when at target temperature.

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/Home/ProcessControls.jsx
git commit -m "feat: show brew title in white when temperature is reached"
```

---

## Self-Review

1. **Spec coverage:** All three requirements addressed:
   - Brew: Task 5 — title in white
   - Steam: Tasks 2, 3 — 'Ready to Steam' label + green ring
   - Water: Tasks 2, 4 — 'Water Ready' label + green ring

2. **Placeholder scan:** No placeholders found — all steps contain actual code.

3. **Type consistency:** All changes use `isTemperatureStable` which is already passed to `getDisplayState`. The `fillColor` variable is consistently used in both `getRingVisual` steam and water sections.
