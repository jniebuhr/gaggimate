/**
 * helpers.js
 *
 * Collects low-level ShotChart helpers that are intentionally reused across
 * chart setup, replay preparation, tooltip layout, and export.
 */

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
    // Draw the guide after datasets so it stays visible above fills and lines
    // without needing a dedicated overlay canvas.
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

    // Clip only the plotted area so axes, ticks, and annotations can still be
    // controlled independently while the data itself is progressively revealed.
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
  // Resolve all chart colors from CSS variables in one place so the rest of the
  // chart stack can work with concrete values instead of repeatedly touching the DOM.
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
    [WATER_DRAWN_PHASE_LABEL]: 'color-mix(in srgb, var(--statistics-summary-water) 84%, black)',
    [WATER_DRAWN_TOTAL_LABEL]: 'var(--statistics-summary-water)',
  };
}

export function getVisibleLegendItemsForExport({
  legendColorByLabel,
  visibility,
  hasWeightData,
  hasWeightFlowData,
}) {
  // Exported legends should reflect the same visibility rules as the live chart,
  // including data-dependent series such as weight and weight flow.
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
  // Prefer the storage/name fields first so exported files stay stable even when
  // display labels contain punctuation or are not unique.
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

  // Prefer placing the tooltip to the side of the pointer, then clamp it back
  // into the chart box so long tooltips still stay fully readable.
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

  // Use a tiny offscreen canvas so fills can share one repeatable striped pattern
  // without depending on large gradient objects or per-point drawing.
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

  // Hover, replay, and water lookups all need the latest sample at or before a
  // given x-value, so keep this as a binary search rather than rescanning arrays.
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

function clampReplayIndex(value, maxIndex) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(maxIndex, value));
}

function getReplayFrameIndex(xValue, shotStartSec, durationSec, frameCount) {
  if (frameCount <= 0 || durationSec <= 0) return 0;
  // Replay annotations are mapped onto the same normalized frame timeline as the
  // dataset chunks so both appear in lockstep during playback/export.
  const progress = (xValue - shotStartSec) / durationSec;
  return clampReplayIndex(Math.floor(progress * frameCount), frameCount);
}

function pushReplayPoint(points, point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
  const lastPoint = points[points.length - 1];
  if (lastPoint && lastPoint.x === point.x && lastPoint.y === point.y) return;
  points.push(point);
}

function buildReplayBoundaryPoint(lastVisiblePoint, nextPoint, frameTime) {
  if (lastVisiblePoint && nextPoint && nextPoint.x > lastVisiblePoint.x) {
    // Interpolate the frame boundary so replay motion stays visually smooth even
    // when several source samples fall between two replay frames.
    const progress = (frameTime - lastVisiblePoint.x) / (nextPoint.x - lastVisiblePoint.x);
    const clampedProgress = Math.max(0, Math.min(1, progress));
    return {
      x: frameTime,
      y: lastVisiblePoint.y + (nextPoint.y - lastVisiblePoint.y) * clampedProgress,
    };
  }

  if (lastVisiblePoint) {
    return {
      x: frameTime,
      y: lastVisiblePoint.y,
    };
  }

  if (nextPoint) {
    return {
      x: frameTime,
      y: nextPoint.y,
    };
  }

  return null;
}

function buildCarryReplayPoints(intervalPoints, frameBoundaryPoint) {
  const points = [];
  for (const point of intervalPoints) {
    pushReplayPoint(points, point);
  }

  // Most datasets should simply grow forward over time. Appending the boundary
  // point keeps the line continuous between frame buckets.
  pushReplayPoint(points, frameBoundaryPoint);

  return points;
}

function buildExtremaReplayPoints(intervalPoints, frameBoundaryPoint) {
  const points = [];

  if (intervalPoints.length > 0) {
    let minIndex = 0;
    let maxIndex = 0;
    for (let i = 1; i < intervalPoints.length; i++) {
      if (intervalPoints[i].y < intervalPoints[minIndex].y) minIndex = i;
      if (intervalPoints[i].y > intervalPoints[maxIndex].y) maxIndex = i;
    }

    const candidateIndices = [0, minIndex, maxIndex, intervalPoints.length - 1]
      .filter((value, index, values) => values.indexOf(value) === index)
      .sort((a, b) => a - b);

    // Preserve the first, last, and local extrema inside each frame bucket so
    // spiky datasets do not flatten out when replay runs below raw sample rate.
    for (const candidateIndex of candidateIndices) {
      pushReplayPoint(points, intervalPoints[candidateIndex]);
    }
  }

  pushReplayPoint(points, frameBoundaryPoint);

  return points;
}

function getReplayDatasetStrategy(label) {
  switch (label) {
    case 'Pressure':
    case 'Flow':
    case 'Puck Flow':
    case 'Weight Flow':
      return 'extrema';
    default:
      return 'carry';
  }
}

function buildReplayDatasetMeta({
  data,
  label,
  shotStartSec,
  maxTime,
  frameCount,
  frameDurationSec,
}) {
  const fullData = Array.isArray(data)
    ? data.filter(point => point && Number.isFinite(point.x) && Number.isFinite(point.y))
    : [];
  const activeData = [];
  const frameChunks = Array.from({ length: frameCount + 1 }, () => []);

  if (!fullData.length) {
    return { fullData, activeData, frameChunks };
  }

  const durationSec = Math.max(0, maxTime - shotStartSec);
  const strategy = getReplayDatasetStrategy(label);
  let pointCursor = 0;
  let lastVisiblePoint = null;
  let previousFrameTime = shotStartSec;

  // Pre-slice every dataset into replay frame chunks once. Live replay can then
  // append cheap immutable chunks instead of reprocessing the full series per frame.
  for (let frameIndex = 0; frameIndex <= frameCount; frameIndex++) {
    const frameTime = shotStartSec + Math.min(durationSec, frameIndex * frameDurationSec);
    const intervalPoints = [];

    while (pointCursor < fullData.length && fullData[pointCursor].x <= frameTime) {
      const point = fullData[pointCursor];
      if (frameIndex === 0 || point.x > previousFrameTime) {
        intervalPoints.push(point);
      }
      lastVisiblePoint = point;
      pointCursor += 1;
    }

    const nextPoint = pointCursor < fullData.length ? fullData[pointCursor] : null;
    const frameBoundaryPoint = buildReplayBoundaryPoint(lastVisiblePoint, nextPoint, frameTime);

    frameChunks[frameIndex] =
      strategy === 'extrema'
        ? buildExtremaReplayPoints(intervalPoints, frameBoundaryPoint)
        : buildCarryReplayPoints(intervalPoints, frameBoundaryPoint);

    previousFrameTime = frameTime;
  }

  return {
    fullData,
    activeData,
    frameChunks,
  };
}

function buildReplayAnnotationMeta(annotations, shotStartSec, maxTime, frameCount) {
  const durationSec = Math.max(0, maxTime - shotStartSec);
  return Object.entries(annotations || {}).reduce((acc, [key, annotation]) => {
    const time = Number(annotation?.value);
    if (!Number.isFinite(time)) return acc;

    acc.push({
      key,
      time,
      baseDisplay: annotation?.display !== false,
      frameIndex: getReplayFrameIndex(time, shotStartSec, durationSec, frameCount),
    });
    return acc;
  }, []);
}

export function buildShotChartReplayModel({
  mainDatasets,
  tempDatasets,
  mainAnnotations,
  tempAnnotations,
  shotStartSec,
  maxTime,
  frameDurationSec,
}) {
  const durationSec = Math.max(0, maxTime - shotStartSec);
  const frameCount = Math.max(1, Math.ceil(durationSec / Math.max(frameDurationSec, 0.001)));

  // Build one replay runtime description that can be shared by both live replay
  // and export. The caller stays responsible only for applying frames over time.
  return {
    frameCount,
    totalDurationSec: durationSec,
    mainReplayDatasets: (mainDatasets || []).map(dataset =>
      buildReplayDatasetMeta({
        data: dataset?.data,
        label: dataset?.label,
        shotStartSec,
        maxTime,
        frameCount,
        frameDurationSec,
      }),
    ),
    tempReplayDatasets: (tempDatasets || []).map(dataset =>
      buildReplayDatasetMeta({
        data: dataset?.data,
        label: dataset?.label,
        shotStartSec,
        maxTime,
        frameCount,
        frameDurationSec,
      }),
    ),
    mainAnnotationMeta: buildReplayAnnotationMeta(
      mainAnnotations,
      shotStartSec,
      maxTime,
      frameCount,
    ),
    tempAnnotationMeta: buildReplayAnnotationMeta(
      tempAnnotations,
      shotStartSec,
      maxTime,
      frameCount,
    ),
  };
}
