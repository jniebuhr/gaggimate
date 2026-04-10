/**
 * buildShotChartModel.js
 *
 * Translates raw shot samples + analyzer results into the normalized model used
 * by Chart.js config builders, hover helpers, and replay preparation.
 */

import { TARGET_FLOW_MAX, TARGET_PRESSURE_MAX } from './constants';
import {
  findLastSampleIndexAtOrBeforeX,
  getPhaseName,
  safeMax,
  safeMin,
  toNumberOrNull,
} from './helpers';

function getSampleValue(sample, keys) {
  for (const key of keys) {
    if (sample[key] !== undefined) return sample[key];
  }
  return null;
}

function getFlowFromSample(sample) {
  return getSampleValue(sample, ['fl', 'f', 'flow']);
}

function buildSampleTimeline(samples) {
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

function buildPhaseHoverRanges(
  results,
  shotStartSec,
  sampleTimesSec,
  cumulativeWaterTotalBySample,
) {
  if (!Array.isArray(results?.phases)) return [];

  // Cache absolute phase windows once so hover lookups can resolve "phase water"
  // with cheap arithmetic instead of rescanning phase metadata on every pointer move.
  return results.phases
    .map(phase => {
      const startRel = Number(phase?.start);
      if (!Number.isFinite(startRel)) return null;

      const endRelRaw = Number(phase?.end);
      const endRel = Number.isFinite(endRelRaw) ? endRelRaw : startRel;
      const startAbs = shotStartSec + startRel;
      const endAbs = shotStartSec + Math.max(startRel, endRel);
      const startSampleIndexFloor = findLastSampleIndexAtOrBeforeX(sampleTimesSec, startAbs);

      return {
        label: phase?.displayName || phase?.name || null,
        startAbs,
        endAbs,
        startCumWater:
          startSampleIndexFloor >= 0 ? cumulativeWaterTotalBySample[startSampleIndexFloor] || 0 : 0,
      };
    })
    .filter(Boolean);
}

function buildSeries(samples) {
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

function buildAxisRanges(series) {
  const hasWeight = series.weight.some(point => point.y > 0);

  // The left axis should represent pressure/flow-family values only. Weight has its
  // own axis and should not inflate the shared scale used by the other series.
  const mainAxisSamples = [
    ...series.pressure,
    ...series.targetPressure,
    ...series.flow,
    ...series.puckFlow,
    ...series.targetFlow,
    ...series.weightFlow,
  ];
  const mainAxisMaxRaw = safeMax(
    mainAxisSamples.map(point => point.y),
    1,
  );
  const mainAxisMax = Math.max(1, mainAxisMaxRaw * 1.02);

  const weightAxisMaxRaw = safeMax(
    series.weight.map(point => point.y),
    1,
  );
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

function buildPhaseAnnotations({
  shotData,
  results,
  samples,
  maxTime,
  colors,
  visibility,
  brewModeMeta,
}) {
  const phaseAnnotations = {};

  // Build a single annotation map that can be shared by the main chart, replay,
  // and export flows. That keeps phase timing and stop markers derived from one source.
  if (shotData.phaseTransitions && shotData.phaseTransitions.length > 0) {
    if (samples.length > 0) {
      const shotStartTime = (samples[0].t || 0) / 1000;
      phaseAnnotations.shot_start = {
        type: 'line',
        scaleID: 'x',
        value: shotStartTime,
        borderColor: colors.phaseLine,
        borderWidth: 1,
        label: {
          display: visibility.phaseNames,
          content: getPhaseName(shotData, 0),
          rotation: -90,
          position: 'start',
          yAdjust: 0,
          xAdjust: 12,
          color: 'rgba(255, 255, 255, 0.95)',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          borderRadius: 3,
          padding: 4,
          font: { size: 9 },
        },
      };
    }

    shotData.phaseTransitions.forEach((transition, index) => {
      let timeInSeconds = 0;
      if (transition.sampleIndex !== undefined && samples[transition.sampleIndex]) {
        timeInSeconds = (samples[transition.sampleIndex].t || 0) / 1000;
      } else if (transition.sampleIndex !== undefined) {
        timeInSeconds = (transition.sampleIndex * (shotData.sampleInterval || 250)) / 1000;
      }

      if (timeInSeconds <= 0.1 && index === 0) return;

      phaseAnnotations[`phase_line_${index}`] = {
        type: 'line',
        scaleID: 'x',
        value: timeInSeconds,
        borderColor: colors.phaseLine,
        borderWidth: 1,
        label: {
          display: visibility.phaseNames,
          content: transition.phaseName || `P${transition.phaseNumber + 1}`,
          rotation: -90,
          position: 'start',
          yAdjust: 0,
          xAdjust: 12,
          color: 'rgba(255, 255, 255, 0.95)',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          borderRadius: 3,
          padding: 4,
          font: { size: 9 },
        },
      };

      if (results && results.phases && index > 0) {
        const previousPhaseNumber = shotData.phaseTransitions[index - 1].phaseNumber;
        const endedPhase = results.phases.find(
          phase => String(phase.number) === String(previousPhaseNumber),
        );

        if (endedPhase && endedPhase.exit && endedPhase.exit.reason) {
          phaseAnnotations[`phase_exit_${index}`] = {
            type: 'line',
            scaleID: 'x',
            value: timeInSeconds,
            borderColor: 'transparent',
            borderWidth: 0,
            label: {
              display: visibility.stops,
              content: endedPhase.exit.reason.toUpperCase(),
              rotation: -90,
              position: 'start',
              yAdjust: 0,
              xAdjust: -12,
              color: 'rgba(255, 255, 255, 0.95)',
              backgroundColor: colors.stopLabel,
              borderRadius: 3,
              padding: 4,
              font: { size: 8, weight: 'bold' },
            },
          };
        }
      }
    });

    if (results && results.phases && results.phases.length > 0 && maxTime > 0) {
      const lastPhase = results.phases[results.phases.length - 1];
      if (lastPhase.exit && lastPhase.exit.reason) {
        let finalStopTime = maxTime;
        const isFinalWeightStop =
          lastPhase.exit.type === 'weight' || lastPhase.exit.type === 'volumetric';
        if (isFinalWeightStop) {
          const lastNonExtendedSample = samples.findLast(
            sample => !sample.systemInfo?.extendedRecording,
          );
          if (lastNonExtendedSample) {
            finalStopTime = (lastNonExtendedSample.t || 0) / 1000;
          }
        }

        phaseAnnotations.shot_end = {
          type: 'line',
          scaleID: 'x',
          value: finalStopTime,
          borderColor: colors.phaseLine,
          borderWidth: 1,
          label: {
            display: visibility.stops,
            content:
              lastPhase.exit.type === 'weight' || lastPhase.exit.type === 'volumetric'
                ? 'WEIGHT STOP TRIGGERED'
                : lastPhase.exit.reason.toUpperCase(),
            rotation: -90,
            position: 'start',
            yAdjust: 0,
            xAdjust: -12,
            color: 'rgba(255, 255, 255, 0.95)',
            backgroundColor: colors.stopLabel,
            borderRadius: 3,
            padding: 4,
            font: { size: 8, weight: 'bold' },
          },
        };
      }
    }
  }

  if (results && maxTime > 0) {
    phaseAnnotations.brew_mode = {
      type: 'line',
      scaleID: 'x',
      value: maxTime,
      borderColor: 'transparent',
      borderWidth: 0,
      label: {
        display: true,
        content: brewModeMeta.label,
        rotation: -90,
        position: 'start',
        yAdjust: 0,
        xAdjust: 1,
        color: brewModeMeta.textColor,
        backgroundColor: brewModeMeta.backgroundColor,
        borderColor: brewModeMeta.borderColor,
        borderWidth: 1,
        borderRadius: 3,
        padding: 4,
        font: { size: 9, weight: 'bold' },
      },
    };
  }

  return phaseAnnotations;
}

function buildTempPhaseAnnotations(phaseAnnotations) {
  // The temperature chart mirrors only the timing separators. Labels stay on the
  // main chart to avoid duplicated annotation text in the stacked layout.
  return Object.entries(phaseAnnotations).reduce((acc, [key, annotation]) => {
    const isPhaseSeparator =
      key === 'shot_start' || key === 'shot_end' || key.startsWith('phase_line_');
    if (!isPhaseSeparator) return acc;

    acc[key] = {
      ...annotation,
      label: { display: false },
    };
    return acc;
  }, {});
}

function createHoverWaterValueGetter({
  phaseHoverRanges,
  sampleTimesSec,
  cumulativeWaterTotalBySample,
}) {
  return xValue => {
    if (!Number.isFinite(xValue) || sampleTimesSec.length === 0) {
      return { totalWaterMl: null, phaseWaterMl: null };
    }

    const sampleIndex = findLastSampleIndexAtOrBeforeX(sampleTimesSec, xValue);
    const totalWaterMl = sampleIndex >= 0 ? (cumulativeWaterTotalBySample[sampleIndex] ?? 0) : 0;

    let activePhase = null;
    for (let i = phaseHoverRanges.length - 1; i >= 0; i--) {
      const phaseRange = phaseHoverRanges[i];
      if (xValue >= phaseRange.startAbs && xValue <= phaseRange.endAbs) {
        activePhase = phaseRange;
        break;
      }
    }

    return {
      totalWaterMl,
      phaseWaterMl: activePhase
        ? Math.max(0, totalWaterMl - (activePhase.startCumWater ?? 0))
        : null,
    };
  };
}

function buildWaterTooltipSeries(
  sampleTimesSec,
  cumulativeWaterTotalBySample,
  getHoverWaterValuesAtX,
) {
  return {
    // These hidden overlay datasets exist only so Chart.js can expose water values
    // through the shared tooltip pipeline without drawing extra visible series.
    waterTooltipPhaseSeries: sampleTimesSec.map(x => {
      const { phaseWaterMl } = getHoverWaterValuesAtX(x);
      return { x, y: Number.isFinite(phaseWaterMl) ? phaseWaterMl : 0 };
    }),
    waterTooltipTotalSeries: sampleTimesSec.map((x, index) => ({
      x,
      y: Number.isFinite(cumulativeWaterTotalBySample[index])
        ? cumulativeWaterTotalBySample[index]
        : 0,
    })),
  };
}

export function buildShotChartModel({ shotData, results, visibility, colors, brewModeMeta }) {
  const samples = Array.isArray(shotData?.samples) ? shotData.samples : [];
  const { maxTime, shotStartSec, sampleTimesSec, cumulativeWaterTotalBySample } =
    buildSampleTimeline(samples);
  const phaseHoverRanges = buildPhaseHoverRanges(
    results,
    shotStartSec,
    sampleTimesSec,
    cumulativeWaterTotalBySample,
  );
  const series = buildSeries(samples);
  const { hasWeight, mainAxisMax, weightAxisMax, tempAxisMin, tempAxisMax } =
    buildAxisRanges(series);
  const phaseAnnotations = buildPhaseAnnotations({
    shotData,
    results,
    samples,
    maxTime,
    colors,
    visibility,
    brewModeMeta,
  });
  const tempPhaseAnnotations = buildTempPhaseAnnotations(phaseAnnotations);
  const getHoverWaterValuesAtX = createHoverWaterValueGetter({
    phaseHoverRanges,
    sampleTimesSec,
    cumulativeWaterTotalBySample,
  });
  const { waterTooltipPhaseSeries, waterTooltipTotalSeries } = buildWaterTooltipSeries(
    sampleTimesSec,
    cumulativeWaterTotalBySample,
    getHoverWaterValuesAtX,
  );

  // Return one normalized model so chart config, replay preparation, hover, and
  // export logic all operate on the same already-parsed representation.
  return {
    maxTime,
    shotStartSec,
    sampleTimesSec,
    series,
    hasWeight,
    mainAxisMax,
    weightAxisMax,
    tempAxisMin,
    tempAxisMax,
    phaseAnnotations,
    tempPhaseAnnotations,
    getHoverWaterValuesAtX,
    waterTooltipPhaseSeries,
    waterTooltipTotalSeries,
  };
}
