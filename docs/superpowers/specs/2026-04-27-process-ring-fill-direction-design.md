# Process Ring Fill Direction — Design Spec

**Date:** 2026-04-27
**Topic:** Align ring fill direction with scale markers
**Status:** Approved

## Context

The process ring on the Dashboard fills during heating, steaming, and brewing. However, the `conic-gradient` starts at 210deg (top-right position), while the scale markers (0% on the left, 100% on the right) are positioned at the sides. This creates a mismatch — when the ring fills to e.g. 50%, the visual progress doesn't align with where a "50%" label would logically sit on the scale.

## Decision

Change the conic-gradient origin from `from 210deg` to `from 0deg` so the ring fills clockwise from the top, aligned with the left-to-right reading direction of the scale.

### Visual Behavior

| Aspect | Before | After |
|--------|--------|-------|
| Gradient start | 210deg (top-right) | 0deg (top) |
| Gap position | Top-right | Top (12 o'clock) |
| Fill direction | Does not align with scale | Clockwise, matches scale reading |
| 50% visual position | Arbitrary | Top of ring |
| Scale alignment | Misaligned | Fill fills past 0→100 left-to-right |

## Changes

**File:** `web/src/pages/Home/ProcessControls.jsx`

**Function:** `buildRingBackground` (line ~104)

```jsx
// Before
`conic-gradient(from 210deg, ${fillStops})`

// After
`conic-gradient(from 0deg, ${fillStops})`
```

## Verification

After the change:
1. Open Dashboard, start a process (heating/steaming/brew)
2. Observe that ring fill progresses in the same direction you'd read the scale (0 left → 100 right)
3. Confirm gap at top doesn't interfere with scale marker positions

## Notes

- The gap moves from top-right to top-center. If keeping the gap at top-right is important, this approach should be revisited.
- No other components use this ring styling function, so no downstream breakages expected.