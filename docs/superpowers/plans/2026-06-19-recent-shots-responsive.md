# Recent Shots Responsive Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the recent shots count configurable (1–8, default 4) and the grid responsive — auto-fill columns at sm+, single-column horizontal cards on mobile.

**Architecture:** Three isolated changes: (1) add the signal/localStorage setting to dashboardManager, (2) wire the signal into RecentShotsCard and update its layout, (3) add the slider to DashboardSettings. No new files needed.

**Tech Stack:** Preact 10, @preact/signals, Tailwind CSS v4, DaisyUI v5, localStorage

---

### Task 1: Add `recentShotCount` setting to dashboardManager.js

**Files:**
- Modify: `web/src/utils/dashboardManager.js`

- [ ] **Step 1: Append the new setting block after the clock 24h section (end of file)**

Open `web/src/utils/dashboardManager.js`. After the `setClock24h` export at the bottom, add:

```js
// ── Recent shot count ─────────────────────────────────────────────────────

const DASHBOARD_RECENT_SHOT_COUNT_KEY = 'dashboardRecentShotCount';

export const getRecentShotCount = () => {
  if (typeof window === 'undefined' || !window.localStorage) return 4;
  try {
    const stored = localStorage.getItem(DASHBOARD_RECENT_SHOT_COUNT_KEY);
    const n = stored ? parseInt(stored, 10) : 4;
    return Number.isFinite(n) && n >= 1 && n <= 8 ? n : 4;
  } catch {
    return 4;
  }
};

export const recentShotCountSignal = signal(getRecentShotCount());

export const setRecentShotCount = (n) => {
  if (!Number.isInteger(n) || n < 1 || n > 8) return false;
  try {
    localStorage.setItem(DASHBOARD_RECENT_SHOT_COUNT_KEY, String(n));
    recentShotCountSignal.value = n;
    return true;
  } catch {
    return false;
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add web/src/utils/dashboardManager.js
git commit -m "feat: add recentShotCount signal and localStorage setting"
```

---

### Task 2: Update RecentShotsCard — count, grid, and mobile layout

**Files:**
- Modify: `web/src/pages/Home/cards/RecentShotsCard.jsx`

- [ ] **Step 1: Add `recentShotCountSignal` to the import from dashboardManager**

Find this import at the top of `RecentShotsCard.jsx`:

```js
import {
  shotMetricSlotsSignal,
  clock24hSignal,
} from '../../../utils/dashboardManager.js';
```

Replace with:

```js
import {
  shotMetricSlotsSignal,
  clock24hSignal,
  recentShotCountSignal,
} from '../../../utils/dashboardManager.js';
```

- [ ] **Step 2: Wire the signal into the loading effect**

Find this line inside the `load` async function:

```js
const list = indexToShotList(parseBinaryIndex(buf)).slice(0, 4);
```

Replace with:

```js
const list = indexToShotList(parseBinaryIndex(buf)).slice(0, recentShotCountSignal.value);
```

Then find the `useEffect` dependency array:

```js
  }, [refreshKey, slots]);
```

Replace with:

```js
  }, [refreshKey, slots, recentShotCountSignal.value]);
```

- [ ] **Step 3: Update the outer grid className**

Find this line in the `RecentShotsCard` return:

```jsx
      <div className='grid grid-cols-4 gap-3'>
```

Replace with:

```jsx
      <div className='grid grid-cols-1 gap-3 sm:[grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]'>
```

- [ ] **Step 4: Restructure `ShotMiniCard` for mobile horizontal layout**

Replace the entire `ShotMiniCard` function with:

```jsx
function ShotMiniCard({ shot, slots }) {
  const analyzerUrl = `/analyzer/internal/${shot.id}`;
  const profileLabel = cleanName(shot.profile || 'Unknown');
  const dateLabel = formatShotDateTime(shot.timestamp, !clock24hSignal.value);

  return (
    <div className='app-card-surface bg-base-200 flex min-w-0 flex-row items-center gap-3 rounded-xl p-3 sm:flex-col sm:items-stretch lg:p-2.5 xl:p-3'>
      {/* Identity — left on mobile, top on sm+ */}
      <div className='flex min-w-0 flex-1 items-start gap-2'>
        <div className='min-w-0 flex-1'>
          <div className='text-base-content truncate text-sm font-semibold'>
            shot-{shot.id}
            <span className='text-base-content/45 ml-1.5 text-xs font-normal'>
              · {getRelativeDayLabel(shot.timestamp)}
            </span>
          </div>
          <div className='text-base-content/60 truncate text-xs'>{profileLabel}</div>
          {/* Date shown below profile on mobile only */}
          <div className='mt-0.5 sm:hidden'>
            <span className='text-base-content/45 text-xs italic'>{dateLabel}</span>
          </div>
        </div>
        <a
          href={analyzerUrl}
          className='text-base-content/30 hover:text-primary shrink-0 text-xs transition-colors'
          aria-label='Open in Analyzer'
          title='Open in Analyzer'
        >
          <FontAwesomeIcon icon={faMagnifyingGlassChart} />
        </a>
      </div>

      {/* Metrics — right on mobile, below identity on sm+ */}
      <div className='flex gap-2 sm:mt-1.5 lg:gap-1.5 xl:gap-2'>
        {slots.map(slotId => {
          const def = METRIC_DEFS[slotId];
          const value = def ? def.getValue(shot) : null;
          return (
            <div key={slotId} className='min-w-0 flex-1 text-center'>
              <div className='flex items-baseline justify-center gap-1.5 lg:gap-1 xl:gap-1.5'>
                <span className='text-base-content text-sm font-bold'>
                  {value ?? '—'}
                </span>
                {value != null && def && (
                  <span className='text-base-content/55 text-xs lg:text-[0.68rem] xl:text-xs'>
                    {def.unit}
                  </span>
                )}
              </div>
              <div className='text-base-content/50 text-[0.6rem] font-semibold tracking-wider uppercase'>
                {def?.label ?? slotId}
              </div>
            </div>
          );
        })}
      </div>

      {/* Date shown below metrics on sm+ only */}
      <div className='mt-1 hidden sm:block'>
        <span className='text-base-content/45 text-xs italic'>{dateLabel}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify manually**

Start the dev server (`npm run dev` or equivalent in `web/`). Open the dashboard on a desktop browser:
- Recent shots should appear in a multi-column auto-fill grid
- Narrowing the browser window should reduce columns naturally
- Below ~640px the cards should stack vertically as horizontal rows (id+profile left, metrics right)

- [ ] **Step 6: Commit**

```bash
git add web/src/pages/Home/cards/RecentShotsCard.jsx
git commit -m "feat: responsive recent shots grid with configurable count"
```

---

### Task 3: Add "Max Recent Shots" slider to DashboardSettings

**Files:**
- Modify: `web/src/pages/DashboardSettings/index.jsx`

- [ ] **Step 1: Add `getRecentShotCount` and `setRecentShotCount` to the import**

Find this import block at the top of `DashboardSettings/index.jsx`:

```js
  getShowRecentShots, setShowRecentShots,
```

Replace with:

```js
  getShowRecentShots, setShowRecentShots,
  getRecentShotCount, setRecentShotCount,
```

- [ ] **Step 2: Add local state for the new setting**

Find this `useState` line:

```js
  const [showRecentShots,    setShowRecentShotsState]    = useState(() => getShowRecentShots());
```

Add a new line directly below it:

```js
  const [recentShotCount,    setRecentShotCountState]    = useState(() => getRecentShotCount());
```

- [ ] **Step 3: Add the slider inside the `showRecentShots` conditional block**

Find the opening of the conditional block:

```jsx
          {showRecentShots && (
            <SettingsFormField label='Shot Card Metrics' htmlFor='shotMetricSlot0' noMargin>
```

Replace with:

```jsx
          {showRecentShots && (
            <>
            <SettingsFormField label='Max Recent Shots' htmlFor='recentShotCount'>
              <div className='flex items-center gap-3'>
                <input
                  id='recentShotCount'
                  type='range'
                  min='1'
                  max='8'
                  step='1'
                  className='range range-primary range-sm flex-1'
                  value={recentShotCount}
                  onChange={e => {
                    const n = Number(e.target.value);
                    setRecentShotCountState(n);
                    setRecentShotCount(n);
                  }}
                />
                <span className='w-16 text-sm'>{recentShotCount} {recentShotCount === 1 ? 'shot' : 'shots'}</span>
              </div>
            </SettingsFormField>
            <SettingsFormField label='Shot Card Metrics' htmlFor='shotMetricSlot0' noMargin>
```

- [ ] **Step 4: Close the new fragment**

Find the closing of the conditional block (the line after the metric slot selectors `</SettingsFormField>`):

```jsx
            </SettingsFormField>
          )}
```

Replace with:

```jsx
            </SettingsFormField>
            </>
          )}
```

- [ ] **Step 5: Verify manually**

Open `/dashboard-settings`. Under "Show Recent Shots" (toggle must be on):
- A "Max Recent Shots" slider (1–8) should appear above the metric slot dropdowns
- Moving the slider should update the label ("1 shot", "4 shots", etc.)
- Navigating back to the dashboard should show the updated number of shot cards

- [ ] **Step 6: Commit**

```bash
git add web/src/pages/DashboardSettings/index.jsx
git commit -m "feat: add max recent shots count slider to dashboard settings"
```
