/**
 * ShotAnalyzer.jsx
 */

import { useState, useEffect, useContext } from 'preact/hooks';
import { LibraryPanel } from './components/LibraryPanel';
import { ShotFileInfo } from './components/ShotFileInfo';
import { AnalysisTable } from './components/AnalysisTable';
import { ShotChart } from './components/ShotChart';
import { calculateShotMetrics, detectAutoDelay } from './services/AnalyzerService';
import { libraryService } from './services/LibraryService';
import { indexedDBService } from './services/IndexedDBService';
import { ApiServiceContext } from '../../services/ApiService';
import { 
    getDefaultColumns, 
    cleanName,
    ANALYZER_DB_KEYS,
    loadFromStorage,
    saveToStorage
} from './utils/analyzerUtils';
import DeepDiveLogo from './assets/deepdive.png'; 

export function ShotAnalyzer() {
    const apiService = useContext(ApiServiceContext);
    
    // --- State ---
    const [currentShot, setCurrentShot] = useState(null);
    const [currentProfile, setCurrentProfile] = useState(null);
    const [currentShotName, setCurrentShotName] = useState("No Shot Loaded");
    const [currentProfileName, setCurrentProfileName] = useState("No Profile Loaded");
    
    const [importMode, setImportMode] = useState('temp'); 
    const [showInfoModal, setShowInfoModal] = useState(false); 
    
    const [isMatchingProfile, setIsMatchingProfile] = useState(false);
    
    const [activeColumns, setActiveColumns] = useState(() => {
        const userStandard = loadFromStorage(ANALYZER_DB_KEYS.USER_STANDARD);
        return userStandard ? new Set(userStandard) : getDefaultColumns();
    });
    
    const [settings, setSettings] = useState({
        scaleDelay: 800,
        sensorDelay: 200,
        autoDelay: true
    });
    
    const [analysisResults, setAnalysisResults] = useState(null);
    
    // --- Effects ---
    useEffect(() => {
        if (apiService) libraryService.setApiService(apiService);
    }, [apiService]);
    
    useEffect(() => {
        if (!currentShot) {
            setAnalysisResults(null);
            return;
        }
        performAnalysis();
    }, [currentShot, currentProfile, settings]);
    
    // --- Analysis Logic ---
    const performAnalysis = () => {
        if (!currentShot) return;
        
        let usedSensorDelay = settings.sensorDelay;
        let isAutoAdjusted = false;
        
        if (settings.autoDelay && currentProfile) {
            const detection = detectAutoDelay(currentShot, currentProfile, settings.sensorDelay);
            usedSensorDelay = detection.delay;
            isAutoAdjusted = detection.auto;
        }
        
        const results = calculateShotMetrics(
            currentShot,
            currentProfile,
            {
                scaleDelayMs: settings.scaleDelay,
                sensorDelayMs: usedSensorDelay,
                isAutoAdjusted: isAutoAdjusted
            }
        );
        setAnalysisResults(results);
    };
    
    // --- Data Handlers ---
    const handleShotLoad = async (shotData, name) => {
        const isGM = !name.toLowerCase().endsWith('.json') && !name.toLowerCase().endsWith('.slog');
        const shotWithMetadata = {
            ...shotData,
            source: isGM ? 'gaggimate' : (shotData.source || importMode)
        };

        setCurrentShot(shotWithMetadata);
        setCurrentShotName(name);
        
        if (shotWithMetadata.profile) {
            setIsMatchingProfile(true);
            try {
                const target = cleanName(shotWithMetadata.profile).toLowerCase();
                const allProfiles = await libraryService.getAllProfiles('both');
                const match = allProfiles.find(p => cleanName(p.name || p.label || '').toLowerCase() === target);
                
                if (match) {
                    const pid = match.source === 'gaggimate' ? (match.profileId || match.id) : match.name;
                    const fullP = match.data ? match.data : await libraryService.loadProfile(pid, match.source);
                    setCurrentProfile(fullP);
                    setCurrentProfileName(match.name || match.label);
                }
            } catch (e) { 
                console.warn("Profile auto-match failed:", e); 
            } finally {
                setIsMatchingProfile(false);
            }
        }
    };
    
    const handleProfileLoad = (data, name) => {
        setCurrentProfile(data);
        setCurrentProfileName(name);
    };
    
    const handleShotUpdate = async (updatedShot) => {
        setCurrentShot(updatedShot);
        const source = updatedShot.source || 'browser';
        
        try {
            if (source === 'gaggimate' && apiService?.socket?.readyState === WebSocket.OPEN) {
                await apiService.request({
                    tp: 'req:history:notes:save',
                    id: updatedShot.id,
                    notes: updatedShot.notes
                });
            } else if (source === 'browser') {
                await indexedDBService.saveShot({
                    ...updatedShot,
                    name: updatedShot.name || currentShotName,
                    id: updatedShot.id || currentShotName,
                    source: 'browser'
                });
            }
            const lib = loadFromStorage(ANALYZER_DB_KEYS.SHOTS, []);
            const idx = lib.findIndex(i => i.name === currentShotName);
            if (idx > -1) {
                lib[idx].data = updatedShot;
                saveToStorage(ANALYZER_DB_KEYS.SHOTS, lib);
            }
        } catch (e) { console.error("Save failed:", e); }
    };

    const handleExportShot = () => {
        if (!currentShot) return;
        const blob = new Blob([JSON.stringify(currentShot, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (currentShotName.toLowerCase().endsWith('.json') ? currentShotName : currentShotName + '.json');
        a.click();
        URL.revokeObjectURL(url);
    };
    
    return (
        <div className="pb-20">
            <div className='mb-4 flex flex-row items-center gap-2'>
                <h2 className='flex-grow text-2xl font-bold sm:text-3xl'>Deep Dive Shot Analyzer</h2>
            </div>
            
            <div className="container mx-auto max-w-7xl">
                <div className="mt-4">
                    <LibraryPanel
                        currentShot={currentShot}
                        currentProfile={currentProfile}
                        currentShotName={currentShotName}
                        currentProfileName={currentProfileName}
                        onShotLoad={handleShotLoad}
                        onProfileLoad={handleProfileLoad}
                        onShotUnload={() => { setCurrentShot(null); setCurrentShotName("No Shot Loaded"); setAnalysisResults(null); }}
                        onProfileUnload={() => { setCurrentProfile(null); setCurrentProfileName("No Profile Loaded"); }}
                        onShowStats={() => setShowInfoModal(true)}
                        importMode={importMode}
                        onImportModeChange={setImportMode}
                        isMatchingProfile={isMatchingProfile}
                    />
                </div>
                
                {currentShot ? (
                    <div className="mt-8 space-y-5 animate-fade-in">
                        <ShotFileInfo
                            shot={currentShot}
                            onUpdate={handleShotUpdate}
                            onExport={handleExportShot}
                        />
                        
                        <div className="bg-base-200/50 backdrop-blur-sm rounded-lg p-5 shadow-sm border border-base-content/5">
                            <div className="text-lg font-bold text-base-content mb-4 pb-2.5 border-b-2 border-base-content/10 uppercase tracking-wide">
                                Shot Analysis
                            </div>
                            
                            <div className="mb-8">
                                <ShotChart shotData={currentShot} />
                            </div>

                            {/* Column Controls removed here, they are now inside AnalysisTable */}
                            
                            {analysisResults && (
                                <div className="mt-4 space-y-6">
                                    <AnalysisTable
                                        results={analysisResults}
                                        activeColumns={activeColumns}
                                        onColumnsChange={setActiveColumns} // Passed down
                                        profileData={currentProfile}
                                        settings={settings}
                                        onSettingsChange={setSettings}
                                        onAnalyze={performAnalysis}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="mt-16 text-center">
                        <div className="inline-block p-10 bg-base-200/30 border-2 border-dashed border-base-content/10 rounded-2xl max-w-lg w-full">
                            <h3 className="text-xl font-semibold text-base-content mb-2">No Shot Loaded</h3>
                            <p className="text-base-content/70">Import a shot file to start analyzing</p>
                        </div>
                    </div>
                )}
            </div>

            {showInfoModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowInfoModal(false)}>
                    <div className="bg-base-100 rounded-2xl shadow-2xl max-w-md w-full p-8 text-center border border-base-content/10" onClick={e => e.stopPropagation()}>
                        <img 
                            src={DeepDiveLogo} 
                            alt="Deep Dive" 
                            className="w-24 h-auto mx-auto mb-6 opacity-90 drop-shadow-sm" 
                        />
                        <h3 className="text-2xl font-bold mb-2">Coming Soon</h3>
                        <p className="opacity-70">Comparison and statistics feature under development.</p>
                        <button onClick={() => setShowInfoModal(false)} className="btn btn-primary mt-6 w-full">Close</button>
                    </div>
                </div>
            )}
        </div>
    );
}