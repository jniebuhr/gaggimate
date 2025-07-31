import 'preact/debug';

import './style.css';

import { render, createContext } from 'preact';
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
        <div className="min-h-screen bg-base-300">
          <div className="flex flex-col min-h-screen">
            <Header />

            <main className="flex-1">
              <div className="container mx-auto p-4 lg:p-8">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                  <Navigation />
                  <div className="lg:col-span-9">
                    <ErrorBoundary>
                      <Router>
                        <Route path="/" component={Home} />
                        <Route path="/profiles" component={ProfileList} />
                        <Route path="/profiles/:id" component={ProfileEdit} />
                        <Route path="/settings" component={Settings} />
                        <Route path="/ota" component={OTA} />
                        <Route path="/scales" component={Scales} />
                        <Route path="/pidtune" component={Autotune} />
                        <Route path="/history" component={ShotHistory} />
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

render(<App />, document.getElementById('app'));
