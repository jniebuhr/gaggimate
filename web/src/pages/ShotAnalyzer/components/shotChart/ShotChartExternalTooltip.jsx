import { useLayoutEffect } from 'preact/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  COMPARE_DETAIL_METRIC_PAGE_KEYS,
  EXTERNAL_TOOLTIP_FALLBACK_OFFSET_X,
  SINGLE_METRIC_PAGE_KEYS,
  TOOLTIP_GROUP_BY_LABEL,
  TOOLTIP_INDEX,
  TOOLTIP_WATER_LABELS,
  UNIT_BY_LABEL,
  WATER_DRAWN_PHASE_LABEL,
  WATER_DRAWN_TOTAL_LABEL,
} from './constants';
import { computeExternalTooltipPosition } from './helpers';
import { getShotChartDisplayLabel, getShotChartLabelIcon } from './labelVisuals';

function getTooltipRowTextKey(row) {
  return `${row?.shotLabel || ''}|${row?.label || ''}|${row?.displayLabel || ''}|${row?.valueText || ''}|${
    row?.color || ''
  }|${row?.spacerBefore ? '1' : '0'}`;
}

function getPhaseSummaryKey(summary) {
  return `${summary?.shotLabel || ''}|${summary?.shotNumber || ''}|${summary?.phaseLabel || ''}|${
    summary?.skipNotice || ''
  }|${
    summary?.stopReason || ''
  }|${summary?.stopValue || ''}|${summary?.stopTargetValue || ''}|${summary?.color || ''}`;
}

export function createHiddenExternalTooltipState() {
  return {
    visible: false,
    titleLines: [],
    phaseSummaries: [],
    rows: [],
    anchorX: 0,
    anchorY: 0,
    chartWidth: 0,
    chartHeight: 0,
    chartAreaLeft: 0,
    chartAreaRight: 0,
    chartAreaTop: 0,
    chartAreaBottom: 0,
    tooltipBoundsLeft: null,
    tooltipBoundsRight: null,
    tooltipBoundsTop: null,
    tooltipBoundsBottom: null,
  };
}

export function createHiddenExternalTooltipLayout() {
  return {
    visible: false,
    x: 0,
    y: 0,
  };
}

function areStringArraysEqual(a = [], b = []) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function areTooltipRowsEqual(a = [], b = []) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (getTooltipRowTextKey(a[i]) !== getTooltipRowTextKey(b[i])) return false;
  }
  return true;
}

function arePhaseSummariesEqual(a = [], b = []) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (getPhaseSummaryKey(a[i]) !== getPhaseSummaryKey(b[i])) return false;
  }
  return true;
}

export function areTooltipStatesEqual(a, b) {
  if (!a || !b) return false;
  return (
    a.visible === b.visible &&
    a.anchorX === b.anchorX &&
    a.anchorY === b.anchorY &&
    a.chartWidth === b.chartWidth &&
    a.chartHeight === b.chartHeight &&
    a.chartAreaLeft === b.chartAreaLeft &&
    a.chartAreaRight === b.chartAreaRight &&
    a.chartAreaTop === b.chartAreaTop &&
    a.chartAreaBottom === b.chartAreaBottom &&
    a.tooltipBoundsLeft === b.tooltipBoundsLeft &&
    a.tooltipBoundsRight === b.tooltipBoundsRight &&
    a.tooltipBoundsTop === b.tooltipBoundsTop &&
    a.tooltipBoundsBottom === b.tooltipBoundsBottom &&
    areStringArraysEqual(a.titleLines, b.titleLines) &&
    arePhaseSummariesEqual(a.phaseSummaries, b.phaseSummaries) &&
    areTooltipRowsEqual(a.rows, b.rows)
  );
}

function areTooltipLayoutsEqual(a, b) {
  if (!a || !b) return false;
  return a.visible === b.visible && a.x === b.x && a.y === b.y;
}

function getFiniteTooltipBound(primaryBound, fallbackBound) {
  if (Number.isFinite(primaryBound)) return primaryBound;
  if (Number.isFinite(fallbackBound)) return fallbackBound;
  return undefined;
}

export function shouldRenderTooltipLabel(label) {
  return Boolean(label) && label !== 'Phases' && label !== 'Stops';
}

export function sortTooltipItems(a, b) {
  return (TOOLTIP_INDEX[a?.dataset?.label] ?? 999) - (TOOLTIP_INDEX[b?.dataset?.label] ?? 999);
}

function findClosestPointAtX(dataPoints, xValue) {
  if (!Array.isArray(dataPoints) || dataPoints.length === 0 || !Number.isFinite(xValue)) {
    return null;
  }

  let low = 0;
  let high = dataPoints.length - 1;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const midX = Number(dataPoints[mid]?.x);

    if (!Number.isFinite(midX) || midX < xValue) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  const candidateIndexes = [low - 1, low, low + 1];
  let bestPoint = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  candidateIndexes.forEach(index => {
    if (index < 0 || index >= dataPoints.length) return;
    const point = dataPoints[index];
    const pointX = Number(point?.x);
    const pointY = Number(point?.y);

    if (!Number.isFinite(pointX) || !Number.isFinite(pointY)) return;

    const distance = Math.abs(pointX - xValue);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestPoint = point;
    }
  });

  return bestPoint;
}

function getTooltipGroupKey(label) {
  return TOOLTIP_GROUP_BY_LABEL[label] || null;
}

function buildCompareDifferenceRow(rows) {
  if (!Array.isArray(rows) || rows.length !== 2) return null;

  const [firstRow, secondRow] = [...rows].sort((a, b) => a.shotOrder - b.shotOrder);
  if (!Number.isFinite(firstRow?.numericValue) || !Number.isFinite(secondRow?.numericValue)) {
    return null;
  }

  const delta = secondRow.numericValue - firstRow.numericValue;
  const unit = UNIT_BY_LABEL[firstRow.label];
  const deltaPrefix = delta > 0 ? '+' : '';
  const deltaSuffix = unit ? ` ${unit}` : '';
  const formattedValue = `${deltaPrefix}${delta.toFixed(1)}${deltaSuffix}`;

  return {
    label: firstRow.label,
    displayLabel: 'Difference',
    valueText: formattedValue,
    color: firstRow.color,
    spacerBefore: true,
  };
}

function buildCompareWaterRows({ shotLabel, shotOrder, phaseWaterMl, totalWaterMl, color }) {
  return [
    {
      shotLabel,
      shotOrder,
      label: WATER_DRAWN_PHASE_LABEL,
      displayLabel: getShotChartDisplayLabel(WATER_DRAWN_PHASE_LABEL),
      valueText: Number.isFinite(phaseWaterMl) ? `${phaseWaterMl.toFixed(1)} ml` : '-',
      color,
    },
    {
      shotLabel,
      shotOrder,
      label: WATER_DRAWN_TOTAL_LABEL,
      displayLabel: getShotChartDisplayLabel(WATER_DRAWN_TOTAL_LABEL),
      valueText: Number.isFinite(totalWaterMl) ? `${totalWaterMl.toFixed(1)} ml` : '-',
      color,
    },
  ];
}

function resolveTooltipAnchorX(chart, tooltip) {
  if (Number.isFinite(chart.$fixedTooltipPointerX)) return chart.$fixedTooltipPointerX;
  if (Number.isFinite(tooltip.caretX)) return tooltip.caretX;
  return chart.chartArea.left + EXTERNAL_TOOLTIP_FALLBACK_OFFSET_X;
}

function resolveTooltipAnchorY(chart, tooltip) {
  if (Number.isFinite(chart.$fixedTooltipPointerY)) return chart.$fixedTooltipPointerY;
  if (Number.isFinite(tooltip.caretY)) return tooltip.caretY;
  return chart.chartArea.top;
}

function buildTooltipRowModel(tooltipItem, getHoverWaterValuesAtX, tooltipColorByLabel) {
  const label = tooltipItem?.dataset?.label;
  if (!label || !shouldRenderTooltipLabel(label)) return null;

  let valueText = null;
  if (TOOLTIP_WATER_LABELS.has(label)) {
    const xValue = tooltipItem.parsed?.x;
    const { totalWaterMl, phaseWaterMl } = getHoverWaterValuesAtX(xValue);
    const waterValue = label === WATER_DRAWN_PHASE_LABEL ? phaseWaterMl : totalWaterMl;
    valueText = Number.isFinite(waterValue) ? `${waterValue.toFixed(1)} ml` : '-';
  } else {
    const value = tooltipItem.parsed?.y;
    if (value === null || value === undefined) return null;
    const unit = UNIT_BY_LABEL[label];
    valueText = unit ? `${value.toFixed(1)} ${unit}` : `${value.toFixed(1)}`;
  }

  return {
    label,
    valueText,
    color: tooltipColorByLabel[label] || '#94a3b8',
    spacerBefore: false,
  };
}

function buildExternalTooltipRows(tooltipItems, getHoverWaterValuesAtX, tooltipColorByLabel) {
  const sortedItems = [...(tooltipItems || [])]
    .filter(item => shouldRenderTooltipLabel(item?.dataset?.label))
    .sort(sortTooltipItems);

  let previousGroupKey = null;

  return sortedItems.reduce((rows, item) => {
    const row = buildTooltipRowModel(item, getHoverWaterValuesAtX, tooltipColorByLabel);
    if (!row) return rows;

    const groupKey = getTooltipGroupKey(row.label);
    if (previousGroupKey !== null && groupKey !== null && groupKey !== previousGroupKey) {
      row.spacerBefore = true;
    }

    if (groupKey !== null) previousGroupKey = groupKey;
    rows.push(row);
    return rows;
  }, []);
}

function buildCompareExternalTooltipRows({ chart, xValue }) {
  if (!chart || !Number.isFinite(xValue)) return [];

  const datasets = Array.isArray(chart.data?.datasets) ? chart.data.datasets : [];
  const waterByShotOrder = new Map();

  // Compare tooltips are grouped by metric first so Shot 1 / Shot 2 values sit
  // directly next to each other before the optional difference row.
  const compareRows = datasets
    .map((dataset, datasetIndex) => {
      if (!dataset?.compareTooltipBaseLabel || !chart.isDatasetVisible(datasetIndex)) {
        return null;
      }

      const point = findClosestPointAtX(dataset.data, xValue);
      if (!point) return null;

      const baseLabel = dataset.compareTooltipBaseLabel;
      const value = Number(point.y);
      if (!Number.isFinite(value)) return null;

      const shotOrder = Number.isFinite(dataset.compareTooltipShotOrder)
        ? dataset.compareTooltipShotOrder
        : 999;
      const shotLabel = `Shot ${shotOrder + 1}`;
      const waterGetter = dataset.compareTooltipGetHoverWaterValuesAtX;
      if (typeof waterGetter === 'function' && !waterByShotOrder.has(shotOrder)) {
        const { totalWaterMl, phaseWaterMl } = waterGetter(xValue);
        waterByShotOrder.set(shotOrder, {
          shotLabel,
          shotOrder,
          phaseWaterMl,
          totalWaterMl,
          color: dataset.borderColor || '#94a3b8',
        });
      }

      const unit = UNIT_BY_LABEL[baseLabel];
      return {
        shotLabel,
        shotOrder,
        label: baseLabel,
        numericValue: value,
        displayLabel: getShotChartDisplayLabel(baseLabel),
        valueText: unit ? `${value.toFixed(1)} ${unit}` : `${value.toFixed(1)}`,
        color: dataset.borderColor || '#94a3b8',
      };
    })
    .filter(Boolean);

  waterByShotOrder.forEach(waterValues => {
    compareRows.push(...buildCompareWaterRows(waterValues));
  });

  compareRows.sort((a, b) => {
    const labelOrder = (TOOLTIP_INDEX[a.label] ?? 999) - (TOOLTIP_INDEX[b.label] ?? 999);
    if (labelOrder !== 0) return labelOrder;
    return a.shotOrder - b.shotOrder;
  });

  const groupedRows = compareRows.reduce((groups, row) => {
    const lastGroup = groups[groups.length - 1];
    if (!lastGroup || lastGroup[0]?.label !== row.label) {
      groups.push([row]);
      return groups;
    }
    lastGroup.push(row);
    return groups;
  }, []);

  return groupedRows.flatMap((rows, groupIndex) => {
    const normalizedRows = rows.map((row, rowIndex) => ({
      ...row,
      spacerBefore: groupIndex > 0 && rowIndex === 0,
    }));

    if (!chart.$compareTooltipShowDifference) {
      return normalizedRows;
    }

    const differenceRow = buildCompareDifferenceRow(rows);
    return differenceRow ? [...normalizedRows, differenceRow] : normalizedRows;
  });
}

function resolveCompareXValue(chart, tooltip, tooltipItems, isCompareTooltipMode) {
  if (!isCompareTooltipMode) return null;
  if (Number.isFinite(chart?.$fixedTooltipXValue)) return chart.$fixedTooltipXValue;
  if (Number.isFinite(tooltipItems[0]?.parsed?.x)) return tooltipItems[0].parsed.x;

  const scaleXValue = chart.scales?.x?.getValueForPixel?.(tooltip.caretX);
  return Number.isFinite(scaleXValue) ? scaleXValue : null;
}

function resolveTooltipRows({
  tooltipMode,
  chart,
  compareXValue,
  tooltipItems,
  getHoverWaterValuesAtX,
  tooltipColorByLabel,
}) {
  if (tooltipMode === 'compare') {
    return buildCompareExternalTooltipRows({ chart, xValue: compareXValue });
  }
  if (tooltipMode === 'compareTitleOnly') {
    return [];
  }
  return buildExternalTooltipRows(tooltipItems, getHoverWaterValuesAtX, tooltipColorByLabel);
}

function resolveSingleXValue(chart, tooltip, tooltipItems) {
  if (Number.isFinite(chart?.$fixedTooltipXValue)) return chart.$fixedTooltipXValue;
  if (Number.isFinite(tooltipItems?.[0]?.parsed?.x)) return tooltipItems[0].parsed.x;
  const scaleXValue = chart?.scales?.x?.getValueForPixel?.(tooltip?.caretX);
  return Number.isFinite(scaleXValue) ? scaleXValue : null;
}

function findPhaseRowAtX(rows, xValue) {
  if (!Array.isArray(rows) || !Number.isFinite(xValue)) return null;

  let closestRow = null;
  let closestDistance = 0.25;

  rows.forEach(row => {
    const start = Number(row?.start);
    const end = Number(row?.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return;

    if (xValue >= start && xValue <= end) {
      closestRow = row;
      closestDistance = 0;
      return;
    }

    const distance = Math.max(0, start - xValue, xValue - end);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestRow = row;
    }
  });

  return closestRow;
}

function buildPhaseTooltipSummaries({ xValue, phaseTooltipGroups, showPhaseNames, showStops }) {
  if (!showPhaseNames && !showStops) return [];
  if (!Array.isArray(phaseTooltipGroups) || phaseTooltipGroups.length === 0) return [];

  return phaseTooltipGroups.reduce((summaries, group) => {
    const row = findPhaseRowAtX(group?.rows, xValue);
    if (!row) return summaries;

    const phaseNumber = row.phaseNumber;
    const phaseName = showPhaseNames ? row.phaseName || '' : '';
    const phaseLabel = showPhaseNames ? buildPhaseLabel(phaseNumber, phaseName) : '';
    const skipNotice = showStops ? row.skipNotice || '' : '';
    const stopReason = showStops ? row.stopReason || '' : '';
    const stopValue = showStops ? row.stopValue || '' : '';
    const stopTargetValue = showStops ? row.stopTargetValue || '' : '';

    if (!phaseLabel && !skipNotice && !stopReason && !stopValue && !stopTargetValue) {
      return summaries;
    }

    summaries.push({
      phaseLabel,
      skipNotice,
      stopReason: stopReason && stopReason !== '-' ? stopReason : '',
      stopValue: stopValue && stopValue !== '-' ? stopValue : '',
      stopTargetValue,
      shotLabel: group.shotLabel || '',
      shotNumber: group.shotNumber ?? null,
      color: group.color || null,
    });
    return summaries;
  }, []);
}

function buildPhaseLabel(phaseNumber, phaseName) {
  if (!phaseName) return `Phase ${phaseNumber}`;
  return `Phase ${phaseNumber}: ${phaseName}`;
}

function resolveTitleLines({ isCompareTooltipMode, compareXValue, tooltip }) {
  if (isCompareTooltipMode) {
    return Number.isFinite(compareXValue) ? [`${compareXValue.toFixed(2)} s`] : [];
  }

  return Array.isArray(tooltip.title)
    ? tooltip.title.filter(title => typeof title === 'string' && title.trim().length > 0)
    : [];
}

export function buildExternalTooltipState({
  chart,
  tooltip,
  getHoverWaterValuesAtX,
  tooltipColorByLabel,
  tooltipMode = 'single',
  phaseTooltipGroups = [],
  showPhaseNames = true,
  showStops = true,
}) {
  // Chart.js still drives hit-testing, but the visible tooltip is rendered as HTML for richer layout control.
  if (!tooltip || tooltip.opacity === 0 || !chart.chartArea) {
    return createHiddenExternalTooltipState();
  }

  const tooltipItems = Array.isArray(tooltip.dataPoints) ? tooltip.dataPoints : [];
  const isCompareTooltipMode = tooltipMode === 'compare' || tooltipMode === 'compareTitleOnly';
  const compareXValue = resolveCompareXValue(chart, tooltip, tooltipItems, isCompareTooltipMode);
  const tooltipXValue = isCompareTooltipMode
    ? compareXValue
    : resolveSingleXValue(chart, tooltip, tooltipItems);
  const rows = resolveTooltipRows({
    tooltipMode,
    chart,
    compareXValue,
    tooltipItems,
    getHoverWaterValuesAtX,
    tooltipColorByLabel,
  });
  const titleLines = resolveTitleLines({
    isCompareTooltipMode,
    compareXValue,
    tooltip,
  });
  const phaseSummaries = buildPhaseTooltipSummaries({
    xValue: tooltipXValue,
    phaseTooltipGroups,
    showPhaseNames,
    showStops,
  });

  if (rows.length === 0 && titleLines.length === 0 && phaseSummaries.length === 0) {
    return createHiddenExternalTooltipState();
  }

  return {
    visible: true,
    titleLines,
    phaseSummaries,
    rows,
    anchorX: resolveTooltipAnchorX(chart, tooltip),
    anchorY: resolveTooltipAnchorY(chart, tooltip),
    chartWidth: chart.width,
    chartHeight: chart.height,
    chartAreaLeft: chart.chartArea.left,
    chartAreaRight: chart.chartArea.right,
    chartAreaTop: chart.chartArea.top,
    chartAreaBottom: chart.chartArea.bottom,
    tooltipBoundsLeft: chart.chartArea.left,
    tooltipBoundsRight: chart.chartArea.right,
    tooltipBoundsTop: chart.chartArea.top,
    tooltipBoundsBottom: chart.chartArea.bottom,
  };
}

function getExternalTooltipLayout({
  tooltipState,
  tooltipWidth,
  tooltipHeight,
  fallbackWidth,
  fallbackHeight,
}) {
  if (!tooltipState.visible) {
    return createHiddenExternalTooltipLayout();
  }

  // Clamp the floating tooltip into the main chart container so it never escapes the chart bounds.
  return computeExternalTooltipPosition({
    anchorX: tooltipState.anchorX,
    anchorY: tooltipState.anchorY,
    chartWidth: tooltipState.chartWidth || fallbackWidth || 0,
    chartHeight: tooltipState.chartHeight || fallbackHeight || 0,
    tooltipWidth,
    tooltipHeight,
    boundsLeft: getFiniteTooltipBound(tooltipState.tooltipBoundsLeft, tooltipState.chartAreaLeft),
    boundsRight: getFiniteTooltipBound(
      tooltipState.tooltipBoundsRight,
      tooltipState.chartAreaRight,
    ),
    boundsTop: getFiniteTooltipBound(tooltipState.tooltipBoundsTop, tooltipState.chartAreaTop),
    boundsBottom: getFiniteTooltipBound(
      tooltipState.tooltipBoundsBottom,
      tooltipState.chartAreaBottom,
    ),
  });
}

export function useMeasuredExternalTooltipLayout({
  containerRef,
  disabled,
  setTooltipLayout,
  tooltipRef,
  tooltipState,
}) {
  useLayoutEffect(() => {
    if (disabled || !tooltipState.visible) {
      setTooltipLayout(previousLayout => {
        const hiddenLayout = createHiddenExternalTooltipLayout();
        return areTooltipLayoutsEqual(previousLayout, hiddenLayout) ? previousLayout : hiddenLayout;
      });
      return;
    }

    const tooltipElement = tooltipRef.current;
    const containerElement = containerRef.current;
    if (!tooltipElement || !containerElement) return;

    const nextLayout = getExternalTooltipLayout({
      tooltipState,
      tooltipWidth: tooltipElement.offsetWidth || 0,
      tooltipHeight: tooltipElement.offsetHeight || 0,
      fallbackWidth: tooltipState.chartWidth || containerElement.clientWidth || 0,
      fallbackHeight: tooltipState.chartHeight || containerElement.clientHeight || 0,
    });

    setTooltipLayout(previousLayout =>
      areTooltipLayoutsEqual(previousLayout, nextLayout) ? previousLayout : nextLayout,
    );
  }, [containerRef, disabled, setTooltipLayout, tooltipRef, tooltipState]);
}

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

function TooltipShotBadge({ shotNumber, color, className }) {
  if (shotNumber !== null && shotNumber !== undefined) {
    return (
      <span
        className={[
          'analyzer-compare-shot-badge',
          className,
          shotNumber === 2 ? 'analyzer-compare-shot-badge--striped' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ '--analyzer-compare-shot-color': color || 'var(--color-primary)' }}
      >
        {shotNumber}
      </span>
    );
  }
  return null;
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

function StaticCompactTooltipContent({ metricContext = null, state, variant = 'default' }) {
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

function StaticTooltipContent({ state }) {
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

const COMPACT_TOOLTIP_VARIANT_CLASS = {
  comparePreview: 'shot-chart-tooltip--static-compact-compare-preview',
  singleLine: 'shot-chart-tooltip--static-compact-single-line',
  singlePaged: 'shot-chart-tooltip--static-compact-single-paged',
  statisticsCompact: 'shot-chart-tooltip--static-compact-statistics',
  titleOnly: 'shot-chart-tooltip--static-compact-title-only',
};

function getCompactTooltipVariantClass(isCompactStatic, staticCompactVariant) {
  if (!isCompactStatic) return '';
  return COMPACT_TOOLTIP_VARIANT_CLASS[staticCompactVariant] || '';
}

function getStaticTooltipStateClass({ isStatic, shouldShowEmptyContent, state }) {
  if (shouldShowEmptyContent) return 'shot-chart-tooltip--static-empty-content';
  if (isStatic && !state.visible) return 'shot-chart-tooltip--static-empty';
  return '';
}

function getTooltipClassName({
  isCompactStatic,
  isFullDisplay,
  isStatic,
  isTitleOnly,
  shouldShowEmptyContent,
  state,
  staticCompactVariant,
}) {
  return [
    'shot-chart-tooltip',
    isFullDisplay ? 'shot-chart-tooltip--fullscreen' : '',
    isTitleOnly ? 'shot-chart-tooltip--title-only' : '',
    isStatic ? 'shot-chart-tooltip--static' : '',
    isCompactStatic ? 'shot-chart-tooltip--static-compact' : '',
    getCompactTooltipVariantClass(isCompactStatic, staticCompactVariant),
    getStaticTooltipStateClass({ isStatic, shouldShowEmptyContent, state }),
  ]
    .filter(Boolean)
    .join(' ');
}

function getTooltipStyle({ isStatic, layout }) {
  if (isStatic) return undefined;
  return {
    left: `${layout.x}px`,
    top: `${layout.y}px`,
    visibility: layout.visible ? 'visible' : 'hidden',
  };
}

function FloatingTooltipTitle({ state }) {
  if (!state.visible || state.titleLines.length === 0) return null;
  return (
    <div className='shot-chart-tooltip__title'>
      {state.titleLines.map((titleLine, index) => (
        <div key={`${titleLine}-${index}`}>{titleLine}</div>
      ))}
    </div>
  );
}

function FloatingPhaseHeading({ phaseSummary, index }) {
  return (
    <div
      key={`${phaseSummary.shotLabel || ''}-${phaseSummary.phaseLabel}-${index}`}
      className='shot-chart-tooltip__phase-heading'
    >
      <TooltipShotBadge
        shotNumber={phaseSummary.shotNumber}
        color={phaseSummary.color}
        className='shot-chart-tooltip__phase-badge'
      />
      {phaseSummary.shotLabel ? (
        <span className='shot-chart-tooltip__phase-shot'>{phaseSummary.shotLabel}</span>
      ) : null}
      {phaseSummary.phaseLabel ? <span>{phaseSummary.phaseLabel}</span> : null}
      {phaseSummary.skipNotice ? (
        <span className='shot-chart-tooltip__phase-skip-notice'>{phaseSummary.skipNotice}</span>
      ) : null}
    </div>
  );
}

function FloatingPhaseHeadingList({ state }) {
  const phaseSummaries = (state.phaseSummaries || []).filter(
    summary => summary.phaseLabel || summary.shotLabel,
  );
  if (!state.visible || phaseSummaries.length === 0) return null;

  return (
    <div className='shot-chart-tooltip__phase-heading-list'>
      {phaseSummaries.map((phaseSummary, index) => (
        <FloatingPhaseHeading
          key={`${phaseSummary.shotLabel || ''}-${phaseSummary.phaseLabel}-${index}`}
          phaseSummary={phaseSummary}
          index={index}
        />
      ))}
    </div>
  );
}

function FloatingStopSummary({ phaseSummary, index }) {
  return (
    <div
      key={`${phaseSummary.shotLabel || ''}-${phaseSummary.phaseLabel}-${index}`}
      className='shot-chart-tooltip__phase'
    >
      <div className='shot-chart-tooltip__phase-value'>
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

function FloatingStopSummaryList({ state }) {
  const stopSummaries = (state.phaseSummaries || []).filter(
    phaseSummary => phaseSummary.skipNotice || phaseSummary.stopReason || phaseSummary.stopValue,
  );
  if (!state.visible || stopSummaries.length === 0) return null;

  return (
    <div className='shot-chart-tooltip__phase-list'>
      {stopSummaries.map((phaseSummary, index) => (
        <FloatingStopSummary
          key={`${phaseSummary.shotLabel || ''}-${phaseSummary.phaseLabel}-${index}`}
          phaseSummary={phaseSummary}
          index={index}
        />
      ))}
    </div>
  );
}

function FloatingTooltipRow({ row, index }) {
  const rowIcon = getShotChartLabelIcon(row.label);
  const displayLabel = row.displayLabel || getShotChartDisplayLabel(row.label);

  return (
    <div
      key={`${row.shotLabel || ''}-${row.label}-${row.valueText}-${index}`}
      className={[
        'shot-chart-tooltip__row',
        row.spacerBefore ? 'shot-chart-tooltip__row--spacer' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {rowIcon ? (
        <FontAwesomeIcon
          icon={rowIcon}
          className='shot-chart-tooltip__icon'
          style={{ color: row.color }}
          aria-hidden='true'
        />
      ) : null}
      <span className='shot-chart-tooltip__text'>
        {row.shotLabel ? <span className='shot-chart-tooltip__shot'>{row.shotLabel}</span> : null}
        <span>{displayLabel}: </span>
        <span className='shot-chart-tooltip__value'>{row.valueText}</span>
      </span>
    </div>
  );
}

function FloatingTooltipRows({ state }) {
  if (!state.visible || state.rows.length === 0) return null;
  return state.rows.map((row, index) => (
    <FloatingTooltipRow
      key={`${row.shotLabel || ''}-${row.label}-${row.valueText}-${index}`}
      row={row}
      index={index}
    />
  ));
}

function FloatingTooltipContent({ state }) {
  return (
    <>
      <FloatingTooltipTitle state={state} />
      <FloatingPhaseHeadingList state={state} />
      <FloatingStopSummaryList state={state} />
      <FloatingTooltipRows state={state} />
    </>
  );
}

export function ShotChartExternalTooltip({
  tooltipRef,
  state,
  layout = createHiddenExternalTooltipLayout(),
  isFullDisplay = false,
  isStatic = false,
  isCompactStatic = false,
  staticCompactVariant = 'default',
  staticMetricContext = null,
  emptyContent = null,
}) {
  if (!state.visible && !isStatic) return null;
  const isTitleOnly = state.visible && state.titleLines.length > 0 && state.rows.length === 0;
  const shouldShowEmptyContent = isStatic && !state.visible && Boolean(emptyContent);
  const shouldShowStaticContent = isStatic && state.visible;
  const style = getTooltipStyle({ isStatic, layout });

  return (
    <div
      ref={tooltipRef}
      // Build tooltip modifiers via array join so formatting cannot remove the class separators.
      className={getTooltipClassName({
        isCompactStatic,
        isFullDisplay,
        isStatic,
        isTitleOnly,
        shouldShowEmptyContent,
        state,
        staticCompactVariant,
      })}
      style={style}
    >
      {shouldShowEmptyContent ? emptyContent : null}
      {shouldShowStaticContent && isCompactStatic ? (
        <StaticCompactTooltipContent
          metricContext={staticMetricContext}
          state={state}
          variant={staticCompactVariant}
        />
      ) : null}
      {shouldShowStaticContent && !isCompactStatic ? <StaticTooltipContent state={state} /> : null}
      {shouldShowStaticContent ? null : <FloatingTooltipContent state={state} />}
    </div>
  );
}
