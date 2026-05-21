import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  EXTERNAL_TOOLTIP_FALLBACK_OFFSET_X,
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

export function createHiddenExternalTooltipState() {
  return {
    visible: false,
    titleLines: [],
    rows: [],
    anchorX: 0,
    anchorY: 0,
    chartWidth: 0,
    chartHeight: 0,
    chartAreaLeft: 0,
    chartAreaRight: 0,
    chartAreaTop: 0,
    chartAreaBottom: 0,
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
    areStringArraysEqual(a.titleLines, b.titleLines) &&
    areTooltipRowsEqual(a.rows, b.rows)
  );
}

export function areTooltipLayoutsEqual(a, b) {
  if (!a || !b) return false;
  return a.visible === b.visible && a.x === b.x && a.y === b.y;
}

export function shouldRenderTooltipLabel(label) {
  return Boolean(label) && label !== 'Phase Names' && label !== 'Stops';
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

export function buildExternalTooltipRows(
  tooltipItems,
  getHoverWaterValuesAtX,
  tooltipColorByLabel,
) {
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

export function buildCompareExternalTooltipRows({ chart, xValue }) {
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
}) {
  // Chart.js still drives hit-testing, but the visible tooltip is rendered as HTML for richer layout control.
  if (!tooltip || tooltip.opacity === 0 || !chart.chartArea) {
    return createHiddenExternalTooltipState();
  }

  const tooltipItems = Array.isArray(tooltip.dataPoints) ? tooltip.dataPoints : [];
  const isCompareTooltipMode = tooltipMode === 'compare' || tooltipMode === 'compareTitleOnly';
  const compareXValue = resolveCompareXValue(chart, tooltip, tooltipItems, isCompareTooltipMode);
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

  if (rows.length === 0 && titleLines.length === 0) {
    return createHiddenExternalTooltipState();
  }

  return {
    visible: true,
    titleLines,
    rows,
    anchorX: resolveTooltipAnchorX(chart, tooltip),
    anchorY: resolveTooltipAnchorY(chart, tooltip),
    chartWidth: chart.width,
    chartHeight: chart.height,
    chartAreaLeft: chart.chartArea.left,
    chartAreaRight: chart.chartArea.right,
    chartAreaTop: chart.chartArea.top,
    chartAreaBottom: chart.chartArea.bottom,
  };
}

export function getExternalTooltipLayout({
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
    boundsLeft: Number.isFinite(tooltipState.chartAreaLeft)
      ? tooltipState.chartAreaLeft
      : undefined,
    boundsRight: Number.isFinite(tooltipState.chartAreaRight)
      ? tooltipState.chartAreaRight
      : undefined,
    boundsTop: Number.isFinite(tooltipState.chartAreaTop) ? tooltipState.chartAreaTop : undefined,
    boundsBottom: Number.isFinite(tooltipState.chartAreaBottom)
      ? tooltipState.chartAreaBottom
      : undefined,
  });
}

export function ShotChartExternalTooltip({ tooltipRef, state, layout, isFullDisplay = false }) {
  if (!state.visible) return null;
  const isTitleOnly = state.titleLines.length > 0 && state.rows.length === 0;

  return (
    <div
      ref={tooltipRef}
      // Build tooltip modifiers via array join so formatting cannot remove the class separators.
      className={[
        'shot-chart-tooltip',
        isFullDisplay ? 'shot-chart-tooltip--fullscreen' : '',
        isTitleOnly ? 'shot-chart-tooltip--title-only' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        left: `${layout.x}px`,
        top: `${layout.y}px`,
        visibility: layout.visible ? 'visible' : 'hidden',
      }}
    >
      {state.titleLines.length > 0 ? (
        <div className='shot-chart-tooltip__title'>
          {state.titleLines.map((titleLine, index) => (
            <div key={`${titleLine}-${index}`}>{titleLine}</div>
          ))}
        </div>
      ) : null}
      {state.rows.map((row, index) => {
        const rowIcon = getShotChartLabelIcon(row.label);
        const displayLabel = row.displayLabel || getShotChartDisplayLabel(row.label);

        return (
          <div
            key={`${row.shotLabel || ''}-${row.label}-${row.valueText}-${index}`}
            // Keep row modifiers formatter-safe for the same reason as the outer tooltip classes.
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
              {row.shotLabel ? (
                <span className='shot-chart-tooltip__shot'>{row.shotLabel}</span>
              ) : null}
              <span>{displayLabel}: </span>
              <span className='shot-chart-tooltip__value'>{row.valueText}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
