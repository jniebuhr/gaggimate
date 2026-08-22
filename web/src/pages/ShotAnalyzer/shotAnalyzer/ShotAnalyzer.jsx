/** Coordinates analyzer state, loading, matching, and compare workflows. */

import { useState, useEffect, useContext, useRef, useCallback } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import { LibraryPanel } from '../components/LibraryPanel';
import { EmptyState } from '../components/EmptyState.jsx';
import { useAnalyzerMobileSubpageNavigation } from '../components/useAnalyzerMobileSubpageNavigation';
import { libraryService } from '../services/LibraryService';
import { notesService } from '../services/NotesService';
import { ApiServiceContext } from '../../../services/ApiService';
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
} from '../utils/analyzerUtils';
import { ActiveAnalysisView } from './ActiveAnalysisView';
import { clearCompareSelectionState, executeCompareSelectionLoad } from './compareSelection';
import {
  PROFILE_AUTO_MATCH_INITIAL_DELAY_MS,
  PROFILE_AUTO_MATCH_MAX_ATTEMPTS,
  PROFILE_AUTO_MATCH_RETRY_DELAY_MS,
  analyzeShot,
  findPreferredProfileMatch,
  getNextDirectionalSelection,
  getShotSelectionProfileName,
  hasLoadedShotPayload,
  isAlreadyLoadedDeepLink,
  loadPreferredAutoMatchedProfile,
  loadShotSelection,
  normalizeMatchedProfileSource,
  normalizeSelectionRequest,
  shouldAutoScrollAnalyzerOnSelection,
} from './shotSelection';
import {
  buildShotAnalyzerViewModel,
  persistStatisticsInitialContext,
} from './shotAnalyzerViewModel';
import { useDesktopShotDetailsHeight } from './useDesktopShotDetailsHeight';

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
  const [isSearchingProfile, setIsSearchingProfile] = useState(false);

  const [activeColumns, setActiveColumns] = useState(() => {
    const userStandard = loadFromStorage(ANALYZER_DB_KEYS.USER_STANDARD);
    return userStandard ? new Set(userStandard) : getDefaultColumns();
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
  const [pendingDesktopLibraryScroll, setPendingDesktopLibraryScroll] = useState(false);
  const analysisSectionRef = useRef(null);
  const libraryPanelRef = useRef(null);
  const shotDetailsColumnRef = useRef(null);
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
      setAnalysisResults(analyzeShot(currentShot, currentProfile));
    } catch (e) {
      console.error('Analysis failed:', e);
      setAnalysisResults(null);
    }
  }, [currentProfile, currentShot]);

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
  }, [currentShot, currentProfile, performAnalysis]);

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
    if (!pendingDesktopLibraryScroll || !currentShot) return;
    if (!globalThis.window) return;

    const timer = globalThis.window?.setTimeout(() => {
      libraryPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setPendingDesktopLibraryScroll(false);
    }, 350);

    return () => globalThis.window?.clearTimeout(timer);
  }, [pendingDesktopLibraryScroll, currentShot]);

  useEffect(() => {
    if (compareShots.length === 0) {
      setCompareResults([]);
      return;
    }

    const nextResults = compareShots.reduce((acc, entry) => {
      try {
        acc.push({
          key: entry.key,
          results: analyzeShot(entry.shot, entry.profile),
        });
      } catch (error) {
        console.error(`Compare analysis failed for ${entry.key}:`, error);
      }
      return acc;
    }, []);

    setCompareResults(nextResults);
  }, [compareShots]);

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

      if (requestSelectionScroll) {
        if (shouldAutoScrollAnalyzerOnSelection()) {
          setPendingMobileAnalysisScroll(true);
        } else {
          setPendingDesktopLibraryScroll(true);
        }
      }

      setLoading(false);
    },
    [cancelPrimaryProfileSearch, clearPrimarySelectionTimer, importMode, resetCompareState],
  );

  useEffect(() => {
    const loadDeepLink = async () => {
      if (!params.source || !params.id) return;

      let serviceSource = params.source;
      if (params.source === 'internal') serviceSource = 'gaggimate';
      if (params.source === 'external') serviceSource = 'browser';

      if (isAlreadyLoadedDeepLink({ currentShot, params: { id: params.id }, serviceSource }))
        return;

      try {
        setLoading(true);
        const shot = await libraryService.loadShot(params.id, serviceSource);

        if (shot) {
          // URL sources are aliases; normalize them before the analyzer stores the shot.
          shot.source = serviceSource;
          commitPrimaryShotLoad(shot, shot.name || params.id);
        }
      } catch (e) {
        console.error('Deep Link Load Failed:', e);
      }
    };

    if (apiService) {
      loadDeepLink();
    }
  }, [apiService, commitPrimaryShotLoad, currentShot, params.id, params.source]);

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
      tryLoadCompareSelection(requestId, selectionRequest)
        .then(didLoadCompareShot => {
          if (didLoadCompareShot && shouldAutoScrollAnalyzerOnSelection()) {
            setPendingMobileAnalysisScroll(true);
          }
        })
        .catch(error => {
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

  const {
    chartMountKey,
    compareCollectionWithAccents,
    compareDetailsKey,
    compareHasSecondaryShot,
    compareSecondaryProfile,
    compareSecondaryShot,
    compareSecondaryStatsHref,
    compareSelectedCount,
    compareSelectionKeys,
    displayCompareSecondaryShotKey,
    isCompareActive,
    shotDetailsEntries,
    statsHref,
  } = buildShotAnalyzerViewModel({
    analysisResults,
    compareMode,
    comparePendingKeys,
    compareResults,
    compareShots,
    currentProfile,
    currentProfileName,
    currentShot,
    currentShotName,
    pendingCompareSelection,
    pendingPrimarySelection,
  });
  const mobileSubpageNavigation = useAnalyzerMobileSubpageNavigation({
    analysisEnabled: Boolean(currentShot && analysisResults),
    notesEnabled: Boolean(currentShot && isCompareActive),
    viewKey: `${chartMountKey}|${compareDetailsKey}`,
  });
  const { singleDesktopDetailsHeight, singleDesktopChartStyle } = useDesktopShotDetailsHeight({
    analysisResults,
    chartMountKey,
    currentShot,
    isCompareActive,
    shotDetailsColumnRef,
  });

  return (
    <div className='shot-analyzer-page pb-20'>
      {/* Header */}
      <div className='mb-4 flex flex-row items-center gap-2'>
        <h2 className='flex-grow text-2xl font-bold sm:text-3xl'>Deep Dive Shot Analyzer</h2>
      </div>

      <div className='w-full'>
        {/* Library Panel (Always visible) */}
        <div ref={libraryPanelRef} className='mt-4'>
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
            onShowStats={context =>
              persistStatisticsInitialContext({
                context: {
                  ...context,
                  preferredDetailSection: compareMode ? 'compare' : null,
                },
                currentProfile,
                currentProfileName,
                currentShot,
              })
            }
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
            isSearchingProfile={isSearchingProfile}
            compareIsSearchingProfile={compareIsSearchingProfile}
          />
        </div>

        {currentShot ? (
          <ActiveAnalysisView
            activeColumns={activeColumns}
            analysisResults={analysisResults}
            analysisSectionRef={analysisSectionRef}
            chartMountKey={chartMountKey}
            compareCollectionWithAccents={compareCollectionWithAccents}
            compareTargetDisplayMode={compareTargetDisplayMode}
            currentShot={currentShot}
            handleSwapCompareSlots={handleSwapCompareSlots}
            isCompareActive={isCompareActive}
            mobileSubpageNavigation={mobileSubpageNavigation}
            setActiveColumns={setActiveColumns}
            setCompareTargetDisplayMode={setCompareTargetDisplayMode}
            shotDetailsColumnRef={shotDetailsColumnRef}
            shotDetailsEntries={shotDetailsEntries}
            singleDesktopChartStyle={singleDesktopChartStyle}
            singleDesktopDetailsHeight={singleDesktopDetailsHeight}
          />
        ) : (
          <div className='mt-6'>
            <EmptyState loading={loading} />
          </div>
        )}
      </div>
    </div>
  );
}
