# Manual Shot → Profile Conversion

**Date:** 2026-05-15  
**Status:** Approved

## Overview

Users can convert any manual-mode shot in the shot history into a reusable Pro brew profile. The conversion page segments the recorded telemetry into phases using an auto-detection algorithm, lets the user adjust boundaries and configure each phase's target, then hands off the generated profile to the existing Pro profile editor for final tweaks before saving.

---

## Entry Point

A "Save as Profile" button is added to `HistoryCard.jsx`, rendered only when the shot is a manual shot (detected by an empty or absent `profileId` in the shot index entry — `ManualProcess` never writes a profile ID). The button sits alongside the existing export and delete actions.

Clicking navigates to `/shots/:id/to-profile`.

---

## Routing

A new route `/shots/:id/to-profile` is registered in the app router. The new page component is `ShotToProfile`. It fetches and parses the shot's `.slog` binary (reusing `parseBinaryShot.js`) if not already in state, then renders the conversion UI.

---

## Conversion Page (`ShotToProfile`)

### Layout

**Top half — annotated shot chart:**
- Reuses `HistoryChart.jsx` to render the pressure, flow, and temperature curves.
- Vertical draggable boundary markers are rendered as overlays on the chart. Each marker can be dragged horizontally to adjust the phase split point.
- Clicking anywhere on the chart outside an existing marker adds a new boundary.
- Each marker has a remove button (×) to delete it. A minimum of one phase (zero markers) is enforced.

**Bottom half — segment cards:**
- A horizontal list of segment cards, one per detected phase.
- Cards update live as boundary markers are moved.

**Footer:**
- "Cancel" — returns to shot history without saving.
- Profile name input (editable, pre-filled as `"Manual {shot date}"`).
- "Generate Profile" — builds the profile object and navigates to the Pro profile editor.

### Segment Cards

Each card displays:
- **Phase name**: editable text field, pre-filled as "Phase 1", "Phase 2", etc.
- **Time range / duration**: read-only, derived from boundary positions.
- **Stats**: average pressure (bar), average flow (ml/s), average temperature (°C) — read-only, informational.
- **Target type**: selector — "Pressure" or "Flow".
- **Target value**: number input, pre-filled with the segment's average for the selected type; clamped to valid range (0–12 bar / 0–6 ml/s). Updates when target type changes.
- **Temperature**: number input, pre-filled from the shot's recorded target temperature for that segment's time range.

---

## Phase Detection Algorithm

Runs in JavaScript on the parsed `ShotLogSample` array immediately when the page loads, before the user interacts.

1. **Signal selection**: Use the pressure samples (`cp` — current boiler pressure) as the primary signal. If the shot was recorded as flow-targeted (`targetType === MANUAL_TARGET_FLOW`), use pump flow (`fl`) instead.
2. **Smoothing**: Compute a rolling average of the signal over an 8-sample (~2 second) window to reduce noise.
3. **Derivative**: Compute the first-order difference of the smoothed signal.
4. **Candidate boundaries**: Find indices where the derivative crosses zero (sign change) and remains in the new direction for at least 3 consecutive samples.
5. **Merge**: Remove any candidate boundary that is less than 5 seconds (20 samples) from the previous accepted boundary, to avoid over-segmenting noisy curves.
6. **Cap**: If more than 5 boundaries are detected (6+ phases), keep only the 5 with the largest magnitude slope change.

Typical output for an espresso shot: 1–3 boundaries (2–4 phases), corresponding to the preinfusion ramp, main brew plateau, and optional tail-off.

---

## Profile Generation

When the user clicks "Generate Profile":

1. Collect the ordered list of segments (defined by boundary marker positions and segment card values).
2. Build a Pro profile object:

```json
{
  "id": "<new UUID>",
  "label": "<user-entered name>",
  "type": "pro",
  "temperature": "<first segment temperature>",
  "favorite": false,
  "selected": false,
  "phases": [
    {
      "name": "<segment name>",
      "phase": "brew",
      "valve": 1,
      "duration": "<segment duration in seconds>",
      "temperature": "<segment temperature>",
      "pump": {
        "target": "<pressure|flow>",
        "pressure": "<value if pressure target, else -1>",
        "flow": "<value if flow target, else -1>"
      },
      "transition": {
        "type": "linear",
        "duration": 1.0,
        "adaptive": false
      },
      "targets": []
    }
  ]
}
```

3. Navigate to `/profiles/new` passing the profile object as router state. The Pro profile editor already accepts an initial profile via router state and pre-fills the form.

---

## Affected Files

### New files
- `web/src/pages/ShotToProfile/index.jsx` — page component and top-level state
- `web/src/pages/ShotToProfile/BoundaryChart.jsx` — chart with draggable marker overlays
- `web/src/pages/ShotToProfile/SegmentCard.jsx` — per-phase configuration card
- `web/src/pages/ShotToProfile/detectPhases.js` — phase detection algorithm
- `web/src/pages/ShotToProfile/buildProfile.js` — profile object construction

### Modified files
- `web/src/pages/ShotHistory/HistoryCard.jsx` — add "Save as Profile" button for manual shots
- `web/src/App.jsx` (or router file) — add `/shots/:id/to-profile` route
- `web/src/pages/ProfileEdit/` — verify it accepts initial profile via router state (likely already works; confirm and expose if not)

---

## Out of Scope

- Firmware changes — this feature lives entirely in the web frontend.
- Automatic stop conditions (volumetric targets, pressure cutoffs) — phases use duration-only stop by default; the user configures stop conditions in the profile editor if desired.
- Phase transition curve fitting (ease-in/ease-out) — all generated transitions default to `linear`. The user can change them in the profile editor.
- Saving the conversion state (partially-configured boundaries) — the page is stateless; navigating away discards unsaved work.
