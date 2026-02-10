/**
 * ColumnControls.jsx
 * UI component to toggle specific columns in the analysis table.
 */

import { useState, useEffect } from 'preact/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons/faChevronDown';
import { faTrash } from '@fortawesome/free-solid-svg-icons/faTrash';
import { faUndo } from '@fortawesome/free-solid-svg-icons/faUndo';
import {
    ANALYZER_DB_KEYS,
    groups,
    groupColors,
    getGroupedColumns,
    getDefaultColumns,
    getAllColumns,
    saveToStorage,
    loadFromStorage
} from '../utils/analyzerUtils';

export function ColumnControls({ activeColumns, onColumnsChange, isIntegrated = false }) {
    const [expanded, setExpanded] = useState(false);
    const [presets, setPresets] = useState([]);
    const [selectedPresetId, setSelectedPresetId] = useState('');
    
    useEffect(() => {
        setPresets(loadFromStorage(ANALYZER_DB_KEYS.PRESETS, []));
    }, []);
    
    const groupedColumns = getGroupedColumns();
    
    const toggleColumn = (columnId, checked) => {
        const newColumns = new Set(activeColumns);
        checked ? newColumns.add(columnId) : newColumns.delete(columnId);
        onColumnsChange(newColumns);
        if (selectedPresetId) setSelectedPresetId(''); // Reset selection when manually editing
    };

    // --- Actions ---
    const applyStandard = (e) => {
        e.stopPropagation();
        const userStandard = loadFromStorage(ANALYZER_DB_KEYS.USER_STANDARD);
        onColumnsChange(userStandard ? new Set(userStandard) : getDefaultColumns());
        setSelectedPresetId('');
    };
    
    const applyAll = () => {
        onColumnsChange(getAllColumns());
        setSelectedPresetId('ALL_METRICS');
    };

    const applyFactoryReset = () => {
        if(confirm("Reset columns to system defaults?")) {
            onColumnsChange(getDefaultColumns());
            setSelectedPresetId('');
        }
    };

    const saveAsStandard = () => {
        if (!confirm("Save current selection as your new 'Standard'?")) return;
        saveToStorage(ANALYZER_DB_KEYS.USER_STANDARD, Array.from(activeColumns));
    };

    const saveAsPreset = () => {
        const name = prompt("Name for new Preset:");
        if (!name) return;
        const newPreset = { id: Date.now().toString(), name, columns: Array.from(activeColumns) };
        const updated = [...presets, newPreset];
        setPresets(updated);
        saveToStorage(ANALYZER_DB_KEYS.PRESETS, updated);
        setSelectedPresetId(newPreset.id);
    };

    const deletePreset = (e) => {
        e.stopPropagation();
        if (!selectedPresetId || selectedPresetId === 'ALL_METRICS') return;
        if (!confirm("Delete this preset?")) return;
        const updated = presets.filter(p => p.id !== selectedPresetId);
        setPresets(updated);
        saveToStorage(ANALYZER_DB_KEYS.PRESETS, updated);
        applyStandard(e);
    };

    // Helper for Detailed Labels
    const getDetailedLabel = (col) => {
        let suffix = "";
        if (col.type === 'se') suffix = " Start/End";
        else if (col.type === 'mm') suffix = " Min/Max";
        else if (col.type === 'avg') suffix = " Avg (tw)";
        return col.label + suffix;
    };

    // Container styles using fixed base colors
    const containerClasses = isIntegrated
        ? "bg-base-200 border-t border-base-content/10 rounded-b-lg" 
        : "bg-base-200/80 backdrop-blur-md rounded-lg shadow-sm border border-base-content/10 mb-5";

    return (
        <div className={`overflow-hidden transition-colors ${containerClasses}`}>
            {/* Header Bar */}
            <div 
                className="px-4 py-3 flex items-center gap-4 cursor-pointer hover:bg-base-content/10 select-none"
                onClick={() => setExpanded(!expanded)}
            >
                <div className={`text-primary transition-transform duration-300 text-xs ${expanded ? 'rotate-180' : ''}`}>
                    <FontAwesomeIcon icon={faChevronDown} />
                </div>
                
                <div className="flex-1 min-w-0 font-bold text-base-content text-xs uppercase tracking-wider">
                    Column Configuration
                </div>
                
                {/* Quick Controls in Header */}
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <button onClick={applyStandard} className="btn btn-ghost btn-xs text-[10px] h-6 min-h-0 font-bold uppercase tracking-wider">
                        Standard
                    </button>

                    <select
                        value={selectedPresetId}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'ALL_METRICS') {
                                applyAll();
                            } else {
                                const p = presets.find(x => x.id === val);
                                if (p) { onColumnsChange(new Set(p.columns)); setSelectedPresetId(p.id); }
                            }
                        }}
                        onClick={e => e.stopPropagation()}
                        className="select select-bordered select-xs h-6 min-h-0 text-[10px] font-bold bg-base-100"
                    >
                        <option value="" disabled>Presets...</option>
                        <option value="ALL_METRICS">All Metrics</option>
                        <option disabled>──────────</option>
                        {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>

                    {selectedPresetId && selectedPresetId !== 'ALL_METRICS' && (
                        <button onClick={deletePreset} className="btn btn-ghost btn-xs h-6 min-h-0 text-error">
                            <FontAwesomeIcon icon={faTrash} />
                        </button>
                    )}
                </div>
            </div>

            {/* Expandable Selection Grid */}
            {expanded && (
                <div className="px-5 py-6 border-t border-base-content/10 animate-fade-in bg-base-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {Object.keys(groupedColumns).map(groupKey => {
                            const cols = groupedColumns[groupKey];
                            const colors = groupColors[groupKey] || groupColors.basics;
                            
                            return (
                                <div key={groupKey} className={`rounded-md p-3 ${colors.bg} border ${colors.border}`}>
                                    <h4 className={`text-[10px] font-bold uppercase tracking-wider mb-2 border-b border-current pb-1 ${colors.text}`}>
                                        {groups[groupKey]}
                                    </h4>
                                    
                                    <div className="space-y-1.5">
                                        {cols.map(col => (
                                            <label key={col.id} className={`flex items-start gap-2 text-xs cursor-pointer group ${colors.text}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={activeColumns.has(col.id)}
                                                    onChange={(e) => toggleColumn(col.id, e.target.checked)}
                                                    className={`checkbox checkbox-xs rounded-sm mt-0.5 ${colors.border}`}
                                                    style={{ borderColor: 'currentColor' }}
                                                />
                                                <span className="font-medium leading-tight">
                                                    {getDetailedLabel(col)}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    
                    {/* Action Footer */}
                    <div className="flex justify-between items-center mt-6 pt-4 border-t border-base-content/10">
                        <div className="flex gap-2">
                            <button onClick={applyFactoryReset} className="btn btn-xs btn-ghost gap-1 text-[10px] font-bold uppercase text-base-content/60 hover:text-error">
                                <FontAwesomeIcon icon={faUndo} /> Reset Defaults
                            </button>
                        </div>
                        
                        <div className="flex gap-2">
                            <button onClick={saveAsStandard} className="btn btn-xs btn-ghost text-[10px] font-bold uppercase text-base-content/60 hover:text-base-content">
                                Save as Standard
                            </button>
                            <button onClick={saveAsPreset} className="btn btn-xs btn-outline btn-primary text-[10px]">
                                Save as New Preset
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}