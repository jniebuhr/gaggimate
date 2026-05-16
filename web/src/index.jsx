// Only load debug mode in development
if (import.meta.env.DEV) {
  await import('preact/debug');
}
import './style.css';
import { useCallback, useContext, useEffect, useMemo, useState } from 'preact/hooks';
import { h } from 'preact';
import { initializeTheme } from './utils/themeManager.js';
import { render } from 'preact';
import { LocationProvider, Router, Route, ErrorBoundary } from 'preact-iso';
import { PageShell } from './components/PageShell.jsx';
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
import { ShotToProfile } from './pages/ShotToProfile/index.jsx';
import { StatisticsPage } from './pages/Statistics/index.jsx';

const apiService = new ApiService();

function AppContent() {
  const [navOpen, setNavOpen] = useState(false);
  const onNavToggle = useCallback(() => setNavOpen(o => !o), []);

  useEffect(() => {
    document.body.classList.toggle('nav-drawer-open', navOpen);
    return () => {
      document.body.classList.remove('nav-drawer-open');
    };
  }, [navOpen]);

  return (
    <div className='dm-shell relative min-h-screen overflow-hidden' style={{ background: 'var(--dm-bg-0)' }}>
      <div className='app-shell-glow pointer-events-none absolute inset-0' />
      <div className='relative flex min-h-screen flex-col'>
        <a href='#main-content' className='skip-link'>
          Skip to main content
        </a>
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
                      <PageShell navOpen={navOpen} onNavToggle={onNavToggle}>
                        <ProfileList />
                      </PageShell>
                    )}
                  />
                  <Route
                    path='/profiles/:id'
                    component={props => (
                      <PageShell navOpen={navOpen} onNavToggle={onNavToggle}>
                        <ProfileEdit {...props} />
                      </PageShell>
                    )}
                  />
                  <Route
                    path='/beans'
                    component={() => (
                      <PageShell navOpen={navOpen} onNavToggle={onNavToggle}>
                        <BeansPage />
                      </PageShell>
                    )}
                  />
                  <Route
                    path='/settings'
                    component={() => (
                      <PageShell navOpen={navOpen} onNavToggle={onNavToggle}>
                        <Settings />
                      </PageShell>
                    )}
                  />
                  <Route
                    path='/ota'
                    component={() => (
                      <PageShell navOpen={navOpen} onNavToggle={onNavToggle}>
                        <OTA />
                      </PageShell>
                    )}
                  />
                  <Route
                    path='/scales'
                    component={() => (
                      <PageShell navOpen={navOpen} onNavToggle={onNavToggle}>
                        <Scales />
                      </PageShell>
                    )}
                  />
                  <Route
                    path='/pidtune'
                    component={() => (
                      <PageShell navOpen={navOpen} onNavToggle={onNavToggle}>
                        <Autotune />
                      </PageShell>
                    )}
                  />
                  <Route
                    path='/history'
                    component={() => (
                      <PageShell navOpen={navOpen} onNavToggle={onNavToggle}>
                        <ShotHistory />
                      </PageShell>
                    )}
                  />
                  <Route
                    path='/analyzer'
                    component={() => (
                      <PageShell navOpen={navOpen} onNavToggle={onNavToggle}>
                        <ShotAnalyzer />
                      </PageShell>
                    )}
                  />
                  <Route
                    path='/statistics'
                    component={() => (
                      <PageShell navOpen={navOpen} onNavToggle={onNavToggle}>
                        <StatisticsPage />
                      </PageShell>
                    )}
                  />
                  <Route
                    path='/statistics/:sourceAlias/:profileName'
                    component={props => (
                      <PageShell navOpen={navOpen} onNavToggle={onNavToggle}>
                        <StatisticsPage {...props} />
                      </PageShell>
                    )}
                  />
                  <Route
                    path='/analyzer/:source/:id'
                    component={props => (
                      <PageShell navOpen={navOpen} onNavToggle={onNavToggle}>
                        <ShotAnalyzer {...props} />
                      </PageShell>
                    )}
                  />
                  <Route
                    path='/shots/:id/to-profile'
                    component={props => (
                      <PageShell navOpen={navOpen} onNavToggle={onNavToggle}>
                        <ShotToProfile {...props} />
                      </PageShell>
                    )}
                  />
                  <Route default component={NotFound} />
                </Router>
              </ErrorBoundary>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// preact-iso has no built-in base support; strip the deploy base from path so
// routes like path='/' match when the app lives at /gaggimate/.
const _BASE = import.meta.env.BASE_URL?.replace(/\/$/, '') ?? '';

function BasePathProvider({ children }) {
  const ctx = useContext(LocationProvider.ctx);
  const value = useMemo(() => {
    const path = _BASE && ctx.path.startsWith(_BASE)
      ? ctx.path.slice(_BASE.length) || '/'
      : ctx.path;
    return { ...ctx, path };
  }, [ctx]);
  return h(LocationProvider.ctx.Provider, { value }, children);
}

export function App() {
  return (
    <LocationProvider>
      <BasePathProvider>
        <ApiServiceContext.Provider value={apiService}>
          <AppContent />
        </ApiServiceContext.Provider>
      </BasePathProvider>
    </LocationProvider>
  );
}

// Must be called before render
initializeTheme();
render(<App />, document.getElementById('app'));
