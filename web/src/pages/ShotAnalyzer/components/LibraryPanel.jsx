/**
 * LibraryPanel.jsx
 * * Main library panel component for Shot Analyzer.
 * * Features:
 * - English UI & GitHub-ready comments.
 * - JS-powered sticky StatusBar.
 * - Glass-effect dropdown overlay.
 * - Confirmed Bulk Export & Delete with item counts.
 * - Pins matching shots/profiles to the top of the list.
 */

import { useState, useEffect, useContext, useRef, useCallback } from 'preact/hooks';
import { StatusBar } from './StatusBar';
import { LibrarySection } from './LibrarySection';
import { libraryService } from '../services/LibraryService';
import { indexedDBService } from '../services/IndexedDBService';
import { ApiServiceContext } from '../../../services/ApiService';
import { cleanName } from '../utils/analyzerUtils';
import { downloadJson } from '../../../utils/download';

export function LibraryPanel({
  currentShot,
  currentProfile,
  currentShotName = 'No Shot Loaded',
  currentProfileName = 'No Profile Loaded',
  onShotLoadStart,
  onShotLoad,
  onProfileLoad,
  onShotUnload,
  onProfileUnload,
  onShowStats,
  importMode = 'temp',
  onImportModeChange,
  isMatchingProfile = false, // Used for highlighting
  isMatchingShot = false, // Used for highlighting
  isSearchingProfile = false, // Spinner state for profile search
}) {
  const apiService = useContext(ApiServiceContext);
  const panelRef = useRef(null);
  const sentinelRef = useRef(null);
  const barRef = useRef(null);

  // UI State
  const [isStuck, setIsStuck] = useState(false);
  const [barRect, setBarRect] = useState({ width: 0, left: 0, height: 0 });
  const [collapsed, setCollapsed] = useState(true);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false); // Specific state for import spinner

  // Data State
  const [shots, setShots] = useState([]);
  const [profiles, setProfiles] = useState([]);

  // Filter & Sort State
  const [shotsSourceFilter, setShotsSourceFilter] = useState('all');
  const [profilesSourceFilter, setProfilesSourceFilter] = useState('all');

  const [shotsSearch, setShotsSearch] = useState('');
  const [shotsSort, setShotsSort] = useState({ key: 'shotDate', order: 'desc' });

  const [profilesSearch, setProfilesSearch] = useState('');
  const [profilesSort, setProfilesSort] = useState({ key: 'name', order: 'asc' });

  // Debounced search values to avoid re-fetching on every keystroke
  const [debouncedShotsSearch, setDebouncedShotsSearch] = useState('');
  const [debouncedProfilesSearch, setDebouncedProfilesSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedShotsSearch(shotsSearch), 250);
    return () => clearTimeout(timer);
  }, [shotsSearch]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedProfilesSearch(profilesSearch), 250);
    return () => clearTimeout(timer);
  }, [profilesSearch]);

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

  // Sync dimensions for fixed positioning
  useEffect(() => {
    const updateRect = () => {
      if (!sentinelRef.current) return;
      const rect = sentinelRef.current.getBoundingClientRect();
      setBarRect({
        width: rect.width,
        left: rect.left,
        height: barRef.current?.offsetHeight || 64,
      });
    };
    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, { passive: true });
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect);
    };
  }, []);

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
   * Pins matching items (current shot/profile) to the top.
   */
  const refreshLibraries = async () => {
    setLoading(true);
    try {
      const [shotsData, profilesData] = await Promise.all([
        libraryService.getAllShots(shotsSourceFilter === 'all' ? 'both' : shotsSourceFilter),
        libraryService.getAllProfiles(
          profilesSourceFilter === 'all' ? 'both' : profilesSourceFilter,
        ),
      ]);

      // Helper: Sort logic based on config keys
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

      // Helper: Pin matches to top
      const pinMatches = (items, isShotTable) => {
        return items.sort((a, b) => {
          const matchA = isShotTable
            ? currentProfile &&
              cleanName(a.profile || '').toLowerCase() ===
                cleanName(currentProfileName).toLowerCase()
            : currentShot &&
              cleanName(a.name || a.label || '').toLowerCase() ===
                cleanName(currentShot.profile || '').toLowerCase();
          const matchB = isShotTable
            ? currentProfile &&
              cleanName(b.profile || '').toLowerCase() ===
                cleanName(currentProfileName).toLowerCase()
            : currentShot &&
              cleanName(b.name || b.label || '').toLowerCase() ===
                cleanName(currentShot.profile || '').toLowerCase();

          if (matchA && !matchB) return -1;
          if (!matchA && matchB) return 1;
          return 0;
        });
      };

      // Filter by search string (using debounced values)
      // Shot search: matches name, ID, filename, or profile name
      let fShots = shotsData;
      if (debouncedShotsSearch) {
        const sSearch = debouncedShotsSearch.toLowerCase();

        // UPDATED: Robust filtering logic
        fShots = shotsData.filter(s => {
          // Check Display Name / Label
          const nameMatch = (s.name || s.label || s.title || '').toLowerCase().includes(sSearch);
          // Check Profile Name
          const profileMatch = (s.profile || s.profileName || '').toLowerCase().includes(sSearch);
          // Check ID specifically (convert to string first)
          const idMatch = String(s.id || '')
            .toLowerCase()
            .includes(sSearch);
          // Check Filename / ExportName (e.g. for "shot-6")
          const fileMatch = (s.fileName || s.exportName || '').toLowerCase().includes(sSearch);

          return nameMatch || profileMatch || idMatch || fileMatch;
        });

        // Sort: Prioritize direct Name or ID matches over Profile-Name matches
        fShots.sort((a, b) => {
          const aId = String(a.id || '').toLowerCase();
          const aName = (a.name || a.label || a.title || '').toLowerCase();
          const aPrio = aName.includes(sSearch) || aId.includes(sSearch) ? 0 : 1;

          const bId = String(b.id || '').toLowerCase();
          const bName = (b.name || b.label || b.title || '').toLowerCase();
          const bPrio = bName.includes(sSearch) || bId.includes(sSearch) ? 0 : 1;

          return aPrio - bPrio;
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

      setShots(pinMatches(applySort(fShots, shotsSort), true));
      setProfiles(pinMatches(applySort(fProfiles, profilesSort), false));
    } catch (error) {
      console.error('Library refresh failed:', error);
    } finally {
      setLoading(false);
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
    currentShot,
    currentProfile,
    currentShotName,
    currentProfileName,
  ]);

  // --- Action Handlers ---

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
      if (item.duration !== undefined || item.samples)
        await libraryService.deleteShot(item.id || item.name, item.source);
      else await libraryService.deleteProfile(item.name || item.label, item.source);
      refreshLibraries();
    } catch (e) {
      alert(`Delete failed: ${e.message}`);
    }
  };

  const handleImport = async files => {
    setImporting(true); // START IMPORT SPINNER

    // Defer import logic to allow UI update
    setTimeout(async () => {
      try {
        for (const file of Array.from(files)) {
          const text = await file.text();
          const data = JSON.parse(text);
          if (data.samples) {
            const shot = {
              ...data,
              name: file.name,
              id: file.name,
              data,
              source: importMode === 'browser' ? 'browser' : 'temp',
            };
            if (importMode === 'browser') await indexedDBService.saveShot(shot);
            onShotLoad(data, file.name);
          } else if (data.phases) {
            // Use profile label from JSON as canonical name (not the filename)
            const profileName = data.label || cleanName(file.name);
            const profile = {
              ...data,
              name: profileName,
              data,
              source: importMode === 'browser' ? 'browser' : 'temp',
            };
            if (importMode === 'browser') await indexedDBService.saveProfile(profile);
            onProfileLoad(data, profileName);
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

  const handleLoadShot = async item => {
    try {
      onShotLoadStart();
      setCollapsed(true);
      const full = item.loaded
        ? item
        : await libraryService.loadShot(item.id || item.name, item.source);
      onShotLoad(full, item.name || item.id);
    } catch (e) {
      console.error('Failed to load shot:', e);
    }
  };

  // Styling logic for fixed bar
  const shouldBeFixed = isStuck || !collapsed;
  const fixedBarStyle = shouldBeFixed
    ? {
        position: 'fixed',
        top: 0,
        left: `${barRect.left}px`,
        width: `${barRect.width}px`,
        zIndex: 50,
      }
    : {};
  const dropdownStyle = {
    position: 'fixed',
    top: `${barRect.height}px`,
    left: `${barRect.left}px`,
    width: `${barRect.width}px`,
    zIndex: 49,
  };

  return (
    <div ref={panelRef} className='relative'>
      <div ref={sentinelRef} className='h-0 w-full' />
      {shouldBeFixed && <div style={{ height: `${barRect.height}px` }} />}

      <div ref={barRef} style={fixedBarStyle}>
        <StatusBar
          currentShot={currentShot}
          currentProfile={currentProfile}
          currentShotName={currentShotName}
          currentProfileName={currentProfileName}
          onUnloadShot={onShotUnload}
          onUnloadProfile={onProfileUnload}
          onTogglePanel={() => setCollapsed(!collapsed)}
          onImport={handleImport}
          onShowStats={onShowStats}
          isMismatch={
            currentShot &&
            currentProfile &&
            cleanName(currentShot.profile || '').toLowerCase() !==
              cleanName(currentProfileName).toLowerCase()
          }
          importMode={importMode}
          onImportModeChange={onImportModeChange}
          isExpanded={!collapsed}
          isMatchingProfile={isMatchingProfile}
          isMatchingShot={isMatchingShot}
          isImporting={importing}
          isSearchingProfile={isSearchingProfile} // <- pass down
        />
      </div>

      {!collapsed && (
        <>
          <div
            className='fixed inset-0 bg-black/20 backdrop-blur-[1px]'
            style={{ zIndex: 40 }}
            onClick={() => setCollapsed(true)}
          />
          <div style={dropdownStyle}>
            <div className='bg-base-100/80 border-base-content/10 animate-fade-in-down origin-top overflow-hidden rounded-b-xl border border-t-0 shadow-2xl backdrop-blur-md'>
              <div className='grid max-h-[75vh] grid-cols-1 gap-4 overflow-y-auto overscroll-contain p-4 lg:grid-cols-2'>
                {/* SHOTS SECTION */}
                <LibrarySection
                  title='Shots'
                  items={shots}
                  isShot={true}
                  searchValue={shotsSearch}
                  sortKey={shotsSort.key}
                  sortOrder={shotsSort.order}
                  sourceFilter={shotsSourceFilter}
                  onSearchChange={setShotsSearch}
                  onSortChange={(k, o) =>
                    setShotsSort({
                      key: k,
                      order:
                        o || (shotsSort.key === k && shotsSort.order === 'desc' ? 'asc' : 'desc'),
                    })
                  }
                  onSourceFilterChange={setShotsSourceFilter}
                  onLoad={handleLoadShot}
                  onExport={item => handleExport(item, true)} // Pass true for shots
                  onDelete={handleDelete}
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
                        await libraryService.deleteShot(s.id || s.name, s.source);
                      refreshLibraries();
                    }
                  }}
                  getMatchStatus={item =>
                    currentProfile &&
                    cleanName(item.profile || '').toLowerCase() ===
                      cleanName(currentProfileName).toLowerCase()
                  }
                />

                {/* PROFILES SECTION */}
                <LibrarySection
                  title='Profiles'
                  items={profiles}
                  isShot={false}
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
                        (profilesSort.key === k && profilesSort.order === 'desc' ? 'asc' : 'desc'),
                    })
                  }
                  onSourceFilterChange={setProfilesSourceFilter}
                  onLoad={item => {
                    onProfileLoad(item.data || item, item.name || item.label);
                    setCollapsed(true);
                  }}
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
                      for (const p of profiles)
                        await libraryService.deleteProfile(p.name || p.label, p.source);
                      refreshLibraries();
                    }
                  }}
                  getMatchStatus={item =>
                    currentShot &&
                    cleanName(item.name || item.label || '').toLowerCase() ===
                      cleanName(currentShot.profile || '').toLowerCase()
                  }
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
