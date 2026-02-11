/**
 * AnalysisTable.jsx
 * * Displays detailed shot analysis broken down by phase.
 * * Features:
 * - Integrated Column Controls (Footer)
 * - Horizontal scrolling (hidden scrollbars)
 * - Auto-adaptive theme colors
 * - Predictive scale values and target comparisons
 * - Integrated Zoom Controls (Font Size scaling)
 */

import { useState, useRef } from 'preact/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faAngleRight, faAngleDoubleRight, faArrowRight, 
    faAngleLeft, faAngleDoubleLeft, faArrowLeft,
    faExclamationTriangle, faCalculator,
    faMagnifyingGlassMinus, faMagnifyingGlassPlus,
    faCheck, faTimes, faMinus
} from '@fortawesome/free-solid-svg-icons';
import { columnConfig, groupColors } from '../utils/analyzerUtils';
import { ColumnControls } from './ColumnControls'; // Import ColumnControls

/**
 * Main Table Component
 */
export function AnalysisTable({ results, activeColumns, onColumnsChange, settings, onSettingsChange, onAnalyze }) {
    if (!results || !results.phases) return null;
    
    // State for Table Zoom (Font Size) - Default 11px
    const [tableFontSize, setTableFontSize] = useState(11);
    
    const tableContainerRef = useRef(null);
    const safeSettings = settings || { scaleDelay: 1000, sensorDelay: 200, autoDelay: true };
    const visibleColumns = columnConfig.filter(col => activeColumns.has(col.id));

    // --- Helper Functions ---

    const scrollTable = (amount) => { 
        if (tableContainerRef.current) {
            tableContainerRef.current.scrollBy({ left: amount, behavior: 'smooth' });
        }
    };
    
    const scrollToBound = (direction) => {
        if (tableContainerRef.current) {
            const left = direction === 'start' ? 0 : tableContainerRef.current.scrollWidth;
            tableContainerRef.current.scrollTo({ left, behavior: 'smooth' });
        }
    };

    const handleZoom = (direction) => {
        setTableFontSize(prev => {
            if (direction === 'in') return Math.min(16, prev + 1); // Max 16px
            if (direction === 'out') return Math.max(8, prev - 1); // Min 8px
            return prev;
        });
    };

    const getHeaderLabel = (col) => {
        let label = col.label;
        if (col.id === 'duration') label = 'Time';
        else if (col.id === 'water') label = 'Water';
        else if (col.group === 'puckflow') label = 'P. Flow';
        else if (col.group === 'temp' || col.group === 'target_temp') label = '℃';
        
        if (col.type === 'se') label += ' S/E';
        else if (col.type === 'mm') label += ' Range';
        else if (col.type === 'avg') label += ' ∅';
        return label;
    };

    // --- Styles ---
    const scrollbarHideStyle = {
        scrollbarWidth: 'none',      /* Firefox */
        msOverflowStyle: 'none'      /* IE / Edge */
    };

    return (
        <div className="mt-6 flex flex-col w-full">
            {/* Inject CSS to hide Webkit Scrollbars */}
            <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
            `}</style>

            {/* 1. Status Badges (Outside the main card) */}
            <div className="flex flex-wrap gap-2 mb-2 px-1">
                {results.isBrewByWeight ? 
                    <StatusBadge label="BREW BY WEIGHT" colorClass="bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20" /> : 
                    <StatusBadge label="BREW BY TIME" colorClass="bg-base-content/5 text-base-content/60 border-base-content/10" />
                }
                {results.globalScaleLost && <StatusBadge label="SCALE LOST" colorClass="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" />}
                {results.isAutoAdjusted && <StatusBadge label="AUTO-DELAY" colorClass="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" />}
            </div>

            {/* 2. MAIN CARD WRAPPER - Holds Toolbar, Table, Legend, Controls */}
            <div className="bg-base-100 border border-base-content/10 rounded-lg shadow-sm flex flex-col">

                {/* A. Toolbar (Top) */}
                <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-2 bg-base-200 rounded-t-lg border-b border-base-content/10 text-[10px] font-bold uppercase tracking-wider">
                    {/* Latency Inputs */}
                    <div className="flex items-center gap-4">
                        <span className="opacity-40 select-none hidden sm:inline">Latency</span>
                        <div className="flex items-center gap-2">
                            <span className="opacity-60">Scale</span>
                            <input 
                                type="number" step="50" value={safeSettings.scaleDelay} 
                                onInput={e => { 
                                    const val = parseInt(e.target.value);
                                    if (!isNaN(val)) onSettingsChange({...safeSettings, scaleDelay: val}); 
                                }}
                                className="bg-base-100 border border-base-content/10 rounded w-12 h-5 text-center font-mono focus:outline-none focus:border-primary text-base-content"
                            />
                            <span className="opacity-40 lowercase font-normal">ms</span>
                        </div>
                        <div className="w-px h-3 bg-base-content/10 mx-1"></div>
                        <div className="flex items-center gap-2">
                            <span className="opacity-60">System</span>
                            <input 
                                type="number" step="50" value={safeSettings.sensorDelay} disabled={safeSettings.autoDelay} 
                                onInput={e => { 
                                    const val = parseInt(e.target.value);
                                    if (!isNaN(val)) onSettingsChange({...safeSettings, sensorDelay: val}); 
                                }}
                                className="bg-base-100 border border-base-content/10 rounded w-12 h-5 text-center font-mono focus:outline-none focus:border-primary disabled:opacity-30 text-base-content"
                            />
                            <span className="opacity-40 lowercase font-normal">ms</span>
                            <label className="flex items-center gap-1.5 ml-2 cursor-pointer hover:text-primary transition-colors">
                                <input 
                                    type="checkbox" checked={safeSettings.autoDelay} 
                                    onChange={e => onSettingsChange({...safeSettings, autoDelay: e.target.checked})}
                                    className="checkbox checkbox-xs rounded-sm border-base-content/30" 
                                />
                                <span className="opacity-60">Auto</span>
                            </label>
                        </div>
                    </div>

                    {/* Navigation & Zoom Group */}
                    <div className="flex items-center gap-2">
                        {/* Zoom Controls */}
                        <div className="flex items-center gap-1 bg-base-content/5 rounded p-0.5 border border-base-content/5">
                            <ScrollBtn icon={faMagnifyingGlassMinus} onClick={() => handleZoom('out')} title="Zoom Out" className={tableFontSize <= 8 ? 'opacity-20' : ''} />
                            <span className="text-[9px] opacity-40 font-mono w-4 text-center select-none">{tableFontSize}</span>
                            <ScrollBtn icon={faMagnifyingGlassPlus} onClick={() => handleZoom('in')} title="Zoom In" className={tableFontSize >= 16 ? 'opacity-20' : ''} />
                        </div>

                        {/* Scroll Controls */}
                        <div className="flex items-center gap-1 bg-base-content/5 rounded p-0.5 border border-base-content/5">
                            <ScrollBtn icon={faArrowLeft} onClick={() => scrollToBound('start')} />
                            <ScrollBtn icon={faAngleDoubleLeft} onClick={() => scrollTable(-300)} />
                            <ScrollBtn icon={faAngleLeft} onClick={() => scrollTable(-100)} className="rounded-r-none mr-1" />
                            <ScrollBtn icon={faAngleRight} onClick={() => scrollTable(100)} className="rounded-l-none" />
                            <ScrollBtn icon={faAngleDoubleRight} onClick={() => scrollTable(300)} />
                            <ScrollBtn icon={faArrowRight} onClick={() => scrollToBound('end')} />
                        </div>
                    </div>
                </div>

                {/* B. Table Container (Middle) */}
                <div 
                    ref={tableContainerRef}
                    className="overflow-x-auto overflow-y-hidden h-auto min-h-0 w-full block no-scrollbar"
                    style={{ scrollBehavior: 'smooth', ...scrollbarHideStyle }}
                >
                    {/* Dynamic Font Size applied to Table */}
                    <table 
                        className="w-full border-collapse text-base-content transition-all duration-200"
                        style={{ fontSize: `${tableFontSize}px`, lineHeight: '1.4' }}
                    >
                        <thead>
                            <tr className="bg-base-200 border-b-2 border-base-content/10">
                                <th className="w-8 py-2 text-center opacity-40 bg-base-content/5 border-r border-base-content/5">#</th>
                                <th className="text-left px-2 py-2 font-bold opacity-60 uppercase tracking-tighter whitespace-nowrap min-w-[120px] bg-base-content/5 border-r border-base-content/5">
                                    Phase
                                </th>
                                {visibleColumns.map(col => {
                                    const colors = groupColors[col.group] || groupColors.basics;
                                    return (
                                        <th key={col.id} className={`text-right px-3 py-2 font-bold whitespace-nowrap ${colors.bg} ${colors.text} uppercase tracking-tighter border-l border-base-content/5`}>
                                            {getHeaderLabel(col)}
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        
                        <tbody>
                            {results.phases.map((phase, idx) => (
                                <tr key={idx} className="border-b border-base-content/5 hover:bg-base-content/5 transition-colors group align-top">
                                    <td className="text-center font-bold opacity-20 select-none pt-2.5 bg-base-content/5 border-r border-base-content/5">
                                        {idx + 1}
                                    </td>
                                    <td className="text-left px-2 py-2 whitespace-nowrap bg-base-content/5 border-r border-base-content/5">
                                        <div className="font-bold text-orange-600/90 dark:text-orange-400 leading-none mb-0.5">
                                            {phase.displayName}
                                        </div>
                                        {phase.exit?.reason && (
                                            <div className="font-bold uppercase opacity-30 tracking-tight" style={{ fontSize: '0.85em' }}>
                                                via {phase.exit.reason}
                                            </div>
                                        )}
                                    </td>
                                    {visibleColumns.map(col => (
                                        <td key={col.id} className="text-right px-3 py-2 font-mono tabular-nums whitespace-nowrap border-l border-base-content/5">
                                            <CellContent phase={phase} col={col} results={results} />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                        
                        <tfoot className="bg-base-200 font-bold border-t-2 border-base-content/10 text-base-content">
                            <tr>
                                <td className="bg-base-content/5 border-r border-base-content/5"></td>
                                <td className="px-2 py-2 opacity-60 uppercase tracking-wider text-left bg-base-content/5 border-r border-base-content/5">
                                    Total
                                </td>
                                {visibleColumns.map(col => (
                                    <td key={col.id} className="text-right px-3 py-2 font-mono tabular-nums border-l border-base-content/5">
                                        <CellContent phase={null} col={col} results={results} isTotal={true} />
                                    </td>
                                ))}
                            </tr>
                        </tfoot>
                    </table>
                </div>
                
                {/* C. Legend (Gap between Table and Controls) */}
                <div className="px-4 py-3 bg-base-100 flex gap-4 text-[10px] text-base-content/40 uppercase tracking-wider font-bold select-none border-t border-base-content/5">
                    <span>∅ Avg (Time Weighted)</span>
                    <span>S/E Start/End</span>
                    <span>Range Min/Max</span>
                </div>

                {/* D. Integrated Column Controls (Footer) */}
                <ColumnControls 
                    activeColumns={activeColumns} 
                    onColumnsChange={onColumnsChange} 
                    isIntegrated={true} 
                />
            </div>
        </div>
    );
}

/**
 * Sub-Component: Cell Content
 * Uses relative sizing (em) or inherited font size for consistency
 */
function CellContent({ phase, col, results, isTotal = false }) {
    const data = isTotal ? results.total : phase;
    const stats = isTotal ? results.total : phase.stats;
    
    if (!data) return <span>-</span>;

    // Safe number formatter — returns "-" for null/undefined/NaN
    const sf = (v, d = 1) => (v != null && isFinite(v)) ? v.toFixed(d) : "-";

    // Helper for Boolean Status rendering
    const renderBool = (val) => {
        if (val === true) return <FontAwesomeIcon icon={faCheck} className="text-success opacity-80" />;
        if (val === false) return <FontAwesomeIcon icon={faTimes} className="text-base-content/20" />; // Or faMinus
        return <span className="opacity-20">-</span>;
    };

    let mainValue = "-";
    let unit = "";
    let isBoolean = false; 
    let booleanContent = null;
    
    switch (col.id) {
        case 'duration': mainValue = sf(data.duration); unit = "s"; break;
        case 'water': mainValue = sf(data.water); unit = "ml"; break;
        case 'weight': mainValue = sf(data.weight); unit = "g"; break;
        // Pressure
        case 'p_se': mainValue = `${sf(stats?.p?.start)}/${sf(stats?.p?.end)}`; break;
        case 'p_mm': mainValue = `${sf(stats?.p?.min)}/${sf(stats?.p?.max)}`; break;
        case 'p_avg': mainValue = sf(stats?.p?.avg); unit = "bar"; break;
        // Target Pressure
        case 'tp_se': mainValue = `${sf(stats?.tp?.start)}/${sf(stats?.tp?.end)}`; break;
        case 'tp_mm': mainValue = `${sf(stats?.tp?.min)}/${sf(stats?.tp?.max)}`; break;
        case 'tp_avg': mainValue = sf(stats?.tp?.avg); unit = "bar"; break;
        // Flow
        case 'f_se': mainValue = `${sf(stats?.f?.start)}/${sf(stats?.f?.end)}`; break;
        case 'f_mm': mainValue = `${sf(stats?.f?.min)}/${sf(stats?.f?.max)}`; break;
        case 'f_avg': mainValue = sf(stats?.f?.avg); unit = "ml/s"; break;
        // Target Flow
        case 'tf_se': mainValue = `${sf(stats?.tf?.start)}/${sf(stats?.tf?.end)}`; break;
        case 'tf_mm': mainValue = `${sf(stats?.tf?.min)}/${sf(stats?.tf?.max)}`; break;
        case 'tf_avg': mainValue = sf(stats?.tf?.avg); unit = "ml/s"; break;
        // Puck Flow
        case 'pf_se': mainValue = `${sf(stats?.pf?.start)}/${sf(stats?.pf?.end)}`; break;
        case 'pf_mm': mainValue = `${sf(stats?.pf?.min)}/${sf(stats?.pf?.max)}`; break;
        case 'pf_avg': mainValue = sf(stats?.pf?.avg); unit = "ml/s"; break;
        // Temperature
        case 't_se': mainValue = `${sf(stats?.t?.start)}/${sf(stats?.t?.end)}`; break;
        case 't_mm': mainValue = `${sf(stats?.t?.min)}/${sf(stats?.t?.max)}`; break;
        case 't_avg': mainValue = sf(stats?.t?.avg); unit = "°"; break;
        // Target Temperature
        case 'tt_se': mainValue = `${sf(stats?.tt?.start)}/${sf(stats?.tt?.end)}`; break;
        case 'tt_mm': mainValue = `${sf(stats?.tt?.min)}/${sf(stats?.tt?.max)}`; break;
        case 'tt_avg': mainValue = sf(stats?.tt?.avg); unit = "°"; break;
        // Weight Details
        case 'w_se': mainValue = `${sf(stats?.w?.start)}/${sf(stats?.w?.end)}`; break;
        case 'w_mm': mainValue = `${sf(stats?.w?.min)}/${sf(stats?.w?.max)}`; break;
        case 'w_avg': mainValue = sf(stats?.w?.avg); unit = "g"; break;
        
        // --- System Info (Mapped from AnalyzerService stats) ---
        case 'sys_raw': 
            mainValue = stats?.sys_raw !== undefined ? stats.sys_raw : "-"; 
            break;
        case 'sys_shot_vol': // Start Volumetric
            isBoolean = true; 
            booleanContent = renderBool(stats?.sys_shot_vol); 
            break;
        case 'sys_curr_vol': // Currently Volumetric
            isBoolean = true; 
            booleanContent = renderBool(stats?.sys_curr_vol); 
            break;
        case 'sys_scale': // Scale Connected
            isBoolean = true; 
            booleanContent = renderBool(stats?.sys_scale); 
            break;
        case 'sys_vol_avail': // Volumetric Available
            isBoolean = true; 
            booleanContent = renderBool(stats?.sys_vol_avail); 
            break;
        case 'sys_ext': // Extended Record
            isBoolean = true; 
            booleanContent = renderBool(stats?.sys_ext); 
            break;
            
        default: mainValue = "-";
    }

    if (isTotal) {
        if (isBoolean) return <div className="flex justify-end">{booleanContent}</div>;
        return <span>{mainValue}{unit}</span>;
    }

    const isHit = phase.exit?.type === col.targetType;
    const isWeightCol = col.id === 'weight';
    
    let targetDisplay = null;
    let predictionDisplay = null;
    let warningDisplay = null;

    // Relative font sizing for sub-elements (0.85em) ensures they scale with zoom
    const subTextSize = { fontSize: '0.85em' };
    const iconSize = { fontSize: '0.8em' };

    if (phase.profilePhase && phase.profilePhase.targets && col.targetType) {
        const target = phase.profilePhase.targets.find(t => {
            if (col.id === 'weight') return t.type === 'weight' || t.type === 'volumetric';
            return t.type === col.targetType;
        });

        if (target) {
            const targetVal = target.value;
            // For compound "start/end" values, compare the end (last) value against target
            const rawForParse = typeof mainValue === 'string' && mainValue.includes('/')
                ? mainValue.split('/').pop()
                : mainValue;
            const measuredVal = parseFloat(rawForParse);
            
            if (!isNaN(measuredVal)) {
                const diff = measuredVal - targetVal;
                const diffSign = diff > 0 ? '+' : '';
                const diffColor = Math.abs(diff) < 0.5 ? 'text-success' : 'text-base-content/40';

                targetDisplay = (
                    <div style={subTextSize} className="leading-tight mt-0.5 whitespace-nowrap opacity-80">
                        <span className="opacity-50">Target:</span> {targetVal}{unit} 
                        <span className={`ml-1 font-bold ${diffColor}`}>({diffSign}{diff.toFixed(1)})</span>
                    </div>
                );
            }
        }
    }

    if (isWeightCol && phase.prediction && phase.prediction.finalWeight !== null) {
        const measuredVal = parseFloat(mainValue);
        if (!isNaN(measuredVal) && Math.abs(measuredVal - phase.prediction.finalWeight) >= 0.1) {
             const predVal = sf(phase.prediction.finalWeight);
             predictionDisplay = (
                <div style={subTextSize} className="text-blue-600 dark:text-blue-400 leading-tight mt-0.5 font-bold flex items-center justify-end gap-1">
                    <FontAwesomeIcon icon={faCalculator} style={iconSize} className="opacity-60" />
                    <span>Calc: {predVal}{unit}</span>
                </div>
            );
        }
    }

    if (isWeightCol && phase.scaleLost) {
        warningDisplay = (
            <div style={subTextSize} className="text-error font-bold flex items-center justify-end gap-1 mt-0.5">
                <FontAwesomeIcon icon={faExclamationTriangle} />
                <span>Scale Lost</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-end justify-center min-h-[2em]">
            {isBoolean ? (
                <div className="flex items-center h-full pb-1">{booleanContent}</div>
            ) : (
                <span className={`${isHit ? 'font-bold text-orange-600 dark:text-orange-400' : ''}`}>
                    {mainValue}{unit}
                </span>
            )}
            {targetDisplay}
            {predictionDisplay}
            {warningDisplay}
        </div>
    );
}

// --- Status Badge Helper ---
const StatusBadge = ({ label, colorClass, title }) => (
    <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-bold border ${colorClass} leading-none tracking-tight select-none`} title={title}>
        {label}
    </span>
);

// --- Scroll Button Helper ---
const ScrollBtn = ({ icon, onClick, className = "", title }) => (
    <button 
        onClick={onClick} 
        title={title}
        className={`btn btn-ghost btn-xs h-5 min-h-0 px-1.5 text-base-content/40 hover:text-primary ${className}`}
    >
        <FontAwesomeIcon icon={icon} className="text-[10px]" />
    </button>
);