import 'preact/debug';

import './style.css';
import { initializeTheme } from './utils/themeManager.js';

import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { LocationProvider, Router, Route, ErrorBoundary } from 'preact-iso';

import { Home } from './pages/Home/index.jsx';
import { NotFound } from './pages/_404.jsx';
import { Settings } from './pages/Settings/index.jsx';
import { OTA } from './pages/OTA/index.jsx';
import { Scales } from './pages/Scales/index.jsx';
import ApiService, { ApiServiceContext } from './services/ApiService.js';
import { Navigation } from './components/Navigation.jsx';
import { ProfileList } from './pages/ProfileList/index.jsx';
import { ProfileEdit } from './pages/ProfileEdit/index.jsx';
import { Autotune } from './pages/Autotune/index.jsx';
import { ShotHistory } from './pages/ShotHistory/index.jsx';
import { ShotAnalyzer } from './pages/ShotAnalyzer/index.jsx';
import { StatisticsPage } from './pages/Statistics/index.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars } from '@fortawesome/free-solid-svg-icons/faBars';

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
