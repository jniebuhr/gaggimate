/**
 * AnalyzerService.js
 * * Shot Analysis Engine for GaggiMate
 * Calculates metrics, detects phase transitions, and determines exit reasons
 */

/* global globalThis */

const PREDICTIVE_WINDOW_MS = 4000;
// Last-phase fallback thresholds (g)
const LAST_PHASE_UNDERSHOOT_MIN_G = 2;
const LAST_PHASE_UNDERSHOOT_MAX_G = 6;
const LAST_PHASE_OVERSHOOT_MAX_G = 4;
const LAST_PHASE_ESTIMATED_DELAY_MAX_MS = 4000;

/**
 * Helper: Calculate statistics for a metric across samples
 * @param {Array} samples - Shot samples
 * @param {string} key - Metric key (e.g., 'cp', 'fl', 'ct')
 * @returns {Object} { start, end, min, max, avg }
 */
function getMetricStats(samples, key) {
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

function getPhaseWeightRate(samples, isLastPhase) {
  const anchorIndex = getPhaseAnchorIndexForWeightRate(samples, isLastPhase);
  if (anchorIndex < 0) return 0;
  return getRegressionWeightRate(samples, anchorIndex, PREDICTIVE_WINDOW_MS);
}

function getSampleInstantWeightRate(sample) {
  if (!sample) return 0;
  if (sample.vf !== undefined && sample.vf > 0.1) return sample.vf;
  if (sample.fl > 0.1) return sample.fl;
  return 0;
}

function isDirectionallyValidLookAhead(operator, currentValue, nextValue) {
  if (!Number.isFinite(currentValue) || !Number.isFinite(nextValue)) return false;
  if (operator === 'gte') return nextValue >= currentValue;
  if (operator === 'lte') return nextValue <= currentValue;
  return true;
}

function getLastNonExtendedIndex(samples) {
  if (!Array.isArray(samples) || samples.length === 0) return -1;
  for (let i = samples.length - 1; i >= 0; i--) {
    if (!samples[i].systemInfo?.extendedRecording) return i;
  }
  return samples.length - 1;
}

function isAnalyzerDebugEnabled() {
  if (typeof globalThis === 'undefined') return false;
  try {
    return (
      globalThis.__SHOT_ANALYZER_DEBUG__ === true ||
      globalThis.localStorage?.getItem('shotAnalyzerDebug') === '1'
    );
  } catch {
    return globalThis.__SHOT_ANALYZER_DEBUG__ === true;
  }
}

function analyzerDebug(enabled, message, payload = null) {
  if (!enabled) return;
  if (payload == null) {
    console.debug(`[ShotAnalyzer] ${message}`);
  } else {
    console.debug(`[ShotAnalyzer] ${message}`, payload);
  }
}

function isPositiveFiniteRate(value) {
  return value != null && Number.isFinite(value) && value > 0.1;
}

function getPhaseEndSample(samples) {
  return samples.at(-1);
}

function getDelayReviewMessage(phaseNumber, delayMs) {
  if (!phaseNumber) return null;
  if (delayMs != null) {
    return `Unusually high inferred delay in Phase ${phaseNumber} (${delayMs} ms).`;
  }
  return `Unusually high inferred delay in Phase ${phaseNumber}.`;
}

function normalizeMetricValue(value) {
  return value == null ? 0 : value;
}

function isWeightTarget(target) {
  return target.type === 'volumetric' || target.type === 'weight';
}

function shouldSkipTarget(target, context) {
  const weightTarget = isWeightTarget(target);
  if (!weightTarget) return false;
  if (!context.isBrewByWeight) return true;
  if (context.scaleConnectionBrokenPermanently) return true;
  return (
    context.isLastPhase &&
    context.lastNonExtendedSample.v > target.value + LAST_PHASE_OVERSHOOT_MAX_G
  );
}

function isTargetHit(target, value, context) {
  if (target.operator === 'lte') return value <= target.value;
  if (target.operator !== 'gte' || value < target.value) return false;

  return !(
    context.isLastPhase &&
    isWeightTarget(target) &&
    value > target.value + LAST_PHASE_OVERSHOOT_MAX_G
  );
}

function getTargetValue(target, values) {
  if (target.type === 'pressure') return values.pressure;
  if (target.type === 'flow') return values.flow;
  if (isWeightTarget(target)) return values.weight;
  if (target.type === 'pumped') return values.pumped;
  return undefined;
}

function createTargetMatch(target, value, delayMs) {
  return {
    target,
    delayMs,
    predictedWeight: isWeightTarget(target) ? value : null,
  };
}

function findTargetMatch(targets, values, delayMs, context) {
  for (const target of targets) {
    if (shouldSkipTarget(target, context)) continue;

    const value = getTargetValue(target, values);
    if (value === undefined) continue;

    if (isTargetHit(target, value, context)) {
      return createTargetMatch(target, value, delayMs);
    }
  }
  return null;
}

function getLookAheadTargetValues(target, nextSample, nSteps, context) {
  const horizon = nSteps * context.sampleIntervalSec;
  const nextDt = (nextSample.t - context.anchor.t) / 1000;

  if (target.type === 'pressure') {
    return {
      anchorValue: context.anchor.cp,
      nextValue: nextSample.cp,
      predictedValue: Math.max(0, context.anchor.cp + context.pressureSlope * horizon),
    };
  }
  if (target.type === 'flow') {
    return {
      anchorValue: context.anchor.fl,
      nextValue: nextSample.fl,
      predictedValue: Math.max(0, context.anchor.fl + context.flowSlope * horizon),
    };
  }
  if (isWeightTarget(target)) {
    return {
      anchorValue: context.anchor.v,
      nextValue: nextSample.v,
      predictedValue:
        context.anchor.v + (context.weightRate > 0 ? context.weightRate * horizon : 0),
    };
  }
  if (target.type === 'pumped') {
    return {
      anchorValue: context.anchorPumped,
      nextValue: context.anchorPumped + nextSample.fl * nextDt,
      predictedValue: context.anchorPumped + Math.max(0, context.anchor.fl) * horizon,
    };
  }
  return null;
}

function findTargetMatchWithDirection(targets, nextSample, nSteps, context) {
  for (const target of targets) {
    if (shouldSkipTarget(target, context)) continue;

    const values = getLookAheadTargetValues(target, nextSample, nSteps, context);
    if (!values) continue;

    const directionIsValid = isDirectionallyValidLookAhead(
      target.operator,
      values.anchorValue,
      values.nextValue,
    );
    const value = directionIsValid ? values.nextValue : values.predictedValue;

    if (isTargetHit(target, value, context)) {
      return createTargetMatch(target, value, nSteps * context.sampleInterval);
    }
  }
  return null;
}

function predictTargetValuesAtStep(nSteps, context) {
  const horizon = nSteps * context.sampleIntervalSec;
  return {
    pressure: Math.max(0, context.anchor.cp + context.pressureSlope * horizon),
    flow: Math.max(0, context.anchor.fl + context.flowSlope * horizon),
    weight: context.anchor.v + (context.weightRate > 0 ? context.weightRate * horizon : 0),
    pumped: context.anchorPumped + Math.max(0, context.anchor.fl) * horizon,
  };
}

function getManualTargetValue(target, context) {
  const scaleDelaySec = context.normalizedScaleDelayMs / 1000;
  const sensorDelaySec = context.normalizedSensorDelayMs / 1000;

  if (target.type === 'pressure') {
    return {
      delayMs: context.normalizedSensorDelayMs,
      value: Math.max(0, context.anchor.cp + context.pressureSlope * sensorDelaySec),
    };
  }
  if (target.type === 'flow') {
    return {
      delayMs: context.normalizedSensorDelayMs,
      value: Math.max(0, context.anchor.fl + context.flowSlope * sensorDelaySec),
    };
  }
  if (isWeightTarget(target)) {
    return {
      delayMs: context.normalizedScaleDelayMs,
      value: context.anchor.v + (context.weightRate > 0 ? context.weightRate * scaleDelaySec : 0),
    };
  }
  if (target.type === 'pumped') {
    return {
      delayMs: context.normalizedSensorDelayMs,
      value: context.anchorPumped + Math.max(0, context.anchor.fl) * sensorDelaySec,
    };
  }
  return null;
}

function findManualTargetMatch(targets, context) {
  for (const target of targets) {
    if (shouldSkipTarget(target, context)) continue;

    const result = getManualTargetValue(target, context);
    if (!result) continue;

    if (isTargetHit(target, result.value, context)) {
      return createTargetMatch(target, result.value, result.delayMs);
    }
  }
  return null;
}

function getCalculatedTargetValueAtDelay(target, context) {
  const matchStep = Math.round(context.matchDelayMs / context.sampleInterval);
  const nextSampleIndex = matchStep - 1;
  const hasNextSample =
    context.isAutoAdjusted &&
    nextSampleIndex >= 0 &&
    nextSampleIndex < context.nextPhaseSamples.length;

  if (hasNextSample) {
    const values = getLookAheadTargetValues(
      target,
      context.nextPhaseSamples[nextSampleIndex],
      matchStep,
      context,
    );
    if (!values) return undefined;

    const directionIsValid = isDirectionallyValidLookAhead(
      target.operator,
      values.anchorValue,
      values.nextValue,
    );
    return directionIsValid ? values.nextValue : values.predictedValue;
  }

  return getTargetValue(
    target,
    predictTargetValuesAtStep(context.matchDelayMs / context.sampleInterval, context),
  );
}

function buildTargetCalcValues(targets, match, context) {
  if (match.delayMs <= 0) return null;

  const targetCalcValues = {};
  const calcContext = {
    ...context,
    matchDelayMs: match.delayMs,
  };

  for (const target of targets) {
    if (shouldSkipTarget(target, context)) continue;

    const value = getCalculatedTargetValueAtDelay(target, calcContext);
    if (value === undefined) continue;

    targetCalcValues[target.type] = {
      value,
      isStopReason: target === match.target,
    };
  }

  return targetCalcValues;
}

function createEmptyMetricStats() {
  return { start: null, end: null, min: null, max: null, avg: null };
}

function createEmptyPhaseStats() {
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

function normalizePhaseLookupName(name) {
  return (name || '').trim().toLowerCase();
}

function getPreviousPhaseTargetValue(target, prevPhase) {
  if (isWeightTarget(target)) return prevPhase.weight ?? 0;
  if (target.type === 'pumped') return prevPhase.water ?? 0;
  if (target.type === 'pressure') return prevPhase.stats?.p?.avg ?? 0;
  if (target.type === 'flow') return prevPhase.stats?.f?.avg ?? 0;
  return undefined;
}

function getFirstSampleTargetValue(target, firstSample) {
  if (isWeightTarget(target)) return firstSample.v ?? 0;
  if (target.type === 'pressure') return firstSample.cp ?? 0;
  if (target.type === 'flow') return firstSample.fl ?? 0;
  return undefined;
}

function findSkippedTargetMatch(targets, getCurrentValue) {
  if (!Array.isArray(targets)) return null;

  for (const target of targets) {
    const currentValue = getCurrentValue(target);
    if (currentValue === undefined) continue;

    if (isTargetHit(target, currentValue, { isLastPhase: false })) {
      return {
        reason: `${formatStopReason(target.type)} (skipped)`,
        type: target.type,
        value: target.value,
      };
    }
  }
  return null;
}

function findNextExecutedFirstSample({ analyzedByName, phases, profileData, profileIndex }) {
  for (let index = profileIndex + 1; index < profileData.phases.length; index++) {
    const nextName = normalizePhaseLookupName(profileData.phases[index].name);
    const nextPhase = analyzedByName.get(nextName);
    if (!nextPhase) continue;

    const nextSamples = phases[nextPhase.number];
    return Array.isArray(nextSamples) ? nextSamples[0] || null : null;
  }
  return null;
}

function getSkippedPhaseFallbackInfo(prevPhase) {
  return {
    reason: prevPhase ? 'Phase skipped' : 'Phase skipped (no preceding phase)',
    type: 'unknown',
    value: null,
  };
}

function getSkippedPhaseInfo({
  analyzedByName,
  phases,
  prevPhase,
  profileData,
  profileIndex,
  profilePhase,
}) {
  const previousMatch = prevPhase
    ? findSkippedTargetMatch(profilePhase.targets, target =>
        getPreviousPhaseTargetValue(target, prevPhase),
      )
    : null;
  if (previousMatch) return previousMatch;

  const firstSample = findNextExecutedFirstSample({
    analyzedByName,
    phases,
    profileData,
    profileIndex,
  });
  const nextMatch = firstSample
    ? findSkippedTargetMatch(profilePhase.targets, target =>
        getFirstSampleTargetValue(target, firstSample),
      )
    : null;

  return nextMatch || getSkippedPhaseFallbackInfo(prevPhase);
}

function buildSkippedTargetCalcValues(skipType, skipValue) {
  if (!skipType || skipValue == null) return null;

  const calcValueByType = {
    duration: 'duration',
    flow: 'flow',
    pressure: 'pressure',
    pumped: 'pumped',
    volumetric: 'weight',
    weight: 'weight',
  };
  const calcKey = calcValueByType[skipType];
  if (!calcKey) return null;

  return {
    [calcKey]: {
      value: skipValue,
      isStopReason: true,
    },
  };
}

function createSkippedPhase(profilePhase, profileIndex, skipInfo) {
  return {
    number: profileIndex,
    name: profilePhase.name,
    displayName: profilePhase.name,
    start: 0,
    end: 0,
    duration: 0,
    water: 0,
    weight: 0,
    stats: createEmptyPhaseStats(),
    exit: {
      reason: skipInfo.reason,
      type: skipInfo.type || 'unknown',
    },
    profilePhase,
    scaleLost: false,
    scalePermanentlyLost: false,
    highScaleDelay: false,
    estimatedScaleDelayMs: null,
    delayReviewHint: false,
    delayReviewReason: null,
    delayReviewMs: null,
    prediction: { finalWeight: null },
    targetCalcValues: buildSkippedTargetCalcValues(skipInfo.type, skipInfo.value),
    skipped: true,
  };
}

function buildAnalyzedPhaseLookup(analyzedPhases) {
  const analyzedByName = new Map();

  for (const phase of analyzedPhases) {
    const key = normalizePhaseLookupName(phase.displayName || phase.name);
    if (key) analyzedByName.set(key, phase);
  }

  return analyzedByName;
}

function findMatchingProfilePhaseIndex(profilePhases, phase, startIndex) {
  const phaseName = normalizePhaseLookupName(phase.displayName || phase.name);
  if (!phaseName) return -1;

  return profilePhases.findIndex(
    (profilePhase, profileIndex) =>
      profileIndex >= startIndex && normalizePhaseLookupName(profilePhase.name) === phaseName,
  );
}

function appendSkippedProfilePhases({
  analyzedByName,
  endIndex,
  orderedPhases,
  phases,
  prevPhase,
  profileData,
  startIndex,
}) {
  for (let profileIndex = startIndex; profileIndex < endIndex; profileIndex++) {
    const profilePhase = profileData.phases[profileIndex];
    if (!normalizePhaseLookupName(profilePhase.name)) continue;

    const skipInfo = getSkippedPhaseInfo({
      analyzedByName,
      phases,
      prevPhase,
      profileData,
      profileIndex,
      profilePhase,
    });
    orderedPhases.push(createSkippedPhase(profilePhase, profileIndex, skipInfo));
  }
}

function mergeSkippedProfilePhases({ analyzedPhases, phases, profileData }) {
  if (!profileData?.phases?.length) return;

  const executedPhases = [...analyzedPhases];
  const analyzedByName = buildAnalyzedPhaseLookup(executedPhases);
  const orderedPhases = [];
  let profileIndex = 0;
  let previousExecutedPhase = null;

  for (const executedPhase of executedPhases) {
    const matchingProfileIndex = findMatchingProfilePhaseIndex(
      profileData.phases,
      executedPhase,
      profileIndex,
    );

    if (matchingProfileIndex >= 0) {
      appendSkippedProfilePhases({
        analyzedByName,
        endIndex: matchingProfileIndex,
        orderedPhases,
        phases,
        prevPhase: previousExecutedPhase,
        profileData,
        startIndex: profileIndex,
      });
      profileIndex = matchingProfileIndex + 1;
    }

    orderedPhases.push(executedPhase);
    previousExecutedPhase = executedPhase;
  }

  appendSkippedProfilePhases({
    analyzedByName,
    endIndex: profileData.phases.length,
    orderedPhases,
    phases,
    prevPhase: previousExecutedPhase,
    profileData,
    startIndex: profileIndex,
  });

  analyzedPhases.length = 0;
  analyzedPhases.push(...orderedPhases);
}

function createDelayTotals() {
  return {
    sumScaleDelay: 0,
    countScaleHits: 0,
    sumSensorDelay: 0,
    countSensorHits: 0,
  };
}

function addDelayHit(delayTotals, exitType, delayMs) {
  if (exitType === 'weight' || exitType === 'volumetric') {
    delayTotals.sumScaleDelay += delayMs;
    delayTotals.countScaleHits++;
    return;
  }
  delayTotals.sumSensorDelay += delayMs;
  delayTotals.countSensorHits++;
}

function createPhaseDelayTracker(isLastPhase) {
  const state = {
    highScaleDelay: false,
    estimatedScaleDelayMs: null,
    delayReviewHint: false,
    delayReviewReason: null,
    delayReviewMs: null,
  };

  const setEstimatedScaleDelay = delayMs => {
    if (delayMs == null || !Number.isFinite(delayMs) || delayMs < 0) return;
    const roundedDelay = Math.round(delayMs);
    state.estimatedScaleDelayMs =
      state.estimatedScaleDelayMs == null
        ? roundedDelay
        : Math.max(state.estimatedScaleDelayMs, roundedDelay);
    if (isLastPhase && roundedDelay > 2000) {
      state.highScaleDelay = true;
    }
  };

  const setPhaseDelayReviewHint = (delayMs, reason) => {
    if (delayMs == null || !Number.isFinite(delayMs) || delayMs < 1000) return;
    const roundedDelay = Math.round(delayMs);
    state.delayReviewHint = true;
    state.delayReviewReason = reason || 'manual-check';
    state.delayReviewMs =
      state.delayReviewMs == null ? roundedDelay : Math.max(state.delayReviewMs, roundedDelay);
  };

  return { state, setEstimatedScaleDelay, setPhaseDelayReviewHint };
}

function getPhaseSysAnomalies(samples, sysInfo) {
  const sysFieldMap = [
    ['sys_shot_vol', 'shotStartedVolumetric'],
    ['sys_curr_vol', 'currentlyVolumetric'],
    ['sys_scale', 'bluetoothScaleConnected'],
    ['sys_vol_avail', 'volumetricAvailable'],
    ['sys_ext', 'extendedRecording'],
  ];
  const sysAnomalies = {};

  for (const [statsKey, sampleKey] of sysFieldMap) {
    const finalValue = sysInfo[sampleKey];
    if (typeof finalValue !== 'boolean') continue;
    const mismatchIndex = samples.findIndex(sample => {
      const sampleValue = sample?.systemInfo?.[sampleKey];
      return typeof sampleValue === 'boolean' && sampleValue !== finalValue;
    });
    if (mismatchIndex < 0) continue;
    const mismatchSampleValue = samples[mismatchIndex]?.systemInfo?.[sampleKey];
    if (typeof mismatchSampleValue !== 'boolean') continue;
    sysAnomalies[statsKey] = {
      sampleInPhase: mismatchIndex + 1,
      sampleCountInPhase: samples.length,
      value: mismatchSampleValue,
    };
  }

  return sysAnomalies;
}

function findProfilePhase(profileData, rawName) {
  if (!profileData?.phases) return null;
  const cleanName = rawName ? rawName.trim().toLowerCase() : '';
  return profileData.phases.find(p => p.name.trim().toLowerCase() === cleanName) || null;
}

function getNextPhaseSamples({ phaseNum, phases, sortedPhaseKeys }) {
  const currentKeyIndex = sortedPhaseKeys.indexOf(phaseNum);
  const nextPhaseKey =
    currentKeyIndex >= 0 && currentKeyIndex < sortedPhaseKeys.length - 1
      ? sortedPhaseKeys[currentKeyIndex + 1]
      : null;
  return nextPhaseKey ? phases[nextPhaseKey] || [] : [];
}

function getPumpedWaterUntilIndex(samples, endIndex) {
  let pumped = 0;
  for (let i = 1; i <= endIndex; i++) {
    const dt = (samples[i].t - samples[i - 1].t) / 1000;
    pumped += samples[i].fl * dt;
  }
  return pumped;
}

function buildPhaseTargetContext({
  isBrewByWeight,
  isLastPhase,
  samples,
  scaleConnectionBrokenPermanently,
  shotData,
}) {
  const sampleInterval = shotData.sampleInterval || 250;
  const lastNonExtendedIndex = getLastNonExtendedIndex(samples);
  const lastNonExtendedSample =
    lastNonExtendedIndex >= 0 ? samples[lastNonExtendedIndex] : getPhaseEndSample(samples);
  const anchorIdx =
    isLastPhase && lastNonExtendedIndex >= 0 ? lastNonExtendedIndex : samples.length - 1;
  const anchor = samples[anchorIdx];
  const prevAnchor = anchorIdx > 0 ? samples[anchorIdx - 1] : anchor;
  const anchorDt = (anchor.t - prevAnchor.t) / 1000;

  return {
    anchor,
    anchorPumped: getPumpedWaterUntilIndex(samples, anchorIdx),
    flowSlope: anchorDt > 0 ? (anchor.fl - prevAnchor.fl) / anchorDt : 0,
    isBrewByWeight,
    isLastPhase,
    lastNonExtendedSample,
    pressureSlope: anchorDt > 0 ? (anchor.cp - prevAnchor.cp) / anchorDt : 0,
    sampleInterval,
    sampleIntervalSec: sampleInterval / 1000,
    scaleConnectionBrokenPermanently,
    weightRate: getPhaseWeightRate(samples, isLastPhase),
  };
}

function findAutoAdjustedTargetMatch(targets, targetContext, nextPhaseSamples) {
  const anchor = targetContext.anchor;
  let match = findTargetMatch(
    targets,
    {
      pressure: anchor.cp,
      flow: anchor.fl,
      weight: anchor.v,
      pumped: targetContext.anchorPumped,
    },
    0,
    targetContext,
  );
  if (match) return match;

  if (nextPhaseSamples.length > 0) {
    match = findTargetMatchWithDirection(targets, nextPhaseSamples[0], 1, targetContext);
  }
  if (match) return match;

  if (nextPhaseSamples.length > 1) {
    match = findTargetMatchWithDirection(targets, nextPhaseSamples[1], 2, targetContext);
  }
  if (match) return match;

  const maxSteps = Math.ceil(LAST_PHASE_ESTIMATED_DELAY_MAX_MS / targetContext.sampleInterval);
  for (let step = 3; step <= maxSteps; step++) {
    match = findTargetMatch(
      targets,
      predictTargetValuesAtStep(step, targetContext),
      step * targetContext.sampleInterval,
      targetContext,
    );
    if (match) return match;
  }
  return null;
}

function findPhaseTargetMatch({
  isAutoAdjusted,
  nextPhaseSamples,
  profilePhase,
  targetContext,
  settings,
}) {
  if (isAutoAdjusted) {
    return findAutoAdjustedTargetMatch(profilePhase.targets, targetContext, nextPhaseSamples);
  }
  return findManualTargetMatch(profilePhase.targets, {
    ...targetContext,
    normalizedScaleDelayMs: Math.max(0, settings.scaleDelayMs || 0),
    normalizedSensorDelayMs: Math.max(0, settings.sensorDelayMs || 0),
  });
}

function createExitState() {
  return {
    exitReason: null,
    exitType: null,
    finalPredictedWeight: null,
    targetCalcValues: null,
  };
}

function applyTimeLimitExit(exitState, duration, profilePhase) {
  const profDur = profilePhase.duration;
  if (Math.abs(duration - profDur) < 0.5 || duration >= profDur) {
    exitState.exitReason = 'Time Limit';
    exitState.exitType = 'duration';
  }
}

function applyTargetMatchResult({
  debugEnabled,
  delayTracker,
  delayTotals,
  displayName,
  exitState,
  isAutoAdjusted,
  match,
  nextPhaseSamples,
  phaseNum,
  profilePhase,
  shotData,
  targetContext,
}) {
  exitState.exitReason = formatStopReason(match.target.type);
  exitState.exitType = match.target.type;
  exitState.finalPredictedWeight = match.predictedWeight;
  delayTracker.setEstimatedScaleDelay(match.delayMs);

  if (isAutoAdjusted && match.delayMs >= targetContext.sampleInterval * 2) {
    delayTracker.setPhaseDelayReviewHint(match.delayMs, 'auto-delay');
  }

  analyzerDebug(debugEnabled, `Stop detected phase ${phaseNum}`, {
    shotId: shotData.id,
    phaseName: displayName,
    targetType: match.target.type,
    operator: match.target.operator,
    targetValue: match.target.value,
    delayMs: match.delayMs,
  });

  if (isAutoAdjusted) {
    addDelayHit(delayTotals, exitState.exitType, match.delayMs);
  }

  if (match.delayMs > 0) {
    exitState.targetCalcValues = buildTargetCalcValues(profilePhase.targets, match, {
      ...targetContext,
      isAutoAdjusted,
      nextPhaseSamples,
    });
  }
}

function findWeightTarget(targets) {
  return targets.find(t => t.type === 'weight' || t.type === 'volumetric') || null;
}

function getLastPhaseWeightSamples(samples) {
  const finalSample = getPhaseEndSample(samples);
  const lastNonExtendedIndex = getLastNonExtendedIndex(samples);
  const stopSample = lastNonExtendedIndex >= 0 ? samples[lastNonExtendedIndex] : finalSample;
  return {
    finalSample,
    finalW: finalSample.v,
    stopSample,
    stopW: stopSample.v,
  };
}

function getConservativeRate(...rates) {
  const rateCandidates = rates.filter(isPositiveFiniteRate);
  return rateCandidates.length > 0 ? Math.min(...rateCandidates) : 0;
}

function applyLastPhaseOvershootFallback({
  debugEnabled,
  delayTracker,
  delayTotals,
  displayName,
  exitState,
  phaseWeightRate,
  shotData,
  stopW,
  weightTarget,
}) {
  const overshoot = stopW - weightTarget.value;
  const stoppedAboveTargetInRange = overshoot >= 0 && overshoot <= LAST_PHASE_OVERSHOOT_MAX_G;
  if (!stoppedAboveTargetInRange || phaseWeightRate <= 0.1) return;

  const calculatedDelay = Math.max(0, (overshoot / phaseWeightRate) * 1000);
  if (calculatedDelay > LAST_PHASE_ESTIMATED_DELAY_MAX_MS) return;

  delayTracker.setEstimatedScaleDelay(calculatedDelay);
  exitState.exitReason = formatStopReason(weightTarget.type);
  exitState.exitType = weightTarget.type;
  exitState.finalPredictedWeight = weightTarget.value;
  addDelayHit(delayTotals, exitState.exitType, calculatedDelay);
  delayTracker.setPhaseDelayReviewHint(calculatedDelay, 'fallback-overshoot');
  analyzerDebug(debugEnabled, `Last-phase fallback weight stop (overshoot)`, {
    shotId: shotData.id,
    phaseName: displayName,
    stopWeight: stopW,
    targetWeight: weightTarget.value,
    estimatedDelayMs: Math.round(calculatedDelay),
  });
}

function applyLastPhaseUndershootFallback({
  conservativeRate,
  debugEnabled,
  delayTracker,
  delayTotals,
  displayName,
  exitState,
  finalW,
  shotData,
  stopW,
  weightTarget,
}) {
  const undershootAtEnd = weightTarget.value - finalW;
  const stoppedBelowTargetHighDelayCandidate =
    undershootAtEnd >= LAST_PHASE_UNDERSHOOT_MIN_G &&
    undershootAtEnd <= LAST_PHASE_UNDERSHOOT_MAX_G;
  if (exitState.exitType || !stoppedBelowTargetHighDelayCandidate || conservativeRate <= 0.1) {
    return;
  }

  const estimatedDelay = (undershootAtEnd / conservativeRate) * 1000;
  if (estimatedDelay <= 2000 || estimatedDelay > LAST_PHASE_ESTIMATED_DELAY_MAX_MS) return;

  delayTracker.setEstimatedScaleDelay(estimatedDelay);
  exitState.exitReason = formatStopReason(weightTarget.type);
  exitState.exitType = weightTarget.type;
  exitState.finalPredictedWeight = weightTarget.value;
  addDelayHit(delayTotals, exitState.exitType, estimatedDelay);
  delayTracker.setPhaseDelayReviewHint(estimatedDelay, 'fallback-undershoot');
  analyzerDebug(debugEnabled, `Last-phase fallback weight stop (undershoot high delay)`, {
    shotId: shotData.id,
    phaseName: displayName,
    stopWeight: stopW,
    finalWeight: finalW,
    targetWeight: weightTarget.value,
    estimatedDelayMs: Math.round(estimatedDelay),
  });
}

function applyLastPhaseWeightFallback({
  debugEnabled,
  delayTracker,
  delayTotals,
  displayName,
  exitState,
  phaseWeightRate,
  profilePhase,
  samples,
  shotData,
}) {
  const weightTarget = findWeightTarget(profilePhase.targets);
  if (!weightTarget) return;

  const { finalW, stopSample, stopW } = getLastPhaseWeightSamples(samples);
  if (stopW > weightTarget.value + LAST_PHASE_OVERSHOOT_MAX_G) {
    analyzerDebug(
      debugEnabled,
      `Last-phase weight stop blocked (>+${LAST_PHASE_OVERSHOOT_MAX_G}g)`,
      {
        shotId: shotData.id,
        phaseName: displayName,
        stopWeight: stopW,
        targetWeight: weightTarget.value,
      },
    );
    return;
  }

  const stopInstantRate = getSampleInstantWeightRate(stopSample);
  const conservativeRate = getConservativeRate(phaseWeightRate, stopInstantRate);
  applyLastPhaseOvershootFallback({
    debugEnabled,
    delayTracker,
    delayTotals,
    displayName,
    exitState,
    phaseWeightRate,
    shotData,
    stopW,
    weightTarget,
  });
  applyLastPhaseUndershootFallback({
    conservativeRate,
    debugEnabled,
    delayTracker,
    delayTotals,
    displayName,
    exitState,
    finalW,
    shotData,
    stopW,
    weightTarget,
  });
}

function updateLastPhaseDelayWarning({ delayTracker, phaseWeightRate, profilePhase, samples }) {
  const weightTarget = findWeightTarget(profilePhase.targets);
  if (!weightTarget) return;

  const { finalW, stopSample, stopW } = getLastPhaseWeightSamples(samples);
  const conservativeRate = getConservativeRate(
    phaseWeightRate,
    getSampleInstantWeightRate(stopSample),
  );
  const absDelta = Math.abs(finalW - weightTarget.value);

  if (
    stopW <= weightTarget.value + LAST_PHASE_OVERSHOOT_MAX_G &&
    conservativeRate > 0.1 &&
    absDelta >= LAST_PHASE_UNDERSHOOT_MIN_G &&
    absDelta <= LAST_PHASE_UNDERSHOOT_MAX_G
  ) {
    const estimatedDelay = (absDelta / conservativeRate) * 1000;
    if (estimatedDelay <= LAST_PHASE_ESTIMATED_DELAY_MAX_MS) {
      delayTracker.setEstimatedScaleDelay(estimatedDelay);
    }
  }
}

function shouldRunLastPhaseWeightLogic({
  isAutoAdjusted,
  isBrewByWeight,
  isLastPhase,
  scaleConnectionBrokenPermanently,
}) {
  return (
    isLastPhase && isAutoAdjusted && isBrewByWeight && scaleConnectionBrokenPermanently === false
  );
}

function analyzePhaseTargets({
  debugEnabled,
  delayTracker,
  delayTotals,
  displayName,
  duration,
  exitState,
  isAutoAdjusted,
  isBrewByWeight,
  isLastPhase,
  phaseNum,
  phaseWeightRate,
  phases,
  profilePhase,
  samples,
  scaleConnectionBrokenPermanently,
  settings,
  shotData,
  sortedPhaseKeys,
}) {
  applyTimeLimitExit(exitState, duration, profilePhase);
  const profDur = profilePhase.duration;
  const shouldCheckTargets =
    profilePhase.targets?.length > 0 && (!exitState.exitType || duration < profDur - 0.5);
  if (!shouldCheckTargets) return;

  const nextPhaseSamples = getNextPhaseSamples({ phaseNum, phases, sortedPhaseKeys });
  const targetContext = buildPhaseTargetContext({
    isBrewByWeight,
    isLastPhase,
    samples,
    scaleConnectionBrokenPermanently,
    shotData,
  });
  const match = findPhaseTargetMatch({
    isAutoAdjusted,
    nextPhaseSamples,
    profilePhase,
    targetContext,
    settings,
  });

  if (match) {
    applyTargetMatchResult({
      debugEnabled,
      delayTracker,
      delayTotals,
      displayName,
      exitState,
      isAutoAdjusted,
      match,
      nextPhaseSamples,
      phaseNum,
      profilePhase,
      shotData,
      targetContext,
    });
  } else {
    analyzerDebug(debugEnabled, `No stop match phase ${phaseNum}`, {
      shotId: shotData.id,
      phaseName: displayName,
      targetCount: profilePhase.targets.length,
    });
  }

  const runLastPhaseWeightLogic = shouldRunLastPhaseWeightLogic({
    isAutoAdjusted,
    isBrewByWeight,
    isLastPhase,
    scaleConnectionBrokenPermanently,
  });
  if (runLastPhaseWeightLogic && !match) {
    applyLastPhaseWeightFallback({
      debugEnabled,
      delayTracker,
      delayTotals,
      displayName,
      exitState,
      phaseWeightRate,
      profilePhase,
      samples,
      shotData,
    });
  }
  if (runLastPhaseWeightLogic) {
    updateLastPhaseDelayWarning({ delayTracker, phaseWeightRate, profilePhase, samples });
  }
}

function getPhaseStats(samples, sysInfo, sysAnomalies) {
  return {
    p: getMetricStats(samples, 'cp'),
    tp: getMetricStats(samples, 'tp'),
    f: getMetricStats(samples, 'fl'),
    pf: getMetricStats(samples, 'pf'),
    tf: getMetricStats(samples, 'tf'),
    t: getMetricStats(samples, 'ct'),
    tt: getMetricStats(samples, 'tt'),
    w: getMetricStats(samples, 'v'),
    wf: getMetricStats(samples, 'vf'),
    sys_raw: sysInfo.raw,
    sys_shot_vol: sysInfo.shotStartedVolumetric,
    sys_curr_vol: sysInfo.currentlyVolumetric,
    sys_scale: sysInfo.bluetoothScaleConnected,
    sys_vol_avail: sysInfo.volumetricAvailable,
    sys_ext: sysInfo.extendedRecording,
    sys_anomalies: Object.keys(sysAnomalies).length > 0 ? sysAnomalies : undefined,
  };
}

function analyzeExecutedPhase({
  debugEnabled,
  delayTotals,
  globalStartTime,
  isAutoAdjusted,
  isBrewByWeight,
  lastPhaseKey,
  phaseNameMap,
  phaseNum,
  phases,
  profileData,
  scaleConnectionBrokenPermanently,
  settings,
  shotData,
  sortedPhaseKeys,
}) {
  const samples = phases[phaseNum];
  const pStart = (samples[0].t - globalStartTime) / 1000;
  const pEnd = (getPhaseEndSample(samples).t - globalStartTime) / 1000;
  const duration = pEnd - pStart;
  const isLastPhase = phaseNum === lastPhaseKey;
  const phaseWeightRate = getPhaseWeightRate(samples, isLastPhase);
  const rawName = phaseNameMap[phaseNum];
  const displayName = rawName || `Phase ${phaseNum}`;
  const sysInfo = getPhaseEndSample(samples).systemInfo || {};
  const sysAnomalies = getPhaseSysAnomalies(samples, sysInfo);
  const scaleLostInThisPhase =
    isBrewByWeight && samples.some(s => s.systemInfo?.bluetoothScaleConnected === false);
  const nextScaleConnectionBroken = scaleConnectionBrokenPermanently || scaleLostInThisPhase;
  const delayTracker = createPhaseDelayTracker(isLastPhase);
  const exitState = createExitState();
  const profilePhase = findProfilePhase(profileData, rawName);

  if (profilePhase) {
    analyzePhaseTargets({
      debugEnabled,
      delayTracker,
      delayTotals,
      displayName,
      duration,
      exitState,
      isAutoAdjusted,
      isBrewByWeight,
      isLastPhase,
      phaseNum,
      phaseWeightRate,
      phases,
      profilePhase,
      samples,
      scaleConnectionBrokenPermanently: nextScaleConnectionBroken,
      settings,
      shotData,
      sortedPhaseKeys,
    });
  }

  return {
    phase: {
      number: phaseNum,
      name: rawName,
      displayName,
      start: pStart,
      end: pEnd,
      duration,
      water: getPumpedWaterUntilIndex(samples, samples.length - 1),
      weight: getPhaseEndSample(samples).v,
      stats: getPhaseStats(samples, sysInfo, sysAnomalies),
      exit: {
        reason: exitState.exitReason,
        type: exitState.exitType,
      },
      profilePhase,
      scaleLost: scaleLostInThisPhase,
      scalePermanentlyLost: nextScaleConnectionBroken,
      highScaleDelay: delayTracker.state.highScaleDelay,
      estimatedScaleDelayMs: delayTracker.state.estimatedScaleDelayMs,
      delayReviewHint: delayTracker.state.delayReviewHint,
      delayReviewReason: delayTracker.state.delayReviewReason,
      delayReviewMs: delayTracker.state.delayReviewMs,
      prediction: {
        finalWeight: exitState.finalPredictedWeight,
      },
      targetCalcValues: exitState.targetCalcValues,
    },
    scaleConnectionBrokenPermanently: nextScaleConnectionBroken,
  };
}

/**
 * Format stop reason type into human-readable string
 * @param {string} type - Raw stop reason type
 * @returns {string} Formatted reason
 */
function formatStopReason(type) {
  if (!type) return '';

  const t = type.toLowerCase();

  // Map internal types to GM UI friendly labels
  if (t === 'duration') return 'Time Stop';
  if (t === 'pumped') return 'Pumped Water Stop';
  if (t === 'volumetric' || t === 'weight') return 'Weight Stop';
  if (t === 'pressure') return 'Pressure Stop';
  if (t === 'flow') return 'Pump Flow Stop';

  // Fallback
  return `${t.charAt(0).toUpperCase() + t.slice(1)} Stop`;
}

/**
 * Main Analysis Function
 * Calculates all metrics for a shot with optional profile comparison
 * * @param {Object} shotData - Shot data with samples array
 * @param {Object|null} profileData - Optional profile for comparison
 * @param {Object} settings - Analysis settings
 * @param {number} settings.scaleDelayMs - Scale latency in ms (default: 0)
 * @param {number} settings.sensorDelayMs - System sensor delay in ms (default: 200)
 * @param {boolean} settings.isAutoAdjusted - Whether delay was auto-detected
 * @returns {Object} Analysis results with phases and totals
 */
export function calculateShotMetrics(shotData, profileData, settings) {
  // Defensive guard: ensure valid shot data with samples
  if (!shotData || !Array.isArray(shotData.samples) || shotData.samples.length === 0) {
    return { phases: [], warnings: ['No sample data available for analysis.'] };
  }

  const { scaleDelayMs, sensorDelayMs, isAutoAdjusted } = settings;
  const debugEnabled = isAnalyzerDebugEnabled();
  const gSamples = shotData.samples;
  const globalStartTime = gSamples[0].t;

  // --- 1. PHASE SEPARATION ---
  const phases = {};
  const phaseNameMap = {};

  if (shotData.phaseTransitions) {
    shotData.phaseTransitions.forEach(pt => {
      phaseNameMap[pt.phaseNumber] = pt.phaseName;
    });
  }

  gSamples.forEach(sample => {
    const pNum = sample.phaseNumber;
    if (!phases[pNum]) phases[pNum] = [];
    phases[pNum].push(sample);
  });

  const sortedPhaseKeys = Object.keys(phases).sort((a, b) => a - b);
  const lastPhaseKey = sortedPhaseKeys.at(-1);

  // --- 2. BREW MODE DETECTION ---
  const startSysInfo = gSamples[0].systemInfo || {};
  const isBrewByWeight = startSysInfo.shotStartedVolumetric === true;

  let globalScaleLost = false;
  if (isBrewByWeight) {
    globalScaleLost = gSamples.some(s => s.systemInfo?.bluetoothScaleConnected === false);
  }

  // --- 3. GLOBAL TOTALS ---
  let gDuration = (gSamples.at(-1).t - gSamples[0].t) / 1000;

  let gWater = 0;
  for (let i = 1; i < gSamples.length; i++) {
    const dt = (gSamples[i].t - gSamples[i - 1].t) / 1000;
    gWater += gSamples[i].fl * dt;
  }

  let gWeight = gSamples.at(-1).v;

  // --- 4. PHASE-BY-PHASE ANALYSIS ---
  const analyzedPhases = [];
  const delayTotals = createDelayTotals();
  let scaleConnectionBrokenPermanently = false;

  for (const phaseNum of sortedPhaseKeys) {
    const result = analyzeExecutedPhase({
      debugEnabled,
      delayTotals,
      globalStartTime,
      isAutoAdjusted,
      isBrewByWeight,
      lastPhaseKey,
      phaseNameMap,
      phaseNum,
      phases,
      profileData,
      scaleConnectionBrokenPermanently,
      settings,
      shotData,
      sortedPhaseKeys,
    });
    analyzedPhases.push(result.phase);
    scaleConnectionBrokenPermanently = result.scaleConnectionBrokenPermanently;
  }

  // --- 4b. DETECT SKIPPED PHASES (phases defined in profile but absent from shot) ---
  mergeSkippedProfilePhases({ analyzedPhases, phases, profileData });

  // Calculate distinct Average Delays
  let avgScaleDelay = scaleDelayMs;
  let avgSensorDelay = sensorDelayMs;

  if (isAutoAdjusted) {
    if (delayTotals.countScaleHits > 0) {
      avgScaleDelay = Math.round(delayTotals.sumScaleDelay / delayTotals.countScaleHits / 50) * 50;
    }
    if (delayTotals.countSensorHits > 0) {
      avgSensorDelay =
        Math.round(delayTotals.sumSensorDelay / delayTotals.countSensorHits / 50) * 50;
    }
  }

  analyzerDebug(debugEnabled, 'Auto-delay summary', {
    shotId: shotData.id,
    isAutoAdjusted,
    scaleHits: delayTotals.countScaleHits,
    sensorHits: delayTotals.countSensorHits,
    avgScaleDelayMs: avgScaleDelay,
    avgSensorDelayMs: avgSensorDelay,
  });

  // --- 5. TOTAL STATS ---
  const finalSysInfo = gSamples.at(-1).systemInfo || {};

  const totalStats = {
    duration: gDuration,
    water: gWater,
    weight: gWeight,
    p: getMetricStats(gSamples, 'cp'),
    tp: getMetricStats(gSamples, 'tp'),
    f: getMetricStats(gSamples, 'fl'),
    pf: getMetricStats(gSamples, 'pf'),
    tf: getMetricStats(gSamples, 'tf'),
    t: getMetricStats(gSamples, 'ct'),
    tt: getMetricStats(gSamples, 'tt'),
    w: getMetricStats(gSamples, 'v'),
    wf: getMetricStats(gSamples, 'vf'),
    sys_raw: finalSysInfo.raw,
    sys_shot_vol: finalSysInfo.shotStartedVolumetric,
    sys_curr_vol: finalSysInfo.currentlyVolumetric,
    sys_scale: finalSysInfo.bluetoothScaleConnected,
    sys_vol_avail: finalSysInfo.volumetricAvailable,
    sys_ext: finalSysInfo.extendedRecording,
  };

  const highScaleDelayPhases = analyzedPhases.filter(p => p.highScaleDelay);
  const hasHighScaleDelay = highScaleDelayPhases.length > 0;
  const highScaleDelayMs = hasHighScaleDelay
    ? Math.max(...highScaleDelayPhases.map(p => p.estimatedScaleDelayMs || 0))
    : null;
  const delayReviewPhases = analyzedPhases
    .map((phase, idx) => ({ ...phase, tablePhaseNumber: idx + 1 }))
    .filter(phase => phase.delayReviewHint);
  const hasDelayReviewHint = delayReviewPhases.length > 0;
  const primaryDelayReview = hasDelayReviewHint
    ? [...delayReviewPhases].sort((a, b) => (b.delayReviewMs || 0) - (a.delayReviewMs || 0))[0]
    : null;
  const hideLastPhaseDelayReview = primaryDelayReview?.tablePhaseNumber === analyzedPhases.length;
  const shouldExposeDelayReview = Boolean(primaryDelayReview) && !hideLastPhaseDelayReview;
  const delayReviewPhaseNumber = shouldExposeDelayReview
    ? primaryDelayReview.tablePhaseNumber
    : null;
  const delayReviewMs = shouldExposeDelayReview ? primaryDelayReview.delayReviewMs : null;
  const delayReviewMessage = getDelayReviewMessage(delayReviewPhaseNumber, delayReviewMs);

  return {
    isBrewByWeight,
    globalScaleLost,
    highScaleDelay: hasHighScaleDelay,
    highScaleDelayMs,
    delayReviewHint: shouldExposeDelayReview,
    delayReviewPhaseNumber,
    delayReviewMs,
    delayReviewMessage,
    isAutoAdjusted,
    usedSettings: {
      scaleDelayMs: avgScaleDelay,
      sensorDelayMs: avgSensorDelay,
    },
    phases: analyzedPhases,
    total: totalStats,
    rawSamples: gSamples,
    startTime: globalStartTime,
  };
}

/**
 * Auto-Delay Detection
 * Optimization Loop: 0 to 3000ms in 100ms steps.
 * Special Handling: Last phase weight target is calculated independently.
 * * @param {Object} shotData - Shot data
 * @param {Object|null} profileData - Profile data with targets
 * @param {number} fallbackDelay - Delay used when automatic detection cannot find a match
 * @returns {Object} { delay: number, auto: boolean }
 */
export function detectAutoDelay(shotData, profileData, fallbackDelay) {
  // Perform a quick check using calculateShotMetrics logic
  const results = calculateShotMetrics(shotData, profileData, {
    scaleDelayMs: fallbackDelay,
    sensorDelayMs: fallbackDelay,
    isAutoAdjusted: true,
  });

  if (results?.usedSettings) {
    // Return scale delay as primary "detected" delay for legacy compatibility
    return { delay: results.usedSettings.scaleDelayMs, auto: true };
  }

  return { delay: fallbackDelay, auto: false };
}
