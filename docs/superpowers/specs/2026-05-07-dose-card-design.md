# Dose Card Feature — Design Spec

## Context

Users want a quick way to set the grind dose (in grams) on the Home page before pulling a shot. The dose value should be persisted and automatically attached to shot records, with the same amount subtracted from the selected bean's remaining quantity.

## Design

### Layout

Dose card sits below the Bean card, inside the same right column of the Profile/Bean row.

```
Profile | Bean
        | Dose: [18.0g]  [−] [+]   ← 0.1g stepper + direct input
```

### Interactions

- **Click the bean name area** of the Bean card → opens bean selector popover (existing behavior, unchanged)
- **Click the dose number** → enables direct text input for precise values
- **Click [−]/[+] buttons** → decrements/increments by 0.1g steps

### State

- `doseGrams` state variable initialized from localStorage (key: `gaggimate-dose-grams`, default: `18.0`)
- Stored value: number (e.g., `18.0`), parsed with `parseQuantity`

### Data Flow

1. Dose stored in state → persists across sessions (localStorage)
2. On shot start (from Brew Process Controls), dose is passed as `doseIn` to the shot record
3. After shot completion, `syncBeanUsageFromNotes(previousNotes, nextNotes)` is called where `nextNotes.doseIn` equals the dose value
4. Bean `quantity` is reduced by the dose amount via existing `syncBeanUsageFromNotes` logic

### Integration Points

- **State**: `doseGrams` signal/state in `HomeModeCard.jsx`
- **Persistence**: localStorage key `gaggimate-dose-grams`
- **Shot recording**: dose passed to shot record via `doseIn` field
- **Bean quantity update**: existing `syncBeanUsageFromNotes` function handles subtraction

## Components

### DoseInput component (inline in HomeModeCard)

Renders dose display with stepper buttons:

```jsx
<div className="dose-input-row">
  <span className="dose-label">Dose</span>
  <input
    type="text"
    className="dose-value"
    value={`${doseGrams}g`}
    onClick={handleDoseClick}
  />
  <div className="dose-stepper">
    <button onClick={() => adjustDose(-0.1)}>−</button>
    <button onClick={() => adjustDose(0.1)}>+</button>
  </div>
</div>
```

Step increment: **0.1g**
Input validation: use `parseQuantity` — reject non-numeric, negative, or empty values

### Styling

Follow existing `nd-stat` patterns in `HomeModeCard.jsx`:
- Use `font-nd-mono` for dose value
- Stepper buttons match `nd-stepper-btn` style
- Container uses `nd-card`-adjacent styling (no border, inherits card background)

## Files to Modify

1. `web/src/pages/Home/HomeModeCard.jsx` — add dose state, DoseInput component, integrate into Bean card layout
2. `web/src/services/ApiService.js` or shot recording logic — ensure dose is passed as `doseIn` on shot start
3. `web/src/utils/beanManager.js` — already has `syncBeanUsageFromNotes`; integration point is the shot completion flow

## Out of Scope

- Bean quantity display on Home page (already exists elsewhere)
- Shot recording UI (Brew Process Controls already handles start/stop)
- Multiple dose profiles per bean