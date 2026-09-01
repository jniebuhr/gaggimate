/** Resolves profile exit targets against measured and delay-adjusted shot values. */

import { LAST_PHASE_OVERSHOOT_MAX_G } from './delayTracking';
import { calculatePumpedWaterAtSample } from './waterIntegration';

export const PREDICTION_INTERVAL_MS = 100;

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

function createTargetMatch(target, value, delayMs, observedSample = null) {
  return {
    target,
    delayMs,
    predictedWeight: isWeightTarget(target) ? value : null,
    observedSample,
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

function getLookAheadTargetValues(target, nextSample, delayMs, context) {
  const horizon = Math.max(0, delayMs) / 1000;

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
    const observedPumped = Array.isArray(context.phaseSamples)
      ? calculatePumpedWaterAtSample(context.phaseSamples, nextSample, context.pumpedWaterSource)
      : context.anchorPumped + context.anchor.fl * horizon;
    return {
      anchorValue: context.anchorPumped,
      nextValue: observedPumped,
      predictedValue: context.anchorPumped + Math.max(0, context.anchor.fl) * horizon,
    };
  }
  return null;
}

function getLookAheadMatchedValue(target, nextSample, delayMs, context) {
  const values = getLookAheadTargetValues(target, nextSample, delayMs, context);
  if (!values) return undefined;

  const directionIsValid = isDirectionallyValidLookAhead(
    target.operator,
    values.anchorValue,
    values.nextValue,
  );
  return directionIsValid ? values.nextValue : values.predictedValue;
}

export function findTargetMatchWithDirection(targets, nextSample, context) {
  const rawDelayMs = Number(nextSample?.t) - Number(context.anchor?.t);
  const delayMs = Number.isFinite(rawDelayMs) ? Math.max(0, rawDelayMs) : 0;

  for (const target of targets) {
    if (shouldSkipTarget(target, context)) continue;

    const value = getLookAheadMatchedValue(target, nextSample, delayMs, context);
    if (value === undefined) continue;

    if (isTargetHit(target, value, context)) {
      return createTargetMatch(target, value, delayMs, nextSample);
    }
  }
  return null;
}

export function predictTargetValuesAtDelay(delayMs, context) {
  const horizon = Math.max(0, delayMs) / 1000;
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
  if (context.observedSample) {
    return getLookAheadMatchedValue(target, context.observedSample, context.matchDelayMs, context);
  }

  return getTargetValue(target, predictTargetValuesAtDelay(context.matchDelayMs, context));
}

export function buildTargetCalcValues(targets, match, context) {
  if (match.delayMs <= 0) return null;

  const targetCalcValues = {};
  const calcContext = {
    ...context,
    matchDelayMs: match.delayMs,
    observedSample: match.observedSample,
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
