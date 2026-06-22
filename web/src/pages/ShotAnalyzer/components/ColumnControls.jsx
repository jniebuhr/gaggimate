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
  ANALYZER_ACTION_GROUP_CLASSES,
  ANALYZER_ACTION_ICON_BUTTON_CLASS,
  ANALYZER_ACTION_ICON_CLASS,
  ANALYZER_ACTION_ICON_STYLE,
  getAnalyzerIconButtonClasses,
  getAnalyzerSurfaceTriggerClasses,
  getAnalyzerTextButtonClasses,
} from './analyzerControlStyles';

const BUILT_IN_PRESET_IDS = {
  ALL_METRICS: 'ALL_METRICS',
  SYSTEM_INFO: 'SYSTEM_INFO',
};

const TABLE_TOOLBAR_TEXT_BUTTON_CLASS =
  'h-8 min-h-0 px-3 text-sm font-normal tracking-normal normal-case !text-base-content/75 hover:!text-primary';
const TABLE_TOOLBAR_SELECT_CLASS =
  'h-8 min-h-0 w-[7rem] max-w-[7rem] appearance-none border-0 bg-transparent px-3 pr-7 text-sm font-normal tracking-normal normal-case shadow-none outline-none !text-base-content/75 hover:!text-primary';
const COLUMN_GROUP_HEADER_CLASS =
  'border-base-content/10 text-base-content col-span-2 mb-1.5 border-b pb-1 text-xs leading-tight font-medium tracking-normal normal-case';
const COLUMN_OPTION_TEXT_CLASS = 'text-base-content/90 leading-tight font-medium tracking-normal';

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

  const handleHeaderToggle = () => {
    setExpanded(prev => !prev);
  };

  const collapseControls = () => {
    setExpanded(false);
  };

  // Dynamic container styles
  const containerClasses = isIntegrated
    ? 'bg-base-100 rounded-t-lg border-b border-base-content/10'
    : 'bg-base-200/80 backdrop-blur-md rounded-xl shadow-sm border border-base-content/10 mb-5';

  return (
    <div
      className={`overflow-hidden transition-colors ${isIntegrated ? '' : '-mt-4 pt-4'} ${containerClasses}`}
    >
      {/* Header Bar - Toggle for Expand/Collapse */}
      <div
        className={`relative flex items-center justify-between gap-4 select-none ${isIntegrated ? 'py-2' : ''}`}
      >
        <button
          type='button'
          className='hover:bg-base-content/5 absolute inset-0 z-0 cursor-pointer rounded-md transition-colors duration-150'
          onClick={handleHeaderToggle}
          aria-label={expanded ? 'Collapse column settings' : 'Expand column settings'}
          aria-expanded={expanded}
        />
        {/* Left Side: Toggle & Controls */}
        <div className='pointer-events-none relative z-10 flex min-w-0 flex-1 items-center gap-2 sm:gap-4'>
          {/* Header Actions & Preset Selector */}
          <div className='pointer-events-auto flex items-center gap-2'>
            <div className={ANALYZER_ACTION_GROUP_CLASSES}>
              <button
                type='button'
                onClick={e => {
                  e.stopPropagation();
                  handleHeaderToggle();
                }}
                className={getAnalyzerIconButtonClasses({
                  className: ANALYZER_ACTION_ICON_BUTTON_CLASS,
                })}
                title={expanded ? 'Collapse column settings' : 'Expand column settings'}
                aria-label={expanded ? 'Collapse column settings' : 'Expand column settings'}
              >
                <FontAwesomeIcon
                  icon={expanded ? faMinus : faPlus}
                  className={ANALYZER_ACTION_ICON_CLASS}
                  style={ANALYZER_ACTION_ICON_STYLE}
                />
              </button>

              <button
                type='button'
                onClick={applyStandard}
                className={getAnalyzerTextButtonClasses({
                  className: `hidden sm:inline-flex ${TABLE_TOOLBAR_TEXT_BUTTON_CLASS}`,
                })}
              >
                Standard
              </button>

              <div className='relative flex h-8 min-h-0 items-center'>
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
                    className: TABLE_TOOLBAR_SELECT_CLASS,
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
                <span className='text-base-content/75 pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm'>
                  <FontAwesomeIcon icon={faChevronDown} />
                </span>
              </div>

              {selectedPresetId &&
                !Object.values(BUILT_IN_PRESET_IDS).includes(selectedPresetId) && (
                  <button
                    type='button'
                    onClick={deletePreset}
                    className={getAnalyzerIconButtonClasses({
                      tone: 'error',
                      className: ANALYZER_ACTION_ICON_BUTTON_CLASS,
                    })}
                    title='Delete preset'
                    aria-label='Delete preset'
                  >
                    <FontAwesomeIcon
                      icon={faTrashCan}
                      className={ANALYZER_ACTION_ICON_CLASS}
                      style={ANALYZER_ACTION_ICON_STYLE}
                    />
                  </button>
                )}
            </div>
          </div>
        </div>

        {/* Right Side: Injected Content (Zoom/Scroll) */}
        {headerChildren && (
          <div className='relative z-10 flex items-center gap-2'>{headerChildren}</div>
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
                <div key={groupKey} className='border-base-content/10 rounded-md border p-2.5'>
                  <div className='grid grid-cols-[minmax(0,1fr)_auto] gap-x-3'>
                    <h4 className={COLUMN_GROUP_HEADER_CLASS}>{groups[groupKey]}</h4>

                    <div className='min-w-0'>
                      <div className='space-y-1'>
                        {cols.map(col => (
                          <label
                            key={col.id}
                            className={getAnalyzerSurfaceTriggerClasses({
                              className:
                                'group !text-base-content flex cursor-pointer items-center gap-1.5 px-1 py-0.5 text-xs',
                            })}
                          >
                            <input
                              type='checkbox'
                              checked={activeColumns.has(col.id)}
                              onChange={e => toggleColumn(col.id, e.target.checked)}
                              className='checkbox checkbox-primary checkbox-xs border-base-content/20 rounded-sm'
                            />
                            <span className={COLUMN_OPTION_TEXT_CLASS}>
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

          {/* Control Footer */}
          <div className='border-base-content/10 relative -mx-4 mt-5 flex items-center justify-between border-t px-4 py-2.5'>
            <button
              type='button'
              className='hover:bg-base-content/5 absolute inset-0 z-0 cursor-pointer transition-colors duration-150'
              onClick={collapseControls}
              aria-label='Collapse column settings'
            />
            {/* Left Actions: Reset - Wrapped to stop propagation */}
            <div className='relative z-10 flex items-center gap-2'>
              <button
                type='button'
                onClick={applyFactoryReset}
                className={getAnalyzerTextButtonClasses({
                  tone: 'error',
                  className:
                    '!text-base-content/75 hover:!text-error h-8 min-h-0 gap-1.5 px-3 text-sm font-normal tracking-normal normal-case',
                })}
              >
                <FontAwesomeIcon icon={faUndo} /> Reset Defaults
              </button>
            </div>

            {/* Center Action: Close Indicator */}
            <button
              type='button'
              onClick={collapseControls}
              className={getAnalyzerIconButtonClasses({
                className: `relative z-10 ${ANALYZER_ACTION_ICON_BUTTON_CLASS}`,
              })}
              title='Collapse column settings'
              aria-label='Collapse column settings'
            >
              <FontAwesomeIcon icon={faMinus} />
            </button>

            {/* Right Actions: Save - Wrapped to stop propagation */}
            <div className='relative z-10 flex items-center gap-2'>
              <button
                type='button'
                onClick={saveAsStandard}
                className={getAnalyzerTextButtonClasses({
                  className: TABLE_TOOLBAR_TEXT_BUTTON_CLASS,
                })}
              >
                Save as Standard
              </button>
              <button
                type='button'
                onClick={saveAsPreset}
                className={getAnalyzerTextButtonClasses({
                  className: `border-base-content/10 bg-transparent shadow-none ${TABLE_TOOLBAR_TEXT_BUTTON_CLASS}`,
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
