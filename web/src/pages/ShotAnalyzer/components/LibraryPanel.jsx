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
  getPinnedProfiles,
  getPinnedShotsByProfile,
  getProfilePinKey,
  getShotIdentityKey,
  getShotPinBucketKey,
  isProfilePinned,
  isShotPinned,
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

export function LibraryPanel({
  currentShot,
  currentProfile,
  currentShotName = 'No Shot Loaded',
  currentProfileName = 'No Profile Loaded',
  secondaryShot = null,
  secondaryProfile = null,
  secondaryShotName = 'No Shot Loaded',
  secondaryProfileName = 'No Profile Loaded',
  onShotLoadStart,
  onShotLoad,
  onProfileLoad,
  onShotUnload,
  onProfileUnload,
  onShowStats,
  statsHref = '/statistics',
  secondaryStatsHref = '/statistics',
  importMode = 'temp',
  onImportModeChange,
  onShotLoadedFromLibrary,
  compareMode = false,
  compareHasSecondaryShot = false,
  compareSelectedCount = 0,
  compareSelectionKeys = new Set(),
  comparePendingKeys = [],
  compareSecondaryShotKey = '',
  compareSecondaryProfileName = '',
  onCompareModeToggle,
  onCompareShotToggle,
  onCompareProfileLoad,
  onCompareProfileUnload,
  onCompareSwap,
  onRetryProfileSearch,
  onRetryCompareProfileSearch,
  isMatchingProfile = false, // Used for highlighting
  isMatchingShot = false, // Used for highlighting
  isSearchingProfile = false, // Spinner state for profile search
  compareIsSearchingProfile = false,
}) {
  const apiService = useContext(ApiServiceContext);
  const panelRef = useRef(null);
  const sentinelRef = useRef(null);
  const barRef = useRef(null);
  const refreshIdRef = useRef(0);
  const shotLoadIdRef = useRef(0);

  // UI State
  const [isStuck, setIsStuck] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 1023px)').matches : false,
  );
  const [barRect, setBarRect] = useState({ width: 0, left: 0, height: 0 });
  const [collapsed, setCollapsed] = useState(true);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false); // Specific state for import spinner
  const [librarySelectionTarget, setLibrarySelectionTarget] = useState('primaryShot');
  const [primaryNotesExpanded, setPrimaryNotesExpanded] = useState(false);
  const [primaryNotesIsEditing, setPrimaryNotesIsEditing] = useState(false);
  const [primaryNotesExpandedHeight, setPrimaryNotesExpandedHeight] = useState(0);
  const [secondaryNotesExpanded, setSecondaryNotesExpanded] = useState(false);
  const [secondaryNotesIsEditing, setSecondaryNotesIsEditing] = useState(false);
  const [secondaryNotesExpandedHeight, setSecondaryNotesExpandedHeight] = useState(0);

  // Data State
  const [shots, setShots] = useState([]);
  const [profiles, setProfiles] = useState([]);

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
        const statsInitialContext = {
          profileName: profileItem.label || profileItem.name || '',
          source: 'both',
        };
        if (compareMode) {
          statsInitialContext.preferredDetailSection = 'compare';
        }
        sessionStorage.setItem('statsInitialContext', JSON.stringify(statsInitialContext));
      } catch {
        // Ignore session storage issues and keep navigation working.
      }
    },
    [compareMode],
  );

  // Debounced search values to avoid re-fetching on every keystroke
  const [debouncedShotsSearch, setDebouncedShotsSearch] = useState('');
  const [debouncedProfilesSearch, setDebouncedProfilesSearch] = useState('');
  const normalizedCurrentProfileName = cleanName(currentProfileName).toLowerCase();
  const normalizedCurrentShotProfileName = cleanName(currentShot?.profile || '').toLowerCase();
  const normalizedCompareSecondaryProfileName = cleanName(
    compareSecondaryProfileName,
  ).toLowerCase();
  const resolveRealProfilePinKey = useCallback(profileValue => {
    const key = getProfilePinKey(profileValue);
    return key && key !== 'no profile loaded' ? key : '';
  }, []);
  const activeShotPinBucketKey = (() => {
    const explicitProfileKey = resolveRealProfilePinKey(currentProfileName);
    if (explicitProfileKey) return explicitProfileKey;

    // When only a shot is active, derive the implicit profile bucket from the
    // shot metadata so pinned shots can still be promoted for that context.
    if (currentShot || currentProfile) {
      const shotProfileKey = resolveRealProfilePinKey(
        currentShot?.profile || currentShot?.profileName || '',
      );
      return shotProfileKey || PINNED_NO_PROFILE_BUCKET;
    }

    return '';
  })();

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

  // IntersectionObserver to toggle sticky 'fixed' positioning
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => setIsStuck(!entry.isIntersecting), {
      threshold: 0,
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

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

  // Sync dimensions for fixed positioning
  const updateRect = useCallback(() => {
    if (!sentinelRef.current) return;
    const rect = sentinelRef.current.getBoundingClientRect();
    setBarRect({
      width: rect.width,
      left: rect.left,
      height: barRef.current?.offsetHeight || 64,
    });
  }, []);

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
  }, [updateRect]);

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

  useEffect(() => {
    if (!compareMode) {
      setLibrarySelectionTarget('primaryShot');
    }
  }, [compareMode]);

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
  const refreshLibraries = async () => {
    const id = ++refreshIdRef.current;
    setLoading(true);
    try {
      const [shotsData, profilesData] = await Promise.all([
        libraryService.getAllShots(shotsSourceFilter === 'all' ? 'both' : shotsSourceFilter),
        libraryService.getAllProfiles(
          profilesSourceFilter === 'all' ? 'both' : profilesSourceFilter,
        ),
      ]);

      if (id !== refreshIdRef.current) return; // stale request, discard

      const getShotSearchPriority = (item, query) => {
        const normalizedId = String(item?.id || '').toLowerCase();
        const normalizedName = (item?.name || item?.label || item?.title || '').toLowerCase();
        return normalizedName.includes(query) || normalizedId.includes(query) ? 0 : 1;
      };

      // Apply the user-selected base sort first. Match promotion and pin
      // promotion happen afterwards so they remain stable overlays on top of the
      // explicit sort choice instead of replacing it.
      const applySort = (items, cfg) => {
        return [...items].sort((a, b) => {
          let valA, valB;
          switch (cfg.key) {
            case 'shotDate':
              valA = a.timestamp || 0;
              valB = b.timestamp || 0;
              break;
            case 'name':
              valA = (a.name || a.label || a.profile || '').toLowerCase();
              valB = (b.name || b.label || b.profile || '').toLowerCase();
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
      };

      const promoteItems = (items, predicate) => {
        const promoted = [];
        const remaining = [];
        items.forEach(item => {
          if (predicate(item)) promoted.push(item);
          else remaining.push(item);
        });
        return [...promoted, ...remaining];
      };

      // Shot search intentionally stays broad: operators usually remember a shot
      // by id, exported file name, or associated profile rather than one field.
      let fShots = shotsData;
      if (debouncedShotsSearch) {
        const sSearch = debouncedShotsSearch.toLowerCase();

        fShots = shotsData.filter(s => {
          const nameMatch = (s.name || s.label || s.title || '').toLowerCase().includes(sSearch);
          const profileMatch = (s.profile || s.profileName || '').toLowerCase().includes(sSearch);
          const idMatch = String(s.id || '')
            .toLowerCase()
            .includes(sSearch);
          const fileMatch = (s.fileName || s.exportName || '').toLowerCase().includes(sSearch);

          return nameMatch || profileMatch || idMatch || fileMatch;
        });

        // Name/id hits are promoted ahead of indirect profile-name hits so a
        // search like "shot-12" or "#123" feels deterministic.
        fShots.sort((a, b) => {
          return getShotSearchPriority(a, sSearch) - getShotSearchPriority(b, sSearch);
        });
      }

      // Profile search filter
      if (debouncedProfilesSearch) {
        const pSearch = debouncedProfilesSearch.toLowerCase();
        fShots = fShots.filter(s =>
          (s.profile || s.profileName || '').toLowerCase().includes(pSearch),
        );
      }

      const fProfiles = profilesData.filter(
        p =>
          !debouncedProfilesSearch ||
          (p.name || p.label || '').toLowerCase().includes(debouncedProfilesSearch.toLowerCase()),
      );

      const hasActiveProfileMatch =
        normalizedCurrentProfileName && normalizedCurrentProfileName !== 'no profile loaded';
      const hasActiveShotProfileMatch =
        normalizedCurrentShotProfileName &&
        normalizedCurrentShotProfileName !== 'no profile loaded';
      const promoteMatchedShots = item =>
        hasActiveProfileMatch &&
        cleanName(item.profile || '').toLowerCase() === normalizedCurrentProfileName;
      const promoteMatchedProfiles = item =>
        hasActiveShotProfileMatch &&
        cleanName(item.name || item.label || '').toLowerCase() === normalizedCurrentShotProfileName;

      // Promotion order matters: active profile matches win first, then pins can
      // optionally re-order within that already-sorted subset.
      let nextShots = promoteItems(applySort(fShots, shotsSort), promoteMatchedShots);
      if (shotsPinnedFirst) {
        nextShots = promoteItems(nextShots, item =>
          isShotPinned(item, getShotPinBucketKey(item), pinnedShotsByProfile),
        );
      } else if (activeShotPinBucketKey) {
        nextShots = promoteItems(nextShots, item =>
          isShotPinned(item, activeShotPinBucketKey, pinnedShotsByProfile),
        );
      }

      let nextProfiles = promoteItems(applySort(fProfiles, profilesSort), promoteMatchedProfiles);
      if (profilesPinnedFirst) {
        nextProfiles = promoteItems(nextProfiles, item => isProfilePinned(item, pinnedProfiles));
      }

      setShots(nextShots);
      setProfiles(nextProfiles);
    } catch (error) {
      if (id !== refreshIdRef.current) return;
      console.error('Library refresh failed:', error);
    } finally {
      if (id === refreshIdRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    refreshLibraries();
  }, [
    shotsSourceFilter,
    profilesSourceFilter,
    debouncedShotsSearch,
    shotsSort,
    debouncedProfilesSearch,
    profilesSort,
    pinnedProfiles,
    pinnedShotsByProfile,
    shotsPinnedFirst,
    profilesPinnedFirst,
    activeShotPinBucketKey,
    normalizedCurrentProfileName,
    normalizedCurrentShotProfileName,
  ]);

  // Re-run the promotion logic when the panel reopens so any pin changes made
  // elsewhere in the app are reflected immediately.
  const prevCollapsed = useRef(collapsed);
  useEffect(() => {
    if (prevCollapsed.current && !collapsed) {
      refreshLibraries();
    }
    prevCollapsed.current = collapsed;
  }, [collapsed]);

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
      const bucketKey = getShotPinBucketKey(item);
      if (isShotPinned(item, bucketKey, pinnedShotsByProfile)) return '';

      const pinnedCount = (pinnedShotsByProfile[bucketKey] || []).length;
      if (pinnedCount >= MAX_PINNED_SHOTS_PER_PROFILE) {
        return bucketKey === PINNED_NO_PROFILE_BUCKET
          ? `Maximum ${MAX_PINNED_SHOTS_PER_PROFILE} pinned shots without a profile`
          : `Maximum ${MAX_PINNED_SHOTS_PER_PROFILE} pinned shots per profile`;
      }

      return '';
    },
    [pinnedShotsByProfile],
  );

  const handleProfilePinToggle = useCallback(item => {
    const result = toggleProfilePin(item);
    if (!result.changed) return;
    setPinnedProfiles(result.pinnedProfiles);
  }, []);

  const handleShotPinToggle = useCallback(item => {
    const result = toggleShotPin(item, getShotPinBucketKey(item));
    if (!result.changed) return;
    setPinnedShotsByProfile(result.pinnedShotsByProfile);
  }, []);

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
          item.source === 'gaggimate' ? item.profileId || item.id : item.name || item.label;
        await libraryService.deleteProfile(deleteKey, item.source);
      }
      refreshLibraries();
    } catch (e) {
      alert(`Delete failed: ${e.message}`);
    }
  };

  const handleImport = async (files, { targetType = 'any', slot = 'primary' } = {}) => {
    setImporting(true);

    // Let the spinner paint before the import work begins so the action feels responsive.
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

            // Extract notes from imported JSON (if present)
            const importedNotes = data.notes;
            const shotData = { ...data };
            delete shotData.notes; // Don't store notes inside shot data

            const shot = {
              ...shotData,
              id: String(shotData.id ?? storageKey),
              name: file.name,
              storageKey,
              data: shotData,
              source,
            };
            if (source === 'browser') await indexedDBService.saveShot(shot);

            // Save imported notes via NotesService
            if (importedNotes && typeof importedNotes === 'object') {
              notesWithId = {
                ...notesService.getDefaults(storageKey),
                ...importedNotes,
                id: storageKey,
              };
              await notesService.saveNotes(storageKey, source, notesWithId);
            }

            // Keep loaded object aligned with storage metadata (name/storageKey),
            // so NotesBar can resolve notes immediately after import.
            const importedShot = notesWithId ? { ...shot, notes: notesWithId } : shot;
            if (slot === 'secondary' && currentShot) {
              await onCompareShotToggle?.(importedShot, true);
            } else {
              await onShotLoad(importedShot, file.name, {
                preserveCompare: compareMode,
              });
            }
            appliedImportCount += 1;
          } else if (data.phases) {
            if (targetType === 'shot') {
              mismatchedImportCount += 1;
              continue;
            }

            // Use profile label from JSON as canonical name (not the filename)
            const profileName = data.label || cleanName(file.name);
            const profile = {
              ...data,
              name: profileName,
              data,
              source: importMode === 'browser' ? 'browser' : 'temp',
            };
            if (importMode === 'browser') await indexedDBService.saveProfile(profile);

            if (slot === 'secondary') {
              if (secondaryShot) {
                onCompareProfileLoad?.(data, profileName, profile.source);
                appliedImportCount += 1;
              } else if (!currentShot) {
                onProfileLoad(data, profileName, profile.source);
                appliedImportCount += 1;
              } else {
                blockedSecondaryProfileImport = true;
              }
            } else {
              onProfileLoad(data, profileName, profile.source);
              appliedImportCount += 1;
            }
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
      } catch (e) {
        console.error('Import error:', e);
        alert('Import failed. Please check the file format.');
      } finally {
        setImporting(false); // STOP IMPORT SPINNER
        refreshLibraries();
      }
    }, 50);
  };

  const handleLoadShot = async (
    item,
    { closeLibrary = true, triggerSelectionScroll = true, preserveCompare = false } = {},
  ) => {
    const loadId = ++shotLoadIdRef.current;

    try {
      const wasLibraryOpen = !collapsed;
      onShotLoadStart();
      if (closeLibrary) {
        setCollapsed(true);
      }
      const loadKey =
        item.source === 'gaggimate' ? item.id : item.storageKey || item.name || item.id;
      const full = item.loaded ? item : await libraryService.loadShot(loadKey, item.source);
      if (loadId !== shotLoadIdRef.current) return;
      await onShotLoad(full, item.name || item.storageKey || item.id, { preserveCompare });
      if (loadId !== shotLoadIdRef.current) return;
      if (closeLibrary && triggerSelectionScroll && wasLibraryOpen) {
        onShotLoadedFromLibrary?.();
      }
    } catch (e) {
      if (loadId !== shotLoadIdRef.current) return;
      console.error('Failed to load shot:', e);
    }
  };

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

  const handleShotRowAction = async item => {
    const currentShotKey = currentShot ? getShotIdentityKey(currentShot) : '';
    const itemShotKey = item ? getShotIdentityKey(item) : '';

    if (compareMode && !currentShot && itemShotKey) {
      await handleLoadShot(item, {
        closeLibrary: false,
        triggerSelectionScroll: false,
        preserveCompare: true,
      });
      setLibrarySelectionTarget('secondaryShot');
      return;
    }

    if (librarySelectionTarget === 'secondaryShot') {
      if (!currentShot || !itemShotKey || itemShotKey === currentShotKey) return;
      setCollapsed(true);
      await onCompareShotToggle?.(item, true);
      return;
    }

    if (compareMode && compareSecondaryShotKey && itemShotKey === compareSecondaryShotKey) {
      setCollapsed(true);
      handleSwapCompareSlots();
      return;
    }

    await handleLoadShot(item, {
      preserveCompare: compareMode,
    });
  };

  const handleStatusBarCompareToggle = () => {
    if (!compareMode) {
      onCompareModeToggle?.();
      openLibraryForTarget(currentShot ? 'secondaryShot' : 'primaryShot');
      return;
    }

    onCompareModeToggle?.();
  };

  const handleProfileRowAction = item => {
    if (librarySelectionTarget === 'secondaryProfile') {
      if (!secondaryShot) return;
      onCompareProfileLoad?.(item.data || item, item.label || item.name, item.source);
      setCollapsed(true);
      return;
    }

    onProfileLoad(item.data || item, item.label || item.name, item.source);
    setCollapsed(true);
  };

  const handleNavigateShot = async item => {
    await handleLoadShot(item, {
      closeLibrary: false,
      triggerSelectionScroll: false,
      preserveCompare: compareMode && compareHasSecondaryShot,
    });
  };

  const handleNavigateCompareShot = async item => {
    if (!secondaryShot) return;
    await onCompareShotToggle?.(item, true);
  };

  const handleClearSecondaryShot = () => {
    if (!secondaryShot) return;
    setSecondaryNotesExpanded(false);
    setSecondaryNotesIsEditing(false);
    setSecondaryNotesExpandedHeight(0);
    onCompareShotToggle?.(secondaryShot, false);
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

  // Styling logic for fixed bar
  // Keep the panel anchored while it is open, but let the collapsed bar scroll normally on mobile.
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
  const dropdownStyle = {
    position: 'fixed',
    top: `${dropdownTop}px`,
    left: `${barRect.left}px`,
    width: `${barRect.width}px`,
    zIndex: 49,
  };
  const desktopSectionHeight = isMobileViewport
    ? undefined
    : `max(18rem, calc(100dvh - ${dropdownTop}px - 2rem))`;
  const primaryProfileMismatch =
    currentShot &&
    currentProfile &&
    cleanName(currentShot.profile || '').toLowerCase() !==
      cleanName(currentProfileName).toLowerCase();
  const secondaryProfileMismatch =
    secondaryShot &&
    secondaryProfile &&
    cleanName(secondaryShot.profile || '').toLowerCase() !==
      cleanName(secondaryProfileName).toLowerCase();

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
              <StatusBar
                currentShot={currentShot}
                currentProfile={currentProfile}
                currentShotName={currentShotName}
                currentProfileName={currentProfileName}
                onUnloadShot={onShotUnload}
                onUnloadProfile={onProfileUnload}
                onCompareModeToggle={handleStatusBarCompareToggle}
                onRetryProfileSearch={onRetryProfileSearch}
                onShotPanelToggle={() => openLibraryForTarget('primaryShot')}
                onProfilePanelToggle={() => openLibraryForTarget('primaryProfile')}
                onImportShot={files => handleImport(files, { targetType: 'shot', slot: 'primary' })}
                onImportProfile={files =>
                  handleImport(files, { targetType: 'profile', slot: 'primary' })
                }
                onShowStats={onShowStats}
                statsHref={statsHref}
                compareAvailable={shots.length > 0}
                compareMode={compareMode}
                isMismatch={primaryProfileMismatch}
                isImporting={importing}
                isSearchingProfile={isSearchingProfile}
                compact={true}
                compareBadgeNumber={1}
              />
              <NotesBar
                currentShot={currentShot}
                currentShotName={currentShotName}
                shotList={shots}
                onNavigate={handleNavigateShot}
                importMode={importMode}
                onImportModeChange={onImportModeChange}
                isExpanded={!collapsed}
                notesExpanded={primaryNotesExpanded}
                onToggleNotesExpanded={() => setPrimaryNotesExpanded(value => !value)}
                onEditingChange={setPrimaryNotesIsEditing}
                onExpandedHeightChange={setPrimaryNotesExpandedHeight}
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
              <StatusBar
                currentShot={secondaryShot}
                currentProfile={secondaryProfile}
                currentShotName={secondaryShotName}
                currentProfileName={secondaryProfileName}
                onUnloadShot={handleClearSecondaryShot}
                onUnloadProfile={onCompareProfileUnload}
                onRetryProfileSearch={onRetryCompareProfileSearch}
                onShotPanelToggle={() =>
                  openLibraryForTarget(currentShot ? 'secondaryShot' : 'primaryShot')
                }
                onProfilePanelToggle={() => {
                  if (!secondaryShot) return;
                  openLibraryForTarget('secondaryProfile');
                }}
                onImportShot={files =>
                  handleImport(files, {
                    targetType: 'shot',
                    slot: currentShot ? 'secondary' : 'primary',
                  })
                }
                onImportProfile={files =>
                  handleImport(files, {
                    targetType: 'profile',
                    slot: currentShot ? 'secondary' : 'primary',
                  })
                }
                onShowStats={onShowStats}
                statsHref={secondaryStatsHref}
                compareAvailable={false}
                compareMode={compareMode}
                isMismatch={secondaryProfileMismatch}
                isImporting={importing}
                isSearchingProfile={compareIsSearchingProfile}
                compact={true}
                showCompareButton={false}
                compareBadgeNumber={2}
                ghosted={true}
              />
              <NotesBar
                currentShot={secondaryShot}
                currentShotName={secondaryShotName}
                shotList={shots}
                onNavigate={handleNavigateCompareShot}
                importMode={importMode}
                onImportModeChange={onImportModeChange}
                isExpanded={!collapsed}
                notesExpanded={secondaryNotesExpanded}
                onToggleNotesExpanded={() => setSecondaryNotesExpanded(value => !value)}
                onEditingChange={setSecondaryNotesIsEditing}
                onExpandedHeightChange={setSecondaryNotesExpandedHeight}
                showImportModeToggle={false}
                enableKeyboardNavigation={false}
              />
            </div>
          ) : (
            <div>
              <StatusBar
                currentShot={currentShot}
                currentProfile={currentProfile}
                currentShotName={currentShotName}
                currentProfileName={currentProfileName}
                onUnloadShot={onShotUnload}
                onUnloadProfile={onProfileUnload}
                onCompareModeToggle={handleStatusBarCompareToggle}
                onRetryProfileSearch={onRetryProfileSearch}
                onShotPanelToggle={() => openLibraryForTarget('primaryShot')}
                onProfilePanelToggle={() => openLibraryForTarget('primaryProfile')}
                onImportShot={files => handleImport(files, { targetType: 'shot', slot: 'primary' })}
                onImportProfile={files =>
                  handleImport(files, { targetType: 'profile', slot: 'primary' })
                }
                onShowStats={onShowStats}
                statsHref={statsHref}
                compareAvailable={shots.length > 0}
                compareMode={compareMode}
                isMismatch={primaryProfileMismatch}
                isImporting={importing}
                isSearchingProfile={isSearchingProfile}
              />
              <NotesBar
                currentShot={currentShot}
                currentShotName={currentShotName}
                shotList={shots}
                onNavigate={handleNavigateShot}
                importMode={importMode}
                onImportModeChange={onImportModeChange}
                isExpanded={!collapsed}
                notesExpanded={primaryNotesExpanded}
                onToggleNotesExpanded={() => setPrimaryNotesExpanded(value => !value)}
                onEditingChange={setPrimaryNotesIsEditing}
                onExpandedHeightChange={setPrimaryNotesExpandedHeight}
              />
            </div>
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
                      compareReferenceKey={currentShot ? getShotIdentityKey(currentShot) : ''}
                      getCompareBadgeNumber={item => {
                        if (!compareMode) return null;
                        const itemKey = getShotIdentityKey(item);
                        if (!itemKey) return null;
                        if (currentShot && itemKey === getShotIdentityKey(currentShot)) return 1;
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
                        currentProfile &&
                        cleanName(item.profile || '').toLowerCase() === normalizedCurrentProfileName
                      }
                      getActiveStatus={item =>
                        currentShot &&
                        getShotIdentityKey(item) === getShotIdentityKey(currentShot) &&
                        item.source === currentShot.source
                      }
                      getPinStatus={item =>
                        isShotPinned(item, getShotPinBucketKey(item), pinnedShotsByProfile)
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
                              p.source === 'gaggimate' ? p.profileId || p.id : p.name || p.label;
                            await libraryService.deleteProfile(deleteKey, p.source);
                          }
                          refreshLibraries();
                        }
                      }}
                      getMatchStatus={item =>
                        currentShot &&
                        cleanName(item.name || item.label || '').toLowerCase() ===
                          normalizedCurrentShotProfileName
                      }
                      getCompareStatus={item =>
                        Boolean(
                          compareSecondaryProfileName &&
                            normalizedCompareSecondaryProfileName &&
                            normalizedCompareSecondaryProfileName !== 'no profile loaded' &&
                            cleanName(item.name || item.label || '').toLowerCase() ===
                              normalizedCompareSecondaryProfileName,
                        )
                      }
                      getCompareBadgeNumber={item => {
                        if (!compareMode) return null;
                        const itemProfileName = cleanName(
                          item.name || item.label || '',
                        ).toLowerCase();
                        if (!itemProfileName) return null;
                        if (currentProfile && itemProfileName === normalizedCurrentProfileName)
                          return 1;
                        if (
                          compareSecondaryProfileName &&
                          normalizedCompareSecondaryProfileName &&
                          normalizedCompareSecondaryProfileName !== 'no profile loaded' &&
                          itemProfileName === normalizedCompareSecondaryProfileName
                        ) {
                          return 2;
                        }
                        return null;
                      }}
                      getActiveStatus={item =>
                        currentProfile &&
                        cleanName(item.name || item.label || '').toLowerCase() ===
                          normalizedCurrentProfileName
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
