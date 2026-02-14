/**
 * ColumnControls.jsx
 * UI component to toggle specific columns in the analysis table.
 */

import { useState, useEffect } from 'preact/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons/faChevronDown';
import { faChevronUp } from '@fortawesome/free-solid-svg-icons/faChevronUp'; // Added ChevronUp
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
  loadFromStorage,
} from '../utils/analyzerUtils';

export function ColumnControls({
  activeColumns,
  onColumnsChange,
  isIntegrated = false,
  headerChildren = null,
}) {
  const [expanded, setExpanded] = useState(false);
  const [presets, setPresets] = useState([]);
  const [selectedPresetId, setSelectedPresetId] = useState('');

  // Load custom presets on mount
  useEffect(() => {
    setPresets(loadFromStorage(ANALYZER_DB_KEYS.PRESETS, []));
  }, []);

  const groupedColumns = getGroupedColumns();

  /**
   * Toggle individual column visibility
   */
  const toggleColumn = (columnId, checked) => {
    const newColumns = new Set(activeColumns);
    checked ? newColumns.add(columnId) : newColumns.delete(columnId);
    onColumnsChange(newColumns);

    // Reset preset selection if manual changes are made
    if (selectedPresetId) setSelectedPresetId('');
  };

  // --- Action Handlers ---

  const applyStandard = e => {
    e.stopPropagation(); // Prevent closing if called from header
    const userStandard = loadFromStorage(ANALYZER_DB_KEYS.USER_STANDARD);
    onColumnsChange(userStandard ? new Set(userStandard) : getDefaultColumns());
    setSelectedPresetId('');
  };

  const applyAll = () => {
    onColumnsChange(getAllColumns());
    setSelectedPresetId('ALL_METRICS');
  };

  const applyFactoryReset = () => {
    if (confirm('Reset columns to system defaults?')) {
      onColumnsChange(getDefaultColumns());
      setSelectedPresetId('');
    }
  };

  const saveAsStandard = () => {
    if (!confirm("Save current selection as your new 'Standard'?")) return;
    saveToStorage(ANALYZER_DB_KEYS.USER_STANDARD, Array.from(activeColumns));
  };

  const saveAsPreset = () => {
    const name = prompt('Name for new Preset:');
    if (!name) return;
    const newPreset = { id: Date.now().toString(), name, columns: Array.from(activeColumns) };
    const updated = [...presets, newPreset];
    setPresets(updated);
    saveToStorage(ANALYZER_DB_KEYS.PRESETS, updated);
    setSelectedPresetId(newPreset.id);
  };

  const deletePreset = e => {
    e.stopPropagation();
    if (!selectedPresetId || selectedPresetId === 'ALL_METRICS') return;
    if (!confirm('Delete this preset?')) return;
    const updated = presets.filter(p => p.id !== selectedPresetId);
    setPresets(updated);
    saveToStorage(ANALYZER_DB_KEYS.PRESETS, updated);
    applyStandard(e); // Reset to standard after delete
  };

  /**
   * Helper to format detailed technical labels
   */
  const getDetailedLabel = col => {
    let suffix = '';
    if (col.type === 'se') suffix = ' Start/End';
    else if (col.type === 'mm') suffix = ' Min/Max';
    else if (col.type === 'avg') suffix = ' Avg (tw)';
    return col.label + suffix;
  };

  // Dynamic container styles
  const containerClasses = isIntegrated
    ? 'bg-base-200 rounded-t-lg border-b border-base-content/10'
    : 'bg-base-200/80 backdrop-blur-md rounded-lg shadow-sm border border-base-content/10 mb-5';

  return (
    <div className={`overflow-hidden transition-colors ${containerClasses}`}>
      {/* Header Bar - Toggle for Expand/Collapse */}
      <div
        className='hover:bg-base-content/5 flex min-h-[42px] cursor-pointer items-center justify-between gap-4 px-4 py-2 select-none'
        onClick={() => setExpanded(!expanded)}
      >
        {/* Left Side: Toggle & Controls */}
        <div className='flex min-w-0 flex-1 items-center gap-4'>
          <div
            className={`text-primary text-xs transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
          >
            <FontAwesomeIcon icon={faChevronDown} />
          </div>

          <div className='text-base-content truncate text-xs font-bold tracking-wider uppercase'>
            Column Configuration
          </div>

          {/* Header Actions & Preset Selector */}
          <div className='flex items-center gap-2' onClick={e => e.stopPropagation()}>
            <button
              onClick={applyStandard}
              className='btn btn-ghost btn-xs hidden h-6 min-h-0 text-[10px] font-bold tracking-wider uppercase sm:inline-flex'
            >
              Standard
            </button>

            <select
              value={selectedPresetId}
              onChange={e => {
                const val = e.target.value;
                if (val === 'ALL_METRICS') {
                  applyAll();
                } else {
                  const p = presets.find(x => x.id === val);
                  if (p) {
                    onColumnsChange(new Set(p.columns));
                    setSelectedPresetId(p.id);
                  }
                }
              }}
              onClick={e => e.stopPropagation()}
              className='select select-bordered select-xs bg-base-100/50 h-6 min-h-0 text-[10px] font-bold'
            >
              <option value='' disabled>
                Presets...
              </option>
              <option value='ALL_METRICS'>All Metrics</option>
              <option disabled>──────────</option>
              {presets.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {selectedPresetId && selectedPresetId !== 'ALL_METRICS' && (
              <button
                onClick={deletePreset}
                className='btn btn-ghost btn-xs text-error/60 hover:text-error h-6 min-h-0'
              >
                <FontAwesomeIcon icon={faTrash} />
              </button>
            )}
          </div>
        </div>

        {/* Right Side: Injected Content (Zoom/Scroll) */}
        {headerChildren && (
          <div className='flex items-center gap-2' onClick={e => e.stopPropagation()}>
            {headerChildren}
          </div>
        )}
      </div>

      {/* Expandable Selection Area */}
      {expanded && (
        <div className='border-base-content/10 animate-fade-in bg-base-100/50 border-t border-b px-5 pt-6 pb-6'>
          <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4'>
            {Object.keys(groupedColumns).map(groupKey => {
              const cols = groupedColumns[groupKey];
              const colors = groupColors[groupKey] || groupColors.basics;

              return (
                <div
                  key={groupKey}
                  className="rounded-md p-3 bg-base-200 border-t-2"
                  style={{ borderColor: colors.anchor }}
                >
                  <h4 className={`mb-2 border-b border-base-content/10 pb-1 text-[10px] font-bold tracking-wider uppercase ${colors.text}`}>
                    {groups[groupKey]}
                  </h4>

                  <div className='space-y-1.5'>
                    {cols.map(col => (
                      <label key={col.id} className="group flex cursor-pointer items-start gap-2 text-xs">
                        <input
                          type='checkbox'
                          checked={activeColumns.has(col.id)}
                          onChange={e => toggleColumn(col.id, e.target.checked)}
                          className="checkbox checkbox-xs mt-0.5 rounded-sm"
                          style={{ 
                            backgroundColor: activeColumns.has(col.id) ? colors.anchor : 'transparent',
                            borderColor: activeColumns.has(col.id) ? colors.anchor : 'currentColor'
                          }}
                        />
                        <span className={`leading-tight font-bold ${activeColumns.has(col.id) ? colors.text : 'text-base-content'}`}>
                          {getDetailedLabel(col)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Control Footer - Clickable to Close */}
          <div
            className='border-base-content/10 hover:bg-base-content/5 group -mx-5 mt-6 flex cursor-pointer items-center justify-between border-t px-5 py-3 transition-colors'
            onClick={() => setExpanded(false)}
            title='Click to collapse'
          >
            {/* Left Actions: Reset - Wrapped to stop propagation */}
            <div className='flex gap-2' onClick={e => e.stopPropagation()}>
              <button
                onClick={applyFactoryReset}
                className='btn btn-xs btn-ghost text-base-content/60 hover:text-error gap-1 text-[10px] font-bold uppercase'
              >
                <FontAwesomeIcon icon={faUndo} /> Reset Defaults
              </button>
            </div>

            {/* Center Action: Close Indicator */}
            <div className='text-base-content/20 group-hover:text-primary text-xs transition-colors'>
              <FontAwesomeIcon icon={faChevronUp} />
            </div>

            {/* Right Actions: Save - Wrapped to stop propagation */}
            <div className='flex gap-2' onClick={e => e.stopPropagation()}>
              <button
                onClick={saveAsStandard}
                className='btn btn-xs btn-ghost text-base-content/60 hover:text-base-content text-[10px] font-bold uppercase'
              >
                Save as Standard
              </button>
              <button
                onClick={saveAsPreset}
                className='btn btn-xs btn-outline btn-primary text-[10px]'
              >
                Save as New Preset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}