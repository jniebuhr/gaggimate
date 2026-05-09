// Only load debug mode in development
if (import.meta.env.DEV) {
  await import('preact/debug');
}
import './style.css';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { initializeTheme } from './utils/themeManager.js';
import { render } from 'preact';
import { LocationProvider, Router, Route, ErrorBoundary, useLocation } from 'preact-iso';
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

function AppContent() {
  const [navOpen, setNavOpen] = useState(false);
  const { path } = useLocation();
  const isHome = path === '/';
  const onNavToggle = useCallback(() => setNavOpen(o => !o), []);

  useEffect(() => {
    document.body.classList.toggle('nav-drawer-open', navOpen);
    return () => {
      document.body.classList.remove('nav-drawer-open');
    };
  }, [navOpen]);

  return (
    <div className='relative min-h-screen overflow-hidden bg-base-300 text-base-content'>
      <div className='app-shell-glow pointer-events-none absolute inset-0' />
      <div className='relative flex min-h-screen flex-col'>
        <a href='#main-content' className='skip-link'>
          Skip to main content
        </a>
        {!isHome && <Header navOpen={navOpen} onNavToggle={onNavToggle} />}
        <Navigation open={navOpen} onClose={() => setNavOpen(false)} />
        <main id='main-content' className='flex-1'>
          <div className='mx-auto w-full px-4 py-4 lg:px-8 lg:py-6 xl:container'>
            <div className='min-w-0'>
              <ErrorBoundary>
                <Router>
                  <Route path='/' component={() => <Home navOpen={navOpen} onNavToggle={onNavToggle} />} />
                  <Route
                    path='/profiles'
                    component={() => (
                      <div className='rounded-3xl border border-base-300/60 bg-base-100/70 p-4 shadow-[0_36px_80px_-48px_rgba(0,0,0,0.92)] backdrop-blur-xl lg:p-6'>
                        <ProfileList />
                      </div>
                    )}
                  />
                  <Route
                    path='/profiles/:id'
                    component={props => (
                      <div className='rounded-3xl border border-base-300/60 bg-base-100/70 p-4 shadow-[0_36px_80px_-48px_rgba(0,0,0,0.92)] backdrop-blur-xl lg:p-6'>
                        <ProfileEdit {...props} />
                      </div>
                    )}
                  />
                  <Route
                    path='/beans'
                    component={() => (
                      <div className='rounded-3xl border border-base-300/60 bg-base-100/70 p-4 shadow-[0_36px_80px_-48px_rgba(0,0,0,0.92)] backdrop-blur-xl lg:p-6'>
                        <BeansPage />
                      </div>
                    )}
                  />
                  <Route
                    path='/settings'
                    component={() => (
                      <div className='rounded-3xl border border-base-300/60 bg-base-100/70 p-4 shadow-[0_36px_80px_-48px_rgba(0,0,0,0.92)] backdrop-blur-xl lg:p-6'>
                        <Settings />
                      </div>
                    )}
                  />
                  <Route
                    path='/ota'
                    component={() => (
                      <div className='rounded-3xl border border-base-300/60 bg-base-100/70 p-4 shadow-[0_36px_80px_-48px_rgba(0,0,0,0.92)] backdrop-blur-xl lg:p-6'>
                        <OTA />
                      </div>
                    )}
                  />
                  <Route
                    path='/scales'
                    component={() => (
                      <div className='rounded-3xl border border-base-300/60 bg-base-100/70 p-4 shadow-[0_36px_80px_-48px_rgba(0,0,0,0.92)] backdrop-blur-xl lg:p-6'>
                        <Scales />
                      </div>
                    )}
                  />
                  <Route
                    path='/pidtune'
                    component={() => (
                      <div className='rounded-3xl border border-base-300/60 bg-base-100/70 p-4 shadow-[0_36px_80px_-48px_rgba(0,0,0,0.92)] backdrop-blur-xl lg:p-6'>
                        <Autotune />
                      </div>
                    )}
                  />
                  <Route
                    path='/history'
                    component={() => (
                      <div className='rounded-3xl border border-base-300/60 bg-base-100/70 p-4 shadow-[0_36px_80px_-48px_rgba(0,0,0,0.92)] backdrop-blur-xl lg:p-6'>
                        <ShotHistory />
                      </div>
                    )}
                  />
                  <Route
                    path='/analyzer'
                    component={() => (
                      <div className='rounded-3xl border border-base-300/60 bg-base-100/70 p-4 shadow-[0_36px_80px_-48px_rgba(0,0,0,0.92)] backdrop-blur-xl lg:p-6'>
                        <ShotAnalyzer />
                      </div>
                    )}
                  />
                  <Route
                    path='/statistics'
                    component={() => (
                      <div className='rounded-3xl border border-base-300/60 bg-base-100/70 p-4 shadow-[0_36px_80px_-48px_rgba(0,0,0,0.92)] backdrop-blur-xl lg:p-6'>
                        <StatisticsPage />
                      </div>
                    )}
                  />
                  <Route
                    path='/statistics/:sourceAlias/:profileName'
                    component={props => (
                      <div className='rounded-3xl border border-base-300/60 bg-base-100/70 p-4 shadow-[0_36px_80px_-48px_rgba(0,0,0,0.92)] backdrop-blur-xl lg:p-6'>
                        <StatisticsPage {...props} />
                      </div>
                    )}
                  />
                  <Route
                    path='/analyzer/:source/:id'
                    component={props => (
                      <div className='rounded-3xl border border-base-300/60 bg-base-100/70 p-4 shadow-[0_36px_80px_-48px_rgba(0,0,0,0.92)] backdrop-blur-xl lg:p-6'>
                        <ShotAnalyzer {...props} />
                      </div>
                    )}
                  />
                  <Route default component={NotFound} />
                </Router>
              </ErrorBoundary>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}

export function App() {
  return (
    <LocationProvider>
      <ApiServiceContext.Provider value={apiService}>
        <AppContent />
      </ApiServiceContext.Provider>
    </LocationProvider>
  );
}

// Must be called before render
initializeTheme();
render(<App />, document.getElementById('app'));
