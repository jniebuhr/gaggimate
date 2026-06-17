# Dashboard Settings Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all dashboard-related settings out of the main Settings page into a dedicated `/dashboard-settings` page, accessible via a pen icon next to the Dashboard nav item.

**Architecture:** New `DashboardSettings` page component (Preact) reads/writes directly to `localStorage` via `dashboardManager` signals — no server form needed. Navigation is updated with a special-cased dashboard row that renders the existing `MenuItem` plus a pen `<a>` button. The Settings page has its dashboard card and all related state removed.

**Tech Stack:** Preact, `@preact/signals`, DaisyUI + Tailwind CSS, FontAwesome, Vite (`cd web && npm run dev` to develop)

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| **Create** | `web/src/pages/DashboardSettings/index.jsx` | New Dashboard Settings page (three cards) |
| **Modify** | `web/src/index.jsx` | Add lazy import + Route for `/dashboard-settings` |
| **Modify** | `web/src/components/Navigation.jsx` | Add pen icon button next to Dashboard nav item |
| **Modify** | `web/src/pages/Settings/index.jsx` | Remove Dashboard Settings card + related state/imports |

---

## Task 1: Create the DashboardSettings page

**Files:**
- Create: `web/src/pages/DashboardSettings/index.jsx`

- [ ] **Step 1: Create the file**

```jsx
import { useState } from 'preact/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCompress } from '@fortawesome/free-solid-svg-icons/faCompress';
import Card from '../../components/Card.jsx';
import {
  SettingsFormField,
  SortableConfigurator,
  ToggleField,
} from '../../components/SettingsFormField.jsx';
import { machine } from '../../services/ApiService.js';
import {
  DASHBOARD_LAYOUTS, getDashboardLayout, setDashboardLayout,
  DASHBOARD_CARD_MODES, getDashboardCardMode, setDashboardCardMode,
  getMetricOrder, setMetricOrder as persistMetricOrder,
  getPanelOrder, setPanelOrder as persistPanelOrder,
  getStickyBottom, setStickyBottom,
  getStickyTop, setStickyTop,
  getShowRecentShots, setShowRecentShots,
  getMetricsColumns, setMetricsColumns,
  METRICS_LAST_ROW_FILLS, getMetricsLastRowFill, setMetricsLastRowFill,
  getCompactPanels, toggleCompactPanel,
  getProfileChartHeight, setProfileChartHeight,
  COLUMN_SPACINGS, getColumnSpacing, setColumnSpacing,
  getShotMetricSlots, setShotMetricSlots,
} from '../../utils/dashboardManager.js';
import { METRIC_DEFINITIONS } from '../../utils/metricDefinitions.js';
import { PANEL_DEFINITIONS } from '../../utils/panelDefinitions.js';

export function DashboardSettings() {
  const [dashboardLayout,    setDashboardLayoutState]    = useState(() => getDashboardLayout());
  const [dashboardCardMode,  setDashboardCardModeState]  = useState(() => getDashboardCardMode());
  const [showRecentShots,    setShowRecentShotsState]    = useState(() => getShowRecentShots());
  const [shotMetricSlots,    setShotMetricSlotsState]    = useState(() => getShotMetricSlots());

  const [panelOrder,         setPanelOrderState]         = useState(() => getPanelOrder());
  const [stickyBottom,       setStickyBottomState]       = useState(() => getStickyBottom());
  const [stickyTop,          setStickyTopState]          = useState(() => getStickyTop());
  const [compactPanels,      setCompactPanelsState]      = useState(() => getCompactPanels());
  const [profileChartHeight, setProfileChartHeightState] = useState(() => getProfileChartHeight());
  const [columnSpacing,      setColumnSpacingState]      = useState(() => getColumnSpacing());

  const [metricOrder,        setMetricOrderState]        = useState(() => getMetricOrder());
  const [metricsColumns,     setMetricsColumnsState]     = useState(() => getMetricsColumns());
  const [metricsLastRowFill, setMetricsLastRowFillState] = useState(() => getMetricsLastRowFill());

  const hiddenMetrics = METRIC_DEFINITIONS.filter(
    m => !m.required && !metricOrder.includes(m.id) && m.available(machine.value.status)
  );

  const hiddenPanels = PANEL_DEFINITIONS.filter(def => {
    if (def.required) return false;
    if (panelOrder.includes(def.id)) return false;
    const availFn = def.availableInSettings ?? def.available;
    return availFn(machine.value.status);
  });

  const handleToggleCompact = (id) => {
    toggleCompactPanel(id);
    setCompactPanelsState(getCompactPanels());
  };

  return (
    <>
      <div className='mb-4 flex flex-row items-center gap-2'>
        <h2 className='flex-grow text-2xl font-bold sm:text-3xl'>Dashboard Settings</h2>
      </div>

      <div className='grid grid-cols-1 gap-4 lg:grid-cols-10'>

        {/* ── Card 1: General Settings ─────────────────────────────────── */}
        <Card sm={10} lg={5} title='General Settings'>
          <SettingsFormField label='Dashboard Layout' htmlFor='dashboardLayout'>
            <select
              id='dashboardLayout'
              className='select select-bordered w-full'
              value={dashboardLayout}
              onChange={e => {
                setDashboardLayoutState(e.target.value);
                setDashboardLayout(e.target.value);
              }}
            >
              <option value={DASHBOARD_LAYOUTS.ORDER_FIRST}>Process Controls First</option>
              <option value={DASHBOARD_LAYOUTS.ORDER_LAST}>Chart First</option>
            </select>
          </SettingsFormField>
          <SettingsFormField label='Control Column Style' htmlFor='dashboardCardMode'>
            <select
              id='dashboardCardMode'
              className='select select-bordered w-full'
              value={dashboardCardMode}
              onChange={e => {
                setDashboardCardModeState(e.target.value);
                setDashboardCardMode(e.target.value);
              }}
            >
              <option value={DASHBOARD_CARD_MODES.MULTI}>Multiple Cards</option>
              <option value={DASHBOARD_CARD_MODES.SINGLE}>Single Card</option>
            </select>
          </SettingsFormField>
          <ToggleField
            label='Show Recent Shots'
            htmlFor='showRecentShots'
            checked={showRecentShots}
            onChange={e => {
              setShowRecentShotsState(e.target.checked);
              setShowRecentShots(e.target.checked);
            }}
          />
          {showRecentShots && (
            <SettingsFormField label='Shot Card Metrics' htmlFor='shotMetricSlot0' noMargin>
              <div className='flex gap-2'>
                {[0, 1, 2].map(i => (
                  <div key={i} className='flex flex-1 flex-col gap-1'>
                    <span className='text-base-content/60 text-xs'>Slot {i + 1}</span>
                    <select
                      className='select select-bordered select-sm w-full'
                      value={shotMetricSlots[i]}
                      onChange={e => {
                        const next = [...shotMetricSlots];
                        next[i] = e.target.value;
                        setShotMetricSlotsState(next);
                        setShotMetricSlots(next);
                      }}
                    >
                      <option value='duration'>Duration</option>
                      <option value='weight'>Weight</option>
                      <option value='avgTemp'>Avg Temp</option>
                      <option value='maxPressure'>Max Pressure</option>
                      <option value='avgFlow'>Avg Flow</option>
                    </select>
                  </div>
                ))}
              </div>
            </SettingsFormField>
          )}
        </Card>

        {/* ── Card 2: Panel Selection ───────────────────────────────────── */}
        <Card sm={10} lg={5} title='Panel Selection'>
          <div className='divider'>
            <span>Panels</span>
            <div className='flex items-center gap-3'>
              <label className='flex cursor-pointer items-center gap-1.5 text-xs font-normal normal-case tracking-normal'>
                <input
                  type='checkbox'
                  className='toggle toggle-xs toggle-primary'
                  checked={stickyTop}
                  onChange={e => { setStickyTopState(e.target.checked); setStickyTop(e.target.checked); }}
                />
                Stick first to top
              </label>
              <label className='flex cursor-pointer items-center gap-1.5 text-xs font-normal normal-case tracking-normal'>
                <input
                  type='checkbox'
                  className='toggle toggle-xs toggle-primary'
                  checked={stickyBottom}
                  onChange={e => { setStickyBottomState(e.target.checked); setStickyBottom(e.target.checked); }}
                />
                Stick last to bottom
              </label>
              <div className='join'>
                <button
                  type='button'
                  className={`btn btn-xs join-item ${columnSpacing === COLUMN_SPACINGS.START ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => { setColumnSpacingState(COLUMN_SPACINGS.START); setColumnSpacing(COLUMN_SPACINGS.START); }}
                >
                  Pack to top
                </button>
                <button
                  type='button'
                  className={`btn btn-xs join-item ${columnSpacing === COLUMN_SPACINGS.BETWEEN ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => { setColumnSpacingState(COLUMN_SPACINGS.BETWEEN); setColumnSpacing(COLUMN_SPACINGS.BETWEEN); }}
                >
                  Space evenly
                </button>
              </div>
            </div>
          </div>
          <SortableConfigurator
            order={panelOrder}
            definitions={PANEL_DEFINITIONS}
            hidden={hiddenPanels}
            onOrderChange={ids => { setPanelOrderState(ids); persistPanelOrder(ids); }}
            emptyMessage='All available panels are visible.'
            extraControls={(def) => def.supportsCompact ? (
              <button
                type='button'
                title={compactPanels.includes(def.id) ? 'Switch to full view' : 'Switch to compact view'}
                onClick={() => handleToggleCompact(def.id)}
                className={`btn btn-ghost btn-xs flex h-6 w-6 items-center justify-center rounded p-0 ${compactPanels.includes(def.id) ? 'text-primary' : 'text-base-content/30'}`}
              >
                <FontAwesomeIcon icon={faCompress} className='h-3 w-3' />
              </button>
            ) : null}
          />
          {!compactPanels.includes('profile') && panelOrder.includes('profile') && (
            <SettingsFormField label='Profile Chart Height' htmlFor='profileChartHeight'>
              <div className='flex items-center gap-3'>
                <input
                  id='profileChartHeight'
                  type='range'
                  min='64'
                  max='256'
                  step='8'
                  className='range range-primary range-sm flex-1'
                  value={profileChartHeight}
                  onChange={e => {
                    const n = Number(e.target.value);
                    setProfileChartHeightState(n);
                    setProfileChartHeight(n);
                  }}
                />
                <span className='w-16 text-sm'>{profileChartHeight} px</span>
              </div>
            </SettingsFormField>
          )}
        </Card>

        {/* ── Card 3: Metric Selection ──────────────────────────────────── */}
        <Card sm={10} lg={5} title='Metric Selection'>
          <SettingsFormField label='Metrics Columns' htmlFor='metricsColumns'>
            <div className='flex items-center gap-3'>
              <input
                id='metricsColumns'
                type='range'
                min='1'
                max='4'
                step='1'
                className='range range-primary range-sm flex-1'
                value={metricsColumns}
                onChange={e => {
                  const n = Number(e.target.value);
                  setMetricsColumnsState(n);
                  setMetricsColumns(n);
                }}
              />
              <span className='w-20 text-sm'>{metricsColumns} {metricsColumns === 1 ? 'column' : 'columns'}</span>
            </div>
          </SettingsFormField>
          <SettingsFormField label='Last Row Fill' htmlFor='metricsLastRowFill'>
            <select
              id='metricsLastRowFill'
              className='select select-bordered w-full'
              value={metricsLastRowFill}
              onChange={e => {
                setMetricsLastRowFillState(e.target.value);
                setMetricsLastRowFill(e.target.value);
              }}
            >
              <option value={METRICS_LAST_ROW_FILLS.EVEN}>Even fill</option>
              <option value={METRICS_LAST_ROW_FILLS.GRID}>Align to grid</option>
            </select>
          </SettingsFormField>
          <SortableConfigurator
            order={metricOrder}
            definitions={METRIC_DEFINITIONS}
            hidden={hiddenMetrics}
            onOrderChange={ids => { setMetricOrderState(ids); persistMetricOrder(ids); }}
            emptyMessage='All available metrics are visible.'
          />
        </Card>

      </div>

      <div className='pt-4'>
        <div className='flex flex-col gap-2 pt-4 sm:flex-row'>
          <a href='/' className='btn btn-outline flex-1 sm:flex-none'>
            Back
          </a>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/pages/DashboardSettings/index.jsx
git commit -m "feat: add DashboardSettings page with three cards"
```

---

## Task 2: Register the route

**Files:**
- Modify: `web/src/index.jsx`

The file uses `preact-iso/lazy` to code-split each page. Add the new page the same way.

- [ ] **Step 1: Add the lazy import**

After the existing `StatisticsPage` lazy import (around line 35), add:

```js
const DashboardSettings = lazy(() =>
  import('./pages/DashboardSettings/index.jsx').then(m => m.DashboardSettings)
);
```

- [ ] **Step 2: Add the Route**

Inside the `<Router>` block, after `<Route path='/' component={Home} />` (around line 88), add:

```jsx
<Route path='/dashboard-settings' component={DashboardSettings} />
```

- [ ] **Step 3: Verify**

Run `cd web && npm run dev`. Navigate to `http://localhost:5173/dashboard-settings` in a browser. The three cards (General Settings, Panel Selection, Metric Selection) should render. All controls should work and immediately update the dashboard when you switch to `/`.

- [ ] **Step 4: Commit**

```bash
git add web/src/index.jsx
git commit -m "feat: register /dashboard-settings route"
```

---

## Task 3: Add pen icon to Navigation

**Files:**
- Modify: `web/src/components/Navigation.jsx`

The nav uses `NAVIGATION_SECTIONS` (a static array) fed into a `.map()`. We special-case the `dashboard` section render to wrap the `MenuItem` in a row with a pen button alongside it.

- [ ] **Step 1: Add the faPen import**

At the top of the file, after the existing FontAwesome imports, add:

```js
import { faPen } from '@fortawesome/free-solid-svg-icons/faPen';
```

- [ ] **Step 2: Replace the section map render**

Find this block in the `Navigation` component (around line 227):

```jsx
{NAVIGATION_SECTIONS.map(section => (
  <div key={section.id}>
    {section.showDivider ? <hr className='h-5 border-0' /> : null}
    <div className='space-y-1.5'>
      {section.items.map(item => (
        <MenuItem key={item.link} collapsed={collapsed} {...item} />
      ))}
    </div>
  </div>
))}
```

Replace it with:

```jsx
{NAVIGATION_SECTIONS.map(section => (
  <div key={section.id}>
    {section.showDivider ? <hr className='h-5 border-0' /> : null}
    <div className='space-y-1.5'>
      {section.items.map(item => {
        if (section.id === 'dashboard') {
          return (
            <div key={item.link} className='flex items-center gap-1'>
              <div className='min-w-0 flex-1'>
                <MenuItem collapsed={collapsed} {...item} />
              </div>
              {!collapsed && (
                <a
                  href='/dashboard-settings'
                  aria-label='Dashboard Settings'
                  title='Dashboard Settings'
                  className={`btn btn-square btn-sm h-12 min-h-0 w-10 min-w-0 shrink-0 rounded-xl border-none ${
                    loc.path === '/dashboard-settings'
                      ? 'bg-primary text-primary-content hover:bg-primary hover:text-primary-content'
                      : 'bg-transparent text-base-content hover:bg-base-content/10 hover:text-base-content'
                  }`}
                >
                  <FontAwesomeIcon icon={faPen} className='h-3.5 w-3.5' />
                </a>
              )}
            </div>
          );
        }
        return <MenuItem key={item.link} collapsed={collapsed} {...item} />;
      })}
    </div>
  </div>
))}
```

Note: `loc` is already available in `Navigation` — it is assigned at the top of the component as `const loc = useLocation();`.

- [ ] **Step 3: Verify**

With `npm run dev` running, open the app. The Dashboard nav item should have a small pen icon to its right. Clicking the pen goes to `/dashboard-settings`. The pen icon should be highlighted (primary color) when you are on `/dashboard-settings`. Collapse the nav — the pen icon should disappear.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/Navigation.jsx
git commit -m "feat: add dashboard settings pen icon to navigation"
```

---

## Task 4: Remove Dashboard Settings from Settings page

**Files:**
- Modify: `web/src/pages/Settings/index.jsx`

This is a pure deletion task. Make changes in this order to keep the file always parseable.

- [ ] **Step 1: Remove the Dashboard Settings card**

Delete the entire `<Card sm={10} lg={5} title='Dashboard Settings'>` block. It starts at the line containing `<Card sm={10} lg={5} title='Dashboard Settings'>` and ends at the matching `</Card>` closing tag (currently lines 1137–1320 of the file). Delete everything between and including those two lines.

- [ ] **Step 2: Remove dashboard-only state declarations**

Remove these `useState` declarations and their associated update handlers from inside the `Settings` function body. Each is a self-contained block:

```js
// Remove these state declarations:
const [metricOrder, setMetricOrderState] = useState(() => getMetricOrder());
const [metricsColumns, setMetricsColumnsState] = useState(() => getMetricsColumns());
const [metricsLastRowFill, setMetricsLastRowFillState] = useState(() => getMetricsLastRowFill());
const [panelOrder, setPanelOrderState] = useState(() => getPanelOrder());
const [stickyBottom, setStickyBottomState] = useState(() => getStickyBottom());
const [stickyTop, setStickyTopState] = useState(() => getStickyTop());
const [showRecentShots, setShowRecentShotsState] = useState(() => getShowRecentShots());
const [compactPanels, setCompactPanelsState] = useState(() => getCompactPanels());
const [profileChartHeight, setProfileChartHeightState] = useState(() => getProfileChartHeight());
const [columnSpacing, setColumnSpacingState] = useState(() => getColumnSpacing());
const [shotMetricSlots, setShotMetricSlotsState] = useState(() => getShotMetricSlots());

// Remove these handlers:
const updateMetricOrder = (ids) => { ... };
const updatePanelOrder = (ids) => { ... };
const updateStickyBottom = (val) => { ... };
const handleToggleCompact = (id) => { ... };

// Remove these derived variables:
const hiddenMetrics = METRIC_DEFINITIONS.filter(...);
const hiddenPanels = PANEL_DEFINITIONS.filter(...);
```

- [ ] **Step 3: Remove dashboardLayout/dashboardCardMode from formData initialization**

In the `useEffect` that calls `setFormData(settingsWithToggle)`, the `settingsWithToggle` object includes these two lines — remove them:

```js
// Remove from settingsWithToggle:
dashboardLayout: getDashboardLayout(),
dashboardCardMode: getDashboardCardMode(),
```

- [ ] **Step 4: Remove dashboardLayout/dashboardCardMode from the onChange handler**

In the `onChange` function, remove these two blocks:

```js
// Remove:
if (key === 'dashboardLayout') {
  setDashboardLayout(value);
}
if (key === 'dashboardCardMode') {
  setDashboardCardMode(value);
}
```

- [ ] **Step 5: Remove dashboard-only imports**

Remove from the `dashboardManager` import the symbols no longer used in Settings. The full import block currently is long — replace it with just what remains used (nothing from dashboardManager is used after this cleanup, so remove the entire import):

```js
// Remove the entire dashboardManager import block:
import {
  DASHBOARD_LAYOUTS, getDashboardLayout, setDashboardLayout,
  DASHBOARD_CARD_MODES, getDashboardCardMode, setDashboardCardMode,
  getMetricOrder, setMetricOrder as persistMetricOrder,
  getPanelOrder, setPanelOrder as persistPanelOrder,
  getStickyBottom, setStickyBottom,
  getStickyTop, setStickyTop,
  getShowRecentShots, setShowRecentShots,
  getMetricsColumns, setMetricsColumns,
  METRICS_LAST_ROW_FILLS, getMetricsLastRowFill, setMetricsLastRowFill,
  getCompactPanels, toggleCompactPanel,
  getProfileChartHeight, setProfileChartHeight,
  COLUMN_SPACINGS, getColumnSpacing, setColumnSpacing,
  getShotMetricSlots, setShotMetricSlots,
  setClock24h,
} from '../../utils/dashboardManager.js';
```

**Exception:** `setClock24h` is still used by the `clock24hFormat` case in `onChange`. Keep only that one symbol:

```js
import { setClock24h } from '../../utils/dashboardManager.js';
```

Also remove these now-unused imports:

```js
// Remove:
import { METRIC_DEFINITIONS } from '../../utils/metricDefinitions.js';
import { PANEL_DEFINITIONS } from '../../utils/panelDefinitions.js';
import { faCompress } from '@fortawesome/free-solid-svg-icons/faCompress';

// Keep (used elsewhere in the file):
// faEye, faEyeSlash  → used for Wi-Fi password show/hide
// faCrosshairs       → used in Alba Settings water tank distance
// SortableConfigurator → REMOVE (no longer used)
// ToggleField, SettingsFormField, InputGroupField → KEEP (all used)
```

Remove `SortableConfigurator` from the `SettingsFormField.jsx` import:

```js
// Before:
import {
  InputGroupField,
  SettingsFormField,
  SortableConfigurator,
  ToggleField,
} from '../../components/SettingsFormField.jsx';

// After:
import {
  InputGroupField,
  SettingsFormField,
  ToggleField,
} from '../../components/SettingsFormField.jsx';
```

- [ ] **Step 6: Verify**

With `npm run dev` running:
1. Navigate to `/settings`. The Dashboard Settings card should be gone. All other cards (Temperature, Web Settings, System Preferences, Display, User Preferences, Machine Settings, Alba, Plugins) must still render and work.
2. The Save button should still work (no JS errors in console).
3. Navigate to `/dashboard-settings`. All three cards should still work correctly.

- [ ] **Step 7: Commit**

```bash
git add web/src/pages/Settings/index.jsx
git commit -m "refactor: remove dashboard settings from settings page"
```
