import { useState, useEffect, useRef, useContext, useMemo } from 'preact/hooks';
import { ApiServiceContext } from '../../../services/ApiService';
import { libraryService } from '../../ShotAnalyzer/services/LibraryService';
import { calculateShotMetrics, detectAutoDelay } from '../../ShotAnalyzer/services/AnalyzerService';
import { computeStatistics } from '../services/StatisticsService';
import { cleanName } from '../../ShotAnalyzer/utils/analyzerUtils';
import { StatisticsToolbar } from './StatisticsToolbar';
import { SummaryCards } from './SummaryCards';
import { MetricsTable } from './MetricsTable';
import { ProfileGroupTable } from './ProfileGroupTable';
import { PhaseStatistics } from './PhaseStatistics';
import { TrendChart } from './TrendChart';
import { STATISTICS_SECTION_TITLE_CLASS } from './statisticsUi';
import {
  buildShotCandidatePredicate,
  parseStatisticsQuery,
  resolveShotEffectiveTimestampMs,
} from '../utils/statisticsSearchDsl';
import { STATISTICS_SOURCE_FALLBACK } from '../utils/statisticsRoute';

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
    const displayName = cleanName(p?.name || p?.label || '');
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

function getPreferredStatisticsDetailSection(runMode) {
  return runMode === 'profile' ? 'phase' : 'profile';
}

function resolveStatisticsDetailSectionChoice({
  candidate,
  hasProfileGroupStatistics,
  hasPhaseStatistics,
}) {
  if (candidate === 'phase' && !hasPhaseStatistics && hasProfileGroupStatistics) return 'profile';
  if (candidate === 'profile' && !hasProfileGroupStatistics && hasPhaseStatistics) return 'phase';
  return candidate;
}

function StatisticsDetailHeader({
  hasPhaseStatistics,
  hasProfileGroupStatistics,
  resolvedStatisticsDetailSection,
  setStatisticsDetailSection,
}) {
  if (hasProfileGroupStatistics && hasPhaseStatistics) {
    return (
      <div role='tablist' className='tabs tabs-border'>
        <button
          type='button'
          role='tab'
          className={`tab ${resolvedStatisticsDetailSection === 'profile' ? 'tab-active' : ''}`}
          aria-selected={resolvedStatisticsDetailSection === 'profile'}
          onClick={() => setStatisticsDetailSection('profile')}
        >
          Per-profile statistics
        </button>
        <button
          type='button'
          role='tab'
          className={`tab ${resolvedStatisticsDetailSection === 'phase' ? 'tab-active' : ''}`}
          aria-selected={resolvedStatisticsDetailSection === 'phase'}
          onClick={() => setStatisticsDetailSection('phase')}
        >
          Per-phase statistics
        </button>
      </div>
    );
  }

  const title = hasProfileGroupStatistics ? 'Per-profile statistics' : 'Per-phase statistics';
  return <h3 className={STATISTICS_SECTION_TITLE_CLASS}>{title}</h3>;
}

function StatisticsDetailSectionPanel({
  hasPhaseStatistics,
  hasProfileGroupStatistics,
  resolvedStatisticsDetailSection,
  result,
  setStatisticsDetailSection,
}) {
  if (!hasProfileGroupStatistics && !hasPhaseStatistics) return null;

  return (
    <div className='space-y-2'>
      <StatisticsDetailHeader
        hasPhaseStatistics={hasPhaseStatistics}
        hasProfileGroupStatistics={hasProfileGroupStatistics}
        resolvedStatisticsDetailSection={resolvedStatisticsDetailSection}
        setStatisticsDetailSection={setStatisticsDetailSection}
      />

      <div className={`${STATISTICS_PANEL_CLASS} p-4`}>
        {hasProfileGroupStatistics &&
          (!hasPhaseStatistics || resolvedStatisticsDetailSection === 'profile') && (
            <ProfileGroupTable profileGroups={result.profileGroups} showTitle={false} />
          )}

        {hasPhaseStatistics &&
          (!hasProfileGroupStatistics || resolvedStatisticsDetailSection === 'phase') && (
            <PhaseStatistics phaseStats={result.phaseStats} showTitle={false} />
          )}
      </div>
    </div>
  );
}

export function StatisticsView({ initialContext }) {
  const apiService = useContext(ApiServiceContext);
  const initialProfileName = getInitialProfileName(initialContext);

  const [source, setSource] = useState(() => {
    if (initialContext?.source === 'gaggimate' || initialContext?.source === 'browser') {
      return initialContext.source;
    }
    return 'both';
  });

  const [mode, setMode] = useState(() => (initialProfileName ? 'profile' : 'all'));

  const [selectedProfileNames, setSelectedProfileNames] = useState(() =>
    initialProfileName ? [initialProfileName] : [],
  );
  const [selectedShotKeys, setSelectedShotKeys] = useState([]);
  const [query, setQuery] = useState('');
  const [dateFromLocal, setDateFromLocal] = useState('');
  const [dateToLocal, setDateToLocal] = useState('');
  const [dateBasisMode, setDateBasisMode] = useState('auto');

  const [rawShotCandidates, setRawShotCandidates] = useState([]);
  const [rawProfiles, setRawProfiles] = useState([]);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataLoaded, setMetadataLoaded] = useState(false);
  const [metadataError, setMetadataError] = useState(null);
  const [metadataReloadNonce, setMetadataReloadNonce] = useState(0);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [runRequest, setRunRequest] = useState(null);
  const [calcMode, setCalcMode] = useState(false);
  const [preparingRun, setPreparingRun] = useState(false);
  const [statisticsDetailSection, setStatisticsDetailSection] = useState('profile');

  const metaLoadIdRef = useRef(0);
  const analyzeLoadIdRef = useRef(0);
  const prepareRunIdRef = useRef(0);
  const entriesRef = useRef(null);
  const initialProfilePresetAppliedRef = useRef(false);
  const profileModeShotSeedSignatureRef = useRef('');
  const gmPrefillRetryCountRef = useRef(0);
  const initializedDetailSectionRunIdRef = useRef(null);

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
        // Load filter metadata eagerly so the toolbar can update counts before "Go".
        const [shotList, profileList] = await Promise.all([
          libraryService.getAllShots(source),
          libraryService.getAllProfiles(source),
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
  }, [source, apiService, metadataReloadNonce]);

  useEffect(() => {
    gmPrefillRetryCountRef.current = 0;
  }, [source, initialProfileName]);

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

  const dateBasisWarningState = useMemo(() => {
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

    // The warning is shown whenever the dataset contains missing shot timestamps,
    // even if no date filter is currently active.
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
  }, [rawShotCandidates]);

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
  }, [availableProfiles, rawShotCandidates, metadataLoaded]);

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
    setMode('profile');
    setSelectedProfileNames([canonical]);
  }, [availableProfiles, initialProfileName, metadataLoaded]);

  useEffect(() => {
    if (source !== 'gaggimate') return;
    if (!initialProfileName) return;
    if (!metadataLoaded || metadataLoading || metadataError) return;
    if (initialProfilePresetAppliedRef.current) return;
    if ((availableProfiles || []).length > 0) return;
    if (gmPrefillRetryCountRef.current >= 3) return;

    // GM metadata can briefly arrive empty after route-prefill navigation; retry a few times.
    const timer = setTimeout(() => {
      gmPrefillRetryCountRef.current += 1;
      setMetadataReloadNonce(n => n + 1);
    }, 450);

    return () => clearTimeout(timer);
  }, [
    source,
    initialProfileName,
    metadataLoaded,
    metadataLoading,
    metadataError,
    availableProfiles,
  ]);

  const parsedDslQuery = useMemo(() => parseStatisticsQuery(query), [query]);

  const compiledDslFilter = useMemo(
    () =>
      buildShotCandidatePredicate(parsedDslQuery, {
        dateBasisMode,
      }),
    [parsedDslQuery, dateBasisMode],
  );

  const visualDateFrom = useMemo(() => parseDateInputMs(dateFromLocal, 'start'), [dateFromLocal]);
  const visualDateTo = useMemo(() => parseDateInputMs(dateToLocal, 'end'), [dateToLocal]);

  // Stage 1 filtering: date + DSL only. This drives visible selection scopes and parse feedback.
  const baseFilterState = useMemo(() => {
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
      return {
        filteredShots: [],
        count: null,
        parseErrors,
        parseWarnings,
      };
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
  }, [compiledDslFilter, dateBasisMode, rawShotCandidates, visualDateFrom, visualDateTo]);

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
        })),
    [availableProfiles, profilesPresentInBaseFilteredShots],
  );

  const visibleProfileIdSet = useMemo(
    () => new Set(visibleProfileSelectionItems.map(item => item.id)),
    [visibleProfileSelectionItems],
  );

  const baseShotSelectionItems = useMemo(
    () =>
      (selectionScopeShots || [])
        .map(shot => buildShotSelectionItem(shot, dateBasisMode))
        .filter(item => item.id),
    [selectionScopeShots, dateBasisMode],
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
        .map(shot => buildShotSelectionItem(shot, dateBasisMode))
        .filter(item => item.id),
    [byProfileEligibleShots, dateBasisMode],
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

  // Stage 2 filtering: apply mode-specific profile/shot selections on top of the base filter.
  const candidateFilterState = useMemo(() => {
    const parseErrors = [...baseFilterState.parseErrors];
    const parseWarnings = [...baseFilterState.parseWarnings];

    if (parseErrors.length > 0) {
      return {
        filteredShots: [],
        count: null,
        parseErrors,
        parseWarnings,
      };
    }

    if (mode === 'profile' && selectedProfileNames.length === 0) {
      return {
        filteredShots: [],
        count: 0,
        parseErrors,
        parseWarnings,
      };
    }

    if (mode === 'shots' && selectedShotKeys.length === 0) {
      return {
        filteredShots: [],
        count: 0,
        parseErrors,
        parseWarnings,
      };
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
      } else if (mode === 'shots') {
        if (!selectedShotKeySetLocal.has(shotKey)) return false;
      }

      return true;
    });

    return {
      filteredShots,
      count: filteredShots.length,
      parseErrors,
      parseWarnings,
    };
  }, [baseFilterState, mode, selectedProfileNames, selectedShotKeys, shotKeyToCanonicalProfile]);

  const dateInputPreviewRange = useMemo(() => {
    if (dateFromLocal || dateToLocal) {
      return { fromLocal: '', toLocal: '' };
    }

    // Preview range is display-only and should not activate the date filter by itself.
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

  // Preserve the original metadata order when rebuilding a selection set.
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

  // In "By Shots" mode, toggling a profile in the sidebar adds/removes all its shots.
  // We diff against the currently derived profile set to determine which shots to add or remove.
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
  }, [mode, metadataLoaded, hasBaseParseErrors, visibleProfileIdSet]);

  useEffect(() => {
    if (mode !== 'profile' || !metadataLoaded || hasBaseParseErrors) return;

    // Reseed eligible shots only when the profile selection scope changes, not on every UI update.
    const signature = JSON.stringify({
      mode,
      source,
      metaLoadId: metaLoadIdRef.current,
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
    source,
    selectedProfileNames,
    byProfileEligibleShotKeys,
    byProfileEligibleShotKeySet,
  ]);

  useEffect(() => {
    if (mode !== 'shots' || !metadataLoaded || hasBaseParseErrors) return;

    setSelectedShotKeys(prev => {
      const next = (prev || []).filter(id => selectionScopeShotKeySet.has(id));
      return next.length === prev.length && next.every((value, index) => value === prev[index])
        ? prev
        : next;
    });
  }, [mode, metadataLoaded, hasBaseParseErrors, selectionScopeShotKeySet]);

  // Run analysis only when "Go" is clicked, using a snapshot of the filtered candidates.
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
          const displayName = cleanName(p.name || p.label || '');
          const key = displayName.toLowerCase();
          if (key) profileMap.set(key, p);
        }
        const fallbackProfileMap = new Map();
        for (const p of fallbackProfileList) {
          const displayName = cleanName(p.name || p.label || '');
          const key = displayName.toLowerCase();
          if (key && !profileMap.has(key)) fallbackProfileMap.set(key, p);
        }
        // Deduplicate repeated profile loads within the same run (especially useful for GM profiles).
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
                const shotId = shot.source === 'gaggimate' ? shot.id : shot.name || shot.id;
                const fullShot = await libraryService.loadShot(shotId, shot.source);
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
                        : matchedProfileEntry.name;
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

                const settings = { ...DEFAULT_SETTINGS };
                const autoResult = detectAutoDelay(fullShot, matchedProfile, settings.scaleDelayMs);
                if (autoResult.auto) {
                  settings.scaleDelayMs = autoResult.delay;
                  settings.isAutoAdjusted = true;
                }

                const analysis = calculateShotMetrics(fullShot, matchedProfile, settings);

                return {
                  analysis,
                  meta: {
                    id: shotId,
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
  }, [runRequest]);

  // Recompute statistics from cached entries when the Raw/Calc toggle changes,
  // avoiding a full re-fetch and re-analysis of all shots.
  useEffect(() => {
    if (entriesRef.current) {
      setResult(computeStatistics(entriesRef.current, { calcMode }));
    }
  }, [calcMode]);

  const isSelectionMissing =
    (mode === 'profile' && selectedProfileNames.length === 0) ||
    (mode === 'shots' && selectedShotKeys.length === 0);
  const selectionHint =
    mode === 'profile' && selectedProfileNames.length === 0
      ? 'Select one or more profiles.'
      : mode === 'shots' && selectedShotKeys.length === 0
        ? 'Select one or more shots.'
        : null;

  const handleGo = () => {
    if (
      loading ||
      preparingRun ||
      metadataLoading ||
      metadataError ||
      candidateFilterState.parseErrors.length > 0 ||
      isSelectionMissing
    ) {
      return;
    }

    const prepareRunId = ++prepareRunIdRef.current;
    const nextRunId = `${Date.now()}-${prepareRunId}`;
    const fallbackSource = getStatisticsFallbackSource(source);
    const shotSnapshot = [...candidateFilterState.filteredShots];
    const profileSnapshot = [...rawProfiles];
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

        // Persist a run snapshot so UI changes after clicking "Go" do not mutate the active run.
        setRunRequest({
          id: nextRunId,
          shots: shotSnapshot,
          profiles: profileSnapshot,
          fallbackProfiles: Array.isArray(fallbackProfiles) ? fallbackProfiles : [],
          calcMode: nextCalcMode,
          mode,
        });
      } finally {
        if (prepareRunIdRef.current === prepareRunId) {
          setPreparingRun(false);
        }
      }
    }

    prepareRunRequest();
  };

  const handleClearFilters = () => {
    setSelectedProfileNames([]);
    setSelectedShotKeys([]);
    setDateFromLocal('');
    setDateToLocal('');
    setQuery('');
    setDateBasisMode('auto');
  };

  useEffect(() => {
    if (!result || !runRequest?.id) return;
    if (initializedDetailSectionRunIdRef.current === runRequest.id) return;

    const hasProfileGroups = Array.isArray(result.profileGroups) && result.profileGroups.length > 0;
    const hasPhaseStats = Array.isArray(result.phaseStats) && result.phaseStats.length > 0;
    const preferredSection = getPreferredStatisticsDetailSection(runRequest.mode);
    const nextSection = resolveStatisticsDetailSectionChoice({
      candidate: preferredSection,
      hasProfileGroupStatistics: hasProfileGroups,
      hasPhaseStatistics: hasPhaseStats,
    });

    setStatisticsDetailSection(nextSection);
    initializedDetailSectionRunIdRef.current = runRequest.id;
  }, [result, runRequest]);

  const hasProfileGroupStatistics = result?.profileGroups?.length > 0;
  const hasPhaseStatistics = result?.phaseStats?.length > 0;
  const preferredStatisticsDetailSection = getPreferredStatisticsDetailSection(runRequest?.mode);
  const detailSectionCandidate =
    initializedDetailSectionRunIdRef.current === runRequest?.id
      ? statisticsDetailSection
      : preferredStatisticsDetailSection;
  const resolvedStatisticsDetailSection = resolveStatisticsDetailSectionChoice({
    candidate: detailSectionCandidate,
    hasProfileGroupStatistics,
    hasPhaseStatistics,
  });

  return (
    <div className='space-y-5'>
      <div className='bg-base-100/80 border-base-content/10 z-50 rounded-xl border shadow-lg backdrop-blur-md lg:sticky lg:top-0'>
        <div className='px-1.5 py-1.5 sm:px-2 sm:py-2'>
          <StatisticsToolbar
            source={source}
            onSourceChange={value => {
              setSource(value);
            }}
            mode={mode}
            onModeChange={setMode}
            onGo={handleGo}
            calcMode={calcMode}
            onCalcModeChange={setCalcMode}
            loading={loading}
            metadataLoading={metadataLoading}
            canGo={
              !loading &&
              !preparingRun &&
              !metadataLoading &&
              !metadataError &&
              candidateFilterState.parseErrors.length === 0 &&
              !isSelectionMissing
            }
            profileSelectionItems={profileSelectionItems}
            selectedProfileNames={displayedProfileSelection}
            onSelectedProfileNamesChange={
              mode === 'shots' ? handleByShotsProfileSelectionChange : handleProfileSelectionChange
            }
            shotSelectionItems={shotSelectionItems}
            selectedShotKeys={selectedShotKeys}
            onSelectedShotKeysChange={
              mode === 'profile' ? handleByProfileShotSelectionChange : handleShotSelectionChange
            }
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
          />
        </div>
      </div>

      {loading && (
        <div className={`${STATISTICS_PANEL_CLASS} p-6 text-center`}>
          <div className='mb-2 text-sm font-semibold opacity-70'>
            Analyzing shot {progress.current} of {progress.total}...
          </div>
          <progress
            className='progress progress-primary w-full max-w-xs'
            value={progress.current}
            max={progress.total || 1}
          />
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

          <div className='space-y-2'>
            <h3 className={STATISTICS_SECTION_TITLE_CLASS}>Global metric averages</h3>
            <MetricsTable metrics={result.metrics} />
          </div>

          {result.trends.length > 1 && (
            <div className='space-y-2'>
              <h3 className={STATISTICS_SECTION_TITLE_CLASS}>Trends</h3>
              <div className={`${STATISTICS_PANEL_CLASS} p-4`}>
                <TrendChart trends={result.trends} />
              </div>
            </div>
          )}

          <StatisticsDetailSectionPanel
            hasPhaseStatistics={hasPhaseStatistics}
            hasProfileGroupStatistics={hasProfileGroupStatistics}
            resolvedStatisticsDetailSection={resolvedStatisticsDetailSection}
            result={result}
            setStatisticsDetailSection={setStatisticsDetailSection}
          />

          {result.summary.totalShots === 0 && (
            <div className={`${STATISTICS_PANEL_CLASS} p-8 text-center`}>
              <p className='text-sm opacity-50'>No shots found for the selected filters.</p>
            </div>
          )}
        </div>
      )}

      {!loading && !result && !error && !metadataError && metadataLoading && (
        <div className={`${STATISTICS_PANEL_CLASS} p-12 text-center`}>
          <span className='loading loading-spinner loading-lg text-base-content/30' />
          <p className='mt-3 text-sm opacity-50'>Loading shots and profiles...</p>
        </div>
      )}

      {!loading && !result && !error && !metadataError && !metadataLoading && (
        <div className={`${STATISTICS_PANEL_CLASS} p-8 text-center`}>
          <p className='text-sm opacity-50'>
            Configure your filters and press Go to generate statistics.
          </p>
        </div>
      )}
    </div>
  );
}
