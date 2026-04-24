import { useState, useEffect, useRef, useContext, useMemo, useCallback } from 'preact/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay } from '@fortawesome/free-solid-svg-icons/faPlay';
import { ApiServiceContext } from '../../../services/ApiService';
import { libraryService } from '../../ShotAnalyzer/services/LibraryService';
import { calculateShotMetrics, detectAutoDelay } from '../../ShotAnalyzer/services/AnalyzerService';
import { computeStatistics } from '../services/StatisticsService';
import {
  ANALYZER_DB_KEYS,
  MAX_PINNED_PROFILES,
  MAX_PINNED_SHOTS_PER_PROFILE,
  PINNED_NO_PROFILE_BUCKET,
  cleanName,
  getPinnedProfiles,
  getPinnedShotsByProfile,
  getProfileDisplayLabel,
  getProfilePinKey,
  getShotDisplayName,
  getShotPinBucketKey,
  isProfilePinned,
  isShotPinned,
  isShotPinnedAnywhere,
  loadFromStorage,
  normalizeCompareTargetDisplayMode,
  saveToStorage,
  toggleProfilePin,
  toggleShotPin,
} from '../../ShotAnalyzer/utils/analyzerUtils';
import { StatisticsToolbar, STATISTICS_RUN_BUTTON_TONE_CLASS } from './StatisticsToolbar';
import { SummaryCards } from './SummaryCards';
import { MetricsTable } from './MetricsTable';
import { ProfileGroupTable } from './ProfileGroupTable';
import { PhaseStatistics } from './PhaseStatistics';
import { StatisticsShotCompareSection } from './StatisticsShotCompareSection';
import { TrendChart } from './TrendChart';
import { STATISTICS_SECTION_TITLE_CLASS } from './statisticsUi';
import {
  buildShotCandidatePredicate,
  parseStatisticsQuery,
  resolveShotEffectiveTimestampMs,
} from '../utils/statisticsSearchDsl';
import {
  normalizeStatisticsSourceSelection,
  STATISTICS_SOURCE_FALLBACK,
} from '../utils/statisticsRoute';

// StatisticsView orchestrates metadata loading, filter state, and batch analysis runs.
// StatisticsService remains pure; this component handles UI-specific selection semantics.
const BATCH_SIZE = 5;
const DEFAULT_SETTINGS = { scaleDelayMs: 200, sensorDelayMs: 200, isAutoAdjusted: true };
const NO_PROFILE_LOADED = 'No Profile Loaded';
const STATISTICS_PANEL_CLASS = 'bg-base-100 border-base-content/10 rounded-xl border shadow-sm';

function getStatisticsFallbackSource(source) {
  return STATISTICS_SOURCE_FALLBACK[source] || null;
}

function getInitialProfileName(initialContext) {
  const profileName = initialContext?.profileName;
  if (profileName && profileName !== NO_PROFILE_LOADED) return profileName;
  return '';
}

function getAvailableProfileNames(profileList) {
  const profileNames = [];
  for (const p of profileList || []) {
    const displayName = getProfileDisplayLabel(p, '');
    if (displayName) profileNames.push(displayName);
  }
  profileNames.sort((a, b) => a.localeCompare(b));
  return [...new Set(profileNames)];
}

function parseDateInputMs(value, boundary = 'start') {
  if (!value) return { valueMs: null, error: null };

  const normalizedValue = String(value).trim();
  const dateOnlyMatch = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    const yearNum = Number(year);
    const monthNum = Number(month);
    const dayNum = Number(day);
    const date = new Date(
      yearNum,
      monthNum - 1,
      dayNum,
      boundary === 'end' ? 23 : 0,
      boundary === 'end' ? 59 : 0,
      boundary === 'end' ? 59 : 0,
      boundary === 'end' ? 999 : 0,
    );
    if (
      date.getFullYear() !== yearNum ||
      date.getMonth() + 1 !== monthNum ||
      date.getDate() !== dayNum
    ) {
      return { valueMs: null, error: `Invalid date: ${value}` };
    }
    const valueMs = date.getTime();
    if (!Number.isFinite(valueMs)) {
      return { valueMs: null, error: `Invalid date: ${value}` };
    }
    return { valueMs, error: null };
  }

  const date = new Date(normalizedValue);
  const valueMs = date.getTime();
  if (!Number.isFinite(valueMs)) {
    return { valueMs: null, error: `Invalid date/time: ${value}` };
  }
  return { valueMs, error: null };
}

function formatDateTimeLocalInputValue(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const date = new Date(ms);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getShotSelectionKey(shotMeta) {
  if (!shotMeta) return '';
  if (shotMeta.source === 'gaggimate') return `gaggimate:${String(shotMeta.id || '')}`;
  return `browser:${String(shotMeta.storageKey || shotMeta.name || shotMeta.id || '')}`;
}

function getSourceShortLabel(source) {
  if (source === 'gaggimate') return 'GM';
  if (source === 'browser') return 'WEB';
  return 'SRC';
}

function formatShotDateTime(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return 'No date';
  try {
    return new Date(ms).toLocaleString(undefined, {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'No date';
  }
}

function getShotDisplayPrimary(shotMeta) {
  return String(
    shotMeta?.name || shotMeta?.label || shotMeta?.title || shotMeta?.id || 'Unknown Shot',
  );
}

function stripFileExtension(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.replace(/\.[^./\\]{1,8}$/, '');
}

function getShotFileStem(shotMeta) {
  const fileName = shotMeta?.name || shotMeta?.storageKey;
  if (fileName) return String(stripFileExtension(fileName));
  return String(shotMeta?.label || shotMeta?.title || shotMeta?.id || 'Unknown Shot');
}

function getShotDisplaySecondary(shotMeta, dateBasisMode) {
  const ts = resolveShotEffectiveTimestampMs(shotMeta, dateBasisMode || 'auto');
  return `${formatShotDateTime(ts)} • ${getSourceShortLabel(shotMeta?.source)}`;
}

function isStatisticsHotkeyBlockedTarget(target) {
  const activeElement =
    typeof Element !== 'undefined' && target instanceof Element ? target : document.activeElement;
  if (!activeElement) return false;
  const tag = activeElement.tagName?.toLowerCase();
  if (activeElement.isContentEditable) return true;
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button') return true;
  return !!activeElement.closest(
    'input, textarea, select, button, summary, a[href], [contenteditable="true"], [role="textbox"]',
  );
}

function buildShotSelectionItem(shot, dateBasisMode) {
  return {
    id: getShotSelectionKey(shot),
    primary: getShotDisplayPrimary(shot),
    fileStem: getShotFileStem(shot),
    shotId: String(shot?.id || shot?.storageKey || shot?.name || ''),
    secondary: getShotDisplaySecondary(shot, dateBasisMode),
    searchText: `${shot?.id || ''} ${shot?.profile || ''} ${shot?.name || ''} ${shot?.source || ''}`,
  };
}

function getStatisticsCompareFallbackKey(entry, index) {
  return (
    entry?.meta?.selectionKey || `${entry?.meta?.source || 'shot'}:${entry?.meta?.id || index}`
  );
}

function buildStatisticsCompareEntry(entry, { key, isReference = false } = {}) {
  if (!entry?.shotData || !entry?.analysis) return null;

  return {
    key,
    shot: entry.shotData,
    shotName: entry.shotData.name || entry.meta?.id,
    label: entry.meta?.displayName || getShotDisplayName(entry.shotData),
    profile: entry.profileData || null,
    profileName: entry.meta?.profileName,
    results: entry.analysis,
    isReference,
  };
}

function getPreferredStatisticsDetailSection({
  runMode,
  hasCompareStatistics,
  hasMetricStatistics,
  hasTrendStatistics,
}) {
  if (hasMetricStatistics) return 'metrics';
  if (hasTrendStatistics) return 'trends';
  if (hasCompareStatistics) return 'compare';
  return runMode === 'profile' ? 'phase' : 'profile';
}

function normalizeStatisticsDetailSection(value) {
  return ['metrics', 'trends', 'compare', 'profile', 'phase'].includes(value) ? value : null;
}

function resolveStatisticsDetailSectionChoice({
  candidate,
  hasCompareStatistics,
  hasMetricStatistics,
  hasTrendStatistics,
  hasProfileGroupStatistics,
  hasPhaseStatistics,
}) {
  const availabilityBySection = {
    compare: hasCompareStatistics,
    metrics: hasMetricStatistics,
    trends: hasTrendStatistics,
    profile: hasProfileGroupStatistics,
    phase: hasPhaseStatistics,
  };

  if (availabilityBySection[candidate]) {
    return candidate;
  }

  const fallbackOrder = ['compare', 'metrics', 'trends', 'profile', 'phase'];
  const fallbackSection = fallbackOrder.find(section => availabilityBySection[section]);
  if (fallbackSection) {
    return fallbackSection;
  }

  return candidate;
}

function getCanonicalShotProfilePinKeyFromMap(shotMeta, shotKeyToCanonicalProfile) {
  const shotKey = getShotSelectionKey(shotMeta);
  const canonicalProfile = shotKeyToCanonicalProfile.get(shotKey);
  return canonicalProfile
    ? getProfilePinKey(canonicalProfile)
    : getProfilePinKey(shotMeta?.profile || shotMeta?.profileName || '');
}

function matchesPinnedShotMetaWithPins(
  shotMeta,
  { shotKeyToCanonicalProfile, pinnedShotsByProfile, pinnedProfiles },
) {
  const shotKey = getShotSelectionKey(shotMeta);
  const profilePinKey = getCanonicalShotProfilePinKeyFromMap(shotMeta, shotKeyToCanonicalProfile);
  return (
    isShotPinnedAnywhere(shotKey, pinnedShotsByProfile) ||
    (profilePinKey ? isProfilePinned(profilePinKey, pinnedProfiles) : false)
  );
}

function getProfilePinDisabledReasonText(profileName, pinnedProfiles) {
  if (isProfilePinned(profileName, pinnedProfiles)) return '';
  if (pinnedProfiles.length >= MAX_PINNED_PROFILES) {
    return `Maximum ${MAX_PINNED_PROFILES} pinned profiles`;
  }
  return '';
}

function getShotPinDisabledReasonText(shotMeta, shotKeyToCanonicalProfile, pinnedShotsByProfile) {
  const bucketKey =
    getCanonicalShotProfilePinKeyFromMap(shotMeta, shotKeyToCanonicalProfile) ||
    getShotPinBucketKey(shotMeta);
  if (isShotPinned(shotMeta, bucketKey, pinnedShotsByProfile)) return '';

  const pinnedCount = (pinnedShotsByProfile[bucketKey] || []).length;
  if (pinnedCount >= MAX_PINNED_SHOTS_PER_PROFILE) {
    return bucketKey === PINNED_NO_PROFILE_BUCKET
      ? `Maximum ${MAX_PINNED_SHOTS_PER_PROFILE} pinned shots without a profile`
      : `Maximum ${MAX_PINNED_SHOTS_PER_PROFILE} pinned shots per profile`;
  }

  return '';
}

function buildDateBasisWarningState(rawShotCandidates) {
  let missingShotTimestampCount = 0;
  let uploadFallbackCount = 0;
  let noUsableDateCount = 0;

  for (const shot of rawShotCandidates || []) {
    const shotTs = resolveShotEffectiveTimestampMs(shot, 'shot');
    if (Number.isFinite(shotTs)) continue;

    missingShotTimestampCount += 1;
    const uploadTs = resolveShotEffectiveTimestampMs(shot, 'upload');
    if (Number.isFinite(uploadTs)) uploadFallbackCount += 1;
    else noUsableDateCount += 1;
  }

  const showDateBasisWarning = missingShotTimestampCount > 0;
  let dateBasisWarningMessage = null;

  if (showDateBasisWarning) {
    if (uploadFallbackCount > 0 && noUsableDateCount > 0) {
      dateBasisWarningMessage =
        'Some shots have no shot timestamp. Choose how date handling should treat them (Shot = exclude missing, Auto = fallback to upload time, Upload = upload time only). Some shots have no usable date at all and may still be excluded from date filtering.';
    } else if (uploadFallbackCount > 0) {
      dateBasisWarningMessage =
        'Some shots have no shot timestamp. Choose how date handling should treat them (Shot = exclude missing, Auto = fallback to upload time, Upload = upload time only).';
    } else {
      dateBasisWarningMessage =
        'Some shots have no usable shot timestamp. Date filtering may exclude them unless upload time is available.';
    }
  }

  return {
    showDateBasisWarning,
    dateBasisWarningMessage,
    missingShotTimestampCount,
    uploadFallbackCount,
    noUsableDateCount,
  };
}

function buildBaseFilterState({
  compiledDslFilter,
  visualDateFrom,
  visualDateTo,
  dateBasisMode,
  rawShotCandidates,
}) {
  const parseErrors = [...compiledDslFilter.errors];
  const parseWarnings = [...compiledDslFilter.warnings];

  if (visualDateFrom.error) {
    parseErrors.push({
      code: 'visual_date_from_invalid',
      message: visualDateFrom.error,
    });
  }
  if (visualDateTo.error) {
    parseErrors.push({
      code: 'visual_date_to_invalid',
      message: visualDateTo.error,
    });
  }

  if (
    Number.isFinite(visualDateFrom.valueMs) &&
    Number.isFinite(visualDateTo.valueMs) &&
    visualDateFrom.valueMs > visualDateTo.valueMs
  ) {
    parseErrors.push({
      code: 'visual_date_range_invalid',
      message: 'Date range invalid: From is after To.',
    });
  }

  if (parseErrors.length > 0) {
    return { filteredShots: [], count: null, parseErrors, parseWarnings };
  }

  const filteredShots = (rawShotCandidates || []).filter(shot => {
    if (Number.isFinite(visualDateFrom.valueMs) || Number.isFinite(visualDateTo.valueMs)) {
      const ts = resolveShotEffectiveTimestampMs(shot, dateBasisMode);
      if (!Number.isFinite(ts)) return false;
      if (Number.isFinite(visualDateFrom.valueMs) && ts < visualDateFrom.valueMs) return false;
      if (Number.isFinite(visualDateTo.valueMs) && ts > visualDateTo.valueMs) return false;
    }

    return compiledDslFilter.predicate(shot);
  });

  return {
    filteredShots,
    count: filteredShots.length,
    parseErrors,
    parseWarnings,
  };
}

function buildCandidateFilterState({
  baseFilterState,
  mode,
  selectedProfileNames,
  selectedShotKeys,
  shotKeyToCanonicalProfile,
}) {
  const parseErrors = [...baseFilterState.parseErrors];
  const parseWarnings = [...baseFilterState.parseWarnings];

  if (parseErrors.length > 0) {
    return { filteredShots: [], count: null, parseErrors, parseWarnings };
  }
  if (mode === 'profile' && selectedProfileNames.length === 0) {
    return { filteredShots: [], count: 0, parseErrors, parseWarnings };
  }
  if (mode === 'shots' && selectedShotKeys.length === 0) {
    return { filteredShots: [], count: 0, parseErrors, parseWarnings };
  }

  const selectedProfileSet = new Set(
    selectedProfileNames.map(name => cleanName(name).toLowerCase()),
  );
  const selectedShotKeySetLocal = new Set(selectedShotKeys);
  const filteredShots = (baseFilterState.filteredShots || []).filter(shot => {
    const shotKey = getShotSelectionKey(shot);
    if (!shotKey) return false;

    if (mode === 'profile') {
      const canonical = shotKeyToCanonicalProfile.get(shotKey);
      const profileKey = canonical ? cleanName(canonical).toLowerCase() : '';
      if (!selectedProfileSet.has(profileKey)) return false;
      if (!selectedShotKeySetLocal.has(shotKey)) return false;
    } else if (mode === 'shots' && !selectedShotKeySetLocal.has(shotKey)) {
      return false;
    }

    return true;
  });

  return {
    filteredShots,
    count: filteredShots.length,
    parseErrors,
    parseWarnings,
  };
}

function StatisticsDetailHeader({
  hasCompareStatistics,
  hasMetricStatistics,
  hasTrendStatistics,
  hasPhaseStatistics,
  hasProfileGroupStatistics,
  resolvedStatisticsDetailSection,
  setStatisticsDetailSection,
}) {
  const availableTabs = [
    hasMetricStatistics ? { id: 'metrics', label: 'Global metric averages' } : null,
    hasTrendStatistics ? { id: 'trends', label: 'Trends' } : null,
    hasCompareStatistics ? { id: 'compare', label: 'Shot Charts' } : null,
    hasProfileGroupStatistics ? { id: 'profile', label: 'Per-profile statistics' } : null,
    hasPhaseStatistics ? { id: 'phase', label: 'Per-phase statistics' } : null,
  ].filter(Boolean);

  if (availableTabs.length > 1) {
    return (
      <div role='tablist' className='tabs tabs-border'>
        {availableTabs.map(tab => (
          <button
            key={tab.id}
            type='button'
            role='tab'
            className={`tab ${resolvedStatisticsDetailSection === tab.id ? 'tab-active' : ''}`}
            aria-selected={resolvedStatisticsDetailSection === tab.id}
            onClick={() => setStatisticsDetailSection(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    );
  }

  const title = availableTabs[0]?.label || 'Statistics';
  return <h3 className={STATISTICS_SECTION_TITLE_CLASS}>{title}</h3>;
}

function StatisticsDetailSectionPanel({
  compareEntries,
  compareTargetDisplayMode,
  onCompareTargetDisplayModeChange,
  hasMetricStatistics,
  hasTrendStatistics,
  hasPhaseStatistics,
  hasProfileGroupStatistics,
  resolvedStatisticsDetailSection,
  result,
  setStatisticsDetailSection,
  hidePhaseExitReasons = false,
  chartRunKey = 'idle',
}) {
  const hasCompareStatistics = Array.isArray(compareEntries) && compareEntries.length > 0;

  if (
    !hasCompareStatistics &&
    !hasMetricStatistics &&
    !hasTrendStatistics &&
    !hasProfileGroupStatistics &&
    !hasPhaseStatistics
  ) {
    return null;
  }

  const shouldUsePanelSurface = resolvedStatisticsDetailSection !== 'metrics';

  const sectionContent = (
    <>
      {hasCompareStatistics && resolvedStatisticsDetailSection === 'compare' && (
        <StatisticsShotCompareSection
          key={`statistics-shot-charts-${chartRunKey}`}
          compareEntries={compareEntries}
          compareTargetDisplayMode={compareTargetDisplayMode}
          onCompareTargetDisplayModeChange={onCompareTargetDisplayModeChange}
          showTitle={false}
          embedded={true}
        />
      )}

      {hasMetricStatistics && resolvedStatisticsDetailSection === 'metrics' && (
        <MetricsTable metrics={result.metrics} />
      )}

      {hasTrendStatistics && resolvedStatisticsDetailSection === 'trends' && (
        <TrendChart key={`statistics-trends-${chartRunKey}`} trends={result.trends} />
      )}

      {hasProfileGroupStatistics && resolvedStatisticsDetailSection === 'profile' && (
        <ProfileGroupTable profileGroups={result.profileGroups} showTitle={false} />
      )}

      {hasPhaseStatistics && resolvedStatisticsDetailSection === 'phase' && (
        <PhaseStatistics
          phaseStats={result.phaseStats}
          showTitle={false}
          hideExitReasons={hidePhaseExitReasons}
        />
      )}
    </>
  );

  return (
    <div className='space-y-2'>
      <StatisticsDetailHeader
        hasCompareStatistics={hasCompareStatistics}
        hasMetricStatistics={hasMetricStatistics}
        hasTrendStatistics={hasTrendStatistics}
        hasPhaseStatistics={hasPhaseStatistics}
        hasProfileGroupStatistics={hasProfileGroupStatistics}
        resolvedStatisticsDetailSection={resolvedStatisticsDetailSection}
        setStatisticsDetailSection={setStatisticsDetailSection}
      />
      {shouldUsePanelSurface ? (
        <div className={`${STATISTICS_PANEL_CLASS} p-4`}>{sectionContent}</div>
      ) : (
        sectionContent
      )}
    </div>
  );
}

function useStatisticsMetadataState({
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

function useStatisticsSelectionModel({
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

function useStatisticsSelectionSync({
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

function useStatisticsRunExecution({
  runRequest,
  calcMode,
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
        const shotList = Array.isArray(runRequest.shots) ? runRequest.shots : [];
        const profileList = Array.isArray(runRequest.profiles) ? runRequest.profiles : [];
        const fallbackProfileList = Array.isArray(runRequest.fallbackProfiles)
          ? runRequest.fallbackProfiles
          : [];

        const profileMap = new Map();
        for (const p of profileList) {
          const displayName = getProfileDisplayLabel(p, '');
          const key = displayName.toLowerCase();
          if (key) profileMap.set(key, p);
        }
        const fallbackProfileMap = new Map();
        for (const p of fallbackProfileList) {
          const displayName = getProfileDisplayLabel(p, '');
          const key = displayName.toLowerCase();
          if (key && !profileMap.has(key)) fallbackProfileMap.set(key, p);
        }

        const loadedProfileCache = new Map();
        const total = shotList.length;
        setProgress({ current: 0, total });

        if (total === 0) {
          entriesRef.current = [];
          setResult(computeStatistics([], { calcMode: !!runRequest.calcMode }));
          setLoading(false);
          return;
        }

        const entries = [];

        for (let i = 0; i < total; i += BATCH_SIZE) {
          if (loadId !== analyzeLoadIdRef.current) return;

          const batch = shotList.slice(i, i + BATCH_SIZE);
          const batchResults = await Promise.all(
            batch.map(async shot => {
              try {
                const shotId =
                  shot.source === 'gaggimate' ? shot.id : shot.storageKey || shot.name || shot.id;
                const loadedShot = await libraryService.loadShot(shotId, shot.source);
                const fullShot = loadedShot
                  ? {
                      ...loadedShot,
                      source: loadedShot.source || shot.source,
                      storageKey:
                        loadedShot.storageKey || shot.storageKey || shot.name || String(shotId),
                      name: loadedShot.name || shot.name || shot.storageKey || String(shotId),
                    }
                  : null;
                if (!fullShot || !fullShot.samples || fullShot.samples.length === 0) return null;

                const profileField = fullShot.profile || '';
                const profileKey = cleanName(profileField).toLowerCase();
                const matchedProfileEntry = profileKey
                  ? profileMap.get(profileKey) || fallbackProfileMap.get(profileKey) || null
                  : null;

                let matchedProfile = null;
                if (matchedProfileEntry) {
                  if (matchedProfileEntry.data) {
                    matchedProfile = matchedProfileEntry.data;
                  } else {
                    const pid =
                      matchedProfileEntry.source === 'gaggimate'
                        ? matchedProfileEntry.profileId || matchedProfileEntry.id
                        : matchedProfileEntry.label || matchedProfileEntry.name;
                    try {
                      const cacheKey = `${matchedProfileEntry.source}:${String(pid || '')}`;
                      if (pid) {
                        if (!loadedProfileCache.has(cacheKey)) {
                          loadedProfileCache.set(
                            cacheKey,
                            libraryService
                              .loadProfile(pid, matchedProfileEntry.source)
                              .catch(() => null),
                          );
                        }
                        matchedProfile = await loadedProfileCache.get(cacheKey);
                      }
                    } catch {
                      // Analyze without profile if profile load fails.
                    }
                  }
                }

                if (matchedProfile && matchedProfileEntry?.source && !matchedProfile.source) {
                  matchedProfile = { ...matchedProfile, source: matchedProfileEntry.source };
                }

                const settings = { ...DEFAULT_SETTINGS };
                const autoResult = detectAutoDelay(fullShot, matchedProfile, settings.scaleDelayMs);
                if (autoResult.auto) {
                  settings.scaleDelayMs = autoResult.delay;
                  settings.isAutoAdjusted = true;
                }

                return {
                  analysis: calculateShotMetrics(fullShot, matchedProfile, settings),
                  shotData: fullShot,
                  profileData: matchedProfile,
                  meta: {
                    id: shotId,
                    selectionKey: getShotSelectionKey(shot),
                    displayName: getShotDisplayName(fullShot),
                    timestamp: shot.timestamp || shot.shotDate || shot.uploadedAt || 0,
                    profileName: cleanName(profileField) || '(Unknown)',
                    source: shot.source,
                  },
                };
              } catch {
                return null;
              }
            }),
          );

          for (const entry of batchResults) {
            if (entry) entries.push(entry);
          }

          if (loadId !== analyzeLoadIdRef.current) return;
          setProgress({ current: Math.min(i + BATCH_SIZE, total), total });
        }

        if (cancelled || loadId !== analyzeLoadIdRef.current) return;
        entriesRef.current = entries;
        setResult(computeStatistics(entries, { calcMode: !!runRequest.calcMode }));
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

  useEffect(() => {
    if (entriesRef.current) {
      setResult(computeStatistics(entriesRef.current, { calcMode }));
    }
  }, [calcMode, entriesRef, setResult]);
}

function buildStatisticsCompareEntries(result, runRequest, entriesRef) {
  if (!result) return [];

  const cachedEntries = Array.isArray(entriesRef.current) ? entriesRef.current : [];
  const entryBySelectionKey = new Map(
    cachedEntries.map(entry => [entry?.meta?.selectionKey, entry]),
  );
  const orderedShotKeys = Array.isArray(runRequest?.orderedShotKeys)
    ? runRequest.orderedShotKeys.filter(Boolean)
    : [];
  const fallbackShotKeys = Array.isArray(runRequest?.shots)
    ? runRequest.shots.map(getShotSelectionKey).filter(Boolean)
    : [];
  const preferredShotOrder = orderedShotKeys.length > 0 ? orderedShotKeys : fallbackShotKeys;

  const orderedCompareEntries = preferredShotOrder
    .map((selectionKey, index) =>
      buildStatisticsCompareEntry(entryBySelectionKey.get(selectionKey), {
        key: selectionKey,
        isReference: index === 0,
      }),
    )
    .filter(Boolean);

  const matchedCompareKeys = new Set(orderedCompareEntries.map(entry => entry.key));
  const unmatchedCompareEntries = cachedEntries
    .map((entry, index) => {
      const fallbackKey = getStatisticsCompareFallbackKey(entry, index);
      if (matchedCompareKeys.has(fallbackKey)) return null;

      return buildStatisticsCompareEntry(entry, {
        key: fallbackKey,
        isReference: orderedCompareEntries.length === 0 && index === 0,
      });
    })
    .filter(Boolean);

  if (preferredShotOrder.length > 0) {
    if (orderedCompareEntries.length === cachedEntries.length) {
      return orderedCompareEntries;
    }
    if (orderedCompareEntries.length > 0 || unmatchedCompareEntries.length > 0) {
      return [...orderedCompareEntries, ...unmatchedCompareEntries];
    }
  }

  return cachedEntries
    .map((entry, index) =>
      buildStatisticsCompareEntry(entry, {
        key: getStatisticsCompareFallbackKey(entry, index),
        isReference: index === 0,
      }),
    )
    .filter(Boolean);
}

function getBuiltProfileCount(entriesRef) {
  const cachedEntries = Array.isArray(entriesRef.current) ? entriesRef.current : [];
  const profileNames = new Set();

  cachedEntries.forEach(entry => {
    const rawName = entry?.meta?.profileName || getProfileDisplayLabel(entry?.profileData, '');
    const cleanedName = cleanName(rawName || '');
    if (cleanedName) {
      profileNames.add(cleanedName);
    }
  });

  return profileNames.size;
}

function getBuiltDateRange(entriesRef, dateBasisMode) {
  const cachedEntries = Array.isArray(entriesRef.current) ? entriesRef.current : [];
  const timestamps = cachedEntries
    .map(entry => resolveShotEffectiveTimestampMs(entry?.shotData || entry?.meta, dateBasisMode))
    .filter(value => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  if (timestamps.length === 0) {
    return { startMs: null, endMs: null };
  }

  return {
    startMs: timestamps[0],
    endMs: timestamps[timestamps.length - 1],
  };
}

function useStatisticsResultViewState({
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

export function StatisticsView({ initialContext }) {
  const apiService = useContext(ApiServiceContext);
  const initialProfileName = getInitialProfileName(initialContext);

  const [shotSource, setShotSource] = useState(() =>
    normalizeStatisticsSourceSelection(
      initialContext?.shotSource || initialContext?.source,
      'gaggimate',
    ),
  );
  const [profileSource, setProfileSource] = useState(() =>
    normalizeStatisticsSourceSelection(
      initialContext?.profileSource || initialContext?.source,
      'gaggimate',
    ),
  );

  const [mode, setMode] = useState(() => (initialProfileName ? 'profile' : 'all'));

  const [selectedProfileNames, setSelectedProfileNames] = useState(() =>
    initialProfileName ? [initialProfileName] : [],
  );
  const [selectedShotKeys, setSelectedShotKeys] = useState([]);
  const [query, setQuery] = useState('');
  const [dateFromLocal, setDateFromLocal] = useState('');
  const [dateToLocal, setDateToLocal] = useState('');
  const [dateBasisMode, setDateBasisMode] = useState('auto');

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [runRequest, setRunRequest] = useState(null);
  const [calcMode, setCalcMode] = useState(false);
  const [preparingRun, setPreparingRun] = useState(false);
  const [statisticsDetailSection, setStatisticsDetailSection] = useState(
    () => normalizeStatisticsDetailSection(initialContext?.preferredDetailSection) || 'metrics',
  );
  const [compareTargetDisplayMode, setCompareTargetDisplayMode] = useState(() =>
    normalizeCompareTargetDisplayMode(
      loadFromStorage(ANALYZER_DB_KEYS.COMPARE_TARGET_DISPLAY_MODE),
    ),
  );
  const [pinnedProfiles, setPinnedProfiles] = useState(() => getPinnedProfiles());
  const [pinnedShotsByProfile, setPinnedShotsByProfile] = useState(() => getPinnedShotsByProfile());

  const analyzeLoadIdRef = useRef(0);
  const prepareRunIdRef = useRef(0);
  const entriesRef = useRef(null);
  const initializedDetailSectionRunIdRef = useRef(null);

  useEffect(() => {
    saveToStorage(
      ANALYZER_DB_KEYS.COMPARE_TARGET_DISPLAY_MODE,
      normalizeCompareTargetDisplayMode(compareTargetDisplayMode),
    );
  }, [compareTargetDisplayMode]);

  const {
    rawShotCandidates,
    rawProfiles,
    metadataLoading,
    metadataLoaded,
    metadataError,
    rawShotKeyOrder,
    shotKeyToCanonicalProfile,
    availableProfiles,
  } = useStatisticsMetadataState({
    apiService,
    shotSource,
    profileSource,
    initialProfileName,
    setSelectedProfileNames,
    setSelectedShotKeys,
  });

  const handleProfilePinToggle = item => {
    const result = toggleProfilePin(item?.id || item?.primary || item);
    if (!result.changed) return;
    setPinnedProfiles(result.pinnedProfiles);
  };

  const handleShotPinToggle = item => {
    const result = toggleShotPin(item?.id || item?.shotMeta, item?.pinBucketKey || '');
    if (!result.changed) return;
    setPinnedShotsByProfile(result.pinnedShotsByProfile);
  };
  const {
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
    dateInputPreviewRange,
    handleProfileSelectionChange,
    handleByProfileShotSelectionChange,
    handleShotSelectionChange,
    handleByShotsProfileSelectionChange,
  } = useStatisticsSelectionModel({
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
  });

  useStatisticsSelectionSync({
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
  });

  useStatisticsRunExecution({
    runRequest,
    calcMode,
    analyzeLoadIdRef,
    entriesRef,
    setLoading,
    setError,
    setResult,
    setProgress,
  });

  const isSelectionMissing =
    (mode === 'profile' && selectedProfileNames.length === 0) ||
    (mode === 'shots' && selectedShotKeys.length === 0);
  const selectionHint =
    mode === 'profile' && selectedProfileNames.length === 0
      ? 'Select one or more profiles.'
      : mode === 'shots' && selectedShotKeys.length === 0
        ? 'Select one or more shots.'
        : null;
  const canRunStatistics =
    !loading &&
    !preparingRun &&
    !metadataLoading &&
    !metadataError &&
    candidateFilterState.parseErrors.length === 0 &&
    !isSelectionMissing;

  const handleGo = useCallback(
    ({ preferredDetailSection = null } = {}) => {
      if (!canRunStatistics) {
        return;
      }

      const prepareRunId = ++prepareRunIdRef.current;
      const nextRunId = `${Date.now()}-${prepareRunId}`;
      const fallbackSource = getStatisticsFallbackSource(profileSource);
      const shotSnapshot = [...candidateFilterState.filteredShots];
      const profileSnapshot = [...rawProfiles];
      const orderedShotKeysSnapshot = [...selectedShotKeys];
      const nextCalcMode = calcMode;
      setPreparingRun(true);

      async function prepareRunRequest() {
        try {
          let fallbackProfiles = [];
          if (fallbackSource) {
            try {
              fallbackProfiles = await libraryService.getAllProfiles(fallbackSource);
            } catch {
              fallbackProfiles = [];
            }
          }

          if (prepareRunIdRef.current !== prepareRunId) return;

          // Persist a run snapshot so toolbar changes after clicking Play do not
          // mutate the dataset currently being analyzed.
          setRunRequest({
            id: nextRunId,
            shots: shotSnapshot,
            profiles: profileSnapshot,
            fallbackProfiles: Array.isArray(fallbackProfiles) ? fallbackProfiles : [],
            orderedShotKeys: orderedShotKeysSnapshot,
            calcMode: nextCalcMode,
            dateBasisMode,
            mode,
            preferredDetailSection:
              normalizeStatisticsDetailSection(preferredDetailSection) || null,
          });
        } finally {
          if (prepareRunIdRef.current === prepareRunId) {
            setPreparingRun(false);
          }
        }
      }

      prepareRunRequest();
    },
    [
      canRunStatistics,
      profileSource,
      candidateFilterState.filteredShots,
      rawProfiles,
      selectedShotKeys,
      calcMode,
      dateBasisMode,
      mode,
    ],
  );

  useEffect(() => {
    const handleKeyDown = event => {
      if (event.defaultPrevented || event.repeat) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isStatisticsHotkeyBlockedTarget(event.target)) return;

      const key = String(event.key || '').toLowerCase();
      if (key === 'enter') {
        event.preventDefault();
        handleGo();
        return;
      }

      if (key === 'c') {
        event.preventDefault();
        handleGo({ preferredDetailSection: 'compare' });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleGo]);

  const handleClearFilters = () => {
    setSelectedProfileNames([]);
    setSelectedShotKeys([]);
    setDateFromLocal('');
    setDateToLocal('');
    setQuery('');
    setDateBasisMode('auto');
  };

  const {
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
  } = useStatisticsResultViewState({
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
  });

  // Build the detail panel once so the surrounding render path can switch
  // between loading, empty, and populated states without duplicating the tab logic.
  const statisticsDetailSectionPanel = (
    <StatisticsDetailSectionPanel
      chartRunKey={runRequest?.id || 'idle'}
      compareEntries={statisticsCompareEntries}
      compareTargetDisplayMode={compareTargetDisplayMode}
      onCompareTargetDisplayModeChange={setCompareTargetDisplayMode}
      hasMetricStatistics={hasMetricStatistics}
      hasTrendStatistics={hasTrendStatistics}
      hasPhaseStatistics={hasPhaseStatistics}
      hasProfileGroupStatistics={hasProfileGroupStatistics}
      resolvedStatisticsDetailSection={resolvedStatisticsDetailSection}
      result={result}
      setStatisticsDetailSection={setStatisticsDetailSection}
      hidePhaseExitReasons={shouldHidePhaseExitReasons}
    />
  );

  return (
    <div className={shouldShowEmptyStatisticsState ? 'space-y-6' : 'space-y-5'}>
      <div className='bg-base-100/80 border-base-content/10 relative z-[80] rounded-xl border shadow-lg backdrop-blur-md lg:sticky lg:top-0'>
        <div className='px-1.5 py-1.5 sm:px-2 sm:py-2'>
          <StatisticsToolbar
            shotSource={shotSource}
            onShotSourceChange={setShotSource}
            profileSource={profileSource}
            onProfileSourceChange={setProfileSource}
            mode={mode}
            onModeChange={setMode}
            onGo={handleGo}
            calcMode={calcMode}
            onCalcModeChange={setCalcMode}
            startLoading={preparingRun}
            loading={loading}
            metadataLoading={metadataLoading}
            canGo={canRunStatistics}
            profileSelectionItems={profileSelectionItems}
            selectedProfileNames={displayedProfileSelection}
            onSelectedProfileNamesChange={
              mode === 'shots' ? handleByShotsProfileSelectionChange : handleProfileSelectionChange
            }
            onProfilePinToggle={handleProfilePinToggle}
            shotSelectionItems={shotSelectionItems}
            selectedShotKeys={selectedShotKeys}
            onSelectedShotKeysChange={
              mode === 'profile' ? handleByProfileShotSelectionChange : handleShotSelectionChange
            }
            onShotPinToggle={handleShotPinToggle}
            query={query}
            onQueryChange={setQuery}
            dateFromLocal={dateFromLocal}
            dateFromPreviewLocal={dateInputPreviewRange.fromLocal}
            onDateFromChange={setDateFromLocal}
            dateToLocal={dateToLocal}
            dateToPreviewLocal={dateInputPreviewRange.toLocal}
            onDateToChange={setDateToLocal}
            dateBasisMode={dateBasisMode}
            onDateBasisModeChange={setDateBasisMode}
            showDateBasisWarning={dateBasisWarningState.showDateBasisWarning}
            dateBasisWarningMessage={dateBasisWarningState.dateBasisWarningMessage}
            candidateCount={metadataLoading ? null : candidateFilterState.count}
            parseErrors={candidateFilterState.parseErrors}
            parseWarnings={candidateFilterState.parseWarnings}
            onClearFilters={handleClearFilters}
            metadataError={metadataError}
            selectionHint={selectionHint}
            hasBuiltStatistics={Boolean(result)}
            builtShotCount={builtShotCount}
            builtProfileCount={builtProfileCount}
            builtDateRangeStartMs={builtDateRange.startMs}
            builtDateRangeEndMs={builtDateRange.endMs}
          />
        </div>
      </div>

      {loading && (
        <div className={`${STATISTICS_PANEL_CLASS} p-6 text-center`}>
          <div className='mb-2 text-sm font-semibold opacity-70'>
            {progress.total > 0
              ? `Analyzing shot ${progress.current} of ${progress.total}...`
              : 'Preparing statistics...'}
          </div>
          {progress.total > 0 ? (
            <progress
              className='progress progress-primary w-full max-w-xs'
              value={progress.current}
              max={progress.total}
            />
          ) : (
            <progress className='progress progress-primary w-full max-w-xs' />
          )}
        </div>
      )}

      {error && (
        <div className='bg-error/10 border-error/20 rounded-lg border p-4 text-center'>
          <p className='text-error text-sm'>{error}</p>
        </div>
      )}

      {!error && metadataError && (
        <div className='bg-warning/10 border-warning/20 rounded-lg border p-4 text-center'>
          <p className='text-warning text-sm'>{metadataError}</p>
        </div>
      )}

      {!loading && result && (
        <div className='space-y-5'>
          <SummaryCards summary={result.summary} />

          {statisticsDetailSectionPanel}

          {result.summary.totalShots === 0 && (
            <div className={`${STATISTICS_PANEL_CLASS} p-8 text-center`}>
              <p className='text-sm opacity-50'>No shots found for the selected filters.</p>
            </div>
          )}
        </div>
      )}

      {shouldShowEmptyStatisticsState && (
        <div className='w-full'>
          <div className='bg-base-200/60 border-base-content/5 w-full space-y-6 rounded-xl border p-8 text-left shadow-sm'>
            <div className='space-y-2 text-center'>
              <h3 className='text-base-content text-2xl font-bold'>No Statistics Built Yet</h3>
              <p className='text-base-content text-sm opacity-70'>
                Press{' '}
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-md ${STATISTICS_RUN_BUTTON_TONE_CLASS}`}
                >
                  <FontAwesomeIcon icon={faPlay} className='text-[10px]' />
                </span>{' '}
                to build a statistic.
              </p>
              <div className='border-base-content/10 mt-5 border-t pt-4 text-center'>
                <div className='text-base-content/60 flex flex-wrap items-center justify-center gap-3 text-xs'>
                  <span>
                    <span className='bg-base-content/8 border-base-content/10 mr-1.5 inline-flex min-w-10 items-center justify-center rounded-md border px-1.5 py-0.5 font-bold'>
                      Enter
                    </span>{' '}
                    Build
                  </span>
                  <span>
                    <span className='bg-base-content/8 border-base-content/10 mr-1.5 inline-flex min-w-6 items-center justify-center rounded-md border px-1.5 py-0.5 font-bold'>
                      C
                    </span>{' '}
                    Build and show Shot Charts
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
