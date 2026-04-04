// Only load debug mode in development
if (import.meta.env.DEV) {
  await import('preact/debug');
}

import './style.css';
import { initializeTheme } from './utils/themeManager.js';

import { render } from 'preact';
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

export function App() {
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
                <div className='grid grid-cols-1 gap-6 lg:grid-cols-12'>
                  <Navigation />
                  <div className='lg:col-span-10'>
                    <div className='rounded-[2rem] border border-base-300/70 bg-base-100/65 p-4 shadow-2xl shadow-base-content/5 backdrop-blur-xl lg:p-6'>
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
