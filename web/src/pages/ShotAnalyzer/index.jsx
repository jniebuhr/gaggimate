/**
 * ShotAnalyzer.jsx
 * Main container for the analysis view.
 * Handles shot loading, chart visualization, and data tables.
 */

import { useState, useEffect, useContext, useRef } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import { LibraryPanel } from './components/LibraryPanel';
import { AnalysisTable } from './components/AnalysisTable';
import { ShotChart } from './components/ShotChart';
import { calculateShotMetrics, detectAutoDelay } from './services/AnalyzerService';
import { libraryService } from './services/LibraryService';
import { notesService } from './services/NotesService';
import { ApiServiceContext } from '../../services/ApiService';
import {
  getDefaultColumns,
  cleanName,
  ANALYZER_DB_KEYS,
  loadFromStorage,
} from './utils/analyzerUtils';
import { buildStatisticsProfileHref } from '../Statistics/utils/statisticsRoute';

import { EmptyState } from './components/EmptyState.jsx';

const clampNonNegativeDelay = value => {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) return 0;
  return Math.max(0, Math.round(parsedValue));
};

const PROFILE_AUTO_MATCH_INITIAL_DELAY_MS = 250;
const PROFILE_AUTO_MATCH_RETRY_DELAY_MS = 450;
const PROFILE_AUTO_MATCH_MAX_ATTEMPTS = 4;

function findPreferredProfileMatch(allProfiles, shotProfileName, shotSource) {
  const target = cleanName(shotProfileName).toLowerCase();
  const matches = allProfiles.filter(
    profile => cleanName(profile.name || profile.label || '').toLowerCase() === target,
  );
  return matches.find(profile => profile.source === shotSource) || matches[0] || null;
}

function getProfileLookupId(profileMatch) {
  return profileMatch.source === 'gaggimate'
    ? profileMatch.profileId || profileMatch.id
    : profileMatch.name;
}

function normalizeMatchedProfileSource(profileData, profileSource) {
  if (
    profileSource &&
    (profileSource === 'gaggimate' || profileSource === 'browser') &&
    !profileData?.source
  ) {
    return { ...profileData, source: profileSource };
  }
  return profileData;
}

function shouldAutoScrollAnalyzerOnSelection() {
  const viewportWindow = globalThis.window;
  if (!viewportWindow || typeof viewportWindow.matchMedia !== 'function') return false;
  return viewportWindow.matchMedia('(max-width: 1023px)').matches;
}

async function loadPreferredAutoMatchedProfile(shotWithMetadata, allProfiles) {
  const preferredMatch = findPreferredProfileMatch(
    allProfiles,
    shotWithMetadata.profile,
    shotWithMetadata.source,
  );

  if (!preferredMatch) return null;

  const profileName = preferredMatch.label || preferredMatch.name;
  const profileId = getProfileLookupId(preferredMatch);
  const fullProfile = preferredMatch.data
    ? preferredMatch.data
    : await libraryService.loadProfile(profileId, preferredMatch.source);

  if (!fullProfile) return null;

  return {
    profile: normalizeMatchedProfileSource(fullProfile, preferredMatch.source),
    profileName,
  };
}

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
  const [pendingMobileAnalysisScroll, setPendingMobileAnalysisScroll] = useState(false);
  const analysisSectionRef = useRef(null);
  const profileMatchIdRef = useRef(0);
  const analysisIdRef = useRef(0);
  const profileSearchTimerRef = useRef(null);

  const handleSettingsChange = nextSettings => {
    setSettings(prevSettings => ({
      ...prevSettings,
      ...nextSettings,
      scaleDelay: clampNonNegativeDelay(nextSettings?.scaleDelay ?? prevSettings.scaleDelay),
      sensorDelay: clampNonNegativeDelay(nextSettings?.sensorDelay ?? prevSettings.sensorDelay),
      autoDelay: Boolean(nextSettings?.autoDelay ?? prevSettings.autoDelay),
    }));
  };

  const scheduleProfileAutoMatchRetry = (attempt, callback) => {
    if (attempt + 1 >= PROFILE_AUTO_MATCH_MAX_ATTEMPTS) return false;
    profileSearchTimerRef.current = setTimeout(() => {
      callback(attempt + 1);
    }, PROFILE_AUTO_MATCH_RETRY_DELAY_MS);
    return true;
  };

  // Cleanup pending profile search on unmount
  useEffect(() => {
    return () => {
      if (profileSearchTimerRef.current) clearTimeout(profileSearchTimerRef.current);
    };
  }, []);

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
    if (apiService) {
      libraryService.setApiService(apiService);
      notesService.setApiService(apiService);
    }
  }, [apiService]);

  useEffect(() => {
    if (!currentShot) {
      setAnalysisResults(null);
      return;
    }
    const id = ++analysisIdRef.current;
    // Defer analysis to next tick to allow UI update
    setTimeout(() => {
      if (id !== analysisIdRef.current) return; // stale
      performAnalysis();
    }, 0);
  }, [currentShot, currentProfile, settings]);

  useEffect(() => {
    if (!pendingMobileAnalysisScroll || !currentShot) return;
    if (typeof window === 'undefined') return;

    const timer = window.setTimeout(() => {
      analysisSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setPendingMobileAnalysisScroll(false);
    }, 90);

    return () => window.clearTimeout(timer);
  }, [pendingMobileAnalysisScroll, currentShot]);

  // --- Analysis Logic ---
  const performAnalysis = () => {
    if (!currentShot) return;

    try {
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
    } catch (e) {
      console.error('Analysis failed:', e);
      setAnalysisResults(null);
    }
  };

  // --- Data Handlers ---
  const handleShotLoad = async (shotData, name) => {
    const shotWithMetadata = {
      ...shotData,
      source: shotData.source || importMode,
    };

    setCurrentShot(shotWithMetadata);
    setCurrentShotName(name);

    // Cancel pending profile search from previous shot
    if (profileSearchTimerRef.current) {
      clearTimeout(profileSearchTimerRef.current);
      profileSearchTimerRef.current = null;
    }

    // Reset profile for new shot (prevents stale profile from previous shot)
    setCurrentProfile(null);
    setCurrentProfileName(
      shotWithMetadata.profile ? cleanName(shotWithMetadata.profile) : 'No Profile Loaded',
    );

    if (shotWithMetadata.profile) {
      const matchId = ++profileMatchIdRef.current;
      setIsMatchingProfile(true);
      setIsSearchingProfile(true);

      const attemptProfileAutoMatch = async (attempt = 0) => {
        profileSearchTimerRef.current = null;
        try {
          const allProfiles = await libraryService.getAllProfiles('both');

          if (matchId !== profileMatchIdRef.current) return; // stale

          const matchedProfile = await loadPreferredAutoMatchedProfile(
            shotWithMetadata,
            allProfiles,
          );

          if (matchId !== profileMatchIdRef.current) return; // stale

          if (matchedProfile) {
            // Keep the matched name visible while searching, but only promote the
            // profile to currentProfile after the full payload has been loaded.
            // This prevents the analyzer from re-running against a partial list item
            // that may not contain the phase data required for profile comparison.
            setCurrentProfile(matchedProfile.profile);
            setCurrentProfileName(matchedProfile.profileName);
            return;
          }

          if (scheduleProfileAutoMatchRetry(attempt, attemptProfileAutoMatch)) {
            return;
          }
        } catch (e) {
          if (matchId !== profileMatchIdRef.current) return;
          if (scheduleProfileAutoMatchRetry(attempt, attemptProfileAutoMatch)) {
            return;
          }
          console.warn('Profile auto-match failed:', e);
        } finally {
          if (matchId === profileMatchIdRef.current && !profileSearchTimerRef.current) {
            setIsMatchingProfile(false);
            setIsSearchingProfile(false);
          }
        }
      };

      // Debounce: wait for rapid navigation to settle before searching
      profileSearchTimerRef.current = setTimeout(() => {
        attemptProfileAutoMatch(0);
      }, PROFILE_AUTO_MATCH_INITIAL_DELAY_MS);
    } else {
      // Shot has no profile field — clear search states immediately
      profileMatchIdRef.current++;
      setIsMatchingProfile(false);
      setIsSearchingProfile(false);
    }

    setLoading(false);
  };

  const handleProfileLoad = (data, name, source) => {
    const nextProfile = normalizeMatchedProfileSource(data, source);
    setCurrentProfile(nextProfile);
    setCurrentProfileName(data?.label || data?.name || name);
  };

  const statsHref = buildStatisticsProfileHref({
    source: currentProfile?.source,
    profileName: currentProfileName,
  });

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
            onShowStats={() => {
              sessionStorage.setItem(
                'statsInitialContext',
                JSON.stringify({
                  profileName: currentProfileName,
                  source: 'both',
                }),
              );
            }}
            statsHref={statsHref}
            importMode={importMode}
            onImportModeChange={setImportMode}
            onShotLoadedFromLibrary={() => {
              if (shouldAutoScrollAnalyzerOnSelection()) {
                setPendingMobileAnalysisScroll(true);
              }
            }}
            isMatchingProfile={isMatchingProfile}
            isSearchingProfile={isSearchingProfile} // <- pass prop
          />
        </div>

        {currentShot ? (
          // --- Active Analysis View ---
          <div ref={analysisSectionRef} className='animate-fade-in mt-8'>
            <div className='bg-base-100 border-base-content/10 rounded-lg border p-5 shadow-sm'>
              <div>
                <ShotChart shotData={currentShot} results={analysisResults} />
              </div>
            </div>

            {analysisResults && (
              <div className='mt-2'>
                <AnalysisTable
                  results={analysisResults}
                  activeColumns={activeColumns}
                  onColumnsChange={setActiveColumns}
                  settings={settings}
                  onSettingsChange={handleSettingsChange}
                  onAnalyze={performAnalysis}
                />
              </div>
            )}
          </div>
        ) : (
          <div className='mt-6'>
            <EmptyState loading={loading} />
          </div>
        )}
      </div>
    </div>
  );
}
