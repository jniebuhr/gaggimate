# Home Screen Cards — Reorder & Resize Design

**Date:** 2026-05-02
**Status:** Approved

---

## 1. Overview

Add drag-and-drop reordering and resize handles to the three Home screen cards (Process, Status, Chart). User can reorder any two cards by long-pressing (3s on touch) or dragging, and resize any card via a corner handle. Layout persists via localStorage.

---

## 2. Technology

- **@dnd-kit/core** + **@dnd-kit/sortable** for drag-and-drop
- **Preact Signals** for reactive layout state
- **localStorage** via existing `dashboardManager.js` for persistence
- No backend/device sync

---

## 3. Layout State

```js
export const dashboardLayout = signal({
  cards: [
    { id: 'process', cols: 1, rows: 1 },
    { id: 'status', cols: 1, rows: 1 },
    { id: 'chart', cols: 2, rows: 2 },
  ]
});
```

- `cols: 1-2` — card width in grid units
- `rows: 1-3` — card height in grid units
- Card order in array = visual order

---

## 4. Interactions

### Reorder (Drag & Drop)

- **Mouse:** Drag by grabbing card header
- **Touch:** Long-press (3s, tolerance 5px) initiates drag
- **Behavior:** Real-time swap — dragged card and target swap positions instantly as user drags over them; third card shifts accordingly
- **Dnd-kit config:** `PointerSensor` for mouse, `TouchSensor` with `{ delay: 300, tolerance: 5 }` for long-press
- **Collision:** `closestCenter` with `verticalListSortingStrategy`

### Resize

- **Trigger:** Hover over 16×16px resize handle (bottom-right corner)
- **Cursor:** `se-resize`
- **Handle:** Semi-transparent, visible but unobtrusive, appears on card hover
- **Size constraints:**
  - Width: 1–2 columns
  - Height: 1–3 rows
- **Touch:** Resize handle works the same on touch via tap

### Visual Feedback

- **Drag active:** Card lifts (shadow + scale 1.02)
- **Other cards:** Smooth 200ms ease-out CSS transition to new positions
- **Drop indicator:** Thin dashed line between cards at insertion point

---

## 5. Persistence

On every reorder or resize:
1. Serialize current `dashboardLayout` value to JSON
2. Store in `localStorage` via `dashboardManager.js`
3. On page load: restore from localStorage or fall back to defaults

**Default layout:**
- Row 1: Process | Status (1 col each)
- Row 2: Chart (2 cols, 2 rows)

---

## 6. Components

### `DashboardGrid` (wrapper)
- Wraps `DndContext` + `SortableContext`
- Renders CSS Grid container
- Applies responsive breakpoints

### `SortableCard` (per card)
- Wraps each `Card` component
- Applies `useSortable` hook from @dnd-kit/sortable
- Adds resize handle overlay
- Handles drag active state styling

### `ResizeHandle` (sub-component)
- 16×16px SVG corner handle
- Appears on parent card hover
- Triggers resize mode on pointer down

---

## 7. File Changes

| File | Change |
|------|--------|
| `web/src/pages/Home/index.jsx` | Integrate DashboardGrid, wire up signals |
| `web/src/components/Card.jsx` | Add `cols`/`rows` props, resize handle slot |
| `web/src/utils/dashboardManager.js` | Extend to store full layout object |
| `web/src/pages/Home/DashboardGrid.jsx` | New — DndContext + SortableContext |
| `web/src/pages/Home/SortableCard.jsx` | New — sortable wrapper with resize handle |
| `web/src/pages/Home/ResizeHandle.jsx` | New — resize grip component |

---

## 8. Out of Scope

- Device/embedded sync of layout
- Lock individual cards in place
- Horizontal resize (columns only — already implied by grid)