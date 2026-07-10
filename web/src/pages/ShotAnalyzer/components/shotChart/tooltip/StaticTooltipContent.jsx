import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  COMPARE_DETAIL_METRIC_PAGE_KEYS,
  SINGLE_METRIC_PAGE_KEYS,
  TOOLTIP_WATER_LABELS,
  UNIT_BY_LABEL,
  WATER_DRAWN_PHASE_LABEL,
  WATER_DRAWN_TOTAL_LABEL,
} from '../constants';
import { getShotChartDisplayLabel, getShotChartLabelIcon } from '../labelVisuals';
import { getTooltipRowTextKey } from './tooltipState';
import { TooltipShotBadge } from './TooltipPrimitives';

function StaticTooltipPhaseSummary({ phaseSummary, index }) {
  return (
    <div
      key={`${phaseSummary.shotLabel || ''}-${phaseSummary.phaseLabel}-${index}`}
      className='shot-chart-tooltip__static-phase-line'
    >
      <TooltipShotBadge
        shotNumber={phaseSummary.shotNumber}
        color={phaseSummary.color}
        className='shot-chart-tooltip__phase-badge'
      />
      {phaseSummary.shotLabel ? (
        <span className='shot-chart-tooltip__phase-shot'>{phaseSummary.shotLabel}</span>
      ) : null}
      {phaseSummary.phaseLabel ? (
        <span className='shot-chart-tooltip__static-phase-label'>{phaseSummary.phaseLabel}</span>
      ) : null}
      {phaseSummary.skipNotice ? (
        <span className='shot-chart-tooltip__phase-skip-notice'>{phaseSummary.skipNotice}</span>
      ) : null}
    </div>
  );
}

function StaticTooltipStopSummary({ phaseSummary, index }) {
  return (
    <div
      key={`${phaseSummary.shotLabel || ''}-${phaseSummary.phaseLabel}-${index}`}
      className='shot-chart-tooltip__static-wide-card shot-chart-tooltip__static-stop-card'
    >
      <div className='shot-chart-tooltip__static-stop-value'>
        {!phaseSummary.phaseLabel && phaseSummary.skipNotice ? (
          <span className='shot-chart-tooltip__phase-skip-notice'>{phaseSummary.skipNotice}</span>
        ) : null}
        {phaseSummary.stopReason ? (
          <span className='shot-chart-tooltip__phase-reason'>
            {phaseSummary.stopReason}
            {phaseSummary.stopValue ? ': ' : ''}
          </span>
        ) : null}
        {phaseSummary.stopValue}
        {phaseSummary.stopTargetValue ? (
          <span className='shot-chart-tooltip__phase-target'>
            {' '}
            · Target {phaseSummary.stopTargetValue}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function StaticTooltipMetricRow({ row, index }) {
  const rowIcon = getShotChartLabelIcon(row.label);
  const displayLabel = row.displayLabel || getShotChartDisplayLabel(row.label);

  return (
    <div
      key={`${row.shotLabel || ''}-${row.label}-${row.valueText}-${index}`}
      className='shot-chart-static-metrics__card shot-chart-tooltip__static-metric-card'
    >
      {rowIcon ? (
        <div
          className='shot-chart-static-metrics__icon'
          style={{ color: row.color }}
          aria-hidden='true'
        >
          <FontAwesomeIcon icon={rowIcon} />
        </div>
      ) : null}
      <div className='shot-chart-static-metrics__body'>
        <div className='shot-chart-static-metrics__label'>
          {row.shotLabel ? `${row.shotLabel} ` : ''}
          {displayLabel}
        </div>
        <div className='shot-chart-static-metrics__value-row'>
          <span className='shot-chart-static-metrics__value'>{row.valueText}</span>
        </div>
      </div>
    </div>
  );
}

function StaticCompactMetricRow({ hideShotLabel = false, row, index }) {
  if (row.isPlaceholder) {
    return (
      <div
        key={`placeholder-${index}`}
        className={[
          'shot-chart-tooltip__compact-metric-row',
          'shot-chart-tooltip__compact-metric-row--placeholder',
          row.spacerAfter ? 'shot-chart-tooltip__compact-metric-row--spacer-after' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-hidden='true'
      />
    );
  }

  const rowIcon = getShotChartLabelIcon(row.label);
  const displayLabel = row.displayLabel || getShotChartDisplayLabel(row.label);

  return (
    <div
      key={`${row.shotLabel || ''}-${row.label}-${row.valueText}-${index}`}
      className={[
        'shot-chart-tooltip__compact-metric-row',
        row.spacerAfter ? 'shot-chart-tooltip__compact-metric-row--spacer-after' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {rowIcon ? (
        <span
          className='shot-chart-tooltip__compact-metric-icon'
          style={{ color: row.color }}
          aria-hidden='true'
        >
          <FontAwesomeIcon icon={rowIcon} />
        </span>
      ) : null}
      <span className='shot-chart-tooltip__compact-metric-label'>
        {!hideShotLabel && row.shotLabel ? `${row.shotLabel} ` : ''}
        {displayLabel}
      </span>
      <span className='shot-chart-tooltip__compact-metric-value'>{row.valueText}</span>
    </div>
  );
}

function getCompactMetricRows({ isSingleLineVariant, rows }) {
  if (!isSingleLineVariant) return rows;
  return rows
    .filter(row => row.displayLabel !== 'Difference' && !TOOLTIP_WATER_LABELS.has(row.label))
    .slice(0, 2);
}

function getCompareLargeMetricRows({ metricContext = null, rows = [], variant }) {
  if (variant === 'comparePreview') {
    return rows.filter(row => !TOOLTIP_WATER_LABELS.has(row?.label));
  }

  if (variant !== 'singleLine') return rows;

  if (metricContext?.label === 'Pump Flow') {
    const activePage = metricContext.page || COMPARE_DETAIL_METRIC_PAGE_KEYS.PUMP_FLOW;
    const allowedLabel =
      activePage === COMPARE_DETAIL_METRIC_PAGE_KEYS.PUMPED_WATER
        ? WATER_DRAWN_PHASE_LABEL
        : 'Pump Flow';

    return rows.filter(row => row?.label === allowedLabel);
  }

  return getCompactMetricRows({ isSingleLineVariant: true, rows });
}

function getSinglePagedMetricRows({ metricContext = null, rows = [] }) {
  const pageKey = metricContext?.page || SINGLE_METRIC_PAGE_KEYS.BASICS;
  const labelsByPage = {
    [SINGLE_METRIC_PAGE_KEYS.BASICS]: ['Pressure', 'Pump Flow', 'Weight', 'Temp'],
    [SINGLE_METRIC_PAGE_KEYS.PRESSURE_FLOW]: ['Pressure', 'Target P', 'Pump Flow', 'Target F'],
    [SINGLE_METRIC_PAGE_KEYS.FLOW_VOLUME]: [
      'Weight',
      'Weight Flow',
      WATER_DRAWN_PHASE_LABEL,
      'Puck Flow',
    ],
    [SINGLE_METRIC_PAGE_KEYS.TEMPERATURE]: ['Temp', 'Target T'],
  };
  const orderedLabels = labelsByPage[pageKey] || labelsByPage[SINGLE_METRIC_PAGE_KEYS.BASICS];
  const orderIndexByLabel = new Map(orderedLabels.map((label, index) => [label, index]));

  return rows
    .filter(row => orderIndexByLabel.has(row?.label) && row?.label !== WATER_DRAWN_TOTAL_LABEL)
    .sort((a, b) => orderIndexByLabel.get(a.label) - orderIndexByLabel.get(b.label));
}

function getMobileCompactMetricRows(rows) {
  const compactRows = [];
  const spacerAfterLabels = new Set([
    'Pump Flow',
    'Target F',
    'Puck Flow',
    WATER_DRAWN_PHASE_LABEL,
    WATER_DRAWN_TOTAL_LABEL,
  ]);

  rows.forEach(row => {
    const rowWithSpacing = spacerAfterLabels.has(row.label) ? { ...row, spacerAfter: true } : row;
    compactRows.push(rowWithSpacing);
    if (row.label === 'Puck Flow') {
      compactRows.push({
        isPlaceholder: true,
        label: '__placeholder__',
        spacerAfter: true,
      });
    }
  });

  return compactRows;
}

function getCompactStopClassName({ differenceRow, isSingleLineVariant, stopSummary }) {
  const hasContent = isSingleLineVariant ? Boolean(differenceRow) : Boolean(stopSummary);
  return [
    'shot-chart-tooltip__compact-stop',
    isSingleLineVariant ? 'shot-chart-tooltip__compact-difference' : '',
    hasContent ? '' : 'shot-chart-tooltip__compact-stop--empty',
  ]
    .filter(Boolean)
    .join(' ');
}

function CompactDifferenceContent({ differenceRow }) {
  if (differenceRow) {
    return (
      <>
        <span className='shot-chart-tooltip__compact-difference-label'>Difference</span>
        <span className='shot-chart-tooltip__compact-difference-value'>
          {differenceRow.valueText}
        </span>
      </>
    );
  }
  return <span>Difference -</span>;
}

function buildStopLineText(summary) {
  const reason = summary.stopReason || '';
  const value = summary.stopValue || '';
  const separator = reason && value ? ': ' : '';
  return `${reason}${separator}${value}`;
}

function CompactStopLine({ summary, index }) {
  const stopText = buildStopLineText(summary);

  return (
    <div
      key={`${summary.shotLabel || ''}-${summary.phaseLabel || ''}-${index}`}
      className='shot-chart-tooltip__compact-stop-line'
    >
      <TooltipShotBadge
        shotNumber={summary.shotNumber}
        color={summary.color}
        className='shot-chart-tooltip__compact-stop-badge'
      />
      <span className='shot-chart-tooltip__compact-stop-text'>
        {summary.skipNotice ? (
          <span className='shot-chart-tooltip__phase-skip-notice'>{summary.skipNotice}</span>
        ) : null}
        {stopText ? <span className='shot-chart-tooltip__phase-reason'>{stopText}</span> : null}
        {summary.stopTargetValue ? (
          <span className='shot-chart-tooltip__phase-target'>
            {' '}
            · Target {summary.stopTargetValue}
          </span>
        ) : null}
      </span>
    </div>
  );
}

function CompactStopContent({ differenceRow, isSingleLineVariant, stopSummary, stopSummaries }) {
  if (isSingleLineVariant) {
    return <CompactDifferenceContent differenceRow={differenceRow} />;
  }

  if (stopSummary) {
    return (
      <div className='shot-chart-tooltip__compact-stop-list'>
        {stopSummaries.map((summary, index) => (
          <CompactStopLine
            key={`${summary.shotLabel || ''}-${summary.phaseLabel || ''}-${index}`}
            summary={summary}
            index={index}
          />
        ))}
      </div>
    );
  }

  return <span>Stop -</span>;
}

function getCompareShotSlots(items = []) {
  const byShotNumber = new Map(
    items
      .filter(item => item && Number.isFinite(Number(item.shotNumber)))
      .map(item => [Number(item.shotNumber), item]),
  );

  return [1, 2].map(shotNumber => byShotNumber.get(shotNumber) || null);
}

function CompareCompactPhaseGrid({ phaseSummaries }) {
  const phaseSlots = getCompareShotSlots(phaseSummaries);

  return (
    <div className='shot-chart-tooltip__compare-compact-phase-grid'>
      {phaseSlots.map((summary, index) => (
        <div
          key={`phase-${summary?.shotNumber || index}`}
          className='shot-chart-tooltip__compare-compact-phase'
        >
          {summary?.phaseLabel || '-'}
        </div>
      ))}
    </div>
  );
}

function CompareCompactStopColumn({ summary }) {
  const stopText = summary ? buildStopLineText(summary) : '';
  const targetText = summary?.stopTargetValue || '';

  return (
    <div className='shot-chart-tooltip__compare-compact-stop-column'>
      <div className='shot-chart-tooltip__compare-compact-stop-reason'>
        {summary?.skipNotice ? (
          <span className='shot-chart-tooltip__phase-skip-notice'>{summary.skipNotice}</span>
        ) : null}
        {stopText ? <span className='shot-chart-tooltip__phase-reason'>{stopText}</span> : '-'}
      </div>
      <div className='shot-chart-tooltip__compare-compact-stop-target'>
        {targetText ? `Target ${targetText}` : ''}
      </div>
    </div>
  );
}

function CompareCompactStopGrid({ stopSummaries }) {
  const stopSlots = getCompareShotSlots(stopSummaries);
  const hasStopContent = stopSlots.some(
    summary =>
      summary?.skipNotice || summary?.stopReason || summary?.stopValue || summary?.stopTargetValue,
  );

  if (!hasStopContent) return null;

  return (
    <div className='shot-chart-tooltip__compare-compact-stop-grid'>
      {stopSlots.map((summary, index) => (
        <CompareCompactStopColumn key={`stop-${summary?.shotNumber || index}`} summary={summary} />
      ))}
    </div>
  );
}

function splitCompareMetricValue(row) {
  const unit = UNIT_BY_LABEL[row?.label] || '';
  const valueText = row?.valueText || '-';

  if (!unit || valueText === '-') {
    return { unit: '', value: valueText };
  }

  const unitSuffix = ` ${unit}`;
  if (valueText.endsWith(unitSuffix)) {
    return {
      unit,
      value: valueText.slice(0, -unitSuffix.length),
    };
  }

  return { unit, value: valueText };
}

function getCompareLargeMetricSlots({ metricContext = null, rows = [], variant }) {
  const metricRows = getCompareLargeMetricRows({ metricContext, rows, variant }).filter(
    row => row && !row.isPlaceholder && row.displayLabel !== 'Difference',
  );
  const rowsByShotOrder = new Map();

  metricRows.forEach(row => {
    const shotOrder = Number.isFinite(Number(row.shotOrder)) ? Number(row.shotOrder) : null;
    if (shotOrder === null || shotOrder < 0 || shotOrder > 1) return;
    if (!rowsByShotOrder.has(shotOrder)) rowsByShotOrder.set(shotOrder, []);
    rowsByShotOrder.get(shotOrder).push(row);
  });

  return [0, 1].map(shotOrder => ({
    key: `shot-${shotOrder + 1}`,
    rows: rowsByShotOrder.get(shotOrder) || [],
  }));
}

function CompareLargeMetricValue({ row, showIcon = true }) {
  const { unit, value } = splitCompareMetricValue(row);
  const displayLabel = row.displayLabel || getShotChartDisplayLabel(row.label);
  const metricIcon = getShotChartLabelIcon(row.label);
  const shouldShowIcon = showIcon && Boolean(metricIcon);

  return (
    <div
      className={[
        'shot-chart-compare-mobile-metric',
        'analyzer-icon-metric',
        shouldShowIcon ? '' : 'analyzer-icon-metric--without-icon',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {shouldShowIcon ? (
        <span
          className='analyzer-icon-metric__icon'
          style={{ color: row.color }}
          aria-hidden='true'
        >
          <FontAwesomeIcon icon={metricIcon} />
        </span>
      ) : null}
      <div className='analyzer-icon-metric__content'>
        <div className='shot-chart-compare-mobile-metric__value-row'>
          <span className='analyzer-icon-metric__value shot-chart-compare-mobile-metric__value'>
            {value}
          </span>
          {unit ? <span className='shot-chart-compare-mobile-metric__unit'>{unit}</span> : null}
        </div>
        <div className='shot-chart-compare-mobile-metric__label'>{displayLabel}</div>
      </div>
    </div>
  );
}

function SinglePagedContext({ state }) {
  const phaseSummary = (state.phaseSummaries || []).find(
    summary => summary.phaseLabel || summary.skipNotice || summary.stopReason || summary.stopValue,
  );
  const timeLabel = state.titleLines?.[0] || '';
  const stopText = phaseSummary ? buildStopLineText(phaseSummary) : '';
  const targetText = phaseSummary?.stopTargetValue || '';

  return (
    <div className='shot-chart-tooltip__single-paged-context'>
      <div className='shot-chart-tooltip__single-paged-time'>
        {timeLabel ? <span>{timeLabel}</span> : null}
      </div>
      <div className='shot-chart-tooltip__single-paged-phase'>
        {phaseSummary?.phaseLabel || '-'}
      </div>
      <div className='shot-chart-tooltip__single-paged-stop'>
        {phaseSummary?.skipNotice ? (
          <span className='shot-chart-tooltip__phase-skip-notice'>{phaseSummary.skipNotice}</span>
        ) : null}
        {stopText ? <span className='shot-chart-tooltip__phase-reason'>{stopText}</span> : '-'}
      </div>
      <div className='shot-chart-tooltip__single-paged-target'>
        {targetText ? `Target ${targetText}` : ''}
      </div>
    </div>
  );
}

function SinglePagedMetricList({ metricContext = null, rows }) {
  const metricRows = getSinglePagedMetricRows({ metricContext, rows }).filter(
    row => row && !row.isPlaceholder,
  );

  if (metricRows.length === 0) return null;

  return (
    <div className='shot-chart-tooltip__single-paged-metric-grid'>
      {metricRows.map((row, index) => (
        <CompareLargeMetricValue
          key={`${row.label}-${row.valueText}-${index}`}
          row={{
            ...row,
            displayLabel: row.displayLabel || getShotChartDisplayLabel(row.label),
          }}
        />
      ))}
    </div>
  );
}

function StaticSinglePagedTooltipContent({ metricContext = null, state }) {
  return (
    <div className='shot-chart-tooltip__compact-content shot-chart-tooltip__compact-content--single-paged-active'>
      <SinglePagedContext state={state} />
      <SinglePagedMetricList metricContext={metricContext} rows={state.rows} />
    </div>
  );
}

function StaticStatisticsCompactTooltipContent({ state }) {
  const timeLabel = state.titleLines?.[0] || '';

  return (
    <div className='shot-chart-tooltip__compact-content shot-chart-tooltip__compact-content--statistics-active'>
      {timeLabel ? (
        <span className='shot-chart-tooltip__single-paged-time'>{timeLabel}</span>
      ) : null}
    </div>
  );
}

function CompareCompactMetricList({ metricContext = null, rows, variant }) {
  const metricSlots = getCompareLargeMetricSlots({ metricContext, rows, variant });
  const hasMetrics = metricSlots.some(slot => slot.rows.length > 0);

  if (!hasMetrics) return null;

  return (
    <div
      className={[
        'shot-chart-tooltip__compare-large-metric-grid',
        variant === 'singleLine' ? 'shot-chart-tooltip__compare-large-metric-grid--detail' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {metricSlots.map(slot => (
        <div key={slot.key} className='shot-chart-tooltip__compare-large-metric-column'>
          {slot.rows.map(row => (
            <CompareLargeMetricValue
              key={getTooltipRowTextKey(row)}
              row={row}
              showIcon={variant !== 'singleLine'}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function StaticCompareCompactTooltipContent({ metricContext = null, state, variant }) {
  const phaseSummaries = (state.phaseSummaries || []).filter(summary => summary.phaseLabel);
  const stopSummaries = (state.phaseSummaries || []).filter(
    summary => summary.skipNotice || summary.stopReason || summary.stopValue,
  );
  const timeLabel = state.titleLines?.[0] || '';

  return (
    <div
      className={[
        'shot-chart-tooltip__compact-content',
        'shot-chart-tooltip__compact-content--compare-active',
        variant === 'singleLine'
          ? 'shot-chart-tooltip__compact-content--compare-detail-active'
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className='shot-chart-tooltip__compare-compact-time'>
        {timeLabel ? <span>{timeLabel}</span> : null}
      </div>
      <CompareCompactPhaseGrid phaseSummaries={phaseSummaries} />
      {variant === 'comparePreview' ? (
        <CompareCompactStopGrid stopSummaries={stopSummaries} />
      ) : null}
      <CompareCompactMetricList metricContext={metricContext} rows={state.rows} variant={variant} />
    </div>
  );
}

export function StaticCompactTooltipContent({ metricContext = null, state, variant = 'default' }) {
  if (variant === 'singlePaged') {
    return <StaticSinglePagedTooltipContent metricContext={metricContext} state={state} />;
  }

  if (variant === 'statisticsCompact') {
    return <StaticStatisticsCompactTooltipContent state={state} />;
  }

  if (variant === 'comparePreview' || variant === 'singleLine') {
    return (
      <StaticCompareCompactTooltipContent
        metricContext={metricContext}
        state={state}
        variant={variant}
      />
    );
  }

  const phaseSummary = (state.phaseSummaries || []).find(
    summary => summary.phaseLabel || summary.shotLabel,
  );
  const stopSummaries = (state.phaseSummaries || []).filter(
    summary => summary.skipNotice || summary.stopReason || summary.stopValue,
  );
  const stopSummary = stopSummaries[0] || null;
  const isSingleLineVariant = variant === 'singleLine';
  const isTitleOnlyVariant = variant === 'titleOnly';
  const hideShotLabelInMetricRows = variant === 'comparePreview' || variant === 'singleLine';
  const shouldShowPhaseLabel = !isTitleOnlyVariant && Boolean(phaseSummary?.phaseLabel);
  const differenceRow = isSingleLineVariant
    ? state.rows.find(row => row.displayLabel === 'Difference')
    : null;
  const metricRows = isSingleLineVariant
    ? getCompactMetricRows({ isSingleLineVariant, rows: state.rows })
    : getMobileCompactMetricRows(state.rows);
  const shouldShowMetricRows = !isTitleOnlyVariant && metricRows.length > 0;
  const timeLabel = state.titleLines?.[0] || '';
  const stopContent = isTitleOnlyVariant ? null : (
    <div className={getCompactStopClassName({ differenceRow, isSingleLineVariant, stopSummary })}>
      <CompactStopContent
        differenceRow={differenceRow}
        isSingleLineVariant={isSingleLineVariant}
        stopSummary={stopSummary}
        stopSummaries={stopSummaries}
      />
    </div>
  );
  const metricContent = shouldShowMetricRows ? (
    <div className='shot-chart-tooltip__compact-metric-list'>
      {metricRows.map((row, index) => (
        <StaticCompactMetricRow
          key={`${row.shotLabel || ''}-${row.label}-${row.valueText}-${index}`}
          hideShotLabel={hideShotLabelInMetricRows}
          row={row}
          index={index}
        />
      ))}
    </div>
  ) : null;

  return (
    <div
      className={[
        'shot-chart-tooltip__compact-content',
        isSingleLineVariant ? 'shot-chart-tooltip__compact-content--single-line' : '',
        isTitleOnlyVariant ? 'shot-chart-tooltip__compact-content--title-only' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className='shot-chart-tooltip__compact-heading'>
        {timeLabel ? <span className='shot-chart-tooltip__compact-time'>{timeLabel}</span> : null}
        {shouldShowPhaseLabel ? (
          <span className='shot-chart-tooltip__compact-phase'>{phaseSummary.phaseLabel}</span>
        ) : null}
      </div>
      {isSingleLineVariant ? metricContent : stopContent}
      {isSingleLineVariant ? stopContent : metricContent}
    </div>
  );
}

export function StaticTooltipContent({ state }) {
  const phaseSummaries = (state.phaseSummaries || []).filter(
    summary => summary.phaseLabel || summary.shotLabel,
  );
  const stopSummaries = (state.phaseSummaries || []).filter(
    summary => summary.skipNotice || summary.stopReason || summary.stopValue,
  );

  return (
    <div className='shot-chart-tooltip__static-content'>
      <div className='shot-chart-tooltip__static-wide-card shot-chart-tooltip__static-context-card'>
        {state.titleLines.length > 0 ? (
          <div className='shot-chart-tooltip__static-time'>
            {state.titleLines.map((titleLine, index) => (
              <span key={`${titleLine}-${index}`}>{titleLine}</span>
            ))}
          </div>
        ) : null}
        {phaseSummaries.length > 0 ? (
          <div className='shot-chart-tooltip__static-phase-list'>
            {phaseSummaries.map((phaseSummary, index) => (
              <StaticTooltipPhaseSummary
                key={`${phaseSummary.shotLabel || ''}-${phaseSummary.phaseLabel}-${index}`}
                phaseSummary={phaseSummary}
                index={index}
              />
            ))}
          </div>
        ) : null}
      </div>
      {stopSummaries.length > 0 ? (
        <div className='shot-chart-tooltip__static-stop-list'>
          {stopSummaries.map((phaseSummary, index) => (
            <StaticTooltipStopSummary
              key={`${phaseSummary.shotLabel || ''}-${phaseSummary.phaseLabel}-${index}`}
              phaseSummary={phaseSummary}
              index={index}
            />
          ))}
        </div>
      ) : null}
      {state.rows.length > 0 ? (
        <div className='shot-chart-tooltip__static-value-grid'>
          {state.rows.map((row, index) => (
            <StaticTooltipMetricRow
              key={`${row.shotLabel || ''}-${row.label}-${row.valueText}-${index}`}
              row={row}
              index={index}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
