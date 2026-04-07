// Trend bucketing is intentionally done in the frontend so StatisticsService can stay
// focused on per-shot outputs. Buckets use local/browser time for user-facing charts.
function normalizeTimestampMs(timestamp) {
  const value = Number(timestamp);
  if (!Number.isFinite(value)) return null;
  return value < 1e10 ? value * 1000 : value;
}

function cloneAtLocalMidnight(ms) {
  const date = new Date(ms);
  if (!Number.isFinite(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

export function getDayStartLocalMs(timestamp) {
  const ms = normalizeTimestampMs(timestamp);
  if (!Number.isFinite(ms)) return null;
  const date = cloneAtLocalMidnight(ms);
  return date ? date.getTime() : null;
}

export function getIsoWeekStartLocalMs(timestamp) {
  const ms = normalizeTimestampMs(timestamp);
  if (!Number.isFinite(ms)) return null;
  const date = cloneAtLocalMidnight(ms);
  if (!date) return null;
  const day = date.getDay() || 7; // ISO week: Monday=1 ... Sunday=7
  date.setDate(date.getDate() - (day - 1));
  return date.getTime();
}

export function getMonthStartLocalMs(timestamp) {
  const ms = normalizeTimestampMs(timestamp);
  if (!Number.isFinite(ms)) return null;
  const date = cloneAtLocalMidnight(ms);
  if (!date) return null;
  date.setDate(1);
  return date.getTime();
}

export function getYearStartLocalMs(timestamp) {
  const ms = normalizeTimestampMs(timestamp);
  if (!Number.isFinite(ms)) return null;
  const date = cloneAtLocalMidnight(ms);
  if (!date) return null;
  date.setMonth(0, 1);
  return date.getTime();
}

function getBucketStartLocalMs(timestamp, granularity) {
  switch (granularity) {
    case 'day':
      return getDayStartLocalMs(timestamp);
    case 'week':
      return getIsoWeekStartLocalMs(timestamp);
    case 'month':
      return getMonthStartLocalMs(timestamp);
    case 'year':
      return getYearStartLocalMs(timestamp);
    default:
      return getMonthStartLocalMs(timestamp);
  }
}

function getNextBucketStartLocalMs(bucketStartMs, granularity) {
  const date = new Date(bucketStartMs);
  if (!Number.isFinite(date.getTime())) return null;

  switch (granularity) {
    case 'day':
      date.setDate(date.getDate() + 1);
      break;
    case 'week':
      date.setDate(date.getDate() + 7);
      break;
    case 'month':
      date.setMonth(date.getMonth() + 1, 1);
      break;
    case 'year':
      date.setFullYear(date.getFullYear() + 1, 0, 1);
      break;
    default:
      date.setMonth(date.getMonth() + 1, 1);
      break;
  }

  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function getBucketEndLocalMs(bucketStartMs, granularity) {
  const nextStart = getNextBucketStartLocalMs(bucketStartMs, granularity);
  if (!Number.isFinite(nextStart)) return null;
  return nextStart - 1;
}

function averageOf(values) {
  if (!values.length) return null;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

export function aggregateTrendsByGranularity(trends, metricKey, granularity) {
  if (!Array.isArray(trends) || trends.length === 0) return [];

  const buckets = new Map();
  for (const entry of trends) {
    const bucketStartMs = getBucketStartLocalMs(entry?.timestamp, granularity);
    if (!Number.isFinite(bucketStartMs)) continue;

    let bucket = buckets.get(bucketStartMs);
    if (!bucket) {
      bucket = {
        bucketStartMs,
        shotCount: 0,
        values: [],
      };
      buckets.set(bucketStartMs, bucket);
    }

    bucket.shotCount += 1;

    // Count-based metrics use bucket.shotCount directly; other metrics aggregate by average.
    if (metricKey !== 'shotCount') {
      const value = Number(entry?.[metricKey]);
      if (Number.isFinite(value)) bucket.values.push(value);
    }
  }

  const sortedBucketStarts = [...buckets.keys()].sort((a, b) => a - b);
  const points = [];
  for (const bucketStartMs of sortedBucketStarts) {
    const bucket = buckets.get(bucketStartMs);
    if (!bucket) continue;

    const bucketEndMs = getBucketEndLocalMs(bucketStartMs, granularity);
    if (metricKey === 'shotCount') {
      points.push({
        x: bucketStartMs,
        y: bucket.shotCount,
        bucketStartMs,
        bucketEndMs,
        shotCount: bucket.shotCount,
      });
      continue;
    }

    const avg = averageOf(bucket.values);
    if (!Number.isFinite(avg)) continue;

    points.push({
      x: bucketStartMs,
      y: avg,
      bucketStartMs,
      bucketEndMs,
      shotCount: bucket.shotCount,
    });
  }

  // No zero-fill gaps in V1: only buckets with real shots are rendered.
  return points;
}

function formatDateLocal(ms, options) {
  if (!Number.isFinite(ms)) return '';
  try {
    return new Date(ms).toLocaleDateString([], options);
  } catch {
    return '';
  }
}

export function formatTrendBucketTickLabel(xMs, granularity, options = {}) {
  const width = Number(options.containerWidth) || 0;
  const compact = width > 0 && width < 420;

  switch (granularity) {
    case 'day':
      return formatDateLocal(
        xMs,
        compact ? { month: 'short', day: 'numeric' } : { day: '2-digit', month: 'short' },
      );
    case 'week':
      return formatDateLocal(
        xMs,
        compact
          ? { month: 'short', day: 'numeric' }
          : { day: '2-digit', month: 'short', year: '2-digit' },
      );
    case 'month':
      return formatDateLocal(
        xMs,
        compact ? { month: 'short', year: '2-digit' } : { month: 'long', year: 'numeric' },
      );
    case 'year':
      return formatDateLocal(xMs, { year: 'numeric' });
    default:
      return formatDateLocal(xMs, { month: 'short', day: 'numeric' });
  }
}

export function formatTrendBucketTooltipTitle(pointMeta, granularity) {
  const bucketStartMs = Number(pointMeta?.bucketStartMs ?? pointMeta?.x);
  const bucketEndMs = Number(pointMeta?.bucketEndMs);
  if (!Number.isFinite(bucketStartMs)) return '';

  if (granularity === 'day') {
    return formatDateLocal(bucketStartMs, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  if (granularity === 'week') {
    const startText = formatDateLocal(bucketStartMs, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const endText = Number.isFinite(bucketEndMs)
      ? formatDateLocal(bucketEndMs, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : '';
    return endText ? `Week: ${startText} - ${endText}` : `Week: ${startText}`;
  }

  if (granularity === 'month') {
    return formatDateLocal(bucketStartMs, { month: 'long', year: 'numeric' });
  }

  if (granularity === 'year') {
    return formatDateLocal(bucketStartMs, { year: 'numeric' });
  }

  return formatDateLocal(bucketStartMs, { month: 'short', day: 'numeric', year: 'numeric' });
}
