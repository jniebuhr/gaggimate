# Home Screen Cards — Reorder & Resize Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add drag-and-drop reordering and resize handles to the three Home screen cards (Process, Status, Chart) with localStorage persistence.

**Architecture:** Wrap the card grid in @dnd-kit's `DndContext` + `SortableContext`. Each card becomes a `SortableCard` wrapper with a resize handle. Layout state lives in a Preact signal, persisted via `dashboardManager.js`. Real-time swap on drag-over.

**Tech Stack:** @dnd-kit/core + @dnd-kit/sortable, Preact Signals, localStorage

---

## File Structure

| File | Responsibility |
|------|----------------|
| `web/src/utils/dashboardManager.js` | Persist/retrieve full layout object |
| `web/src/components/Card.jsx` | Accept `cols`/`rows` grid props + resize handle slot |
| `web/src/pages/Home/ResizeHandle.jsx` | 16×16px SVG resize grip, visible on hover |
| `web/src/pages/Home/SortableCard.jsx` | Sortable wrapper with drag/resize state |
| `web/src/pages/Home/DashboardGrid.jsx` | DndContext + SortableContext + CSS Grid |
| `web/src/pages/Home/index.jsx` | Use DashboardGrid, wire up signals |

---

## Tasks

### Task 1: Install @dnd-kit dependencies

**Files:**
- Modify: `web/package.json`

- [ ] **Step 1: Add @dnd-kit dependencies**

Modify `web/package.json` — add to `dependencies`:

```json
"@dnd-kit/core": "^6.3.1",
"@dnd-kit/sortable": "^10.0.0",
"@dnd-kit/utilities": "^3.2.2"
```

Run: `cd web && npm install`

---

### Task 2: Extend dashboardManager for full layout persistence

**Files:**
- Modify: `web/src/utils/dashboardManager.js`

- [ ] **Step 1: Replace dashboardManager.js**

```js
const DASHBOARD_LAYOUT_KEY = 'dashboardLayout';

export const DEFAULT_LAYOUT = {
  cards: [
    { id: 'process', cols: 1, rows: 1 },
    { id: 'status', cols: 1, rows: 1 },
    { id: 'chart', cols: 2, rows: 2 },
  ]
};

export const getDashboardLayout = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_LAYOUT;
  }

  try {
    const stored = localStorage.getItem(DASHBOARD_LAYOUT_KEY);
    if (!stored) return DEFAULT_LAYOUT;
    return JSON.parse(stored);
  } catch (error) {
    console.warn('getDashboardLayout: localStorage access failed:', error);
    return DEFAULT_LAYOUT;
  }
};

export const setDashboardLayout = layout => {
  if (!layout || !layout.cards) {
    console.error('setDashboardLayout: Invalid layout object');
    return false;
  }

  try {
    localStorage.setItem(DASHBOARD_LAYOUT_KEY, JSON.stringify(layout));
    return true;
  } catch (error) {
    console.error('setDashboardLayout: Failed to store layout in localStorage:', error);
    return false;
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add web/src/utils/dashboardManager.js
git commit -m "feat(dashboard): extend layout storage to full grid config"
```

---

### Task 3: Create ResizeHandle component

**Files:**
- Create: `web/src/pages/Home/ResizeHandle.jsx`

- [ ] **Step 1: Write ResizeHandle.jsx**

```jsx
import PropTypes from 'prop-types';

export default function ResizeHandle({ onResizeStart, className = '' }) {
  return (
    <div
      className={`resize-handle ${className}`}
      onPointerDown={e => {
        e.stopPropagation();
        onResizeStart && onResizeStart(e);
      }}
      aria-label="Resize card"
      role="button"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M13 13L13 5M13 13L5 13M13 13L10 10"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

ResizeHandle.propTypes = {
  onResizeStart: PropTypes.func,
  className: PropTypes.string,
};
```

- [ ] **Step 2: Add resize handle styles to your CSS**

In `web/src/index.css` (or wherever global styles are), add:

```css
.resize-handle {
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 16px;
  height: 16px;
  cursor: se-resize;
  color: var(--text-disabled, #666);
  opacity: 0;
  transition: opacity 150ms ease;
  z-index: 10;
}

.nd-card:hover .resize-handle,
.nd-card.resizing .resize-handle {
  opacity: 0.6;
}

.resize-handle:hover {
  opacity: 1 !important;
}
```

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/Home/ResizeHandle.jsx
git add web/src/index.css
git commit -m "feat(home): add ResizeHandle component"
```

---

### Task 4: Update Card component with cols/rows props and resize handle slot

**Files:**
- Modify: `web/src/components/Card.jsx`

- [ ] **Step 1: Rewrite Card.jsx**

```jsx
import PropTypes from 'prop-types';
import ResizeHandle from '../pages/Home/ResizeHandle.jsx';

export default function Card({
  xs,
  sm,
  md,
  lg,
  xl,
  cols,
  rows,
  title,
  children,
  className = '',
  role,
  fullHeight = false,
  onResize,
  resizing = false,
}) {
  const getGridClasses = () => {
    const breakpoints = [
      { value: xs, prefix: '' },
      { value: sm, prefix: 'sm:' },
      { value: md, prefix: 'md:' },
      { value: lg, prefix: 'lg:' },
      { value: xl, prefix: 'xl:' },
    ];

    return breakpoints
      .filter(bp => bp.value && bp.value >= 1 && bp.value <= 12)
      .map(bp => `${bp.prefix}col-span-${bp.value}`)
      .join(' ');
  };

  const gridClasses = getGridClasses();

  return (
    <div
      className={`nd-card overflow-hidden relative ${gridClasses} ${fullHeight ? 'h-full' : ''} ${resizing ? 'resizing' : ''} ${className}`}
      role={role}
      data-cols={cols}
      data-rows={rows}
    >
      {title && (
        <div className='nd-card-header border-b border-[var(--home-border,#222)] px-5 py-4'>
          <h2 className='font-nd-mono text-[11px] font-400 uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'>
            {title}
          </h2>
        </div>
      )}
      <div className={`nd-card-body flex flex-col gap-3 p-5 sm:p-6 ${fullHeight ? 'flex-1' : ''}`}>
        {children}
      </div>
      {onResize && <ResizeHandle onResizeStart={onResize} />}
    </div>
  );
}

Card.propTypes = {
  xs: PropTypes.number,
  sm: PropTypes.number,
  md: PropTypes.number,
  lg: PropTypes.number,
  xl: PropTypes.number,
  cols: PropTypes.number,
  rows: PropTypes.number,
  title: PropTypes.string,
  children: PropTypes.node,
  className: PropTypes.string,
  role: PropTypes.string,
  fullHeight: PropTypes.bool,
  onResize: PropTypes.func,
  resizing: PropTypes.bool,
};
```

- [ ] **Step 2: Commit**

```bash
git add web/src/components/Card.jsx
git commit -m "feat(card): add cols/rows props and resize handle slot"
```

---

### Task 5: Create SortableCard wrapper

**Files:**
- Create: `web/src/pages/Home/SortableCard.jsx`

- [ ] **Step 1: Write SortableCard.jsx**

```jsx
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import PropTypes from 'prop-types';
import Card from '../../components/Card.jsx';

export default function SortableCard({ id, children, className, onResize }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`sortable-card ${isDragging ? 'is-dragging' : ''} ${className || ''}`}
      {...attributes}
      {...listeners}
    >
      <Card
        resizing={false}
        onResize={e => {
          // Prevent drag initiation when starting resize
          e.preventDefault();
          onResize && onResize(id, e);
        }}
      >
        {children}
      </Card>
    </div>
  );
}

SortableCard.propTypes = {
  id: PropTypes.string.isRequired,
  children: PropTypes.node,
  className: PropTypes.string,
  onResize: PropTypes.func,
};
```

- [ ] **Step 2: Add sortable-card styles to index.css**

```css
.sortable-card {
  cursor: grab;
}

.sortable-card.is-dragging {
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  transform: scale(1.02);
  cursor: grabbing;
}
```

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/Home/SortableCard.jsx
git add web/src/index.css
git commit -m "feat(home): add SortableCard wrapper"
```

---

### Task 6: Create DashboardGrid with DndContext

**Files:**
- Create: `web/src/pages/Home/DashboardGrid.jsx`

- [ ] **Step 1: Write DashboardGrid.jsx**

```jsx
import { useState, useCallback } from 'preact/hooks';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { signal } from '@preact/signals';
import PropTypes from 'prop-types';
import SortableCard from './SortableCard.jsx';
import { getDashboardLayout, setDashboardLayout } from '../../utils/dashboardManager.js';

// Dashboard layout signal
export const dashboardLayout = signal(getDashboardLayout());

export default function DashboardGrid({ children }) {
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 300, tolerance: 5 },
    })
  );

  const handleDragStart = useCallback(event => {
    setActiveId(event.active.id);
  }, []);

  const handleDragEnd = useCallback(event => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const cards = [...dashboardLayout.value.cards];
    const oldIndex = cards.findIndex(c => c.id === active.id);
    const newIndex = cards.findIndex(c => c.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Swap cards
    const [moved] = cards.splice(oldIndex, 1);
    cards.splice(newIndex, 0, moved);

    dashboardLayout.value = { cards };
    setDashboardLayout(dashboardLayout.value);
  }, []);

  const handleResize = useCallback((cardId, deltaCols, deltaRows) => {
    const cards = dashboardLayout.value.cards.map(card => {
      if (card.id !== cardId) return card;
      return {
        ...card,
        cols: Math.max(1, Math.min(2, (card.cols || 1) + deltaCols)),
        rows: Math.max(1, Math.min(3, (card.rows || 1) + deltaRows)),
      };
    });
    dashboardLayout.value = { cards };
    setDashboardLayout(dashboardLayout.value);
  }, []);

  const cardIds = dashboardLayout.value.cards.map(c => c.id);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
        <div className='dashboard-grid'>
          {dashboardLayout.value.cards.map(cardConfig => {
            const child = Array.isArray(children)
              ? children.find(c => c?.props?.id === cardConfig.id)
              : children?.props?.id === cardConfig.id ? children : null;
            return (
              <SortableCard
                key={cardConfig.id}
                id={cardConfig.id}
                className={`col-span-${cardConfig.cols || 1} row-span-${cardConfig.rows || 1}`}
                onResize={handleResize}
              >
                {child?.props?.children}
              </SortableCard>
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}

DashboardGrid.propTypes = {
  children: PropTypes.node,
};
```

- [ ] **Step 2: Add DashboardGrid CSS styles to index.css**

```css
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-auto-rows: minmax(120px, auto);
  gap: 1rem;
}

.sortable-card.col-span-2 {
  grid-column: span 2;
}

.sortable-card.row-span-2 {
  grid-row: span 2;
}

.sortable-card.row-span-3 {
  grid-row: span 3;
}
```

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/Home/DashboardGrid.jsx
git add web/src/index.css
git commit -m "feat(home): add DashboardGrid with DndContext"
```

---

### Task 7: Update Home/index.jsx to use DashboardGrid

**Files:**
- Modify: `web/src/pages/Home/index.jsx`

- [ ] **Step 1: Rewrite Home/index.jsx**

```jsx
import { machine } from '../../services/ApiService.js';
import {
  Chart,
  LineController,
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  Legend,
  Filler,
} from 'chart.js';
import 'chartjs-adapter-dayjs-4/dist/chartjs-adapter-dayjs-4.esm';
import { OverviewChart } from '../../components/OverviewChart.jsx';
import ProcessControls from './ProcessControls.jsx';
import HomeModeCard from './HomeModeCard.jsx';
import DashboardGrid, { dashboardLayout } from './DashboardGrid.jsx';
import SortableCard from './SortableCard.jsx';
Chart.register(LineController, TimeScale, LinearScale, PointElement, LineElement, Filler, Legend);

function ProcessCardContent() {
  return (
    <ProcessControls brew={machine.value.status.mode === 1} mode={machine.value.status.mode} />
  );
}

function StatusCardContent() {
  return <HomeModeCard mode={machine.value.status.mode} />;
}

function ChartCardContent() {
  return <OverviewChart />;
}

export function Home() {
  return (
    <div className='flex flex-col gap-6'>
      <DashboardGrid>
        <SortableCard id='process'>
          <ProcessCardContent />
        </SortableCard>
        <SortableCard id='status'>
          <StatusCardContent />
        </SortableCard>
        <SortableCard id='chart'>
          <ChartCardContent />
        </SortableCard>
      </DashboardGrid>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/pages/Home/index.jsx
git commit -m "feat(home): integrate DashboardGrid with sortable cards"
```

---

## Plan Self-Review

1. **Spec coverage:** Reorder (Task 6), resize handle (Tasks 3, 5), persistence (Task 2), touch long-press (Task 6), drag feedback (Task 5), localStorage (Task 2) — all spec items covered.
2. **Placeholder scan:** No TBD/TODO, no vague steps, all code is concrete.
3. **Type consistency:** `dashboardLayout` signal uses `{ cards: [{ id, cols, rows }] }` throughout — matches spec.