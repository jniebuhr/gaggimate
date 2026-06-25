/** Orchestrates the single- and compare-shot analysis table layouts. */

import { Fragment } from 'preact';
import { useRef } from 'preact/hooks';
import { cleanName, columnConfig } from '../../utils/analyzerUtils';
import { ColumnControls } from './ColumnControls';
import {
  AnalysisTableHeader,
  AnalysisTableToolbarActions,
  StatusBadge,
} from './AnalysisTableChrome';
import { CellContent, ComparePhaseLabel } from './AnalysisTableCells';
import {
  buildAnalysisWarningBadges,
  getCompareRowStyle,
  getMaxComparePhaseCount,
  hasAnalysisProfilePhaseStops,
} from './analysisTableModel';
import {
  ANALYSIS_SCROLLBAR_HIDE_STYLE,
  getAnalysisTouchInteractionStyle,
  scrollAnalysisTable,
  scrollAnalysisTableToBound,
  useTouchOptimizedPointer,
  useVerticalWheelForwarding,
} from './useAnalysisTableInteraction';

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
          style={{
            scrollBehavior: 'smooth',
            ...ANALYSIS_SCROLLBAR_HIDE_STYLE,
            ...touchInteractionStyle,
          }}
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
                            <ComparePhaseLabel phase={phase} results={entry.results} />
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
                        <ComparePhaseLabel phase={phase} results={results} />
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
