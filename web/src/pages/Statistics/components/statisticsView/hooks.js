// Custom hooks for StatisticsView state management: metadata, filters, compare, detail section, and bulk selection
import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import { libraryService } from '../../../ShotAnalyzer/services/LibraryService';
import {
  cleanName,
  isProfilePinned,
  isShotPinned,
  getShotPinBucketKey,
} from '../../../ShotAnalyzer/utils/analyzerUtils';
import { computeStatistics } from '../../services/StatisticsService';
import {
  parseStatisticsQuery,
  buildShotCandidatePredicate,
  resolveShotEffectiveTimestampMs,
} from '../../utils/statisticsSearchDsl';
import {
  getAvailableProfileNames,
  getShotSelectionKey,
  buildDateBasisWarningState,
  buildBaseFilterState,
  buildCandidateFilterState,
  buildShotSelectionItem,
  getCanonicalShotProfilePinKeyFromMap,
  formatDateTimeLocalInputValue,
  getPreferredStatisticsDetailSection,
  normalizeStatisticsDetailSection,
  resolveStatisticsDetailSectionChoice,
  parseDateInputMs,
  matchesPinnedShotMetaWithPins,
  getProfilePinDisabledReasonText,
  getShotPinDisabledReasonText,
} from './helpers';
import {
  runStatisticsAnalysis,
  buildStatisticsCompareEntries,
  getBuiltProfileCount,
  getBuiltDateRange,
} from './analysis';

export function useStatisticsMetadataState({
  apiService,
  shotSource,
  profileSource,
  initialProfileName,
  setSelectedProfileNames,
  setSelectedShotKeys,
}) {
  const [rawShotCandidates, setRawShotCandidates] = useState([]);
  const [rawProfiles, setRawProfiles] = useState([]);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataLoaded, setMetadataLoaded] = useState(false);
  const [metadataError, setMetadataError] = useState(null);
  const [metadataReloadNonce, setMetadataReloadNonce] = useState(0);
  const metaLoadIdRef = useRef(0);
  const initialProfilePresetAppliedRef = useRef(false);
  const gmPrefillRetryCountRef = useRef(0);

  useEffect(() => {
    libraryService.setApiService(apiService);
  }, [apiService]);

  useEffect(() => {
    const loadId = ++metaLoadIdRef.current;
    let cancelled = false;

    async function loadMetadata() {
      setMetadataLoading(true);
      setMetadataLoaded(false);
      setMetadataError(null);

      try {
        const [shotList, profileList] = await Promise.all([
          libraryService.getAllShots(shotSource),
          libraryService.getAllProfiles(profileSource),
        ]);

        if (cancelled || loadId !== metaLoadIdRef.current) return;

        setRawShotCandidates(Array.isArray(shotList) ? shotList : []);
        setRawProfiles(Array.isArray(profileList) ? profileList : []);
      } catch {
        if (cancelled || loadId !== metaLoadIdRef.current) return;
        setRawShotCandidates([]);
        setRawProfiles([]);
        setMetadataError('Failed to load shots/profiles for filtering.');
      } finally {
        if (!cancelled && loadId === metaLoadIdRef.current) {
          setMetadataLoading(false);
          setMetadataLoaded(true);
        }
      }
    }

    loadMetadata();

    return () => {
      cancelled = true;
    };
  }, [shotSource, profileSource, apiService, metadataReloadNonce]);

  useEffect(() => {
    gmPrefillRetryCountRef.current = 0;
  }, [profileSource, initialProfileName]);

  const availableProfiles = useMemo(() => getAvailableProfileNames(rawProfiles), [rawProfiles]);
  const normalizedAvailableProfilesMap = useMemo(() => {
    const map = new Map();
    for (const name of availableProfiles) {
      const normalized = cleanName(name).toLowerCase();
      if (normalized && !map.has(normalized)) {
        map.set(normalized, name);
      }
    }
    return map;
  }, [availableProfiles]);

  const rawShotKeyOrder = useMemo(
    () => (rawShotCandidates || []).map(getShotSelectionKey).filter(Boolean),
    [rawShotCandidates],
  );

  const shotKeyToCanonicalProfile = useMemo(() => {
    const map = new Map();
    for (const shot of rawShotCandidates || []) {
      const key = getShotSelectionKey(shot);
      if (!key) continue;
      const normalized = cleanName(shot?.profile || shot?.profileName || '').toLowerCase();
      const canonical = normalizedAvailableProfilesMap.get(normalized) || null;
      map.set(key, canonical);
    }
    return map;
  }, [rawShotCandidates, normalizedAvailableProfilesMap]);

  useEffect(() => {
    if (!metadataLoaded) return;

    const normalizedAvailableProfiles = new Map();
    for (const name of availableProfiles) {
      const normalized = cleanName(name).toLowerCase();
      if (normalized && !normalizedAvailableProfiles.has(normalized)) {
        normalizedAvailableProfiles.set(normalized, name);
      }
    }

    setSelectedProfileNames(prev => {
      const next = [];
      const seen = new Set();
      for (const name of prev) {
        const normalized = cleanName(name).toLowerCase();
        const canonical = normalizedAvailableProfiles.get(normalized);
        if (!canonical || seen.has(canonical)) continue;
        seen.add(canonical);
        next.push(canonical);
      }
      return next.length === prev.length && next.every((value, index) => value === prev[index])
        ? prev
        : next;
    });

    const validShotKeys = new Set(
      (rawShotCandidates || []).map(getShotSelectionKey).filter(Boolean),
    );
    setSelectedShotKeys(prev => {
      const next = prev.filter(id => validShotKeys.has(id));
      return next.length === prev.length && next.every((value, index) => value === prev[index])
        ? prev
        : next;
    });
  }, [
    availableProfiles,
    rawShotCandidates,
    metadataLoaded,
    setSelectedProfileNames,
    setSelectedShotKeys,
  ]);

  useEffect(() => {
    if (!metadataLoaded || initialProfilePresetAppliedRef.current) return;
    if (!initialProfileName) {
      initialProfilePresetAppliedRef.current = true;
      return;
    }

    const target = cleanName(initialProfileName).toLowerCase();
    if (!target) return;

    const canonical = availableProfiles.find(name => cleanName(name).toLowerCase() === target);
    if (!canonical) return;

    initialProfilePresetAppliedRef.current = true;
    setSelectedProfileNames([canonical]);
  }, [availableProfiles, initialProfileName, metadataLoaded, setSelectedProfileNames]);

  useEffect(() => {
    if (profileSource !== 'gaggimate') return;
    if (!initialProfileName) return;
    if (!metadataLoaded || metadataLoading || metadataError) return;
    if (initialProfilePresetAppliedRef.current) return;
    if ((availableProfiles || []).length > 0) return;
    if (gmPrefillRetryCountRef.current >= 3) return;

    const timer = setTimeout(() => {
      gmPrefillRetryCountRef.current += 1;
      setMetadataReloadNonce(value => value + 1);
    }, 450);

    return () => clearTimeout(timer);
  }, [
    profileSource,
    initialProfileName,
    metadataLoaded,
    metadataLoading,
    metadataError,
    availableProfiles,
  ]);

  return {
    rawShotCandidates,
    rawProfiles,
    metadataLoading,
    metadataLoaded,
    metadataError,
    rawShotKeyOrder,
    shotKeyToCanonicalProfile,
    availableProfiles,
  };
}

export function useStatisticsSelectionModel({
  rawShotCandidates,
  availableProfiles,
  rawShotKeyOrder,
  shotKeyToCanonicalProfile,
  pinnedProfiles,
  pinnedShotsByProfile,
  mode,
  selectedProfileNames,
  setSelectedProfileNames,
  selectedShotKeys,
  setSelectedShotKeys,
  query,
  dateFromLocal,
  dateToLocal,
  dateBasisMode,
}) {
  const matchesPinnedShotMeta = shotMeta =>
    matchesPinnedShotMetaWithPins(shotMeta, {
      shotKeyToCanonicalProfile,
      pinnedShotsByProfile,
      pinnedProfiles,
    });

  const getProfilePinDisabledReason = profileName =>
    getProfilePinDisabledReasonText(profileName, pinnedProfiles);

  const getShotPinDisabledReason = shotMeta =>
    getShotPinDisabledReasonText(shotMeta, shotKeyToCanonicalProfile, pinnedShotsByProfile);

  const dateBasisWarningState = useMemo(
    () => buildDateBasisWarningState(rawShotCandidates),
    [rawShotCandidates],
  );
  const parsedDslQuery = useMemo(() => parseStatisticsQuery(query), [query]);
  const compiledDslFilter = useMemo(
    () =>
      buildShotCandidatePredicate(parsedDslQuery, {
        dateBasisMode,
        matchesPinnedShot: matchesPinnedShotMeta,
      }),
    [parsedDslQuery, dateBasisMode, matchesPinnedShotMeta],
  );
  const visualDateFrom = useMemo(() => parseDateInputMs(dateFromLocal, 'start'), [dateFromLocal]);
  const visualDateTo = useMemo(() => parseDateInputMs(dateToLocal, 'end'), [dateToLocal]);

  const baseFilterState = useMemo(
    () =>
      buildBaseFilterState({
        compiledDslFilter,
        visualDateFrom,
        visualDateTo,
        dateBasisMode,
        rawShotCandidates,
      }),
    [compiledDslFilter, dateBasisMode, rawShotCandidates, visualDateFrom, visualDateTo],
  );

  const hasBaseParseErrors = baseFilterState.parseErrors.length > 0;
  const selectionScopeShots = useMemo(
    () => (hasBaseParseErrors ? rawShotCandidates || [] : baseFilterState.filteredShots),
    [hasBaseParseErrors, rawShotCandidates, baseFilterState.filteredShots],
  );
  const selectionScopeShotKeys = useMemo(
    () => (selectionScopeShots || []).map(getShotSelectionKey).filter(Boolean),
    [selectionScopeShots],
  );
  const selectionScopeShotKeySet = useMemo(
    () => new Set(selectionScopeShotKeys),
    [selectionScopeShotKeys],
  );

  const profilesPresentInBaseFilteredShots = useMemo(() => {
    const set = new Set();
    for (const shot of selectionScopeShots || []) {
      const key = getShotSelectionKey(shot);
      if (!key) continue;
      const canonical = shotKeyToCanonicalProfile.get(key);
      if (canonical) set.add(canonical);
    }
    return set;
  }, [selectionScopeShots, shotKeyToCanonicalProfile]);

  const baseCanonicalProfileToShotKeys = useMemo(() => {
    const map = new Map();
    for (const shot of selectionScopeShots || []) {
      const key = getShotSelectionKey(shot);
      if (!key) continue;
      const canonical = shotKeyToCanonicalProfile.get(key);
      if (!canonical) continue;
      if (!map.has(canonical)) map.set(canonical, []);
      map.get(canonical).push(key);
    }
    return map;
  }, [selectionScopeShots, shotKeyToCanonicalProfile]);

  const visibleProfileSelectionItems = useMemo(
    () =>
      availableProfiles
        .filter(name => profilesPresentInBaseFilteredShots.has(name))
        .map(name => ({
          id: name,
          primary: name,
          searchText: name,
          isPinned: isProfilePinned(name, pinnedProfiles),
          pinDisabledReason: getProfilePinDisabledReason(name),
        })),
    [
      availableProfiles,
      profilesPresentInBaseFilteredShots,
      pinnedProfiles,
      getProfilePinDisabledReason,
    ],
  );

  const visibleProfileIdSet = useMemo(
    () => new Set(visibleProfileSelectionItems.map(item => item.id)),
    [visibleProfileSelectionItems],
  );

  const baseShotSelectionItems = useMemo(
    () =>
      (selectionScopeShots || [])
        .map(shot => {
          const baseItem = buildShotSelectionItem(shot, dateBasisMode);
          const pinBucketKey =
            getCanonicalShotProfilePinKeyFromMap(shot, shotKeyToCanonicalProfile) ||
            getShotPinBucketKey(shot);
          return {
            ...baseItem,
            shotMeta: shot,
            pinBucketKey,
            isPinned: isShotPinned(shot, pinBucketKey, pinnedShotsByProfile),
            pinDisabledReason: getShotPinDisabledReason(shot),
          };
        })
        .filter(item => item.id),
    [
      selectionScopeShots,
      dateBasisMode,
      pinnedShotsByProfile,
      shotKeyToCanonicalProfile,
      getShotPinDisabledReason,
    ],
  );

  const selectedProfileNormalizedSet = useMemo(
    () =>
      new Set(
        (selectedProfileNames || []).map(name => cleanName(name).toLowerCase()).filter(Boolean),
      ),
    [selectedProfileNames],
  );

  const byProfileEligibleShots = useMemo(() => {
    if (selectedProfileNormalizedSet.size === 0) return [];
    return (selectionScopeShots || []).filter(shot => {
      const key = getShotSelectionKey(shot);
      if (!key) return false;
      const canonical = shotKeyToCanonicalProfile.get(key);
      if (!canonical) return false;
      return selectedProfileNormalizedSet.has(cleanName(canonical).toLowerCase());
    });
  }, [selectedProfileNormalizedSet, selectionScopeShots, shotKeyToCanonicalProfile]);

  const byProfileEligibleShotKeys = useMemo(
    () => byProfileEligibleShots.map(getShotSelectionKey).filter(Boolean),
    [byProfileEligibleShots],
  );
  const byProfileEligibleShotKeySet = useMemo(
    () => new Set(byProfileEligibleShotKeys),
    [byProfileEligibleShotKeys],
  );

  const byProfileShotSelectionItems = useMemo(
    () =>
      byProfileEligibleShots
        .map(shot => {
          const baseItem = buildShotSelectionItem(shot, dateBasisMode);
          const pinBucketKey =
            getCanonicalShotProfilePinKeyFromMap(shot, shotKeyToCanonicalProfile) ||
            getShotPinBucketKey(shot);
          return {
            ...baseItem,
            shotMeta: shot,
            pinBucketKey,
            isPinned: isShotPinned(shot, pinBucketKey, pinnedShotsByProfile),
            pinDisabledReason: getShotPinDisabledReason(shot),
          };
        })
        .filter(item => item.id),
    [
      byProfileEligibleShots,
      dateBasisMode,
      pinnedShotsByProfile,
      shotKeyToCanonicalProfile,
      getShotPinDisabledReason,
    ],
  );

  const selectedShotKeySet = useMemo(() => new Set(selectedShotKeys || []), [selectedShotKeys]);

  const derivedProfilesFromSelectedShots = useMemo(() => {
    const selectedProfileSet = new Set();
    for (const shot of selectionScopeShots || []) {
      const key = getShotSelectionKey(shot);
      if (!key || !selectedShotKeySet.has(key)) continue;
      const canonical = shotKeyToCanonicalProfile.get(key);
      if (canonical) selectedProfileSet.add(canonical);
    }
    return visibleProfileSelectionItems
      .map(item => item.id)
      .filter(profileName => selectedProfileSet.has(profileName));
  }, [
    selectionScopeShots,
    selectedShotKeySet,
    shotKeyToCanonicalProfile,
    visibleProfileSelectionItems,
  ]);

  const profileSelectionItems = visibleProfileSelectionItems;
  const shotSelectionItems =
    mode === 'profile' ? byProfileShotSelectionItems : baseShotSelectionItems;
  const displayedProfileSelection =
    mode === 'shots' ? derivedProfilesFromSelectedShots : selectedProfileNames;

  const candidateFilterState = useMemo(
    () =>
      buildCandidateFilterState({
        baseFilterState,
        mode,
        selectedProfileNames,
        selectedShotKeys,
        shotKeyToCanonicalProfile,
      }),
    [baseFilterState, mode, selectedProfileNames, selectedShotKeys, shotKeyToCanonicalProfile],
  );

  const dateInputPreviewRange = useMemo(() => {
    if (dateFromLocal || dateToLocal) {
      return { fromLocal: '', toLocal: '' };
    }

    let minTs = Infinity;
    let maxTs = -Infinity;
    for (const shot of candidateFilterState.filteredShots || []) {
      const ts = resolveShotEffectiveTimestampMs(shot, dateBasisMode);
      if (!Number.isFinite(ts)) continue;
      if (ts < minTs) minTs = ts;
      if (ts > maxTs) maxTs = ts;
    }

    if (!Number.isFinite(minTs) || !Number.isFinite(maxTs)) {
      return { fromLocal: '', toLocal: '' };
    }

    return {
      fromLocal: formatDateTimeLocalInputValue(minTs),
      toLocal: formatDateTimeLocalInputValue(maxTs),
    };
  }, [candidateFilterState.filteredShots, dateBasisMode, dateFromLocal, dateToLocal]);

  const orderShotSelection = nextSet => rawShotKeyOrder.filter(key => nextSet.has(key));

  const handleProfileSelectionChange = nextProfileNames => {
    const nextProfiles = Array.isArray(nextProfileNames) ? nextProfileNames : [];
    setSelectedProfileNames(nextProfiles);

    const nextProfileSet = new Set(
      nextProfiles.map(name => cleanName(name).toLowerCase()).filter(Boolean),
    );
    const nextShotKeys =
      nextProfileSet.size === 0
        ? []
        : (selectionScopeShots || [])
            .map(shot => {
              const key = getShotSelectionKey(shot);
              if (!key) return null;
              const canonical = shotKeyToCanonicalProfile.get(key);
              if (!canonical) return null;
              return nextProfileSet.has(cleanName(canonical).toLowerCase()) ? key : null;
            })
            .filter(Boolean);
    setSelectedShotKeys(nextShotKeys);
  };

  const handleByProfileShotSelectionChange = nextShotKeys => {
    setSelectedShotKeys(Array.isArray(nextShotKeys) ? nextShotKeys : []);
  };

  const handleShotSelectionChange = nextShotKeys => {
    setSelectedShotKeys(Array.isArray(nextShotKeys) ? nextShotKeys : []);
  };

  const handleByShotsProfileSelectionChange = nextProfileNames => {
    if (hasBaseParseErrors) return;

    const nextProfiles = new Set((nextProfileNames || []).filter(Boolean));
    const currentProfiles = new Set(derivedProfilesFromSelectedShots);
    const nextShotSet = new Set(selectedShotKeys);

    for (const profileName of currentProfiles) {
      if (nextProfiles.has(profileName)) continue;
      const profileShotKeys = baseCanonicalProfileToShotKeys.get(profileName) || [];
      for (const shotKey of profileShotKeys) nextShotSet.delete(shotKey);
    }

    for (const profileName of nextProfiles) {
      if (currentProfiles.has(profileName)) continue;
      const profileShotKeys = baseCanonicalProfileToShotKeys.get(profileName) || [];
      for (const shotKey of profileShotKeys) nextShotSet.add(shotKey);
    }

    setSelectedShotKeys(orderShotSelection(nextShotSet));
  };

  return {
    dateBasisWarningState,
    candidateFilterState,
    hasBaseParseErrors,
    selectionScopeShotKeySet,
    visibleProfileIdSet,
    byProfileEligibleShotKeys,
    byProfileEligibleShotKeySet,
    profileSelectionItems,
    shotSelectionItems,
    displayedProfileSelection,
    derivedProfilesFromSelectedShots,
    baseCanonicalProfileToShotKeys,
    dateInputPreviewRange,
    handleProfileSelectionChange,
    handleByProfileShotSelectionChange,
    handleShotSelectionChange,
    handleByShotsProfileSelectionChange,
  };
}

export function useStatisticsSelectionSync({
  mode,
  metadataLoaded,
  hasBaseParseErrors,
  visibleProfileIdSet,
  shotSource,
  profileSource,
  selectedProfileNames,
  byProfileEligibleShotKeys,
  byProfileEligibleShotKeySet,
  selectionScopeShotKeySet,
  setSelectedProfileNames,
  setSelectedShotKeys,
}) {
  const profileModeShotSeedSignatureRef = useRef('');

  useEffect(() => {
    if (mode !== 'profile') {
      profileModeShotSeedSignatureRef.current = '';
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== 'profile' || !metadataLoaded || hasBaseParseErrors) return;

    setSelectedProfileNames(prev => {
      const next = (prev || []).filter(name => visibleProfileIdSet.has(name));
      return next.length === prev.length && next.every((value, index) => value === prev[index])
        ? prev
        : next;
    });
  }, [mode, metadataLoaded, hasBaseParseErrors, visibleProfileIdSet, setSelectedProfileNames]);

  useEffect(() => {
    if (mode !== 'profile' || !metadataLoaded || hasBaseParseErrors) return;

    const signature = JSON.stringify({
      mode,
      shotSource,
      profileSource,
      profiles: [...selectedProfileNames].sort((a, b) => a.localeCompare(b)),
    });
    const shouldSeedAll = profileModeShotSeedSignatureRef.current !== signature;
    profileModeShotSeedSignatureRef.current = signature;

    setSelectedShotKeys(prev => {
      if (shouldSeedAll) return [...byProfileEligibleShotKeys];
      const next = (prev || []).filter(id => byProfileEligibleShotKeySet.has(id));
      return next.length === prev.length && next.every((value, index) => value === prev[index])
        ? prev
        : next;
    });
  }, [
    mode,
    metadataLoaded,
    hasBaseParseErrors,
    shotSource,
    profileSource,
    selectedProfileNames,
    byProfileEligibleShotKeys,
    byProfileEligibleShotKeySet,
    setSelectedShotKeys,
  ]);

  useEffect(() => {
    if (mode !== 'shots' || !metadataLoaded || hasBaseParseErrors) return;

    setSelectedShotKeys(prev => {
      const next = (prev || []).filter(id => selectionScopeShotKeySet.has(id));
      return next.length === prev.length && next.every((value, index) => value === prev[index])
        ? prev
        : next;
    });
  }, [mode, metadataLoaded, hasBaseParseErrors, selectionScopeShotKeySet, setSelectedShotKeys]);
}

export function useStatisticsRunExecution({
  runRequest,
  analyzeLoadIdRef,
  entriesRef,
  setLoading,
  setError,
  setResult,
  setProgress,
}) {
  useEffect(() => {
    if (!runRequest) return;

    const loadId = ++analyzeLoadIdRef.current;
    let cancelled = false;

    async function loadAndAnalyze() {
      setLoading(true);
      setError(null);
      setResult(null);
      setProgress({ current: 0, total: 0 });

      try {
        const entries = await runStatisticsAnalysis({
          isCurrentRun: () => !cancelled && loadId === analyzeLoadIdRef.current,
          onProgress: setProgress,
          runRequest,
        });
        if (!entries) return;

        entriesRef.current = entries;
        setResult(computeStatistics(entries));
      } catch {
        if (cancelled || loadId !== analyzeLoadIdRef.current) return;
        setError('Failed to load statistics. Please try again.');
      } finally {
        if (!cancelled && loadId === analyzeLoadIdRef.current) {
          setLoading(false);
        }
      }
    }

    loadAndAnalyze();

    return () => {
      cancelled = true;
    };
  }, [runRequest, analyzeLoadIdRef, entriesRef, setError, setLoading, setProgress, setResult]);
}

export function useStatisticsResultViewState({
  result,
  runRequest,
  statisticsDetailSection,
  setStatisticsDetailSection,
  initializedDetailSectionRunIdRef,
  entriesRef,
  preparingRun,
  loading,
  error,
  metadataError,
}) {
  useEffect(() => {
    if (!result || !runRequest?.id) return;
    if (initializedDetailSectionRunIdRef.current === runRequest.id) return;

    const hasCompareStatistics = Array.isArray(entriesRef.current) && entriesRef.current.length > 0;
    const hasProfileGroups = Array.isArray(result.profileGroups) && result.profileGroups.length > 0;
    const hasPhaseStats = Array.isArray(result.phaseStats) && result.phaseStats.length > 0;
    const hasMetricStats = Boolean(result.metrics && Object.keys(result.metrics).length > 0);
    const hasTrendStats = Array.isArray(result.trends) && result.trends.length > 1;
    const defaultSection = getPreferredStatisticsDetailSection({
      runMode: runRequest.mode,
      hasCompareStatistics,
      hasMetricStatistics: hasMetricStats,
      hasTrendStatistics: hasTrendStats,
    });
    const preferredRunSection = normalizeStatisticsDetailSection(runRequest.preferredDetailSection);
    const nextSection = resolveStatisticsDetailSectionChoice({
      candidate:
        preferredRunSection ||
        normalizeStatisticsDetailSection(statisticsDetailSection) ||
        defaultSection,
      hasCompareStatistics,
      hasMetricStatistics: hasMetricStats,
      hasTrendStatistics: hasTrendStats,
      hasProfileGroupStatistics: hasProfileGroups,
      hasPhaseStatistics: hasPhaseStats,
    });

    setStatisticsDetailSection(nextSection);
    initializedDetailSectionRunIdRef.current = runRequest.id;
  }, [
    entriesRef,
    initializedDetailSectionRunIdRef,
    result,
    runRequest,
    setStatisticsDetailSection,
    statisticsDetailSection,
  ]);

  const hasProfileGroupStatistics = result?.profileGroups?.length > 0;
  const hasPhaseStatistics = result?.phaseStats?.length > 0;
  const hasMetricStatistics = Boolean(result?.metrics && Object.keys(result.metrics).length > 0);
  const hasTrendStatistics = Array.isArray(result?.trends) && result.trends.length > 1;
  const hasStatisticsCompare = Array.isArray(entriesRef.current) && entriesRef.current.length > 0;
  const fallbackStatisticsDetailSection = getPreferredStatisticsDetailSection({
    runMode: runRequest?.mode,
    hasCompareStatistics: hasStatisticsCompare,
    hasMetricStatistics,
    hasTrendStatistics,
  });
  const preferredRunSection = normalizeStatisticsDetailSection(runRequest?.preferredDetailSection);
  const detailSectionCandidate =
    initializedDetailSectionRunIdRef.current === runRequest?.id
      ? statisticsDetailSection
      : preferredRunSection ||
        normalizeStatisticsDetailSection(statisticsDetailSection) ||
        fallbackStatisticsDetailSection;
  const resolvedStatisticsDetailSection = resolveStatisticsDetailSectionChoice({
    candidate: detailSectionCandidate,
    hasCompareStatistics: hasStatisticsCompare,
    hasMetricStatistics,
    hasTrendStatistics,
    hasProfileGroupStatistics,
    hasPhaseStatistics,
  });
  const statisticsCompareEntries = useMemo(
    () => buildStatisticsCompareEntries(result, runRequest, entriesRef),
    [entriesRef, result, runRequest],
  );
  const shouldHidePhaseExitReasons = statisticsCompareEntries.length > 2;
  const builtShotCount = Number.isFinite(result?.summary?.totalShots)
    ? result.summary.totalShots
    : 0;
  const builtProfileCount = useMemo(
    () => getBuiltProfileCount(entriesRef),
    [entriesRef, result, runRequest],
  );
  const builtDateRange = useMemo(
    () => getBuiltDateRange(entriesRef, runRequest?.dateBasisMode || 'auto'),
    [entriesRef, result, runRequest],
  );
  const shouldShowEmptyStatisticsState =
    !preparingRun && !loading && !result && !error && !metadataError;

  return {
    hasProfileGroupStatistics,
    hasPhaseStatistics,
    hasMetricStatistics,
    hasTrendStatistics,
    resolvedStatisticsDetailSection,
    statisticsCompareEntries,
    shouldHidePhaseExitReasons,
    builtShotCount,
    builtProfileCount,
    builtDateRange,
    shouldShowEmptyStatisticsState,
  };
}
