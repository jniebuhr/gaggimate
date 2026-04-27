# Process Ring Fill & Standby Temp — Design Spec

**Date:** 2026-04-27
**Topics:**
1. Align ring fill to 300 arc (matching scale positions)
2. Standby ring shows current temperature as muted red fill
**Status:** Approved

## Context

The process ring on the Dashboard fills during heating, steaming, and brewing. However, the `conic-gradient` starts at 210deg (top-right position), while the scale markers (0% on the left, 100% on the right) are positioned at the sides. This creates a mismatch — when the ring fills to e.g. 50%, the visual progress doesn't align with where a "50%" label would logically sit on the scale.

Additionally, when in standby (mode 0), the ring shows only a static low fill with no meaningful data — users can't see the current temperature at a glance.

## Decisions

### 1. Scale ring fill to 300 arc (0→100 alignment)

The ring fill now maps to a 300-degree visible arc (210deg start → 150deg end) instead of a full 360-degree circle. This means at 100% progress, the fill stops exactly at the 100 marker on the right side.

**Implementation:**
- `buildSolidRingBackground`: progress multiplied by `300/360` (≈0.833) so 100% maps to 150deg
- `buildSegmentedRingBackground`: same scaling applied via `ARC_SCALE` constant

**Before:**
- Ring fill reached 100% at 360deg (full circle)

**After:**
- Ring fill reaches 100% at 150deg (matching the 100 marker position on the right)

### 2. Standby ring shows current temperature

In standby mode (not active, not finished), the ring now shows a muted red fill proportional to current temperature vs 93°C reference.

**Implementation:**
- Mode 0 handler calls `getTemperatureProgress(currentTemperature, 93)`
- Uses new CSS variable `--home-ring-standby-temp: #b84a32` (muted soft red)

## Changes

**File:** `web/src/pages/Home/ProcessControls.jsx`

```jsx
// buildSolidRingBackground — scale to 300 arc
const progress = clampPercent(progressPercent) * (300 / 360);

// buildSegmentedRingBackground — scale to 300 arc
const ARC_SCALE = 300 / 360;
const startPercent = segment.start * 100 * ARC_SCALE;
const endPercent = segment.end * 100 * ARC_SCALE;

// getRingVisual — standby shows temp
if (!active && mode === 0) {
  const progress = getTemperatureProgress(currentTemperature, 93);
  return {
    background: buildSolidRingBackground(progress, 'var(--home-ring-standby-temp)'),
    progress,
  };
}
```

**File:** `web/src/style.css`

```css
/* New CSS variable for standby temp ring (muted soft red) */
--home-ring-standby-temp: #b84a32;
```
Added to all 6 themes: default, dark, coffee, nord, amoled, stealth, crisp.

## Verification

After the change:
1. In standby, verify ring shows muted red fill proportional to current temp vs 93°C
2. Start a process (heating/steaming/brew), verify ring fill direction aligns with scale 0→100