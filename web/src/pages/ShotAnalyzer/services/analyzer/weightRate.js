const PREDICTIVE_WINDOW_MS = 4000;

/**
 * Pick the sample index used as prediction anchor for the phase.
 * For the last phase, prefer the last non-extended-recording sample
 * to avoid tail-rate artifacts from post-stop drip logging.
 */
function getPhaseAnchorIndexForWeightRate(samples, isLastPhase) {
  if (!Array.isArray(samples) || samples.length === 0) return -1;
  if (!isLastPhase) return samples.length - 1;

  for (let i = samples.length - 1; i >= 0; i--) {
    const sys = samples[i].systemInfo || {};
    if (!sys.extendedRecording) return i;
  }
  return samples.length - 1;
}

/**
 * Backend-like weight-rate estimation:
 * Linear regression slope of volume over time in the last 4s window.
 * Returns g/s
 */
function getRegressionWeightRate(samples, endIndex, windowMs = PREDICTIVE_WINDOW_MS) {
  if (!Array.isArray(samples) || endIndex < 1 || endIndex >= samples.length) return 0;

  const endTime = samples[endIndex].t;
  const cutoff = endTime - windowMs;

  let startIndex = endIndex;
  while (startIndex > 0 && samples[startIndex - 1].t > cutoff) {
    startIndex--;
  }

  const count = endIndex - startIndex + 1;
  if (count < 2) return 0;

  let tMean = 0;
  let vMean = 0;
  for (let i = startIndex; i <= endIndex; i++) {
    tMean += samples[i].t;
    vMean += samples[i].v ?? 0;
  }
  tMean /= count;
  vMean /= count;

  let tdev2 = 0;
  let tdevVdev = 0;
  for (let i = startIndex; i <= endIndex; i++) {
    const tDev = samples[i].t - tMean;
    const vDev = (samples[i].v ?? 0) - vMean;
    tdevVdev += tDev * vDev;
    tdev2 += tDev * tDev;
  }

  if (tdev2 < 1e-10) return 0;

  const volumePerMillisecond = tdevVdev / tdev2;
  if (volumePerMillisecond <= 0) return 0;

  return volumePerMillisecond * 1000; // g/ms -> g/s
}

export function getPhaseWeightRate(samples, isLastPhase) {
  const anchorIndex = getPhaseAnchorIndexForWeightRate(samples, isLastPhase);
  if (anchorIndex < 0) return 0;
  return getRegressionWeightRate(samples, anchorIndex, PREDICTIVE_WINDOW_MS);
}

export function getSampleInstantWeightRate(sample) {
  if (!sample) return 0;
  if (sample.vf !== undefined && sample.vf > 0.1) return sample.vf;
  if (sample.fl > 0.1) return sample.fl;
  return 0;
}

export function getLastNonExtendedIndex(samples) {
  if (!Array.isArray(samples) || samples.length === 0) return -1;
  for (let i = samples.length - 1; i >= 0; i--) {
    if (!samples[i].systemInfo?.extendedRecording) return i;
  }
  return samples.length - 1;
}

/**
 * Excludes only the post-shot extended-recording tail. A zero from the actual
 * brew remains a valid measurement because it is retained when not extended.
 */
export function getSamplesThroughLastNonExtended(samples) {
  const endIndex = getLastNonExtendedIndex(samples);
  return endIndex >= 0 ? samples.slice(0, endIndex + 1) : [];
}

export function isPositiveFiniteRate(value) {
  return value != null && Number.isFinite(value) && value > 0.1;
}

export function getPhaseEndSample(samples) {
  return samples.at(-1);
}
