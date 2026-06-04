import './style.css';
import { initializeTheme } from './utils/themeManager.js';

if (import.meta.env.DEV) {
  // Dev-only Preact warnings; stripped from production builds.
  import('preact/debug');
}

import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { LocationProvider, Router, Route, ErrorBoundary } from 'preact-iso';
import lazy from 'preact-iso/lazy';

import ApiService, { ApiServiceContext } from './services/ApiService.js';
import { Navigation } from './components/Navigation.jsx';
import { Spinner } from './components/Spinner.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars } from '@fortawesome/free-solid-svg-icons/faBars';

// Each page lazy-loads as its own Vite chunk so the initial bundle stays small.
// Chart.js, FontAwesome icon sets, and the analyzer/statistics views are too
// large to ship up-front on the ESP32's slow WiFi pipe.
const Home = lazy(() => import('./pages/Home/index.jsx').then(m => m.Home));
const NotFound = lazy(() => import('./pages/_404.jsx').then(m => m.NotFound));
const Settings = lazy(() => import('./pages/Settings/index.jsx').then(m => m.Settings));
const OTA = lazy(() => import('./pages/OTA/index.jsx').then(m => m.OTA));
const Scales = lazy(() => import('./pages/Scales/index.jsx').then(m => m.Scales));
const ProfileList = lazy(() => import('./pages/ProfileList/index.jsx').then(m => m.ProfileList));
const ProfileEdit = lazy(() => import('./pages/ProfileEdit/index.jsx').then(m => m.ProfileEdit));
const Autotune = lazy(() => import('./pages/Autotune/index.jsx').then(m => m.Autotune));
const ShotHistory = lazy(() => import('./pages/ShotHistory/index.jsx').then(m => m.ShotHistory));
const ShotAnalyzer = lazy(() => import('./pages/ShotAnalyzer/index.jsx').then(m => m.ShotAnalyzer));
const StatisticsPage = lazy(() =>
  import('./pages/Statistics/index.jsx').then(m => m.StatisticsPage),
);

const apiService = new ApiService();
const DESKTOP_NAV_COLLAPSED_STORAGE_KEY = 'gaggimate.desktopNavCollapsed';

function readInitialDesktopNavCollapsed() {
  const storage = globalThis.window?.localStorage;
  if (!storage) return true;

  try {
    return storage.getItem(DESKTOP_NAV_COLLAPSED_STORAGE_KEY) === 'true';
  } catch {
    return true;
  }
}

function RouteFallback() {
  return (
    <div className='flex w-full flex-row items-center justify-center py-16'>
      <Spinner size={8} />
    </div>
  );
}

export function App() {
  const [navCollapsed, setNavCollapsed] = useState(readInitialDesktopNavCollapsed);

  useEffect(() => {
    const storage = globalThis.window?.localStorage;
    if (!storage) return;

    try {
      storage.setItem(DESKTOP_NAV_COLLAPSED_STORAGE_KEY, String(navCollapsed));
    } catch {
      // Ignore storage write failures so the navigation still works in restricted browsers.
    }
  }, [navCollapsed]);

  return (
    <LocationProvider>
      <ApiServiceContext.Provider value={apiService}>
        <div className='bg-base-300 flex h-screen overflow-hidden'>
          <Navigation
            collapsed={navCollapsed}
            onToggleCollapsed={() => setNavCollapsed(collapsed => !collapsed)}
          />
          <div className='flex flex-1 flex-col overflow-x-hidden overflow-y-auto'>
            <div className='mx-auto flex min-h-0 w-full max-w-(--breakpoint-2xl) flex-1 flex-col p-4'>
              <div className='grid min-h-0 flex-1 grid-cols-1'>
                <div className='min-h-0'>
                  <ErrorBoundary>
                    <Router>
                      <Route path='/' component={Home} />
                      <Route path='/profiles' component={ProfileList} />
                      <Route path='/profiles/:id' component={ProfileEdit} />
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
          {navCollapsed && (
            <div className='fab end-auto left-4 md:hidden landscape:hidden'>
              <button
                className='btn btn-lg btn-circle btn-primary'
                onClick={() => setNavCollapsed(false)}
              >
                <FontAwesomeIcon icon={faBars} />
              </button>
            </div>
          )}
        </div>
      </ApiServiceContext.Provider>
    </LocationProvider>
  );
}

// Must be called before render
initializeTheme();

render(<App />, document.getElementById('app'));
