/** Identifies recorded sample gaps that exceed the normal 255 ms cadence. */

export const SLOW_SAMPLE_INTERVAL_THRESHOLD_MS = 255;

function getFiniteTimestamp(sample) {
  const rawTimestamp = sample?.t;
  if (rawTimestamp === null || rawTimestamp === undefined || rawTimestamp === '') return null;

  const timestamp = Number(rawTimestamp);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function getSlowSampleIntervalSummary(samples) {
  let maxSampleIntervalMs = null;
  if (!Array.isArray(samples)) {
    return { hasSlowSampleInterval: false, maxSampleIntervalMs };
  }

  for (let index = 1; index < samples.length; index++) {
    const previousTimestamp = getFiniteTimestamp(samples[index - 1]);
    const currentTimestamp = getFiniteTimestamp(samples[index]);
    if (previousTimestamp === null || currentTimestamp === null) continue;

    const intervalMs = currentTimestamp - previousTimestamp;
    if (intervalMs > SLOW_SAMPLE_INTERVAL_THRESHOLD_MS) {
      maxSampleIntervalMs = Math.max(maxSampleIntervalMs ?? 0, intervalMs);
    }
  }

  return {
    hasSlowSampleInterval: maxSampleIntervalMs !== null,
    maxSampleIntervalMs,
  };
}
