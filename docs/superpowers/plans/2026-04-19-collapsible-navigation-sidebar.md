# Collapsible Navigation Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a collapsible navigation sidebar with icon-only condensed view, persisted across sessions. ShotAnalyzer and Statistics pages update to full-width layouts.

**Architecture:** The navigation sidebar becomes a collapsible component that accepts `collapsed` and `onToggleCollapsed` props. The collapsed state is managed in `App.jsx` with localStorage persistence. Grid layout dynamically adjusts based on collapsed state.

**Tech Stack:** Preact, Tailwind CSS, FontAwesome icons, localStorage API

---

## File Inventory

| File | Purpose |
|------|---------|
| `web/src/components/Navigation.jsx` | Navigation sidebar with collapsible MenuItem and toggle button |
| `web/src/index.jsx` | App shell with collapsed state management and localStorage persistence |
| `web/src/pages/ShotAnalyzer/index.jsx` | Full-width layout container |
| `web/src/pages/Statistics/index.jsx` | Full-width layout container |

---

## Task 1: Refactor Navigation.jsx with Collapsible Sidebar

**Files:**
- Modify: `web/src/components/Navigation.jsx:1-62`

- [ ] **Step 1: Write the failing test** (create test stub)

```javascript
// web/src/components/__tests__/Navigation.test.jsx
import { render } from '@testing-library/preact';
import { Navigation } from '../Navigation.jsx';

describe('Navigation', () => {
  it('renders expanded navigation items', () => {
    const { container } = render(<Navigation collapsed={false} onToggleCollapsed={() => {}} />);
    expect(container.querySelector('nav')).toBeTruthy();
    expect(container.querySelectorAll('a').length).toBeGreaterThan(0);
  });

  it('renders collapsed navigation with icons only', () => {
    const { container } = render(<Navigation collapsed={true} onToggleCollapsed={() => {}} />);
    const nav = container.querySelector('nav');
    expect(nav).toBeTruthy();
  });

  it('calls onToggleCollapsed when toggle button is clicked', () => {
    const mockToggle = jest.fn();
    const { container } = render(<Navigation collapsed={false} onToggleCollapsed={mockToggle} />);
    const button = container.querySelector('button');
    button.click();
    expect(mockToggle).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --testPathPattern="Navigation.test" --passWithNoTests`
Expected: Test file not found or failing

- [ ] **Step 3: Write the complete Navigation.jsx implementation**

```javascript
import { useLocation } from 'preact-iso';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHome } from '@fortawesome/free-solid-svg-icons/faHome';
import { faList } from '@fortawesome/free-solid-svg-icons/faList';
import { faLeaf } from '@fortawesome/free-solid-svg-icons/faLeaf';
import { faTimeline } from '@fortawesome/free-solid-svg-icons/faTimeline';
import { faTemperatureHalf } from '@fortawesome/free-solid-svg-icons/faTemperatureHalf';
import { faBluetoothB } from '@fortawesome/free-brands-svg-icons/faBluetoothB';
import { faCog } from '@fortawesome/free-solid-svg-icons/faCog';
import { faRotate } from '@fortawesome/free-solid-svg-icons/faRotate';
import { faMagnifyingGlassChart } from '@fortawesome/free-solid-svg-icons/faMagnifyingGlassChart';
import { faChartSimple } from '@fortawesome/free-solid-svg-icons/faChartSimple';
import { faCircleChevronLeft } from '@fortawesome/free-solid-svg-icons/faCircleChevronLeft';
import { faCircleChevronRight } from '@fortawesome/free-solid-svg-icons/faCircleChevronRight';

const NAVIGATION_SECTIONS = [
  {
    id: 'control',
    items: [
      { label: 'Dashboard', link: '/', icon: faHome },
      { label: 'PID Autotune', link: '/pidtune', icon: faTemperatureHalf },
      { label: 'Bluetooth Devices', link: '/scales', icon: faBluetoothB },
      { label: 'Settings', link: '/settings', icon: faCog },
    ],
  },
  {
    id: 'review',
    showDivider: true,
    items: [
      { label: 'Profiles', link: '/profiles', icon: faList },
      { label: 'Beans', link: '/beans', icon: faLeaf },
      { label: 'Shot History', link: '/history', icon: faTimeline },
      { label: 'Shot Analyzer', link: '/analyzer', icon: faMagnifyingGlassChart, isNew: true },
      { label: 'Statistics', link: '/statistics', icon: faChartSimple, isNew: true },
      { label: 'System & Updates', link: '/ota', icon: faRotate },
    ],
  },
];

function MenuItem({ collapsed = false, icon, isNew = false, label, link }) {
  const { path } = useLocation();
  const isActive = path === link;
  const baseClassName = collapsed
    ? 'btn btn-square btn-md h-11 min-h-0 w-10 min-w-0 rounded-xl border-none bg-transparent px-0 text-base-content hover:bg-base-content/10 hover:text-base-content'
    : 'btn btn-sm h-10 justify-start gap-3 w-full rounded-xl border border-transparent bg-transparent px-3 text-base-content/78 hover:border-base-content/12 hover:bg-base-content/6 hover:text-base-content focus-visible:border-primary/30 focus-visible:bg-primary/10 focus-visible:text-base-content focus-visible:outline-none';
  const activeClassName = collapsed
    ? 'btn btn-square btn-md h-11 min-h-0 w-10 min-w-0 rounded-xl border-none bg-primary px-0 text-primary-content hover:bg-primary hover:text-primary-content'
    : 'btn btn-sm h-10 justify-start gap-3 w-full rounded-xl border border-primary/20 bg-primary/88 px-3 text-primary-content hover:bg-primary hover:text-primary-content shadow-[0_12px_24px_-16px_rgba(0,0,0,0.9)] focus-visible:outline-none';
  const className = isActive ? activeClassName : baseClassName;

  return (
    <a
      href={link}
      className={className}
      aria-label={collapsed ? label : undefined}
      aria-current={isActive ? 'page' : undefined}
      title={collapsed ? label : undefined}
    >
      <FontAwesomeIcon icon={icon} />
      {!collapsed ? (
        <div className='indicator'>
          {isNew ? <span className='indicator-item text-success pl-8 text-xs font-bold'>NEW</span> : null}
          <span>{label}</span>
        </div>
      ) : null}
    </a>
  );
}

export function Navigation({ collapsed = false, onToggleCollapsed }) {
  return (
    <nav className='hidden lg:block lg:sticky lg:top-28'>
      <div className={collapsed ? 'w-10' : 'w-full'}>
        <div className='max-h-[calc(100vh-8rem)] overflow-y-auto rounded-2xl border border-base-300/65 bg-base-100/90 p-4 shadow-[0_26px_60px_-44px_rgba(0,0,0,0.9)] backdrop-blur-xl'>
          {NAVIGATION_SECTIONS.map(section => (
            <div key={section.id}>
              {section.showDivider ? <hr className='h-5 border-0' /> : null}
              <div className='space-y-2'>
                {section.items.map(item => (
                  <MenuItem key={item.link} collapsed={collapsed} {...item} />
                ))}
              </div>
            </div>
          ))}

          <div className={`mt-4 flex ${collapsed ? 'justify-start' : 'justify-end'}`}>
            <button
              type='button'
              onClick={onToggleCollapsed}
              className={
                collapsed
                  ? 'btn btn-square btn-md h-11 min-h-0 w-10 min-w-0 rounded-xl border-none bg-transparent px-0 text-base-content hover:bg-base-content/10 hover:text-base-content'
                  : 'btn btn-square btn-sm border-none bg-transparent text-base-content hover:bg-base-content/10 hover:text-base-content'
              }
              aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
              title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            >
              <FontAwesomeIcon icon={collapsed ? faCircleChevronRight : faCircleChevronLeft} />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --testPathPattern="Navigation.test" -u`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/components/Navigation.jsx web/src/components/__tests__/Navigation.test.jsx
git commit -m "feat: add collapsible navigation sidebar with sections"
```

---

## Task 2: Add Collapsed State Management with localStorage Persistence

**Files:**
- Modify: `web/src/index.jsx:29-82`

- [ ] **Step 1: Write the failing test** (create test stub)

```javascript
// web/src/__tests__/App.test.jsx
import { render } from '@testing-library/preact';
import { App } from '../index.jsx';

describe('App', () => {
  it('reads collapsed state from localStorage', () => {
    // Mock localStorage
    const mockStorage = { getItem: jest.fn(() => 'true'), setItem: jest.fn() };
    globalThis.window = { localStorage: mockStorage };
    
    render(<App />);
    
    expect(mockStorage.getItem).toHaveBeenCalledWith('gaggimate.desktopNavCollapsed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --testPathPattern="App.test" --passWithNoTests`
Expected: Test file not found or failing

- [ ] **Step 3: Write the complete index.jsx implementation**

```javascript
// Only load debug mode in development
if (import.meta.env.DEV) {
  await import('preact/debug');
}

import './style.css';
import { initializeTheme } from './utils/themeManager.js';

import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { LocationProvider, Router, Route, ErrorBoundary } from 'preact-iso';

import { Header } from './components/Header.jsx';
import { Footer } from './components/Footer.jsx';
import { Home } from './pages/Home/index.jsx';
import { NotFound } from './pages/_404.jsx';
import { Settings } from './pages/Settings/index.jsx';
import { OTA } from './pages/OTA/index.jsx';
import { Scales } from './pages/Scales/index.jsx';
import ApiService, { ApiServiceContext } from './services/ApiService.js';
import { Navigation } from './components/Navigation.jsx';
import { ProfileList } from './pages/ProfileList/index.jsx';
import { ProfileEdit } from './pages/ProfileEdit/index.jsx';
import { BeansPage } from './pages/Beans/index.jsx';
import { Autotune } from './pages/Autotune/index.jsx';
import { ShotHistory } from './pages/ShotHistory/index.jsx';
import { ShotAnalyzer } from './pages/ShotAnalyzer/index.jsx';
import { StatisticsPage } from './pages/Statistics/index.jsx';

const apiService = new ApiService();
const DESKTOP_NAV_COLLAPSED_STORAGE_KEY = 'gaggimate.desktopNavCollapsed';

function readInitialDesktopNavCollapsed() {
  const storage = globalThis.window?.localStorage;
  if (!storage) return false;

  try {
    return storage.getItem(DESKTOP_NAV_COLLAPSED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function App() {
  const [desktopNavCollapsed, setDesktopNavCollapsed] = useState(readInitialDesktopNavCollapsed);

  useEffect(() => {
    const storage = globalThis.window?.localStorage;
    if (!storage) return;

    try {
      storage.setItem(DESKTOP_NAV_COLLAPSED_STORAGE_KEY, String(desktopNavCollapsed));
    } catch {
      // Ignore storage write failures so the navigation still works in restricted browsers.
    }
  }, [desktopNavCollapsed]);

  return (
    <LocationProvider>
      <ApiServiceContext.Provider value={apiService}>
        <div className='relative min-h-screen overflow-hidden bg-base-300 text-base-content'>
          <div className='app-shell-glow pointer-events-none absolute inset-0' />
          <div className='relative flex min-h-screen flex-col'>
            <a href='#main-content' className='skip-link'>
              Skip to main content
            </a>
            <Header />

            <main id='main-content' className='flex-1'>
              <div className='mx-auto w-full px-4 py-4 lg:px-8 lg:py-6 xl:container'>
                <div
                  className={`grid grid-cols-1 ${
                    desktopNavCollapsed
                      ? 'gap-3 lg:grid-cols-[2.75rem_minmax(0,1fr)]'
                      : 'gap-5 lg:grid-cols-[14rem_minmax(0,1fr)]'
                  }`}
                >
                  <Navigation
                    collapsed={desktopNavCollapsed}
                    onToggleCollapsed={() => setDesktopNavCollapsed(collapsed => !collapsed)}
                  />
                  <div className='min-w-0'>
                    <div className='rounded-3xl border border-base-300/60 bg-base-100/70 p-4 shadow-[0_36px_80px_-48px_rgba(0,0,0,0.92)] backdrop-blur-xl lg:p-6'>
                      <ErrorBoundary>
                        <Router>
                          <Route path='/' component={Home} />
                          <Route path='/profiles' component={ProfileList} />
                          <Route path='/profiles/:id' component={ProfileEdit} />
                          <Route path='/beans' component={BeansPage} />
                          <Route path='/settings' component={Settings} />
                          <Route path='/ota' component={OTA} />
                          <Route path='/scales' component={Scales} />
                          <Route path='/pidtune' component={Autotune} />
                          <Route path='/history' component={ShotHistory} />
                          <Route path='/analyzer' component={ShotAnalyzer} />
                          <Route path='/statistics' component={StatisticsPage} />
                          <Route
                            path='/statistics/:sourceAlias/:profileName'
                            component={StatisticsPage}
                          />
                          <Route path='/analyzer/:source/:id' component={ShotAnalyzer} />{' '}
                          {/*deep-link route (sorce & ID)*/}
                          <Route default component={NotFound} />
                        </Router>
                      </ErrorBoundary>
                    </div>
                  </div>
                </div>
              </div>
            </main>
            <Footer />
          </div>
        </div>
      </ApiServiceContext.Provider>
    </LocationProvider>
  );
}

// Must be called before render
initializeTheme();

render(<App />, document.getElementById('app'));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --testPathPattern="App.test" -u`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/index.jsx
git commit -m "feat: add localStorage-persisted navigation collapse state"
```

---

## Task 3: Update ShotAnalyzer to Full-Width Layout

**Files:**
- Modify: `web/src/pages/ShotAnalyzer/index.jsx:364`

- [ ] **Step 1: Update the container class**

Change line 364 from:
```javascript
<div className='container mx-auto max-w-7xl'>
```
To:
```javascript
<div className='w-full'>
```

- [ ] **Step 2: Commit**

```bash
git add web/src/pages/ShotAnalyzer/index.jsx
git commit -m "feat: use full-width layout for ShotAnalyzer page"
```

---

## Task 4: Update Statistics to Full-Width Layout

**Files:**
- Modify: `web/src/pages/Statistics/index.jsx:32`

- [ ] **Step 1: Update the container class**

Change line 32 from:
```javascript
<div className='container mx-auto max-w-7xl'>
```
To:
```javascript
<div className='w-full'>
```

- [ ] **Step 2: Commit**

```bash
git add web/src/pages/Statistics/index.jsx
git commit -m "feat: use full-width layout for Statistics page"
```

---

## Verification Checklist

- [ ] Navigation collapses/expands when toggle button is clicked
- [ ] Navigation state persists across page refreshes (localStorage)
- [ ] Icon-only mode shows tooltips on hover
- [ ] ShotAnalyzer page uses full horizontal width
- [ ] Statistics page uses full horizontal width
- [ ] All navigation links still work correctly
- [ ] Active state is correctly highlighted
- [ ] NEW badges still display in expanded mode
- [ ] No console errors on navigation toggle
- [ ] Responsive: mobile doesn't show sidebar (it was already `hidden lg:block`)
