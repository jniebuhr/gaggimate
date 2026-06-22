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

/* global globalThis */

import { Fragment } from 'preact';
import { createPortal } from 'preact/compat';
import { useState, useRef, useEffect, useCallback } from 'preact/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faAngleRight,
  faAngleDoubleRight,
  faArrowRight,
  faAngleLeft,
  faAngleDoubleLeft,
  faArrowLeft,
  faExclamationTriangle,
  faCheck,
  faTimes,
  faCircleInfo,
} from '@fortawesome/free-solid-svg-icons';
import {
  cleanName,
  columnConfig,
  getDisplayStopReasonParts,
  utilityColors,
} from '../utils/analyzerUtils';
import { ColumnControls } from './ColumnControls'; // Import ColumnControls
import { getAnalyzerColumnVisual } from './analyzerGroupVisuals';
import {
  ANALYZER_ACTION_GROUP_CLASSES,
  ANALYZER_ACTION_ICON_BUTTON_CLASS,
  ANALYZER_ACTION_ICON_CLASS,
  ANALYZER_ACTION_ICON_STYLE,
  getAnalyzerIconButtonClasses,
} from './analyzerControlStyles';

const NEUTRAL_STATUS_BADGE_CLASS = 'bg-base-content/10 text-base-content/80 border-base-content/15';
const WARNING_BADGE_HIGH_SCALE_LABEL = 'HIGH SCALE DELAY OR MANUAL STOP (ADJUSTMENT)';
const WARNING_BADGE_SCALE_LOST_LABEL = 'SCALE LOST';
const SCROLLBAR_HIDE_STYLE = {
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
};

const WARNING_HELP_COPY = {
  delayReview:
    'Review the stop reason for this phase. The algorithm was only able to identify it after several intermediate calculations.',
  highScaleDelay:
    'This may indicate an incorrectly configured scale delay in the GaggiMate settings, a shot that was manually stopped near the target, or an adjusted target weight.',
  scaleLost:
    'Shown when the scale briefly loses connection during the brew. In this case, weight is ignored for stop detection for that brew, even if the scale reconnects later.',
};

function getBrewModeLabel(isBrewByWeight) {
  return isBrewByWeight ? 'Brew by Weight' : 'Brew by Time';
}

function getDelayReviewLabel(results) {
  return results?.delayReviewPhaseNumber
    ? `REVIEW PHASE ${results.delayReviewPhaseNumber}`
    : 'PHASE REVIEW ADVISED';
}

function buildAnalysisWarningBadges(results) {
  const badges = [];

  if (results?.globalScaleLost) {
    badges.push({
      key: 'scale-lost',
      label: WARNING_BADGE_SCALE_LOST_LABEL,
      colorClass: 'text-white shadow-sm',
      details: WARNING_HELP_COPY.scaleLost,
      style: {
        backgroundColor: utilityColors.warningOrange,
        borderColor: utilityColors.warningOrange,
      },
    });
  }

  if (results?.highScaleDelay) {
    badges.push({
      key: 'high-scale-delay',
      label: WARNING_BADGE_HIGH_SCALE_LABEL,
      colorClass: 'text-white shadow-sm',
      details: WARNING_HELP_COPY.highScaleDelay,
      style: {
        backgroundColor: utilityColors.warningOrange,
        borderColor: utilityColors.warningOrange,
      },
    });
  }

  if (results?.delayReviewHint) {
    badges.push({
      key: 'delay-review',
      label: getDelayReviewLabel(results),
      colorClass: NEUTRAL_STATUS_BADGE_CLASS,
      details: results.delayReviewMessage || WARNING_HELP_COPY.delayReview,
    });
  }

  return badges;
}

function stripTrailingParentheticalSuffix(value) {
  const label = String(value || '');
  const suffixStart = label.lastIndexOf(' (');
  if (suffixStart < 0 || !label.endsWith(')')) return label;
  return label.slice(0, suffixStart);
}

function getAnalysisHeaderBaseLabel(col) {
  if (col.id === 'duration') return 'Time';
  if (col.id === 'water') return 'Pumped Water (phase)';
  if (col.id === 'weight') return 'Weight (total)';
  if (col.group === 'flow') return 'Pump Flow';
  if (col.group === 'target_flow') return 'Target Pump Flow';
  if (col.group === 'puckflow') return 'Puck Flow';
  if (col.group === 'temp') return 'Temperature';
  if (col.group === 'target_temp') return 'Target Temp';
  return stripTrailingParentheticalSuffix(col.label);
}

function getAnalysisHeaderLabel(col) {
  const suffixByType = {
    se: ' S/E',
    mm: ' Min/Max',
    avg: ' Avg ∅',
  };

  return `${getAnalysisHeaderBaseLabel(col)}${suffixByType[col.type] || ''}`;
}

function getAnalysisTouchInteractionStyle(isTouchOptimized) {
  if (!isTouchOptimized) {
    return { touchAction: 'pan-y' };
  }

  return {
    touchAction: 'pan-x pan-y pinch-zoom',
    WebkitOverflowScrolling: 'touch',
    overscrollBehaviorX: 'contain',
  };
}

function getCompareAccentColor(entry, index) {
  return entry?.accentColor || (index === 0 ? 'var(--color-primary)' : 'var(--color-secondary)');
}

function getCompareAccentStrength(entry) {
  return Number.isFinite(Number(entry?.accentStrength)) ? Number(entry.accentStrength) : 1;
}

function getCompareRowStyle(entry, index) {
  const strength = getCompareAccentStrength(entry);
  const statusbarStrength = Math.round(100 * strength);
  const accentColor = getCompareAccentColor(entry, index);

  return {
    '--compare-shot-color': accentColor,
    '--analyzer-compare-shot-color': accentColor,
    '--compare-shot-label-color': `${statusbarStrength}%`,
    '--compare-shot-marker-opacity': '1',
  };
}

function getMaxComparePhaseCount(compareMode, compareEntries) {
  if (!compareMode) return 0;
  return Math.max(...compareEntries.map(entry => entry?.results?.phases?.length || 0), 0);
}

function scrollAnalysisTable(ref, amount) {
  ref.current?.scrollBy({ left: amount, behavior: 'smooth' });
}

function scrollAnalysisTableToBound(ref, direction) {
  const tableElement = ref.current;
  if (!tableElement) return;
  const left = direction === 'start' ? 0 : tableElement.scrollWidth;
  tableElement.scrollTo({ left, behavior: 'smooth' });
}

function useVerticalWheelForwarding(tableContainerRef) {
  useEffect(() => {
    const tableElement = tableContainerRef.current;
    if (!tableElement) return undefined;

    const handleWheel = event => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      globalThis.window?.scrollBy({
        top: event.deltaY,
        left: 0,
        behavior: 'auto',
      });
    };

    tableElement.addEventListener('wheel', handleWheel, { passive: true });
    return () => tableElement.removeEventListener('wheel', handleWheel);
  }, [tableContainerRef]);
}

function useTouchOptimizedPointer() {
  const [isTouchOptimized, setIsTouchOptimized] = useState(false);

  useEffect(() => {
    const browserWindow = globalThis.window;
    if (!browserWindow) return undefined;

    const mediaQuery = browserWindow.matchMedia?.('(any-pointer: coarse)') || null;
    const updateTouchOptimization = () => {
      const hasCoarsePointer = Boolean(mediaQuery?.matches);
      const hasTouchPoints = Number(browserWindow.navigator?.maxTouchPoints || 0) > 0;
      setIsTouchOptimized(hasCoarsePointer || hasTouchPoints);
    };

    updateTouchOptimization();
    if (mediaQuery === null) return undefined;

    mediaQuery.addEventListener?.('change', updateTouchOptimization);
    return () => mediaQuery.removeEventListener?.('change', updateTouchOptimization);
  }, []);

  return isTouchOptimized;
}

function AnalysisTableToolbarActions({ onScrollTable, onScrollToBound }) {
  return (
    <div className={`${ANALYZER_ACTION_GROUP_CLASSES} hidden sm:flex`}>
      <ScrollBtn icon={faArrowLeft} onClick={() => onScrollToBound('start')} />
      <ScrollBtn icon={faAngleDoubleLeft} onClick={() => onScrollTable(-300)} />
      <ScrollBtn
        icon={faAngleLeft}
        onClick={() => onScrollTable(-100)}
        className='mr-1 rounded-r-none'
      />
      <ScrollBtn
        icon={faAngleRight}
        onClick={() => onScrollTable(100)}
        className='rounded-l-none'
      />
      <ScrollBtn icon={faAngleDoubleRight} onClick={() => onScrollTable(300)} />
      <ScrollBtn icon={faArrowRight} onClick={() => onScrollToBound('end')} />
    </div>
  );
}

function hasAnalysisProfilePhaseStops(results) {
  return Boolean(results?.phases?.some(phase => phase.profilePhase));
}

function AnalysisTableHeader({
  compareMode,
  hasProfilePhaseStops,
  visibleColumns,
  subtleDividerClass,
  strongDividerClass,
  tableHeaderTextClass,
  tableHeaderSubtextClass,
}) {
  return (
    <thead>
      <tr className='border-base-content/10 border-b-2'>
        {!compareMode && (
          <th
            className={`w-10 border-r px-2 py-2 text-center select-none ${subtleDividerClass} ${tableHeaderTextClass}`}
          >
            #
          </th>
        )}
        {compareMode && (
          <th
            className={`min-w-[140px] px-2 py-2 text-left whitespace-nowrap ${subtleDividerClass} ${tableHeaderTextClass}`}
          >
            Shot
          </th>
        )}
        <th
          className={`min-w-[120px] px-2 py-2 text-left whitespace-nowrap ${strongDividerClass} ${tableHeaderTextClass}`}
        >
          <div className='leading-none'>Phase</div>
          {hasProfilePhaseStops && (
            <div className={`mt-0.5 ${tableHeaderSubtextClass}`} style={{ fontSize: '0.85em' }}>
              Stop reason
            </div>
          )}
        </th>
        {visibleColumns.map(col => {
          const columnVisual = getAnalyzerColumnVisual(col);
          return (
            <th
              key={col.id}
              className={`border-l px-3 py-2 text-right align-middle ${subtleDividerClass} ${tableHeaderTextClass}`}
            >
              <span className='ml-auto flex max-w-[6.75rem] items-center justify-end gap-1.5 text-right leading-tight'>
                <FontAwesomeIcon
                  icon={columnVisual.icon}
                  className='shrink-0 text-xs'
                  style={{ color: columnVisual.color }}
                />
                <span className='min-w-0 break-words whitespace-normal'>
                  {getAnalysisHeaderLabel(col)}
                </span>
              </span>
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

/**
 * Main Table Component
 */
export function AnalysisTable({
  results,
  compareEntries = [],
  isCompareActive = false,
  activeColumns,
  onColumnsChange,
}) {
  const compareMode = isCompareActive && Array.isArray(compareEntries) && compareEntries.length > 1;

  const isTouchOptimized = useTouchOptimizedPointer();

  const tableContainerRef = useRef(null);
  const visibleColumns = columnConfig.filter(col => activeColumns.has(col.id));
  const compareTableColumnCount = visibleColumns.length + 2;
  const maxComparePhaseCount = getMaxComparePhaseCount(compareMode, compareEntries);
  const hasProfilePhaseStops = hasAnalysisProfilePhaseStops(results);

  const scrollTable = amount => scrollAnalysisTable(tableContainerRef, amount);
  const scrollToBound = direction => scrollAnalysisTableToBound(tableContainerRef, direction);

  useVerticalWheelForwarding(tableContainerRef);

  if (!results?.phases && !compareMode) return null;

  // --- Styles ---
  const touchInteractionStyle = getAnalysisTouchInteractionStyle(isTouchOptimized);

  const subtleDividerClass = 'border-base-content/5';
  const strongDividerClass = 'border-base-content/12 border-r-2';
  const tableHeaderTextClass = 'text-base-content leading-tight font-medium tracking-normal';
  const tableHeaderSubtextClass = 'text-base-content/55 leading-tight font-medium tracking-normal';
  const primaryTableTextClass = 'text-base-content/90 font-medium';
  const tableSubtextClass = 'text-base-content/55 leading-tight font-medium';
  const tableLegendTextClass = 'text-base-content/75 text-xs font-normal tracking-normal';
  const analysisWarningBadges = buildAnalysisWarningBadges(results);
  return (
    <div className='flex w-full flex-col'>
      {/* Inject CSS to hide Webkit Scrollbars */}
      <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .analysis-table-compare-row:hover {
                  background: color-mix(
                    in srgb,
                    var(--color-base-content) 5%,
                    transparent
                  );
                }
                .analysis-table-compare-marker {
                  background: var(--compare-shot-color);
                  opacity: var(--compare-shot-marker-opacity, 1);
                }
                .analysis-table-compare-badge {
                  background: var(--compare-shot-color);
                  opacity: var(--compare-shot-marker-opacity, 1);
                  color: var(--color-primary-content);
                }
                .analysis-table-compare-label {
                  color: var(--color-base-content);
                }
            `}</style>

      {/* Keep the top strip focused on global warnings and phase-review hints only. */}
      <div className='relative z-0 -mb-1 flex flex-wrap gap-1.5 px-2'>
        {analysisWarningBadges.map(badge => (
          <StatusBadge
            key={badge.key}
            label={badge.label}
            style={badge.style}
            colorClass={badge.colorClass}
            details={badge.details}
          />
        ))}
      </div>

      {/* 2. MAIN CARD WRAPPER */}
      <div className='app-card-surface relative isolate z-[1] flex flex-col overflow-hidden rounded-xl px-1.5 sm:px-2'>
        {/* A. Top Toolbar: Column Controls + Actions (Zoom/Scroll) */}
        <ColumnControls
          activeColumns={activeColumns}
          onColumnsChange={onColumnsChange}
          isIntegrated={true}
          headerChildren={
            <AnalysisTableToolbarActions
              onScrollTable={scrollTable}
              onScrollToBound={scrollToBound}
            />
          }
        />

        {/* B. Table Container (Middle) */}
        <div
          ref={tableContainerRef}
          // removed 'overscroll-*' classes to prevent latching
          className='no-scrollbar my-1.5 block h-auto min-h-0 w-full overflow-x-auto overflow-y-hidden sm:my-2'
          style={{ scrollBehavior: 'smooth', ...SCROLLBAR_HIDE_STYLE, ...touchInteractionStyle }}
        >
          {/* Dynamic Font Size applied to Table */}
          <table
            className='text-base-content w-full border-collapse transition-all duration-200'
            style={{ fontSize: '12px', lineHeight: '1.4' }}
          >
            <AnalysisTableHeader
              compareMode={compareMode}
              hasProfilePhaseStops={hasProfilePhaseStops}
              visibleColumns={visibleColumns}
              subtleDividerClass={subtleDividerClass}
              strongDividerClass={strongDividerClass}
              tableHeaderTextClass={tableHeaderTextClass}
              tableHeaderSubtextClass={tableHeaderSubtextClass}
            />

            {compareMode ? (
              <tbody>
                {Array.from({ length: maxComparePhaseCount }, (_, phaseIndex) => (
                  <Fragment key={`phase-group-${phaseIndex}`}>
                    <tr className='bg-base-200/55'>
                      <td
                        colSpan={compareTableColumnCount}
                        className={`border-base-content/10 px-3 py-2 text-left text-xs ${tableHeaderTextClass}`}
                      >
                        Phase {phaseIndex + 1}
                      </td>
                    </tr>
                    {compareEntries.map((entry, compareIndex) => {
                      const phase = entry?.results?.phases?.[phaseIndex] || null;

                      return (
                        <tr
                          key={`${entry.key}-phase-${phaseIndex}`}
                          className='analysis-table-compare-row border-base-content/5 group border-b align-top transition-colors'
                          style={getCompareRowStyle(entry, compareIndex)}
                        >
                          <td
                            className={`px-2 py-2 text-left whitespace-nowrap ${subtleDividerClass}`}
                          >
                            <div className='flex min-w-0 items-center gap-1.5'>
                              <span
                                className={[
                                  'analyzer-compare-shot-badge analysis-table-compare-badge inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs leading-none font-semibold tabular-nums',
                                  compareIndex === 1 ? 'analyzer-compare-shot-badge--striped' : '',
                                ]
                                  .filter(Boolean)
                                  .join(' ')}
                                aria-label={`Shot ${compareIndex + 1}`}
                              >
                                {compareIndex + 1}
                              </span>
                              <div
                                className={`analysis-table-compare-label min-w-0 truncate ${tableHeaderTextClass}`}
                              >
                                {entry.label}
                              </div>
                            </div>
                            {entry.profileName && entry.profileName !== 'No Profile Loaded' ? (
                              <div className={`text-xs ${tableSubtextClass}`}>
                                {cleanName(entry.profileName)}
                              </div>
                            ) : null}
                          </td>
                          <td
                            className={`px-2 py-2 text-left whitespace-nowrap ${strongDividerClass}`}
                          >
                            <ComparePhaseLabel
                              phase={phase}
                              phaseIndex={phaseIndex}
                              results={entry.results}
                            />
                          </td>
                          {visibleColumns.map(col => (
                            <td
                              key={`${entry.key}-${phaseIndex}-${col.id}`}
                              className={`border-l px-3 py-2 text-right whitespace-nowrap tabular-nums ${subtleDividerClass}`}
                            >
                              <CellContent phase={phase} col={col} results={entry.results} />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}

                <tr className='bg-base-200/75'>
                  <td
                    colSpan={compareTableColumnCount}
                    className={`border-base-content/10 border-t-2 px-3 py-2 text-left text-xs ${tableHeaderTextClass}`}
                  >
                    Totals
                  </td>
                </tr>
                {compareEntries.map((entry, compareIndex) => (
                  <tr
                    key={`${entry.key}-total`}
                    className='analysis-table-compare-row border-base-content/5 group border-b align-top transition-colors'
                    style={getCompareRowStyle(entry, compareIndex)}
                  >
                    <td className={`px-2 py-2 text-left whitespace-nowrap ${subtleDividerClass}`}>
                      <div className='flex min-w-0 items-center gap-1.5'>
                        <span
                          className={[
                            'analyzer-compare-shot-badge analysis-table-compare-badge inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs leading-none font-semibold tabular-nums',
                            compareIndex === 1 ? 'analyzer-compare-shot-badge--striped' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          aria-label={`Shot ${compareIndex + 1}`}
                        >
                          {compareIndex + 1}
                        </span>
                        <div
                          className={`analysis-table-compare-label min-w-0 truncate ${tableHeaderTextClass}`}
                        >
                          {entry.label}
                        </div>
                      </div>
                    </td>
                    <td
                      className={`px-2 py-2 text-left whitespace-nowrap ${strongDividerClass} ${primaryTableTextClass}`}
                    >
                      Total
                    </td>
                    {visibleColumns.map(col => (
                      <td
                        key={`${entry.key}-total-${col.id}`}
                        className={`border-l px-3 py-2 text-right tabular-nums ${subtleDividerClass} ${primaryTableTextClass}`}
                      >
                        <CellContent
                          phase={null}
                          col={col}
                          results={entry.results}
                          isTotal={true}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ) : (
              <>
                <tbody>
                  {results.phases.map((phase, idx) => (
                    <tr
                      key={
                        phase.key ||
                        [
                          phase.number,
                          phase.displayName || phase.name,
                          phase.start,
                          phase.end,
                          phase.exit?.reason,
                        ]
                          .filter(value => value !== null && value !== undefined && value !== '')
                          .join('-')
                      }
                      className='border-base-content/5 hover:bg-base-content/5 group border-b align-top transition-colors'
                    >
                      <td
                        className={`border-r pt-2.5 text-center select-none ${subtleDividerClass} ${tableHeaderTextClass}`}
                      >
                        {idx + 1}
                      </td>
                      <td className={`px-2 py-2 text-left whitespace-nowrap ${strongDividerClass}`}>
                        <ComparePhaseLabel phase={phase} phaseIndex={idx} results={results} />
                      </td>
                      {visibleColumns.map(col => (
                        <td
                          key={col.id}
                          className={`border-l px-3 py-2 text-right whitespace-nowrap tabular-nums ${subtleDividerClass}`}
                        >
                          <CellContent phase={phase} col={col} results={results} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>

                <tfoot className='border-base-content/10 text-base-content border-t-2'>
                  <tr>
                    <td className={`border-r ${subtleDividerClass}`} />
                    <td
                      className={`px-2 py-2 text-left ${strongDividerClass} ${tableHeaderTextClass}`}
                    >
                      Total
                    </td>
                    {visibleColumns.map(col => (
                      <td
                        key={col.id}
                        className={`border-l px-3 py-2 text-right tabular-nums ${subtleDividerClass} ${primaryTableTextClass}`}
                      >
                        <CellContent phase={null} col={col} results={results} isTotal={true} />
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </>
            )}
          </table>
        </div>

        {/* C. Footer legend */}
        <div className='bg-base-100 border-base-content/10 flex rounded-b-lg border-t py-2 text-xs sm:justify-end'>
          <div className='text-base-content grid w-full grid-cols-3 gap-x-3 gap-y-1 select-none sm:ml-auto sm:flex sm:w-auto sm:items-center sm:gap-4'>
            <span className={`leading-tight whitespace-normal ${tableLegendTextClass}`}>
              Avg Average (time weighted)
            </span>
            <span className={`leading-tight whitespace-normal ${tableLegendTextClass}`}>
              S/E Start/End
            </span>
            <span className={`leading-tight whitespace-normal ${tableLegendTextClass}`}>
              Range Min/Max
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ComparePhaseLabel({ phase, phaseIndex, results }) {
  if (!phase) {
    return <div className='text-base-content/45 leading-tight font-medium'>-</div>;
  }

  const { skipNotice, stopReason } = getDisplayStopReasonParts(phase.exit?.reason);

  return (
    <>
      <div className='text-base-content/90 mb-0.5 leading-none font-medium'>
        {phase.displayName}
      </div>
      {skipNotice ? (
        <div
          className='text-base-content/55 leading-tight font-medium'
          style={{ fontSize: '0.8em' }}
        >
          {skipNotice}
        </div>
      ) : null}
      {stopReason ? (
        <div className='font-normal' style={{ fontSize: '0.85em', color: utilityColors.stopRed }}>
          {stopReason}
        </div>
      ) : null}
      {phaseIndex === (results?.phases?.length || 0) - 1 && (
        <div
          className='text-base-content/55 leading-tight font-medium'
          style={{ fontSize: '0.8em' }}
        >
          {getBrewModeLabel(results.isBrewByWeight)}
        </div>
      )}
    </>
  );
}

/**
 * Sub-Component: Cell Content
 * Uses relative sizing (em) or inherited font size for consistency
 */
const DIRECT_CELL_FIELDS = {
  duration: { path: 'duration', unit: 's' },
  water: { path: 'water', unit: 'ml' },
  weight: { path: 'weight', unit: 'g' },
};

const CELL_METRIC_UNITS = {
  p: 'bar',
  tp: 'bar',
  f: 'ml/s',
  tf: 'ml/s',
  pf: 'ml/s',
  t: '°C',
  tt: '°C',
  w: 'g',
  wf: 'g/s',
};

const CELL_METRIC_PARTS = {
  se: ['start', 'end'],
  mm: ['min', 'max'],
  avg: ['avg'],
};

const BOOLEAN_CELL_FIELDS = {
  sys_shot_vol: 'sys_shot_vol',
  sys_curr_vol: 'sys_curr_vol',
  sys_scale: 'sys_scale',
  sys_vol_avail: 'sys_vol_avail',
  sys_ext: 'sys_ext',
};

function formatCellNumber(value, digits = 1) {
  const numericValue = Number(value);
  return value != null && Number.isFinite(numericValue) ? numericValue.toFixed(digits) : '-';
}

function renderCellBoolean(value) {
  if (value === true) {
    return <FontAwesomeIcon icon={faCheck} className='text-success text-[1em]' />;
  }
  if (value === false) {
    return <FontAwesomeIcon icon={faTimes} className='text-error text-[1em]' />;
  }
  return <span className='text-base-content/55 font-medium'>-</span>;
}

function getMetricCellValue(stats, metricKey, partKey) {
  const metric = stats?.[metricKey];
  const parts = CELL_METRIC_PARTS[partKey];
  if (!parts) return '-';

  const formatPart = part => {
    const value = metric?.[part];
    return metricKey === 'wf' ? formatCellNumber(Math.max(0, value ?? 0)) : formatCellNumber(value);
  };

  return parts.length === 1
    ? formatPart(parts[0])
    : `${formatPart(parts[0])}/${formatPart(parts[1])}`;
}

function resolveCellValue({ data, stats, col, isSkipped = false }) {
  if (isSkipped && col.id !== 'sys_raw' && !BOOLEAN_CELL_FIELDS[col.id]) {
    const metricMatch = /^([a-z]+)_(se|mm|avg)$/.exec(col.id);
    return {
      mainValue: '-',
      unit: metricMatch
        ? CELL_METRIC_UNITS[metricMatch[1]] || ''
        : DIRECT_CELL_FIELDS[col.id]?.unit || '',
      isBoolean: false,
      booleanContent: null,
    };
  }

  const directField = DIRECT_CELL_FIELDS[col.id];
  if (directField) {
    return {
      mainValue: formatCellNumber(data?.[directField.path]),
      unit: directField.unit,
      isBoolean: false,
      booleanContent: null,
    };
  }

  if (col.id === 'sys_raw') {
    return {
      mainValue: stats?.sys_raw ?? '-',
      unit: '',
      isBoolean: false,
      booleanContent: null,
    };
  }

  const booleanField = BOOLEAN_CELL_FIELDS[col.id];
  if (booleanField) {
    return {
      mainValue: '-',
      unit: '',
      isBoolean: true,
      booleanContent: renderCellBoolean(stats?.[booleanField]),
    };
  }

  const metricMatch = /^([a-z]+)_(se|mm|avg)$/.exec(col.id);
  if (!metricMatch) {
    return {
      mainValue: '-',
      unit: '',
      isBoolean: false,
      booleanContent: null,
    };
  }

  const [, metricKey, partKey] = metricMatch;
  return {
    mainValue: getMetricCellValue(stats, metricKey, partKey),
    unit: CELL_METRIC_UNITS[metricKey] || '',
    isBoolean: false,
    booleanContent: null,
  };
}

function TargetDeltaDisplay({ targetVal, unit, subTextSize }) {
  return (
    <div
      style={subTextSize}
      className='text-base-content/55 mt-0.5 leading-tight font-medium tracking-normal whitespace-nowrap italic'
    >
      Target {targetVal} {unit}
    </div>
  );
}

function findPhaseTarget(phase, col) {
  const targets = Array.isArray(phase?.profilePhase?.targets) ? phase.profilePhase.targets : [];
  return targets.find(target => {
    if (col.id === 'weight') return target.type === 'weight' || target.type === 'volumetric';
    return target.type === col.targetType;
  });
}

function getTargetDisplay({ phase, col, unit, subTextSize }) {
  if (col.id === 'duration' && phase?.profilePhase?.duration > 0) {
    return (
      <TargetDeltaDisplay
        targetVal={phase.profilePhase.duration}
        unit={unit}
        subTextSize={subTextSize}
      />
    );
  }

  if (!col.targetType) return null;

  const target = findPhaseTarget(phase, col);
  if (!target) return null;

  return <TargetDeltaDisplay targetVal={target.value} unit={unit} subTextSize={subTextSize} />;
}

function getTargetCalcEntry(phase, col) {
  if (!col.targetType || !phase?.targetCalcValues) return null;
  return col.id === 'weight'
    ? phase.targetCalcValues.volumetric || phase.targetCalcValues.weight
    : phase.targetCalcValues[col.targetType];
}

function replaceCellValueWithCalc({ mainValue, calcEntry, col }) {
  if (!calcEntry) return mainValue;

  const calcValue = formatCellNumber(calcEntry.value);
  if (
    typeof mainValue === 'string' &&
    mainValue.includes('/') &&
    (col.type === 'se' || col.type === 'mm')
  ) {
    const parts = mainValue.split('/');
    return `${parts.slice(0, -1).join('/')}/${calcValue}`;
  }

  return calcValue;
}

function getWeightWarnings({ phase, isWeightCol, subTextSize }) {
  if (!isWeightCol) return [];

  const warnings = [];
  if (phase.scaleLost) {
    warnings.push(
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

  if (phase.highScaleDelay) {
    warnings.push(
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

  return warnings;
}

function renderTotalCellContent({ isBoolean, booleanContent, mainValue, unit }) {
  if (isBoolean) return <div className='flex justify-end'>{booleanContent}</div>;
  return (
    <span className='text-base-content/90 font-medium'>
      {mainValue} {unit}
    </span>
  );
}

function getCellHitState({ phase, col }) {
  if (col.id === 'weight') {
    return phase.exit?.type === 'weight' || phase.exit?.type === 'volumetric';
  }
  return phase.exit?.type === col.targetType;
}

function renderBooleanCellContent({ booleanContent, booleanAnomaly, subTextSize }) {
  return (
    <div className='flex h-full flex-col items-end justify-center pb-1'>
      <div className='flex items-center'>{booleanContent}</div>
      {booleanAnomaly && (
        <div
          style={subTextSize}
          className='text-base-content/55 mt-0.5 flex flex-col items-end leading-tight font-medium tracking-normal'
          title={`Sample ${booleanAnomaly.sampleInPhase}: ${String(booleanAnomaly.value)}`}
        >
          <span>
            Sample {booleanAnomaly.sampleInPhase}
            {Number.isFinite(booleanAnomaly.sampleCountInPhase)
              ? ` (${booleanAnomaly.sampleCountInPhase})`
              : ''}
          </span>
          <span className='text-base-content/55 font-normal'>{String(booleanAnomaly.value)}</span>
        </div>
      )}
    </div>
  );
}

function renderMetricCellValue({
  isHit,
  calcIsStopReason,
  mainValue,
  unit,
  mainValueIsCalculated,
}) {
  const isStopValue = mainValueIsCalculated ? calcIsStopReason : isHit && !calcIsStopReason;
  return (
    <span
      className={isStopValue ? 'font-normal' : 'text-base-content/90 font-medium'}
      style={isStopValue ? { color: utilityColors.stopRed } : {}}
    >
      {mainValue} {unit}
    </span>
  );
}

function CellContent({ phase, col, results, isTotal = false }) {
  const data = isTotal ? results?.total : phase;
  const stats = isTotal ? results?.total : phase?.stats;

  if (!data) return <span>-</span>;

  const { mainValue, unit, isBoolean, booleanContent } = resolveCellValue({
    data,
    stats,
    col,
    isSkipped: Boolean(phase?.skipped),
  });

  if (isTotal) {
    return renderTotalCellContent({ isBoolean, booleanContent, mainValue, unit });
  }

  const isWeightCol = col.id === 'weight';
  const isHit = getCellHitState({ phase, col });

  // Relative font sizing for sub-elements (0.85em) ensures they scale with zoom
  const subTextSize = { fontSize: '0.85em' };
  const booleanAnomaly = !isTotal && isBoolean ? stats?.sys_anomalies?.[col.id] : null;
  const calcEntry = getTargetCalcEntry(phase, col);
  const displayMainValue = !isBoolean
    ? replaceCellValueWithCalc({ mainValue, calcEntry, col })
    : mainValue;
  const mainValueIsCalculated = !isBoolean && Boolean(calcEntry);
  const targetDisplay = getTargetDisplay({
    phase,
    col,
    unit,
    subTextSize,
  });
  const calcIsStopReason = Boolean(calcEntry?.isStopReason);
  const warningDisplays = getWeightWarnings({ phase, isWeightCol, subTextSize });

  return (
    <div className='flex min-h-[2em] flex-col items-end justify-center'>
      {isBoolean
        ? renderBooleanCellContent({ booleanContent, booleanAnomaly, subTextSize })
        : renderMetricCellValue({
            isHit,
            calcIsStopReason,
            mainValue: displayMainValue,
            unit,
            mainValueIsCalculated,
          })}
      {targetDisplay}
      {warningDisplays}
    </div>
  );
}

// --- Status Badge Helper ---
function StatusBadge({ label, colorClass = '', style = {}, details }) {
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState(null);

  const updatePopoverPosition = useCallback(() => {
    const triggerElement = triggerRef.current;
    const browserWindow = globalThis.window;
    if (!triggerElement || !browserWindow) return;

    const viewportWidth = browserWindow.innerWidth || 0;
    const viewportHeight = browserWindow.innerHeight || 0;
    const scrollX = browserWindow.scrollX || browserWindow.pageXOffset || 0;
    const scrollY = browserWindow.scrollY || browserWindow.pageYOffset || 0;
    const triggerRect = triggerElement.getBoundingClientRect();
    const margin = 10;
    const width = Math.min(viewportWidth - margin * 2, 360);
    const left = Math.min(
      Math.max(margin, triggerRect.left),
      Math.max(margin, viewportWidth - width - margin),
    );
    const spaceAbove = triggerRect.top - margin;
    const spaceBelow = viewportHeight - triggerRect.bottom - margin;
    const openAbove = spaceBelow < 120 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(80, Math.min(viewportHeight - margin * 2, 220));

    setPopoverStyle({
      position: 'absolute',
      left: `${scrollX + left}px`,
      top: `${
        scrollY +
        (openAbove ? Math.max(margin, triggerRect.top - maxHeight - 8) : triggerRect.bottom + 8)
      }px`,
      width: `${width}px`,
      maxHeight: `${maxHeight}px`,
    });
  }, []);

  const closePopover = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return undefined;
    updatePopoverPosition();

    const handlePointerDown = event => {
      if (triggerRef.current?.contains(event.target)) return;
      if (popoverRef.current?.contains(event.target)) return;
      closePopover();
    };
    const handleKeyDown = event => {
      if (event.key === 'Escape') closePopover();
    };
    const handleResize = () => updatePopoverPosition();
    const handleScroll = event => {
      if (popoverRef.current?.contains(event.target)) return;
      closePopover();
    };

    globalThis.document?.addEventListener('pointerdown', handlePointerDown);
    globalThis.document?.addEventListener('keydown', handleKeyDown);
    globalThis.window?.addEventListener('resize', handleResize);
    globalThis.window?.addEventListener('scroll', handleScroll, { passive: true });
    globalThis.document?.addEventListener('scroll', handleScroll, true);

    return () => {
      globalThis.document?.removeEventListener('pointerdown', handlePointerDown);
      globalThis.document?.removeEventListener('keydown', handleKeyDown);
      globalThis.window?.removeEventListener('resize', handleResize);
      globalThis.window?.removeEventListener('scroll', handleScroll);
      globalThis.document?.removeEventListener('scroll', handleScroll, true);
    };
  }, [closePopover, isOpen, updatePopoverPosition]);

  const popoverContent =
    isOpen && details ? (
      <div
        ref={popoverRef}
        className='bg-base-100/95 border-base-content/10 text-base-content z-[10000] overflow-y-auto rounded-lg border p-2.5 text-xs leading-relaxed font-normal tracking-normal normal-case shadow-xl backdrop-blur-md'
        style={popoverStyle || { position: 'absolute', visibility: 'hidden' }}
      >
        <p className='text-base-content/90 mb-1 text-[12px] leading-tight font-medium tracking-normal'>
          {label}
        </p>
        <p className='text-base-content/55 leading-relaxed font-normal'>{details}</p>
      </div>
    ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type='button'
        className={`relative inline-flex items-center gap-1 rounded-t-md rounded-b-none border border-b-0 px-2.5 pt-1 pb-2 text-xs leading-none font-medium tracking-tight transition-[filter,background-color] duration-150 select-none hover:brightness-105 focus-visible:ring-2 focus-visible:ring-current focus-visible:outline-none ${colorClass}`}
        style={style}
        aria-expanded={isOpen}
        onClick={() => setIsOpen(current => !current)}
      >
        <span>{label}</span>
        <FontAwesomeIcon icon={faCircleInfo} className='text-[10px] opacity-80' />
      </button>
      {globalThis.document?.body ? createPortal(popoverContent, globalThis.document.body) : null}
    </>
  );
}

// --- Scroll Button Helper ---
const ScrollBtn = ({ icon, onClick, className = '', title }) => (
  <button
    onClick={onClick}
    title={title}
    className={getAnalyzerIconButtonClasses({
      className: `${ANALYZER_ACTION_ICON_BUTTON_CLASS} ${className}`,
    })}
  >
    <FontAwesomeIcon
      icon={icon}
      className={ANALYZER_ACTION_ICON_CLASS}
      style={ANALYZER_ACTION_ICON_STYLE}
    />
  </button>
);
