/**
 * buildShotChartModel.js
 *
 * Translates raw shot samples + analyzer results into the normalized model used
 * by Chart.js config builders, hover helpers, and replay preparation.
 */

import { TARGET_FLOW_MAX, TARGET_PRESSURE_MAX } from './constants';
import {
  findLastSampleIndexAtOrBeforeX,
  getSpikeResistantSeriesMax,
  getPhaseName,
  safeMax,
  safeMin,
  toNumberOrNull,
} from './helpers';
import { faClock } from '@fortawesome/free-solid-svg-icons/faClock';
import { faDroplet } from '@fortawesome/free-solid-svg-icons/faDroplet';
import { faFaucet } from '@fortawesome/free-solid-svg-icons/faFaucet';
import { faGauge } from '@fortawesome/free-solid-svg-icons/faGauge';
import { faScaleBalanced } from '@fortawesome/free-solid-svg-icons/faScaleBalanced';
import { getDisplayStopReasonParts } from '../../utils/analyzerUtils';

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

function isWeightStopType(type) {
  return type === 'weight' || type === 'volumetric';
}

function getStopActualValue(phase, exitType) {
  if (!phase || !exitType) return null;

  let calcValue = phase.targetCalcValues?.[exitType]?.value;
  if (!Number.isFinite(Number(calcValue)) && isWeightStopType(exitType)) {
    const altType = exitType === 'weight' ? 'volumetric' : 'weight';
    calcValue = phase.targetCalcValues?.[altType]?.value;
  }
  if (Number.isFinite(Number(calcValue))) return Number(calcValue);

  // For skipped phases, only use calc values — raw values are meaningless.
  if (phase.skipped) return null;

  if (exitType === 'duration') return Number(phase.duration);
  if (isWeightStopType(exitType)) {
    const predictedWeight = Number(phase.prediction?.finalWeight);
    if (Number.isFinite(predictedWeight)) return predictedWeight;
    return Number(phase.weight);
  }
  if (exitType === 'pumped') return Number(phase.water);
  if (exitType === 'pressure') return Number(phase.stats?.p?.end);
  if (exitType === 'flow') return Number(phase.stats?.f?.end);

  return null;
}

function getStopTargetValue(phase, exitType) {
  if (!phase?.profilePhase || !exitType) return null;
  if (exitType === 'duration') return phase.profilePhase.duration;

  const targets = Array.isArray(phase.profilePhase.targets) ? phase.profilePhase.targets : [];
  const target = targets.find(candidate => {
    if (isWeightStopType(exitType)) return isWeightStopType(candidate?.type);
    return candidate?.type === exitType;
  });
  return target?.value ?? null;
}

function getStopUnit(exitType) {
  if (exitType === 'duration') return 's';
  if (isWeightStopType(exitType)) return 'g';
  if (exitType === 'pumped') return 'ml';
  if (exitType === 'pressure') return 'bar';
  if (exitType === 'flow') return 'ml/s';
  return '';
}

function formatStopValue(value, unit) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';
  const formattedValue = numeric.toFixed(1);
  return unit ? `${formattedValue} ${unit}` : formattedValue;
}

function getPhaseStopValue(phase) {
  const exitType = phase?.exit?.type;
  if (!exitType) return '-';
  return formatStopValue(getStopActualValue(phase, exitType), getStopUnit(exitType));
}

function getPhaseStopTargetValue(phase) {
  const exitType = phase?.exit?.type;
  if (!exitType) return null;

  const targetValue = getStopTargetValue(phase, exitType);
  if (!Number.isFinite(Number(targetValue))) return null;
  return formatStopValue(targetValue, getStopUnit(exitType));
}

function getZeroBasedPhaseNumber(rawPhaseNumber, fallbackIndex = 0) {
  const numericPhaseNumber = Number(rawPhaseNumber);
  return Number.isFinite(numericPhaseNumber) ? numericPhaseNumber : fallbackIndex;
}

function normalizePhaseNameKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function buildPhaseNumberResolver(results) {
  const resultPhases = Array.isArray(results?.phases) ? results.phases : [];
  const isProfileOrdered = resultPhases.some(phase => phase?.profilePhase || phase?.skipped);

  if (!isProfileOrdered) {
    return (rawPhaseNumber, fallbackIndex = 0) =>
      getZeroBasedPhaseNumber(rawPhaseNumber, fallbackIndex);
  }

  const byName = new Map();
  const rawCounts = new Map();
  const rawToProfileIndex = new Map();

  resultPhases.forEach((phase, profileIndex) => {
    [phase?.profilePhase?.name, phase?.displayName, phase?.name].forEach(name => {
      const key = normalizePhaseNameKey(name);
      if (key && !byName.has(key)) byName.set(key, profileIndex);
    });

    const rawNumber = Number(phase?.number);
    if (Number.isFinite(rawNumber)) {
      rawCounts.set(rawNumber, (rawCounts.get(rawNumber) || 0) + 1);
      rawToProfileIndex.set(rawNumber, profileIndex);
    }
  });

  rawCounts.forEach((count, rawNumber) => {
    if (count > 1) rawToProfileIndex.delete(rawNumber);
  });

  return (rawPhaseNumber, fallbackIndex = 0, phaseName = null) => {
    const nameKey = normalizePhaseNameKey(phaseName);
    if (nameKey && byName.has(nameKey)) return byName.get(nameKey);

    const numericPhaseNumber = Number(rawPhaseNumber);
    if (Number.isFinite(numericPhaseNumber) && rawToProfileIndex.has(numericPhaseNumber)) {
      return rawToProfileIndex.get(numericPhaseNumber);
    }

    return getZeroBasedPhaseNumber(rawPhaseNumber, fallbackIndex);
  };
}

function findLastWeightSample(samples) {
  for (let i = samples.length - 1; i >= 0; i -= 1) {
    const sample = samples[i];
    const weightValue = Number(sample?.v);
    if (!sample?.systemInfo?.extendedRecording && Number.isFinite(weightValue) && weightValue > 0) {
      return sample;
    }
  }
  return null;
}

function getStopBadgePadding(phaseNumber) {
  const digitCount = String(Math.max(0, Number(phaseNumber) || 0)).length;
  return {
    x: digitCount <= 1 ? 7 : 3,
    y: 4,
  };
}

const STOP_BADGE_X_ADJUST = 18;
const STOP_BADGE_Y_ADJUST = -30;

const STOP_ICON_BY_TYPE = {
  pressure: faGauge,
  flow: faFaucet,
  weight: faScaleBalanced,
  volumetric: faScaleBalanced,
  duration: faClock,
  pumped: faDroplet,
};
const WEIGHT_STOP_LEFT_X_ADJUST = -STOP_BADGE_X_ADJUST;
const WEIGHT_STOP_LEFT_Y_ADJUST = STOP_BADGE_Y_ADJUST;

function getShiftedScaleValue(context, scaleId, value, pixelOffset) {
  const scale = context?.chart?.scales?.[scaleId];
  if (!scale || !Number.isFinite(Number(value))) return value;

  const pixel = scale.getPixelForValue(Number(value));
  if (!Number.isFinite(pixel)) return value;

  return scale.getValueForPixel(pixel + pixelOffset);
}

function buildPhaseNameCache(shotData) {
  const phaseNameCache = new Map();
  if (!Array.isArray(shotData?.phaseTransitions)) return phaseNameCache;

  shotData.phaseTransitions.forEach(transition => {
    const zeroBased = getZeroBasedPhaseNumber(transition.phaseNumber, 0);
    if (!phaseNameCache.has(zeroBased) && transition.phaseName) {
      phaseNameCache.set(zeroBased, transition.phaseName);
    }
  });

  return phaseNameCache;
}

function getTransitionTimeInSeconds({ transition, samples, sampleInterval }) {
  if (transition?.sampleIndex === undefined) return 0;
  const sample = samples[transition.sampleIndex];
  if (sample) return (sample.t || 0) / 1000;
  return (transition.sampleIndex * (sampleInterval || 250)) / 1000;
}

function createPhaseSeparatorAnnotation({ value }) {
  return {
    type: 'line',
    scaleID: 'x',
    value,
    borderColor: 'transparent',
    borderWidth: 0,
    display: false,
    label: {
      display: false,
    },
  };
}

function getResultPhaseNameKeys(phase) {
  return [phase?.profilePhase?.name, phase?.displayName, phase?.name].map(normalizePhaseNameKey);
}

function findResultPhaseForTransition(results, transition) {
  const transitionNameKey = normalizePhaseNameKey(transition?.phaseName);
  const resultPhases = Array.isArray(results?.phases) ? results.phases : [];

  if (transitionNameKey) {
    const phaseByName = resultPhases.find(phase =>
      getResultPhaseNameKeys(phase).includes(transitionNameKey),
    );
    if (phaseByName) return phaseByName;
  }

  return resultPhases.find(phase => String(phase.number) === String(transition?.phaseNumber));
}

function getMaxPressure(samples) {
  let maxCp = 0;
  for (const sample of samples) {
    const cp = sample.cp ?? 0;
    if (cp > maxCp) maxCp = cp;
  }
  return maxCp;
}

const MAIN_STOP_SAMPLE_KEY_BY_EXIT_TYPE = {
  flow: 'fl',
  pressure: 'cp',
  pumped: 'fl',
};

function getStopReferenceSample({
  finalWeightSample,
  isWeightStop,
  samples,
  stopSample,
  useFinalSample,
}) {
  if (!useFinalSample || !isWeightStop) return stopSample;
  return finalWeightSample || samples.at(-1) || null;
}

function getMainStopYValue(exitType, refSample, samples) {
  const sampleKey = MAIN_STOP_SAMPLE_KEY_BY_EXIT_TYPE[exitType];
  if (sampleKey) return refSample?.[sampleKey] ?? 0;
  if (exitType === 'duration' && samples.length > 0) {
    return refSample?.cp ?? getMaxPressure(samples) / 2;
  }
  return 0;
}

function getStopPosition({
  exitType,
  stopSample,
  samples,
  finalWeightSample = null,
  useFinalSample = false,
}) {
  const isWeightStop = isWeightStopType(exitType);
  const refSample = getStopReferenceSample({
    finalWeightSample,
    isWeightStop,
    samples,
    stopSample,
    useFinalSample,
  });

  if (isWeightStop) {
    return {
      yValue: refSample?.v ?? 0,
      yScaleID: 'yWeight',
    };
  }

  return {
    yValue: getMainStopYValue(exitType, refSample, samples),
    yScaleID: 'yMain',
  };
}

function createStopLabelAnnotation({
  xValue,
  yValue,
  yScaleID,
  displayNumber,
  calloutDisplay,
  calloutSide,
  xAdjust,
  yAdjust,
  fontSize,
  calloutBorderWidth,
}) {
  return {
    type: 'label',
    xScaleID: 'x',
    yScaleID,
    xValue,
    yValue,
    display: false,
    content: [String(displayNumber)],
    backgroundColor: '#dc2626',
    borderRadius: 999,
    borderWidth: 0,
    color: '#dc2626',
    font: { size: fontSize, weight: 'bold' },
    padding: getStopBadgePadding(displayNumber),
    callout: {
      display: calloutDisplay,
      position: 'bottom',
      side: calloutSide,
      start: '50%',
      margin: 6,
      borderColor: '#dc2626',
      borderWidth: calloutBorderWidth,
    },
    xAdjust,
    yAdjust,
  };
}

function addStopIconOverlay({
  stopIconOverlays,
  exitType,
  visible,
  xValue,
  yValue,
  yScaleID,
  xOffset,
  yOffset,
}) {
  const stopIcon = STOP_ICON_BY_TYPE[exitType];
  if (!stopIcon) return;

  stopIconOverlays.push({
    visible,
    iconDef: stopIcon,
    xValue,
    yValue,
    xScaleID: 'x',
    yScaleID,
    xOffset,
    yOffset,
    color: '#ffffff',
  });
}

function addTransitionStopAnnotation({
  phaseAnnotations,
  stopIconOverlays,
  transition,
  previousTransition,
  index,
  samples,
  results,
  visibility,
  resolvePhaseNumber,
  timeInSeconds,
}) {
  const endedPhase = findResultPhaseForTransition(results, previousTransition);
  if (!endedPhase?.exit?.reason) return;

  const stopSample = transition.sampleIndex === undefined ? null : samples[transition.sampleIndex];
  const exitType = endedPhase.exit.type || '';
  const { yValue, yScaleID } = getStopPosition({ exitType, stopSample, samples });
  const stopPhaseNum = resolvePhaseNumber(
    previousTransition.phaseNumber,
    index - 1,
    previousTransition.phaseName,
  );
  const stopPhaseDisplayNum = stopPhaseNum + 1;

  phaseAnnotations[`phase_stop_${index}`] = createStopLabelAnnotation({
    xValue: timeInSeconds,
    yValue,
    yScaleID,
    displayNumber: stopPhaseDisplayNum,
    calloutDisplay: visibility.stops,
    calloutSide: -11,
    xAdjust: STOP_BADGE_X_ADJUST,
    yAdjust: STOP_BADGE_Y_ADJUST,
    fontSize: 12,
    calloutBorderWidth: 2.5,
  });

  addStopIconOverlay({
    stopIconOverlays,
    exitType,
    visible: visibility.stops,
    xValue: timeInSeconds,
    yValue,
    yScaleID,
    xOffset: STOP_BADGE_X_ADJUST,
    yOffset: STOP_BADGE_Y_ADJUST,
  });
}

function addPhaseSeparatorAndStops({
  phaseAnnotations,
  stopIconOverlays,
  shotData,
  results,
  samples,
  colors,
  visibility,
  resolvePhaseNumber,
}) {
  const transitions = Array.isArray(shotData?.phaseTransitions) ? shotData.phaseTransitions : [];
  if (transitions.length === 0) return;

  if (samples.length > 0) {
    const shotStartTime = (samples[0].t || 0) / 1000;
    phaseAnnotations.shot_start = createPhaseSeparatorAnnotation({
      value: shotStartTime,
      colors,
      visibility,
    });
  }

  for (const [index, transition] of transitions.entries()) {
    const timeInSeconds = getTransitionTimeInSeconds({
      transition,
      samples,
      sampleInterval: shotData.sampleInterval,
    });
    if (timeInSeconds <= 0.1 && index === 0) continue;

    phaseAnnotations[`phase_line_${index}`] = createPhaseSeparatorAnnotation({
      value: timeInSeconds,
      colors,
      visibility,
    });

    const previousTransition = transitions[index - 1];
    if (previousTransition && Array.isArray(results?.phases)) {
      addTransitionStopAnnotation({
        phaseAnnotations,
        stopIconOverlays,
        transition,
        previousTransition,
        index,
        samples,
        results,
        visibility,
        resolvePhaseNumber,
        timeInSeconds,
      });
    }
  }
}

function buildPhaseStarts({ shotData, samples, maxTime, resolvePhaseNumber }) {
  const transitions = Array.isArray(shotData?.phaseTransitions) ? shotData.phaseTransitions : [];
  if (transitions.length === 0) return [];

  const firstSample = samples[0] || {};
  const firstTransition =
    transitions.find(transition => {
      const sampleIndex = Number(transition?.sampleIndex);
      return Number.isFinite(sampleIndex) && sampleIndex <= 0;
    }) ||
    transitions[0] ||
    {};
  const shotStartTime = samples.length > 0 ? (firstSample.t || 0) / 1000 : 0;
  const phaseStarts = [
    {
      time: shotStartTime,
      zeroBased: resolvePhaseNumber(
        firstSample.phaseNumber ?? firstTransition.phaseNumber,
        0,
        firstSample.phaseName || firstTransition.phaseName,
      ),
    },
  ];

  for (const [index, transition] of transitions.entries()) {
    const timeInSeconds = getTransitionTimeInSeconds({
      transition,
      samples,
      sampleInterval: shotData.sampleInterval,
    });
    if (timeInSeconds <= 0.1 && index === 0) continue;

    phaseStarts.push({
      time: timeInSeconds,
      zeroBased: resolvePhaseNumber(transition.phaseNumber, index, transition.phaseName),
    });
  }

  return phaseStarts.filter((phaseStart, index, allStarts) => {
    const nextTime = allStarts[index + 1]?.time ?? maxTime;
    return Number.isFinite(phaseStart.time) && nextTime - phaseStart.time > 0.05;
  });
}

function addPhaseLabelOverlays({
  phaseLabelOverlays,
  phaseStarts,
  maxTime,
  getPhaseLabel,
  usePhaseNumbers,
  visibility,
}) {
  phaseStarts.forEach((phaseStart, index, allStarts) => {
    const nextTime = allStarts[index + 1]?.time ?? maxTime;
    phaseLabelOverlays.push({
      key: `phase_label_${index}`,
      label: getPhaseLabel(phaseStart.zeroBased),
      xValue: phaseStart.time + (nextTime - phaseStart.time) / 2,
      usePhaseNumbers,
      display: visibility.phaseNames,
    });
  });
}

function addPhaseBackgroundRanges({
  phaseBackgroundRanges,
  phaseStarts,
  maxTime,
  visibility,
  extendedStartX = null,
}) {
  let rangeIndex = 0;
  phaseStarts.forEach((phaseStart, index, allStarts) => {
    const nextTime = allStarts[index + 1]?.time ?? maxTime;
    const boundaries = [phaseStart.time];
    if (
      Number.isFinite(extendedStartX) &&
      extendedStartX - phaseStart.time > 0.05 &&
      nextTime - extendedStartX > 0.05
    ) {
      boundaries.push(extendedStartX);
    }
    boundaries.push(nextTime);

    for (let boundaryIndex = 0; boundaryIndex < boundaries.length - 1; boundaryIndex += 1) {
      phaseBackgroundRanges.push({
        startX: boundaries[boundaryIndex],
        endX: boundaries[boundaryIndex + 1],
        visible: visibility.phaseNames,
        shaded: rangeIndex % 2 === 0,
      });
      rangeIndex += 1;
    }
  });
}

function getExtendedRecordingStartX(samples, maxTime) {
  const firstExtendedSample = samples.find(sample => sample?.systemInfo?.extendedRecording);
  const startX = Number(firstExtendedSample?.t) / 1000;
  const endX = Number(maxTime);

  if (!Number.isFinite(startX) || !Number.isFinite(endX) || endX - startX <= 0.05) {
    return null;
  }

  return startX;
}

function addFinalWeightStopLines({ phaseAnnotations, stopTimeSec, yScaleID, yValue }) {
  phaseAnnotations.shot_end = {
    type: 'line',
    scaleID: 'x',
    value: stopTimeSec,
    display: false,
    borderColor: 'transparent',
    borderWidth: 0,
  };

  phaseAnnotations.shot_end_stop_line = {
    type: 'line',
    xScaleID: 'x',
    yScaleID,
    xMin: stopTimeSec,
    xMax: context => getShiftedScaleValue(context, 'x', stopTimeSec, WEIGHT_STOP_LEFT_X_ADJUST),
    yMin: yValue,
    yMax: context => getShiftedScaleValue(context, yScaleID, yValue, WEIGHT_STOP_LEFT_Y_ADJUST),
    display: false,
    borderColor: '#dc2626',
    borderWidth: 2.5,
  };
}

function resolveFinalStopAnnotationContext({
  finalWeightSample,
  maxTime,
  resolvePhaseNumber,
  results,
  samples,
}) {
  const resultPhases = Array.isArray(results?.phases) ? results.phases : [];
  if (resultPhases.length === 0) return null;

  const lastPhase = resultPhases.at(-1);
  if (!lastPhase?.exit?.reason) return null;

  const exitType = lastPhase.exit.type || '';
  const isWeightStop = isWeightStopType(exitType);
  const stopTimeSec =
    isWeightStop && finalWeightSample ? (finalWeightSample.t ?? 0) / 1000 : maxTime;
  const refSample = samples.at(-1) || null;
  const position = getStopPosition({
    exitType,
    stopSample: refSample,
    samples,
    finalWeightSample,
    useFinalSample: true,
  });
  const lastPhaseNum = resolvePhaseNumber(
    lastPhase.number,
    resultPhases.length - 1,
    lastPhase.profilePhase?.name || lastPhase.displayName || lastPhase.name,
  );

  return {
    exitType,
    isWeightStop,
    lastPhaseDisplayNum: lastPhaseNum + 1,
    stopTimeSec,
    ...position,
  };
}

function addFinalStopAnnotations({
  phaseAnnotations,
  stopIconOverlays,
  results,
  samples,
  maxTime,
  visibility,
  finalWeightSample,
  resolvePhaseNumber,
}) {
  const context = resolveFinalStopAnnotationContext({
    finalWeightSample,
    maxTime,
    resolvePhaseNumber,
    results,
    samples,
  });
  if (!context) return;

  const { exitType, isWeightStop, lastPhaseDisplayNum, stopTimeSec, yScaleID, yValue } = context;
  const xAdjust = isWeightStop ? WEIGHT_STOP_LEFT_X_ADJUST : -STOP_BADGE_X_ADJUST;
  const yAdjust = isWeightStop ? WEIGHT_STOP_LEFT_Y_ADJUST : STOP_BADGE_Y_ADJUST;

  if (isWeightStop) {
    addFinalWeightStopLines({ phaseAnnotations, stopTimeSec, yScaleID, yValue });
  }

  phaseAnnotations.shot_end_stop = createStopLabelAnnotation({
    xValue: stopTimeSec,
    yValue,
    yScaleID,
    displayNumber: lastPhaseDisplayNum,
    calloutDisplay: isWeightStop ? false : visibility.stops,
    calloutSide: isWeightStop ? 11 : -11,
    xAdjust,
    yAdjust,
    fontSize: 10,
    calloutBorderWidth: 1.5,
  });

  addStopIconOverlay({
    stopIconOverlays,
    exitType,
    visible: visibility.stops,
    xValue: stopTimeSec,
    yValue,
    yScaleID,
    xOffset: xAdjust,
    yOffset: yAdjust,
  });
}

function buildPhaseOverviewRows({ shotData, results }) {
  const resultPhases = Array.isArray(results?.phases) ? results.phases : [];
  if (resultPhases.length > 0) {
    const resolvePhaseNumber = buildPhaseNumberResolver(results);

    return resultPhases.map((phase, index) => {
      const zeroBasedPhaseNumber = resolvePhaseNumber(
        phase?.number,
        index,
        phase?.profilePhase?.name || phase?.displayName || phase?.name,
      );
      const { skipNotice, stopReason } = getDisplayStopReasonParts(phase?.exit?.reason);

      return {
        phaseNumber: zeroBasedPhaseNumber + 1,
        phaseName:
          phase?.displayName || phase?.name || getPhaseName(shotData, zeroBasedPhaseNumber),
        skipNotice,
        stopReason: stopReason || '-',
        stopValue: getPhaseStopValue(phase),
        stopTargetValue: getPhaseStopTargetValue(phase),
        stopType: phase?.exit?.type || null,
        start: Number(phase?.start),
        end: Number(phase?.end),
        skipped: Boolean(phase?.skipped),
      };
    });
  }

  const transitions = Array.isArray(shotData?.phaseTransitions) ? shotData.phaseTransitions : [];
  if (transitions.length > 0) {
    const phaseNameByNumber = new Map();

    transitions.forEach((transition, index) => {
      const zeroBasedPhaseNumber = getZeroBasedPhaseNumber(transition?.phaseNumber, index);
      if (phaseNameByNumber.has(zeroBasedPhaseNumber)) return;
      phaseNameByNumber.set(
        zeroBasedPhaseNumber,
        transition?.phaseName || getPhaseName(shotData, zeroBasedPhaseNumber),
      );
    });

    return [...phaseNameByNumber.entries()]
      .sort(([a], [b]) => a - b)
      .map(([zeroBasedPhaseNumber, phaseName]) => ({
        phaseNumber: zeroBasedPhaseNumber + 1,
        phaseName,
        stopReason: '-',
        stopValue: '-',
        stopTargetValue: null,
      }));
  }

  const profilePhases = Array.isArray(shotData?.profile?.phases) ? shotData.profile.phases : [];
  return profilePhases.map((phase, index) => ({
    phaseNumber: index + 1,
    phaseName: phase?.displayName || phase?.name || getPhaseName(shotData, index),
    stopReason: '-',
    stopValue: '-',
    stopTargetValue: null,
  }));
}

function buildPhaseAnnotations({
  shotData,
  results,
  samples,
  maxTime,
  colors,
  visibility,
  usePhaseNumbers,
  phaseLabelOverlays = [],
  phaseBackgroundRanges = [],
  extendedStartX = null,
  stopIconOverlays = [],
}) {
  const phaseAnnotations = {};
  const finalWeightSample = findLastWeightSample(samples);
  const resolvePhaseNumber = buildPhaseNumberResolver(results);
  const hasPhaseTransitions =
    Array.isArray(shotData?.phaseTransitions) && shotData.phaseTransitions.length > 0;
  if (!hasPhaseTransitions) return phaseAnnotations;

  const phaseNameCache = buildPhaseNameCache(shotData);
  const getPhaseLabel = zeroBasedNum =>
    usePhaseNumbers
      ? String(zeroBasedNum + 1)
      : phaseNameCache.get(zeroBasedNum) || getPhaseName(shotData, zeroBasedNum);
  const phaseStarts = buildPhaseStarts({ shotData, samples, maxTime, resolvePhaseNumber });

  addPhaseSeparatorAndStops({
    phaseAnnotations,
    stopIconOverlays,
    shotData,
    results,
    samples,
    colors,
    visibility,
    resolvePhaseNumber,
  });
  addPhaseLabelOverlays({
    phaseLabelOverlays,
    phaseStarts,
    maxTime,
    getPhaseLabel,
    usePhaseNumbers,
    visibility,
  });
  addPhaseBackgroundRanges({
    phaseBackgroundRanges,
    phaseStarts,
    maxTime,
    visibility,
    extendedStartX,
  });
  addFinalStopAnnotations({
    phaseAnnotations,
    stopIconOverlays,
    results,
    samples,
    maxTime,
    visibility,
    finalWeightSample,
    resolvePhaseNumber,
  });

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

export function buildShotChartModel({
  shotData,
  results,
  visibility,
  colors,
  brewModeMeta,
  usePhaseNumbers,
}) {
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
  const phaseLabelOverlays = [];
  const phaseBackgroundRanges = [];
  const extendedStartX = getExtendedRecordingStartX(samples, maxTime);
  const stopIconOverlays = [];
  const phaseAnnotations = buildPhaseAnnotations({
    shotData,
    results,
    samples,
    maxTime,
    colors,
    visibility,
    usePhaseNumbers,
    phaseLabelOverlays,
    phaseBackgroundRanges,
    extendedStartX,
    stopIconOverlays,
  });
  const tempPhaseAnnotations = buildTempPhaseAnnotations(phaseAnnotations);
  const phaseOverviewRows = buildPhaseOverviewRows({ shotData, results });
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
    phaseLabelOverlays,
    phaseBackgroundRanges,
    stopIconOverlays,
    phaseOverviewRows,
    getHoverWaterValuesAtX,
    waterTooltipPhaseSeries,
    waterTooltipTotalSeries,
    brewLabel: brewModeMeta?.label || null,
    brewIconDef: brewModeMeta?.iconDef || null,
  };
}
