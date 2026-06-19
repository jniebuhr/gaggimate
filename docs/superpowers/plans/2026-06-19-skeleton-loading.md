# Skeleton Loading Placeholders — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add shimmer skeleton placeholders to RecentShotsCard, FavoriteProfilesCard, and ProfileCard so users see immediate visual feedback while data loads.

**Architecture:** A single `SkeletonBlock` component wraps a `div` with a CSS shimmer class. Each card adds a `boolean` loading state and `null`-initialized data state; they render skeleton shapes while loading, an empty state or `null` when done with no data, and real content otherwise.

**Tech Stack:** Preact 10, `@preact/signals`, Tailwind CSS v4, DaisyUI v5

---

### Task 1: Add shimmer CSS

**Files:**
- Modify: `web/src/style.css`

- [ ] **Step 1: Add shimmer keyframes and class to the global stylesheet**

Open `web/src/style.css`. After the closing `}` of the last `@plugin "daisyui/theme"` block, append:

```css
@keyframes shimmer {
  0%   { background-position: -600px 0; }
  100% { background-position:  600px 0; }
}
.shimmer {
  background: linear-gradient(
    90deg,
    var(--color-base-200) 25%,
    var(--color-base-300) 50%,
    var(--color-base-200) 75%
  );
  background-size: 1200px 100%;
  animation: shimmer 1.8s linear infinite;
  border-radius: 0.375rem;
}
```

`--color-base-200` and `--color-base-300` are DaisyUI v5 CSS custom properties already defined in the theme blocks above. They resolve correctly for both light and dark themes.

- [ ] **Step 2: Commit**

```bash
git add web/src/style.css
git commit -m "feat: add shimmer skeleton CSS animation"
```

---

### Task 2: Create SkeletonBlock component

**Files:**
- Create: `web/src/components/SkeletonBlock.jsx`

- [ ] **Step 1: Create the file**

```jsx
import PropTypes from 'prop-types';

export function SkeletonBlock({ className = '' }) {
  return <div className={`shimmer ${className}`} />;
}

SkeletonBlock.propTypes = {
  className: PropTypes.string,
};
```

The `shimmer` class defined in Task 1 provides the animation. All sizing, shape, and margin is controlled by the caller via `className`.

- [ ] **Step 2: Commit**

```bash
git add web/src/components/SkeletonBlock.jsx
git commit -m "feat: add SkeletonBlock shared component"
```

---

### Task 3: RecentShotsCard — loading state and skeleton grid

**Files:**
- Modify: `web/src/pages/Home/cards/RecentShotsCard.jsx`

- [ ] **Step 1: Add import and loading state**

Add `SkeletonBlock` import at the top of the file (after the existing imports):

```js
import { SkeletonBlock } from '../../../components/SkeletonBlock.jsx';
```

In `RecentShotsCard`, add a loading state alongside the existing `shots` and `refreshKey` states:

```js
export function RecentShotsCard() {
  const [shots, setShots] = useState([]);
  const [loading, setLoading] = useState(true);   // ← add this line
  const [refreshKey, setRefreshKey] = useState(0);
  // ... rest unchanged
```

- [ ] **Step 2: Add ShotMiniCardSkeleton component**

Add this component directly above the `RecentShotsCard` function (after the existing `ShotMiniCard` component):

```jsx
function ShotMiniCardSkeleton({ slots }) {
  return (
    <div className='bg-base-200 flex min-w-0 flex-col gap-2 rounded-xl p-3'>
      <SkeletonBlock className='h-2.5 w-3/4' />
      <SkeletonBlock className='h-2 w-1/2' />
      <div className='flex gap-2 mt-1'>
        {slots.map((_, i) => (
          <div key={i} className='flex flex-1 flex-col items-center gap-1'>
            <SkeletonBlock className='h-3.5 w-7' />
            <SkeletonBlock className='h-2 w-6' />
          </div>
        ))}
      </div>
      <SkeletonBlock className='h-2 w-3/5' />
    </div>
  );
}

ShotMiniCardSkeleton.propTypes = {
  slots: PropTypes.arrayOf(PropTypes.string).isRequired,
};
```

- [ ] **Step 3: Update the useEffect to manage loading state**

In the `useEffect` body (the one with `[refreshKey, slots]` deps), add `setLoading(true)` right after `let cancelled = false;`, and add `setLoading(false)` in two places inside the `load` async function:

```js
useEffect(() => {
  let cancelled = false;
  setLoading(true);              // ← reset loading on every refresh

  const load = async () => {
    try {
      const resp = await fetch('/api/history/index.bin');
      if (cancelled) return;
      if (!resp.ok) { setLoading(false); return; }   // ← bad response: clear skeleton
      const buf = await resp.arrayBuffer();
      const list = indexToShotList(parseBinaryIndex(buf)).slice(0, recentShotCountSignal.value);
      if (cancelled) return;
      setShots(list);
      setLoading(false);         // ← show real cards as soon as index is parsed

      // ... sequential slog loading continues unchanged below ...
```

Also add `setLoading(false)` in the outer catch:

```js
    } catch {
      setLoading(false);         // ← don't leave skeleton up on index fetch failure
    }
  };

  load();
  return () => { cancelled = true; };
}, [refreshKey, slots]);
```

Note: `setLoading(false)` fires after the index is parsed and `setShots` is called, not after all slogs finish loading. This shows real shot cards quickly; metric values fill in progressively as slogs load sequentially.

- [ ] **Step 4: Replace the early-return with loading + skeleton render**

Replace:
```js
if (shots.length === 0) return null;
```

With:
```js
if (loading) {
  return (
    <div className='card bg-base-100 flex flex-col gap-2 rounded-xl p-3'>
      <SkeletonBlock className='h-2 w-20' />
      <div className='grid grid-cols-1 gap-3 sm:[grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]'>
        {Array.from({ length: recentShotCountSignal.value }).map((_, i) => (
          <ShotMiniCardSkeleton key={i} slots={slots} />
        ))}
      </div>
    </div>
  );
}
if (shots.length === 0) return null;
```

The skeleton renders the same grid class as the real card and shows exactly `recentShotCountSignal.value` placeholder cards so the layout doesn't shift when content arrives.

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/Home/cards/RecentShotsCard.jsx
git commit -m "feat: add shimmer skeleton loading to RecentShotsCard"
```

---

### Task 4: FavoriteProfilesCard — loading state and empty state

**Files:**
- Modify: `web/src/pages/Home/cards/FavoriteProfilesCard.jsx`

- [ ] **Step 1: Add import, change favorites initial value, add loading state**

Add `SkeletonBlock` import:

```js
import { SkeletonBlock } from '../../../components/SkeletonBlock.jsx';
```

In `FavoriteProfilesCard`, change the `favorites` initial value and add `loading`:

```js
export function FavoriteProfilesCard({ selectedProfileId, inCard = false, compact = false }) {
  const apiService = useContext(ApiServiceContext);
  const [favorites, setFavorites] = useState(null);    // ← was useState([])
  const [loading, setLoading] = useState(false);        // ← add this line
```

`null` means "never fetched". `[]` means "fetched, but no favorites found". This distinction drives the empty state below.

- [ ] **Step 2: Update useSignalEffect to set loading**

Replace the existing `useSignalEffect`:

```js
useSignalEffect(() => {
  if (!apiService || !connected.value) return;
  setLoading(true);
  apiService
    .request({ tp: 'req:profiles:list' })
    .then(res => {
      setFavorites((res.profiles ?? []).filter(p => p.favorite).slice(0, 3));
      setLoading(false);
    })
    .catch(() => setLoading(false));
});
```

- [ ] **Step 3: Replace render logic**

The existing component has this structure after the hooks:

```js
const handleSelect = id => { ... };

if (favorites.length === 0) return null;

const content = compact ? (...) : (...);
return (...);
```

Replace `if (favorites.length === 0) return null;` with the full new render path. Insert before the `const content = ...` line:

```jsx
const wrapperClass = inCard ? 'flex flex-col gap-2' : 'card bg-base-100 flex flex-col gap-2 rounded-xl p-3';

if (loading) {
  return (
    <div className={wrapperClass}>
      <SkeletonBlock className='h-2 w-20' />
      {compact ? (
        <div className='flex gap-1.5'>
          {[0, 1, 2].map(i => <SkeletonBlock key={i} className='h-7 w-20 rounded-full' />)}
        </div>
      ) : (
        <div className='grid grid-cols-3 gap-2'>
          {[0, 1, 2].map(i => <SkeletonBlock key={i} className='h-24 rounded-lg' />)}
        </div>
      )}
    </div>
  );
}

if (favorites === null) return null;

if (favorites.length === 0) {
  return (
    <div className={wrapperClass}>
      <div className='text-base-content/50 text-[0.6rem] uppercase tracking-wider'>Quick Select</div>
      <div className='text-base-content/50 flex flex-col items-center gap-1 py-3 text-center text-sm'>
        <span className='text-lg'>★</span>
        <span>No favorites — mark profiles as ★ in the profile list</span>
      </div>
    </div>
  );
}
```

Also update the `return` at the bottom of the component to use `wrapperClass` instead of the inline ternary:

```jsx
return (
  <div className={wrapperClass}>
    <div className='text-base-content/50 text-[0.6rem] uppercase tracking-wider'>Quick Select</div>
    {content}
  </div>
);
```

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/Home/cards/FavoriteProfilesCard.jsx
git commit -m "feat: add shimmer skeleton and empty state to FavoriteProfilesCard"
```

---

### Task 5: ProfileCard — chart area skeleton

**Files:**
- Modify: `web/src/pages/Home/cards/ProfileCard.jsx`

- [ ] **Step 1: Add import and profileLoading state**

Add `SkeletonBlock` import:

```js
import { SkeletonBlock } from '../../../components/SkeletonBlock.jsx';
```

In `ProfileCard`, add `profileLoading` state alongside the existing `profileData`:

```js
const [profileData, setProfileData] = useState(null);
const [profileLoading, setProfileLoading] = useState(false);
```

`profileLoading` starts `false` because no profile is selected at initial render — the skeleton only appears when a profile fetch is actually in flight.

- [ ] **Step 2: Update useEffect to manage profileLoading**

Replace the existing `useEffect`:

```js
useEffect(() => {
  if (!selectedProfileId || !apiService) { setProfileData(null); return; }
  setProfileLoading(true);
  apiService
    .request({ tp: 'req:profiles:load', id: selectedProfileId })
    .then(res => {
      setProfileData(res.profile?.type === 'pro' ? res.profile : null);
      setProfileLoading(false);
    })
    .catch(() => {
      setProfileData(null);
      setProfileLoading(false);
    });
}, [selectedProfileId, apiService]); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 3: Update the chart area in `inner`**

The current chart area inside `inner` is:

```jsx
{!compact && profileData && (
  <ProcessProfileChart
    data={profileData}
    processInfo={processInfo}
    className='mt-1 w-full'
    style={{ height: `${profileChartHeightSignal.value}px` }}
  />
)}
```

Replace with:

```jsx
{!compact && (
  profileLoading ? (
    <SkeletonBlock
      className='mt-1 w-full rounded-xl'
      style={{ height: `${profileChartHeightSignal.value}px` }}
    />
  ) : profileData ? (
    <ProcessProfileChart
      data={profileData}
      processInfo={processInfo}
      className='mt-1 w-full'
      style={{ height: `${profileChartHeightSignal.value}px` }}
    />
  ) : null
)}
```

The skeleton uses the same `height` as the real chart so the card doesn't shift in size when data arrives.

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/Home/cards/ProfileCard.jsx
git commit -m "feat: add shimmer skeleton to ProfileCard chart area"
```
