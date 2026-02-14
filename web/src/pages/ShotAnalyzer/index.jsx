/**
 * ShotAnalyzer.jsx
 * Main container for the analysis view.
 * Handles shot loading, chart visualization, and data tables.
 */

import { useState, useEffect, useContext } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import { LibraryPanel } from './components/LibraryPanel';
import { AnalysisTable } from './components/AnalysisTable';
import { ShotChart } from './components/ShotChart';
import { calculateShotMetrics, detectAutoDelay } from './services/AnalyzerService';
import { libraryService } from './services/LibraryService';
import { ApiServiceContext } from '../../services/ApiService';
import {
  getDefaultColumns,
  cleanName,
  ANALYZER_DB_KEYS,
  loadFromStorage,
  maskStyle,
} from './utils/analyzerUtils';

// Asset Imports
import DeepDiveLogoOutline from './assets/deepdive.svg';
import { EmptyState } from './components/EmptyState.jsx';

export function ShotAnalyzer() {
  const apiService = useContext(ApiServiceContext);
  const { params } = useRoute();

  // --- State ---
  const [currentShot, setCurrentShot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [currentShotName, setCurrentShotName] = useState('No Shot Loaded');
  const [currentProfileName, setCurrentProfileName] = useState('No Profile Loaded');

  const [importMode, setImportMode] = useState('temp');
  const [showInfoModal, setShowInfoModal] = useState(false);

  const [isMatchingProfile, setIsMatchingProfile] = useState(false);
  const [isSearchingProfile, setIsSearchingProfile] = useState(false); // <--- NEW STATE

  const [activeColumns, setActiveColumns] = useState(() => {
    const userStandard = loadFromStorage(ANALYZER_DB_KEYS.USER_STANDARD);
    return userStandard ? new Set(userStandard) : getDefaultColumns();
  });

  const [settings, setSettings] = useState({
    scaleDelay: 200,
    sensorDelay: 200,
    autoDelay: true,
  });

  const [analysisResults, setAnalysisResults] = useState(null);

  // --- DEEP LINK HANDLER ---
  useEffect(() => {
    const loadDeepLink = async () => {
      if (params.source && params.id) {
        // 1. MAP URL PARAMS TO SERVICE PARAMS
        // internal -> gaggimate
        // external -> browser
        let serviceSource = params.source;
        if (params.source === 'internal') serviceSource = 'gaggimate';
        if (params.source === 'external') serviceSource = 'browser';

        // Prevent reloading if already loaded
        if (currentShot && currentShot.id === params.id && currentShot.source === serviceSource) {
          return;
        }

        console.log(
          `Deep Link detected: Loading ${params.id} from ${serviceSource} (URL: ${params.source})`,
        );

        try {
          // Load using the mapped service source
          setLoading(true);
          const shot = await libraryService.loadShot(params.id, serviceSource);

          if (shot) {
            // Ensure the shot object has the correct internal source ('gaggimate'/'browser')
            // so that badges and logic work correctly, regardless of what the URL says.
            shot.source = serviceSource;
            await handleShotLoad(shot, shot.name || params.id);
          }
        } catch (e) {
          console.error('Deep Link Load Failed:', e);
        }
      }
    };

    if (apiService) {
      loadDeepLink();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.source, params.id, apiService]);

  // --- Effects ---
  useEffect(() => {
    if (apiService) libraryService.setApiService(apiService);
  }, [apiService]);

  useEffect(() => {
    if (!currentShot) {
      setAnalysisResults(null);
      return;
    }
    // Defer analysis to next tick to allow UI update
    setTimeout(() => performAnalysis(), 0);
  }, [currentShot, currentProfile, settings]);

  // --- Analysis Logic ---
  const performAnalysis = () => {
    if (!currentShot) return;

    let usedSensorDelay = settings.sensorDelay;
    let isAutoAdjusted = false;

    if (settings.autoDelay && currentProfile) {
      const detection = detectAutoDelay(currentShot, currentProfile, settings.sensorDelay);
      usedSensorDelay = detection.delay;
      isAutoAdjusted = detection.auto;
    }

    const results = calculateShotMetrics(currentShot, currentProfile, {
      scaleDelayMs: settings.scaleDelay,
      sensorDelayMs: usedSensorDelay,
      isAutoAdjusted: isAutoAdjusted,
    });
    setAnalysisResults(results);
  };

  // --- Data Handlers ---
  const handleShotLoad = async (shotData, name) => {
    const shotWithMetadata = {
      ...shotData,
      source: shotData.source || importMode,
    };

    // If loading via Deep Link, ensure we use the mapped source (gaggimate/browser)
    // derived in the useEffect, OR fallback to the shot's own source.
    // (Logic handled implicitly by passing correct object to setCurrentShot)

    setCurrentShot(shotWithMetadata);
    setCurrentShotName(name);

    if (shotWithMetadata.profile) {
      setIsMatchingProfile(true);
      setIsSearchingProfile(true); // <--- START SPINNER

      // Force a UI render cycle before starting heavy profile search
      setTimeout(async () => {
        try {
          const target = cleanName(shotWithMetadata.profile).toLowerCase();
          const allProfiles = await libraryService.getAllProfiles('both');
          const match = allProfiles.find(
            p => cleanName(p.name || p.label || '').toLowerCase() === target,
          );

          if (match) {
            const pid = match.source === 'gaggimate' ? match.profileId || match.id : match.name;
            const fullP = match.data
              ? match.data
              : await libraryService.loadProfile(pid, match.source);
            setCurrentProfile(fullP);
            setCurrentProfileName(match.name || match.label);
          }
        } catch (e) {
          console.warn('Profile auto-match failed:', e);
        } finally {
          setIsMatchingProfile(false);
          setIsSearchingProfile(false); // <- stop spinner
        }
      }, 50);
    }
    setLoading(false);
  };

  const handleProfileLoad = (data, name) => {
    setCurrentProfile(data);
    setCurrentProfileName(name);
  };

  return (
    <div className='pb-20'>
      {/* Header */}
      <div className='mb-4 flex flex-row items-center gap-2'>
        <h2 className='flex-grow text-2xl font-bold sm:text-3xl'>Deep Dive Shot Analyzer</h2>
      </div>

      <div className='container mx-auto max-w-7xl'>
        {/* Library Panel (Always visible) */}
        <div className='mt-4'>
          <LibraryPanel
            currentShot={currentShot}
            currentProfile={currentProfile}
            currentShotName={currentShotName}
            currentProfileName={currentProfileName}
            onShotLoadStart={() => setLoading(true)}
            onShotLoad={handleShotLoad}
            onProfileLoad={handleProfileLoad}
            onShotUnload={() => {
              setCurrentShot(null);
              setCurrentShotName('No Shot Loaded');
              setAnalysisResults(null);
            }}
            onProfileUnload={() => {
              setCurrentProfile(null);
              setCurrentProfileName('No Profile Loaded');
            }}
            onShowStats={() => setShowInfoModal(true)}
            importMode={importMode}
            onImportModeChange={setImportMode}
            isMatchingProfile={isMatchingProfile}
            isSearchingProfile={isSearchingProfile} // <- pass prop
          />
        </div>

        {currentShot ? (
          // --- Active Analysis View ---
          <div className='animate-fade-in mt-8 space-y-5'>
            <div className='bg-base-200/50 border-base-content/5 rounded-lg border p-5 shadow-sm backdrop-blur-sm'>
              <div className='text-base-content border-base-content/10 mb-4 border-b-2 pb-2.5 text-lg font-bold tracking-wide uppercase'>
                Shot Analysis
              </div>

              <div className='mb-8'>
                <ShotChart shotData={currentShot} results={analysisResults} />
              </div>

              {analysisResults && (
                <div className='mt-4 space-y-6'>
                  <AnalysisTable
                    results={analysisResults}
                    activeColumns={activeColumns}
                    onColumnsChange={setActiveColumns}
                    settings={settings}
                    onSettingsChange={setSettings}
                    onAnalyze={performAnalysis}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <EmptyState loading={loading} />
        )}
      </div>

      {/* Coming Soon Modal */}
      {showInfoModal && (
        <div
          className='fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm'
          onClick={() => setShowInfoModal(false)}
        >
          <div
            className='bg-base-100 border-base-content/10 w-full max-w-md rounded-2xl border p-8 text-center shadow-2xl'
            onClick={e => e.stopPropagation()}
          >
            {/* Logo: Masked Div for Theme Color Adaptation */}
            <div className='bg-base-content mx-auto mb-6 h-24 w-24 opacity-90' style={maskStyle} />

            <h3 className='mb-2 text-2xl font-bold'>Coming Soon</h3>
            <p className='opacity-70'>Comparison and statistics feature under development.</p>
            <button onClick={() => setShowInfoModal(false)} className='btn btn-primary mt-6 w-full'>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
