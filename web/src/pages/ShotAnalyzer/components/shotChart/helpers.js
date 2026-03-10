import {
  CHART_COLOR_FALLBACKS,
  CHART_COLOR_TOKEN_MAP,
  EXTERNAL_TOOLTIP_BOUNDS_PADDING,
  EXTERNAL_TOOLTIP_POINTER_GAP,
  EXTERNAL_TOOLTIP_VERTICAL_OFFSET,
  LEGEND_BLOCK_LABELS,
  LEGEND_DASHED_LABELS,
  LEGEND_ORDER,
  LEGEND_THIN_LINE_LABELS,
  STANDARD_LINE_WIDTH,
  THIN_LINE_WIDTH,
  VISIBILITY_KEY_BY_LABEL,
  WATER_DRAWN_PHASE_LABEL,
  WATER_DRAWN_TOTAL_LABEL,
} from './constants';

export const hoverGuidePlugin = {
  id: 'hoverGuide',
  afterDatasetsDraw(chart, _args, pluginOptions) {
    const active = chart.getActiveElements?.() || chart.tooltip?.getActiveElements?.() || [];
    if (!active.length) return;

    const x = active[0]?.element?.x;
    if (!Number.isFinite(x)) return;

    const { top, bottom } = chart.chartArea;
    const ctx = chart.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = pluginOptions?.color || 'rgba(148, 163, 184, 0.72)';
    ctx.lineWidth = pluginOptions?.lineWidth || 1.25;
    ctx.setLineDash(pluginOptions?.dash || []);
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
    ctx.restore();
  },
};

export const replayRevealPlugin = {
  id: 'replayReveal',
  beforeDatasetsDraw(chart) {
    if (!chart?.$replayRevealEnabled || !chart.chartArea || !chart.scales?.x) return;
    const cutoffX = Number(chart.$replayRevealX);
    if (!Number.isFinite(cutoffX)) return;

    const cutoffPixelRaw = chart.scales.x.getPixelForValue(cutoffX);
    const cutoffPixel = Math.min(
      chart.chartArea.right,
      Math.max(
        chart.chartArea.left,
        Number.isFinite(cutoffPixelRaw) ? cutoffPixelRaw : chart.chartArea.left,
      ),
    );
    const clipWidth = Math.max(0, cutoffPixel - chart.chartArea.left);

    chart.ctx.save();
    chart.ctx.beginPath();
    chart.ctx.rect(
      chart.chartArea.left,
      chart.chartArea.top,
      clipWidth,
      chart.chartArea.bottom - chart.chartArea.top,
    );
    chart.ctx.clip();
    chart.$replayRevealClipActive = true;
  },
  afterDatasetsDraw(chart) {
    if (!chart?.$replayRevealClipActive) return;
    chart.ctx.restore();
    chart.$replayRevealClipActive = false;
  },
};

export function readCssColorVar(variableName, fallback) {
  if (typeof window === 'undefined' || !window.document?.documentElement) return fallback;
  const value = window
    .getComputedStyle(window.document.documentElement)
    .getPropertyValue(variableName)
    .trim();
  return value || fallback;
}

export function getShotChartColors() {
  return Object.keys(CHART_COLOR_FALLBACKS).reduce((acc, key) => {
    acc[key] = readCssColorVar(CHART_COLOR_TOKEN_MAP[key], CHART_COLOR_FALLBACKS[key]);
    return acc;
  }, {});
}

export function getLegendColorByLabel(colors) {
  return {
    'Phase Names': colors.phaseLine,
    Stops: colors.stopLabel,
    Temp: colors.temp,
    'Target T': colors.tempTarget,
    Pressure: colors.pressure,
    'Target P': colors.pressure,
    Flow: colors.flow,
    'Target F': colors.flow,
    'Puck Flow': colors.puckFlow,
    Weight: colors.weight,
    'Weight Flow': colors.weightFlow,
  };
}

export function getTooltipColorByLabel(colors) {
  return {
    ...getLegendColorByLabel(colors),
    [WATER_DRAWN_PHASE_LABEL]: colors.puckFlow,
    [WATER_DRAWN_TOTAL_LABEL]: colors.flow,
  };
}

export function getVisibleLegendItemsForExport({
  legendColorByLabel,
  visibility,
  hasWeightData,
  hasWeightFlowData,
}) {
  return LEGEND_ORDER.reduce((items, label) => {
    if (label === 'Weight' && !hasWeightData) return items;
    if (label === 'Weight Flow' && !hasWeightFlowData) return items;

    const key = VISIBILITY_KEY_BY_LABEL[label];
    if (key && !visibility[key]) return items;

    items.push({
      label,
      color: legendColorByLabel[label] || '#94a3b8',
      style: LEGEND_BLOCK_LABELS.has(label)
        ? 'block'
        : LEGEND_DASHED_LABELS.has(label)
          ? 'dashed'
          : 'line',
      lineWidth: LEGEND_THIN_LINE_LABELS.has(label) ? THIN_LINE_WIDTH : STANDARD_LINE_WIDTH,
    });
    return items;
  }, []);
}

function stripExportFileExtension(value) {
  return String(value || '')
    .trim()
    .replace(/\.[^./\\]{1,8}$/, '');
}

function sanitizeExportFilenameSegment(value) {
  return stripExportFileExtension(value)
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function resolveShotExportStem(shotData, fallbackStem) {
  const profileValue =
    typeof shotData?.profile === 'string'
      ? shotData.profile
      : shotData?.profile?.label || shotData?.profile?.name || '';
  return (
    sanitizeExportFilenameSegment(
      shotData?.name || shotData?.storageKey || shotData?.id || profileValue || fallbackStem,
    ) || fallbackStem
  );
}

export function buildReplayExportFilename(shotData, includeLegend, exportFormat = 'mp4') {
  const stem = resolveShotExportStem(shotData, 'shot-analyzer-replay');
  const extension = exportFormat === 'webm' ? 'webm' : 'mp4';
  return `${stem}${includeLegend ? '-with-legend' : ''}-replay.${extension}`;
}

export function buildReplayImageFilename(shotData, includeLegend) {
  const stem = resolveShotExportStem(shotData, 'shot-analyzer-chart');
  return `${stem}${includeLegend ? '-with-legend' : ''}.png`;
}

export function resolveHoverPointColor(context) {
  const datasetColor = context?.dataset?.borderColor;
  return typeof datasetColor === 'string' && datasetColor.length > 0 ? datasetColor : '#94a3b8';
}

export function computeExternalTooltipPosition({
  anchorX,
  anchorY,
  chartWidth,
  chartHeight,
  tooltipWidth,
  tooltipHeight,
  boundsPadding = EXTERNAL_TOOLTIP_BOUNDS_PADDING,
  pointerGap = EXTERNAL_TOOLTIP_POINTER_GAP,
  verticalOffset = EXTERNAL_TOOLTIP_VERTICAL_OFFSET,
}) {
  const chartMidX = chartWidth / 2;
  const showRightOfPointer = anchorX <= chartMidX;
  const preferredX = showRightOfPointer
    ? anchorX + pointerGap
    : anchorX - tooltipWidth - pointerGap;
  const preferredY = anchorY - tooltipHeight / 2 + verticalOffset;
  const maxX = Math.max(boundsPadding, chartWidth - tooltipWidth - boundsPadding);
  const maxY = Math.max(boundsPadding, chartHeight - tooltipHeight - boundsPadding);

  return {
    visible: true,
    x: Math.min(maxX, Math.max(boundsPadding, preferredX)),
    y: Math.min(maxY, Math.max(boundsPadding, preferredY)),
  };
}

export function getPhaseName(shot, phaseNumber) {
  if (shot.phaseTransitions && shot.phaseTransitions.length > 0) {
    const transition = shot.phaseTransitions.find(t => t.phaseNumber === phaseNumber);
    if (transition && transition.phaseName) {
      return transition.phaseName;
    }
  }

  if (shot.profile && shot.profile.phases && shot.profile.phases[phaseNumber]) {
    return shot.profile.phases[phaseNumber].name;
  }

  return phaseNumber === 0 ? 'Start' : `P${phaseNumber + 1}`;
}

export function toNumberOrNull(value) {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function formatAxisTick(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  const rounded = Math.round(numeric);
  const absolute = Math.abs(rounded).toString().padStart(2, '0');
  return rounded < 0 ? `-${absolute}` : absolute;
}

export function createStripedFillPattern(canvasCtx, color, options = {}) {
  if (!canvasCtx || typeof window === 'undefined') return color;

  const size = options.size ?? 8;
  const lineWidth = options.lineWidth ?? 1;
  const baseAlpha = options.baseAlpha ?? 0.02;
  const stripeAlpha = options.stripeAlpha ?? 0.1;

  const patternCanvas = window.document.createElement('canvas');
  patternCanvas.width = size;
  patternCanvas.height = size;

  const patternCtx = patternCanvas.getContext('2d');
  if (!patternCtx) return color;

  patternCtx.clearRect(0, 0, size, size);
  patternCtx.fillStyle = color;
  patternCtx.globalAlpha = baseAlpha;
  patternCtx.fillRect(0, 0, size, size);

  patternCtx.strokeStyle = color;
  patternCtx.globalAlpha = stripeAlpha;
  patternCtx.lineWidth = lineWidth;
  patternCtx.lineCap = 'butt';
  patternCtx.beginPath();
  patternCtx.moveTo(0, size);
  patternCtx.lineTo(size, 0);
  patternCtx.stroke();

  return canvasCtx.createPattern(patternCanvas, 'repeat') || color;
}

export function safeMax(arr, fallback = 0) {
  let max = -Infinity;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] > max) max = arr[i];
  }
  return max === -Infinity ? fallback : max;
}

export function safeMin(arr, fallback = 0) {
  let min = Infinity;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] < min) min = arr[i];
  }
  return min === Infinity ? fallback : min;
}

export function findLastSampleIndexAtOrBeforeX(sampleTimesSec, xValue) {
  if (!Array.isArray(sampleTimesSec) || sampleTimesSec.length === 0 || !Number.isFinite(xValue)) {
    return -1;
  }
  if (xValue < sampleTimesSec[0]) return -1;

  let low = 0;
  let high = sampleTimesSec.length - 1;
  let best = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const midValue = sampleTimesSec[mid];
    if (!Number.isFinite(midValue)) {
      high = mid - 1;
      continue;
    }
    if (midValue <= xValue) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
}
