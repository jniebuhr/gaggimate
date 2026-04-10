/**
 * ColumnControls.jsx
 * UI component to toggle specific columns in the analysis table.
 */

import { useState, useEffect } from 'preact/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { faMinus } from '@fortawesome/free-solid-svg-icons/faMinus';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons/faChevronDown';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons/faTrashCan';
import { faUndo } from '@fortawesome/free-solid-svg-icons/faUndo';
import {
  ANALYZER_DB_KEYS,
  groups,
  getGroupedColumns,
  getDefaultColumns,
  getAllColumns,
  getColumnsByGroup,
  saveToStorage,
  loadFromStorage,
} from '../utils/analyzerUtils';
import { getAnalyzerGroupCardVisuals } from './analyzerGroupVisuals';
import {
  ANALYZER_COMPACT_CONTROL_HEIGHT_CLASS,
  ANALYZER_COMPACT_ICON_BUTTON_CLASS,
  ANALYZER_COMPACT_SEGMENTED_GROUP_CLASSES,
  getAnalyzerIconButtonClasses,
  getAnalyzerSurfaceTriggerClasses,
  getAnalyzerTextButtonClasses,
} from './analyzerControlStyles';

const BUILT_IN_PRESET_IDS = {
  ALL_METRICS: 'ALL_METRICS',
  SYSTEM_INFO: 'SYSTEM_INFO',
};

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
    setSelectedPresetId(BUILT_IN_PRESET_IDS.ALL_METRICS);
  };

  const applySystemInfo = () => {
    onColumnsChange(getColumnsByGroup('system'));
    setSelectedPresetId(BUILT_IN_PRESET_IDS.SYSTEM_INFO);
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
    if (!selectedPresetId || Object.values(BUILT_IN_PRESET_IDS).includes(selectedPresetId)) return;
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
    ? 'bg-base-100 rounded-t-lg border-b border-base-content/10'
    : 'bg-base-200/80 backdrop-blur-md rounded-lg shadow-sm border border-base-content/10 mb-5';

  return (
    <div className={`overflow-hidden transition-colors ${containerClasses}`}>
      {/* Header Bar - Toggle for Expand/Collapse */}
      <div
        className={getAnalyzerSurfaceTriggerClasses({
          className:
            'flex min-h-[42px] cursor-pointer items-center justify-between gap-4 px-4 py-2 select-none',
        })}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Left Side: Toggle & Controls */}
        <div className='flex min-w-0 flex-1 items-center gap-2 sm:gap-4'>
          {/* Header Actions & Preset Selector */}
          <div className='flex items-center gap-2'>
            <div className={ANALYZER_COMPACT_SEGMENTED_GROUP_CLASSES}>
              <button
                type='button'
                onClick={e => {
                  e.stopPropagation();
                  setExpanded(prev => !prev);
                }}
                className={getAnalyzerIconButtonClasses({
                  className: `btn btn-ghost btn-xs ${ANALYZER_COMPACT_ICON_BUTTON_CLASS} px-0 text-xs`,
                })}
                title={expanded ? 'Collapse column settings' : 'Expand column settings'}
                aria-label={expanded ? 'Collapse column settings' : 'Expand column settings'}
              >
                <FontAwesomeIcon icon={expanded ? faMinus : faPlus} />
              </button>

              <button
                onClick={applyStandard}
                className={getAnalyzerTextButtonClasses({
                  className: `btn btn-ghost btn-xs hidden ${ANALYZER_COMPACT_CONTROL_HEIGHT_CLASS} rounded-none px-3 text-[10px] font-bold tracking-normal normal-case sm:inline-flex`,
                })}
              >
                Standard
              </button>

              <div
                className={`relative flex ${ANALYZER_COMPACT_CONTROL_HEIGHT_CLASS} items-center`}
              >
                <select
                  value={selectedPresetId}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === BUILT_IN_PRESET_IDS.ALL_METRICS) {
                      applyAll();
                    } else if (val === BUILT_IN_PRESET_IDS.SYSTEM_INFO) {
                      applySystemInfo();
                    } else {
                      const p = presets.find(x => x.id === val);
                      if (p) {
                        onColumnsChange(new Set(p.columns));
                        setSelectedPresetId(p.id);
                      }
                    }
                  }}
                  onClick={e => e.stopPropagation()}
                  className={getAnalyzerSurfaceTriggerClasses({
                    className: `${ANALYZER_COMPACT_CONTROL_HEIGHT_CLASS} w-[6rem] max-w-[6rem] appearance-none rounded-none border-0 bg-transparent px-3 pr-6 text-[10px] font-bold tracking-normal normal-case shadow-none outline-none`,
                  })}
                >
                  <option value='' disabled>
                    Presets...
                  </option>
                  <option value={BUILT_IN_PRESET_IDS.ALL_METRICS}>All Metrics</option>
                  <option value={BUILT_IN_PRESET_IDS.SYSTEM_INFO}>System Info</option>
                  <option disabled>──────────</option>
                  {presets.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <span className='text-base-content/60 pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[10px]'>
                  <FontAwesomeIcon icon={faChevronDown} />
                </span>
              </div>

              {selectedPresetId &&
                !Object.values(BUILT_IN_PRESET_IDS).includes(selectedPresetId) && (
                  <button
                    onClick={deletePreset}
                    className={getAnalyzerIconButtonClasses({
                      tone: 'error',
                      className: `btn btn-ghost btn-xs ${ANALYZER_COMPACT_ICON_BUTTON_CLASS} px-0`,
                    })}
                    title='Delete preset'
                    aria-label='Delete preset'
                  >
                    <FontAwesomeIcon icon={faTrashCan} />
                  </button>
                )}
            </div>
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
        <div className='border-base-content/10 animate-fade-in bg-base-100/50 border-t border-b px-4 pt-5 pb-5'>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4'>
            {Object.keys(groupedColumns).map(groupKey => {
              const cols = groupedColumns[groupKey];
              const groupVisuals = getAnalyzerGroupCardVisuals(groupKey);

              return (
                <div
                  key={groupKey}
                  className='bg-base-200 border-base-content/10 rounded-md border p-2.5'
                >
                  <div className='grid grid-cols-[minmax(0,1fr)_auto] gap-x-3'>
                    <h4 className='border-base-content/10 text-base-content/85 col-span-2 mb-1.5 border-b pb-1 text-[9px] leading-tight font-bold tracking-normal normal-case'>
                      {groups[groupKey]}
                    </h4>

                    <div className='min-w-0'>
                      <div className='space-y-1'>
                        {cols.map(col => (
                          <label
                            key={col.id}
                            className={getAnalyzerSurfaceTriggerClasses({
                              className:
                                'group flex cursor-pointer items-center gap-1.5 px-1 py-0.5 text-[10px]',
                            })}
                          >
                            <input
                              type='checkbox'
                              checked={activeColumns.has(col.id)}
                              onChange={e => toggleColumn(col.id, e.target.checked)}
                              className='checkbox checkbox-xs border-base-content/20 text-base-content/55 rounded-sm'
                            />
                            <span
                              className={`leading-tight font-semibold ${activeColumns.has(col.id) ? 'text-base-content' : 'text-base-content/75'}`}
                            >
                              {getDetailedLabel(col)}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div
                      className={`flex shrink-0 items-center justify-center self-center ${groupVisuals.length > 1 ? 'flex-col gap-1.5' : ''}`}
                    >
                      {groupVisuals.map((groupVisual, index) => (
                        <span
                          key={`${groupKey}-${index}`}
                          className='inline-flex items-center justify-center leading-none'
                          style={{ color: groupVisual.color, lineHeight: 0 }}
                        >
                          <FontAwesomeIcon
                            icon={groupVisual.icon}
                            className={
                              groupVisuals.length > 1
                                ? 'text-[0.95rem]'
                                : 'text-[1.25rem] sm:text-[1.45rem]'
                            }
                          />
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Control Footer - Clickable to Close */}
          <div
            className={getAnalyzerSurfaceTriggerClasses({
              className:
                'border-base-content/10 group -mx-4 mt-5 flex cursor-pointer items-center justify-between border-t px-4 py-2.5',
            })}
            onClick={() => setExpanded(false)}
            title='Click to collapse'
          >
            {/* Left Actions: Reset - Wrapped to stop propagation */}
            <div className='flex items-center gap-2'>
              <button
                type='button'
                onClick={applyFactoryReset}
                onClickCapture={e => e.stopPropagation()}
                className={getAnalyzerTextButtonClasses({
                  tone: 'error',
                  className: `btn btn-ghost btn-xs ${ANALYZER_COMPACT_CONTROL_HEIGHT_CLASS} gap-1 px-3 text-[10px] font-bold tracking-normal normal-case`,
                })}
              >
                <FontAwesomeIcon icon={faUndo} /> Reset Defaults
              </button>
            </div>

            {/* Center Action: Close Indicator */}
            <div className='text-base-content/30 group-hover:text-primary text-xs transition-colors'>
              <FontAwesomeIcon icon={faMinus} />
            </div>

            {/* Right Actions: Save - Wrapped to stop propagation */}
            <div className='flex items-center gap-2'>
              <button
                type='button'
                onClick={saveAsStandard}
                onClickCapture={e => e.stopPropagation()}
                className={getAnalyzerTextButtonClasses({
                  className: `btn btn-ghost btn-xs ${ANALYZER_COMPACT_CONTROL_HEIGHT_CLASS} px-3 text-[10px] font-bold tracking-normal normal-case`,
                })}
              >
                Save as Standard
              </button>
              <button
                type='button'
                onClick={saveAsPreset}
                onClickCapture={e => e.stopPropagation()}
                className={getAnalyzerTextButtonClasses({
                  className: `btn btn-ghost btn-xs ${ANALYZER_COMPACT_CONTROL_HEIGHT_CLASS} border-base-content/10 bg-transparent px-3 text-[10px] font-bold tracking-normal normal-case shadow-none`,
                })}
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
