import { createEmptyMetricStats } from './metricStats';

export const MAX_VALID_PUCK_RESISTANCE = 100;

export function getPuckResistanceValue(sample) {
  const value = Number(sample?.pr);
  return Number.isFinite(value) && value > 0 && value < MAX_VALID_PUCK_RESISTANCE ? value : null;
}

export function getLiquidResistanceValue(sample) {
  const puckResistance = getPuckResistanceValue(sample);
  const pressure = Number(sample?.cp);

  if (puckResistance === null || !Number.isFinite(pressure) || pressure <= 0) return null;
  return puckResistance * Math.sqrt(pressure);
}

export function getPuckResistanceStats(samples, getValue) {
  const sourceSamples = Array.isArray(samples) ? samples : [];
  const valueGetter = typeof getValue === 'function' ? getValue : getPuckResistanceValue;
  let start = null;
  let end = null;
  let min = Infinity;
  let max = -Infinity;
  let weightedSum = 0;
  let totalTime = 0;
  let previousSample = null;

  for (const sample of sourceSamples) {
    const rawValue = valueGetter(sample);
    const value = Number(rawValue);
    if (rawValue == null || !Number.isFinite(value)) {
      previousSample = null;
      continue;
    }

    if (start === null) start = value;
    end = value;
    min = Math.min(min, value);
    max = Math.max(max, value);

    const timestamp = Number(sample?.t);
    if (previousSample && Number.isFinite(timestamp) && Number.isFinite(previousSample.timestamp)) {
      const dt = (timestamp - previousSample.timestamp) / 1000;
      if (dt > 0) {
        weightedSum += value * dt;
        totalTime += dt;
      }
    }

    previousSample = { timestamp, value };
  }

  if (start === null) return createEmptyMetricStats();

  return {
    start,
    end,
    min,
    max,
    avg: totalTime > 0 ? weightedSum / totalTime : start,
  };
}

export function getNativePuckResistanceStats(samples) {
  return getPuckResistanceStats(samples, getPuckResistanceValue);
}

export function getLiquidResistanceStats(samples) {
  return getPuckResistanceStats(samples, getLiquidResistanceValue);
}
