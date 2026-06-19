# Skeleton Loading Placeholders — Design Spec

## Overview

Three dashboard cards (`RecentShotsCard`, `FavoriteProfilesCard`, `ProfileCard`) currently show nothing while data is loading. This spec adds shimmer skeleton placeholders that match each card's real layout, replacing the blank wait with immediate visual feedback.

---

## Shared Primitive: `SkeletonBlock`

**File:** `web/src/components/SkeletonBlock.jsx`

A single `<div>` that carries the shimmer CSS class and accepts a `className` prop for sizing and shape:

```jsx
export function SkeletonBlock({ className = '' }) {
  return <div className={`shimmer ${className}`} />;
}
```

All skeleton shapes in all three cards are composed from this one component.

---

## CSS — Shimmer Animation

**File:** `web/src/style.css` (global stylesheet)

Add after the existing theme blocks:

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

Uses DaisyUI v5 CSS custom properties (`--color-base-200`, `--color-base-300`) directly so the shimmer adapts to both light and dark themes automatically. The contrast between `base-200` and `base-300` provides the shimmer highlight without needing alpha.

---

## Unified Loading Pattern

All three cards use the same shape:

- A `boolean` `loading` state controls whether the skeleton renders.
- The data state starts at `null` (not `[]`), distinguishing "never fetched" from "fetched but empty."
- At the start of each fetch: `setLoading(true)`.
- On completion (success or error): `setLoading(false)`, update data state.

Render priority (same in all cards):
1. `loading === true` → skeleton
2. `loading === false && data === null` → `null` (hidden — not yet connected or no profile selected)
3. `loading === false && data` is empty → empty state or `null` depending on card
4. `loading === false && data` has content → real content

Initial values differ by card because different triggers start the first fetch:

| Card | `loading` initial | Data initial | Trigger |
|---|---|---|---|
| `RecentShotsCard` | `true` | `[]` (then used as empty check) | mount (always fetches) |
| `FavoriteProfilesCard` | `false` | `null` | `connected` becomes true |
| `ProfileCard` | `false` | `null` | `selectedProfileId` changes |

---

## RecentShotsCard

**State changes:**
- Add `const [loading, setLoading] = useState(true)`.

**Effect changes** (`useEffect` with `[refreshKey, slots]` deps):
- At the top of the effect body (before `load()`): `setLoading(true)`.
- In the `load` function's success path, after `setShots(list)`: `setLoading(false)`.
- In the outer `catch` block: `setLoading(false)`.

**Render logic** (replaces the current `if (shots.length === 0) return null`):

```jsx
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

**`ShotMiniCardSkeleton`** — private component in the same file, mirrors `ShotMiniCard` structure:

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
```

The skeleton card uses `flex-col` at all breakpoints (simpler than mirroring the mobile flex-row layout). It renders exactly `recentShotCountSignal.value` cards.

---

## FavoriteProfilesCard

**State changes:**
- Change `useState([])` to `useState(null)`.
- Add `const [loading, setLoading] = useState(false)`.

**Effect changes** (`useSignalEffect`):
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

**Render logic** (replaces `if (favorites.length === 0) return null`):

```jsx
if (loading) {
  // skeleton — 3 profile card shapes (compact: 3 pill shapes)
}
if (favorites === null) return null;
if (favorites.length === 0) {
  // empty state
}
// existing content unchanged
```

**Skeleton (normal mode):** 3 `bg-base-200 rounded-lg p-2` blocks matching `ProfileMiniCard` height (~90px each), composed from `SkeletonBlock` lines for name, description, and badge row.

**Skeleton (compact mode):** 3 `rounded-full` pill shapes (`h-7 w-20`) matching the compact button size.

**Empty state:**
```jsx
<div className='text-base-content/50 flex flex-col items-center gap-1 py-3 text-center text-sm'>
  <span className='text-lg'>★</span>
  <span>No favorites — mark profiles as ★ in the profile list</span>
</div>
```

The empty state is shown inside the card shell (same wrapper with the "Quick Select" label) so the card slot doesn't collapse entirely.

---

## ProfileCard

**State changes:**
- Add `const [profileLoading, setProfileLoading] = useState(false)`.

**Effect changes** (`useEffect` with `[selectedProfileId, apiService]`):
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
}, [selectedProfileId, apiService]);
```

**Render changes** — only the chart area (inside `inner`):

```jsx
{!compact && (
  profileLoading
    ? <SkeletonBlock
        className='mt-1 w-full rounded-xl'
        style={{ height: `${profileChartHeightSignal.value}px` }}
      />
    : profileData
      ? <ProcessProfileChart ... />
      : null
)}
```

The profile name and label continue rendering immediately. The skeleton matches the exact chart height from `profileChartHeightSignal` so the card doesn't shift in size when the chart loads.

`profileLoading` starts `false`, so no skeleton appears at initial paint (no profile selected yet). It only triggers when `selectedProfileId` is set and a fetch is in flight.

---

## Imports

Each card that uses `SkeletonBlock` adds:
```js
import { SkeletonBlock } from '../../../components/SkeletonBlock.jsx';
```

(Path adjusted to each file's location relative to `components/`.)
