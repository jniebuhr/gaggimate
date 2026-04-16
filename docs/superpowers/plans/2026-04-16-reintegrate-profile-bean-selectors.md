# Make Header Stat Pills Interactive

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Header stat pills clickable so users can quickly change Profile, Bean, and Temperature directly from the header without needing to navigate to separate pages.

**Architecture:** Add click handlers to the `StatPill` components in Header.jsx that open a quick-select popover/modal. When clicked, Profile shows a dropdown of available profiles, Bean shows a dropdown of available beans, and Temp/Pressure shows a simple +/- control. The popovers appear anchored to the pill with smooth transitions.

**Tech Stack:** Preact, Tailwind CSS, daisyUI, FontAwesome icons

---

## API Messages Needed

From existing code analysis:
- Profile selection: `apiService.request({ tp: 'req:profiles:select', id: profileId })`
- Bean selection: `apiService.send({ tp: 'req:beans:select', name: beanName })`
- Temperature: `apiService.send({ tp: 'req:raise-temp' })` and `apiService.send({ tp: 'req:lower-temp' })`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `web/src/components/Header.jsx` | Main header with StatPills - add click handlers and popovers |
| `web/src/hooks/useProfileData.js` | Already has `req:profiles:list` - use to get profile options |
| `web/src/utils/beanManager.js` | Already has `req:beans:list` - use to get bean options |

---

## Task 1: Add Click Handlers to StatPills

**Files:**
- Modify: `web/src/components/Header.jsx:29-53`

**Steps:**

- [ ] **Step 1: Add `onClick` prop to StatPill component**

Modify the `StatPill` component to accept an optional `onClick` prop and make it cursor-pointer when clickable:

```jsx
function StatPill({ label, value, tone = 'neutral', icon, onClick }) {
  const toneClasses = {
    neutral: 'border-base-300/60 bg-base-100/90 text-base-content',
    accent: 'border-primary/25 bg-primary/12 text-primary',
    success: 'border-success/25 bg-success/12 text-success',
    secondary: 'border-secondary/25 bg-secondary/12 text-secondary',
    error: 'border-error/25 bg-error/12 text-error',
    warning: 'border-warning/25 bg-warning/12 text-warning-content',
    purple: 'border-purple-500/25 bg-purple-500/12 text-purple-500',
  };

  const clickableClass = onClick ? 'cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all duration-200' : '';

  return (
    <div
      onClick={onClick}
      className={`stat-pill status-indicator-card flex-1 min-w-0 rounded-2xl border px-4 py-3 shadow-[0_10px_25px_-18px_rgba(0,0,0,0.9)] backdrop-blur ${toneClasses[tone]} ${clickableClass}`}
    >
```

- [ ] **Step 2: Add popover state and handlers to Header component**

Add after the existing `useState` declarations in `Header` function (around line 74):

```jsx
const [activePopover, setActivePopover] = useState(null); // 'profile' | 'bean' | 'temp' | null
const [profileOptions, setProfileOptions] = useState([]);
const [beanOptions, setBeanOptions] = useState([]);
const [loadingProfiles, setLoadingProfiles] = useState(false);
const [loadingBeans, setLoadingBeans] = useState(false);

// Close popover when clicking outside
useEffect(() => {
  if (!activePopover) return;

  const handleClickOutside = (e) => {
    if (!e.target.closest('.stat-pill-popover') && !e.target.closest('.stat-pill-clickable')) {
      setActivePopover(null);
    }
  };

  document.addEventListener('click', handleClickOutside);
  return () => document.removeEventListener('click', handleClickOutside);
}, [activePopover]);
```

- [ ] **Step 3: Add handlers for loading options**

```jsx
// Load profile options when profile popover opens
const loadProfileOptions = useCallback(async () => {
  if (profileOptions.length > 0) return;
  setLoadingProfiles(true);
  try {
    const response = await apiService.request({ tp: 'req:profiles:list' });
    setProfileOptions(response.profiles || []);
  } catch (err) {
    console.error('Failed to load profiles:', err);
  } finally {
    setLoadingProfiles(false);
  }
}, [apiService, profileOptions.length]);

// Load bean options when bean popover opens
const loadBeanOptions = useCallback(async () => {
  if (beanOptions.length > 0) return;
  setLoadingBeans(true);
  try {
    const beans = await import('../utils/beanManager.js').then(m => m.listBeans(apiService));
    setBeanOptions(beans || []);
  } catch (err) {
    console.error('Failed to load beans:', err);
  } finally {
    setLoadingBeans(false);
  }
}, [apiService, beanOptions.length]);
```

- [ ] **Step 4: Add click handlers for each StatPill**

```jsx
const handleProfileClick = useCallback(() => {
  loadProfileOptions();
  setActivePopover(activePopover === 'profile' ? null : 'profile');
}, [activePopover, loadProfileOptions]);

const handleBeanClick = useCallback(() => {
  loadBeanOptions();
  setActivePopover(activePopover === 'bean' ? null : 'bean');
}, [activePopover, loadBeanOptions]);

const handleTempClick = useCallback(() => {
  setActivePopover(activePopover === 'temp' ? null : 'temp');
}, [activePopover]);
```

- [ ] **Step 5: Add selection handlers**

```jsx
const handleProfileSelect = useCallback(async (profileId) => {
  try {
    await apiService.request({ tp: 'req:profiles:select', id: profileId });
    setActivePopover(null);
  } catch (err) {
    console.error('Failed to select profile:', err);
  }
}, [apiService]);

const handleBeanSelect = useCallback((beanName) => {
  apiService.send({ tp: 'req:beans:select', name: beanName });
  setActivePopover(null);
}, [apiService]);

const handleTempChange = useCallback((delta) => {
  apiService.send({ tp: delta > 0 ? 'req:raise-temp' : 'req:lower-temp' });
}, [apiService]);
```

- [ ] **Step 6: Update StatPill renders to add onClick and identifiers**

Replace the Profile and Bean StatPills with clickable versions:

```jsx
<StatPill
  label='Profile'
  value={profileLabel}
  tone='secondary'
  icon={faBookmark}
  onClick={handleProfileClick}
/>
<StatPill
  label='Active Bean'
  value={activeBean?.beanName || 'Not selected'}
  tone='purple'
  icon={faLeaf}
  onClick={handleBeanClick}
/>
<StatPill
  label='Temp / Pressure'
  value={`${temp} · ${pressure}`}
  tone='error'
  icon={faTemperatureHigh}
  onClick={handleTempClick}
/>
```

- [ ] **Step 7: Commit**

```bash
git add web/src/components/Header.jsx
git commit -m "feat: make header stat pills clickable"
```

---

## Task 2: Add Popover UI Components

**Files:**
- Modify: `web/src/components/Header.jsx:108-260`

**Steps:**

- [ ] **Step 1: Add ProfilePopover component**

Add before the `Header` function (around line 73):

```jsx
const ProfilePopover = ({ profiles, selectedProfileId, onSelect, loading }) => (
  <div className='stat-pill-popover absolute top-full left-1/2 -translate-x-1/2 mt-3 z-50 min-w-[220px] rounded-2xl border border-base-300/60 bg-base-100/95 p-4 shadow-[0_25px_60px_-20px_rgba(0,0,0,0.95)] backdrop-blur-xl'>
    <div className='mb-4 flex items-center gap-2 border-b border-base-300/40 pb-3'>
      <span className='flex size-8 items-center justify-center rounded-xl border border-secondary/20 bg-secondary/10'>
        <FontAwesomeIcon icon={faBookmark} className='text-sm text-secondary' />
      </span>
      <span className='text-sm font-semibold uppercase tracking-wider text-base-content/70'>Select Profile</span>
    </div>
    {loading ? (
      <div className='flex items-center justify-center py-8'>
        <span className='loading loading-spinner loading-md text-primary' />
      </div>
    ) : (
      <div className='space-y-1 max-h-56 overflow-y-auto pr-1 custom-scrollbar'>
        {profiles.map(profile => (
          <button
            key={profile.id}
            onClick={() => onSelect(profile.id)}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
              profile.id === selectedProfileId
                ? 'bg-secondary/15 text-secondary border border-secondary/30 shadow-sm'
                : 'hover:bg-base-content/5 text-base-content/80 border border-transparent hover:border-base-300/30'
            }`}
          >
            <span className='flex items-center gap-2'>
              <FontAwesomeIcon icon={faRectangleList} className='text-xs opacity-50' />
              {profile.name || profile.id}
            </span>
          </button>
        ))}
      </div>
    )}
  </div>
);
```

- [ ] **Step 2: Add BeanPopover component**

```jsx
const BeanPopover = ({ beans, activeBean, onSelect, loading }) => (
  <div className='stat-pill-popover absolute top-full left-1/2 -translate-x-1/2 mt-3 z-50 min-w-[220px] rounded-2xl border border-base-300/60 bg-base-100/95 p-4 shadow-[0_25px_60px_-20px_rgba(0,0,0,0.95)] backdrop-blur-xl'>
    <div className='mb-4 flex items-center gap-2 border-b border-base-300/40 pb-3'>
      <span className='flex size-8 items-center justify-center rounded-xl border border-secondary/20 bg-secondary/10'>
        <FontAwesomeIcon icon={faLeaf} className='text-sm text-secondary' />
      </span>
      <span className='text-sm font-semibold uppercase tracking-wider text-base-content/70'>Select Bean</span>
    </div>
    {loading ? (
      <div className='flex items-center justify-center py-8'>
        <span className='loading loading-spinner loading-md text-secondary' />
      </div>
    ) : (
      <div className='space-y-1 max-h-56 overflow-y-auto pr-1 custom-scrollbar'>
        {beans.map(bean => (
          <button
            key={bean.id}
            onClick={() => onSelect(bean.name)}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
              bean.id === activeBean?.beanId
                ? 'bg-purple-500/15 text-purple-500 border border-purple-500/30 shadow-sm'
                : 'hover:bg-base-content/5 text-base-content/80 border border-transparent hover:border-base-300/30'
            }`}
          >
            <span className='flex items-center gap-2'>
              <FontAwesomeIcon icon={faLeaf} className='text-xs opacity-50' />
              {bean.name}
            </span>
          </button>
        ))}
      </div>
    )}
  </div>
);
```

- [ ] **Step 3: Add TempPopover component**

```jsx
const TempPopover = ({ currentTemp, targetTemp, onChange }) => (
  <div className='stat-pill-popover absolute top-full left-1/2 -translate-x-1/2 mt-3 z-50 w-56 rounded-2xl border border-base-300/60 bg-base-100/95 p-5 shadow-[0_25px_60px_-20px_rgba(0,0,0,0.95)] backdrop-blur-xl'>
    <div className='mb-5 flex items-center gap-2 border-b border-base-300/40 pb-3'>
      <span className='flex size-8 items-center justify-center rounded-xl border border-error/20 bg-error/10'>
        <FontAwesomeIcon icon={faTemperatureHigh} className='text-sm text-error' />
      </span>
      <span className='text-sm font-semibold uppercase tracking-wider text-base-content/70'>Temperature</span>
    </div>

    <div className='flex items-center justify-between gap-3'>
      <button
        onClick={() => onChange(-1)}
        className='btn btn-circle btn-lg border-2 border-primary bg-primary/10 hover:bg-primary/20 hover:border-primary text-primary shadow-md transition-all duration-200 hover:scale-105'
      >
        <FontAwesomeIcon icon={faMinus} className='text-xl' />
      </button>

      <div className='flex flex-col items-center'>
        <div className='text-3xl font-bold text-base-content tracking-tight'>{targetTemp}</div>
        <div className='text-xs font-medium uppercase tracking-wider text-base-content/50'>Target °C</div>
        <div className='mt-1 text-xs text-base-content/40'>Current: {currentTemp.toFixed(1)}°C</div>
      </div>

      <button
        onClick={() => onChange(1)}
        className='btn btn-circle btn-lg border-2 border-primary bg-primary/10 hover:bg-primary/20 hover:border-primary text-primary shadow-md transition-all duration-200 hover:scale-105'
      >
        <FontAwesomeIcon icon={faPlus} className='text-xl' />
      </button>
    </div>

    <div className='mt-4 grid grid-cols-3 gap-1 text-center text-xs'>
      <button
        onClick={() => onChange(-5)}
        className='rounded-lg border border-base-300/40 bg-base-100/50 py-2 font-medium text-base-content/60 hover:bg-base-content/5 hover:text-base-content transition-colors'
      >
        -5
      </button>
      <button
        onClick={() => onChange(5)}
        className='rounded-lg border border-base-300/40 bg-base-100/50 py-2 font-medium text-base-content/60 hover:bg-base-content/5 hover:text-base-content transition-colors'
      >
        +5
      </button>
      <button
        onClick={() => onChange(-10)}
        className='rounded-lg border border-base-300/40 bg-base-100/50 py-2 font-medium text-base-content/60 hover:bg-base-content/5 hover:text-base-content transition-colors'
      >
        -10
      </button>
    </div>
  </div>
);
```

- [ ] **Step 4: Add popover positioning in the Header JSX**

In the header's center stats section, wrap each clickable StatPill in a relative container:

```jsx
<div className='hidden min-w-0 items-center gap-2 lg:flex'>
  {/* Connection - not clickable */}
  <StatPill label='Connection' value={connected ? 'Online' : 'Offline'} tone={connected ? 'success' : 'warning'} icon={faPlugCircleBolt} />

  {/* Mode - not clickable */}
  <StatPill label='Mode' value={currentMode} tone='accent' icon={faSliders} />

  {/* Profile - clickable */}
  <div className='relative'>
    <StatPill label='Profile' value={profileLabel} tone='secondary' icon={faBookmark} onClick={handleProfileClick} />
    {activePopover === 'profile' && (
      <ProfilePopover
        profiles={profileOptions}
        selectedProfileId={machine.value.status.selectedProfileId}
        onSelect={handleProfileSelect}
        loading={loadingProfiles}
      />
    )}
  </div>

  {/* Bean - clickable */}
  <div className='relative'>
    <StatPill label='Active Bean' value={activeBean?.beanName || 'Not selected'} tone='purple' icon={faLeaf} onClick={handleBeanClick} />
    {activePopover === 'bean' && (
      <BeanPopover
        beans={beanOptions}
        activeBean={activeBean}
        onSelect={handleBeanSelect}
        loading={loadingBeans}
      />
    )}
  </div>

  {/* Temp - clickable */}
  <div className='relative'>
    <StatPill label='Temp / Pressure' value={`${temp} · ${pressure}`} tone='error' icon={faTemperatureHigh} onClick={handleTempClick} />
    {activePopover === 'temp' && (
      <TempPopover
        currentTemp={machine.value.status.currentTemperature}
        targetTemp={machine.value.status.targetTemperature}
        onChange={handleTempChange}
      />
    )}
  </div>
</div>
```

- [ ] **Step 5: Add custom scrollbar styling**

Add to `web/src/style.css` for the custom scrollbar:

```css
/* Custom scrollbar for popovers */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: oklch(var(--b3));
  border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: oklch(var(--b2));
}
```

- [ ] **Step 6: Add faPlus import if not present**

Check line 19 - `faPlus` is already imported from `@fortawesome/free-solid-svg-icons/faPlus`.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/Header.jsx
git commit -m "feat: add popover UI for stat pill quick-editing"
```

---

## Task 3: Verify and Test

**Steps:**

- [ ] **Step 1: Test Profile popover**

1. Click the "Profile" stat pill in the header
2. Verify popover shows list of available profiles
3. Click a different profile
4. Verify popover closes and profile changes

- [ ] **Step 2: Test Bean popover**

1. Click the "Active Bean" stat pill
2. Verify popover shows list of available beans
3. Click a different bean
4. Verify popover closes and bean changes

- [ ] **Step 3: Test Temperature popover**

1. Click the "Temp / Pressure" stat pill
2. Verify popover shows +/- buttons with current target temp
3. Click + to raise temperature
4. Click - to lower temperature
5. Click outside to close popover

- [ ] **Step 4: Test clicking outside to close**

Click anywhere outside a popover and verify it closes.

- [ ] **Step 5: Test theme switching**

Switch themes and verify:
- Popovers adapt to theme colors
- Borders and backgrounds look correct
- No visual regressions

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: complete interactive header stat pills"
```

---

## Validation Checklist

- [ ] Profile pill shows popover with profile list on click
- [ ] Bean pill shows popover with bean list on click
- [ ] Temp pill shows +/- controls on click
- [ ] Clicking outside closes active popover
- [ ] Profile selection updates machine state
- [ ] Bean selection updates via `req:beans:select`
- [ ] Temperature adjustment sends `req:raise-temp` / `req:lower-temp`
- [ ] Popovers styled consistently with bold/minimal theme
- [ ] Works correctly with all 7 themes
- [ ] No console errors on interaction