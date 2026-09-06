/**
 * Main library surface for the Shot Analyzer.
 * Coordinates library state, selection, and the extracted presentation modules.
 */

import { ApiServiceContext } from '../../../../services/ApiService';
import { exportLibraryItems } from '../../services/LibraryExportService';
import {
  ANALYZER_DB_KEYS,
  cleanName,
  getPinnedProfiles,
  getPinnedShotsByProfile,
  getShotPinBucketKey,
  saveToStorage,
  toggleProfilePin,
  toggleShotPin,
} from '../../utils/analyzerUtils';
import { LibraryPanelStatusSlots } from './AnalyzerPanelSlot';
import { getStoredLibrarySourceFilter } from './libraryData';
import {
  applyChangedProfilePins,
  applyChangedShotPins,
  createLibraryProfileStatsContext,
  createPrimaryStatsHandler,
  createSecondaryStatsHandler,
  deleteLibraryItem,
  executeProfileRowAction,
  executeShotRowActionIntent,
  executeStatusBarCompareToggle,
  getActiveShotPinBucketKey,
  getLibraryExportHandler,
  getLibraryPanelDisplayState,
  getLibraryTargetMobileSection,
  getNormalizedCurrentProfileName,
  getPinnedShotBucketKeyForItem,
  getProfilePinDisabledReasonForItem,
  getSecondaryImportSlot,
  getSecondaryShotPanelTarget,
  getShotPinDisabledReasonForItem,
  getShotPinToggleBucketKey,
  getShotRowActionIntent,
  maybeOpenSecondaryProfilePanel,
} from './libraryDisplay';
import {
  LibraryDropdown,
  LibraryProfilesPanelSection,
  LibraryShotsPanelSection,
} from './LibraryDropdown';
import { useLibraryPanelImportHandler } from './libraryImport';
import {
  getLibraryPanelLayoutStyles,
  useAnalyzerStickyOffset,
  useCloseLibraryOnOutsideClick,
  useDebouncedLibraryValue,
  useLibraryPanelHotkeys,
  useLibraryPanelLayoutState,
  useLibraryRefresh,
  useLibrarySelectionTargetSync,
  useLibraryServiceApi,
} from './useLibraryPanelState';
import { useCallback, useContext, useEffect, useRef, useState } from 'preact/hooks';

export function LibraryPanel({
  currentShot,
  currentProfile,
  currentShotName = 'No Shot Loaded',
  currentProfileName = 'No Profile Loaded',
  pendingPrimarySelection = null,
  secondaryShot = null,
  secondaryProfile = null,
  secondaryShotName = 'No Shot Loaded',
  secondaryProfileName = 'No Profile Loaded',
  pendingCompareSelection = null,
  onShotSelect,
  onProfileLoad,
  onShotUnload,
  onProfileUnload,
  onShowStats,
  statsHref = '/statistics',
  secondaryStatsHref = '/statistics',
  importMode = 'temp',
  onImportModeChange,
  compareMode = false,
  compareHasSecondaryShot = false,
  compareSelectedCount = 0,
  compareSelectionKeys = new Set(),
  comparePendingKeys = [],
  compareSecondaryShotKey = '',
  onCompareModeToggle,
  onCompareShotToggle,
  onCompareProfileLoad,
  onCompareProfileUnload,
  onCompareSwap,
  onRetryProfileSearch,
  onRetryCompareProfileSearch,
  isSearchingProfile = false, // Spinner state for profile search
  compareIsSearchingProfile = false,
}) {
  const apiService = useContext(ApiServiceContext);
  const panelRef = useRef(null);
  const sentinelRef = useRef(null);
  const barSlotRef = useRef(null);
  const barRef = useRef(null);

  // UI State
  const [collapsed, setCollapsed] = useState(true);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false); // Specific state for import spinner
  const [librarySelectionTarget, setLibrarySelectionTarget] = useState('primaryShot');
  const { isStuck, isMobileViewport, barRect } = useLibraryPanelLayoutState({
    sentinelRef,
    barSlotRef,
    barRef,
  });
  const {
    primaryDisplayShot,
    primaryDisplayShotName,
    primaryDisplayProfile,
    primaryDisplayProfileName,
    secondaryDisplayShot,
    secondaryDisplayShotName,
    secondaryDisplayProfile,
    secondaryDisplayProfileName,
    isPrimarySelectionPending,
    isCompareSelectionPending,
    primaryProfileMismatch,
    secondaryProfileMismatch,
    isPrimaryProfileSearching,
    isCompareProfileSearching,
    canRetryPrimaryProfileSearch,
    canRetryCompareProfileSearch,
    selectionPromotionsEnabled,
  } = getLibraryPanelDisplayState({
    currentShot,
    currentProfile,
    currentShotName,
    currentProfileName,
    pendingPrimarySelection,
    secondaryShot,
    secondaryProfile,
    secondaryShotName,
    secondaryProfileName,
    pendingCompareSelection,
    isSearchingProfile,
    compareIsSearchingProfile,
    collapsed,
  });

  // Data State
  const [shots, setShots] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [navigationShots, setNavigationShots] = useState([]);

  // Filter & Sort State
  const [shotsSourceFilter, setShotsSourceFilter] = useState(() =>
    getStoredLibrarySourceFilter(ANALYZER_DB_KEYS.LIBRARY_SHOTS_SOURCE_FILTER),
  );
  const [profilesSourceFilter, setProfilesSourceFilter] = useState(() =>
    getStoredLibrarySourceFilter(ANALYZER_DB_KEYS.LIBRARY_PROFILES_SOURCE_FILTER),
  );

  const [shotsSearch, setShotsSearch] = useState('');
  const [shotsSort, setShotsSort] = useState({ key: 'shotDate', order: 'desc' });

  const [profilesSearch, setProfilesSearch] = useState('');
  const [profilesSort, setProfilesSort] = useState({ key: 'name', order: 'asc' });
  const [mobileActiveSection, setMobileActiveSection] = useState('shots');
  const [pinnedProfiles, setPinnedProfiles] = useState(() => getPinnedProfiles());
  const [pinnedShotsByProfile, setPinnedShotsByProfile] = useState(() => getPinnedShotsByProfile());
  const [shotsPinnedFirst, setShotsPinnedFirst] = useState(false);
  const [profilesPinnedFirst, setProfilesPinnedFirst] = useState(false);

  const handleLibraryProfileStatsOpen = useCallback(
    profileItem => {
      if (!profileItem) return;
      try {
        sessionStorage.setItem(
          'statsInitialContext',
          JSON.stringify(
            createLibraryProfileStatsContext({
              compareMode,
              currentShot,
              profileItem,
              secondaryShot,
              shotsSourceFilter,
            }),
          ),
        );
      } catch {
        // Ignore session storage issues and keep navigation working.
      }
    },
    [compareMode, currentShot, secondaryShot, shotsSourceFilter],
  );

  // Debounced search values to avoid re-fetching on every keystroke
  const debouncedShotsSearch = useDebouncedLibraryValue(shotsSearch);
  const debouncedProfilesSearch = useDebouncedLibraryValue(profilesSearch);
  const normalizedCurrentShotProfileName = cleanName(
    primaryDisplayShot?.profile || '',
  ).toLowerCase();
  const normalizedCurrentProfileName = getNormalizedCurrentProfileName(
    primaryDisplayProfile,
    primaryProfileMismatch,
    primaryDisplayProfileName,
  );
  const normalizedCompareSecondaryProfileName = cleanName(
    secondaryDisplayProfileName,
  ).toLowerCase();
  // Shot pins remain profile-scoped for pin/unpin actions and row state, but
  // they no longer affect list ordering unless the user explicitly enables the
  // global "pinned first" mode in the header.
  const activeShotPinBucketKey = getActiveShotPinBucketKey({
    primaryDisplayProfile,
    primaryProfileMismatch,
    primaryDisplayProfileName,
  });
  const getEffectiveShotPinBucketKey = useCallback(
    item => activeShotPinBucketKey || getShotPinBucketKey(item),
    [activeShotPinBucketKey],
  );
  const getPinnedShotBucketKey = useCallback(
    item => getPinnedShotBucketKeyForItem(item, pinnedShotsByProfile),
    [pinnedShotsByProfile],
  );

  useEffect(() => {
    saveToStorage(ANALYZER_DB_KEYS.LIBRARY_SHOTS_SOURCE_FILTER, shotsSourceFilter);
  }, [shotsSourceFilter]);

  useEffect(() => {
    saveToStorage(ANALYZER_DB_KEYS.LIBRARY_PROFILES_SOURCE_FILTER, profilesSourceFilter);
  }, [profilesSourceFilter]);

  useLibraryServiceApi(apiService);
  useLibrarySelectionTargetSync({
    compareMode,
    currentShot,
    librarySelectionTarget,
    secondaryShot,
    setLibrarySelectionTarget,
  });
  useCloseLibraryOnOutsideClick({ collapsed, panelRef, setCollapsed });

  const refreshLibraries = useLibraryRefresh({
    debouncedProfilesSearch,
    debouncedShotsSearch,
    normalizedCurrentProfileName,
    normalizedCurrentShotProfileName,
    pinnedProfiles,
    pinnedShotsByProfile,
    profilesPinnedFirst,
    profilesSort,
    profilesSourceFilter,
    selectionPromotionsEnabled,
    setLoading,
    setNavigationShots,
    setProfiles,
    setShots,
    shotsPinnedFirst,
    shotsSort,
    shotsSourceFilter,
  });

  // --- Action Handlers ---

  const getProfilePinDisabledReason = useCallback(
    item => getProfilePinDisabledReasonForItem(item, pinnedProfiles),
    [pinnedProfiles],
  );

  const getShotPinDisabledReason = useCallback(
    item =>
      getShotPinDisabledReasonForItem({
        item,
        getEffectiveShotPinBucketKey,
        pinnedShotsByProfile,
      }),
    [getEffectiveShotPinBucketKey, pinnedShotsByProfile],
  );

  const handleProfilePinToggle = useCallback(item => {
    applyChangedProfilePins(toggleProfilePin(item), setPinnedProfiles);
  }, []);

  const handleShotPinToggle = useCallback(
    item => {
      const resolvedBucketKey = getShotPinToggleBucketKey({
        getEffectiveShotPinBucketKey,
        getPinnedShotBucketKey,
        item,
        shotsPinnedFirst,
      });
      applyChangedShotPins(toggleShotPin(item, resolvedBucketKey), setPinnedShotsByProfile);
    },
    [getEffectiveShotPinBucketKey, getPinnedShotBucketKey, shotsPinnedFirst],
  );

  const handleExport = async (item, isShot) => {
    try {
      await exportLibraryItems([{ item, isShot }]);
    } catch (e) {
      alert(`Export failed: ${e.message}`);
      console.error(e);
    }
  };

  const handleDelete = async item => {
    if (!confirm(`Are you sure you want to delete "${item.name || item.id}"?`)) return;
    try {
      await deleteLibraryItem(item);
      refreshLibraries();
    } catch (e) {
      alert(`Delete failed: ${e.message}`);
    }
  };

  const handleImport = useLibraryPanelImportHandler({
    currentShot,
    secondaryShot,
    importMode,
    compareMode,
    onShotSelect,
    onProfileLoad,
    onCompareShotToggle,
    onCompareProfileLoad,
    refreshLibraries,
    setImporting,
  });

  const openLibraryForTarget = useCallback(
    target => {
      setMobileActiveSection(getLibraryTargetMobileSection(target));

      if (!collapsed && librarySelectionTarget === target) {
        setCollapsed(true);
        return;
      }

      setLibrarySelectionTarget(target);
      setCollapsed(false);
    },
    [collapsed, librarySelectionTarget],
  );

  const handleShotRowAction = item => {
    executeShotRowActionIntent({
      compareMode,
      handleSwapCompareSlots,
      intent: getShotRowActionIntent({
        collapsed,
        compareMode,
        currentShot,
        item,
        librarySelectionTarget,
        primaryDisplayShot,
        secondaryShot,
      }),
      item,
      onCompareShotToggle,
      onShotSelect,
      setCollapsed,
    });
  };

  const handleStatusBarCompareToggle = useCallback(() => {
    executeStatusBarCompareToggle({
      compareMode,
      onCompareModeToggle,
      openLibraryForTarget,
      primaryDisplayShot,
    });
  }, [compareMode, onCompareModeToggle, openLibraryForTarget, primaryDisplayShot]);

  useLibraryPanelHotkeys({
    collapsed,
    librarySelectionTarget,
    openLibraryForTarget,
    setCollapsed,
    handleStatusBarCompareToggle,
  });

  const handleProfileRowAction = item => {
    executeProfileRowAction({
      item,
      librarySelectionTarget,
      onCompareProfileLoad,
      onProfileLoad,
      secondaryShot,
      setCollapsed,
    });
  };

  const handleNavigateShot = request => {
    onShotSelect?.({
      ...request,
      preserveCompare: Boolean(compareMode && compareHasSecondaryShot),
      requestSelectionScroll: false,
    });
  };

  const handleNavigateCompareShot = request => {
    if (!secondaryDisplayShot) return;
    onCompareShotToggle?.(request, true);
  };

  const handleClearSecondaryShot = () => {
    if (!secondaryDisplayShot) return;
    onCompareShotToggle?.(secondaryDisplayShot, false);
  };

  const handleSwapCompareSlots = () => {
    if (!currentShot || !secondaryShot) return;
    onCompareSwap?.();
  };

  const { barStyle, barSlotHeight, barSlotStyle, dropdownStyle, desktopSectionHeight } =
    getLibraryPanelLayoutStyles({
      collapsed,
      isMobileViewport,
      isStuck,
      barRect,
    });

  useAnalyzerStickyOffset(panelRef, barSlotHeight);

  const primaryStatusBarProps = {
    currentShot: primaryDisplayShot,
    currentProfile: primaryDisplayProfile,
    currentShotName: primaryDisplayShotName,
    currentProfileName: primaryDisplayProfileName,
    onUnloadShot: onShotUnload,
    onUnloadProfile: onProfileUnload,
    onExportShot: getLibraryExportHandler(primaryDisplayShot, true, handleExport),
    onExportProfile: getLibraryExportHandler(primaryDisplayProfile, false, handleExport),
    onCompareModeToggle: handleStatusBarCompareToggle,
    onRetryProfileSearch,
    onShotPanelToggle: () => openLibraryForTarget('primaryShot'),
    onProfilePanelToggle: () => openLibraryForTarget('primaryProfile'),
    onImport: files => handleImport(files, { slot: 'primary' }),
    onShowStats: createPrimaryStatsHandler({
      onShowStats,
      primaryDisplayProfile,
      primaryDisplayProfileName,
      primaryDisplayShot,
    }),
    statsHref,
    compareAvailable: shots.length > 0,
    compareMode,
    isMismatch: primaryProfileMismatch,
    isImporting: importing,
    isSearchingProfile: isPrimaryProfileSearching,
    isShotPending: isPrimarySelectionPending,
    canRetryProfileSearch: canRetryPrimaryProfileSearch,
  };
  const primaryActionBarProps = {
    currentShot,
    selectedShot: primaryDisplayShot,
    shotList: collapsed ? navigationShots : shots,
    onNavigate: handleNavigateShot,
    onCompareModeToggle: handleStatusBarCompareToggle,
    compareAvailable: shots.length > 0,
    compareMode,
    showCompareButton: true,
    onShowStats: primaryStatusBarProps.onShowStats,
    statsHref,
    statisticsAvailable: Boolean(primaryDisplayProfile || primaryProfileMismatch),
    onImport: files => handleImport(files, { slot: 'primary', targetType: 'any' }),
    isImporting: importing,
    importMode,
    onImportModeChange,
    isSelectionPending: isPrimarySelectionPending,
    isProfilePending: isPrimaryProfileSearching,
  };
  const secondaryStatusBarProps = {
    currentShot: secondaryDisplayShot,
    currentProfile: secondaryDisplayProfile,
    currentShotName: secondaryDisplayShotName,
    currentProfileName: secondaryDisplayProfileName,
    onUnloadShot: handleClearSecondaryShot,
    onUnloadProfile: onCompareProfileUnload,
    onExportShot: getLibraryExportHandler(secondaryDisplayShot, true, handleExport),
    onExportProfile: getLibraryExportHandler(secondaryDisplayProfile, false, handleExport),
    onRetryProfileSearch: onRetryCompareProfileSearch,
    onShotPanelToggle: () => openLibraryForTarget(getSecondaryShotPanelTarget(primaryDisplayShot)),
    onProfilePanelToggle: () =>
      maybeOpenSecondaryProfilePanel({ openLibraryForTarget, secondaryDisplayShot }),
    onImport: files =>
      handleImport(files, {
        slot: getSecondaryImportSlot(currentShot),
      }),
    onShowStats: createSecondaryStatsHandler({
      onShowStats,
      primaryDisplayShot,
      secondaryDisplayProfile,
      secondaryDisplayProfileName,
      secondaryDisplayShot,
    }),
    statsHref: secondaryStatsHref,
    compareAvailable: false,
    compareMode,
    isMismatch: secondaryProfileMismatch,
    isImporting: importing,
    isSearchingProfile: isCompareProfileSearching,
    isShotPending: isCompareSelectionPending,
    canRetryProfileSearch: canRetryCompareProfileSearch,
    showCompareButton: false,
    compareBadgeNumber: 2,
    ghosted: true,
  };
  const secondaryActionBarProps = {
    currentShot: secondaryShot,
    selectedShot: secondaryDisplayShot,
    shotList: collapsed ? navigationShots : shots,
    onNavigate: handleNavigateCompareShot,
    onShowStats: secondaryStatusBarProps.onShowStats,
    statsHref: secondaryStatsHref,
    statisticsAvailable: Boolean(secondaryDisplayProfile || secondaryProfileMismatch),
    onImport: files =>
      handleImport(files, {
        slot: getSecondaryImportSlot(currentShot),
        targetType: 'any',
      }),
    isImporting: importing,
    importMode,
    onImportModeChange,
    isSelectionPending: isCompareSelectionPending,
    isProfilePending: isCompareProfileSearching,
    showImportModeToggle: false,
    showCompareButton: false,
    enableKeyboardNavigation: false,
  };
  return (
    <div ref={panelRef} className='relative'>
      <div ref={sentinelRef} className='h-0 w-full' />

      <div ref={barSlotRef} className='relative w-full' style={barSlotStyle}>
        <div ref={barRef} style={barStyle}>
          <LibraryPanelStatusSlots
            collapsed={collapsed}
            compareMode={compareMode}
            primaryActionBarProps={primaryActionBarProps}
            primaryStatusBarProps={primaryStatusBarProps}
            secondaryActionBarProps={secondaryActionBarProps}
            secondaryStatusBarProps={secondaryStatusBarProps}
          />
        </div>
      </div>

      {!collapsed && (
        <LibraryDropdown
          dropdownStyle={dropdownStyle}
          mobileActiveSection={mobileActiveSection}
          onClose={() => setCollapsed(true)}
          onMobileSectionChange={setMobileActiveSection}
        >
          {/* SHOTS SECTION */}
          <LibraryShotsPanelSection
            compareMode={compareMode}
            comparePendingKeys={comparePendingKeys}
            compareSecondaryShotKey={compareSecondaryShotKey}
            compareSelectedCount={compareSelectedCount}
            compareSelectionKeys={compareSelectionKeys}
            desktopSectionHeight={desktopSectionHeight}
            getEffectiveShotPinBucketKey={getEffectiveShotPinBucketKey}
            getPinnedShotBucketKey={getPinnedShotBucketKey}
            getShotPinDisabledReason={getShotPinDisabledReason}
            handleDelete={handleDelete}
            handleExport={handleExport}
            handleShotPinToggle={handleShotPinToggle}
            handleShotRowAction={handleShotRowAction}
            loading={loading}
            mobileActiveSection={mobileActiveSection}
            normalizedCurrentProfileName={normalizedCurrentProfileName}
            onCompareShotToggle={onCompareShotToggle}
            pinnedShotsByProfile={pinnedShotsByProfile}
            primaryDisplayProfile={primaryDisplayProfile}
            primaryDisplayShot={primaryDisplayShot}
            refreshLibraries={refreshLibraries}
            setShotsPinnedFirst={setShotsPinnedFirst}
            setShotsSearch={setShotsSearch}
            setShotsSort={setShotsSort}
            setShotsSourceFilter={setShotsSourceFilter}
            shots={shots}
            shotsPinnedFirst={shotsPinnedFirst}
            shotsSearch={shotsSearch}
            shotsSort={shotsSort}
            shotsSourceFilter={shotsSourceFilter}
          />

          {/* PROFILES SECTION */}
          <LibraryProfilesPanelSection
            compareMode={compareMode}
            desktopSectionHeight={desktopSectionHeight}
            getProfilePinDisabledReason={getProfilePinDisabledReason}
            handleDelete={handleDelete}
            handleExport={handleExport}
            handleLibraryProfileStatsOpen={handleLibraryProfileStatsOpen}
            handleProfilePinToggle={handleProfilePinToggle}
            handleProfileRowAction={handleProfileRowAction}
            loading={loading}
            mobileActiveSection={mobileActiveSection}
            normalizedCompareSecondaryProfileName={normalizedCompareSecondaryProfileName}
            pinnedProfiles={pinnedProfiles}
            primaryDisplayProfile={primaryDisplayProfile}
            primaryDisplayProfileName={primaryDisplayProfileName}
            primaryDisplayShot={primaryDisplayShot}
            profiles={profiles}
            profilesPinnedFirst={profilesPinnedFirst}
            profilesSearch={profilesSearch}
            profilesSort={profilesSort}
            profilesSourceFilter={profilesSourceFilter}
            refreshLibraries={refreshLibraries}
            secondaryDisplayProfile={secondaryDisplayProfile}
            secondaryDisplayProfileName={secondaryDisplayProfileName}
            secondaryDisplayShot={secondaryDisplayShot}
            setProfilesPinnedFirst={setProfilesPinnedFirst}
            setProfilesSearch={setProfilesSearch}
            setProfilesSort={setProfilesSort}
            setProfilesSourceFilter={setProfilesSourceFilter}
          />
        </LibraryDropdown>
      )}
    </div>
  );
}
