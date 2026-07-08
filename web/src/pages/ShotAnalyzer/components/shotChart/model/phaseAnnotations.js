/** Builds phase, stop, and overview metadata shared by chart rendering and tooltips. */

import { faClock } from '@fortawesome/free-solid-svg-icons/faClock';
import { faDroplet } from '@fortawesome/free-solid-svg-icons/faDroplet';
import { faFaucet } from '@fortawesome/free-solid-svg-icons/faFaucet';
import { faGauge } from '@fortawesome/free-solid-svg-icons/faGauge';
import { faScaleBalanced } from '@fortawesome/free-solid-svg-icons/faScaleBalanced';
import { getPhaseName } from '../helpers';
import { getDisplayStopReasonParts } from '../../../utils/analyzerUtils';

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

export function getExtendedRecordingStartX(samples, maxTime) {
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

export function buildPhaseOverviewRows({ shotData, results }) {
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

export function buildPhaseAnnotations({
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

export function buildTempPhaseAnnotations(phaseAnnotations) {
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
