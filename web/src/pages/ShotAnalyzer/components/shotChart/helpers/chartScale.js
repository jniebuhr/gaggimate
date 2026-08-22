const SCALE_SPIKE_WINDOW_SEC = 2;

const SCALE_SPIKE_SUPPORT_RATIO = 0.85;

const SCALE_SPIKE_FALLBACK_PERCENTILE = 0.95;

const SCALE_SPIKE_BASELINE_LOOKBACK_SEC = 0.75;

function getMedianValue(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middleIndex = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middleIndex];
  return (sorted[middleIndex - 1] + sorted[middleIndex]) / 2;
}

function getFiniteSeriesPoints(points) {
  return (points || [])
    .map(point => ({
      x: Number(point?.x),
      y: Number(point?.y),
    }))
    .filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
}

export function getPercentileValue(values, percentile) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const clampedPercentile = Math.min(1, Math.max(0, percentile));
  const index = (sorted.length - 1) * clampedPercentile;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  if (lowerIndex === upperIndex) return sorted[lowerIndex];
  const ratio = index - lowerIndex;
  return sorted[lowerIndex] + (sorted[upperIndex] - sorted[lowerIndex]) * ratio;
}

function isTransientScaleSpikePoint({
  rawFinitePoints,
  point,
  index,
  windowSec,
  minTransientRise,
  recoveryTolerance,
}) {
  const baselineValues = rawFinitePoints
    .slice(0, index)
    .filter(candidate => point.x - candidate.x <= SCALE_SPIKE_BASELINE_LOOKBACK_SEC)
    .map(candidate => candidate.y);
  const futureValues = rawFinitePoints
    .slice(index + 1)
    .filter(candidate => candidate.x - point.x <= windowSec)
    .map(candidate => candidate.y);

  if (baselineValues.length === 0 || futureValues.length === 0) return false;

  const baseline = getMedianValue(baselineValues);
  if (!Number.isFinite(baseline)) return false;

  const rise = point.y - baseline;
  if (rise < minTransientRise) return false;

  // Ignore brief touch-induced scale spikes that rise sharply and then fall
  // back near the local baseline within the look-ahead window.
  const futureMin = Math.min(...futureValues);
  return futureMin <= baseline + recoveryTolerance;
}

function getSpikeResistantSeriesPeak(
  points,
  {
    windowSec = SCALE_SPIKE_WINDOW_SEC,
    supportRatio = SCALE_SPIKE_SUPPORT_RATIO,
    fallbackPercentile = SCALE_SPIKE_FALLBACK_PERCENTILE,
    seriesKind = 'weight',
  } = {},
) {
  const rawFinitePoints = getFiniteSeriesPoints(points);
  if (rawFinitePoints.length === 0) return null;

  const seriesValues = rawFinitePoints.map(point => point.y);
  const seriesMin = Math.min(...seriesValues);
  const seriesMax = Math.max(...seriesValues);
  const seriesRange = Math.max(0, seriesMax - seriesMin);
  const minTransientRise =
    seriesKind === 'weightFlow'
      ? Math.max(0.6, seriesRange * 0.18)
      : Math.max(1.25, seriesRange * 0.12);
  const recoveryTolerance =
    seriesKind === 'weightFlow'
      ? Math.max(0.2, seriesRange * 0.05)
      : Math.max(0.35, seriesRange * 0.04);

  const finitePoints = rawFinitePoints.filter((point, index) => {
    return !isTransientScaleSpikePoint({
      rawFinitePoints,
      point,
      index,
      windowSec,
      minTransientRise,
      recoveryTolerance,
    });
  });

  if (finitePoints.length === 0) return null;

  const rawMaxPoint = finitePoints.reduce((maxPoint, point) => {
    if (!maxPoint || point.y > maxPoint.y) return point;
    return maxPoint;
  }, null);
  const totalDuration = Math.max(0, finitePoints[finitePoints.length - 1].x - finitePoints[0].x);
  if (totalDuration <= windowSec) {
    return rawMaxPoint;
  }

  let sustainedPeak = null;
  for (let i = 0; i < finitePoints.length; i += 1) {
    const candidate = finitePoints[i];
    if (!Number.isFinite(candidate.y) || candidate.y <= 0) continue;
    const { startX, endX } = getSupportedSeriesWindow({
      finitePoints,
      index: i,
      supportRatio,
    });

    // A candidate max is only accepted when it stays near that level long
    // enough; otherwise we fall back to a percentile-based ceiling.
    if (endX - startX > windowSec) {
      sustainedPeak = !sustainedPeak || candidate.y > sustainedPeak.y ? candidate : sustainedPeak;
    }
  }

  if (sustainedPeak) return sustainedPeak;

  const percentileMax = getPercentileValue(
    finitePoints.map(point => point.y),
    fallbackPercentile,
  );
  if (!Number.isFinite(percentileMax)) return rawMaxPoint;

  const percentilePeak = finitePoints.reduce((bestPoint, point) => {
    if (point.y > percentileMax) return bestPoint;
    if (!bestPoint || point.y > bestPoint.y) return point;
    return bestPoint;
  }, null);

  return percentilePeak || rawMaxPoint;
}

export function getSpikeResistantSeriesMax(points, options = {}) {
  const { fallback = 1, ...peakOptions } = options;
  const peak = getSpikeResistantSeriesPeak(points, peakOptions);
  return Math.max(fallback, Number.isFinite(peak?.y) ? peak.y : fallback);
}

function getSupportedSeriesWindow({ finitePoints, index, supportRatio }) {
  const candidate = finitePoints[index];
  const threshold = candidate.y * supportRatio;
  let startX = candidate.x;
  let endX = candidate.x;

  for (let left = index - 1; left >= 0; left -= 1) {
    if (finitePoints[left].y < threshold) break;
    startX = finitePoints[left].x;
  }

  for (let right = index + 1; right < finitePoints.length; right += 1) {
    if (finitePoints[right].y < threshold) break;
    endX = finitePoints[right].x;
  }

  return { startX, endX };
}

function formatAxisTick(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  const rounded = Math.round(numeric);
  const absolute = Math.abs(rounded).toString().padStart(2, '0');
  return rounded < 0 ? `-${absolute}` : absolute;
}

export function formatUniqueAxisTick(value, index, ticks) {
  if (Array.isArray(ticks) && index === ticks.length - 1) return '';

  const formatted = formatAxisTick(value);
  if (!Array.isArray(ticks) || !Number.isInteger(index) || index <= 0) return formatted;

  const previousValue = ticks[index - 1]?.value;
  return formatAxisTick(previousValue) === formatted ? '' : formatted;
}

export function formatResponsiveXAxisTick(value, index, ticks) {
  const formatted = formatAxisTick(value);
  const tickCount = Array.isArray(ticks) ? ticks.length : 0;
  if (tickCount <= 0) return formatted;

  const scaleWidth = Number(this?.width) || Number(this?.chart?.width) || 0;
  let maxVisibleTicks = 8;
  if (scaleWidth < 300) maxVisibleTicks = 4;
  else if (scaleWidth < 460) maxVisibleTicks = 5;
  if (tickCount <= maxVisibleTicks) return formatted;

  const lastIndex = tickCount - 1;
  if (index === 0 || index === lastIndex) return formatted;

  const interval = Math.ceil(lastIndex / Math.max(1, maxVisibleTicks - 1));
  return index % interval === 0 ? formatted : '';
}
