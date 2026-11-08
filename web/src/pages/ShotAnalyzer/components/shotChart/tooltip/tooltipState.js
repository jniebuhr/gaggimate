export function getTooltipRowTextKey(row) {
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

export function areTooltipLayoutsEqual(a, b) {
  if (!a || !b) return false;
  return a.visible === b.visible && a.x === b.x && a.y === b.y;
}

export function getFiniteTooltipBound(primaryBound, fallbackBound) {
  if (Number.isFinite(primaryBound)) return primaryBound;
  if (Number.isFinite(fallbackBound)) return fallbackBound;
  return undefined;
}
