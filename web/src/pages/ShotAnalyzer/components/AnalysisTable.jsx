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
  faCircleInfo,
} from '@fortawesome/free-solid-svg-icons';
import { columnConfig, groupColors, utilityColors, analyzerUiColors } from '../utils/analyzerUtils';
import { ColumnControls } from './ColumnControls'; // Import ColumnControls

function StopCalculationHelpPopover() {
  const detailsRef = useRef(null);
  const [isWideViewport, setIsWideViewport] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;

    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const updateViewportMode = () => setIsWideViewport(mediaQuery.matches);
    updateViewportMode();

    const listener = event => setIsWideViewport(event.matches);
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }

    mediaQuery.addListener(listener);
    return () => mediaQuery.removeListener(listener);
  }, []);

  useEffect(() => {
    const handlePointerDown = event => {
      const el = detailsRef.current;
      if (!el || !el.hasAttribute('open')) return;
      if (el.contains(event.target)) return;
      el.removeAttribute('open');
    };

    const handleKeyDown = event => {
      if (event.key !== 'Escape') return;
      const el = detailsRef.current;
      if (!el || !el.hasAttribute('open')) return;
      el.removeAttribute('open');
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const mobilePopoverStyle = isWideViewport
    ? undefined
    : {
        position: 'fixed',
        left: '0.5rem',
        right: '0.5rem',
        bottom: '1rem',
        width: 'auto',
        maxWidth: 'none',
      };

  return (
    <details ref={detailsRef} className='dropdown'>
      <summary
        className='flex h-5 w-5 list-none items-center justify-center rounded-full text-base-content/45 transition-colors hover:text-base-content/80 [&::-webkit-details-marker]:hidden'
        aria-label='Stop Calculation help'
        title='Stop Calculation help'
      >
        <FontAwesomeIcon icon={faCircleInfo} className='text-[13px]' />
      </summary>
      <div
        className={`dropdown-content bg-base-100/95 border-base-content/10 text-base-content normal-case tracking-normal z-[90] max-h-[70vh] overflow-y-auto rounded-xl border p-3 text-[12px] leading-relaxed font-normal shadow-xl backdrop-blur-md ${
          isWideViewport ? 'absolute right-0 bottom-full mb-2 w-[min(92vw,34rem)]' : ''
        }`}
        style={mobilePopoverStyle}
      >
        <div className='space-y-2.5'>
          <p className='text-sm font-semibold leading-tight'>Stop Calculation (Analyzer only)</p>
          <p className='opacity-85'>
            The <strong>Stop Calculation</strong> settings and{' '}
            <strong style={{ color: utilityColors.predictionInfoBlue }}>Calc</strong> values are
            Analyzer-only tools. Future-value calculations are not performed by GaggiMate itself
            and shot execution is not changed by these settings.
          </p>

          <div className='rounded-lg bg-base-200/60 p-2'>
            <p className='text-[12px] leading-tight font-semibold text-base-content/90'>
              Status Labels
            </p>
            <div className='mt-1 space-y-1.5'>
              <p>
                <span className='mr-1.5 inline-flex rounded-[4px] border border-sky-700 bg-sky-600 px-1.5 py-0.5 text-[10px] leading-none font-bold tracking-tight text-white align-middle'>
                  REVIEW PHASE
                </span>
                Shown when a stop reason is only detected after a higher calculation step / deeper
                review. This usually means the stop happened between recorded samples and was not
                visible in the first pass.
              </p>
              <p>
                <span
                  className='mr-1.5 inline-flex rounded-[4px] border px-1.5 py-0.5 text-[10px] leading-none font-bold tracking-tight text-white align-middle'
                  style={{
                    backgroundColor: utilityColors.warningOrange,
                    borderColor: utilityColors.warningOrange,
                  }}
                >
                  HIGH SCALE DELAY
                </span>
                Shown when a weight-based stop was likely triggered, but the detected timing is
                significantly too early or too late. This may indicate an incorrectly configured
                scale delay in the GaggiMate settings (or a shot that was manually stopped near the
                target).
              </p>
              <p>
                <span
                  className='mr-1.5 inline-flex rounded-[4px] border px-1.5 py-0.5 text-[10px] leading-none font-bold tracking-tight text-white align-middle'
                  style={{
                    backgroundColor: utilityColors.warningOrange,
                    borderColor: utilityColors.warningOrange,
                  }}
                >
                  SCALE LOST
                </span>
                Shown when the scale briefly loses connection during the brew. In this case, weight
                is ignored for stop detection for that brew, even if the scale reconnects later.
              </p>
              <p>
                <span className='mr-1.5 inline-flex rounded-[4px] border border-blue-700 bg-blue-600 px-1.5 py-0.5 text-[10px] leading-none font-bold tracking-tight text-white align-middle'>
                  AUTO-CALC
                </span>
                Shown when Auto mode is active and the displayed stop-calculation delays are
                analyzer-side averages from the phase-specific calculations.
              </p>
            </div>
          </div>

          <div className='rounded-lg bg-base-200/60 p-2'>
            <p className='text-[12px] leading-tight font-semibold text-base-content/90'>
              How stop detection works
            </p>
            <p>
              The Analyzer determines stop reasons from a recorded sample stream. Since samples are
              recorded at fixed intervals (typically <strong>250 ms</strong>), the exact stop event
              may happen between recorded points.
            </p>
            <p className='mt-1'>
              To identify the most likely stop reason, the Analyzer first checks up to three nearby
              timestamps around the phase transition:
            </p>
            <ol className='mt-1 ml-4 list-decimal'>
              <li>the end of the current phase,</li>
              <li>the next recorded point,</li>
              <li>the following recorded point.</li>
            </ol>
            <p className='mt-1'>
              If no clear stop reason is found at those three timestamps, the Analyzer performs a
              limited short-range calculation (extrapolation) based only on that small time window.
            </p>
            <p className='mt-1'>
              The Analyzer intentionally does not use values further into the future, because those
              may already be influenced by the next phase and could distort stop detection.
            </p>
          </div>

          <div className='rounded-lg bg-base-200/60 p-2'>
            <p className='text-[12px] leading-tight font-semibold text-base-content/90'>Example</p>
            <p>
              If a phase has a flow stop at <strong>1 ml/s</strong>, flow may briefly cross that
              threshold between two samples. A short calculation helps estimate the stop condition
              more accurately than relying on later values that may already reflect the next phase.
            </p>
          </div>

          <div className='rounded-lg bg-base-200/60 p-2'>
            <p className='text-[12px] leading-tight font-semibold text-base-content/90'>
              Auto vs Manual
            </p>
            <p className='mt-1'>
              <strong>Auto</strong>: Calculates stop timing per phase, individually. The displayed
              average values are the averages of those phase-specific calculations. The step size
              follows the recording sample interval (typically 250 ms), which makes Auto generally
              more accurate overall.
            </p>
            <p className='mt-1'>
              <strong>Manual</strong>: Applies one stop-calculation offset to all phases at once.
              This is best for reviewing one specific phase / stop reason in detail. Manual mode can
              use smaller step intervals than Auto, which may occasionally produce different
              results.
            </p>
          </div>

          <div className='rounded-lg bg-base-200/60 p-2'>
            <p className='text-[12px] leading-tight font-semibold text-base-content/90'>
              Scale vs System
            </p>
            <p>
              <strong>Scale</strong> and <strong>System</strong> can be adjusted separately because
              Bluetooth scales often have their own sampling rates and timing behavior, independent
              of system sampling / processing timing.
            </p>
          </div>
        </div>
      </div>
    </details>
  );
}

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
  const [isTouchOptimized, setIsTouchOptimized] = useState(false);

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

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const mediaQuery =
      typeof window.matchMedia === 'function' ? window.matchMedia('(any-pointer: coarse)') : null;

    const updateTouchOptimization = () => {
      const hasCoarsePointer = Boolean(mediaQuery?.matches);
      const hasTouchPoints = Number(window.navigator?.maxTouchPoints || 0) > 0;
      setIsTouchOptimized(hasCoarsePointer || hasTouchPoints);
    };

    updateTouchOptimization();

    if (!mediaQuery) return undefined;

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateTouchOptimization);
      return () => mediaQuery.removeEventListener('change', updateTouchOptimization);
    }

    mediaQuery.addListener(updateTouchOptimization);
    return () => mediaQuery.removeListener(updateTouchOptimization);
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
  const touchInteractionStyle = isTouchOptimized
    ? {
        touchAction: 'pan-x pan-y pinch-zoom',
        WebkitOverflowScrolling: 'touch',
        overscrollBehaviorX: 'contain',
      }
    : {
        touchAction: 'pan-y',
      };

  return (
    <div className='mt-6 flex w-full flex-col'>
      {/* Inject CSS to hide Webkit Scrollbars */}
      <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
            `}</style>

      {/* 1. Status Badges (Outside the main card) - Updated for Solid Colors */}
      <div className='mb-2 flex flex-wrap gap-2 px-1'>
        {results.isBrewByWeight ? (
          <StatusBadge
            label='BREW BY WEIGHT'
            colorClass='text-white shadow-sm'
            style={{
              backgroundColor: analyzerUiColors.brewByWeightLabelBg,
              borderColor: analyzerUiColors.brewByWeightLabelBorder,
              color: analyzerUiColors.brewByWeightLabelText,
            }}
          />
        ) : (
          <StatusBadge
            label='BREW BY TIME'
            colorClass='text-white shadow-sm'
            style={{
              backgroundColor: analyzerUiColors.brewByTimeLabelBg,
              borderColor: analyzerUiColors.brewByTimeLabelBorder,
              color: analyzerUiColors.brewByTimeLabelText,
            }}
          />
        )}
        {results.globalScaleLost && (
          <StatusBadge
            label='SCALE LOST'
            style={{
              backgroundColor: utilityColors.warningOrange,
              borderColor: utilityColors.warningOrange,
            }}
            colorClass='text-white shadow-sm'
          />
        )}
        {results.highScaleDelay && (
          <StatusBadge
            label='HIGH SCALE DELAY'
            style={{
              backgroundColor: utilityColors.warningOrange,
              borderColor: utilityColors.warningOrange,
            }}
            colorClass='text-white shadow-sm'
            title={
              results.highScaleDelayMs
                ? `Estimated scale delay exceeds 2000 ms (${results.highScaleDelayMs} ms), or the shot may have been manually stopped near the target. Please review scale-delay settings.`
                : 'Estimated scale delay exceeds 2000 ms, or the shot may have been manually stopped near the target. Please review scale-delay settings.'
            }
          />
        )}
        {results.delayReviewHint && (
          <StatusBadge
            label={
              results.delayReviewPhaseNumber
                ? `REVIEW PHASE ${results.delayReviewPhaseNumber}`
                : 'PHASE REVIEW ADVISED'
            }
            colorClass='bg-sky-600 text-white border-sky-700'
            title={
              results.delayReviewMessage ||
              'Unusually high inferred delay detected.'
            }
          />
        )}
        {results.isAutoAdjusted && (
          <StatusBadge label='AUTO-CALC' colorClass='bg-blue-600 text-white border-blue-700' />
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
          // removed 'overscroll-*' classes to prevent latching
          className='no-scrollbar block h-auto min-h-0 w-full overflow-x-auto overflow-y-hidden'
          style={{ scrollBehavior: 'smooth', ...scrollbarHideStyle, ...touchInteractionStyle }}
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
                      className={`border-base-content/10 border-l px-3 py-2 text-right font-bold tracking-tighter whitespace-nowrap uppercase`}
                      style={{
                        borderTop: `3px solid ${colors.anchor}`,
                        backgroundColor: 'rgba(128, 128, 128, 0.05)', // Subtle unified tint
                      }}
                    >
                      <span className={colors.text}>{getHeaderLabel(col)}</span>
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
                    {/* Neutral Phase Names */}
                    <div className='text-base-content mb-0.5 leading-none font-bold'>
                      {phase.displayName}
                    </div>
                    {phase.exit?.reason && (
                      <div
                        className='font-bold tracking-tight uppercase'
                        style={{ fontSize: '0.8em', color: utilityColors.stopRed }}
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
        <div className='bg-base-100 border-base-content/10 flex flex-col items-stretch gap-3 rounded-b-lg border-t px-4 py-3 text-[10px] font-bold tracking-wider uppercase sm:flex-row sm:flex-wrap sm:items-center sm:justify-between'>
          {/* Left: Stop Calculation Inputs */}
          <div className='flex w-full flex-wrap items-center gap-x-3 gap-y-2 sm:w-auto sm:gap-4'>
            <span className='hidden opacity-40 select-none sm:inline'>Stop Calculation</span>
            <div className='flex flex-wrap items-center gap-2'>
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
            <div className='bg-base-content/10 mx-1 hidden h-3 w-px sm:block'></div>
            <div className='flex flex-wrap items-center gap-2'>
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
              <StopCalculationHelpPopover />
            </div>
          </div>

          {/* Right: Legend */}
          <div className='text-base-content grid w-full grid-cols-3 gap-x-3 gap-y-1 font-bold select-none sm:flex sm:w-auto sm:items-center sm:gap-4'>
            <span className='leading-tight whitespace-normal'>∅ Avg (Time Weighted)</span>
            <span className='leading-tight whitespace-normal'>S/E Start/End</span>
            <span className='leading-tight whitespace-normal'>Range Min/Max</span>
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
    if (val === true) {
      return <FontAwesomeIcon icon={faCheck} className='text-[1em] text-success' />;
    }
    if (val === false) {
      return <FontAwesomeIcon icon={faTimes} className='text-[1em] text-error' />;
    }
    return <span className='text-base-content/60'>-</span>;
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

    // Weight Flow Details (clamp to 0)
    case 'wf_se':
      mainValue = `${sf(Math.max(0, stats?.wf?.start ?? 0))}/${sf(Math.max(0, stats?.wf?.end ?? 0))}`;
      break;
    case 'wf_mm':
      mainValue = `${sf(Math.max(0, stats?.wf?.min ?? 0))}/${sf(Math.max(0, stats?.wf?.max ?? 0))}`;
      break;
    case 'wf_avg':
      mainValue = sf(Math.max(0, stats?.wf?.avg ?? 0));
      unit = 'g/s';
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

  const isWeightCol = col.id === 'weight';
  const exitMatchesCol = isWeightCol
    ? (phase.exit?.type === 'weight' || phase.exit?.type === 'volumetric')
    : phase.exit?.type === col.targetType;
  const isHit = exitMatchesCol;

  let targetDisplay = null;
  let predictionDisplay = null;
  let warningDisplays = [];

  // Relative font sizing for sub-elements (0.85em) ensures they scale with zoom
  const subTextSize = { fontSize: '0.85em' };
  const iconSize = { fontSize: '0.8em' };
  const booleanAnomaly = !isTotal && isBoolean ? stats?.sys_anomalies?.[col.id] : null;

  // Unified Target Display - Parentheses + Italics, no "Target:" label
  if (col.id === 'duration' && phase.profilePhase && phase.profilePhase.duration > 0) {
    const targetVal = phase.profilePhase.duration;
    const diff = data.duration - targetVal;
    const diffSign = diff > 0 ? '+' : '';
    const diffColor = Math.abs(diff) < 0.5 ? 'text-success' : 'text-base-content/60';

    targetDisplay = (
      <div
        style={subTextSize}
        className='mt-0.5 leading-tight font-medium whitespace-nowrap italic opacity-100'
      >
        ({targetVal}
        {unit})
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
      const rawForParse =
        typeof mainValue === 'string' && mainValue.includes('/')
          ? mainValue.split('/').pop()
          : mainValue;
      const measuredVal = parseFloat(rawForParse);

      if (!isNaN(measuredVal)) {
        const diff = measuredVal - targetVal;
        const diffSign = diff > 0 ? '+' : '';
        const diffColor = Math.abs(diff) < 0.5 ? 'text-success' : 'text-base-content/60';

        targetDisplay = (
          <div
            style={subTextSize}
            className='mt-0.5 leading-tight font-medium whitespace-nowrap italic opacity-100'
          >
            ({targetVal}
            {unit})
            <span className={`ml-1 font-bold ${diffColor}`}>
              ({diffSign}
              {diff.toFixed(1)})
            </span>
          </div>
        );
      }
    }
  }

  if (col.targetType && phase.targetCalcValues) {
    const calcEntry =
      col.id === 'weight'
        ? (phase.targetCalcValues['volumetric'] || phase.targetCalcValues['weight'])
        : phase.targetCalcValues[col.targetType];

    if (calcEntry) {
      const rawForParse =
        typeof mainValue === 'string' && mainValue.includes('/')
          ? mainValue.split('/').pop()
          : mainValue;
      const measuredVal = parseFloat(rawForParse);

      if (!isNaN(measuredVal)) {
        const calcVal = sf(calcEntry.value);
        const calcColor = calcEntry.isStopReason
          ? utilityColors.predictionStopRed
          : utilityColors.predictionInfoBlue;

        let calcUnit = unit;
        if (!calcUnit && col.targetType === 'pressure') calcUnit = 'bar';
        if (!calcUnit && col.targetType === 'flow') calcUnit = 'ml/s';
        if (!calcUnit && col.targetType === 'pumped') calcUnit = 'ml';

        predictionDisplay = (
          <div
            style={{ ...subTextSize, color: calcColor }}
            className='mt-0.5 flex items-center justify-end gap-1 leading-tight font-bold'
          >
            <FontAwesomeIcon icon={faCalculator} style={iconSize} className='opacity-60' />
            <span>
              Calc: {calcVal}
              {calcUnit}
            </span>
          </div>
        );
      }
    }
  }

  if (isWeightCol && phase.scaleLost) {
    warningDisplays.push(
      <div
        key='scale-lost-warning'
        style={{ ...subTextSize, color: utilityColors.warningOrange }}
        className='mt-0.5 flex items-center justify-end gap-1 font-bold'
      >
        <FontAwesomeIcon icon={faExclamationTriangle} />
        <span>Scale Lost</span>
      </div>,
    );
  }

  if (isWeightCol && phase.highScaleDelay) {
    warningDisplays.push(
      <div
        key='high-scale-delay-warning'
        style={{ ...subTextSize, color: utilityColors.warningOrange }}
        className='mt-0.5 flex items-center justify-end gap-1 font-bold'
      >
        <FontAwesomeIcon icon={faExclamationTriangle} />
        <span>
          High Scale Delay
          {phase.estimatedScaleDelayMs ? ` (${phase.estimatedScaleDelayMs} ms)` : ''}
        </span>
      </div>,
    );
  }

  return (
    <div className='flex min-h-[2em] flex-col items-end justify-center'>
      {isBoolean ? (
        <div className='flex h-full flex-col items-end justify-center pb-1'>
          <div className='flex items-center'>{booleanContent}</div>
          {booleanAnomaly && (
            <div
              style={subTextSize}
              className='text-base-content/75 mt-0.5 flex flex-col items-end leading-tight font-bold'
              title={`Sample ${booleanAnomaly.sampleInPhase}: ${String(booleanAnomaly.value)}`}
            >
              <span>
                Sample {booleanAnomaly.sampleInPhase}
                {Number.isFinite(booleanAnomaly.sampleCountInPhase)
                  ? ` (${booleanAnomaly.sampleCountInPhase})`
                  : ''}
              </span>
              <span className='text-base-content/60'>{String(booleanAnomaly.value)}</span>
            </div>
          )}
        </div>
      ) : (
        <span
          className={isHit ? 'font-bold' : ''}
          style={isHit ? { color: utilityColors.stopRed } : {}}
        >
          {mainValue}
          {unit}
        </span>
      )}
      {targetDisplay}
      {predictionDisplay}
      {warningDisplays}
    </div>
  );
}

// --- Status Badge Helper ---
const StatusBadge = ({ label, colorClass = '', style = {}, title }) => (
  <span
    className={`rounded-[4px] border px-2 py-0.5 text-[10px] leading-none font-bold tracking-tight select-none ${colorClass}`}
    style={style}
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
