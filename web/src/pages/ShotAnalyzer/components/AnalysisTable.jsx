/**
 * AnalysisTable.jsx
 * * Displays detailed shot analysis broken down by phase.
 * * Features:
 * - Integrated Column Controls (Top Toolbar)
 * - Horizontal scrolling (hidden scrollbars)
 * - Auto-adaptive theme colors
 * - Predictive scale values and target comparisons
 * - Integrated Zoom Controls (Font Size scaling)
 */

import { useState, useRef, useEffect } from 'preact/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faAngleRight,
  faAngleDoubleRight,
  faArrowRight,
  faAngleLeft,
  faAngleDoubleLeft,
  faArrowLeft,
  faExclamationTriangle,
  faCalculator,
  faMagnifyingGlassMinus,
  faMagnifyingGlassPlus,
  faCheck,
  faTimes,
} from '@fortawesome/free-solid-svg-icons';
import { columnConfig, groupColors } from '../utils/analyzerUtils';
import { ColumnControls } from './ColumnControls'; // Import ColumnControls

/**
 * Main Table Component
 */
export function AnalysisTable({
  results,
  activeColumns,
  onColumnsChange,
  settings,
  onSettingsChange,
  onAnalyze,
}) {
  if (!results || !results.phases) return null;

  // State for Table Zoom (Font Size) - Default 11px
  const [tableFontSize, setTableFontSize] = useState(11);

  const tableContainerRef = useRef(null);
  const safeSettings = settings || { scaleDelay: 1000, sensorDelay: 200, autoDelay: true };
  const visibleColumns = columnConfig.filter(col => activeColumns.has(col.id));

  // --- Helper Functions ---

  const scrollTable = amount => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  const scrollToBound = direction => {
    if (tableContainerRef.current) {
      const left = direction === 'start' ? 0 : tableContainerRef.current.scrollWidth;
      tableContainerRef.current.scrollTo({ left, behavior: 'smooth' });
    }
  };

  const handleZoom = direction => {
    setTableFontSize(prev => {
      if (direction === 'in') return Math.min(16, prev + 1); // Max 16px
      if (direction === 'out') return Math.max(8, prev - 1); // Min 8px
      return prev;
    });
  };

  // --- SCROLL TRAP FIX ---
  // Listen for wheel events. If scrolling strictly vertical, and the table handles X-scroll,
  // manually scroll the window to prevent "locking".
  useEffect(() => {
    const el = tableContainerRef.current;
    if (!el) return;

    const handleWheel = e => {
      // Check if vertical scrolling dominates
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        // Manually scroll the window
        window.scrollBy({
          top: e.deltaY,
          left: 0,
          behavior: 'auto', // Instant scroll to feel native
        });
      }
    };

    // Passive: true allows performance, but we rely on manual window scrolling
    el.addEventListener('wheel', handleWheel, { passive: true });

    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  const getHeaderLabel = col => {
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
    scrollbarWidth: 'none' /* Firefox */,
    msOverflowStyle: 'none' /* IE / Edge */,
  };

  return (
    <div className='mt-6 flex w-full flex-col'>
      {/* Inject CSS to hide Webkit Scrollbars */}
      <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
            `}</style>

      {/* 1. Status Badges (Outside the main card) */}
      <div className='mb-2 flex flex-wrap gap-2 px-1'>
        {results.isBrewByWeight ? (
          <StatusBadge
            label='BREW BY WEIGHT'
            colorClass='bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20'
          />
        ) : (
          <StatusBadge
            label='BREW BY TIME'
            colorClass='bg-base-content/5 text-base-content/60 border-base-content/10'
          />
        )}
        {results.globalScaleLost && (
          <StatusBadge
            label='SCALE LOST'
            colorClass='bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
          />
        )}
        {results.isAutoAdjusted && (
          <StatusBadge
            label='AUTO-DELAY'
            colorClass='bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
          />
        )}
      </div>

      {/* 2. MAIN CARD WRAPPER */}
      <div className='bg-base-100 border-base-content/10 flex flex-col rounded-lg border shadow-sm'>
        {/* A. Top Toolbar: Column Controls + Actions (Zoom/Scroll) */}
        <ColumnControls
          activeColumns={activeColumns}
          onColumnsChange={onColumnsChange}
          isIntegrated={true}
          headerChildren={
            // Navigation & Zoom Group Injected into ColumnControls Header
            <div className='flex items-center gap-2'>
              {/* Zoom Controls */}
              <div className='bg-base-content/5 border-base-content/5 flex items-center gap-1 rounded border p-0.5'>
                <ScrollBtn
                  icon={faMagnifyingGlassMinus}
                  onClick={() => handleZoom('out')}
                  title='Zoom Out'
                  className={tableFontSize <= 8 ? 'opacity-20' : ''}
                />
                <span className='w-4 text-center font-mono text-[9px] opacity-40 select-none'>
                  {tableFontSize}
                </span>
                <ScrollBtn
                  icon={faMagnifyingGlassPlus}
                  onClick={() => handleZoom('in')}
                  title='Zoom In'
                  className={tableFontSize >= 16 ? 'opacity-20' : ''}
                />
              </div>

              {/* Scroll Controls */}
              <div className='bg-base-content/5 border-base-content/5 flex hidden items-center gap-1 rounded border p-0.5 sm:flex'>
                <ScrollBtn icon={faArrowLeft} onClick={() => scrollToBound('start')} />
                <ScrollBtn icon={faAngleDoubleLeft} onClick={() => scrollTable(-300)} />
                <ScrollBtn
                  icon={faAngleLeft}
                  onClick={() => scrollTable(-100)}
                  className='mr-1 rounded-r-none'
                />
                <ScrollBtn
                  icon={faAngleRight}
                  onClick={() => scrollTable(100)}
                  className='rounded-l-none'
                />
                <ScrollBtn icon={faAngleDoubleRight} onClick={() => scrollTable(300)} />
                <ScrollBtn icon={faArrowRight} onClick={() => scrollToBound('end')} />
              </div>
            </div>
          }
        />

        {/* B. Table Container (Middle) */}
        <div
          ref={tableContainerRef}
          // FIX: overflow-y-hidden prevents the browser from thinking "I can scroll Y internally"
          // removed 'overscroll-*' classes to prevent latching
          className='no-scrollbar block h-auto min-h-0 w-full touch-pan-y overflow-x-auto overflow-y-hidden'
          style={{ scrollBehavior: 'smooth', ...scrollbarHideStyle }}
        >
          {/* Dynamic Font Size applied to Table */}
          <table
            className='text-base-content w-full border-collapse transition-all duration-200'
            style={{ fontSize: `${tableFontSize}px`, lineHeight: '1.4' }}
          >
            <thead>
              <tr className='bg-base-200 border-base-content/10 border-b-2'>
                <th className='bg-base-content/5 border-base-content/5 w-8 border-r py-2 text-center opacity-40'>
                  #
                </th>
                <th className='bg-base-content/5 border-base-content/5 min-w-[120px] border-r px-2 py-2 text-left font-bold tracking-tighter whitespace-nowrap uppercase opacity-60'>
                  Phase
                </th>
                {visibleColumns.map(col => {
                  const colors = groupColors[col.group] || groupColors.basics;
                  return (
                    <th
                      key={col.id}
                      className={`px-3 py-2 text-right font-bold whitespace-nowrap ${colors.bg} ${colors.text} border-base-content/5 border-l tracking-tighter uppercase`}
                    >
                      {getHeaderLabel(col)}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {results.phases.map((phase, idx) => (
                <tr
                  key={idx}
                  className='border-base-content/5 hover:bg-base-content/5 group border-b align-top transition-colors'
                >
                  <td className='bg-base-content/5 border-base-content/5 border-r pt-2.5 text-center font-bold opacity-20 select-none'>
                    {idx + 1}
                  </td>
                  <td className='bg-base-content/5 border-base-content/5 border-r px-2 py-2 text-left whitespace-nowrap'>
                    <div className='mb-0.5 leading-none font-bold text-orange-600/90 dark:text-orange-400'>
                      {phase.displayName}
                    </div>
                    {phase.exit?.reason && (
                      <div
                        className='font-bold tracking-tight uppercase opacity-30'
                        style={{ fontSize: '0.85em' }}
                      >
                        via {phase.exit.reason}
                      </div>
                    )}
                  </td>
                  {visibleColumns.map(col => (
                    <td
                      key={col.id}
                      className='border-base-content/5 border-l px-3 py-2 text-right font-mono whitespace-nowrap tabular-nums'
                    >
                      <CellContent phase={phase} col={col} results={results} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>

            <tfoot className='bg-base-200 border-base-content/10 text-base-content border-t-2 font-bold'>
              <tr>
                <td className='bg-base-content/5 border-base-content/5 border-r'></td>
                <td className='bg-base-content/5 border-base-content/5 border-r px-2 py-2 text-left tracking-wider uppercase opacity-60'>
                  Total
                </td>
                {visibleColumns.map(col => (
                  <td
                    key={col.id}
                    className='border-base-content/5 border-l px-3 py-2 text-right font-mono tabular-nums'
                  >
                    <CellContent phase={null} col={col} results={results} isTotal={true} />
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>

        {/* C. New Footer: Delay Settings (Left) & Legend (Right) */}
        <div className='bg-base-100 border-base-content/10 flex flex-wrap items-center justify-between gap-4 rounded-b-lg border-t px-4 py-3 text-[10px] font-bold tracking-wider uppercase'>
          {/* Left: Latency Inputs */}
          <div className='flex items-center gap-4'>
            <span className='hidden opacity-40 select-none sm:inline'>Latency</span>
            <div className='flex items-center gap-2'>
              {/* Shows Average Symbol ∅ if auto-delay is active */}
              <span className='opacity-60'>Scale{safeSettings.autoDelay ? ' ∅' : ''}</span>
              <input
                type='number'
                step='50'
                value={
                  safeSettings.autoDelay && results?.usedSettings
                    ? results.usedSettings.scaleDelayMs
                    : safeSettings.scaleDelay
                }
                disabled={safeSettings.autoDelay}
                onInput={e => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val)) onSettingsChange({ ...safeSettings, scaleDelay: val });
                }}
                className='bg-base-200 border-base-content/10 focus:border-primary text-base-content h-5 w-12 rounded border text-center font-mono focus:outline-none disabled:opacity-30'
              />
              <span className='font-normal lowercase opacity-40'>ms</span>
            </div>
            <div className='bg-base-content/10 mx-1 h-3 w-px'></div>
            <div className='flex items-center gap-2'>
              {/* Shows Average Symbol ∅ if auto-delay is active */}
              <span className='opacity-60'>System{safeSettings.autoDelay ? ' ∅' : ''}</span>
              <input
                type='number'
                step='50'
                value={
                  safeSettings.autoDelay && results?.usedSettings
                    ? results.usedSettings.sensorDelayMs
                    : safeSettings.sensorDelay
                }
                disabled={safeSettings.autoDelay}
                onInput={e => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val)) onSettingsChange({ ...safeSettings, sensorDelay: val });
                }}
                className='bg-base-200 border-base-content/10 focus:border-primary text-base-content h-5 w-12 rounded border text-center font-mono focus:outline-none disabled:opacity-30'
              />
              <span className='font-normal lowercase opacity-40'>ms</span>
              <label className='hover:text-primary ml-2 flex cursor-pointer items-center gap-1.5 transition-colors'>
                <input
                  type='checkbox'
                  checked={safeSettings.autoDelay}
                  onChange={e => onSettingsChange({ ...safeSettings, autoDelay: e.target.checked })}
                  className='checkbox checkbox-xs border-base-content/30 rounded-sm'
                />
                <span className='opacity-60'>Auto</span>
              </label>
            </div>
          </div>

          {/* Right: Legend */}
          <div className='text-base-content/40 flex gap-4 select-none'>
            <span>∅ Avg (Time Weighted)</span>
            <span>S/E Start/End</span>
            <span>Range Min/Max</span>
          </div>
        </div>
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
  const sf = (v, d = 1) => (v != null && isFinite(v) ? v.toFixed(d) : '-');

  // Helper for Boolean Status rendering
  const renderBool = val => {
    if (val === true) return <FontAwesomeIcon icon={faCheck} className='text-success opacity-80' />;
    if (val === false) return <FontAwesomeIcon icon={faTimes} className='text-base-content/20' />; // Or faMinus
    return <span className='opacity-20'>-</span>;
  };

  let mainValue = '-';
  let unit = '';
  let isBoolean = false;
  let booleanContent = null;

  // FORMATTED: Multi-line switch case as requested
  switch (col.id) {
    case 'duration':
      mainValue = sf(data.duration);
      unit = 's';
      break;
    case 'water':
      mainValue = sf(data.water);
      unit = 'ml';
      break;
    case 'weight':
      mainValue = sf(data.weight);
      unit = 'g';
      break;

    // Pressure
    case 'p_se':
      mainValue = `${sf(stats?.p?.start)}/${sf(stats?.p?.end)}`;
      break;
    case 'p_mm':
      mainValue = `${sf(stats?.p?.min)}/${sf(stats?.p?.max)}`;
      break;
    case 'p_avg':
      mainValue = sf(stats?.p?.avg);
      unit = 'bar';
      break;

    // Target Pressure
    case 'tp_se':
      mainValue = `${sf(stats?.tp?.start)}/${sf(stats?.tp?.end)}`;
      break;
    case 'tp_mm':
      mainValue = `${sf(stats?.tp?.min)}/${sf(stats?.tp?.max)}`;
      break;
    case 'tp_avg':
      mainValue = sf(stats?.tp?.avg);
      unit = 'bar';
      break;

    // Flow
    case 'f_se':
      mainValue = `${sf(stats?.f?.start)}/${sf(stats?.f?.end)}`;
      break;
    case 'f_mm':
      mainValue = `${sf(stats?.f?.min)}/${sf(stats?.f?.max)}`;
      break;
    case 'f_avg':
      mainValue = sf(stats?.f?.avg);
      unit = 'ml/s';
      break;

    // Target Flow
    case 'tf_se':
      mainValue = `${sf(stats?.tf?.start)}/${sf(stats?.tf?.end)}`;
      break;
    case 'tf_mm':
      mainValue = `${sf(stats?.tf?.min)}/${sf(stats?.tf?.max)}`;
      break;
    case 'tf_avg':
      mainValue = sf(stats?.tf?.avg);
      unit = 'ml/s';
      break;

    // Puck Flow
    case 'pf_se':
      mainValue = `${sf(stats?.pf?.start)}/${sf(stats?.pf?.end)}`;
      break;
    case 'pf_mm':
      mainValue = `${sf(stats?.pf?.min)}/${sf(stats?.pf?.max)}`;
      break;
    case 'pf_avg':
      mainValue = sf(stats?.pf?.avg);
      unit = 'ml/s';
      break;

    // Temperature
    case 't_se':
      mainValue = `${sf(stats?.t?.start)}/${sf(stats?.t?.end)}`;
      break;
    case 't_mm':
      mainValue = `${sf(stats?.t?.min)}/${sf(stats?.t?.max)}`;
      break;
    case 't_avg':
      mainValue = sf(stats?.t?.avg);
      unit = '°';
      break;

    // Target Temperature
    case 'tt_se':
      mainValue = `${sf(stats?.tt?.start)}/${sf(stats?.tt?.end)}`;
      break;
    case 'tt_mm':
      mainValue = `${sf(stats?.tt?.min)}/${sf(stats?.tt?.max)}`;
      break;
    case 'tt_avg':
      mainValue = sf(stats?.tt?.avg);
      unit = '°';
      break;

    // Weight Details
    case 'w_se':
      mainValue = `${sf(stats?.w?.start)}/${sf(stats?.w?.end)}`;
      break;
    case 'w_mm':
      mainValue = `${sf(stats?.w?.min)}/${sf(stats?.w?.max)}`;
      break;
    case 'w_avg':
      mainValue = sf(stats?.w?.avg);
      unit = 'g';
      break;

    // --- System Info (Mapped from AnalyzerService stats) ---
    case 'sys_raw':
      mainValue = stats?.sys_raw !== undefined ? stats.sys_raw : '-';
      break;
    case 'sys_shot_vol':
      isBoolean = true;
      booleanContent = renderBool(stats?.sys_shot_vol);
      break;
    case 'sys_curr_vol':
      isBoolean = true;
      booleanContent = renderBool(stats?.sys_curr_vol);
      break;
    case 'sys_scale':
      isBoolean = true;
      booleanContent = renderBool(stats?.sys_scale);
      break;
    case 'sys_vol_avail':
      isBoolean = true;
      booleanContent = renderBool(stats?.sys_vol_avail);
      break;
    case 'sys_ext':
      isBoolean = true;
      booleanContent = renderBool(stats?.sys_ext);
      break;

    default:
      mainValue = '-';
  }

  if (isTotal) {
    if (isBoolean) return <div className='flex justify-end'>{booleanContent}</div>;
    return (
      <span>
        {mainValue}
        {unit}
      </span>
    );
  }

  const isHit = phase.exit?.type === col.targetType;
  const isWeightCol = col.id === 'weight';

  let targetDisplay = null;
  let predictionDisplay = null;
  let warningDisplay = null;

  // Relative font sizing for sub-elements (0.85em) ensures they scale with zoom
  const subTextSize = { fontSize: '0.85em' };
  const iconSize = { fontSize: '0.8em' };

  // Duration Target Display
  // If the phase has a duration target defined in the profile, show it always.
  if (col.id === 'duration' && phase.profilePhase && phase.profilePhase.duration > 0) {
    const targetVal = phase.profilePhase.duration;
    const diff = data.duration - targetVal;
    const diffSign = diff > 0 ? '+' : '';
    const diffColor = Math.abs(diff) < 0.5 ? 'text-success' : 'text-base-content/40';

    targetDisplay = (
      <div style={subTextSize} className='mt-0.5 leading-tight whitespace-nowrap opacity-80'>
        <span className='opacity-50'>Target:</span> {targetVal}s
        <span className={`ml-1 font-bold ${diffColor}`}>
          ({diffSign}
          {diff.toFixed(1)})
        </span>
      </div>
    );
  }

  if (phase.profilePhase && phase.profilePhase.targets && col.targetType) {
    const target = phase.profilePhase.targets.find(t => {
      if (col.id === 'weight') return t.type === 'weight' || t.type === 'volumetric';
      return t.type === col.targetType;
    });

    if (target) {
      const targetVal = target.value;
      // For compound "start/end" values, compare the end (last) value against target
      const rawForParse =
        typeof mainValue === 'string' && mainValue.includes('/')
          ? mainValue.split('/').pop()
          : mainValue;
      const measuredVal = parseFloat(rawForParse);

      if (!isNaN(measuredVal)) {
        const diff = measuredVal - targetVal;
        const diffSign = diff > 0 ? '+' : '';
        const diffColor = Math.abs(diff) < 0.5 ? 'text-success' : 'text-base-content/40';

        targetDisplay = (
          <div style={subTextSize} className='mt-0.5 leading-tight whitespace-nowrap opacity-80'>
            <span className='opacity-50'>Target:</span> {targetVal}
            {unit}
            <span className={`ml-1 font-bold ${diffColor}`}>
              ({diffSign}
              {diff.toFixed(1)})
            </span>
          </div>
        );
      }
    }
  }

  if (isWeightCol && phase.prediction && phase.prediction.finalWeight !== null) {
    const measuredVal = parseFloat(mainValue);
    if (!isNaN(measuredVal) && Math.abs(measuredVal - phase.prediction.finalWeight) >= 0.1) {
      const predVal = sf(phase.prediction.finalWeight);

      // Highlight the prediction in orange/red if this phase exited via a weight target
      // This indicates the prediction (or look-ahead) was the actual trigger for the stop.
      const isPredHit = phase.exit?.type === 'weight' || phase.exit?.type === 'volumetric';
      const predColorClass = isPredHit
        ? 'text-orange-600 dark:text-orange-400'
        : 'text-blue-600 dark:text-blue-400';

      predictionDisplay = (
        <div
          style={subTextSize}
          className={`mt-0.5 flex items-center justify-end gap-1 leading-tight font-bold ${predColorClass}`}
        >
          <FontAwesomeIcon icon={faCalculator} style={iconSize} className='opacity-60' />
          <span>
            Pred: {predVal}
            {unit}
          </span>
        </div>
      );
    }
  }

  if (isWeightCol && phase.scaleLost) {
    warningDisplay = (
      <div
        style={subTextSize}
        className='text-error mt-0.5 flex items-center justify-end gap-1 font-bold'
      >
        <FontAwesomeIcon icon={faExclamationTriangle} />
        <span>Scale Lost</span>
      </div>
    );
  }

  return (
    <div className='flex min-h-[2em] flex-col items-end justify-center'>
      {isBoolean ? (
        <div className='flex h-full items-center pb-1'>{booleanContent}</div>
      ) : (
        <span className={`${isHit ? 'font-bold text-orange-600 dark:text-orange-400' : ''}`}>
          {mainValue}
          {unit}
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
  <span
    className={`rounded-[4px] border px-2 py-0.5 text-[10px] font-bold ${colorClass} leading-none tracking-tight select-none`}
    title={title}
  >
    {label}
  </span>
);

// --- Scroll Button Helper ---
const ScrollBtn = ({ icon, onClick, className = '', title }) => (
  <button
    onClick={onClick}
    title={title}
    className={`btn btn-ghost btn-xs text-base-content/40 hover:text-primary h-5 min-h-0 px-1.5 ${className}`}
  >
    <FontAwesomeIcon icon={icon} className='text-[10px]' />
  </button>
);
