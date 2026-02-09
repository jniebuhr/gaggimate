import { useState, useEffect, useContext, useCallback } from 'preact/hooks';
import { ApiServiceContext } from '../../../services/ApiService';
import { libraryService } from '../services/LibraryService';
import { 
    formatTimestamp, 
    formatDuration, 
    calculateRatio, 
    cleanName 
} from '../utils/analyzerUtils';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileExport } from '@fortawesome/free-solid-svg-icons/faFileExport';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons/faChevronDown';
import { faSave } from '@fortawesome/free-solid-svg-icons/faSave';

export function ShotFileInfo({ shot, onUpdate, onExport }) {
    const apiService = useContext(ApiServiceContext);
    const [expanded, setExpanded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [initialLoaded, setInitialLoaded] = useState(false);

    // Initial-State identisch mit GaggiMate ShotNotesCard
    const [notes, setNotes] = useState({
        id: shot?.id || '',
        rating: 0,
        beanType: '',
        doseIn: '',
        doseOut: '',
        ratio: '',
        grindSetting: '',
        balanceTaste: 'balanced',
        notes: '', 
    });

    const calcRatio = useCallback((doseIn, doseOut) => {
        if (doseIn && doseOut && parseFloat(doseIn) > 0 && parseFloat(doseOut) > 0) {
            return (parseFloat(doseOut) / parseFloat(doseIn)).toFixed(2);
        }
        return '';
    }, []);

    useEffect(() => {
        if (!shot) return;

        const loadNotes = async () => {
            // Standard structure shot_notes.json schema
            let base = {
                id: shot.id,
                rating: shot.rating || 0,
                beanType: '', doseIn: '', doseOut: '', ratio: '',
                grindSetting: '', balanceTaste: 'balanced', notes: '',
            };

            let sourceData = null;

            // 1. WebSocket (for GM-Shots)
            if (shot.source === 'gaggimate' && apiService?.socket?.readyState === 1) {
                try {
                    const response = await apiService.request({ tp: 'req:history:notes:get', id: shot.id });
                    if (response.notes) sourceData = response.notes;
                } catch (e) { console.warn("Analyzer: WS fetch failed"); }
            }

            // 2. Fallback to shot.notes (for Browser-Shots and Files-Import)
            if (!sourceData && shot.notes) {
                sourceData = shot.notes;
            }

            if (sourceData) {
                const parsed = typeof sourceData === 'string' ? JSON.parse(sourceData) : sourceData;
                // Merge
                base = { ...base, ...parsed };
                
                // Fix for double notes structure (had some problems with edited notes from other tools)
                if (base.notes && typeof base.notes === 'object') {
                    base.notes = base.notes.notes || "";
                }
            }

            // Dose Out
            if (!base.doseOut && shot.volume) {
                base.doseOut = shot.volume.toFixed(1);
            }
            base.ratio = calcRatio(base.doseIn, base.doseOut);
            
            // Security: notes must be a string
            base.notes = String(base.notes || "");

            setNotes(base);
            setInitialLoaded(true);
        };

        loadNotes();
    }, [shot?.id]);

    const handleInputChange = (field, value) => {
        setNotes(prev => {
            const next = { ...prev, [field]: value };
            if (field === 'doseIn' || field === 'doseOut') {
                next.ratio = calcRatio(next.doseIn, next.doseOut);
            }
            return next;
        });
        setHasChanges(true);
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            // Save via LibraryService (automatically handles GM vs. browser)
            await libraryService.saveNotes(shot.id, notes, shot.source || 'browser');
            
            // IMPORTANT: Update of the Shot object in the Analyzer
            // This ensures that the correct notes object is saved when you click on "Export"
            onUpdate({ ...shot, notes: notes, rating: notes.rating });
            
            setHasChanges(false);
        } catch (error) {
            console.error('Save failed:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!shot) return null;

    const profileLabel = typeof shot.profile === 'string' ? shot.profile : shot.profile?.label || "Manual Shot";

    return (
        <div className="bg-base-200/50 backdrop-blur-sm rounded-lg shadow-sm border border-base-content/5 mb-5 overflow-hidden">
            
            {/* --- HEADER --- */}
            <div 
                className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-base-content/5 select-none"
                onClick={() => setExpanded(!expanded)}
            >
                <div className={`text-primary transition-transform ${expanded ? 'rotate-180' : ''}`}>
                    <FontAwesomeIcon icon={faChevronDown} />
                </div>
                
                <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold truncate leading-tight">{cleanName(profileLabel)}</h3>
                    <div className="flex items-center gap-2 text-xs text-base-content/60 mt-1 font-medium">
                        {`#${shot.id}`} • {formatTimestamp(shot.timestamp)} • {formatDuration(shot.samples)}
                        {notes.doseIn && ` • ${notes.doseIn}g > ${notes.doseOut}g`}
                        {notes.rating > 0 && <span className="text-yellow-500"> • ★ {notes.rating}</span>}
                    </div>
                </div>
                
                <button onClick={(e) => { e.stopPropagation(); onExport(); }} className="btn btn-ghost btn-sm text-base-content/30">
                    <FontAwesomeIcon icon={faFileExport} />
                </button>
            </div>
            
            {/* --- EDITOR AREA --- */}
            {expanded && (
                <div className="px-5 py-6 border-t border-base-content/5 animate-fade-in bg-base-100/30">
                    {!initialLoaded ? (
                        <div className="flex justify-center py-8"><span className="loading loading-spinner loading-md"></span></div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                                {/* Rating */}
                                <div className="form-control">
                                    <label className="text-[10px] font-bold text-base-content/40 uppercase tracking-wider mb-2 px-1">Rating</label>
                                    <div className="flex gap-1 px-1">
                                        {[1,2,3,4,5].map(s => (
                                            <button key={s} onClick={() => handleInputChange('rating', s)} className={`text-xl ${s <= notes.rating ? 'text-yellow-500' : 'text-base-content/20'}`}>★</button>
                                        ))}
                                    </div>
                                </div>
                                <div className="form-control">
                                    <label className="text-[10px] font-bold text-base-content/40 uppercase tracking-wider mb-1 px-1">Bean Type</label>
                                    <input type="text" value={notes.beanType || ''} onInput={e => handleInputChange('beanType', e.target.value)} className="input input-bordered input-sm" />
                                </div>
                                <div className="form-control">
                                    <label className="text-[10px] font-bold text-base-content/40 uppercase tracking-wider mb-1 px-1">Dose In (g)</label>
                                    <input type="number" step="0.1" value={notes.doseIn || ''} onInput={e => handleInputChange('doseIn', e.target.value)} className="input input-bordered input-sm" />
                                </div>
                                <div className="form-control">
                                    <label className="text-[10px] font-bold text-base-content/40 uppercase tracking-wider mb-1 px-1">Dose Out (g)</label>
                                    <input type="number" step="0.1" value={notes.doseOut || ''} onInput={e => handleInputChange('doseOut', e.target.value)} className="input input-bordered input-sm" />
                                </div>
                            </div>

                            {/* Tasting Notes */}
                            <div className="form-control flex flex-col gap-1.5 mb-6">
                                <label className="text-[10px] font-bold text-base-content/40 uppercase tracking-wider px-1">
                                    Tasting Notes <span className="lowercase font-normal">({(notes.notes || "").length}/200)</span>
                                </label>
                                <textarea
                                    value={notes.notes || ""}
                                    onInput={e => handleInputChange('notes', e.target.value)}
                                    maxLength={200}
                                    rows="3"
                                    className="textarea textarea-bordered bg-base-100/50 text-sm w-full focus:textarea-primary"
                                    placeholder="Flavor, body, acidity..."
                                />
                            </div>

                            <div className="flex justify-end pt-4 border-t border-base-content/5">
                                <button onClick={handleSave} disabled={!hasChanges || loading} className={`btn btn-sm px-6 gap-2 ${hasChanges ? 'btn-primary shadow-md' : 'btn-ghost opacity-20'}`}>
                                    {loading ? <span className="loading loading-spinner loading-xs"></span> : <FontAwesomeIcon icon={faSave} />}
                                    {hasChanges ? 'Save Changes' : 'No Changes'}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}