# Process Controls Card Redesign

## Status

Approved

## Context

The Process Controls card on the Main Dashboard currently contains a redundant Mode tab bar at the top. Mode selection is already available in the Header component via clickable stat pills with popovers. This duplication creates visual noise and maintenance overhead.

## Goal

Remove the redundant ModeTabBar from ProcessControls while maintaining or improving the card's usefulness by restructuring its layout around a contextual Quick-Status strip.

---

## Design: Quick-Status Strip

### Layout

```
┌─ Process Controls ───────────────────────┐
│  [●] Brewing · 93°C · Grind: 18g       │  ← Quick-status strip
│                                         │
│         ┌─────────────────┐             │
│         │  ●  ○  ○  ○  ○  │             │  ← ProcessDisplay (when active/finished)
│         │   shot 1/4      │             │
│         └─────────────────┘             │
│                                         │
│         [ ▶ Pause ]  [Flush]            │  ← ActionButtons (when visible)
└─────────────────────────────────────────┘
```

### Changes

1. **Remove ModeTabBar** — Mode is controlled from Header; no duplication needed

2. **New Quick-Status Strip** — A compact horizontal row replacing ModeTabBar, showing:
   - Mode indicator dot (colored circle matching MODE_DOT_COLORS)
   - Current state: Idle | Brewing | Finished
   - Contextual target value: Temperature OR Grind weight/duration based on current mode
   - Only shows values relevant to current mode (e.g., grind info hidden in Brew mode)

3. **Existing components preserved:**
   - `ProcessDisplay` — shown when brew is active or finished
   - `ModeIdleDisplay` — shown when brew is idle
   - `GrindTargetBar` — grind target slider
   - `TemperatureControls` — temp adjustment
   - `GrindTargetControls` — grind +/- buttons
   - `ActionButtons` — Play/Pause/Finish with Flush option

4. **Contextual visibility maintained** — Controls shown only when relevant to current mode

### Visibility Rules

| Mode    | Quick-Status Shows        | Temperature Controls | Grind Controls |
|---------|---------------------------|----------------------|----------------|
| Standby | State only                | Hidden               | Hidden         |
| Brew    | State + Grind target      | Hidden               | Hidden         |
| Steam   | State + Temp target      | Shown                | Hidden         |
| Water   | State + Temp target       | Shown                | Hidden         |
| Grind   | State + Grind target      | Hidden               | Shown          |

### Implementation

**File:** `web/src/pages/Home/ProcessControls.jsx`

**New component: QuickStatusStrip**
- Props: `state`, `mode`, `targetTemperature`, `grindTarget`, `grindTargetVolume`, `grindTargetDuration`, `isGrindMode`
- Displays mode dot, state badge, and contextual target
- Adapts display based on mode (temp vs grind info)

**Remove:**
- Import and usage of `ModeTabBar`
- `showGrindTab` prop (no longer passed to ModeTabBar)

**Update ProcessControls component:**
- Remove ModeTabBar JSX and related visibility logic
- Add QuickStatusStrip in place of ModeTabBar
- No changes to other component logic or prop flow

---

## Success Criteria

1. Mode tab bar no longer appears in Process Controls card
2. Quick-Status strip provides equivalent-at-a-glance status information
3. All controls remain accessible and functional
4. No duplicate mode selection controls on page
5. Card maintains visual coherence with the rest of the dashboard
