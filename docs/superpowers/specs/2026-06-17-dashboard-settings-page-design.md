# Dashboard Settings Page

**Date:** 2026-06-17
**Status:** Approved

## Overview

Move all dashboard-related settings out of the main Settings page into a dedicated Dashboard Settings page. The page is accessible via a pen icon button placed next to the Dashboard entry in the sidebar navigation.

## Motivation

The Settings page has grown crowded. Dashboard settings (panel order, metric order, layout modes, chart height, etc.) are all localStorage-only — they have no dependency on the server form submit that governs the rest of Settings. Separating them improves discoverability and reduces cognitive load on the Settings page.

## Route & File

- **Route:** `/dashboard-settings`
- **Component:** `web/src/pages/DashboardSettings/index.jsx`
- **Lazy-loaded** in `web/src/index.jsx` following the same pattern as all other pages.

## Navigation Changes (`web/src/components/Navigation.jsx`)

The `dashboard` section currently renders a single `<MenuItem>`. Replace it with a custom row:

```
[ <MenuItem link="/" label="Dashboard" .../>  ] [ 🖊 ]
```

- The `<MenuItem>` is given `flex-1` so it still fills the available width.
- The pen button is a small `<a href="/dashboard-settings">` styled as `btn btn-square btn-ghost` (same square size as the collapse toggle button).
- Uses `faPen` from `@fortawesome/free-solid-svg-icons/faPen`.
- **Hidden when `collapsed === true`** — rendered only inside `{!collapsed && …}`.
- Both elements share a wrapper `<div className="flex items-center gap-1">`.
- The pen button receives `aria-label="Dashboard Settings"` and `title="Dashboard Settings"`.
- The pen button is highlighted (uses `btn-primary` styles) when the current path is `/dashboard-settings`.

The `NAVIGATION_SECTIONS` data structure is not changed — the special-casing is done in the render function by checking `section.id === 'dashboard'`.

## Dashboard Settings Page

### Layout

Same grid layout as Settings: `grid grid-cols-1 gap-4 lg:grid-cols-10`.

Page header: `<h2>Dashboard Settings</h2>` with a Back button linking to `/`.

No `<form>` element. All changes write immediately to `localStorage` via `dashboardManager` setter functions (which also update the relevant signals). No save button needed.

### Card 1 — General Settings (`lg={5}`)

| Setting | Control |
|---|---|
| Dashboard Layout | `<select>`: "Process Controls First" / "Chart First" |
| Control Column Style | `<select>`: "Multiple Cards" / "Single Card" |
| Show Recent Shots | `<ToggleField>` |
| Shot Card Metrics | 3 `<select>` slot pickers — visible only when Show Recent Shots is on |

Each change calls the corresponding `dashboardManager` setter directly (e.g. `setDashboardLayout`, `setDashboardCardMode`, `setShowRecentShots`, `setShotMetricSlots`). Local `useState` mirrors the current value for rendering, initialized from the getter (e.g. `useState(() => getDashboardLayout())`).

### Card 2 — Panel Selection (`lg={5}`)

Header divider contains inline controls (same as today in Settings):
- "Stick first to top" toggle (`setStickyTop`)
- "Stick last to bottom" toggle (`setStickyBottom`)
- Join-button group: "Pack to top" / "Space evenly" (`setColumnSpacing`)

Body:
- `<SortableConfigurator>` for panels with `extraControls` prop rendering a compact-toggle button per panel that supports it (same as today).
- Profile Chart Height range (64–256 px, step 8) — shown only when the `profile` panel is in `panelOrder` and `compactPanels` does not include `'profile'`.

### Card 3 — Metric Selection (`lg={5}`)

| Setting | Control |
|---|---|
| Metrics Columns | Range slider 1–4, displays `N column(s)` |
| Last Row Fill | `<select>`: "Even fill" / "Align to grid" |

Below the controls: `<SortableConfigurator>` for metrics (no `extraControls`).

### State

All state is initialized from `dashboardManager` getters and updated immediately on change — no deferred save:

```js
const [panelOrder,        setPanelOrderState]        = useState(() => getPanelOrder());
const [stickyBottom,      setStickyBottomState]      = useState(() => getStickyBottom());
const [stickyTop,         setStickyTopState]          = useState(() => getStickyTop());
const [showRecentShots,   setShowRecentShotsState]   = useState(() => getShowRecentShots());
const [compactPanels,     setCompactPanelsState]     = useState(() => getCompactPanels());
const [profileChartHeight,setProfileChartHeightState]= useState(() => getProfileChartHeight());
const [columnSpacing,     setColumnSpacingState]     = useState(() => getColumnSpacing());
const [shotMetricSlots,   setShotMetricSlotsState]   = useState(() => getShotMetricSlots());
const [metricOrder,       setMetricOrderState]       = useState(() => getMetricOrder());
const [metricsColumns,    setMetricsColumnsState]    = useState(() => getMetricsColumns());
const [metricsLastRowFill,setMetricsLastRowFillState]= useState(() => getMetricsLastRowFill());
const [dashboardLayout,   setDashboardLayoutState]   = useState(() => getDashboardLayout());
const [dashboardCardMode, setDashboardCardModeState] = useState(() => getDashboardCardMode());
```

`machine` signal is needed for `hiddenPanels` and `hiddenMetrics` availability checks (same logic as today in Settings).

## Settings Page Changes (`web/src/pages/Settings/index.jsx`)

### Remove the Dashboard Settings card

Delete the entire `<Card sm={10} lg={5} title='Dashboard Settings'>` block (currently lines 1137–1320).

### Remove dashboard-only state and handlers

Remove all state declarations and handlers that exclusively served the removed card:

- `metricOrder` / `setMetricOrderState` / `updateMetricOrder` / `hiddenMetrics`
- `panelOrder` / `setPanelOrderState` / `updatePanelOrder`
- `stickyBottom` / `setStickyBottomState` / `updateStickyBottom`
- `stickyTop` / `setStickyTopState`
- `showRecentShots` / `setShowRecentShotsState`
- `compactPanels` / `setCompactPanelsState` / `handleToggleCompact`
- `profileChartHeight` / `setProfileChartHeightState`
- `columnSpacing` / `setColumnSpacingState`
- `shotMetricSlots` / `setShotMetricSlotsState`
- `metricsColumns` / `setMetricsColumnsState`
- `metricsLastRowFill` / `setMetricsLastRowFillState`
- `hiddenPanels`

### Remove dashboard-only imports

Remove from the `dashboardManager` import: all exports that are only used by the removed state/card. Keep only what remains used (e.g. `getDashboardLayout`, `setDashboardLayout`, `DASHBOARD_LAYOUTS`, `getDashboardCardMode`, `setDashboardCardMode`, `DASHBOARD_CARD_MODES` — these are still referenced in `onChange` for `dashboardLayout` and `dashboardCardMode` inside the `useEffect` form initialization and `onChange` handler).

Wait — actually `dashboardLayout` and `dashboardCardMode` in Settings are currently initialized into `formData` (see `settingsWithToggle`) and handled in `onChange`. Since these are localStorage-only (not sent to the server), they can be removed from the Settings form entirely. Remove them from `settingsWithToggle`, from `onChange`, and remove the `getDashboardLayout`/`setDashboardLayout`/`getDashboardCardMode`/`setDashboardCardMode` imports from Settings.

Also remove `METRIC_DEFINITIONS`, `PANEL_DEFINITIONS`, `SortableConfigurator` imports if they are no longer used in Settings after the card is removed. Remove `faCompress`, `faEye`, `faEyeSlash` only if unused elsewhere in the file — `faEye`/`faEyeSlash` are used for the Wi-Fi password toggle so keep those.

Remove `faCompress` import (only used in the dashboard card's `extraControls`).

## Files Changed

| File | Change |
|---|---|
| `web/src/index.jsx` | Add lazy import + `<Route path="/dashboard-settings">` |
| `web/src/components/Navigation.jsx` | Replace dashboard `MenuItem` with pen-icon row |
| `web/src/pages/DashboardSettings/index.jsx` | New file — the page |
| `web/src/pages/Settings/index.jsx` | Remove Dashboard Settings card + related state/imports |
