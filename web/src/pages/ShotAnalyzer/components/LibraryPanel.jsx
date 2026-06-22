/**
 * LibraryPanel.jsx
 * Main library surface for the Shot Analyzer.
 * It owns data refresh, sticky header state, and the selection/pinning rules
 * that feed the two library tables.
 */

/* global globalThis */

import { useState, useEffect, useContext, useRef, useCallback } from 'preact/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileImport } from '@fortawesome/free-solid-svg-icons/faFileImport';
import { StatusBar } from './StatusBar';
import { AnalyzerActionBar } from './AnalyzerActionBar';
import { LibrarySection } from './LibrarySection';
import { getAnalyzerTextButtonClasses } from './analyzerControlStyles';
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
  getShotStorageKey,
  isProfilePinned,
  isShotPinned,
  isShotPinnedAnywhere,
  loadFromStorage,
  saveToStorage,
  toggleProfilePin,
  toggleShotPin,
} from '../utils/analyzerUtils';
import { downloadJson } from '../../../utils/download';

const STATUS_BAR_CARD_GAP = 12;

function hasFileDrag(event) {
  const types = event?.dataTransfer?.types;
  if (!types) return false;
  if (Array.isArray(types)) return types.includes('Files');
  if (typeof types.contains === 'function') return types.contains('Files');
  return false;
}

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
        valA = Number.parseFloat(a.duration) || 0;
        valB = Number.parseFloat(b.duration) || 0;
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

function doesProfileLabelMatchShot(profile, shot, fallbackProfileName = '') {
  if (!profile || !shot) return false;

  const expectedProfileName = cleanName(shot.profile || '').toLowerCase();
  if (!expectedProfileName) return doesProfileMatchShot(profile, shot, fallbackProfileName);

  const profileLabel = cleanName(
    getProfileDisplayLabel(profile, fallbackProfileName),
  ).toLowerCase();
  return profileLabel === expectedProfileName;
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
  return Boolean(shot && profile && !doesProfileLabelMatchShot(profile, shot, fallbackProfileName));
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
    doesProfileLabelMatchShot(item, { profile: normalizedCurrentShotProfileName });

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

function useLibraryPanelLayoutState({ sentinelRef, barSlotRef, barRef }) {
  const [isStuck, setIsStuck] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    Boolean(globalThis.window?.matchMedia('(max-width: 1023px)').matches),
  );
  const [barRect, setBarRect] = useState({ width: 0, left: 0, height: 64 });

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
    if (globalThis.window === undefined) return undefined;

    const mediaQuery = globalThis.window.matchMedia('(max-width: 1023px)');
    const handleChange = event => setIsMobileViewport(event.matches);

    setIsMobileViewport(mediaQuery.matches);

    mediaQuery.addEventListener?.('change', handleChange);
    return () => mediaQuery.removeEventListener?.('change', handleChange);
  }, []);

  const updateRect = useCallback(() => {
    const anchor = barSlotRef.current || sentinelRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const nextRect = {
      width: rect.width,
      left: rect.left,
      height: barRef.current?.offsetHeight || 64,
    };

    setBarRect(previousRect =>
      Math.round(previousRect.width) === Math.round(nextRect.width) &&
      Math.round(previousRect.left) === Math.round(nextRect.left) &&
      Math.round(previousRect.height) === Math.round(nextRect.height)
        ? previousRect
        : nextRect,
    );
  }, [barRef, barSlotRef, sentinelRef]);

  useEffect(() => {
    updateRect();
    globalThis.window?.addEventListener('resize', updateRect);
    return () => globalThis.window?.removeEventListener('resize', updateRect);
  }, [updateRect]);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const resizeObserver = new ResizeObserver(() => updateRect());
    if (barRef.current) resizeObserver.observe(barRef.current);
    if (barSlotRef.current) resizeObserver.observe(barSlotRef.current);
    return () => resizeObserver.disconnect();
  }, [barRef, barSlotRef, updateRect]);

  return {
    isStuck,
    isMobileViewport,
    barRect,
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

function createImportOutcome() {
  return {
    appliedImportCount: 0,
    mismatchedImportCount: 0,
    blockedSecondaryProfileImport: false,
  };
}

function mergeImportOutcome(target, source) {
  target.appliedImportCount += source.appliedImportCount;
  target.mismatchedImportCount += source.mismatchedImportCount;
  target.blockedSecondaryProfileImport =
    target.blockedSecondaryProfileImport || source.blockedSecondaryProfileImport;
}

async function buildImportedShot({ data, file, importMode }) {
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

  return notesWithId ? { ...shot, notes: notesWithId } : shot;
}

async function importShotFile({
  data,
  file,
  targetType,
  slot,
  importMode,
  currentShot,
  compareMode,
  onCompareShotToggle,
  onShotSelect,
}) {
  const outcome = createImportOutcome();
  if (targetType === 'profile') {
    outcome.mismatchedImportCount += 1;
    return outcome;
  }

  const importedShot = await buildImportedShot({ data, file, importMode });
  if (slot === 'secondary' && currentShot) {
    await onCompareShotToggle?.(importedShot, true);
  } else {
    onShotSelect?.({
      item: importedShot,
      name: file.name,
      preserveCompare: compareMode,
    });
  }
  outcome.appliedImportCount += 1;
  return outcome;
}

async function importProfileFile({
  data,
  file,
  targetType,
  slot,
  importMode,
  currentShot,
  secondaryShot,
  onCompareProfileLoad,
  onProfileLoad,
}) {
  const outcome = createImportOutcome();
  if (targetType === 'shot') {
    outcome.mismatchedImportCount += 1;
    return outcome;
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
    outcome.appliedImportCount += 1;
    return outcome;
  }

  if (secondaryShot) {
    onCompareProfileLoad?.(profileData, profileName, profile.source);
    outcome.appliedImportCount += 1;
  } else if (currentShot) {
    outcome.blockedSecondaryProfileImport = true;
  } else {
    onProfileLoad(profileData, profileName, profile.source);
    outcome.appliedImportCount += 1;
  }

  return outcome;
}

async function importAnalyzerFile({ file, data, ...options }) {
  if (data.samples) return importShotFile({ file, data, ...options });
  if (data.phases) return importProfileFile({ file, data, ...options });
  return createImportOutcome();
}

function showImportOutcomeAlerts({ outcome, targetType }) {
  if (outcome.appliedImportCount > 0) return;

  if (outcome.blockedSecondaryProfileImport) {
    alert('Load a secondary shot before importing a secondary profile.');
    return;
  }

  if (outcome.mismatchedImportCount > 0) {
    alert(
      targetType === 'shot'
        ? 'Only shot files can be imported in the shot field.'
        : 'Only profile files can be imported in the profile field.',
    );
  }
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
        const outcome = createImportOutcome();

        try {
          for (const file of Array.from(files)) {
            const text = await file.text();
            const data = JSON.parse(text);
            const fileOutcome = await importAnalyzerFile({
              data,
              file,
              targetType,
              slot,
              importMode,
              currentShot,
              secondaryShot,
              compareMode,
              onCompareShotToggle,
              onShotSelect,
              onCompareProfileLoad,
              onProfileLoad,
            });
            mergeImportOutcome(outcome, fileOutcome);
          }

          showImportOutcomeAlerts({ outcome, targetType });
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

function AnalyzerPanelSlot({ statusBarProps, actionBarProps, showActionBar = true }) {
  const dragDepthRef = useRef(0);
  const dragResetTimerRef = useRef(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isWindowFileDragActive, setIsWindowFileDragActive] = useState(false);
  const isImporting = Boolean(actionBarProps?.isImporting);
  const onImport = actionBarProps?.onImport;
  const isDropzoneActive = !isImporting && (isDragActive || isWindowFileDragActive);

  const clearDragResetTimer = useCallback(() => {
    if (dragResetTimerRef.current) {
      globalThis.window?.clearTimeout(dragResetTimerRef.current);
      dragResetTimerRef.current = null;
    }
  }, []);

  const clearDragState = useCallback(() => {
    clearDragResetTimer();
    dragDepthRef.current = 0;
    setIsDragActive(false);
    setIsWindowFileDragActive(false);
  }, [clearDragResetTimer]);

  const armDragResetTimer = useCallback(() => {
    clearDragResetTimer();
    dragResetTimerRef.current = globalThis.window?.setTimeout(() => {
      clearDragState();
    }, 350);
  }, [clearDragResetTimer, clearDragState]);

  useEffect(() => {
    if (isImporting) {
      clearDragState();
      return undefined;
    }
    if (globalThis.window === undefined) return undefined;

    const handleWindowDragEnter = event => {
      if (!hasFileDrag(event)) return;
      setIsWindowFileDragActive(true);
      armDragResetTimer();
    };

    const handleWindowDragOver = event => {
      if (!hasFileDrag(event)) return;
      event.preventDefault();
      setIsWindowFileDragActive(true);
      event.dataTransfer.dropEffect = 'copy';
      armDragResetTimer();
    };

    const handleWindowDragLeave = event => {
      const isOutsideWindow =
        event.clientX <= 0 ||
        event.clientY <= 0 ||
        event.clientX >= globalThis.window.innerWidth ||
        event.clientY >= globalThis.window.innerHeight;
      if (isOutsideWindow) clearDragState();
    };

    const handleWindowDrop = event => {
      if (!hasFileDrag(event)) return;
      event.preventDefault();
      clearDragState();
    };

    globalThis.window.addEventListener('dragenter', handleWindowDragEnter);
    globalThis.window.addEventListener('dragover', handleWindowDragOver);
    globalThis.window.addEventListener('dragleave', handleWindowDragLeave);
    globalThis.window.addEventListener('drop', handleWindowDrop);
    globalThis.window.addEventListener('dragend', clearDragState);

    return () => {
      globalThis.window.removeEventListener('dragenter', handleWindowDragEnter);
      globalThis.window.removeEventListener('dragover', handleWindowDragOver);
      globalThis.window.removeEventListener('dragleave', handleWindowDragLeave);
      globalThis.window.removeEventListener('drop', handleWindowDrop);
      globalThis.window.removeEventListener('dragend', clearDragState);
      clearDragResetTimer();
    };
  }, [armDragResetTimer, clearDragResetTimer, clearDragState, isImporting]);

  const handleDragEnter = event => {
    if (isImporting || !hasFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current += 1;
    setIsDragActive(true);
    armDragResetTimer();
  };

  const handleDragOver = event => {
    if (isImporting || !hasFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    if (!isDragActive) setIsDragActive(true);
    armDragResetTimer();
  };

  const handleDragLeave = event => {
    if (isImporting || !isDragActive) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragActive(false);
  };

  const handleDrop = event => {
    if (isImporting || !hasFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    clearDragState();
    const files = Array.from(event.dataTransfer.files || []);
    if (files.length > 0) onImport?.(files);
  };

  return (
    <section
      className={`relative transition-all ${
        isDropzoneActive ? 'bg-primary/8 ring-primary/30 rounded-lg shadow-lg ring-2' : ''
      }`}
      aria-label='Shot and profile import dropzone'
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDropzoneActive ? (
        <div className='border-primary/55 bg-base-100/90 text-primary pointer-events-none absolute inset-0 z-[30] flex items-center justify-center rounded-lg border-2 border-dashed shadow-inner'>
          <div className='border-primary/25 bg-base-100/90 flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium shadow-sm'>
            <FontAwesomeIcon icon={faFileImport} className='text-sm' />
            <span>Drop shot or profile JSON here</span>
          </div>
        </div>
      ) : null}
      <StatusBar {...statusBarProps} />
      {showActionBar ? <AnalyzerActionBar {...actionBarProps} /> : null}
    </section>
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

    globalThis.document?.addEventListener('keydown', handleKeyDown);
    return () => globalThis.document?.removeEventListener('keydown', handleKeyDown);
  }, [
    collapsed,
    librarySelectionTarget,
    openLibraryForTarget,
    setCollapsed,
    handleStatusBarCompareToggle,
  ]);
}

function getLibraryPanelLayoutStyles({ collapsed, isMobileViewport, isStuck, barRect }) {
  const shouldBeFixed = !collapsed || (!isMobileViewport && isStuck);
  const barSlotHeight = barRect.height + (collapsed ? STATUS_BAR_CARD_GAP : 0);
  const barSlotStyle = { height: `${barSlotHeight}px` };
  const barStyle = shouldBeFixed
    ? {
        position: 'fixed',
        top: 0,
        left: `${barRect.left}px`,
        width: `${barRect.width}px`,
        zIndex: 50,
      }
    : {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
      };
  const dropdownTop = barRect.height;

  return {
    barStyle,
    barSlotHeight,
    barSlotStyle,
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
    typeof Element !== 'undefined' && target instanceof Element
      ? target
      : globalThis.document?.activeElement;
  if (!activeElement) return false;
  const tag = activeElement.tagName?.toLowerCase();
  if (activeElement.isContentEditable) return true;
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return !!activeElement.closest(
    'input, textarea, select, [contenteditable="true"], [role="textbox"]',
  );
}

function getNextLibrarySortState(currentSort, key, order) {
  return {
    key,
    order: order || (currentSort.key === key && currentSort.order === 'desc' ? 'asc' : 'desc'),
  };
}

function getLibrarySectionVisibilityClass(activeSection, section) {
  return activeSection === section ? 'block lg:block' : 'hidden lg:block';
}

function getShotCompareBadgeNumber({
  compareMode,
  item,
  primaryDisplayShot,
  compareSecondaryShotKey,
}) {
  if (!compareMode) return null;
  const itemKey = getShotIdentityKey(item);
  if (!itemKey) return null;
  if (primaryDisplayShot && itemKey === getShotIdentityKey(primaryDisplayShot)) return 1;
  if (compareSecondaryShotKey && itemKey === compareSecondaryShotKey) return 2;
  return null;
}

function getProfileCompareBadgeNumber({
  compareMode,
  item,
  primaryDisplayProfile,
  primaryDisplayProfileName,
  secondaryDisplayProfile,
  secondaryDisplayProfileName,
}) {
  if (!compareMode) return null;
  if (
    primaryDisplayProfile &&
    doesProfileMatchProfile(item, primaryDisplayProfile, primaryDisplayProfileName)
  ) {
    return 1;
  }
  if (
    secondaryDisplayProfile &&
    doesProfileMatchProfile(item, secondaryDisplayProfile, secondaryDisplayProfileName)
  ) {
    return 2;
  }
  return null;
}

function getLibraryProfileDeleteKey(item) {
  return item.source === 'gaggimate' ? item.profileId || item.id : item.label || item.name;
}

function createLibraryProfileStatsContext({
  compareMode,
  currentShot,
  profileItem,
  secondaryShot,
  shotsSourceFilter,
}) {
  const profileSource = profileItem.source || profileItem.src || 'both';
  const statsInitialContext = {
    profileName: getProfileDisplayLabel(profileItem, ''),
    shotSource:
      currentShot?.source ||
      secondaryShot?.source ||
      getLibraryRequestSource(shotsSourceFilter) ||
      'both',
    profileSource,
    source: profileSource,
  };

  if (compareMode) {
    statsInitialContext.preferredDetailSection = 'compare';
  }

  return statsInitialContext;
}

function getNormalizedCurrentProfileName(profile, profileMismatch, profileName) {
  return profile && !profileMismatch ? cleanName(profileName).toLowerCase() : '';
}

function getRealProfilePinKey(profileValue) {
  const key = getProfilePinKey(profileValue);
  return key && key !== 'no profile loaded' ? key : '';
}

function getActiveShotPinBucketKey({
  primaryDisplayProfile,
  primaryProfileMismatch,
  primaryDisplayProfileName,
}) {
  return primaryDisplayProfile && !primaryProfileMismatch
    ? getRealProfilePinKey(primaryDisplayProfileName)
    : '';
}

function getPinnedShotBucketKeyForItem(item, pinnedShotsByProfile) {
  const shotKey = getShotIdentityKey(item);
  if (!shotKey) return '';

  return (
    Object.entries(pinnedShotsByProfile).find(([, shotKeys]) => shotKeys.includes(shotKey))?.[0] ||
    ''
  );
}

function getProfilePinDisabledReasonForItem(item, pinnedProfiles) {
  if (isProfilePinned(item, pinnedProfiles)) return '';
  return pinnedProfiles.length >= MAX_PINNED_PROFILES
    ? `Maximum ${MAX_PINNED_PROFILES} pinned profiles`
    : '';
}

function getShotPinDisabledReasonForItem({
  item,
  getEffectiveShotPinBucketKey,
  pinnedShotsByProfile,
}) {
  const bucketKey = getEffectiveShotPinBucketKey(item);
  if (isShotPinned(item, bucketKey, pinnedShotsByProfile)) return '';

  const pinnedCount = (pinnedShotsByProfile[bucketKey] || []).length;
  if (pinnedCount < MAX_PINNED_SHOTS_PER_PROFILE) return '';

  return bucketKey === PINNED_NO_PROFILE_BUCKET
    ? `Maximum ${MAX_PINNED_SHOTS_PER_PROFILE} pinned shots without a profile`
    : `Maximum ${MAX_PINNED_SHOTS_PER_PROFILE} pinned shots per profile`;
}

function getLibraryTargetMobileSection(target) {
  return target === 'primaryProfile' || target === 'secondaryProfile' ? 'profiles' : 'shots';
}

function getSecondaryImportSlot(currentShot) {
  return currentShot ? 'secondary' : 'primary';
}

function getSecondaryShotPanelTarget(primaryDisplayShot) {
  return primaryDisplayShot ? 'secondaryShot' : 'primaryShot';
}

function getShotRowActionIntent({
  collapsed,
  compareMode,
  currentShot,
  item,
  librarySelectionTarget,
  primaryDisplayShot,
  secondaryShot,
}) {
  const primaryShotKey = primaryDisplayShot ? getShotIdentityKey(primaryDisplayShot) : '';
  const committedSecondaryShotKey = secondaryShot ? getShotIdentityKey(secondaryShot) : '';
  const itemShotKey = item ? getShotIdentityKey(item) : '';

  if (librarySelectionTarget === 'secondaryShot') {
    return !primaryDisplayShot || !itemShotKey || itemShotKey === primaryShotKey
      ? { type: 'ignore' }
      : { type: 'selectSecondary' };
  }

  if (compareMode && committedSecondaryShotKey && itemShotKey === committedSecondaryShotKey) {
    return { type: 'swap' };
  }

  const keepLibraryOpen = compareMode && !currentShot;
  return {
    type: 'selectPrimary',
    closeLibrary: !keepLibraryOpen,
    requestSelectionScroll: !collapsed && !keepLibraryOpen,
  };
}

function executeShotRowActionIntent({
  compareMode,
  handleSwapCompareSlots,
  intent,
  item,
  onCompareShotToggle,
  onShotSelect,
  setCollapsed,
}) {
  if (intent.type === 'ignore') return;
  if (intent.type === 'selectSecondary') {
    setCollapsed(true);
    onCompareShotToggle?.({ item, debounceMs: 0 }, true);
    return;
  }

  if (intent.type === 'swap') {
    setCollapsed(true);
    handleSwapCompareSlots();
    return;
  }

  if (intent.closeLibrary) {
    setCollapsed(true);
  }
  onShotSelect?.({
    item,
    preserveCompare: compareMode,
    requestSelectionScroll: intent.requestSelectionScroll,
    debounceMs: 0,
  });
}

function executeProfileRowAction({
  item,
  librarySelectionTarget,
  onCompareProfileLoad,
  onProfileLoad,
  secondaryShot,
  setCollapsed,
}) {
  if (librarySelectionTarget === 'secondaryProfile') {
    if (!secondaryShot) return;
    onCompareProfileLoad?.(item.data || item, getProfileDisplayLabel(item, ''), item.source);
    setCollapsed(true);
    return;
  }

  onProfileLoad(item.data || item, getProfileDisplayLabel(item, ''), item.source);
  setCollapsed(true);
}

function executeStatusBarCompareToggle({
  compareMode,
  onCompareModeToggle,
  openLibraryForTarget,
  primaryDisplayShot,
}) {
  onCompareModeToggle?.();
  if (!compareMode) {
    openLibraryForTarget(getSecondaryShotPanelTarget(primaryDisplayShot));
  }
}

function maybeOpenSecondaryProfilePanel({ openLibraryForTarget, secondaryDisplayShot }) {
  if (!secondaryDisplayShot) return;
  openLibraryForTarget('secondaryProfile');
}

function applyChangedProfilePins(result, setPinnedProfiles) {
  if (!result.changed) return;
  setPinnedProfiles(result.pinnedProfiles);
}

function applyChangedShotPins(result, setPinnedShotsByProfile) {
  if (!result.changed) return;
  setPinnedShotsByProfile(result.pinnedShotsByProfile);
}

function getShotPinToggleBucketKey({
  getEffectiveShotPinBucketKey,
  getPinnedShotBucketKey,
  item,
  shotsPinnedFirst,
}) {
  return (shotsPinnedFirst && getPinnedShotBucketKey(item)) || getEffectiveShotPinBucketKey(item);
}

async function deleteLibraryItem(item) {
  if (item.duration !== undefined || item.samples) {
    await libraryService.deleteShot(getShotStorageKey(item), item.source);
    return;
  }
  await libraryService.deleteProfile(getLibraryProfileDeleteKey(item), item.source);
}

function useDebouncedLibraryValue(value, delayMs = 250) {
  const [debouncedValue, setDebouncedValue] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs, value]);

  return debouncedValue;
}

function useLibraryServiceApi(apiService) {
  useEffect(() => {
    if (apiService) libraryService.setApiService(apiService);
  }, [apiService]);
}

function useLibrarySelectionTargetSync({
  compareMode,
  currentShot,
  librarySelectionTarget,
  secondaryShot,
  setLibrarySelectionTarget,
}) {
  useEffect(() => {
    if (!compareMode) {
      setLibrarySelectionTarget('primaryShot');
    }
  }, [compareMode, setLibrarySelectionTarget]);

  useEffect(() => {
    if (compareMode && currentShot && !secondaryShot && librarySelectionTarget === 'primaryShot') {
      setLibrarySelectionTarget('secondaryShot');
    }
  }, [compareMode, currentShot, secondaryShot, librarySelectionTarget, setLibrarySelectionTarget]);
}

function useCloseLibraryOnOutsideClick({ collapsed, panelRef, setCollapsed }) {
  useEffect(() => {
    if (collapsed) return;
    const handleOutsideClick = event => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setCollapsed(true);
      }
    };
    globalThis.document?.addEventListener('mousedown', handleOutsideClick);
    return () => globalThis.document?.removeEventListener('mousedown', handleOutsideClick);
  }, [collapsed, panelRef, setCollapsed]);
}

function useAnalyzerStickyOffset(panelRef, barSlotHeight) {
  useEffect(() => {
    const pageElement = panelRef.current?.closest?.('.shot-analyzer-page');
    if (!pageElement) return undefined;

    pageElement.style.setProperty('--analyzer-sticky-offset', `${barSlotHeight}px`);

    return () => {
      pageElement.style.removeProperty('--analyzer-sticky-offset');
    };
  }, [barSlotHeight, panelRef]);
}

function useLibraryRefresh({
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
}) {
  const refreshIdRef = useRef(0);

  const refreshLibraries = useCallback(async () => {
    const id = ++refreshIdRef.current;
    setLoading(true);
    try {
      const [shotsData, profilesData] = await Promise.all([
        libraryService.getAllShots(getLibraryRequestSource(shotsSourceFilter)),
        libraryService.getAllProfiles(getLibraryRequestSource(profilesSourceFilter)),
      ]);

      if (id !== refreshIdRef.current) return;
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
  ]);

  useEffect(() => {
    refreshLibraries();
  }, [refreshLibraries]);

  return refreshLibraries;
}

function LibraryPanelStatusSlots({
  collapsed,
  compareMode,
  primaryActionBarProps,
  primaryStatusBarProps,
  secondaryActionBarProps,
  secondaryStatusBarProps,
}) {
  return (
    <div
      className={`app-card-surface ${compareMode ? 'overflow-visible' : 'overflow-hidden'} rounded-xl transition-all duration-200 ${
        collapsed ? '' : 'library-panel-statusbar-surface--open rounded-b-none'
      }`}
    >
      {compareMode ? (
        <div>
          <AnalyzerPanelSlot
            statusBarProps={{
              ...primaryStatusBarProps,
              compareBadgeNumber: 1,
            }}
            actionBarProps={primaryActionBarProps}
          />
          <AnalyzerPanelSlot
            statusBarProps={secondaryStatusBarProps}
            actionBarProps={secondaryActionBarProps}
            showActionBar={false}
          />
        </div>
      ) : (
        <AnalyzerPanelSlot
          statusBarProps={primaryStatusBarProps}
          actionBarProps={primaryActionBarProps}
        />
      )}
    </div>
  );
}

function LibraryMobileSectionTabs({ activeSection, onSectionChange }) {
  const getTabClassName = section =>
    `flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
      activeSection === section
        ? 'bg-base-100 text-base-content shadow-sm'
        : getAnalyzerTextButtonClasses({
            className: 'justify-center',
          })
    }`;

  return (
    <div className='px-4 pt-4 lg:hidden'>
      <div className='bg-base-200/60 flex items-center gap-1 rounded-lg p-1'>
        <button
          type='button'
          className={getTabClassName('shots')}
          onClick={() => onSectionChange('shots')}
        >
          Shots
        </button>
        <button
          type='button'
          className={getTabClassName('profiles')}
          onClick={() => onSectionChange('profiles')}
        >
          Profiles
        </button>
      </div>
    </div>
  );
}

function LibraryDropdown({
  children,
  dropdownStyle,
  mobileActiveSection,
  onClose,
  onMobileSectionChange,
}) {
  return (
    <>
      <button
        type='button'
        className='fixed inset-0 cursor-pointer border-0 bg-black/20 p-0'
        style={{ zIndex: 40 }}
        onClick={onClose}
        aria-label='Close library'
      />
      <div style={dropdownStyle}>
        <div className='library-panel-dropdown-surface app-card-surface animate-fade-in-down origin-top overflow-hidden rounded-b-xl'>
          <LibraryMobileSectionTabs
            activeSection={mobileActiveSection}
            onSectionChange={onMobileSectionChange}
          />
          <div className='max-h-[75vh] overflow-y-auto overscroll-contain lg:max-h-none lg:overflow-hidden'>
            <div className='grid grid-cols-1 gap-x-4 gap-y-4 p-4 lg:grid-cols-2 lg:gap-x-1.5'>
              {children}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function LibraryShotsPanelSection({
  compareMode,
  comparePendingKeys,
  compareSecondaryShotKey,
  compareSelectedCount,
  compareSelectionKeys,
  desktopSectionHeight,
  getEffectiveShotPinBucketKey,
  getPinnedShotBucketKey,
  getShotPinDisabledReason,
  handleDelete,
  handleExport,
  handleShotPinToggle,
  handleShotRowAction,
  loading,
  mobileActiveSection,
  normalizedCurrentProfileName,
  onCompareShotToggle,
  pinnedShotsByProfile,
  primaryDisplayProfile,
  primaryDisplayShot,
  refreshLibraries,
  setShotsPinnedFirst,
  setShotsSearch,
  setShotsSort,
  setShotsSourceFilter,
  shots,
  shotsPinnedFirst,
  shotsSearch,
  shotsSort,
  shotsSourceFilter,
}) {
  const handleExportAllShots = () => {
    if (shots.length === 0) return;
    if (
      confirm(
        `Do you really want to export all ${shots.length} filtered shots? (Shots are downloaded individually, one after the other.)`,
      )
    ) {
      for (let i = 0; i < shots.length; i++)
        setTimeout(() => handleExport(shots[i], true), i * 300);
    }
  };

  const handleDeleteAllShots = async () => {
    if (
      confirm(
        `WARNING: Do you really want to IRREVOCABLY delete all ${shots.length} filtered shots?`,
      )
    ) {
      for (const shot of shots) {
        await libraryService.deleteShot(getShotStorageKey(shot), shot.source);
      }
      refreshLibraries();
    }
  };

  return (
    <div className={getLibrarySectionVisibilityClass(mobileActiveSection, 'shots')}>
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
        onSortChange={(key, order) => setShotsSort(getNextLibrarySortState(shotsSort, key, order))}
        onSourceFilterChange={setShotsSourceFilter}
        onLoad={handleShotRowAction}
        onExport={item => handleExport(item, true)}
        onDelete={handleDelete}
        compareSelectedCount={compareSelectedCount}
        compareSelectionKeys={compareSelectionKeys}
        comparePendingKeys={comparePendingKeys}
        compareReferenceKey={primaryDisplayShot ? getShotIdentityKey(primaryDisplayShot) : ''}
        getCompareBadgeNumber={item =>
          getShotCompareBadgeNumber({
            compareMode,
            item,
            primaryDisplayShot,
            compareSecondaryShotKey,
          })
        }
        onCompareToggle={onCompareShotToggle}
        isLoading={loading}
        onExportAll={handleExportAllShots}
        onDeleteAll={handleDeleteAllShots}
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
            : isShotPinned(item, getEffectiveShotPinBucketKey(item), pinnedShotsByProfile)
        }
        getPinDisabledReason={getShotPinDisabledReason}
        pinnedFirstEnabled={shotsPinnedFirst}
        onPinnedFirstToggle={() => setShotsPinnedFirst(value => !value)}
        onPinToggle={handleShotPinToggle}
      />
    </div>
  );
}

function LibraryProfilesPanelSection({
  compareMode,
  desktopSectionHeight,
  getProfilePinDisabledReason,
  handleDelete,
  handleExport,
  handleLibraryProfileStatsOpen,
  handleProfilePinToggle,
  handleProfileRowAction,
  loading,
  mobileActiveSection,
  normalizedCompareSecondaryProfileName,
  pinnedProfiles,
  primaryDisplayProfile,
  primaryDisplayProfileName,
  primaryDisplayShot,
  profiles,
  profilesPinnedFirst,
  profilesSearch,
  profilesSort,
  profilesSourceFilter,
  refreshLibraries,
  secondaryDisplayProfile,
  secondaryDisplayProfileName,
  secondaryDisplayShot,
  setProfilesPinnedFirst,
  setProfilesSearch,
  setProfilesSort,
  setProfilesSourceFilter,
}) {
  const handleExportAllProfiles = () => {
    if (profiles.length === 0) return;
    if (
      confirm(
        `Do you really want to export all ${profiles.length} filtered profiles? (Profiles are downloaded individually, one after the other.)`,
      )
    ) {
      for (let i = 0; i < profiles.length; i++)
        setTimeout(() => handleExport(profiles[i], false), i * 300);
    }
  };

  const handleDeleteAllProfiles = async () => {
    if (
      confirm(
        `WARNING: Do you really want to IRREVOCABLY delete all ${profiles.length} filtered profiles?`,
      )
    ) {
      for (const profile of profiles) {
        await libraryService.deleteProfile(getLibraryProfileDeleteKey(profile), profile.source);
      }
      refreshLibraries();
    }
  };

  return (
    <div className={getLibrarySectionVisibilityClass(mobileActiveSection, 'profiles')}>
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
        onSortChange={(key, order) =>
          setProfilesSort(getNextLibrarySortState(profilesSort, key, order))
        }
        onSourceFilterChange={setProfilesSourceFilter}
        onLoad={handleProfileRowAction}
        onShowStats={handleLibraryProfileStatsOpen}
        onExport={item => handleExport(item, false)}
        onDelete={handleDelete}
        isLoading={loading}
        onExportAll={handleExportAllProfiles}
        onDeleteAll={handleDeleteAllProfiles}
        getMatchStatus={item =>
          primaryDisplayShot && doesProfileLabelMatchShot(item, primaryDisplayShot)
        }
        getCompareStatus={item =>
          Boolean(
            secondaryDisplayProfileName &&
              normalizedCompareSecondaryProfileName &&
              normalizedCompareSecondaryProfileName !== 'no profile loaded' &&
              doesProfileLabelMatchShot(item, secondaryDisplayShot),
          )
        }
        getCompareBadgeNumber={item =>
          getProfileCompareBadgeNumber({
            compareMode,
            item,
            primaryDisplayProfile,
            primaryDisplayProfileName,
            secondaryDisplayProfile,
            secondaryDisplayProfileName,
          })
        }
        getActiveStatus={item =>
          primaryDisplayProfile &&
          doesProfileMatchProfile(item, primaryDisplayProfile, primaryDisplayProfileName)
        }
        getPinStatus={item => isProfilePinned(item, pinnedProfiles)}
        getPinDisabledReason={getProfilePinDisabledReason}
        pinnedFirstEnabled={profilesPinnedFirst}
        onPinnedFirstToggle={() => setProfilesPinnedFirst(value => !value)}
        onPinToggle={handleProfilePinToggle}
      />
    </div>
  );
}

function getLibraryExportHandler(item, isShot, handleExport) {
  return item ? () => handleExport(item, isShot) : null;
}

function createPrimaryStatsHandler({
  onShowStats,
  primaryDisplayProfile,
  primaryDisplayProfileName,
  primaryDisplayShot,
}) {
  return () =>
    onShowStats?.({
      shotSource: primaryDisplayShot?.source || 'both',
      profileSource: primaryDisplayProfile?.source || 'both',
      profileName: primaryDisplayProfileName,
    });
}

function createSecondaryStatsHandler({
  onShowStats,
  primaryDisplayShot,
  secondaryDisplayProfile,
  secondaryDisplayProfileName,
  secondaryDisplayShot,
}) {
  return () =>
    onShowStats?.({
      shotSource: secondaryDisplayShot?.source || primaryDisplayShot?.source || 'both',
      profileSource: secondaryDisplayProfile?.source || 'both',
      profileName: secondaryDisplayProfileName,
    });
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
