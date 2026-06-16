# Recent Shot Card Redesign — Design Spec

**Date:** 2026-06-16  
**Branch:** feature/dashboard-redesign  

---

## Goal

Replace the current `ShotMiniCard` in `RecentShotsCard` with the visual style of `ShotMainInfoCard` (from the Shot Analyzer feature), and make the three summary metric slots user-configurable via the Dashboard Settings panel.

---

## Visual Design

### Card layout (`ShotMiniCard` replacement)

Each card uses the `app-card-surface` background class, `rounded-xl`, and responsive padding (`p-3 lg:p-2.5 xl:p-3`) to match `ShotMainInfoCard`.

**Header row**
- Left: shot name (`#ID`) with relative day label (· Today / · Yesterday / · Mon) in muted text
- Below name: profile name with `.json` suffix stripped (use existing `cleanName` from `analyzerUtils.js`)
- Right: analyzer icon link (`/analyzer/internal/${shot.id}`) — already present in current card

**Metrics row** (3 slots, configurable — see Settings below)
- Each slot: value + unit + label, tabular-nums, same layout as `ShotSummaryMetricsRow`
- While slog data loads: show `—` placeholder for slog-dependent metrics

**Footer**
- Full date + time: `DD Mon YYYY, h:MM AM/PM` or `DD Mon YYYY, HH:MM` depending on 24h setting
- Formatted via `toLocaleString` with `{ day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: !getClock24h() }`

---

## Configurable Metrics

### Available options

| ID | Label | Unit | Source | Needs slog? |
|----|-------|------|--------|-------------|
| `duration` | Duration | s | index (`duration / 1000`) | No |
| `weight` | Weight | g | index (`volume`) | No |
| `avgTemp` | Avg Temp | °C | slog — avg of `sample.ct` values | Yes |
| `maxPressure` | Max Pressure | bar | slog — max of `sample.cp` values | Yes |
| `avgFlow` | Avg Flow | ml/s | slog — avg of non-zero `sample.fl` values | Yes |

### Defaults

Slot 1: Duration · Slot 2: Weight · Slot 3: Max Pressure

---

## Slog Fetch Optimization

Before the fetch loop in `RecentShotsCard`, derive which slog-computed fields are needed:

```js
const needsAvgTemp    = configuredSlots.includes('avgTemp');
const needsMaxPressure = configuredSlots.includes('maxPressure');
const needsAvgFlow    = configuredSlots.includes('avgFlow');
const needsSlog       = needsAvgTemp || needsMaxPressure || needsAvgFlow;
```

If `needsSlog` is false for a shot, skip the `.slog` fetch for that shot entirely.

Inside the slog fetch, only accumulate fields that are needed:
- `needsAvgTemp` → sum `ct` samples, divide by count
- `needsMaxPressure` → track max of `cp` samples
- `needsAvgFlow` → sum non-zero `fl` samples, divide by count

This prevents unnecessary binary downloads when the user only has index-available metrics configured.

---

## State Management

### `dashboardManager.js` additions

Three new localStorage-backed getters/setters following the existing pattern:

```
DASHBOARD_SHOT_METRIC_SLOTS_KEY = 'dashboardShotMetricSlots'
DEFAULT_SHOT_METRIC_SLOTS = ['duration', 'weight', 'maxPressure']

getShotMetricSlots() → string[3]
setShotMetricSlots(slots: string[3]) → bool
shotMetricSlotsSignal = signal(getShotMetricSlots())

DASHBOARD_CLOCK_24H_KEY = 'dashboardClock24h'

getClock24h() → bool  (default: false)
setClock24h(value: bool) → bool
clock24hSignal = signal(getClock24h())
```

### Settings page (`Settings/index.jsx`)

1. **`clock24hFormat` handler** — existing `onChange('clock24hFormat')` already toggles the value; also call `setClock24h(value)` so the card reads the updated preference without a page reload.

2. **New state** — `const [shotMetricSlots, setShotMetricSlotsState] = useState(() => getShotMetricSlots())`

3. **Placement** — render the 3 slot dropdowns immediately below the "Show Recent Shots" toggle, wrapped in `{showRecentShots && <div>...</div>}` so they are hidden when the toggle is off.

4. **UI** — three `<select>` elements labeled "Slot 1", "Slot 2", "Slot 3", each with the five metric options. On change: update local state and call `setShotMetricSlots(newSlots)`.

---

## Relative Day Label

Inline helper (no new dependency):

```js
function getRelativeDayLabel(timestamp) {
  if (!timestamp || timestamp < 10000) return '';
  const d = new Date(timestamp * 1000);
  const today = new Date();
  const diffDays = Math.floor((today - d) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short' });
}
```

---

## Files Changed

| File | Change |
|------|--------|
| `web/src/pages/Home/cards/RecentShotsCard.jsx` | Replace `ShotMiniCard` with new layout; add slog fetch optimization; read `shotMetricSlotsSignal` and `clock24hSignal` |
| `web/src/utils/dashboardManager.js` | Add `getShotMetricSlots`/`setShotMetricSlots`/`shotMetricSlotsSignal` and `getClock24h`/`setClock24h`/`clock24hSignal` |
| `web/src/pages/Settings/index.jsx` | Wire `setClock24h` in clock24hFormat handler; add `shotMetricSlots` state and 3 slot dropdowns under "Show Recent Shots" toggle |

No new files required. `cleanName` is imported from the existing `analyzerUtils.js`.

---

## Out of Scope

- Rating control (no interactive write-back on home page)
- Source marker (all home-page shots are gaggimate-source)
- Brew-by-weight/time indicator (not available from binary index or slog)
- Compare-mode accents (analyzer feature only)
