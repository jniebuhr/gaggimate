# Profile Move-to-Top / Move-to-Bottom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "move to top" and "move to bottom" actions to the Profiles page, allowing users to reposition a profile in a single action instead of repeated up/down clicks.

**Architecture:** Two new callback functions (`moveProfileToTop`, `moveProfileToBottom`) that splice the profile array to the desired index and persist via the existing `persistProfileOrder` mechanism. The same `req:profiles:reorder` API call is used — only the order array changes.

**Tech Stack:** React/Preact, FontAwesome icons, existing `ApiService` for backend persistence.

---

### Task 1: Add `moveProfileToTop` and `moveProfileToBottom` handlers

**Files:**
- Modify: `web/src/pages/ProfileList/index.jsx:573-602`

- [ ] **Step 1: Add `moveProfileToTop` function after `moveProfileDown`**

Find this code at line ~602:
```javascript
  const moveProfileDown = useCallback(
    id => {
      setProfiles(prev => {
        const idx = prev.findIndex(p => p.id === id);
        if (idx !== -1 && idx < prev.length - 1) {
          const next = [...prev];
          [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
          persistProfileOrder(next);
          return next;
        }
        return prev;
      });
    },
    [persistProfileOrder],
  );
```

Add after `moveProfileDown`:

```javascript
  const moveProfileToTop = useCallback(
    id => {
      setProfiles(prev => {
        const idx = prev.findIndex(p => p.id === id);
        if (idx > 0) {
          const next = [...prev];
          const [item] = next.splice(idx, 1);
          next.unshift(item);
          persistProfileOrder(next);
          return next;
        }
        return prev;
      });
    },
    [persistProfileOrder],
  );

  const moveProfileToBottom = useCallback(
    id => {
      setProfiles(prev => {
        const idx = prev.findIndex(p => p.id === id);
        if (idx !== -1 && idx < prev.length - 1) {
          const next = [...prev];
          const [item] = next.splice(idx, 1);
          next.push(item);
          persistProfileOrder(next);
          return next;
        }
        return prev;
      });
    },
    [persistProfileOrder],
  );
```

- [ ] **Step 2: Commit**

```bash
git add web/src/pages/ProfileList/index.jsx
git commit -m "feat(profiles): add move-to-top and move-to-bottom handlers"
```

---

### Task 2: Add "move to top" and "move to bottom" buttons to the ProfileCard

**Files:**
- Modify: `web/src/pages/ProfileList/index.jsx:69-82`
- Modify: `web/src/pages/ProfileList/index.jsx:415-435`
- Import new icons

- [ ] **Step 1: Add icons to the import list**

Find this block (lines 24-25):
```javascript
import { faArrowUp } from '@fortawesome/free-solid-svg-icons/faArrowUp';
import { faArrowDown } from '@fortawesome/free-solid-svg-icons/faArrowDown';
```

Replace with:
```javascript
import { faArrowUp } from '@fortawesome/free-solid-svg-icons/faArrowUp';
import { faArrowDown } from '@fortawesome/free-solid-svg-icons/faArrowDown';
import { faAnglesUp } from '@fortawesome/free-solid-svg-icons/faAnglesUp';
import { faAnglesDown } from '@fortawesome/free-solid-svg-icons/faAnglesDown';
```

- [ ] **Step 2: Update ProfileCard props to accept new handlers and disable logic**

Find the ProfileCard function signature (line 69-82):
```javascript
function ProfileCard({
  data,
  onDelete,
  onSelect,
  onFavorite,
  onUnfavorite,
  onDuplicate,
  favoriteDisabled,
  unfavoriteDisabled,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}) {
```

Update to:
```javascript
function ProfileCard({
  data,
  onDelete,
  onSelect,
  onFavorite,
  onUnfavorite,
  onDuplicate,
  favoriteDisabled,
  unfavoriteDisabled,
  onMoveUp,
  onMoveDown,
  onMoveToTop,
  onMoveToBottom,
  isFirst,
  isLast,
}) {
```

- [ ] **Step 3: Add the new buttons to the chart row section**

Find this section (lines 415-435):
```javascript
            <div className='flex items-center gap-2 mt-3 pt-3 border-t border-[var(--home-border,#222)]'>
              <div className='flex flex-col gap-1'>
                <button
                  onClick={() => onMoveUp(data.id)}
                  disabled={isFirst}
                  className='nd-action-btn'
                  style={{ width: '28px', height: '28px' }}
                  aria-label={`Move ${data.label} up`}
                >
                  <FontAwesomeIcon icon={faArrowUp} className='text-[10px]' />
                </button>
                <button
                  onClick={() => onMoveDown(data.id)}
                  disabled={isLast}
                  className='nd-action-btn'
                  style={{ width: '28px', height: '28px' }}
                  aria-label={`Move ${data.label} down`}
                >
                  <FontAwesomeIcon icon={faArrowDown} className='text-[10px]' />
                </button>
              </div>
```

Replace with:
```javascript
            <div className='flex items-center gap-2 mt-3 pt-3 border-t border-[var(--home-border,#222)]'>
              <div className='flex flex-col gap-1'>
                <button
                  onClick={() => onMoveToTop(data.id)}
                  disabled={isFirst}
                  className='nd-action-btn'
                  style={{ width: '28px', height: '28px' }}
                  aria-label={`Move ${data.label} to top`}
                >
                  <FontAwesomeIcon icon={faAnglesUp} className='text-[10px]' />
                </button>
                <button
                  onClick={() => onMoveToBottom(data.id)}
                  disabled={isLast}
                  className='nd-action-btn'
                  style={{ width: '28px', height: '28px' }}
                  aria-label={`Move ${data.label} to bottom`}
                >
                  <FontAwesomeIcon icon={faAnglesDown} className='text-[10px]' />
                </button>
                <div className='h-2' />
                <button
                  onClick={() => onMoveUp(data.id)}
                  disabled={isFirst}
                  className='nd-action-btn'
                  style={{ width: '28px', height: '28px' }}
                  aria-label={`Move ${data.label} up one position`}
                >
                  <FontAwesomeIcon icon={faArrowUp} className='text-[10px]' />
                </button>
                <button
                  onClick={() => onMoveDown(data.id)}
                  disabled={isLast}
                  className='nd-action-btn'
                  style={{ width: '28px', height: '28px' }}
                  aria-label={`Move ${data.label} down one position`}
                >
                  <FontAwesomeIcon icon={faArrowDown} className='text-[10px]' />
                </button>
              </div>
```

Note: The single-step up/down buttons are kept below the to-top/to-bottom buttons. Disabled state (`isFirst`/`isLast`) remains the same — a profile at the first position can't move up or to top; at the last position can't move down or to bottom.

- [ ] **Step 3: Pass new handlers from ProfileList to ProfileCard**

Find the ProfileCard usage in the map (around line 860):
```javascript
              <ProfileCard
                key={data.id}
                data={data}
                onDelete={onDelete}
                onSelect={onSelect}
                favoriteDisabled={favoriteDisabled}
                unfavoriteDisabled={unfavoriteDisabled}
                onUnfavorite={onUnfavorite}
                onFavorite={onFavorite}
                onDuplicate={onDuplicate}
                onMoveUp={moveProfileUp}
                onMoveDown={moveProfileDown}
                isFirst={idx === 0}
                isLast={idx === filtered.length - 1}
              />
```

Add the new props:
```javascript
              <ProfileCard
                key={data.id}
                data={data}
                onDelete={onDelete}
                onSelect={onSelect}
                favoriteDisabled={favoriteDisabled}
                unfavoriteDisabled={unfavoriteDisabled}
                onUnfavorite={onUnfavorite}
                onFavorite={onFavorite}
                onDuplicate={onDuplicate}
                onMoveUp={moveProfileUp}
                onMoveDown={moveProfileDown}
                onMoveToTop={moveProfileToTop}
                onMoveToBottom={moveProfileToBottom}
                isFirst={idx === 0}
                isLast={idx === filtered.length - 1}
              />
```

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/ProfileList/index.jsx
git commit -m "feat(profiles): add to-top and to-bottom move buttons in ProfileCard"
```

---

### Task 3: Add the mobile popover menu entries

**Files:**
- Modify: `web/src/pages/ProfileList/index.jsx:264-323`

- [ ] **Step 1: Add "Move to Top" and "Move to Bottom" to the mobile popover menu**

Find the popover menu `<ul>` section inside ProfileCard (lines 264-323). Add new list items after the existing actions:

```javascript
                    <li>
                      <button
                        onClick={() => { onMoveToTop(data.id); closeMenu(); }}
                        disabled={isFirst}
                        className={`w-full text-left font-nd-mono text-[13px] px-3 py-2 rounded flex items-center gap-2 ${isFirst ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[rgba(255,255,255,0.04)]'}`}
                      >
                        <FontAwesomeIcon icon={faAnglesUp} />
                        Move to Top
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => { onMoveToBottom(data.id); closeMenu(); }}
                        disabled={isLast}
                        className={`w-full text-left font-nd-mono text-[13px] px-3 py-2 rounded flex items-center gap-2 ${isLast ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[rgba(255,255,255,0.04)]'}`}
                      >
                        <FontAwesomeIcon icon={faAnglesDown} />
                        Move to Bottom
                      </button>
                    </li>
```

Add these before the "Duplicate" item (around line 305).

- [ ] **Step 2: Commit**

```bash
git add web/src/pages/ProfileList/index.jsx
git commit -m "feat(profiles): add to-top/bottom actions in mobile popover menu"
```

---

### Task 4: Test manually

- [ ] **Step 1: Verify the build compiles**

Run: `cd web && npm run build` (or your project's build command)
Expected: No errors

- [ ] **Step 2: Manual smoke test**

1. Open the Profiles page
2. Verify up/down arrow buttons are visible in the chart row
3. Verify to-top/to-bottom buttons (angled arrows) are visible
4. Click "Move to Bottom" on the first profile — it should jump to the end
5. Click "Move to Top" on the last profile — it should jump to the beginning
6. Open the mobile popover and verify "Move to Top" and "Move to Bottom" appear there too
7. Reload the page — verify order persists (backend reorder API is working)
