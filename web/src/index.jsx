import 'preact/debug';

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
import { Autotune } from './pages/Autotune/index.jsx';
import { ShotHistory } from './pages/ShotHistory/index.jsx';

const apiService = new ApiService();

export function App() {
  return (
    <LocationProvider>
      <ApiServiceContext.Provider value={apiService}>
        <div className='bg-base-300 min-h-screen'>
          <div className='flex min-h-screen flex-col'>
            <Header />

            <main className='flex-1'>
              <div className='mx-auto w-full px-4 py-2 lg:p-8 xl:container'>
                <div className='grid grid-cols-1 gap-6 lg:grid-cols-12'>
                  <Navigation />
                  <div className='lg:col-span-10'>
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
                        <Route default component={NotFound} />
                      </Router>
                    </ErrorBoundary>
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
