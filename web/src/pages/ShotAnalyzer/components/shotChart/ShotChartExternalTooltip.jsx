import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  EXTERNAL_TOOLTIP_FALLBACK_OFFSET_X,
  TOOLTIP_GROUP_BY_LABEL,
  TOOLTIP_INDEX,
  TOOLTIP_WATER_LABELS,
  UNIT_BY_LABEL,
  WATER_DRAWN_PHASE_LABEL,
} from './constants';
import { computeExternalTooltipPosition } from './helpers';
import { getShotChartDisplayLabel, getShotChartLabelIcon } from './labelVisuals';

export function createHiddenExternalTooltipState() {
  return {
    visible: false,
    titleLines: [],
    rows: [],
    anchorX: 0,
    anchorY: 0,
    chartWidth: 0,
    chartHeight: 0,
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
    if (
      a[i]?.label !== b[i]?.label ||
      a[i]?.valueText !== b[i]?.valueText ||
      a[i]?.color !== b[i]?.color ||
      a[i]?.spacerBefore !== b[i]?.spacerBefore
    ) {
      return false;
    }
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

function getTooltipGroupKey(label) {
  return TOOLTIP_GROUP_BY_LABEL[label] || null;
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

export function buildExternalTooltipState({
  chart,
  tooltip,
  getHoverWaterValuesAtX,
  tooltipColorByLabel,
}) {
  // Chart.js still drives hit-testing, but the visible tooltip is rendered as HTML for richer layout control.
  if (!tooltip || tooltip.opacity === 0 || !chart.chartArea) {
    return createHiddenExternalTooltipState();
  }

  const tooltipItems = Array.isArray(tooltip.dataPoints) ? tooltip.dataPoints : [];
  const rows = buildExternalTooltipRows(tooltipItems, getHoverWaterValuesAtX, tooltipColorByLabel);
  const titleLines = Array.isArray(tooltip.title)
    ? tooltip.title.filter(title => typeof title === 'string' && title.trim().length > 0)
    : [];

  if (rows.length === 0 && titleLines.length === 0) {
    return createHiddenExternalTooltipState();
  }

  return {
    visible: true,
    titleLines,
    rows,
    anchorX: Number.isFinite(tooltip.caretX)
      ? tooltip.caretX
      : chart.chartArea.left + EXTERNAL_TOOLTIP_FALLBACK_OFFSET_X,
    anchorY: Number.isFinite(chart.$fixedTooltipPointerY)
      ? chart.$fixedTooltipPointerY
      : Number.isFinite(tooltip.caretY)
        ? tooltip.caretY
        : chart.chartArea.top,
    chartWidth: chart.width,
    chartHeight: chart.height,
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
  });
}

export function ShotChartExternalTooltip({ tooltipRef, state, layout, isFullDisplay = false }) {
  if (!state.visible) return null;

  return (
    <div
      ref={tooltipRef}
      className={`shot-chart-tooltip${isFullDisplay ? 'shot-chart-tooltip--fullscreen' : ''}`}
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
        const displayLabel = getShotChartDisplayLabel(row.label);

        return (
          <div
            key={`${row.label}-${row.valueText}-${index}`}
            className={`shot-chart-tooltip__row${row.spacerBefore ? 'shot-chart-tooltip__row--spacer' : ''}`}
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
              <span>{displayLabel}: </span>
              <span className='shot-chart-tooltip__value'>{row.valueText}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
