# Ring Fill Status Text — Design Spec

**Date:** 2026-04-29
**Topics:** Process ring status text during heating
**Status:** Draft

## Context

The process ring on the web Dashboard currently shows temperature or brew progress in the center, with a mode label (STANDBY, BREW, STEAM, etc.) below it. When the user starts a brew, the machine often needs to heat up to target temperature first. There's no clear text indication that the machine is actively heating — the user sees the ring fill but no explicit "Heating..." status.

## Decision

Add a secondary text label below the ring that shows "Heating" (brew mode 1) or "Preheating" (steam mode 2) when the machine is actively below target temperature. Replaces the normal subtitle when heating is active.

## Implementation

### Web UI (`web/src/pages/Home/ProcessControls.jsx`)

**Add a helper to compute heating state:**

```javascript
function getHeatingLabel(mode, currentTemperature, targetTemperature, isTemperatureStable) {
  if (isTemperatureStable) return null;
  if (currentTemperature >= targetTemperature) return null;
  if (mode === 1) return 'Heating';
  if (mode === 2) return 'Preheating';
  return null;
}
```

**Integrate into `getDisplayState`:**

```javascript
function getDisplayState({ mode, active, finished, processInfo, currentTemperature, targetTemperature, isGrindAvailable }) {
  const heatingLabel = getHeatingLabel(mode, currentTemperature, targetTemperature, isTemperatureStable);

  if (active) {
    return {
      title: processInfo?.l || 'Running',
      subtitle: processInfo?.s === 'brew' ? 'Extraction in progress' : 'Process in progress',
      heatingLabel,  // show even during active brew if still heating
    };
  }

  if (finished) {
    return {
      title: 'Finished',
      subtitle: `${Math.floor((processInfo?.e || 0) / 1000)}s total time`,
      heatingLabel,
    };
  }

  // For all non-active states, use heating label if present
  if (heatingLabel) {
    return {
      title: MODE_LABELS[mode] || 'STANDBY',
      subtitle: heatingLabel,
    };
  }

  // Fallback to default subtitle
  return {
    title: MODE_LABELS[mode] || 'STANDBY',
    subtitle: MODE_SUBTITLES[mode] || 'Ready',
  };
}
```

**Add `isTemperatureStable` to `getDisplayState` inputs:**
The function needs access to the temperature stability state. It should be added as a parameter when calling `getDisplayState` from the component.

**Styling:**
The subtitle uses existing `--text-secondary` color. For heating labels, use amber/warning tone:
```javascript
// In the JSX where subtitle is rendered:
<div className={`nd-ring-subtitle${heatingLabel ? ' nd-ring-subtitle--heating' : ''}`}>
  {displayState.subtitle}
</div>
```

```css
/* web/src/style.css — add per theme */
.nd-ring-subtitle--heating {
  color: var(--home-ring-brew, #d71921);
}
```

**When to show:**
- `mode === 1` (BREW) or `mode === 2` (STEAM)
- `!isTemperatureStable && currentTemp < targetTemp`
- Also show during active brew/flush if still heating (not yet stable)

## LVGL (Deferred)

The LVGL UI has a flashing heating icon on the dials panel. When the feature is extended to LVGL later, a text label can be added to each screen's ring area following the same logic. The LVGL implementation will be designed in a separate spec.

## Changes

**File:** `web/src/pages/Home/ProcessControls.jsx`
- Add `getHeatingLabel()` helper
- Update `getDisplayState()` to accept `isTemperatureStable` and use heating label as subtitle when active
- Pass `isTemperatureStable` when calling `getDisplayState`

**File:** `web/src/style.css`
- Add `.nd-ring-subtitle--heating` style in each theme section (or a shared section at the end of each theme block)
- Color: `var(--home-ring-brew, #d71921)` — amber/red to signal heating state