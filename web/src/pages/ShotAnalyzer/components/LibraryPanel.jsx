/**
 * LibraryPanel.jsx
 * Main library surface for the Shot Analyzer.
 * It owns data refresh, sticky header state, and the selection/pinning rules
 * that feed the two library tables.
 */

import { useState, useEffect, useContext, useRef, useCallback } from 'preact/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUpDown } from '@fortawesome/free-solid-svg-icons/faUpDown';
import { StatusBar } from './StatusBar';
import { NotesBar } from './NotesBar';
import { LibrarySection } from './LibrarySection';
import {
  getAnalyzerIconButtonClasses,
  getAnalyzerTextButtonClasses,
} from './analyzerControlStyles';
import { libraryService } from '../services/LibraryService';
import { indexedDBService } from '../services/IndexedDBService';
import { notesService } from '../services/NotesService';
import { ApiServiceContext } from '../../../services/ApiService';
import {
  ANALYZER_DB_KEYS,
  MAX_PINNED_PROFILES,
  MAX_PINNED_SHOTS_PER_PROFILE,
  PINNED_NO_PROFILE_BUCKET,
  cleanName,
  getProfileDisplayLabel,
  getPinnedProfiles,
  getPinnedShotsByProfile,
  getProfilePinKey,
  getShotIdentityKey,
  getShotPinBucketKey,
  isProfilePinned,
  isShotPinned,
  isShotPinnedAnywhere,
  loadFromStorage,
  saveToStorage,
  toggleProfilePin,
  toggleShotPin,
} from '../utils/analyzerUtils';
import { downloadJson } from '../../../utils/download';

function getStoredLibrarySourceFilter(storageKey) {
  const storedValue = loadFromStorage(storageKey, 'all');
  return storedValue === 'gaggimate' || storedValue === 'browser' || storedValue === 'all'
    ? storedValue
    : 'all';
}

function getLibraryRequestSource(sourceFilter) {
  return sourceFilter === 'all' ? 'both' : sourceFilter;
}

function getLibraryShotSearchPriority(item, query) {
  const normalizedId = String(item?.id || '').toLowerCase();
  const normalizedName = (item?.name || item?.label || item?.title || '').toLowerCase();
  return normalizedName.includes(query) || normalizedId.includes(query) ? 0 : 1;
}

function applyLibrarySort(items, cfg) {
  return [...items].sort((a, b) => {
    let valA;
    let valB;

    switch (cfg.key) {
      case 'shotDate':
        valA = a.timestamp || 0;
        valB = b.timestamp || 0;
        break;
      case 'name':
        valA = getProfileDisplayLabel(a, a.profile || '').toLowerCase();
        valB = getProfileDisplayLabel(b, b.profile || '').toLowerCase();
        break;
      case 'data.rating':
        valA = a.rating || 0;
        valB = b.rating || 0;
        break;
      case 'duration':
        valA = parseFloat(a.duration) || 0;
        valB = parseFloat(b.duration) || 0;
        break;
      default:
        valA = a[cfg.key];
        valB = b[cfg.key];
    }

    if (valA < valB) return cfg.order === 'asc' ? -1 : 1;
    if (valA > valB) return cfg.order === 'asc' ? 1 : -1;
    return 0;
  });
}

function promoteLibraryItems(items, predicate) {
  const promoted = [];
  const remaining = [];

  items.forEach(item => {
    if (predicate(item)) promoted.push(item);
    else remaining.push(item);
  });

  return [...promoted, ...remaining];
}

function filterLibraryShots(shotsData, shotSearch, profileSearch) {
  let filteredShots = shotsData;

  if (shotSearch) {
    const normalizedShotSearch = shotSearch.toLowerCase();
    filteredShots = shotsData.filter(shot => {
      const nameMatch = (shot.name || shot.label || shot.title || '')
        .toLowerCase()
        .includes(normalizedShotSearch);
      const profileMatch = (shot.profile || shot.profileName || '')
        .toLowerCase()
        .includes(normalizedShotSearch);
      const idMatch = String(shot.id || '')
        .toLowerCase()
        .includes(normalizedShotSearch);
      const fileMatch = (shot.fileName || shot.exportName || '')
        .toLowerCase()
        .includes(normalizedShotSearch);

      return nameMatch || profileMatch || idMatch || fileMatch;
    });

    filteredShots.sort(
      (a, b) =>
        getLibraryShotSearchPriority(a, normalizedShotSearch) -
        getLibraryShotSearchPriority(b, normalizedShotSearch),
    );
  }

  if (!profileSearch) return filteredShots;

  const normalizedProfileSearch = profileSearch.toLowerCase();
  return filteredShots.filter(shot =>
    (shot.profile || shot.profileName || '').toLowerCase().includes(normalizedProfileSearch),
  );
}

function filterLibraryProfiles(profilesData, profileSearch) {
  if (!profileSearch) return profilesData;
  const normalizedProfileSearch = profileSearch.toLowerCase();
  return profilesData.filter(profile =>
    getProfileDisplayLabel(profile, '').toLowerCase().includes(normalizedProfileSearch),
  );
}

function getProfileIdentityId(profile) {
  return String(
    profile?.profileId || profile?.id || profile?.data?.profileId || profile?.data?.id || '',
  ).trim();
}

function doesProfileMatchShot(profile, shot, fallbackProfileName = '') {
  if (!profile || !shot) return false;

  const shotProfileId = String(shot.profileId || '').trim();
  const profileId = getProfileIdentityId(profile);
  if (shotProfileId && profileId) {
    return shotProfileId === profileId;
  }

  const expectedProfileName = cleanName(shot.profile || '').toLowerCase();
  if (!expectedProfileName) return false;

  return getProfileDisplayLabel(profile, fallbackProfileName).toLowerCase() === expectedProfileName;
}

function doesProfileMatchProfile(profile, selectedProfile, selectedProfileName = '') {
  if (!profile || !selectedProfile) return false;

  const profileId = getProfileIdentityId(profile);
  const selectedProfileId = getProfileIdentityId(selectedProfile);
  if (profileId && selectedProfileId) {
    return profileId === selectedProfileId;
  }

  const selectedLabel = getProfileDisplayLabel(selectedProfile, selectedProfileName).toLowerCase();
  return getProfileDisplayLabel(profile, '').toLowerCase() === selectedLabel;
}

function hasLoadedProfileMismatch(shot, profile, fallbackProfileName = '') {
  return Boolean(shot && profile && !doesProfileMatchShot(profile, shot, fallbackProfileName));
}

function buildPromotedLibraryItems({
  shotsData,
  profilesData,
  shotSearch,
  profileSearch,
  shotsSort,
  profilesSort,
  normalizedCurrentProfileName,
  normalizedCurrentShotProfileName,
  pinnedProfiles,
  pinnedShotsByProfile,
  shotsPinnedFirst,
  profilesPinnedFirst,
  selectionPromotionsEnabled = true,
}) {
  const filteredShots = filterLibraryShots(shotsData, shotSearch, profileSearch);
  const filteredProfiles = filterLibraryProfiles(profilesData, profileSearch);
  const hasActiveProfileMatch =
    selectionPromotionsEnabled &&
    normalizedCurrentProfileName &&
    normalizedCurrentProfileName !== 'no profile loaded';
  const hasActiveShotProfileMatch =
    selectionPromotionsEnabled &&
    normalizedCurrentShotProfileName &&
    normalizedCurrentShotProfileName !== 'no profile loaded';
  const promoteMatchedShots = item =>
    hasActiveProfileMatch &&
    cleanName(item.profile || '').toLowerCase() === normalizedCurrentProfileName;
  const promoteMatchedProfiles = item =>
    hasActiveShotProfileMatch &&
    doesProfileMatchShot(item, { profile: normalizedCurrentShotProfileName });

  let nextShots = applyLibrarySort(filteredShots, shotsSort);
  if (shotsPinnedFirst) {
    nextShots = promoteLibraryItems(nextShots, item =>
      isShotPinnedAnywhere(item, pinnedShotsByProfile),
    );
  } else {
    nextShots = promoteLibraryItems(nextShots, promoteMatchedShots);
  }

  let nextProfiles = applyLibrarySort(filteredProfiles, profilesSort);
  if (selectionPromotionsEnabled) {
    nextProfiles = promoteLibraryItems(nextProfiles, promoteMatchedProfiles);
  }
  if (profilesPinnedFirst) {
    nextProfiles = promoteLibraryItems(nextProfiles, item => isProfilePinned(item, pinnedProfiles));
  }

  return { nextShots, nextProfiles };
}

function buildShotNavigationItems({
  shotsData,
  shotsSort,
  shotsPinnedFirst,
  pinnedShotsByProfile,
}) {
  let nextShots = applyLibrarySort(shotsData, shotsSort);

  if (shotsPinnedFirst) {
    nextShots = promoteLibraryItems(nextShots, item =>
      isShotPinnedAnywhere(item, pinnedShotsByProfile),
    );
  }

  return nextShots;
}

function useLibraryPanelLayoutState({ sentinelRef, barRef }) {
  const [isStuck, setIsStuck] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 1023px)').matches : false,
  );
  const [barRect, setBarRect] = useState({ width: 0, left: 0, height: 0 });

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => setIsStuck(!entry.isIntersecting), {
      threshold: 0,
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinelRef]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const mediaQuery = window.matchMedia('(max-width: 1023px)');
    const handleChange = event => setIsMobileViewport(event.matches);

    setIsMobileViewport(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  const updateRect = useCallback(() => {
    if (!sentinelRef.current) return;
    const rect = sentinelRef.current.getBoundingClientRect();
    setBarRect({
      width: rect.width,
      left: rect.left,
      height: barRef.current?.offsetHeight || 64,
    });
  }, [barRef, sentinelRef]);

  useEffect(() => {
    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, { passive: true });
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect);
    };
  }, [updateRect]);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const resizeObserver = new ResizeObserver(() => updateRect());
    if (barRef.current) resizeObserver.observe(barRef.current);
    if (sentinelRef.current) resizeObserver.observe(sentinelRef.current);
    return () => resizeObserver.disconnect();
  }, [barRef, sentinelRef, updateRect]);

  return {
    isStuck,
    isMobileViewport,
    barRect,
  };
}

function useLibraryPanelNotesState({ currentShot, secondaryShot, compareMode }) {
  const [primaryNotesExpanded, setPrimaryNotesExpanded] = useState(false);
  const [primaryNotesIsEditing, setPrimaryNotesIsEditing] = useState(false);
  const [primaryNotesExpandedHeight, setPrimaryNotesExpandedHeight] = useState(0);
  const [secondaryNotesExpanded, setSecondaryNotesExpanded] = useState(false);
  const [secondaryNotesIsEditing, setSecondaryNotesIsEditing] = useState(false);
  const [secondaryNotesExpandedHeight, setSecondaryNotesExpandedHeight] = useState(0);

  useEffect(() => {
    if (!primaryNotesExpanded) {
      setPrimaryNotesIsEditing(false);
      setPrimaryNotesExpandedHeight(0);
    }
  }, [primaryNotesExpanded]);

  useEffect(() => {
    if (!secondaryNotesExpanded) {
      setSecondaryNotesIsEditing(false);
      setSecondaryNotesExpandedHeight(0);
    }
  }, [secondaryNotesExpanded]);

  useEffect(() => {
    if (!currentShot) {
      setPrimaryNotesExpanded(false);
      setPrimaryNotesIsEditing(false);
      setPrimaryNotesExpandedHeight(0);
    }
  }, [currentShot]);

  useEffect(() => {
    if (!secondaryShot || !compareMode) {
      setSecondaryNotesExpanded(false);
      setSecondaryNotesIsEditing(false);
      setSecondaryNotesExpandedHeight(0);
    }
  }, [secondaryShot, compareMode]);

  return {
    primaryNotesExpanded,
    setPrimaryNotesExpanded,
    primaryNotesIsEditing,
    setPrimaryNotesIsEditing,
    primaryNotesExpandedHeight,
    setPrimaryNotesExpandedHeight,
    secondaryNotesExpanded,
    setSecondaryNotesExpanded,
    secondaryNotesIsEditing,
    setSecondaryNotesIsEditing,
    secondaryNotesExpandedHeight,
    setSecondaryNotesExpandedHeight,
  };
}

function getLibraryPanelDisplayState({
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
}) {
  const primaryDisplayShot = pendingPrimarySelection?.shot || currentShot;
  const primaryDisplayShotName = pendingPrimarySelection?.name || currentShotName;
  const primaryDisplayProfile = pendingPrimarySelection ? null : currentProfile;
  const primaryDisplayProfileName = pendingPrimarySelection
    ? cleanName(primaryDisplayShot?.profile || 'No Profile Loaded')
    : currentProfileName;
  const secondaryDisplayShot = pendingCompareSelection?.shot || secondaryShot;
  const secondaryDisplayShotName = pendingCompareSelection?.name || secondaryShotName;
  const secondaryDisplayProfile = pendingCompareSelection ? null : secondaryProfile;
  const secondaryDisplayProfileName = pendingCompareSelection
    ? cleanName(secondaryDisplayShot?.profile || 'No Profile Loaded')
    : secondaryProfileName;
  const isPrimarySelectionPending = Boolean(pendingPrimarySelection);
  const isCompareSelectionPending = Boolean(pendingCompareSelection);
  const primaryProfileMismatch = hasLoadedProfileMismatch(
    primaryDisplayShot,
    primaryDisplayProfile,
    primaryDisplayProfileName,
  );
  const secondaryProfileMismatch = hasLoadedProfileMismatch(
    secondaryDisplayShot,
    secondaryDisplayProfile,
    secondaryDisplayProfileName,
  );
  const isPrimaryProfileSearching = !isPrimarySelectionPending && isSearchingProfile;
  const isCompareProfileSearching = !isCompareSelectionPending && compareIsSearchingProfile;
  const normalizedPrimaryExpectedProfileName = cleanName(
    primaryDisplayShot?.profile || '',
  ).toLowerCase();
  const normalizedCompareExpectedProfileName = cleanName(
    secondaryDisplayShot?.profile || '',
  ).toLowerCase();

  return {
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
    normalizedPrimaryExpectedProfileName,
    normalizedCompareExpectedProfileName,
    canRetryPrimaryProfileSearch:
      !pendingPrimarySelection &&
      !primaryDisplayProfile &&
      !isPrimaryProfileSearching &&
      Boolean(normalizedPrimaryExpectedProfileName) &&
      normalizedPrimaryExpectedProfileName !== 'no profile loaded',
    canRetryCompareProfileSearch:
      !pendingCompareSelection &&
      !secondaryDisplayProfile &&
      !isCompareProfileSearching &&
      Boolean(normalizedCompareExpectedProfileName) &&
      normalizedCompareExpectedProfileName !== 'no profile loaded',
    selectionPromotionsEnabled: !collapsed,
  };
}

function useLibraryPanelImportHandler({
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
}) {
  return useCallback(
    async (files, { targetType = 'any', slot = 'primary' } = {}) => {
      setImporting(true);

      setTimeout(async () => {
        let appliedImportCount = 0;
        let mismatchedImportCount = 0;
        let blockedSecondaryProfileImport = false;

        try {
          for (const file of Array.from(files)) {
            const text = await file.text();
            const data = JSON.parse(text);
            if (data.samples) {
              if (targetType === 'profile') {
                mismatchedImportCount += 1;
                continue;
              }

              const source = importMode === 'browser' ? 'browser' : 'temp';
              const storageKey = file.name;
              let notesWithId = null;
              const importedNotes = data.notes;
              const shotData = { ...data };
              delete shotData.notes;

              const shot = {
                ...shotData,
                id: String(shotData.id ?? storageKey),
                name: file.name,
                storageKey,
                data: shotData,
                source,
              };
              if (source === 'browser') await indexedDBService.saveShot(shot);

              if (importedNotes && typeof importedNotes === 'object') {
                notesWithId = {
                  ...notesService.getDefaults(storageKey),
                  ...importedNotes,
                  id: storageKey,
                };
                await notesService.saveNotes(storageKey, source, notesWithId);
              }

              const importedShot = notesWithId ? { ...shot, notes: notesWithId } : shot;
              if (slot === 'secondary' && currentShot) {
                await onCompareShotToggle?.(importedShot, true);
              } else {
                onShotSelect?.({
                  item: importedShot,
                  name: file.name,
                  preserveCompare: compareMode,
                });
              }
              appliedImportCount += 1;
              continue;
            }

            if (!data.phases) continue;
            if (targetType === 'shot') {
              mismatchedImportCount += 1;
              continue;
            }

            const profileName = data.label || cleanName(file.name);
            const profileData = data.label ? data : { ...data, label: profileName };
            const profile = {
              ...profileData,
              data: profileData,
              fileName: file.name,
              source: importMode === 'browser' ? 'browser' : 'temp',
            };
            if (importMode === 'browser') await indexedDBService.saveProfile(profile);

            if (slot !== 'secondary') {
              onProfileLoad(profileData, profileName, profile.source);
              appliedImportCount += 1;
              continue;
            }

            if (secondaryShot) {
              onCompareProfileLoad?.(profileData, profileName, profile.source);
              appliedImportCount += 1;
            } else if (currentShot) {
              blockedSecondaryProfileImport = true;
            } else {
              onProfileLoad(profileData, profileName, profile.source);
              appliedImportCount += 1;
            }
          }

          if (appliedImportCount === 0) {
            if (blockedSecondaryProfileImport) {
              alert('Load a secondary shot before importing a secondary profile.');
            } else if (mismatchedImportCount > 0) {
              alert(
                targetType === 'shot'
                  ? 'Only shot files can be imported in the shot field.'
                  : 'Only profile files can be imported in the profile field.',
              );
            }
          }
        } catch (error) {
          console.error('Import error:', error);
          alert('Import failed. Please check the file format.');
        } finally {
          setImporting(false);
          refreshLibraries();
        }
      }, 50);
    },
    [
      compareMode,
      currentShot,
      importMode,
      onCompareProfileLoad,
      onCompareShotToggle,
      onProfileLoad,
      onShotSelect,
      refreshLibraries,
      secondaryShot,
      setImporting,
    ],
  );
}

function AnalyzerPanelSlot({ statusBarProps, notesBarProps }) {
  return (
    <div>
      <StatusBar {...statusBarProps} />
      <NotesBar {...notesBarProps} />
    </div>
  );
}

function useLibraryPanelHotkeys({
  collapsed,
  librarySelectionTarget,
  openLibraryForTarget,
  setCollapsed,
  handleStatusBarCompareToggle,
}) {
  useEffect(() => {
    const handleKeyDown = event => {
      if (event.defaultPrevented || event.repeat) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isLibraryHotkeyTypingTarget(event.target)) return;

      const key = String(event.key || '').toLowerCase();
      if (key === 'x') {
        event.preventDefault();
        if (collapsed) {
          openLibraryForTarget(librarySelectionTarget || 'primaryShot');
        } else {
          setCollapsed(true);
        }
        return;
      }

      if (key === 'c') {
        event.preventDefault();
        handleStatusBarCompareToggle();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    collapsed,
    librarySelectionTarget,
    openLibraryForTarget,
    setCollapsed,
    handleStatusBarCompareToggle,
  ]);
}

function getLibraryPanelLayoutStyles({
  collapsed,
  isMobileViewport,
  isStuck,
  barRect,
  primaryNotesIsEditing,
  primaryNotesExpandedHeight,
  secondaryNotesIsEditing,
  secondaryNotesExpandedHeight,
}) {
  const shouldBeFixed = !collapsed || (!isMobileViewport && isStuck);
  const fixedBarStyle = shouldBeFixed
    ? {
        position: 'fixed',
        top: 0,
        left: `${barRect.left}px`,
        width: `${barRect.width}px`,
        zIndex: 50,
      }
    : {};
  const expandedEditingOffset =
    (primaryNotesIsEditing ? primaryNotesExpandedHeight : 0) +
    (secondaryNotesIsEditing ? secondaryNotesExpandedHeight : 0);
  const dropdownTop = Math.max(0, barRect.height - expandedEditingOffset);

  return {
    shouldBeFixed,
    fixedBarStyle,
    dropdownTop,
    dropdownStyle: {
      position: 'fixed',
      top: `${dropdownTop}px`,
      left: `${barRect.left}px`,
      width: `${barRect.width}px`,
      zIndex: 49,
    },
    desktopSectionHeight: isMobileViewport
      ? undefined
      : `max(18rem, calc(100dvh - ${dropdownTop}px - 2rem))`,
  };
}

function isLibraryHotkeyTypingTarget(target) {
  const activeElement =
    typeof Element !== 'undefined' && target instanceof Element ? target : document.activeElement;
  if (!activeElement) return false;
  const tag = activeElement.tagName?.toLowerCase();
  if (activeElement.isContentEditable) return true;
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return !!activeElement.closest(
    'input, textarea, select, [contenteditable="true"], [role="textbox"]',
  );
}

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
  const barRef = useRef(null);
  const refreshIdRef = useRef(0);

  // UI State
  const [collapsed, setCollapsed] = useState(true);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false); // Specific state for import spinner
  const [librarySelectionTarget, setLibrarySelectionTarget] = useState('primaryShot');
  const { isStuck, isMobileViewport, barRect } = useLibraryPanelLayoutState({
    sentinelRef,
    barRef,
  });
  const {
    primaryNotesExpanded,
    setPrimaryNotesExpanded,
    primaryNotesIsEditing,
    setPrimaryNotesIsEditing,
    primaryNotesExpandedHeight,
    setPrimaryNotesExpandedHeight,
    secondaryNotesExpanded,
    setSecondaryNotesExpanded,
    secondaryNotesIsEditing,
    setSecondaryNotesIsEditing,
    secondaryNotesExpandedHeight,
    setSecondaryNotesExpandedHeight,
  } = useLibraryPanelNotesState({
    currentShot,
    secondaryShot,
    compareMode,
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
        const currentAnalyzerShotSource =
          currentShot?.source ||
          secondaryShot?.source ||
          getLibraryRequestSource(shotsSourceFilter) ||
          'both';
        const profileSource = profileItem.source || profileItem.src || 'both';
        const statsInitialContext = {
          profileName: getProfileDisplayLabel(profileItem, ''),
          shotSource: currentAnalyzerShotSource,
          profileSource,
          source: profileSource,
        };
        if (compareMode) {
          statsInitialContext.preferredDetailSection = 'compare';
        }
        sessionStorage.setItem('statsInitialContext', JSON.stringify(statsInitialContext));
      } catch {
        // Ignore session storage issues and keep navigation working.
      }
    },
    [compareMode, currentShot?.source, secondaryShot?.source, shotsSourceFilter],
  );

  // Debounced search values to avoid re-fetching on every keystroke
  const [debouncedShotsSearch, setDebouncedShotsSearch] = useState('');
  const [debouncedProfilesSearch, setDebouncedProfilesSearch] = useState('');
  const normalizedCurrentShotProfileName = cleanName(
    primaryDisplayShot?.profile || '',
  ).toLowerCase();
  const normalizedCurrentProfileName =
    primaryDisplayProfile && !primaryProfileMismatch
      ? cleanName(primaryDisplayProfileName).toLowerCase()
      : '';
  const normalizedCompareSecondaryProfileName = cleanName(
    secondaryDisplayProfileName,
  ).toLowerCase();
  const resolveRealProfilePinKey = useCallback(profileValue => {
    const key = getProfilePinKey(profileValue);
    return key && key !== 'no profile loaded' ? key : '';
  }, []);
  // Shot pins remain profile-scoped for pin/unpin actions and row state, but
  // they no longer affect list ordering unless the user explicitly enables the
  // global "pinned first" mode in the header.
  const activeShotPinBucketKey =
    primaryDisplayProfile && !primaryProfileMismatch
      ? resolveRealProfilePinKey(primaryDisplayProfileName)
      : '';
  const getEffectiveShotPinBucketKey = useCallback(
    item => activeShotPinBucketKey || getShotPinBucketKey(item),
    [activeShotPinBucketKey],
  );
  const getPinnedShotBucketKey = useCallback(
    item => {
      const shotKey = getShotIdentityKey(item);
      if (!shotKey) return '';

      return (
        Object.entries(pinnedShotsByProfile).find(([, shotKeys]) =>
          shotKeys.includes(shotKey),
        )?.[0] || ''
      );
    },
    [pinnedShotsByProfile],
  );

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedShotsSearch(shotsSearch), 250);
    return () => clearTimeout(timer);
  }, [shotsSearch]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedProfilesSearch(profilesSearch), 250);
    return () => clearTimeout(timer);
  }, [profilesSearch]);

  useEffect(() => {
    saveToStorage(ANALYZER_DB_KEYS.LIBRARY_SHOTS_SOURCE_FILTER, shotsSourceFilter);
  }, [shotsSourceFilter]);

  useEffect(() => {
    saveToStorage(ANALYZER_DB_KEYS.LIBRARY_PROFILES_SOURCE_FILTER, profilesSourceFilter);
  }, [profilesSourceFilter]);

  // Initialize API Service for Library
  useEffect(() => {
    if (apiService) libraryService.setApiService(apiService);
  }, [apiService]);

  useEffect(() => {
    if (!compareMode) {
      setLibrarySelectionTarget('primaryShot');
    }
  }, [compareMode]);

  useEffect(() => {
    if (compareMode && currentShot && !secondaryShot && librarySelectionTarget === 'primaryShot') {
      setLibrarySelectionTarget('secondaryShot');
    }
  }, [compareMode, currentShot, secondaryShot, librarySelectionTarget]);

  useEffect(() => {
    if (!isPrimarySelectionPending) return;
    setPrimaryNotesExpanded(false);
    setPrimaryNotesIsEditing(false);
    setPrimaryNotesExpandedHeight(0);
  }, [
    isPrimarySelectionPending,
    setPrimaryNotesExpanded,
    setPrimaryNotesExpandedHeight,
    setPrimaryNotesIsEditing,
  ]);

  useEffect(() => {
    if (!isCompareSelectionPending) return;
    setSecondaryNotesExpanded(false);
    setSecondaryNotesIsEditing(false);
    setSecondaryNotesExpandedHeight(0);
  }, [
    isCompareSelectionPending,
    setSecondaryNotesExpanded,
    setSecondaryNotesExpandedHeight,
    setSecondaryNotesIsEditing,
  ]);

  // Close panel on outside click
  useEffect(() => {
    if (collapsed) return;
    const handleOutsideClick = e => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setCollapsed(true);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [collapsed]);

  /**
   * Fetch, Filter, and Sort data from sources.
   * Reorders rows by selection match and pin state after the base sort.
   */
  const refreshLibraries = useCallback(async () => {
    const id = ++refreshIdRef.current;
    setLoading(true);
    try {
      const [shotsData, profilesData] = await Promise.all([
        libraryService.getAllShots(getLibraryRequestSource(shotsSourceFilter)),
        libraryService.getAllProfiles(getLibraryRequestSource(profilesSourceFilter)),
      ]);

      if (id !== refreshIdRef.current) return; // stale request, discard
      const { nextShots, nextProfiles } = buildPromotedLibraryItems({
        shotsData,
        profilesData,
        shotSearch: debouncedShotsSearch,
        profileSearch: debouncedProfilesSearch,
        shotsSort,
        profilesSort,
        normalizedCurrentProfileName: selectionPromotionsEnabled
          ? normalizedCurrentProfileName
          : '',
        normalizedCurrentShotProfileName: selectionPromotionsEnabled
          ? normalizedCurrentShotProfileName
          : '',
        pinnedProfiles,
        pinnedShotsByProfile,
        shotsPinnedFirst,
        profilesPinnedFirst,
        selectionPromotionsEnabled,
      });
      const nextNavigationShots = buildShotNavigationItems({
        shotsData,
        shotsSort,
        shotsPinnedFirst,
        pinnedShotsByProfile,
      });

      setShots(nextShots);
      setProfiles(nextProfiles);
      setNavigationShots(nextNavigationShots);
    } catch (error) {
      if (id !== refreshIdRef.current) return;
      console.error('Library refresh failed:', error);
    } finally {
      if (id === refreshIdRef.current) {
        setLoading(false);
      }
    }
  }, [
    shotsSourceFilter,
    profilesSourceFilter,
    debouncedShotsSearch,
    debouncedProfilesSearch,
    shotsSort,
    profilesSort,
    selectionPromotionsEnabled,
    normalizedCurrentProfileName,
    normalizedCurrentShotProfileName,
    pinnedProfiles,
    pinnedShotsByProfile,
    shotsPinnedFirst,
    profilesPinnedFirst,
  ]);

  useEffect(() => {
    refreshLibraries();
  }, [refreshLibraries]);

  // --- Action Handlers ---

  const getProfilePinDisabledReason = useCallback(
    item => {
      if (isProfilePinned(item, pinnedProfiles)) return '';
      if (pinnedProfiles.length >= MAX_PINNED_PROFILES) {
        return `Maximum ${MAX_PINNED_PROFILES} pinned profiles`;
      }
      return '';
    },
    [pinnedProfiles],
  );

  const getShotPinDisabledReason = useCallback(
    item => {
      const bucketKey = getEffectiveShotPinBucketKey(item);
      if (isShotPinned(item, bucketKey, pinnedShotsByProfile)) return '';

      const pinnedCount = (pinnedShotsByProfile[bucketKey] || []).length;
      if (pinnedCount >= MAX_PINNED_SHOTS_PER_PROFILE) {
        return bucketKey === PINNED_NO_PROFILE_BUCKET
          ? `Maximum ${MAX_PINNED_SHOTS_PER_PROFILE} pinned shots without a profile`
          : `Maximum ${MAX_PINNED_SHOTS_PER_PROFILE} pinned shots per profile`;
      }

      return '';
    },
    [getEffectiveShotPinBucketKey, pinnedShotsByProfile],
  );

  const handleProfilePinToggle = useCallback(item => {
    const result = toggleProfilePin(item);
    if (!result.changed) return;
    setPinnedProfiles(result.pinnedProfiles);
  }, []);

  const handleShotPinToggle = useCallback(
    item => {
      const resolvedBucketKey =
        (shotsPinnedFirst && getPinnedShotBucketKey(item)) || getEffectiveShotPinBucketKey(item);
      const result = toggleShotPin(item, resolvedBucketKey);
      if (!result.changed) return;
      setPinnedShotsByProfile(result.pinnedShotsByProfile);
    },
    [getEffectiveShotPinBucketKey, getPinnedShotBucketKey, shotsPinnedFirst],
  );

  // Uses libraryService.exportItem to fetch data, then uses UI helper 'downloadJson'
  const handleExport = async (item, isShot) => {
    try {
      // 1. Fetch data via service (now returns { exportData, filename })
      const { exportData, filename } = await libraryService.exportItem(item, isShot);

      // 2. Use existing UI helper for consistent downloading
      downloadJson(exportData, filename);
    } catch (e) {
      alert(`Export failed: ${e.message}`);
      console.error(e);
    }
  };

  const handleDelete = async item => {
    if (!confirm(`Are you sure you want to delete "${item.name || item.id}"?`)) return;
    try {
      if (item.duration !== undefined || item.samples) {
        const deleteKey =
          item.source === 'gaggimate' ? item.id : item.storageKey || item.name || item.id;
        await libraryService.deleteShot(deleteKey, item.source);
      } else {
        const deleteKey =
          item.source === 'gaggimate' ? item.profileId || item.id : item.label || item.name;
        await libraryService.deleteProfile(deleteKey, item.source);
      }
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
      const nextMobileSection =
        target === 'primaryProfile' || target === 'secondaryProfile' ? 'profiles' : 'shots';

      setMobileActiveSection(nextMobileSection);

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
    const primaryShotKey = primaryDisplayShot ? getShotIdentityKey(primaryDisplayShot) : '';
    const committedSecondaryShotKey = secondaryShot ? getShotIdentityKey(secondaryShot) : '';
    const itemShotKey = item ? getShotIdentityKey(item) : '';

    if (librarySelectionTarget === 'secondaryShot') {
      if (!primaryDisplayShot || !itemShotKey || itemShotKey === primaryShotKey) return;
      setCollapsed(true);
      onCompareShotToggle?.({ item, debounceMs: 0 }, true);
      return;
    }

    if (compareMode && committedSecondaryShotKey && itemShotKey === committedSecondaryShotKey) {
      setCollapsed(true);
      handleSwapCompareSlots();
      return;
    }

    const keepLibraryOpenForCompareBootstrap = compareMode && !currentShot;
    const shouldRequestSelectionScroll = !collapsed && !keepLibraryOpenForCompareBootstrap;
    if (!keepLibraryOpenForCompareBootstrap) {
      setCollapsed(true);
    }
    onShotSelect?.({
      item,
      preserveCompare: compareMode,
      requestSelectionScroll: shouldRequestSelectionScroll,
      debounceMs: 0,
    });
  };

  const handleStatusBarCompareToggle = useCallback(() => {
    if (!compareMode) {
      onCompareModeToggle?.();
      openLibraryForTarget(primaryDisplayShot ? 'secondaryShot' : 'primaryShot');
      return;
    }

    onCompareModeToggle?.();
  }, [compareMode, onCompareModeToggle, openLibraryForTarget, primaryDisplayShot]);

  useLibraryPanelHotkeys({
    collapsed,
    librarySelectionTarget,
    openLibraryForTarget,
    setCollapsed,
    handleStatusBarCompareToggle,
  });

  const handleProfileRowAction = item => {
    if (librarySelectionTarget === 'secondaryProfile') {
      if (!secondaryShot) return;
      onCompareProfileLoad?.(item.data || item, getProfileDisplayLabel(item, ''), item.source);
      setCollapsed(true);
      return;
    }

    onProfileLoad(item.data || item, getProfileDisplayLabel(item, ''), item.source);
    setCollapsed(true);
  };

  const handleNavigateShot = request => {
    onShotSelect?.({
      ...request,
      preserveCompare: compareMode && compareHasSecondaryShot,
      requestSelectionScroll: false,
    });
  };

  const handleNavigateCompareShot = request => {
    if (!secondaryDisplayShot) return;
    onCompareShotToggle?.(request, true);
  };

  const handleClearSecondaryShot = () => {
    if (!secondaryDisplayShot) return;
    setSecondaryNotesExpanded(false);
    setSecondaryNotesIsEditing(false);
    setSecondaryNotesExpandedHeight(0);
    onCompareShotToggle?.(secondaryDisplayShot, false);
  };

  const handleSwapCompareSlots = () => {
    if (!currentShot || !secondaryShot) return;
    setPrimaryNotesExpanded(false);
    setPrimaryNotesIsEditing(false);
    setPrimaryNotesExpandedHeight(0);
    setSecondaryNotesExpanded(false);
    setSecondaryNotesIsEditing(false);
    setSecondaryNotesExpandedHeight(0);
    onCompareSwap?.();
  };

  const { shouldBeFixed, fixedBarStyle, dropdownStyle, desktopSectionHeight } =
    getLibraryPanelLayoutStyles({
      collapsed,
      isMobileViewport,
      isStuck,
      barRect,
      primaryNotesIsEditing,
      primaryNotesExpandedHeight,
      secondaryNotesIsEditing,
      secondaryNotesExpandedHeight,
    });
  const primaryStatusBarProps = {
    currentShot: primaryDisplayShot,
    currentProfile: primaryDisplayProfile,
    currentShotName: primaryDisplayShotName,
    currentProfileName: primaryDisplayProfileName,
    onUnloadShot: onShotUnload,
    onUnloadProfile: onProfileUnload,
    onCompareModeToggle: handleStatusBarCompareToggle,
    onRetryProfileSearch,
    onShotPanelToggle: () => openLibraryForTarget('primaryShot'),
    onProfilePanelToggle: () => openLibraryForTarget('primaryProfile'),
    onImport: files => handleImport(files, { slot: 'primary' }),
    onShowStats: () =>
      onShowStats?.({
        shotSource: primaryDisplayShot?.source || 'both',
        profileSource: primaryDisplayProfile?.source || 'both',
        profileName: primaryDisplayProfileName,
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
  const primaryNotesBarProps = {
    currentShot,
    currentShotName,
    selectedShot: primaryDisplayShot,
    selectedShotName: primaryDisplayShotName,
    selectedProfileName: primaryDisplayProfileName,
    shotList: collapsed ? navigationShots : shots,
    onNavigate: handleNavigateShot,
    importMode,
    onImportModeChange,
    isExpanded: !collapsed,
    isSelectionPending: isPrimarySelectionPending,
    isProfilePending: isPrimaryProfileSearching,
    notesExpanded: primaryNotesExpanded,
    onToggleNotesExpanded: () => setPrimaryNotesExpanded(value => !value),
    onEditingChange: setPrimaryNotesIsEditing,
    onExpandedHeightChange: setPrimaryNotesExpandedHeight,
  };
  const secondaryStatusBarProps = {
    currentShot: secondaryDisplayShot,
    currentProfile: secondaryDisplayProfile,
    currentShotName: secondaryDisplayShotName,
    currentProfileName: secondaryDisplayProfileName,
    onUnloadShot: handleClearSecondaryShot,
    onUnloadProfile: onCompareProfileUnload,
    onRetryProfileSearch: onRetryCompareProfileSearch,
    onShotPanelToggle: () =>
      openLibraryForTarget(primaryDisplayShot ? 'secondaryShot' : 'primaryShot'),
    onProfilePanelToggle: () => {
      if (!secondaryDisplayShot) return;
      openLibraryForTarget('secondaryProfile');
    },
    onImport: files =>
      handleImport(files, {
        slot: currentShot ? 'secondary' : 'primary',
      }),
    onShowStats: () =>
      onShowStats?.({
        shotSource: secondaryDisplayShot?.source || primaryDisplayShot?.source || 'both',
        profileSource: secondaryDisplayProfile?.source || 'both',
        profileName: secondaryDisplayProfileName,
      }),
    statsHref: secondaryStatsHref,
    compareAvailable: false,
    compareMode,
    isMismatch: secondaryProfileMismatch,
    isImporting: importing,
    isSearchingProfile: isCompareProfileSearching,
    isShotPending: isCompareSelectionPending,
    canRetryProfileSearch: canRetryCompareProfileSearch,
    compact: true,
    showCompareButton: false,
    compareBadgeNumber: 2,
    ghosted: true,
  };
  const secondaryNotesBarProps = {
    currentShot: secondaryShot,
    currentShotName: secondaryShotName,
    selectedShot: secondaryDisplayShot,
    selectedShotName: secondaryDisplayShotName,
    selectedProfileName: secondaryDisplayProfileName,
    shotList: collapsed ? navigationShots : shots,
    onNavigate: handleNavigateCompareShot,
    importMode,
    onImportModeChange,
    isExpanded: !collapsed,
    isSelectionPending: isCompareSelectionPending,
    isProfilePending: isCompareProfileSearching,
    notesExpanded: secondaryNotesExpanded,
    onToggleNotesExpanded: () => setSecondaryNotesExpanded(value => !value),
    onEditingChange: setSecondaryNotesIsEditing,
    onExpandedHeightChange: setSecondaryNotesExpandedHeight,
    showImportModeToggle: false,
    enableKeyboardNavigation: false,
  };
  return (
    <div ref={panelRef} className='relative'>
      <div ref={sentinelRef} className='h-0 w-full' />
      {shouldBeFixed && <div style={{ height: `${barRect.height}px` }} />}

      <div ref={barRef} style={fixedBarStyle}>
        <div
          className={`bg-base-100/80 border-base-content/10 ${compareMode ? 'overflow-visible' : 'overflow-hidden'} border backdrop-blur-md transition-all duration-200 ${
            collapsed ? 'rounded-xl shadow-lg' : 'rounded-t-xl border-b-0 shadow-none'
          }`}
        >
          {compareMode ? (
            <div>
              <AnalyzerPanelSlot
                statusBarProps={{
                  ...primaryStatusBarProps,
                  compact: true,
                  compareBadgeNumber: 1,
                }}
                notesBarProps={primaryNotesBarProps}
              />
              <div className='flex -translate-y-2 items-center justify-center py-0'>
                <button
                  type='button'
                  onClick={handleSwapCompareSlots}
                  disabled={!currentShot || !secondaryShot}
                  className={getAnalyzerIconButtonClasses({
                    tone: !currentShot || !secondaryShot ? 'subtle' : 'primary',
                    className:
                      'h-5 w-5 rounded-none border-none bg-transparent p-0 shadow-none hover:bg-transparent disabled:cursor-not-allowed disabled:opacity-40',
                  })}
                  title='Swap shot 1 and shot 2'
                  aria-label='Swap shot 1 and shot 2'
                >
                  <FontAwesomeIcon icon={faUpDown} className='text-[11px]' />
                </button>
              </div>
              <AnalyzerPanelSlot
                statusBarProps={secondaryStatusBarProps}
                notesBarProps={secondaryNotesBarProps}
              />
            </div>
          ) : (
            <AnalyzerPanelSlot
              statusBarProps={primaryStatusBarProps}
              notesBarProps={primaryNotesBarProps}
            />
          )}
        </div>
      </div>

      {!collapsed && (
        <>
          <div
            className='fixed inset-0 cursor-pointer bg-black/20 backdrop-blur-[1px]'
            style={{ zIndex: 40 }}
            onClick={() => setCollapsed(true)}
          />
          <div style={dropdownStyle}>
            <div className='bg-base-100/80 border-base-content/10 animate-fade-in-down origin-top overflow-hidden rounded-b-xl border border-t-0 shadow-2xl backdrop-blur-md'>
              <div className='px-4 pt-4 lg:hidden'>
                <div className='bg-base-200/60 flex items-center gap-1 rounded-lg p-1'>
                  <button
                    type='button'
                    className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                      mobileActiveSection === 'shots'
                        ? 'bg-base-100 text-base-content shadow-sm'
                        : getAnalyzerTextButtonClasses({
                            className: 'justify-center',
                          })
                    }`}
                    onClick={() => setMobileActiveSection('shots')}
                  >
                    Shots
                  </button>
                  <button
                    type='button'
                    className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                      mobileActiveSection === 'profiles'
                        ? 'bg-base-100 text-base-content shadow-sm'
                        : getAnalyzerTextButtonClasses({
                            className: 'justify-center',
                          })
                    }`}
                    onClick={() => setMobileActiveSection('profiles')}
                  >
                    Profiles
                  </button>
                </div>
              </div>
              <div className='max-h-[75vh] overflow-y-auto overscroll-contain lg:max-h-none lg:overflow-hidden'>
                <div className='grid grid-cols-1 gap-x-4 gap-y-4 p-4 lg:grid-cols-2 lg:gap-x-1.5'>
                  {/* SHOTS SECTION */}
                  <div
                    className={
                      mobileActiveSection === 'shots' ? 'block lg:block' : 'hidden lg:block'
                    }
                  >
                    <LibrarySection
                      title='Shots'
                      items={shots}
                      isShot={true}
                      compareMode={compareMode}
                      sectionHeight={desktopSectionHeight}
                      searchValue={shotsSearch}
                      sortKey={shotsSort.key}
                      sortOrder={shotsSort.order}
                      sourceFilter={shotsSourceFilter}
                      onSearchChange={setShotsSearch}
                      onSortChange={(k, o) =>
                        setShotsSort({
                          key: k,
                          order:
                            o ||
                            (shotsSort.key === k && shotsSort.order === 'desc' ? 'asc' : 'desc'),
                        })
                      }
                      onSourceFilterChange={setShotsSourceFilter}
                      onLoad={handleShotRowAction}
                      onExport={item => handleExport(item, true)} // Pass true for shots
                      onDelete={handleDelete}
                      compareSelectedCount={compareSelectedCount}
                      compareSelectionKeys={compareSelectionKeys}
                      comparePendingKeys={comparePendingKeys}
                      compareReferenceKey={
                        primaryDisplayShot ? getShotIdentityKey(primaryDisplayShot) : ''
                      }
                      getCompareBadgeNumber={item => {
                        if (!compareMode) return null;
                        const itemKey = getShotIdentityKey(item);
                        if (!itemKey) return null;
                        if (
                          primaryDisplayShot &&
                          itemKey === getShotIdentityKey(primaryDisplayShot)
                        )
                          return 1;
                        if (compareSecondaryShotKey && itemKey === compareSecondaryShotKey)
                          return 2;
                        return null;
                      }}
                      onCompareToggle={onCompareShotToggle}
                      isLoading={loading} // Pass loading state to show spinner in list
                      onExportAll={() => {
                        if (shots.length === 0) return;
                        if (
                          confirm(
                            `Do you really want to export all ${shots.length} filtered shots? (Shots are downloaded individually, one after the other.)`,
                          )
                        ) {
                          for (let i = 0; i < shots.length; i++)
                            setTimeout(() => handleExport(shots[i], true), i * 300);
                        }
                      }}
                      onDeleteAll={async () => {
                        if (
                          confirm(
                            `WARNING: Do you really want to IRREVOCABLY delete all ${shots.length} filtered shots?`,
                          )
                        ) {
                          for (const s of shots)
                            await libraryService.deleteShot(
                              s.source === 'gaggimate' ? s.id : s.storageKey || s.name || s.id,
                              s.source,
                            );
                          refreshLibraries();
                        }
                      }}
                      getMatchStatus={item =>
                        primaryDisplayProfile &&
                        cleanName(item.profile || '').toLowerCase() === normalizedCurrentProfileName
                      }
                      getActiveStatus={item =>
                        primaryDisplayShot &&
                        getShotIdentityKey(item) === getShotIdentityKey(primaryDisplayShot) &&
                        item.source === primaryDisplayShot.source
                      }
                      getPinStatus={item =>
                        shotsPinnedFirst
                          ? Boolean(getPinnedShotBucketKey(item))
                          : isShotPinned(
                              item,
                              getEffectiveShotPinBucketKey(item),
                              pinnedShotsByProfile,
                            )
                      }
                      getPinDisabledReason={getShotPinDisabledReason}
                      pinnedFirstEnabled={shotsPinnedFirst}
                      onPinnedFirstToggle={() => setShotsPinnedFirst(value => !value)}
                      onPinToggle={handleShotPinToggle}
                    />
                  </div>

                  {/* PROFILES SECTION */}
                  <div
                    className={
                      mobileActiveSection === 'profiles' ? 'block lg:block' : 'hidden lg:block'
                    }
                  >
                    <LibrarySection
                      title='Profiles'
                      items={profiles}
                      isShot={false}
                      compareMode={compareMode}
                      sectionHeight={desktopSectionHeight}
                      searchValue={profilesSearch}
                      sortKey={profilesSort.key}
                      sortOrder={profilesSort.order}
                      sourceFilter={profilesSourceFilter}
                      onSearchChange={setProfilesSearch}
                      onSortChange={(k, o) =>
                        setProfilesSort({
                          key: k,
                          order:
                            o ||
                            (profilesSort.key === k && profilesSort.order === 'desc'
                              ? 'asc'
                              : 'desc'),
                        })
                      }
                      onSourceFilterChange={setProfilesSourceFilter}
                      onLoad={handleProfileRowAction}
                      onShowStats={handleLibraryProfileStatsOpen}
                      onExport={item => handleExport(item, false)} // Pass false for profiles
                      onDelete={handleDelete}
                      isLoading={loading} // Pass loading state to show spinner in list
                      onExportAll={() => {
                        if (profiles.length === 0) return;
                        if (
                          confirm(
                            `Do you really want to export all ${profiles.length} filtered profiles? (Profiles are downloaded individually, one after the other.)`,
                          )
                        ) {
                          for (let i = 0; i < profiles.length; i++)
                            setTimeout(() => handleExport(profiles[i], false), i * 300);
                        }
                      }}
                      onDeleteAll={async () => {
                        if (
                          confirm(
                            `WARNING: Do you really want to IRREVOCABLY delete all ${profiles.length} filtered profiles?`,
                          )
                        ) {
                          for (const p of profiles) {
                            const deleteKey =
                              p.source === 'gaggimate' ? p.profileId || p.id : p.label || p.name;
                            await libraryService.deleteProfile(deleteKey, p.source);
                          }
                          refreshLibraries();
                        }
                      }}
                      getMatchStatus={item =>
                        primaryDisplayShot && doesProfileMatchShot(item, primaryDisplayShot)
                      }
                      getCompareStatus={item =>
                        Boolean(
                          secondaryDisplayProfileName &&
                            normalizedCompareSecondaryProfileName &&
                            normalizedCompareSecondaryProfileName !== 'no profile loaded' &&
                            doesProfileMatchShot(item, secondaryDisplayShot),
                        )
                      }
                      getCompareBadgeNumber={item => {
                        if (!compareMode) return null;
                        if (
                          primaryDisplayProfile &&
                          doesProfileMatchProfile(
                            item,
                            primaryDisplayProfile,
                            primaryDisplayProfileName,
                          )
                        )
                          return 1;
                        if (
                          secondaryDisplayProfile &&
                          doesProfileMatchProfile(
                            item,
                            secondaryDisplayProfile,
                            secondaryDisplayProfileName,
                          )
                        ) {
                          return 2;
                        }
                        return null;
                      }}
                      getActiveStatus={item =>
                        primaryDisplayProfile &&
                        doesProfileMatchProfile(
                          item,
                          primaryDisplayProfile,
                          primaryDisplayProfileName,
                        )
                      }
                      getPinStatus={item => isProfilePinned(item, pinnedProfiles)}
                      getPinDisabledReason={getProfilePinDisabledReason}
                      pinnedFirstEnabled={profilesPinnedFirst}
                      onPinnedFirstToggle={() => setProfilesPinnedFirst(value => !value)}
                      onPinToggle={handleProfilePinToggle}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
