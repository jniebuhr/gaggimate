import { useState, useEffect, useRef, useContext, useCallback } from 'preact/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay } from '@fortawesome/free-solid-svg-icons/faPlay';
// Main StatisticsView orchestrator: wires hooks, toolbar, summary cards, and the detail section panel
import { ApiServiceContext } from '../../../../services/ApiService';
import { libraryService } from '../../../ShotAnalyzer/services/LibraryService';
import {
  ANALYZER_DB_KEYS,
  loadFromStorage,
  saveToStorage,
  normalizeCompareTargetDisplayMode,
  getPinnedProfiles,
  getPinnedShotsByProfile,
  toggleProfilePin,
  toggleShotPin,
} from '../../../ShotAnalyzer/utils/analyzerUtils';
import { StatisticsToolbar, STATISTICS_RUN_BUTTON_TONE_CLASS } from '../StatisticsToolbar';
import { SummaryCards } from '../SummaryCards';
import { normalizeStatisticsSourceSelection } from '../../utils/statisticsRoute';
import { STATISTICS_PANEL_CLASS } from './constants';
import {
  getInitialProfileName,
  getStatisticsSelectionHint,
  isStatisticsHotkeyBlockedTarget,
  getStatisticsFallbackSource,
  normalizeStatisticsDetailSection,
} from './helpers';
import {
  useStatisticsMetadataState,
  useStatisticsSelectionModel,
  useStatisticsSelectionSync,
  useStatisticsRunExecution,
  useStatisticsResultViewState,
} from './hooks';
import { StatisticsDetailSectionPanel } from './StatisticsDetailSection';

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
  const selectionHint = getStatisticsSelectionHint({
    mode,
    selectedProfileNames,
    selectedShotKeys,
  });
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

          setRunRequest({
            id: nextRunId,
            shots: shotSnapshot,
            profiles: profileSnapshot,
            fallbackProfiles: Array.isArray(fallbackProfiles) ? fallbackProfiles : [],
            orderedShotKeys: orderedShotKeysSnapshot,
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
      <div
        className='app-card-surface relative z-[80] rounded-xl lg:sticky lg:top-0'
        data-statistics-toolbar-shell
      >
        <div className='px-1.5 py-1.5 sm:px-2 sm:py-2'>
          <StatisticsToolbar
            shotSource={shotSource}
            onShotSourceChange={setShotSource}
            profileSource={profileSource}
            onProfileSourceChange={setProfileSource}
            mode={mode}
            onModeChange={setMode}
            onGo={handleGo}
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
          <div className='app-card-surface w-full space-y-6 rounded-xl p-8 text-left'>
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
