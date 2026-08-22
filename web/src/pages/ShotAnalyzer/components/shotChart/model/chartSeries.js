import { TARGET_FLOW_MAX, TARGET_PRESSURE_MAX } from '../constants';
import { getSpikeResistantSeriesMax, safeMax, safeMin, toNumberOrNull } from '../helpers';

function getSampleValue(sample, keys) {
  for (const key of keys) {
    if (sample[key] !== undefined) return sample[key];
  }
  return null;
}

function getFlowFromSample(sample) {
  return getSampleValue(sample, ['fl', 'f', 'flow']);
}

export function buildSampleTimeline(samples) {
  const sampleTimesSec = new Array(samples.length);
  const cumulativeWaterTotalBySample = new Array(samples.length);
  let cumulativeWaterTotal = 0;

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i] || {};
    const tMs = Number(sample.t) || 0;
    sampleTimesSec[i] = tMs / 1000;

    if (i === 0) {
      cumulativeWaterTotalBySample[i] = 0;
      continue;
    }

    // Water totals are reconstructed from flow * dt so hover/export logic can query
    // consistent cumulative values even when the original shot payload does not store them.
    const prevTMs = Number(samples[i - 1]?.t) || tMs;
    const dt = Math.max(0, (tMs - prevTMs) / 1000);
    const flow = Number(getFlowFromSample(sample));
    cumulativeWaterTotal += (Number.isFinite(flow) ? flow : 0) * dt;
    cumulativeWaterTotalBySample[i] = cumulativeWaterTotal;
  }

  return {
    maxTime: samples.length > 0 ? (samples[samples.length - 1].t || 0) / 1000 : 0,
    shotStartSec: sampleTimesSec[0] ?? 0,
    sampleTimesSec,
    cumulativeWaterTotalBySample,
  };
}

export function buildSeries(samples) {
  const series = {
    pressure: [],
    flow: [],
    puckFlow: [],
    temp: [],
    weight: [],
    weightFlow: [],
    targetPressure: [],
    targetFlow: [],
    targetTemp: [],
  };

  samples.forEach(sample => {
    const t = (sample.t || 0) / 1000;

    // Samples may come from different sources/versions, so each series resolves a
    // small key fallback chain instead of assuming one canonical payload shape.
    const pressure = toNumberOrNull(getSampleValue(sample, ['cp', 'p', 'pressure']));
    const flow = toNumberOrNull(getFlowFromSample(sample));
    const puckFlow = toNumberOrNull(getSampleValue(sample, ['pf', 'puck_flow']));
    const temp = toNumberOrNull(getSampleValue(sample, ['ct', 'temperature']));
    const weight = toNumberOrNull(getSampleValue(sample, ['v', 'w', 'weight', 'm']));
    const weightFlow = toNumberOrNull(getSampleValue(sample, ['vf', 'weight_flow']));
    const targetPressure = toNumberOrNull(getSampleValue(sample, ['tp', 'target_pressure']));
    const targetFlow = toNumberOrNull(getSampleValue(sample, ['tf', 'target_flow']));
    const targetTemp = toNumberOrNull(getSampleValue(sample, ['tt', 'tr', 'target_temperature']));

    if (pressure !== null) series.pressure.push({ x: t, y: pressure });
    if (flow !== null) series.flow.push({ x: t, y: flow });
    if (puckFlow !== null) series.puckFlow.push({ x: t, y: puckFlow });
    if (temp !== null) series.temp.push({ x: t, y: temp });
    if (weight !== null && weight >= 0) series.weight.push({ x: t, y: weight });
    if (weightFlow !== null) series.weightFlow.push({ x: t, y: Math.max(0, weightFlow) });

    if (targetPressure !== null) {
      series.targetPressure.push({ x: t, y: Math.min(targetPressure, TARGET_PRESSURE_MAX) });
    }
    if (targetFlow !== null) {
      series.targetFlow.push({ x: t, y: Math.min(targetFlow, TARGET_FLOW_MAX) });
    }
    if (targetTemp !== null) series.targetTemp.push({ x: t, y: targetTemp });
  });

  return series;
}

export function buildAxisRanges(series) {
  const hasWeight = series.weight.some(point => point.y > 0);

  // The left axis should represent pressure/flow-family values only. Weight has its
  // own axis and should not inflate the shared scale used by the other series.
  const mainAxisMaxRaw = safeMax(
    [
      ...series.pressure.map(point => point.y),
      ...series.targetPressure.map(point => point.y),
      ...series.flow.map(point => point.y),
      ...series.puckFlow.map(point => point.y),
      ...series.targetFlow.map(point => point.y),
      getSpikeResistantSeriesMax(series.weightFlow, {
        fallback: 0,
        seriesKind: 'weightFlow',
      }),
    ],
    1,
  );
  const mainAxisMax = Math.max(9.7, mainAxisMaxRaw * 1.02);

  const weightAxisMaxRaw = getSpikeResistantSeriesMax(series.weight, {
    fallback: 1,
    seriesKind: 'weight',
  });
  const weightAxisMax = Math.max(1, weightAxisMaxRaw * 1.02);

  const tempAxisSamples = [...series.temp, ...series.targetTemp];
  const tempMinRaw = safeMin(
    tempAxisSamples.map(point => point.y),
    80,
  );
  const tempMaxRaw = safeMax(
    tempAxisSamples.map(point => point.y),
    100,
  );
  const tempRange = Math.max(0.5, tempMaxRaw - tempMinRaw);
  const tempTopPadding = Math.max(0.15, tempRange * 0.02);
  const tempBottomPadding = Math.max(0.25, tempRange * 0.07);

  return {
    hasWeight,
    mainAxisMax,
    weightAxisMax,
    tempAxisMin: tempMinRaw - tempBottomPadding,
    tempAxisMax: tempMaxRaw + tempTopPadding,
  };
}
