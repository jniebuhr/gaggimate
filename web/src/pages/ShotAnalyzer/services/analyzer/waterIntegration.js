/** Resolves recorded pump-counter values before falling back to flow integration. */

function getRecordedPumpedWater(sample) {
  const water = sample?.wp;
  return typeof water === 'number' && Number.isFinite(water) && water >= 0 ? water : null;
}

/**
 * Recorded `wp` is a cumulative pump counter. Only a complete, non-decreasing
 * series is trustworthy; a partially logged counter must not mix with inferred
 * flow values inside the same shot.
 */
export function hasCompleteRecordedPumpedWater(samples) {
  if (!Array.isArray(samples) || samples.length === 0) return false;

  let previousWater = null;
  for (const sample of samples) {
    const water = getRecordedPumpedWater(sample);
    if (water === null || (previousWater !== null && water < previousWater)) return false;
    previousWater = water;
  }
  return true;
}

export function createPumpedWaterSource(samples) {
  return { usesRecordedPumpedWater: hasCompleteRecordedPumpedWater(samples) };
}

function getFiniteFlow(sample) {
  const flow = Number(sample?.fl);
  return Number.isFinite(flow) ? flow : 0;
}

function getIntervalSeconds(startSample, endSample) {
  const startTime = Number(startSample?.t);
  const endTime = Number(endSample?.t);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return 0;
  return Math.max(0, (endTime - startTime) / 1000);
}

function resolveLastIndex(samples, endIndex) {
  const requestedEndIndex = Number.isInteger(endIndex) ? endIndex : samples.length - 1;
  return Math.min(Math.max(requestedEndIndex, 0), samples.length - 1);
}

function shouldUseRecordedPumpedWater(samples, waterSource) {
  if (typeof waterSource?.usesRecordedPumpedWater === 'boolean') {
    return waterSource.usesRecordedPumpedWater;
  }
  return hasCompleteRecordedPumpedWater(samples);
}

function calculateFlowPumpedWater(samples, lastIndex, closingSample) {
  let water = 0;

  for (let index = 0; index < lastIndex; index += 1) {
    water += getFiniteFlow(samples[index]) * getIntervalSeconds(samples[index], samples[index + 1]);
  }

  if (closingSample) {
    water +=
      getFiniteFlow(samples[lastIndex]) * getIntervalSeconds(samples[lastIndex], closingSample);
  }

  return water;
}

function calculateRecordedPumpedWater(samples, lastIndex, closingSample) {
  const startWater = getRecordedPumpedWater(samples[0]);
  const endWater = getRecordedPumpedWater(closingSample || samples[lastIndex]);
  if (startWater === null || endWater === null) return null;
  return Math.max(0, endWater - startWater);
}

/**
 * Calculates a phase or shot water total. `closingSample` is the first sample
 * of the next phase: it closes this phase while remaining sample 0 of the next.
 */
export function calculatePumpedWater(
  samples,
  endIndex = samples?.length - 1,
  closingSample = null,
  waterSource = null,
) {
  if (!Array.isArray(samples) || samples.length === 0) return 0;

  const lastIndex = resolveLastIndex(samples, endIndex);
  if (shouldUseRecordedPumpedWater(samples, waterSource)) {
    const recordedWater = calculateRecordedPumpedWater(samples, lastIndex, closingSample);
    if (recordedWater !== null) return recordedWater;
  }

  return calculateFlowPumpedWater(samples, lastIndex, closingSample);
}

/** Returns phase-relative water at a real sample, including a following-phase sample. */
export function calculatePumpedWaterAtSample(samples, sample, waterSource = null) {
  if (!Array.isArray(samples) || samples.length === 0 || !sample) return 0;

  if (shouldUseRecordedPumpedWater(samples, waterSource)) {
    const startWater = getRecordedPumpedWater(samples[0]);
    const sampleWater = getRecordedPumpedWater(sample);
    if (startWater !== null && sampleWater !== null) return Math.max(0, sampleWater - startWater);
  }

  return calculatePumpedWater(samples, samples.length - 1, sample, waterSource);
}
