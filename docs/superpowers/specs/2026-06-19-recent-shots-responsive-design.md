# Recent Shots — Configurable Count & Responsive Layout

**Date:** 2026-06-19
**Branch:** feature/dashboard-redesign

---

## Goal

Replace the hardcoded 4-column recent shots grid with a configurable shot count and a responsive layout that auto-fills columns on wider screens and switches to a vertical single-column layout on smartphones.

---

## Settings

### New setting: `recentShotCount`

| Property | Value |
|---|---|
| localStorage key | `dashboardRecentShotCount` |
| Default | `4` |
| Valid range | `1–8` (integer) |
| Signal | `recentShotCountSignal` |
| Getter | `getRecentShotCount()` |
| Setter | `setRecentShotCount(value)` |

Follows the same pattern as `metricsColumns` in `dashboardManager.js`: localStorage read on module init, signal updated alongside localStorage on set, integer validation with clamp on read.

---

## Layout

### Grid (sm and above, ≥ 640px)

The outer grid uses CSS auto-fill with a fixed card minimum width of **180px**. The Tailwind class for this is applied as a static arbitrary-value class (not dynamically constructed, so Tailwind's scanner picks it up):

```
className="grid grid-cols-1 sm:[grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]"
```

`grid-cols-1` is the default (mobile). The `sm:` variant overrides to auto-fill at ≥ 640px. The number of visible columns is determined naturally by the container width — no breakpoint-specific column counts needed. The configured `recentShotCount` caps how many shot cards are loaded, not the column count directly.

### Mobile (below sm, < 640px)

Single-column layout (`grid-cols-1`). Each `ShotMiniCard` renders in a horizontal row:
- **Left:** shot id + relative day label + profile name (stacked, `flex-col`)
- **Right:** metric cluster (metrics in a horizontal `flex-row`)
- Analyzer icon remains top-right

This is achieved with responsive Tailwind classes on the card wrapper (`flex-col sm:flex-col` internals, `flex-row` on mobile for the top section). No JS breakpoint detection.

### Breakpoint summary

| Breakpoint | Grid | Card orientation |
|---|---|---|
| default (< 640px) | `grid-cols-1` | Horizontal row (id left, metrics right) |
| sm+ (≥ 640px) | auto-fill minmax(180px, 1fr) | Vertical stack (current layout) |

---

## Data loading

`RecentShotsCard` replaces:
```js
indexToShotList(parseBinaryIndex(buf)).slice(0, 4)
```
with:
```js
indexToShotList(parseBinaryIndex(buf)).slice(0, recentShotCountSignal.value)
```

`recentShotCountSignal.value` is added to the `useEffect` dependency array so the card reloads when the setting changes in the same session.

---

## Files changed

| File | Change |
|---|---|
| `web/src/utils/dashboardManager.js` | Add `recentShotCount` localStorage key, getter, setter, and signal |
| `web/src/pages/Home/cards/RecentShotsCard.jsx` | Use signal for slice count; update grid classes + inline style; update `ShotMiniCard` layout for mobile |
| `web/src/pages/DashboardSettings/index.jsx` | Add "Max Recent Shots" range slider (1–8) inside the `showRecentShots` conditional block |

---

## Dashboard settings UI

Inside the existing `{showRecentShots && (...)}` block in `DashboardSettings`, add a new `SettingsFormField` row above the metric slot selectors:

- **Label:** Max Recent Shots
- **Control:** `<input type="range" min="1" max="8" step="1" />`
- **Value display:** `{recentShotCount} {recentShotCount === 1 ? 'shot' : 'shots'}`
- Matches the visual pattern of the existing "Metrics Columns" slider

---

## Out of scope

- Pagination or "load more" — max 8 shots is the ceiling
- Separate mobile column count setting — auto-fill handles this implicitly
- Changing the card min-width — 180px is fixed
