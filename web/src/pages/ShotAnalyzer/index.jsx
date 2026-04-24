/**
 * ShotAnalyzer.jsx
 * Main container for the analysis view.
 * Handles shot loading, chart visualization, and data tables.
 */

/* global globalThis */

import { useState, useEffect, useContext, useRef, useCallback } from 'preact/hooks';
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
  getProfileDisplayLabel,
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
const SHOT_SELECTION_DEBOUNCE_MS = 400;

function hasLoadedShotPayload(item) {
  return Boolean(item) && Array.isArray(item.samples);
}

function getShotSelectionLoadKey(item) {
  if (!item) return '';
  return item.source === 'gaggimate' ? item.id : item.storageKey || item.name || item.id;
}

function getShotSelectionName(item, loadKey = getShotSelectionLoadKey(item)) {
  if (!item) return 'No Shot Loaded';
  return item.name || item.storageKey || String(loadKey || item.id || 'No Shot Loaded');
}

function getShotSelectionProfileName(item) {
  return item?.profile ? cleanName(item.profile) : 'No Profile Loaded';
}

function createSelectionBaseRequest(request) {
  const isRequestObject = Boolean(request) && typeof request === 'object';
  return isRequestObject && Object.hasOwn(request, 'item') ? request : { item: request };
}

function normalizeSelectionRequest(request, importMode, defaults = {}) {
  const baseRequest = createSelectionBaseRequest(request);
  const item = baseRequest?.item;
  if (!item) return null;

  const shotItem = {
    ...item,
    source: item.source || importMode,
  };

  return {
    direction: 0,
    targetIndex: -1,
    debounceMs: SHOT_SELECTION_DEBOUNCE_MS,
    ...defaults,
    ...baseRequest,
    item: shotItem,
    name: baseRequest.name || getShotSelectionName(shotItem),
    listSnapshot: Array.isArray(baseRequest.listSnapshot) ? baseRequest.listSnapshot : [],
  };
}

function getNextDirectionalSelection(request) {
  if (!request?.direction || !Array.isArray(request.listSnapshot)) return null;

  const nextIndex = request.targetIndex + request.direction;
  if (nextIndex < 0 || nextIndex >= request.listSnapshot.length) return null;

  const item = request.listSnapshot[nextIndex];
  if (!item) return null;

  return {
    ...request,
    item,
    name: getShotSelectionName(item),
    targetIndex: nextIndex,
    requestSelectionScroll: false,
  };
}

function findPreferredProfileMatch(allProfiles, shotProfileName, shotSource, shotProfileId = '') {
  const targetId = String(shotProfileId || '').trim();
  if (targetId) {
    const idMatches = allProfiles.filter(
      profile => String(profile.profileId || profile.id || '').trim() === targetId,
    );
    const preferredIdMatch = idMatches.find(profile => profile.source === shotSource) || idMatches[0];
    if (preferredIdMatch) return preferredIdMatch;
  }

  const target = cleanName(shotProfileName).toLowerCase();
  if (!target) return null;

  const matches = allProfiles.filter(
    profile => getProfileDisplayLabel(profile, '').toLowerCase() === target,
  );
  return matches.find(profile => profile.source === shotSource) || matches[0] || null;
}

function getProfileLookupId(profileMatch) {
  return profileMatch.source === 'gaggimate'
    ? profileMatch.profileId || profileMatch.id
    : profileMatch.label ||
        profileMatch.data?.label ||
        profileMatch.name ||
        profileMatch.data?.name ||
        profileMatch.fileName ||
        profileMatch.data?.fileName ||
        profileMatch.exportName ||
        profileMatch.data?.exportName;
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
    shotWithMetadata.profileId,
  );

  if (!preferredMatch) return null;

  const profileName = getProfileDisplayLabel(preferredMatch, '');
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

function clearCompareSelectionState({
  compareLoadIdRef,
  setCompareShots,
  setComparePendingKeys,
  setCompareResults,
  setCompareIsSearchingProfile,
}) {
  compareLoadIdRef.current += 1;
  setCompareShots([]);
  setComparePendingKeys([]);
  setCompareResults([]);
  setCompareIsSearchingProfile(false);
}

function buildShotWithMetadata({ item, loadedShot, importMode, loadKey }) {
  return {
    ...loadedShot,
    source: loadedShot.source || item.source || importMode,
    storageKey: loadedShot.storageKey || item.storageKey || item.name || String(loadKey),
    name: loadedShot.name || item.name || item.storageKey || String(loadKey),
  };
}

function createCompareShotEntry({ shotKey, shotWithMetadata, item, loadKey }) {
  const matchedProfileName = shotWithMetadata.profile
    ? cleanName(shotWithMetadata.profile)
    : 'No Profile Loaded';

  return {
    key: shotKey,
    shot: shotWithMetadata,
    shotName: shotWithMetadata.name || item.name || String(loadKey),
    profile: null,
    profileName: matchedProfileName,
    profileSelectionMode: 'none',
  };
}

function applyMatchedCompareProfile(setCompareShots, shotKey, matchedProfile) {
  setCompareShots(currentEntries =>
    currentEntries.map(entry =>
      entry.key === shotKey
        ? {
            ...entry,
            profile: matchedProfile.profile || null,
            profileName: matchedProfile.profileName,
            profileSelectionMode: matchedProfile.profile ? 'auto' : 'none',
          }
        : entry,
    ),
  );
}

function isCurrentCompareLoad(loadId, compareLoadIdRef) {
  return loadId === compareLoadIdRef.current;
}

function clearComparePendingSelectionState({
  setPendingCompareSelection,
  setComparePendingKeys,
  setCompareIsSearchingProfile,
}) {
  setPendingCompareSelection(null);
  setComparePendingKeys([]);
  setCompareIsSearchingProfile(false);
}

function applyPendingCompareSelectionState(
  selectionRequest,
  setPendingCompareSelection,
  setComparePendingKeys,
) {
  const nextShotKey = getShotIdentityKey(selectionRequest?.item);
  setPendingCompareSelection({
    shot: selectionRequest.item,
    name: selectionRequest.name,
  });
  setComparePendingKeys(nextShotKey ? [nextShotKey] : []);
}

function getDirectionalCompareSelectionRequest(selectionRequest, loadId) {
  const nextSelection = getNextDirectionalSelection(selectionRequest);
  if (!nextSelection) return null;
  return {
    ...nextSelection,
    loadId,
  };
}

function getActivePrimaryShotKey(pendingPrimarySelectionRef, currentShotRef) {
  const activePrimaryShot = pendingPrimarySelectionRef.current?.shot || currentShotRef.current;
  return activePrimaryShot ? getShotIdentityKey(activePrimaryShot) : '';
}

function shouldAbortCompareLoad({
  requestId,
  compareSelectionRequestIdRef,
  loadId,
  compareLoadIdRef,
}) {
  return (
    requestId !== compareSelectionRequestIdRef.current ||
    !isCurrentCompareLoad(loadId, compareLoadIdRef)
  );
}

function advanceCompareSelectionAfterFailure({
  selectionRequest,
  loadId,
  setPendingCompareSelection,
  setComparePendingKeys,
  clearPendingState,
}) {
  const nextSelection = getDirectionalCompareSelectionRequest(selectionRequest, loadId);
  if (!nextSelection) {
    clearPendingState();
    return null;
  }

  applyPendingCompareSelectionState(
    nextSelection,
    setPendingCompareSelection,
    setComparePendingKeys,
  );
  return nextSelection;
}

function commitLoadedCompareSelection({
  targetShotKey,
  shotWithMetadata,
  item,
  loadKey,
  setCompareShots,
  setPendingCompareSelection,
  setComparePendingKeys,
}) {
  setCompareShots([
    createCompareShotEntry({ shotKey: targetShotKey, shotWithMetadata, item, loadKey }),
  ]);
  setPendingCompareSelection(null);
  setComparePendingKeys([]);
}

function finalizeCompareSelectionAttempt({
  requestId,
  compareSelectionRequestIdRef,
  item,
  setCompareIsSearchingProfile,
}) {
  if (requestId === compareSelectionRequestIdRef.current && !item?.profile) {
    setCompareIsSearchingProfile(false);
  }
}

async function executeCompareSelectionLoad({
  requestId,
  selectionRequest,
  importMode,
  compareSelectionRequestIdRef,
  compareLoadIdRef,
  pendingPrimarySelectionRef,
  currentShotRef,
  setPendingCompareSelection,
  setComparePendingKeys,
  setCompareIsSearchingProfile,
  setCompareShots,
}) {
  const clearPendingState = () =>
    clearComparePendingSelectionState({
      setPendingCompareSelection,
      setComparePendingKeys,
      setCompareIsSearchingProfile,
    });

  let activeRequest = selectionRequest;

  while (activeRequest) {
    const { item, loadId } = activeRequest;
    const targetShotKey = getShotIdentityKey(item);
    const activePrimaryShotKey = getActivePrimaryShotKey(
      pendingPrimarySelectionRef,
      currentShotRef,
    );

    if (!targetShotKey) {
      clearPendingState();
      return false;
    }

    if (activePrimaryShotKey && targetShotKey === activePrimaryShotKey) {
      activeRequest = advanceCompareSelectionAfterFailure({
        selectionRequest: activeRequest,
        loadId,
        setPendingCompareSelection,
        setComparePendingKeys,
        clearPendingState,
      });
      if (!activeRequest) return false;
      continue;
    }

    try {
      const { shotWithMetadata, loadKey } = await loadCompareShotSelection({ item, importMode });
      if (
        shouldAbortCompareLoad({
          requestId,
          compareSelectionRequestIdRef,
          loadId,
          compareLoadIdRef,
        })
      )
        return false;

      commitLoadedCompareSelection({
        targetShotKey,
        shotWithMetadata,
        item,
        loadKey,
        setCompareShots,
        setPendingCompareSelection,
        setComparePendingKeys,
      });

      await tryAutoMatchCompareShotProfile({
        loadId,
        compareLoadIdRef,
        shotKey: targetShotKey,
        shotWithMetadata,
        setCompareIsSearchingProfile,
        setCompareShots,
      });

      return true;
    } catch (error) {
      if (
        shouldAbortCompareLoad({
          requestId,
          compareSelectionRequestIdRef,
          loadId,
          compareLoadIdRef,
        })
      )
        return false;

      console.warn('Failed to load compare shot:', error);

      activeRequest = advanceCompareSelectionAfterFailure({
        selectionRequest: activeRequest,
        loadId,
        setPendingCompareSelection,
        setComparePendingKeys,
        clearPendingState,
      });
      if (!activeRequest) return false;
    } finally {
      finalizeCompareSelectionAttempt({
        requestId,
        compareSelectionRequestIdRef,
        item,
        setCompareIsSearchingProfile,
      });
    }
  }

  clearPendingState();
  return false;
}

async function loadShotSelection({ item, importMode }) {
  const loadKey = getShotSelectionLoadKey(item);
  const loadedShot = hasLoadedShotPayload(item)
    ? item
    : await libraryService.loadShot(loadKey, item.source);
  const shotWithMetadata = buildShotWithMetadata({
    item,
    loadedShot,
    importMode,
    loadKey,
  });

  return {
    loadKey,
    shotName: getShotSelectionName(item, loadKey),
    shotWithMetadata,
  };
}

async function loadCompareShotSelection({ item, importMode }) {
  const loadKey = getShotSelectionLoadKey(item);
  const loadedShot = hasLoadedShotPayload(item)
    ? item
    : await libraryService.loadShot(loadKey, item.source);
  const shotWithMetadata = buildShotWithMetadata({
    item,
    loadedShot,
    importMode,
    loadKey,
  });

  return {
    loadKey,
    shotWithMetadata,
  };
}

async function tryAutoMatchCompareShotProfile({
  loadId,
  compareLoadIdRef,
  shotKey,
  shotWithMetadata,
  setCompareIsSearchingProfile,
  setCompareShots,
}) {
  if (!shotWithMetadata.profile) {
    return;
  }

  try {
    setCompareIsSearchingProfile(true);
    const allProfiles = await libraryService.getAllProfiles('both');
    if (!isCurrentCompareLoad(loadId, compareLoadIdRef)) return;

    const matchedProfile = await loadPreferredAutoMatchedProfile(shotWithMetadata, allProfiles);
    if (!isCurrentCompareLoad(loadId, compareLoadIdRef)) return;

    if (matchedProfile) {
      applyMatchedCompareProfile(setCompareShots, shotKey, matchedProfile);
    }
  } catch (profileError) {
    if (!isCurrentCompareLoad(loadId, compareLoadIdRef)) return;
    console.warn('Compare profile auto-match failed:', profileError);
  } finally {
    if (isCurrentCompareLoad(loadId, compareLoadIdRef)) {
      setCompareIsSearchingProfile(false);
    }
  }
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
  const [pendingPrimarySelection, setPendingPrimarySelection] = useState(null);
  const [pendingCompareSelection, setPendingCompareSelection] = useState(null);

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
  const primarySelectionTimerRef = useRef(null);
  const compareSelectionTimerRef = useRef(null);
  const primarySelectionRequestIdRef = useRef(0);
  const compareSelectionRequestIdRef = useRef(0);
  const currentShotRef = useRef(currentShot);
  const compareShotsRef = useRef(compareShots);
  const pendingPrimarySelectionRef = useRef(pendingPrimarySelection);
  const pendingCompareSelectionRef = useRef(pendingCompareSelection);

  useEffect(() => {
    currentShotRef.current = currentShot;
  }, [currentShot]);

  useEffect(() => {
    compareShotsRef.current = compareShots;
  }, [compareShots]);

  useEffect(() => {
    pendingPrimarySelectionRef.current = pendingPrimarySelection;
  }, [pendingPrimarySelection]);

  useEffect(() => {
    pendingCompareSelectionRef.current = pendingCompareSelection;
  }, [pendingCompareSelection]);

  const clearPrimarySelectionTimer = useCallback(() => {
    if (primarySelectionTimerRef.current) {
      clearTimeout(primarySelectionTimerRef.current);
      primarySelectionTimerRef.current = null;
    }
  }, []);

  const clearCompareSelectionTimer = useCallback(() => {
    if (compareSelectionTimerRef.current) {
      clearTimeout(compareSelectionTimerRef.current);
      compareSelectionTimerRef.current = null;
    }
  }, []);

  const cancelPrimaryProfileSearch = useCallback(() => {
    if (profileSearchTimerRef.current) {
      clearTimeout(profileSearchTimerRef.current);
      profileSearchTimerRef.current = null;
    }
    profileMatchIdRef.current += 1;
    setIsMatchingProfile(false);
    setIsSearchingProfile(false);
  }, []);

  const cancelCompareProfileSearch = useCallback(() => {
    compareLoadIdRef.current += 1;
    compareProfileMatchIdRef.current += 1;
    setCompareIsSearchingProfile(false);
  }, []);

  const clearPendingPrimarySelection = useCallback(() => {
    clearPrimarySelectionTimer();
    primarySelectionRequestIdRef.current += 1;
    setPendingPrimarySelection(null);
    setLoading(false);
  }, [clearPrimarySelectionTimer]);

  const clearPendingCompareSelection = useCallback(() => {
    clearCompareSelectionTimer();
    compareSelectionRequestIdRef.current += 1;
    setPendingCompareSelection(null);
    setComparePendingKeys([]);
    setCompareIsSearchingProfile(false);
  }, [clearCompareSelectionTimer]);

  const resetCompareState = useCallback(
    ({ disableMode = false } = {}) => {
      clearPendingCompareSelection();
      compareLoadIdRef.current += 1;
      setCompareShots([]);
      setComparePendingKeys([]);
      setCompareResults([]);
      setCompareIsSearchingProfile(false);
      if (disableMode) setCompareMode(false);
    },
    [clearPendingCompareSelection],
  );

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
      if (primarySelectionTimerRef.current) clearTimeout(primarySelectionTimerRef.current);
      if (compareSelectionTimerRef.current) clearTimeout(compareSelectionTimerRef.current);
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
            commitPrimaryShotLoad(shot, shot.name || params.id);
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

  // --- Analysis Logic ---
  const performAnalysis = useCallback(() => {
    if (!currentShot) return;

    try {
      setAnalysisResults(analyzeShotWithSettings(currentShot, currentProfile, settings));
    } catch (e) {
      console.error('Analysis failed:', e);
      setAnalysisResults(null);
    }
  }, [currentProfile, currentShot, settings]);

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
  }, [currentShot, currentProfile, performAnalysis, settings]);

  useEffect(() => {
    if (!pendingMobileAnalysisScroll || !currentShot) return;
    if (!globalThis.window) return;

    const timer = globalThis.window.setTimeout(() => {
      analysisSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setPendingMobileAnalysisScroll(false);
    }, 90);

    return () => globalThis.window?.clearTimeout(timer);
  }, [pendingMobileAnalysisScroll, currentShot]);

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
  const normalizePrimarySelectionRequest = useCallback(
    request =>
      normalizeSelectionRequest(request, importMode, {
        preserveCompare: false,
        requestSelectionScroll: false,
      }),
    [importMode],
  );

  const normalizeCompareSelectionRequest = useCallback(
    request => normalizeSelectionRequest(request, importMode),
    [importMode],
  );

  const commitPrimaryShotLoad = useCallback(
    (shotData, name, { preserveCompare = false, requestSelectionScroll = false } = {}) => {
      const shotWithMetadata = {
        ...shotData,
        source: shotData.source || importMode,
      };
      const nextShotKey = getShotIdentityKey(shotWithMetadata);
      const previousShot = currentShotRef.current;
      const currentShotKey = previousShot ? getShotIdentityKey(previousShot) : '';

      clearPrimarySelectionTimer();
      setPendingPrimarySelection(null);

      if (!preserveCompare && currentShotKey && nextShotKey && currentShotKey !== nextShotKey) {
        resetCompareState();
      }

      setCurrentShot(shotWithMetadata);
      setCurrentShotName(name);

      cancelPrimaryProfileSearch();

      // Reset profile for new shot (prevents stale profile from previous shot)
      setCurrentProfile(null);
      setCurrentProfileName(getShotSelectionProfileName(shotWithMetadata));
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
              shotWithMetadata.profileId,
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
        profileMatchIdRef.current += 1;
        setIsMatchingProfile(false);
        setIsSearchingProfile(false);
      }

      if (requestSelectionScroll && shouldAutoScrollAnalyzerOnSelection()) {
        setPendingMobileAnalysisScroll(true);
      }

      setLoading(false);
    },
    [cancelPrimaryProfileSearch, clearPrimarySelectionTimer, importMode, resetCompareState],
  );

  const tryLoadPrimarySelection = useCallback(
    async (requestId, selectionRequest) => {
      const { item, name, preserveCompare } = selectionRequest;
      const targetShotKey = getShotIdentityKey(item);
      const activeCompareShot =
        pendingCompareSelectionRef.current?.shot || compareShotsRef.current[0]?.shot || null;
      const activeCompareShotKey = activeCompareShot ? getShotIdentityKey(activeCompareShot) : '';

      if (!targetShotKey) {
        setPendingPrimarySelection(null);
        setLoading(false);
        return false;
      }

      if (preserveCompare && activeCompareShotKey && targetShotKey === activeCompareShotKey) {
        const nextSelection = getNextDirectionalSelection(selectionRequest);
        if (nextSelection) {
          setPendingPrimarySelection({
            shot: nextSelection.item,
            name: nextSelection.name,
          });
          return tryLoadPrimarySelection(requestId, nextSelection);
        }

        setPendingPrimarySelection(null);
        setLoading(false);
        return false;
      }

      try {
        setLoading(true);
        const { shotWithMetadata, shotName } = await loadShotSelection({ item, importMode });
        if (requestId !== primarySelectionRequestIdRef.current) return false;

        commitPrimaryShotLoad(shotWithMetadata, name || shotName, selectionRequest);
        return true;
      } catch (error) {
        if (requestId !== primarySelectionRequestIdRef.current) return false;

        console.warn('Failed to load shot:', error);

        const nextSelection = getNextDirectionalSelection(selectionRequest);
        if (nextSelection) {
          setPendingPrimarySelection({
            shot: nextSelection.item,
            name: nextSelection.name,
          });
          return tryLoadPrimarySelection(requestId, nextSelection);
        }

        setPendingPrimarySelection(null);
        setLoading(false);
        return false;
      }
    },
    [commitPrimaryShotLoad, importMode],
  );

  const launchPrimarySelectionLoad = useCallback(
    (requestId, selectionRequest) => {
      tryLoadPrimarySelection(requestId, selectionRequest).catch(error => {
        console.error('Primary selection load failed:', error);
      });
    },
    [tryLoadPrimarySelection],
  );

  const handleShotSelect = useCallback(
    request => {
      const selectionRequest = normalizePrimarySelectionRequest(request);
      if (!selectionRequest?.item) return;

      const targetShotKey = getShotIdentityKey(selectionRequest.item);
      const currentCommittedShot = currentShotRef.current;
      const currentShotKey = currentCommittedShot ? getShotIdentityKey(currentCommittedShot) : '';

      if (!targetShotKey) return;

      if (targetShotKey === currentShotKey) {
        clearPrimarySelectionTimer();
        primarySelectionRequestIdRef.current += 1;
        setPendingPrimarySelection(null);
        setLoading(false);
        return;
      }

      const requestId = ++primarySelectionRequestIdRef.current;
      clearPrimarySelectionTimer();
      setPendingPrimarySelection({
        shot: selectionRequest.item,
        name: selectionRequest.name,
      });

      if (
        hasLoadedShotPayload(selectionRequest.item) ||
        !currentCommittedShot ||
        selectionRequest.debounceMs <= 0
      ) {
        launchPrimarySelectionLoad(requestId, selectionRequest);
        return;
      }

      primarySelectionTimerRef.current = setTimeout(() => {
        primarySelectionTimerRef.current = null;
        launchPrimarySelectionLoad(requestId, selectionRequest);
      }, selectionRequest.debounceMs);
    },
    [clearPrimarySelectionTimer, launchPrimarySelectionLoad, normalizePrimarySelectionRequest],
  );

  const handleProfileLoad = (data, name, source) => {
    cancelPrimaryProfileSearch();
    const nextProfile = normalizeMatchedProfileSource(data, source);
    setCurrentProfile(nextProfile);
    setCurrentProfileName(getProfileDisplayLabel(data, name));
    setCurrentProfileSelectionMode('manual');
  };

  const handleRetryProfileSearch = async () => {
    if (!currentShot?.profile) return;

    cancelPrimaryProfileSearch();

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
          shotWithMetadata.profileId,
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

  const handleProfileUnload = useCallback(() => {
    cancelPrimaryProfileSearch();
    setCurrentProfile(null);
    setCurrentProfileName('No Profile Loaded');
    setCurrentProfileSelectionMode('none');
  }, [cancelPrimaryProfileSearch]);

  const handleCompareModeToggle = () => {
    if (compareMode) {
      resetCompareState();
      setCompareMode(false);
      return;
    }

    setCompareMode(true);
  };

  const tryLoadCompareSelection = useCallback(
    (requestId, selectionRequest) =>
      executeCompareSelectionLoad({
        requestId,
        selectionRequest,
        importMode,
        compareSelectionRequestIdRef,
        compareLoadIdRef,
        pendingPrimarySelectionRef,
        currentShotRef,
        setPendingCompareSelection,
        setComparePendingKeys,
        setCompareIsSearchingProfile,
        setCompareShots,
      }),
    [importMode],
  );

  const launchCompareSelectionLoad = useCallback(
    (requestId, selectionRequest) => {
      tryLoadCompareSelection(requestId, selectionRequest).catch(error => {
        console.error('Compare selection load failed:', error);
      });
    },
    [tryLoadCompareSelection],
  );

  const handleCompareShotToggle = useCallback(
    (request, checked) => {
      if (!checked) {
        clearPendingCompareSelection();
        clearCompareSelectionState({
          compareLoadIdRef,
          setCompareShots,
          setComparePendingKeys,
          setCompareResults,
          setCompareIsSearchingProfile,
        });
        return;
      }

      const selectionRequest = normalizeCompareSelectionRequest(request);
      const currentPrimaryShot = pendingPrimarySelectionRef.current?.shot || currentShotRef.current;
      const currentPrimaryShotKey = currentPrimaryShot
        ? getShotIdentityKey(currentPrimaryShot)
        : '';

      if (!selectionRequest?.item || !currentPrimaryShotKey) return;
      if (!compareMode) setCompareMode(true);

      const shotKey = getShotIdentityKey(selectionRequest.item);
      const currentCompareShot =
        pendingCompareSelectionRef.current?.shot || compareShotsRef.current[0]?.shot;
      const currentCompareShotKey = currentCompareShot
        ? getShotIdentityKey(currentCompareShot)
        : '';

      if (!shotKey || shotKey === currentCompareShotKey) return;
      if (shotKey === currentPrimaryShotKey && !selectionRequest.direction) return;

      const requestId = ++compareSelectionRequestIdRef.current;
      const loadId = ++compareLoadIdRef.current;
      clearCompareSelectionTimer();
      setPendingCompareSelection({
        shot: selectionRequest.item,
        name: selectionRequest.name,
      });
      setComparePendingKeys([shotKey]);
      setCompareIsSearchingProfile(false);

      const nextSelectionRequest = {
        ...selectionRequest,
        loadId,
      };

      if (
        hasLoadedShotPayload(selectionRequest.item) ||
        !compareShotsRef.current[0]?.shot ||
        selectionRequest.debounceMs <= 0
      ) {
        launchCompareSelectionLoad(requestId, nextSelectionRequest);
        return;
      }

      compareSelectionTimerRef.current = setTimeout(() => {
        compareSelectionTimerRef.current = null;
        launchCompareSelectionLoad(requestId, nextSelectionRequest);
      }, selectionRequest.debounceMs);
    },
    [
      clearCompareSelectionTimer,
      clearPendingCompareSelection,
      compareMode,
      launchCompareSelectionLoad,
      normalizeCompareSelectionRequest,
    ],
  );

  const handleCompareProfileLoad = (data, name, source) => {
    cancelCompareProfileSearch();
    const nextProfile = normalizeMatchedProfileSource(data, source);
    setCompareShots(currentEntries =>
      currentEntries.map((entry, index) =>
        index === 0
          ? {
              ...entry,
              profile: nextProfile,
              profileName: getProfileDisplayLabel(data, name),
              profileSelectionMode: 'manual',
            }
          : entry,
      ),
    );
  };

  const handleCompareProfileUnload = () => {
    cancelCompareProfileSearch();
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
  };

  const handleRetryCompareProfileSearch = async () => {
    const secondaryEntry = compareShots[0];
    if (!secondaryEntry?.shot?.profile) return;

    cancelCompareProfileSearch();
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

    clearPendingPrimarySelection();
    clearPendingCompareSelection();
    compareLoadIdRef.current += 1;
    compareProfileMatchIdRef.current += 1;

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

  const displayCurrentShot = pendingPrimarySelection?.shot || currentShot;
  const statsHref = buildStatisticsProfileHref({
    source: currentProfile?.source,
    profileName: currentProfileName,
  });

  const currentShotKey = currentShot ? getShotIdentityKey(currentShot) : '';
  const displayCurrentShotKey = displayCurrentShot ? getShotIdentityKey(displayCurrentShot) : '';
  const compareSelectionKeys = new Set(comparePendingKeys);
  compareShots.forEach(entry => compareSelectionKeys.add(entry.key));
  if (compareMode && displayCurrentShotKey) compareSelectionKeys.add(displayCurrentShotKey);

  const compareSelectedCount = compareSelectionKeys.size;
  const compareHasSecondaryShot = compareShots.length > 0 || Boolean(pendingCompareSelection);
  const compareSecondaryShot = compareShots[0] || null;
  const displayCompareSecondaryShot =
    pendingCompareSelection?.shot || compareSecondaryShot?.shot || null;
  const displayCompareSecondaryShotKey = displayCompareSecondaryShot
    ? getShotIdentityKey(displayCompareSecondaryShot)
    : '';
  const compareSecondaryProfile = compareSecondaryShot?.profile || null;
  const compareSecondaryStatsHref = buildStatisticsProfileHref({
    source: compareSecondaryProfile?.source,
    profileName: compareSecondaryShot?.profileName,
  });
  const persistStatisticsInitialContext = ({
    shotSource = currentShot?.source || 'both',
    profileSource = currentProfile?.source || 'both',
    profileName = currentProfileName,
    preferredDetailSection = null,
  } = {}) => {
    const statsInitialContext = {
      profileName,
      shotSource,
      profileSource,
      source: profileSource,
    };
    if (preferredDetailSection) {
      statsInitialContext.preferredDetailSection = preferredDetailSection;
    }
    sessionStorage.setItem('statsInitialContext', JSON.stringify(statsInitialContext));
  };
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

      <div className='w-full'>
        {/* Library Panel (Always visible) */}
        <div className='mt-4'>
          <LibraryPanel
            currentShot={currentShot}
            currentProfile={currentProfile}
            currentShotName={currentShotName}
            currentProfileName={currentProfileName}
            pendingPrimarySelection={pendingPrimarySelection}
            onShotSelect={handleShotSelect}
            onProfileLoad={handleProfileLoad}
            onShotUnload={() => {
              clearPendingPrimarySelection();
              clearPendingCompareSelection();
              resetCompareState({ disableMode: true });
              cancelPrimaryProfileSearch();
              setCurrentShot(null);
              setCurrentShotName('No Shot Loaded');
              setCurrentProfile(null);
              setCurrentProfileName('No Profile Loaded');
              setCurrentProfileSelectionMode('none');
              setAnalysisResults(null);
            }}
            onProfileUnload={handleProfileUnload}
            onShowStats={context => {
              persistStatisticsInitialContext({
                ...context,
                preferredDetailSection: compareMode ? 'compare' : null,
              });
            }}
            statsHref={statsHref}
            importMode={importMode}
            onImportModeChange={setImportMode}
            compareMode={compareMode}
            compareHasSecondaryShot={compareHasSecondaryShot}
            compareSelectedCount={compareSelectedCount}
            compareSelectionKeys={compareSelectionKeys}
            comparePendingKeys={comparePendingKeys}
            compareSecondaryShotKey={displayCompareSecondaryShotKey}
            secondaryShot={compareSecondaryShot?.shot || null}
            secondaryProfile={compareSecondaryProfile}
            secondaryShotName={compareSecondaryShot?.shotName || 'No Shot Loaded'}
            secondaryProfileName={compareSecondaryShot?.profileName || 'No Profile Loaded'}
            pendingCompareSelection={pendingCompareSelection}
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
