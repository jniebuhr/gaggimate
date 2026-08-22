/** Resolves profile exit targets against measured and delay-adjusted shot values. */

import { LAST_PHASE_OVERSHOOT_MAX_G } from './delayTracking';

function isDirectionallyValidLookAhead(operator, currentValue, nextValue) {
  if (!Number.isFinite(currentValue) || !Number.isFinite(nextValue)) return false;
  if (operator === 'gte') return nextValue >= currentValue;
  if (operator === 'lte') return nextValue <= currentValue;
  return true;
}

export function isWeightTarget(target) {
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

export function isTargetHit(target, value, context) {
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

export function findTargetMatch(targets, values, delayMs, context) {
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

export function findTargetMatchWithDirection(targets, nextSample, nSteps, context) {
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

export function predictTargetValuesAtStep(nSteps, context) {
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

export function findManualTargetMatch(targets, context) {
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

export function buildTargetCalcValues(targets, match, context) {
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

/**
 * Format stop reason type into human-readable string
 * @param {string} type - Raw stop reason type
 * @returns {string} Formatted reason
 */
export function formatStopReason(type) {
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
