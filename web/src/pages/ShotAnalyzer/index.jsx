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
  getShotDisplayName,
  getShotIdentityKey,
  loadFromStorage,
  normalizeCompareTargetDisplayMode,
  saveToStorage,
} from './utils/analyzerUtils';
import { buildStatisticsProfileHref } from '../Statistics/utils/statisticsRoute';

import { EmptyState } from './components/EmptyState.jsx';
import './ShotAnalyzer.css';

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

function analyzeShotWithSettings(shotData, profileData, settings) {
  let usedSensorDelay = settings.sensorDelay;
  let isAutoAdjusted = false;

  if (settings.autoDelay && profileData) {
    const detection = detectAutoDelay(shotData, profileData, settings.sensorDelay);
    usedSensorDelay = detection.delay;
    isAutoAdjusted = detection.auto;
  }

  return calculateShotMetrics(shotData, profileData, {
    scaleDelayMs: settings.scaleDelay,
    sensorDelayMs: usedSensorDelay,
    isAutoAdjusted,
  });
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
  const [currentProfileSelectionMode, setCurrentProfileSelectionMode] = useState('none');

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
  const [compareMode, setCompareMode] = useState(false);
  const [compareShots, setCompareShots] = useState([]);
  const [comparePendingKeys, setComparePendingKeys] = useState([]);
  const [compareResults, setCompareResults] = useState([]);
  const [compareTargetDisplayMode, setCompareTargetDisplayMode] = useState(() =>
    normalizeCompareTargetDisplayMode(
      loadFromStorage(ANALYZER_DB_KEYS.COMPARE_TARGET_DISPLAY_MODE),
    ),
  );
  const [compareIsSearchingProfile, setCompareIsSearchingProfile] = useState(false);
  const [pendingMobileAnalysisScroll, setPendingMobileAnalysisScroll] = useState(false);
  const analysisSectionRef = useRef(null);
  const profileMatchIdRef = useRef(0);
  const compareProfileMatchIdRef = useRef(0);
  const analysisIdRef = useRef(0);
  const profileSearchTimerRef = useRef(null);
  const compareLoadIdRef = useRef(0);

  const resetCompareState = ({ disableMode = false } = {}) => {
    compareLoadIdRef.current += 1;
    setCompareShots([]);
    setComparePendingKeys([]);
    setCompareResults([]);
    setCompareIsSearchingProfile(false);
    if (disableMode) setCompareMode(false);
  };

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
    saveToStorage(
      ANALYZER_DB_KEYS.COMPARE_TARGET_DISPLAY_MODE,
      normalizeCompareTargetDisplayMode(compareTargetDisplayMode),
    );
  }, [compareTargetDisplayMode]);

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
      setAnalysisResults(analyzeShotWithSettings(currentShot, currentProfile, settings));
    } catch (e) {
      console.error('Analysis failed:', e);
      setAnalysisResults(null);
    }
  };

  useEffect(() => {
    if (compareShots.length === 0) {
      setCompareResults([]);
      return;
    }

    const nextResults = compareShots.reduce((acc, entry) => {
      try {
        acc.push({
          key: entry.key,
          results: analyzeShotWithSettings(entry.shot, entry.profile, settings),
        });
      } catch (error) {
        console.error(`Compare analysis failed for ${entry.key}:`, error);
      }
      return acc;
    }, []);

    setCompareResults(nextResults);
  }, [compareShots, settings]);

  // --- Data Handlers ---
  const handleShotLoad = async (shotData, name, { preserveCompare = false } = {}) => {
    const shotWithMetadata = {
      ...shotData,
      source: shotData.source || importMode,
    };
    const nextShotKey = getShotIdentityKey(shotWithMetadata);
    const currentShotKey = currentShot ? getShotIdentityKey(currentShot) : '';

    if (!preserveCompare && currentShotKey && nextShotKey && currentShotKey !== nextShotKey) {
      resetCompareState();
    }

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
    setCurrentProfileSelectionMode('none');

    if (shotWithMetadata.profile) {
      const matchId = ++profileMatchIdRef.current;
      setIsMatchingProfile(true);
      setIsSearchingProfile(true);

      const attemptProfileAutoMatch = async (attempt = 0) => {
        profileSearchTimerRef.current = null;
        try {
          const allProfiles = await libraryService.getAllProfiles('both');

          if (matchId !== profileMatchIdRef.current) return; // stale

          if (allProfiles.length === 0) {
            if (scheduleProfileAutoMatchRetry(attempt, attemptProfileAutoMatch)) {
              return;
            }
            return;
          }

          const preferredMatch = findPreferredProfileMatch(
            allProfiles,
            shotWithMetadata.profile,
            shotWithMetadata.source,
          );

          if (!preferredMatch) {
            return;
          }

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
            setCurrentProfileSelectionMode('auto');
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
    setCurrentProfileSelectionMode('manual');
  };

  const handleRetryProfileSearch = async () => {
    if (!currentShot?.profile) return;

    if (profileSearchTimerRef.current) {
      clearTimeout(profileSearchTimerRef.current);
      profileSearchTimerRef.current = null;
    }

    const shotWithMetadata = currentShot;
    const matchId = ++profileMatchIdRef.current;
    setIsMatchingProfile(true);
    setIsSearchingProfile(true);

    const attemptProfileAutoMatch = async (attempt = 0) => {
      profileSearchTimerRef.current = null;

      try {
        const allProfiles = await libraryService.getAllProfiles('both');

        if (matchId !== profileMatchIdRef.current) return;

        if (allProfiles.length === 0) {
          if (scheduleProfileAutoMatchRetry(attempt, attemptProfileAutoMatch)) {
            return;
          }
          return;
        }

        const preferredMatch = findPreferredProfileMatch(
          allProfiles,
          shotWithMetadata.profile,
          shotWithMetadata.source,
        );

        if (!preferredMatch) {
          return;
        }

        const matchedProfile = await loadPreferredAutoMatchedProfile(shotWithMetadata, allProfiles);

        if (matchId !== profileMatchIdRef.current) return;

        if (matchedProfile) {
          setCurrentProfile(matchedProfile.profile);
          setCurrentProfileName(matchedProfile.profileName);
          setCurrentProfileSelectionMode('auto');
        }
      } catch (error) {
        if (matchId !== profileMatchIdRef.current) return;
        if (scheduleProfileAutoMatchRetry(attempt, attemptProfileAutoMatch)) {
          return;
        }
        console.warn('Profile retry auto-match failed:', error);
      } finally {
        if (matchId === profileMatchIdRef.current && !profileSearchTimerRef.current) {
          setIsMatchingProfile(false);
          setIsSearchingProfile(false);
        }
      }
    };

    attemptProfileAutoMatch(0);
  };

  const handleCompareModeToggle = () => {
    if (compareMode) {
      resetCompareState();
      setCompareMode(false);
      return;
    }

    setCompareMode(true);
  };

  const handleCompareShotToggle = async (item, checked) => {
    if (!currentShot) return;
    if (!compareMode) setCompareMode(true);

    const shotKey = getShotIdentityKey(item);
    const currentShotKey = getShotIdentityKey(currentShot);

    if (!shotKey || shotKey === currentShotKey) return;

    if (!checked) {
      compareLoadIdRef.current += 1;
      setCompareShots([]);
      setComparePendingKeys([]);
      setCompareResults([]);
      setCompareIsSearchingProfile(false);
      return;
    }

    if (comparePendingKeys.includes(shotKey)) return;
    if (compareShots[0]?.key === shotKey) return;

    const loadId = ++compareLoadIdRef.current;
    setCompareShots([]);
    setCompareResults([]);
    setComparePendingKeys([shotKey]);
    setCompareIsSearchingProfile(false);

    try {
      const loadKey =
        item.source === 'gaggimate' ? item.id : item.storageKey || item.name || item.id;
      const loadedShot = item.samples ? item : await libraryService.loadShot(loadKey, item.source);
      if (loadId !== compareLoadIdRef.current) return;

      const shotWithMetadata = {
        ...loadedShot,
        source: loadedShot.source || item.source || importMode,
        storageKey: loadedShot.storageKey || item.storageKey || item.name || String(loadKey),
        name: loadedShot.name || item.name || item.storageKey || String(loadKey),
      };

      let matchedProfile = null;
      let matchedProfileName = shotWithMetadata.profile
        ? cleanName(shotWithMetadata.profile)
        : 'No Profile Loaded';

      setCompareShots([
        {
          key: shotKey,
          shot: shotWithMetadata,
          shotName: shotWithMetadata.name || item.name || String(loadKey),
          profile: null,
          profileName: matchedProfileName,
          profileSelectionMode: 'none',
        },
      ]);
      setComparePendingKeys([]);

      if (shotWithMetadata.profile) {
        try {
          setCompareIsSearchingProfile(true);
          const allProfiles = await libraryService.getAllProfiles('both');
          if (loadId !== compareLoadIdRef.current) return;
          matchedProfile = await loadPreferredAutoMatchedProfile(shotWithMetadata, allProfiles);
          if (loadId !== compareLoadIdRef.current) return;
          if (matchedProfile) {
            matchedProfileName = matchedProfile.profileName;
            setCompareShots(currentEntries =>
              currentEntries.map(entry =>
                entry.key === shotKey
                  ? {
                      ...entry,
                      profile: matchedProfile.profile || null,
                      profileName: matchedProfileName,
                      profileSelectionMode: matchedProfile.profile ? 'auto' : 'none',
                    }
                  : entry,
              ),
            );
          }
        } catch (profileError) {
          if (loadId !== compareLoadIdRef.current) return;
          console.warn('Compare profile auto-match failed:', profileError);
        } finally {
          if (loadId === compareLoadIdRef.current) {
            setCompareIsSearchingProfile(false);
          }
        }
      }
    } catch (error) {
      if (loadId !== compareLoadIdRef.current) return;
      console.error('Failed to load compare shot:', error);
      alert(`Compare load failed: ${error.message}`);
    } finally {
      if (loadId === compareLoadIdRef.current) {
        setComparePendingKeys([]);
        if (!item?.profile) {
          setCompareIsSearchingProfile(false);
        }
      }
    }
  };

  const handleCompareProfileLoad = (data, name, source) => {
    const nextProfile = normalizeMatchedProfileSource(data, source);
    setCompareShots(currentEntries =>
      currentEntries.map((entry, index) =>
        index === 0
          ? {
              ...entry,
              profile: nextProfile,
              profileName: data?.label || data?.name || name,
              profileSelectionMode: 'manual',
            }
          : entry,
      ),
    );
    setCompareIsSearchingProfile(false);
  };

  const handleCompareProfileUnload = () => {
    setCompareShots(currentEntries =>
      currentEntries.map((entry, index) =>
        index === 0
          ? {
              ...entry,
              profile: null,
              profileName: entry.shot?.profile
                ? cleanName(entry.shot.profile)
                : 'No Profile Loaded',
              profileSelectionMode: 'none',
            }
          : entry,
      ),
    );
    setCompareIsSearchingProfile(false);
  };

  const handleRetryCompareProfileSearch = async () => {
    const secondaryEntry = compareShots[0];
    if (!secondaryEntry?.shot?.profile) return;

    const matchId = ++compareProfileMatchIdRef.current;
    setCompareIsSearchingProfile(true);

    try {
      const allProfiles = await libraryService.getAllProfiles('both');
      if (matchId !== compareProfileMatchIdRef.current) return;

      const matchedProfile = await loadPreferredAutoMatchedProfile(
        secondaryEntry.shot,
        allProfiles,
      );
      if (matchId !== compareProfileMatchIdRef.current) return;

      if (matchedProfile) {
        setCompareShots(currentEntries =>
          currentEntries.map(entry =>
            entry.key === secondaryEntry.key
              ? {
                  ...entry,
                  profile: matchedProfile.profile,
                  profileName: matchedProfile.profileName,
                  profileSelectionMode: 'auto',
                }
              : entry,
          ),
        );
      }
    } catch (error) {
      if (matchId !== compareProfileMatchIdRef.current) return;
      console.warn('Compare profile retry auto-match failed:', error);
    } finally {
      if (matchId === compareProfileMatchIdRef.current) {
        setCompareIsSearchingProfile(false);
      }
    }
  };

  const handleSwapCompareSlots = () => {
    const secondaryEntry = compareShots[0];
    if (!currentShot || !secondaryEntry?.shot) return;

    const previousPrimaryShot = currentShot;
    const previousPrimaryShotName = currentShotName;
    const previousPrimaryProfile = currentProfile;
    const previousPrimaryProfileName = currentProfileName;
    const previousPrimaryProfileSelectionMode = currentProfileSelectionMode;

    setCurrentShot(secondaryEntry.shot);
    setCurrentShotName(secondaryEntry.shotName || getShotDisplayName(secondaryEntry.shot));
    setCurrentProfile(secondaryEntry.profile || null);
    setCurrentProfileName(secondaryEntry.profileName || 'No Profile Loaded');
    setCurrentProfileSelectionMode(secondaryEntry.profileSelectionMode || 'none');

    setCompareShots([
      {
        key: getShotIdentityKey(previousPrimaryShot),
        shot: previousPrimaryShot,
        shotName: previousPrimaryShotName,
        profile: previousPrimaryProfile,
        profileName: previousPrimaryProfileName,
        profileSelectionMode: previousPrimaryProfileSelectionMode,
      },
    ]);
    setCompareResults([]);
    setComparePendingKeys([]);
    setCompareIsSearchingProfile(false);
  };

  const statsHref = buildStatisticsProfileHref({
    source: currentProfile?.source,
    profileName: currentProfileName,
  });

  const currentShotKey = currentShot ? getShotIdentityKey(currentShot) : '';
  const compareSelectionKeys = new Set(comparePendingKeys);
  compareShots.forEach(entry => compareSelectionKeys.add(entry.key));
  if (compareMode && currentShotKey) compareSelectionKeys.add(currentShotKey);

  const compareSelectedCount = compareSelectionKeys.size;
  const compareHasSecondaryShot = compareShots.length > 0;
  const compareSecondaryShot = compareShots[0] || null;
  const compareSecondaryProfile = compareSecondaryShot?.profile || null;
  const compareSecondaryStatsHref = buildStatisticsProfileHref({
    source: compareSecondaryProfile?.source,
    profileName: compareSecondaryShot?.profileName,
  });
  const referenceCompareEntry =
    currentShot && analysisResults
      ? {
          key: currentShotKey,
          shot: currentShot,
          shotName: currentShotName,
          label: getShotDisplayName(currentShot),
          profile: currentProfile,
          profileName: currentProfileName,
          results: analysisResults,
          isReference: true,
        }
      : null;
  const compareEntryByKey = new Map(compareResults.map(entry => [entry.key, entry.results]));
  const compareCollection = referenceCompareEntry
    ? [
        referenceCompareEntry,
        ...compareShots
          .map(entry => ({
            key: entry.key,
            shot: entry.shot,
            shotName: entry.shotName,
            label: getShotDisplayName(entry.shot),
            profile: entry.profile,
            profileName: entry.profileName,
            results: compareEntryByKey.get(entry.key) || null,
            isReference: false,
          }))
          .filter(entry => entry.results),
      ]
    : [];
  const isCompareActive = compareMode && compareHasSecondaryShot && compareCollection.length > 1;

  return (
    <div className='shot-analyzer-page pb-20'>
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
              resetCompareState({ disableMode: true });
              setCurrentShot(null);
              setCurrentShotName('No Shot Loaded');
              setCurrentProfile(null);
              setCurrentProfileName('No Profile Loaded');
              setCurrentProfileSelectionMode('none');
              setAnalysisResults(null);
            }}
            onProfileUnload={() => {
              setCurrentProfile(null);
              setCurrentProfileName('No Profile Loaded');
              setCurrentProfileSelectionMode('none');
            }}
            onShowStats={() => {
              const statsInitialContext = {
                profileName: currentProfileName,
                source: 'both',
              };
              if (compareMode) {
                statsInitialContext.preferredDetailSection = 'compare';
              }
              sessionStorage.setItem('statsInitialContext', JSON.stringify(statsInitialContext));
            }}
            statsHref={statsHref}
            importMode={importMode}
            onImportModeChange={setImportMode}
            onShotLoadedFromLibrary={() => {
              if (shouldAutoScrollAnalyzerOnSelection()) {
                setPendingMobileAnalysisScroll(true);
              }
            }}
            compareMode={compareMode}
            compareHasSecondaryShot={compareHasSecondaryShot}
            compareSelectedCount={compareSelectedCount}
            compareSelectionKeys={compareSelectionKeys}
            comparePendingKeys={comparePendingKeys}
            compareSecondaryShotKey={compareSecondaryShot?.key || ''}
            compareSecondaryProfileName={
              compareSecondaryShot?.profileName || compareSecondaryShot?.shot?.profile || ''
            }
            secondaryShot={compareSecondaryShot?.shot || null}
            secondaryProfile={compareSecondaryProfile}
            secondaryShotName={compareSecondaryShot?.shotName || 'No Shot Loaded'}
            secondaryProfileName={compareSecondaryShot?.profileName || 'No Profile Loaded'}
            secondaryStatsHref={compareSecondaryStatsHref}
            onCompareModeToggle={handleCompareModeToggle}
            onCompareShotToggle={handleCompareShotToggle}
            onCompareProfileLoad={handleCompareProfileLoad}
            onCompareProfileUnload={handleCompareProfileUnload}
            onCompareSwap={handleSwapCompareSlots}
            onRetryProfileSearch={handleRetryProfileSearch}
            onRetryCompareProfileSearch={handleRetryCompareProfileSearch}
            isMatchingProfile={isMatchingProfile}
            isSearchingProfile={isSearchingProfile} // <- pass prop
            compareIsSearchingProfile={compareIsSearchingProfile}
          />
        </div>

        {currentShot ? (
          // --- Active Analysis View ---
          <div ref={analysisSectionRef} className='animate-fade-in mt-8'>
            <div className='bg-base-100 border-base-content/10 rounded-lg border p-5 shadow-sm'>
              <div>
                <ShotChart
                  shotData={currentShot}
                  results={analysisResults}
                  compareEntries={compareCollection}
                  isCompareActive={isCompareActive}
                  compareTargetDisplayMode={compareTargetDisplayMode}
                  onCompareTargetDisplayModeChange={setCompareTargetDisplayMode}
                />
              </div>
            </div>

            {analysisResults && (
              <div className='mt-2'>
                <AnalysisTable
                  results={analysisResults}
                  compareEntries={compareCollection}
                  isCompareActive={isCompareActive}
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
