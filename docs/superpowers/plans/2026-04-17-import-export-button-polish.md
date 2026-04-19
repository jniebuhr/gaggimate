# Import/Export Button UI Polish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize import/export buttons to use `btn btn-sm btn-outline` with text+icon style (matching Beans page) across all pages.

**Architecture:** Change button class from `btn btn-ghost btn-sm` (icon-only) to `btn btn-sm btn-outline` (text+icon) in page headers. ShotAnalyzer's table-level buttons remain unchanged as they are contextual row-level actions, not primary page actions.

**Tech Stack:** Preact, Tailwind CSS, FontAwesome

---

## File Structure

| File | Change |
|------|--------|
| `web/src/pages/ProfileList/index.jsx` | Update import/export toolbar buttons to text+icon |
| `web/src/pages/Settings/index.jsx` | Update import/export header buttons to text+icon |

**Note:** ShotAnalyzer components (StatusBar, LibraryRow, LibrarySection, ShotChartControls) use icon-only buttons in table rows - these are contextual per-item actions, not page-level primary actions, so they remain unchanged.

---

## Task 1: ProfileList Page Import/Export Buttons

**Files:**
- Modify: `web/src/pages/ProfileList/index.jsx:913-930`

### Step 1: Update ProfileList toolbar buttons

**Before:**
```jsx
<Tooltip content='Export all profiles'>
  <button
    onClick={onExport}
    className='btn btn-ghost btn-sm'
    aria-label='Export all profiles'
  >
    <FontAwesomeIcon icon={faFileExport} />
  </button>
</Tooltip>
<Tooltip content='Import profiles'>
  <label
    htmlFor='profileImport'
    className='btn btn-ghost btn-sm cursor-pointer'
    aria-label='Import profiles'
  >
    <FontAwesomeIcon icon={faFileImport} />
  </label>
</Tooltip>
```

**After:**
```jsx
<button
  onClick={onExport}
  className='btn btn-sm btn-outline'
  disabled={profiles.length === 0}
>
  <FontAwesomeIcon icon={faFileExport} />
  Export Profiles
</button>
<button
  onClick={() => document.getElementById('profileImport')?.click()}
  className='btn btn-sm btn-outline'
>
  <FontAwesomeIcon icon={faFileImport} />
  Import Profiles
</button>
```

The `<input id='profileImport' type='file' ...>` element should remain as-is below the buttons (lines 931-938).

---

### Step 2: Verify button works correctly

Run: `grep -n "profileImport" web/src/pages/ProfileList/index.jsx`
Expected: Input element has `id='profileImport'` that the label/button can reference.

---

## Task 2: Settings Page Import/Export Buttons

**Files:**
- Modify: `web/src/pages/Settings/index.jsx:274-288`

### Step 1: Update Settings header buttons

**Before:**
```jsx
<button
  type='button'
  onClick={onExport}
  className='btn btn-ghost btn-sm'
  title='Export Settings'
>
  <FontAwesomeIcon icon={faFileExport} />
</button>
<label
  htmlFor='settingsImport'
  className='btn btn-ghost btn-sm cursor-pointer'
  title='Import Settings'
>
  <FontAwesomeIcon icon={faFileImport} />
</label>
```

**After:**
```jsx
<button
  type='button'
  onClick={onExport}
  className='btn btn-sm btn-outline'
>
  <FontAwesomeIcon icon={faFileExport} />
  Export Settings
</button>
<label
  htmlFor='settingsImport'
  className='btn btn-sm btn-outline cursor-pointer'
>
  <FontAwesomeIcon icon={faFileImport} />
  Import Settings
</label>
```

---

### Step 2: Verify button works correctly

Run: `grep -n "settingsImport" web/src/pages/Settings/index.jsx`
Expected: Input element has `id='settingsImport'` that the label can reference.

---

## Task 3: Verify consistency across pages

### Step 1: Check all import/export buttons match the standard

Run: `grep -rn "btn btn-sm btn-outline.*faFileExport\|btn btn-sm btn-outline.*faFileImport" web/src/pages/`
Expected: Beans, ProfileList, Settings all show `btn btn-sm btn-outline` with import/export buttons.

### Step 2: Visual verification

1. Start the dev server: `cd web && npm run dev`
2. Navigate to Beans, ProfileList, Settings pages
3. Verify all import/export buttons show text labels with icons
4. Confirm consistent styling across all three pages

ShotAnalyzer row-level export buttons (LibraryRow, LibrarySection) remain icon-only since they are per-item contextual actions in tables, not primary page actions.

---

## Task 3: ProfileList Per-Profile Export Fix

**Files:**
- Modify: `web/src/pages/ProfileList/index.jsx:95-104` (onDownload function in ProfileCard)

### Issue
The per-profile "Export" button in the kebab menu is not triggering a download. The `onDownload` function calls `downloadJson` directly without using `prepareDownload`, and may be missing proper error handling or may have incorrect data structure.

### Step 1: Investigate the onDownload function

Run: `grep -n "onDownload" web/src/pages/ProfileList/index.jsx`
Expected output shows onDownload defined at line 95 and used in two places (kebab menu and desktop inline actions).

### Step 2: Check if the issue is the download call

Current code at line 95-104:
```javascript
const onDownload = useCallback(() => {
  const download = {
    ...data,
  };
  delete download.id;
  delete download.selected;
  delete download.favorite;

  downloadJson(download, `profile-${data.id}.json`);
}, [data]);
```

Compare with the page-level export at line 756-775 which wraps in `prepareDownload`:
```javascript
const onExport = useCallback(() => {
  const exportedProfiles = profiles.map(p => {
    const ep = { ...p };
    delete ep.id;
    delete ep.selected;
    delete ep.favorite;
    return ep;
  });

  const download = prepareDownload('profiles.json');
  try {
    downloadJson(exportedProfiles, 'profiles.json', download);
  } catch (error) {
    download.fail(error);
    console.error('Failed to export profiles:', error);
    alert(`Profile export failed: ${error.message}`);
  }
}, [profiles]);
```

### Step 3: Fix the onDownload function to match the working pattern

**After:**
```javascript
const onDownload = useCallback(() => {
  const download = {
    ...data,
  };
  delete download.id;
  delete download.selected;
  delete download.favorite;

  const prepared = prepareDownload(`profile-${data.id}.json`);
  try {
    downloadJson(download, `profile-${data.id}.json`, prepared);
  } catch (error) {
    prepared.fail(error);
    console.error('Failed to export profile:', error);
    alert(`Profile export failed: ${error.message}`);
  }
}, [data]);
```

### Step 4: Test the fix

1. Navigate to ProfileList page
2. Find a profile with the kebab menu (or desktop inline actions)
3. Click Export on a single profile
4. Verify the JSON file downloads with correct profile data

---

## Summary of Changes

| Page | Before | After |
|------|--------|-------|
| ProfileList | `btn btn-ghost btn-sm` icon-only with Tooltip | `btn btn-sm btn-outline` with "Export Profiles" / "Import Profiles" |
| Settings | `btn btn-ghost btn-sm` icon-only with title | `btn btn-sm btn-outline` with "Export Settings" / "Import Settings" |
| ProfileList Export | `downloadJson(download, filename)` without error handling | `downloadJson(..., prepareDownload(...))` with try/catch and user alert |
| Beans | Already correct | No change needed |