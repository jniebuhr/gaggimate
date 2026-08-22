/**
 * Helper: Calculate statistics for a metric across samples
 * @param {Array} samples - Shot samples
 * @param {string} key - Metric key (e.g., 'cp', 'fl', 'ct')
 * @returns {Object} { start, end, min, max, avg }
 */
export function getMetricStats(samples, key) {
  let min = Infinity;
  let max = -Infinity;
  let weightedSum = 0;
  let totalTime = 0;

  // Start and End values
  const start = normalizeMetricValue(samples[0][key]);
  const end = normalizeMetricValue(samples.at(-1)[key]);

  // Min, Max, and Time-Weighted Average
  let previousSample = null;
  for (const sample of samples) {
    const val = normalizeMetricValue(sample[key]);

    if (val < min) min = val;
    if (val > max) max = val;

    // Time-weighted average (using time delta between samples)
    if (previousSample) {
      const dt = (sample.t - previousSample.t) / 1000; // Convert to seconds
      if (dt > 0) {
        weightedSum += val * dt;
        totalTime += dt;
      }
    }
    previousSample = sample;
  }

  // Safety for Infinity (if no valid samples processed)
  if (min === Infinity) min = 0;
  if (max === -Infinity) max = 0;

  // For single-sample phases, totalTime is 0 — use the sample value directly
  const avg = totalTime > 0 ? weightedSum / totalTime : start;

  return { start, end, min, max, avg };
}

function normalizeMetricValue(value) {
  return value == null ? 0 : value;
}

function createEmptyMetricStats() {
  return { start: null, end: null, min: null, max: null, avg: null };
}

export function createEmptyPhaseStats() {
  return {
    p: createEmptyMetricStats(),
    tp: createEmptyMetricStats(),
    f: createEmptyMetricStats(),
    pf: createEmptyMetricStats(),
    tf: createEmptyMetricStats(),
    t: createEmptyMetricStats(),
    tt: createEmptyMetricStats(),
    w: createEmptyMetricStats(),
    wf: createEmptyMetricStats(),
  };
}
