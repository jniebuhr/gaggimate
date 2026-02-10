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

export function LibraryPanel({
    currentShot,
    currentProfile,
    currentShotName = "No Shot Loaded",
    currentProfileName = "No Profile Loaded",
    onShotLoad,
    onProfileLoad,
    onShotUnload,
    onProfileUnload,
    onShowStats,
    importMode = 'temp',
    onImportModeChange,
    isMatchingProfile = false,
    isMatchingShot = false
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
        const observer = new IntersectionObserver(
            ([entry]) => setIsStuck(!entry.isIntersecting), 
            { threshold: 0 }
        );
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
                height: barRef.current?.offsetHeight || 64
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
        const handleOutsideClick = (e) => {
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
                libraryService.getAllProfiles(profilesSourceFilter === 'all' ? 'both' : profilesSourceFilter)
            ]);
            
            // Helper: Sort logic based on config keys
            const applySort = (items, cfg) => {
                return [...items].sort((a, b) => {
                    let valA, valB;
                    switch (cfg.key) {
                        case 'shotDate': valA = a.timestamp || 0; valB = b.timestamp || 0; break;
                        case 'name': 
                            valA = (a.name || a.label || a.profile || '').toLowerCase(); 
                            valB = (b.name || b.label || b.profile || '').toLowerCase(); 
                            break;
                        case 'data.rating': valA = a.rating || 0; valB = b.rating || 0; break;
                        case 'duration': valA = parseFloat(a.duration) || 0; valB = parseFloat(b.duration) || 0; break;
                        default: valA = a[cfg.key]; valB = b[cfg.key];
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
                        ? (currentProfile && cleanName(a.profile || '').toLowerCase() === cleanName(currentProfileName).toLowerCase())
                        : (currentShot && cleanName(a.name || a.label || '').toLowerCase() === cleanName(currentShot.profile || '').toLowerCase());
                    const matchB = isShotTable
                        ? (currentProfile && cleanName(b.profile || '').toLowerCase() === cleanName(currentProfileName).toLowerCase())
                        : (currentShot && cleanName(b.name || b.label || '').toLowerCase() === cleanName(currentShot.profile || '').toLowerCase());
                    
                    if (matchA && !matchB) return -1;
                    if (!matchA && matchB) return 1;
                    return 0;
                });
            };

            // Filter by search string (using debounced values)
            // Shot search: matches name/id OR profile name (name/id matches prioritized)
            // Profile search: additionally cross-filters shots by their profile name
            let fShots = shotsData;
            if (debouncedShotsSearch) {
                const sSearch = debouncedShotsSearch.toLowerCase();
                fShots = shotsData.filter(s =>
                    (s.name || s.id || '').toLowerCase().includes(sSearch) ||
                    (s.profile || s.profileName || '').toLowerCase().includes(sSearch)
                );
                // Prioritize name/id matches over profile-only matches
                fShots.sort((a, b) => {
                    const aName = (a.name || a.id || '').toLowerCase().includes(sSearch) ? 0 : 1;
                    const bName = (b.name || b.id || '').toLowerCase().includes(sSearch) ? 0 : 1;
                    return aName - bName;
                });
            }
            if (debouncedProfilesSearch) {
                const pSearch = debouncedProfilesSearch.toLowerCase();
                fShots = fShots.filter(s => (s.profile || s.profileName || '').toLowerCase().includes(pSearch));
            }
            // Profile search: independent of shot search
            const fProfiles = profilesData.filter(p => !debouncedProfilesSearch || (p.name || p.label || '').toLowerCase().includes(debouncedProfilesSearch.toLowerCase()));

            setShots(pinMatches(applySort(fShots, shotsSort), true));
            setProfiles(pinMatches(applySort(fProfiles, profilesSort), false));
        } catch (error) {
            console.error('Library refresh failed:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { refreshLibraries(); }, [
        shotsSourceFilter, profilesSourceFilter, debouncedShotsSearch, shotsSort, 
        debouncedProfilesSearch, profilesSort, currentShot, currentProfile, currentShotName, currentProfileName
    ]);

    // --- Action Handlers ---

    const handleExport = (item) => {
        const blob = new Blob([JSON.stringify(item.data || item, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = (item.name || 'export') + (item.name?.toLowerCase().endsWith('.json') ? '' : '.json');
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleDelete = async (item) => {
        if (!confirm(`Are you sure you want to delete "${item.name || item.id}"?`)) return;
        try {
            if (item.duration !== undefined || item.samples) await libraryService.deleteShot(item.id || item.name, item.source);
            else await libraryService.deleteProfile(item.name || item.label, item.source);
            refreshLibraries();
        } catch (e) { alert(`Delete failed: ${e.message}`); }
    };

    const handleImport = async (files) => {
        for (const file of Array.from(files)) {
            try {
                const text = await file.text();
                const data = JSON.parse(text);
                if (data.samples) {
                    const shot = { ...data, name: file.name, id: file.name, data, source: importMode === 'browser' ? 'browser' : 'temp' };
                    if (importMode === 'browser') await indexedDBService.saveShot(shot);
                    onShotLoad(data, file.name);
                } else if (data.phases) {
                    // Use profile label from JSON as canonical name (not the filename)
                    const profileName = data.label || cleanName(file.name);
                    const profile = { ...data, name: profileName, data, source: importMode === 'browser' ? 'browser' : 'temp' };
                    if (importMode === 'browser') await indexedDBService.saveProfile(profile);
                    onProfileLoad(data, profileName);
                }
            } catch (e) { console.error('Import error:', e); }
        }
        refreshLibraries();
    };

    const handleLoadShot = async (item) => {
        try {
            const full = item.loaded ? item : await libraryService.loadShot(item.id || item.name, item.source);
            onShotLoad(full, item.name || item.id);
            setCollapsed(true);
        } catch (e) {
            console.error('Failed to load shot:', e);
        }
    };

    // Styling logic for fixed bar
    const shouldBeFixed = isStuck || !collapsed;
    const fixedBarStyle = shouldBeFixed ? { position: 'fixed', top: 0, left: `${barRect.left}px`, width: `${barRect.width}px`, zIndex: 50 } : {};
    const dropdownStyle = { position: 'fixed', top: `${barRect.height}px`, left: `${barRect.left}px`, width: `${barRect.width}px`, zIndex: 49 };

    return (
        <div ref={panelRef} className="relative">
            <div ref={sentinelRef} className="h-0 w-full" />
            {shouldBeFixed && <div style={{ height: `${barRect.height}px` }} />}
            
            <div ref={barRef} style={fixedBarStyle}>
                <StatusBar
                    currentShot={currentShot} currentProfile={currentProfile}
                    currentShotName={currentShotName} currentProfileName={currentProfileName}
                    onUnloadShot={onShotUnload} onUnloadProfile={onProfileUnload}
                    onTogglePanel={() => setCollapsed(!collapsed)} onImport={handleImport}
                    onShowStats={onShowStats} isMismatch={currentShot && currentProfile && cleanName(currentShot.profile || '').toLowerCase() !== cleanName(currentProfileName).toLowerCase()}
                    importMode={importMode} onImportModeChange={onImportModeChange} isExpanded={!collapsed}
                    isMatchingProfile={isMatchingProfile} isMatchingShot={isMatchingShot}
                />
            </div>
            
            {!collapsed && (
                <>
                    <div className="fixed inset-0 bg-black/20 backdrop-blur-[1px]" style={{ zIndex: 40 }} onClick={() => setCollapsed(true)} />
                    <div style={dropdownStyle}>
                        <div className="bg-base-100/80 backdrop-blur-md border border-t-0 border-base-content/10 rounded-b-xl shadow-2xl overflow-hidden animate-fade-in-down origin-top">
                            <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 max-h-[75vh] overflow-y-auto overscroll-contain">
                                
                                {/* SHOTS SECTION */}
                                <LibrarySection
                                    title="Shots" items={shots} isShot={true}
                                    searchValue={shotsSearch} sortKey={shotsSort.key} sortOrder={shotsSort.order}
                                    sourceFilter={shotsSourceFilter} onSearchChange={setShotsSearch}
                                    onSortChange={(k, o) => setShotsSort({ key: k, order: o || (shotsSort.key === k && shotsSort.order === 'desc' ? 'asc' : 'desc') })}
                                    onSourceFilterChange={setShotsSourceFilter} onLoad={handleLoadShot}
                                    onExport={handleExport} onDelete={handleDelete}
                                    onExportAll={() => {
                                        if (shots.length === 0) return;
                                        if (confirm(`Do you really want to export all ${shots.length} filtered shots?`)) {
                                            for (let i = 0; i < shots.length; i++) setTimeout(() => handleExport(shots[i]), i * 300);
                                        }
                                    }}
                                    onDeleteAll={async () => { 
                                        if(confirm(`WARNING: Do you really want to IRREVOCABLY delete all ${shots.length} filtered shots?`)) { 
                                            for(const s of shots) await libraryService.deleteShot(s.id || s.name, s.source); 
                                            refreshLibraries(); 
                                        }
                                    }}
                                    getMatchStatus={(item) => currentProfile && cleanName(item.profile || '').toLowerCase() === cleanName(currentProfileName).toLowerCase()}
                                />
                                
                                {/* PROFILES SECTION */}
                                <LibrarySection
                                    title="Profiles" items={profiles} isShot={false}
                                    searchValue={profilesSearch} sortKey={profilesSort.key} sortOrder={profilesSort.order}
                                    sourceFilter={profilesSourceFilter} onSearchChange={setProfilesSearch}
                                    onSortChange={(k, o) => setProfilesSort({ key: k, order: o || (profilesSort.key === k && profilesSort.order === 'desc' ? 'asc' : 'desc') })}
                                    onSourceFilterChange={setProfilesSourceFilter} onLoad={(item) => { onProfileLoad(item.data || item, item.name || item.label); setCollapsed(true); }}
                                    onExport={handleExport} onDelete={handleDelete}
                                    onExportAll={() => {
                                        if (profiles.length === 0) return;
                                        if (confirm(`Do you really want to export all ${profiles.length} filtered profiles?`)) {
                                            for (let i = 0; i < profiles.length; i++) setTimeout(() => handleExport(profiles[i]), i * 300);
                                        }
                                    }}
                                    onDeleteAll={async () => { 
                                        if(confirm(`WARNING: Do you really want to IRREVOCABLY delete all ${profiles.length} filtered profiles?`)) { 
                                            for(const p of profiles) await libraryService.deleteProfile(p.name || p.label, p.source); 
                                            refreshLibraries(); 
                                        }
                                    }}
                                    getMatchStatus={(item) => currentShot && cleanName(item.name || item.label || '').toLowerCase() === cleanName(currentShot.profile || '').toLowerCase()}
                                />
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}