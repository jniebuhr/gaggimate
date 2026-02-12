/**
 * StatusBar.jsx
 * * Merges seamlessly with the dropdown when expanded.
 */

import { cleanName } from '../utils/analyzerUtils';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileImport } from '@fortawesome/free-solid-svg-icons/faFileImport';
import { faFolderOpen } from '@fortawesome/free-solid-svg-icons/faFolderOpen';
import { faTimes } from '@fortawesome/free-solid-svg-icons/faTimes';
import { faChartLine } from '@fortawesome/free-solid-svg-icons/faChartLine'; 
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons/faTriangleExclamation';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons/faChevronDown';
import { faCircleNotch } from '@fortawesome/free-solid-svg-icons/faCircleNotch';

export function StatusBar({
    currentShot,
    currentProfile,
    currentShotName,
    currentProfileName,
    onUnloadShot,
    onUnloadProfile,
    onTogglePanel,
    onImport,
    onShowStats,
    isMismatch,
    importMode = 'temp', 
    onImportModeChange,
    isExpanded = false,
    isImporting = false,        // Show spinner on import button
    isSearchingProfile = false  // Show spinner on profile badge
}) {
    const handleFileSelect = (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            onImport(files);
            e.target.value = ''; 
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            onImport(files);
        }
    };

    // Shared styling for badges
    const badgeBaseClass = "flex items-center justify-between flex-1 px-3 sm:px-4 h-full rounded-lg border-2 cursor-pointer transition-all min-w-0 shadow-sm";

    const shotBadgeClasses = currentShot
        ? `${badgeBaseClass} bg-primary border-primary text-primary-content`
        : `${badgeBaseClass} bg-base-200/50 border-base-content/10 text-base-content hover:bg-base-200`;

    // Updated Badge Logic: If searching, keep it neutral but show activity
    const profileBadgeClasses = isMismatch
        ? `${badgeBaseClass} bg-orange-500 border-orange-600 text-white shadow-orange-500/30`
        : (currentProfile && !isSearchingProfile)
        ? `${badgeBaseClass} bg-secondary border-secondary text-secondary-content`
        : `${badgeBaseClass} bg-base-200/50 border-base-content/10 text-base-content hover:bg-base-200`;

    return (
        <div className={`w-full transition-all duration-200 backdrop-blur-md ${
            isExpanded 
                ? 'bg-base-100/80 border border-base-content/10 border-b-0 rounded-t-xl shadow-none' 
                : 'bg-base-100/80 border border-base-content/10 rounded-xl shadow-lg'
        }`}>
            <div className="p-2">
                <div className="flex items-center gap-2 w-full h-12">
                    
                    {/* --- LEFT: IMPORT BUTTON (Symmetrical w-40) --- */}
                    <div 
                        className="h-full w-40 flex rounded-lg border-2 border-dashed border-primary/50 overflow-hidden bg-base-100/50 hover:border-primary transition-all shadow-sm group shrink-0"
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                    >
                        <label className="flex-1 h-full flex items-center justify-center cursor-pointer hover:bg-primary/10 text-primary transition-colors border-r border-base-content/10">
                            {/* Import Spinner */}
                            {isImporting ? (
                                <FontAwesomeIcon icon={faCircleNotch} spin className="text-xl opacity-60" />
                            ) : (
                                <FontAwesomeIcon icon={faFileImport} className="text-xl" />
                            )}
                            <input type="file" multiple accept=".slog,.json" onChange={handleFileSelect} className="hidden" disabled={isImporting} />
                        </label>

                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                onImportModeChange(importMode === 'browser' ? 'temp' : 'browser');
                            }}
                            className="w-16 h-full flex flex-col items-center justify-center bg-base-100/50 text-base-content/70 hover:bg-primary hover:text-white transition-colors"
                            title="Toggle between Browser and Temporary mode"
                        >
                            <span className="text-[10px] font-bold uppercase tracking-wide leading-tight">
                                {importMode === 'browser' ? 'Save' : 'View'}
                            </span>
                            <span className="text-[9px] opacity-70 leading-tight whitespace-nowrap scale-90">
                                {importMode === 'browser' ? 'in Browser' : 'Temporarily'}
                            </span>
                        </button>
                    </div>

                    {/* --- CENTER: SHOT BADGE --- */}
                    <div
                        className={shotBadgeClasses}
                        onClick={onTogglePanel}
                        title="Click to toggle library"
                    >
                        <FontAwesomeIcon icon={faFolderOpen} className="opacity-70" />
                        <span className="flex-1 text-center font-bold text-sm truncate mx-2">
                            {cleanName(currentShotName)}
                        </span>
                        {currentShot ? (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onUnloadShot();
                                }}
                                className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-current opacity-60 hover:opacity-100 hover:bg-black/10 transition-all"
                            >
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                        ) : (
                            <FontAwesomeIcon icon={faChevronDown} className="opacity-40 text-xs" />
                        )}
                    </div>

                    {/* --- CENTER: PROFILE BADGE --- */}
                    <div
                        className={profileBadgeClasses}
                        onClick={onTogglePanel}
                        title={isMismatch ? "Profile mismatch detected!" : "Click to toggle library"}
                    >
                        {/* Profile Search Spinner replaces Folder Icon */}
                        {isSearchingProfile ? (
                            <FontAwesomeIcon icon={faCircleNotch} spin className="opacity-70 text-primary" />
                        ) : (
                            <FontAwesomeIcon icon={faFolderOpen} className="opacity-70" />
                        )}
                        
                        <span className="flex-1 text-center font-bold text-sm truncate mx-2">
                            {/* Show "Searching..." text if actively searching, otherwise normal name */}
                            {isSearchingProfile ? (
                                <span className="opacity-50 italic">Searching Profile...</span>
                            ) : (
                                <>
                                    {isMismatch && <FontAwesomeIcon icon={faTriangleExclamation} className="mr-2" />}
                                    {cleanName(currentProfileName)}
                                </>
                            )}
                        </span>
                        
                        {currentProfile && !isSearchingProfile ? (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onUnloadProfile();
                                }}
                                className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-current opacity-60 hover:opacity-100 hover:bg-black/10 transition-all"
                            >
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                        ) : (
                            !isSearchingProfile && <FontAwesomeIcon icon={faChevronDown} className="opacity-40 text-xs" />
                        )}
                    </div>

                    {/* --- RIGHT: STATS BUTTON (w-40) --- */}
                    <button
                        className="h-full w-40 flex items-center justify-center rounded-lg border-2 border-success/50 text-success hover:bg-success hover:text-white hover:border-success transition-all shadow-sm shrink-0 bg-base-100/50"
                        onClick={onShowStats}
                        title="Compare & Statistics"
                    >
                        <FontAwesomeIcon icon={faChartLine} className="text-xl" />
                    </button>

                </div>
            </div>
        </div>
    );
}