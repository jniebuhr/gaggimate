/**
 * ShotAnalyzer.jsx
 * Main container for the analysis view.
 * Handles shot loading, chart visualization, and data tables.
 */

import { useState, useEffect, useContext } from 'preact/hooks';
import { useRoute } from 'preact-iso'; 
import { LibraryPanel } from './components/LibraryPanel';
import { AnalysisTable } from './components/AnalysisTable';
import { ShotChart } from './components/ShotChart';
import { calculateShotMetrics, detectAutoDelay } from './services/AnalyzerService';
import { libraryService } from './services/LibraryService';
import { ApiServiceContext } from '../../services/ApiService';
import { 
    getDefaultColumns, 
    cleanName,
    ANALYZER_DB_KEYS,
    loadFromStorage,
} from './utils/analyzerUtils';

// Asset Imports
import DeepDiveLogoOutline from './assets/deepdive.svg'; 

export function ShotAnalyzer() {
    const apiService = useContext(ApiServiceContext);
    const { params } = useRoute();
    
    // --- State ---
    const [currentShot, setCurrentShot] = useState(null);
    const [currentProfile, setCurrentProfile] = useState(null);
    const [currentShotName, setCurrentShotName] = useState("No Shot Loaded");
    const [currentProfileName, setCurrentProfileName] = useState("No Profile Loaded");
    
    const [importMode, setImportMode] = useState('temp'); 
    const [showInfoModal, setShowInfoModal] = useState(false); 
    
    const [isMatchingProfile, setIsMatchingProfile] = useState(false);
    const [isSearchingProfile, setIsSearchingProfile] = useState(false); // <--- NEW STATE

    const [activeColumns, setActiveColumns] = useState(() => {
        const userStandard = loadFromStorage(ANALYZER_DB_KEYS.USER_STANDARD);
        return userStandard ? new Set(userStandard) : getDefaultColumns();
    });
    
    const [settings, setSettings] = useState({
        scaleDelay: 200,
        sensorDelay: 200,
        autoDelay: true
    });
    
    const [analysisResults, setAnalysisResults] = useState(null);

    // --- DEEP LINK HANDLER ---
    useEffect(() => {
        const loadDeepLink = async () => {
            if (params.source && params.id) {
                
                // 1. MAP URL PARAMS TO SERVICE PARAMS
                // internal -> gaggimate
                // external -> browser
                let serviceSource = params.source;
                if (params.source === 'internal') serviceSource = 'gaggimate';
                if (params.source === 'external') serviceSource = 'browser';

                // Prevent reloading if already loaded
                if (currentShot && currentShot.id === params.id && currentShot.source === serviceSource) {
                    return;
                }

                console.log(`Deep Link detected: Loading ${params.id} from ${serviceSource} (URL: ${params.source})`);
                
                try {
                    // Load using the mapped service source
                    const shot = await libraryService.loadShot(params.id, serviceSource);
                    
                    if (shot) {
                        // Ensure the shot object has the correct internal source ('gaggimate'/'browser')
                        // so that badges and logic work correctly, regardless of what the URL says.
                        shot.source = serviceSource; 
                        await handleShotLoad(shot, shot.name || params.id);
                    }
                } catch (e) {
                    console.error("Deep Link Load Failed:", e);
                }
            }
        };

        if (apiService) {
            loadDeepLink();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.source, params.id, apiService]); 
    
    // --- Effects ---
    useEffect(() => {
        if (apiService) libraryService.setApiService(apiService);
    }, [apiService]);
    
    useEffect(() => {
        if (!currentShot) {
            setAnalysisResults(null);
            return;
        }
        // Defer analysis to next tick to allow UI update
        setTimeout(() => performAnalysis(), 0);
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
        const shotWithMetadata = {
            ...shotData,
            source: shotData.source || importMode
        };

        // If loading via Deep Link, ensure we use the mapped source (gaggimate/browser) 
        // derived in the useEffect, OR fallback to the shot's own source. 
        // (Logic handled implicitly by passing correct object to setCurrentShot)

        setCurrentShot(shotWithMetadata);
        setCurrentShotName(name);
        
        if (shotWithMetadata.profile) {
            setIsMatchingProfile(true);
            setIsSearchingProfile(true); // <--- START SPINNER

            // Force a UI render cycle before starting heavy profile search
            setTimeout(async () => {
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
                    setIsSearchingProfile(false); // <- stop spinner
                }
            }, 50);
        }
    };
    
    const handleProfileLoad = (data, name) => {
        setCurrentProfile(data);
        setCurrentProfileName(name);
    };
    
    // Helper style for CSS Masking
    const maskStyle = {
        maskImage: `url(${DeepDiveLogoOutline})`,
        WebkitMaskImage: `url(${DeepDiveLogoOutline})`,
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center'
    };
    
    return (
        <div className="pb-20">
            {/* Header */}
            <div className='mb-4 flex flex-row items-center gap-2'>
                <h2 className='flex-grow text-2xl font-bold sm:text-3xl'>Deep Dive Shot Analyzer</h2>
            </div>
            
            <div className="container mx-auto max-w-7xl">
                {/* Library Panel (Always visible) */}
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
                        isSearchingProfile={isSearchingProfile} // <- pass prop
                    />
                </div>
                
                {currentShot ? (
                    // --- Active Analysis View ---
                    <div className="mt-8 space-y-5 animate-fade-in">
                        <div className="bg-base-200/50 backdrop-blur-sm rounded-lg p-5 shadow-sm border border-base-content/5">
                            <div className="text-lg font-bold text-base-content mb-4 pb-2.5 border-b-2 border-base-content/10 uppercase tracking-wide">
                                Shot Analysis
                            </div>
                            
                            <div className="mb-8">
                                <ShotChart shotData={currentShot} />
                            </div>
                            
                            {analysisResults && (
                                <div className="mt-4 space-y-6">
                                    <AnalysisTable
                                        results={analysisResults}
                                        activeColumns={activeColumns}
                                        onColumnsChange={setActiveColumns}
                                        settings={settings}
                                        onSettingsChange={setSettings}
                                        onAnalyze={performAnalysis}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    // --- Empty State / Onboarding ---
                    <div className="flex items-center justify-center min-h-[60vh] p-8">
                        <div className="max-w-2xl text-center space-y-8">
                            
                            {/* Headline */}
                            <div className="space-y-2">
                                <h2 className="text-2xl font-bold text-base-content">No Shot Loaded</h2>
                                <p className="text-base-content opacity-70">Import a shot file or select one from your library to start analyzing.</p>
                            </div>

                            {/* Info Box */}
                            <div className="space-y-6 text-left bg-base-200/60 rounded-xl p-8 border border-base-content/5 shadow-sm">
                                <p className="text-sm font-bold text-base-content uppercase tracking-wide border-b border-base-content/10 pb-2 mb-4">
                                    Supported Sources
                                </p>

                                {/* GM Section */}
                                <div className="flex gap-4 items-start group">
                                    <div className="flex-shrink-0 w-10 h-8 rounded flex items-center justify-center 
                                        bg-cyan-500/10 border border-cyan-500/20">
                                        <span className="text-[10px] font-black text-cyan-500 tracking-tighter">GM</span>
                                    </div>
                                    
                                    <div className="flex-1">
                                        <h3 className="font-bold text-sm mb-1 text-base-content group-hover:text-cyan-500 transition-colors">
                                            GaggiMate Controller
                                        </h3>
                                        <p className="text-xs text-base-content leading-relaxed">
                                            Your saved shots and profiles directly from the controller's internal storage.
                                        </p>
                                    </div>
                                </div>

                                {/* Divider - Subtle */}
                                <div className="w-full h-px bg-base-content/5"></div>

                                {/* WEB Section */}
                                <div className="flex gap-4 items-start group">
                                    <div className="flex-shrink-0 w-10 h-8 rounded flex items-center justify-center 
                                        bg-purple-500/10 border border-purple-500/20">
                                        <span className="text-[10px] font-black text-purple-500 tracking-tighter">WEB</span>
                                    </div>
                                    
                                    <div className="flex-1">
                                        <h3 className="font-bold text-sm mb-1 text-base-content group-hover:text-purple-500 transition-colors">
                                            Local Browser Storage
                                        </h3>
                                        <div className="text-xs text-base-content leading-relaxed">
                                            External <code className="bg-base-100 px-1 py-0.5 rounded border border-base-content/10 text-[10px] font-mono mx-0.5 text-purple-500">.json</code> files. 
                                            <span className="block mt-1">Drag & Drop files or use the Import button. Bulk upload is supported.</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Logo: Masked Div for Theme Color Adaptation */}
                            <div 
                                className="w-24 h-24 mx-auto bg-base-content opacity-20"
                                style={maskStyle}
                            />
                            
                            {/* Tip */}
                            <div className="text-xs text-base-content opacity-50 pt-2">
                                Tip: You can toggle between <span className="font-bold opacity-100">VIEW Temporarily or SAVE in Browser</span>.
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Coming Soon Modal */}
            {showInfoModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowInfoModal(false)}>
                    <div className="bg-base-100 rounded-2xl shadow-2xl max-w-md w-full p-8 text-center border border-base-content/10" onClick={e => e.stopPropagation()}>
                        
                        {/* Logo: Masked Div for Theme Color Adaptation */}
                        <div 
                            className="w-24 h-24 mx-auto mb-6 bg-base-content opacity-90"
                            style={maskStyle}
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