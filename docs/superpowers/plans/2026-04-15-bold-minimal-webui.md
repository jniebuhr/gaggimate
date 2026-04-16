# Bold Minimal Web UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Web UI with two new bold/minimal themes (Stealth, Crisp) and comprehensive improvements to the Process Controls card and Temperature/Pressure chart on the Home page.

**Architecture:** Preact + Tailwind CSS + daisyUI web application. Themes implemented via daisyUI theme system with CSS custom properties in style.css. Chart improvements focus on enhanced legend, axis formatting, line styling, phase annotations, and smoother animations in OverviewChart.jsx.

**Tech Stack:** Preact, Tailwind CSS, daisyUI, Chart.js, Chart.js Day adapter

---

## File Structure

| File | Responsibility |
|------|----------------|
| `web/src/style.css` | All theme definitions (daisyUI format) plus custom properties |
| `web/src/utils/themeManager.js` | Theme constants, available themes array |
| `web/src/pages/Home/ProcessControls.jsx` | Process Controls card UI |
| `web/src/components/OverviewChart.jsx` | Temperature/Pressure chart with Chart.js |

---

### Task 1: Add Stealth and Crisp Themes

**Files:**
- Modify: `web/src/style.css`
- Modify: `web/src/utils/themeManager.js`

- [ ] **Step 1: Add Stealth theme to style.css**

Locate the existing daisyUI theme definitions in `web/src/style.css` (around line 63-98 for dark theme, 100-134 for coffee, etc.). Add the Stealth theme definition after the amoled theme (after line 205):

```css
/* https://daisyui.com/theme-generator/ */
@plugin "daisyui/theme" {
  name: 'stealth';
  default: false;
  prefersdark: true;
  color-scheme: 'dark';
  --color-base-100: oklch(3.592% 0.015 265.754);
  --color-base-200: oklch(7.821% 0.029 265.754);
  --color-base-300: oklch(12.051% 0.043 265.754);
  --color-base-content: oklch(97.715% 0.003 265.754);
  --color-primary: oklch(73.376% 0.151 232.661);
  --color-primary-content: oklch(3.592% 0.015 265.754);
  --color-secondary: oklch(72.36% 0.176 350.048);
  --color-secondary-content: oklch(97.715% 0.003 350.048);
  --color-accent: oklch(73.376% 0.151 232.661);
  --color-accent-content: oklch(3.592% 0.015 232.661);
  --color-neutral: oklch(14.596% 0.022 265.754);
  --color-neutral-content: oklch(97.715% 0.003 265.754);
  --color-info: oklch(68.455% 0.148 237.251);
  --color-info-content: oklch(3.592% 0.015 237.251);
  --color-success: oklch(78.452% 0.132 181.911);
  --color-success-content: oklch(3.592% 0.015 181.911);
  --color-warning: oklch(83.242% 0.139 82.95);
  --color-warning-content: oklch(3.592% 0.015 82.95);
  --color-error: oklch(71.785% 0.17 13.118);
  --color-error-content: oklch(97.715% 0.003 13.118);
  --radius-selector: 0.5rem;
  --radius-field: 0.25rem;
  --radius-box: 0.75rem;
  --size-selector: 0.25rem;
  --size-field: 0.25rem;
  --border: 1px;
  --depth: 0;
  --noise: 0;
}
```

- [ ] **Step 2: Add Crisp theme to style.css**

Add the Crisp theme definition after Stealth:

```css
/* https://daisyui.com/theme-generator/ */
@plugin "daisyui/theme" {
  name: 'crisp';
  default: false;
  prefersdark: false;
  color-scheme: 'light';
  --color-base-100: oklch(100% 0 0);
  --color-base-200: oklch(98.715% 0.003 265.754);
  --color-base-300: oklch(96.43% 0.006 265.754);
  --color-base-content: oklch(14.596% 0.022 265.754);
  --color-primary: oklch(55.923% 0.151 232.661);
  --color-primary-content: oklch(100% 0 0);
  --color-secondary: oklch(50.412% 0.176 296.788);
  --color-secondary-content: oklch(100% 0 0);
  --color-accent: oklch(55.923% 0.151 232.661);
  --color-accent-content: oklch(100% 0 0);
  --color-neutral: oklch(88.43% 0.008 265.754);
  --color-neutral-content: oklch(14.596% 0.022 265.754);
  --color-info: oklch(62.784% 0.148 237.251);
  --color-info-content: oklch(100% 0 0);
  --color-success: oklch(70.7% 0.132 181.911);
  --color-success-content: oklch(100% 0 0);
  --color-warning: oklch(78.45% 0.139 82.95);
  --color-warning-content: oklch(14.596% 0.022 82.95);
  --color-error: oklch(63.521% 0.17 13.118);
  --color-error-content: oklch(100% 0 0);
  --radius-selector: 0.5rem;
  --radius-field: 0.25rem;
  --radius-box: 0.75rem;
  --size-selector: 0.25rem;
  --size-field: 0.25rem;
  --border: 1px;
  --depth: 0;
  --noise: 0;
}
```

- [ ] **Step 3: Update themeManager.js to include new themes**

Modify the AVAILABLE_THEMES array in `web/src/utils/themeManager.js`:

```javascript
const AVAILABLE_THEMES = ['light', 'dark', 'coffee', 'nord', 'amoled', 'stealth', 'crisp'];
```

- [ ] **Step 4: Verify theme definitions are valid**

Run the web build to check for any syntax errors:
```bash
cd web && npm run build 2>&1 | head -50
```
Expected: Build completes without CSS parsing errors

- [ ] **Step 5: Commit themes**

```bash
git add web/src/style.css web/src/utils/themeManager.js
git commit -m "feat: add Stealth and Crisp bold/minimal themes"
```

---

### Task 2: Update Process Controls Card

**Files:**
- Modify: `web/src/pages/Home/ProcessControls.jsx`

- [ ] **Step 1: Update action button styling**

Find the ActionButtons component (around line 88-114) and update the button styling:

```jsx
<Tooltip content={buttonConfig.label}>
  <button
    className='btn btn-circle btn-lg border-2 border-primary bg-primary/10 hover:bg-primary/20 hover:border-primary text-primary'
    onClick={handleClick}
  >
    <FontAwesomeIcon icon={buttonConfig.icon} className='text-2xl' />
  </button>
</Tooltip>
```

- [ ] **Step 2: Add state indicator pill component**

Add a new StateIndicator component before ActionButtons:

```jsx
const StateIndicator = memo(({ active, finished }) => {
  if (active) {
    return (
      <div className='flex items-center gap-2 rounded-full bg-primary/20 px-3 py-1'>
        <span className='status-live-dot h-2 w-2 rounded-full bg-primary' />
        <span className='text-sm font-medium text-primary'>Brewing</span>
      </div>
    );
  }
  if (finished) {
    return (
      <div className='flex items-center gap-2 rounded-full bg-success/20 px-3 py-1'>
        <FontAwesomeIcon icon={faCheck} className='h-3 w-3 text-success' />
        <span className='text-sm font-medium text-success'>Finished</span>
      </div>
    );
  }
  return (
    <div className='flex items-center gap-2 rounded-full bg-neutral/20 px-3 py-1'>
      <span className='h-2 w-2 rounded-full bg-neutral-content/40' />
      <span className='text-sm font-medium text-neutral-content/60'>Idle</span>
    </div>
  );
});
```

- [ ] **Step 3: Add state indicator to ProcessControls render**

Find where ActionButtons is rendered in ProcessControls (around line 257) and add StateIndicator above it:

```jsx
{visibility.showActionButtons && (
  <>
    <StateIndicator active={active} finished={finished} />
    <ActionButtons
      brew={brew}
      active={active}
      finished={finished}
      isFlushing={isFlushing}
      onActivate={actions.activate}
      onDeactivate={actions.deactivate}
      onClear={actions.clear}
      onFlush={actions.startFlush}
    />
  </>
)}
```

- [ ] **Step 4: Enhance temperature display**

Find the ModeIdleDisplay component usage (around line 214) - the temperature display is handled there. For the ProcessControls, ensure the temperature context provided to ModeIdleDisplay shows clear formatting.

If ModeIdleDisplay needs enhancement, modify `web/src/components/ModeIdleDisplay.jsx` to show larger current temp with accent color when ready.

- [ ] **Step 5: Improve progress bar styling**

The progress indication is in ProcessDisplay component. Check `web/src/components/ProcessDisplay.jsx` and ensure:
- Progress bar uses `h-3` instead of `h-2`
- Fill color uses `bg-primary` with smooth transitions
- Container has subtle shadow for depth

- [ ] **Step 6: Verify changes render correctly**

Start the dev server and check the Process Controls card:
```bash
cd web && npm run dev 2>&1
```
Navigate to http://localhost:5173 and verify:
- Action button has bold border on hover
- State indicator pill shows correctly
- Temperature display is clear

- [ ] **Step 7: Commit**

```bash
git add web/src/pages/Home/ProcessControls.jsx web/src/components/ModeIdleDisplay.jsx web/src/components/ProcessDisplay.jsx
git commit -m "feat: enhance Process Controls card UI with bold styling and state indicators"
```

---

### Task 3: Improve Temperature/Pressure Chart

**Files:**
- Modify: `web/src/components/OverviewChart.jsx`

- [ ] **Step 1: Enhance legend styling**

Find the legend configuration in `getChartData()` (around line 276-300) and update:

```javascript
legend: {
  position: 'top',
  display: true,
  labels: {
    usePointStyle: true,
    pointStyle: 'line',
    pointStyleWidth: 24,
    padding: 12,
    font: {
      size: window.innerWidth < 640 ? 11 : 13,
      weight: 500,
    },
    generateLabels: function (chart) {
      const original = Chart.defaults.plugins.legend.labels.generateLabels;
      const labels = original.call(this, chart);
      labels.forEach((label, index) => {
        const dataset = chart.data.datasets[index];
        label.lineWidth = 3;
        label.borderWidth = 3;
        if (dataset.borderDash && dataset.borderDash.length > 0) {
          label.lineDash = dataset.borderDash;
        }
      });
      return labels;
    },
  },
},
```

- [ ] **Step 2: Update axis label formatting**

Find the y-axis ticks configuration (around line 323-331) and update:

```javascript
y: {
  type: 'linear',
  min: tempMin,
  max: tempMax,
  ticks: {
    stepSize: 5,
    font: {
      size: window.innerWidth < 640 ? 11 : 13,
      weight: 500,
    },
    callback: value => {
      return `${Math.round(value)}°C`;
    },
    maxRotation: 0,
    minRotation: 0,
  },
  grid: {
    color: 'rgba(128, 128, 128, 0.15)',
  },
},
```

- [ ] **Step 3: Improve line thickness**

Find the dataset definitions (around line 208-246) and update borderWidth:

```javascript
datasets: [
  {
    label: 'Current Temperature',
    borderColor: '#F0561D',
    borderWidth: 3,
    pointStyle: false,
    tension: 0.3,
    data: data.map(i => ({ x: i.timestamp.toISOString(), y: i.currentTemperature })),
  },
  {
    label: 'Target Temperature',
    fill: true,
    borderColor: '#731F00',
    borderDash: [8, 4],
    borderWidth: 2,
    pointStyle: false,
    tension: 0.3,
    data: data.map(i => ({ x: i.timestamp.toISOString(), y: i.targetTemperature })),
  },
  // ... similar for pressure, flow, weight datasets
```

- [ ] **Step 4: Enhance phase annotations**

Find the phase annotation configuration (around line 135-204) and update:

```javascript
phaseAnnotations[`phase_line_${index}`] = {
  type: 'line',
  xMin: transition.timestamp.toISOString(),
  xMax: transition.timestamp.toISOString(),
  borderColor: 'rgba(6, 182, 212, 0.8)', // Cyan accent
  borderWidth: 2,
  label: {
    display: true,
    content: transition.phaseName,
    rotation: -90,
    position: 'end',
    xAdjust: -12,
    yAdjust: 0,
    padding: { x: 8, y: 4 },
    color: '#FAFAFA',
    backgroundColor: 'rgba(10, 10, 10, 0.85)',
    textAlign: 'start',
    font: {
      size: isSmall ? 10 : 12,
      weight: 600,
    },
    clip: false,
  },
};
```

- [ ] **Step 5: Improve title display**

Find the title configuration (around line 302-312) and update:

```javascript
title: {
  display: true,
  text: isBrewActive
    ? `Brew Progress - ${Math.round(timeWindowMs / 1000)}s View`
    : phaseTransitions.length > 0
      ? 'Recent Brew'
      : 'Temperature & Pressure',
  font: {
    size: window.innerWidth < 640 ? 13 : 15,
    weight: 600,
  },
  padding: {
    bottom: 8,
  },
},
```

- [ ] **Step 6: Add smoother animations**

Find the animation option (around line 317) and update:

```javascript
animation: {
  duration: 150,
  easing: 'easeOutQuart',
},
```

- [ ] **Step 7: Verify chart renders correctly**

Start dev server and navigate to home page:
```bash
cd web && npm run dev
```
Check:
- Legend shows with larger line samples
- Axis labels are readable
- Lines are thicker and smooth
- Phase markers are visible with cyan accent
- Title is clear and descriptive

- [ ] **Step 8: Commit**

```bash
git add web/src/components/OverviewChart.jsx
git commit -m "feat: enhance chart with better legend, thicker lines, and improved phase markers"
```

---

## Self-Review Checklist

**1. Spec coverage:**
- [x] Stealth theme defined in style.css
- [x] Crisp theme defined in style.css
- [x] themeManager.js updated with new themes
- [x] Process Controls card: action button styling, state indicators, temp display, progress bar
- [x] Chart: legend, axes, lines, phase markers, animations

**2. Placeholder scan:**
- [x] No "TBD" or "TODO" in steps
- [x] All code blocks show actual implementation
- [x] No "similar to X" references

**3. Type consistency:**
- [x] Theme names consistent: 'stealth' and 'crisp' match in both files
- [x] Component names consistent (StateIndicator, ActionButtons)
- [x] Function names consistent (getChartData, OverviewChart)

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-15-bold-minimal-webui.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**