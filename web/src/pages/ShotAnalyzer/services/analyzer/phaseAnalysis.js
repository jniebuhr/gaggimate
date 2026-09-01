/** Analyzes executed phases, including target exits, delay inference, and final-phase fallbacks. */

import {
  LAST_PHASE_ESTIMATED_DELAY_MAX_MS,
  LAST_PHASE_OVERSHOOT_MAX_G,
  LAST_PHASE_UNDERSHOOT_MAX_G,
  LAST_PHASE_UNDERSHOOT_MIN_G,
  addDelayHit,
  analyzerDebug,
  createPhaseDelayTracker,
} from './delayTracking';
import { getMetricStats } from './metricStats';
import { getBluetoothScaleConnectionState } from './scaleConnection';
import {
  PREDICTION_INTERVAL_MS,
  buildTargetCalcValues,
  findManualTargetMatch,
  findTargetMatch,
  findTargetMatchWithDirection,
  formatStopReason,
  predictTargetValuesAtDelay,
} from './targetMatching';
import {
  getLastNonExtendedIndex,
  getPhaseEndSample,
  getPhaseWeightRate,
  getSampleInstantWeightRate,
  getSamplesThroughLastNonExtended,
  isPositiveFiniteRate,
} from './weightRate';
import { calculatePumpedWater } from './waterIntegration';
import {
  getBrewModeLabel,
  getPhaseExitReasonMeta,
  isKnownPhaseExitReason,
  normalizePhaseExitReasonCode,
} from './exitReasons.js';

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

function getRecordedStopValue(exitType, samples, phaseStartTime, closingSample, pumpedWaterSource) {
  const stopIndex = getLastNonExtendedIndex(samples);
  const stopSample = stopIndex >= 0 ? samples[stopIndex] : getPhaseEndSample(samples);
  if (!stopSample) return null;

  if (exitType === 'weight' || exitType === 'volumetric') return stopSample.v;
  if (exitType === 'pressure') return stopSample.cp;
  if (exitType === 'flow') return stopSample.fl;
  if (exitType === 'pumped') {
    const stopClosingSample = stopIndex === samples.length - 1 ? closingSample : null;
    return calculatePumpedWater(samples, stopIndex, stopClosingSample, pumpedWaterSource);
  }
  if (exitType === 'duration') {
    const stopTime =
      stopIndex === samples.length - 1 && closingSample ? closingSample.t : stopSample.t;
    return (stopTime - phaseStartTime) / 1000;
  }
  return null;
}

function buildPhaseTargetContext({
  isBrewByWeight,
  isLastPhase,
  pumpedWaterSource,
  samples,
  scaleConnectionBrokenPermanently,
}) {
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
    anchorPumped: calculatePumpedWater(samples, anchorIdx, null, pumpedWaterSource),
    flowSlope: anchorDt > 0 ? (anchor.fl - prevAnchor.fl) / anchorDt : 0,
    isBrewByWeight,
    isLastPhase,
    lastNonExtendedSample,
    pressureSlope: anchorDt > 0 ? (anchor.cp - prevAnchor.cp) / anchorDt : 0,
    phaseSamples: samples,
    pumpedWaterSource,
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

  let lastObservedDelayMs = 0;
  for (const nextSample of nextPhaseSamples.slice(0, 2)) {
    const observedDelayMs = Number(nextSample?.t) - Number(anchor.t);
    if (Number.isFinite(observedDelayMs)) {
      lastObservedDelayMs = Math.max(lastObservedDelayMs, observedDelayMs);
    }
    match = findTargetMatchWithDirection(targets, nextSample, targetContext);
    if (match) return match;
  }

  const firstPredictionDelayMs =
    Math.floor(lastObservedDelayMs / PREDICTION_INTERVAL_MS) * PREDICTION_INTERVAL_MS +
    PREDICTION_INTERVAL_MS;
  for (
    let predictionDelayMs = firstPredictionDelayMs;
    predictionDelayMs <= LAST_PHASE_ESTIMATED_DELAY_MAX_MS;
    predictionDelayMs += PREDICTION_INTERVAL_MS
  ) {
    match = findTargetMatch(
      targets,
      predictTargetValuesAtDelay(predictionDelayMs, targetContext),
      predictionDelayMs,
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
    exitCode: 0,
    exitReason: null,
    exitSource: null,
    exitType: null,
    finalPredictedWeight: null,
    targetCalcValues: null,
  };
}

function applyRecordedExitReason(exitState, recordedExitReasonCode) {
  if (!isKnownPhaseExitReason(recordedExitReasonCode)) return false;

  const metadata = getPhaseExitReasonMeta(recordedExitReasonCode);
  exitState.exitCode = normalizePhaseExitReasonCode(recordedExitReasonCode);
  exitState.exitReason = metadata.stopReason;
  exitState.exitSource = 'recorded';
  exitState.exitType = metadata.exitType;
  return true;
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
  phaseNum,
  profilePhase,
  shotData,
  targetContext,
}) {
  exitState.exitReason = formatStopReason(match.target.type);
  exitState.exitType = match.target.type;
  exitState.finalPredictedWeight = match.predictedWeight;
  delayTracker.setEstimatedScaleDelay(match.delayMs);

  if (isAutoAdjusted && match.delayMs >= PREDICTION_INTERVAL_MS * 2) {
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
    exitState.targetCalcValues = buildTargetCalcValues(profilePhase.targets, match, targetContext);
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
  pumpedWaterSource,
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
    pumpedWaterSource,
    samples,
    scaleConnectionBrokenPermanently,
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

function getPhaseStats(samples, weightSamples, sysInfo, sysAnomalies, analyzerSystemInfo) {
  return {
    p: getMetricStats(samples, 'cp'),
    tp: getMetricStats(samples, 'tp'),
    f: getMetricStats(samples, 'fl'),
    pf: getMetricStats(samples, 'pf'),
    tf: getMetricStats(samples, 'tf'),
    t: getMetricStats(samples, 'ct'),
    tt: getMetricStats(samples, 'tt'),
    w: getMetricStats(weightSamples, 'v'),
    wf: getMetricStats(samples, 'vf'),
    sys_raw: sysInfo.raw,
    sys_shot_vol: sysInfo.shotStartedVolumetric,
    sys_curr_vol: sysInfo.currentlyVolumetric,
    sys_scale: sysInfo.bluetoothScaleConnected,
    sys_vol_avail: sysInfo.volumetricAvailable,
    sys_ext: sysInfo.extendedRecording,
    sys_brew_mode: analyzerSystemInfo.brewModeLabel,
    sys_recorded_stop_reason: analyzerSystemInfo.recordedStopReason,
    sys_scale_delay: analyzerSystemInfo.configuredScaleDelayMs,
    sys_anomalies: Object.keys(sysAnomalies).length > 0 ? sysAnomalies : undefined,
  };
}

export function analyzeExecutedPhase({
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
  pumpedWaterSource,
  recordedExitReasonCode,
  bluetoothScaleWasConnected,
  scaleConnectionBrokenPermanently,
  settings,
  shotData,
  sortedPhaseKeys,
}) {
  const samples = phases[phaseNum];
  const pStart = (samples[0].t - globalStartTime) / 1000;
  const isLastPhase = phaseNum === lastPhaseKey;
  const nextPhaseSamples = getNextPhaseSamples({ phaseNum, phases, sortedPhaseKeys });
  const closingSample = isLastPhase ? null : nextPhaseSamples[0] || null;
  // The first sample of the next phase closes this phase, but remains sample 0
  // of the next phase. The exact transition time inside this interval is unknown.
  const phaseEndSample = closingSample || getPhaseEndSample(samples);
  const pEnd = (phaseEndSample.t - globalStartTime) / 1000;
  const duration = pEnd - pStart;
  const phaseWeightRate = getPhaseWeightRate(samples, isLastPhase);
  const weightSamples = getSamplesThroughLastNonExtended(samples);
  const weightEndSample = weightSamples.at(-1) || getPhaseEndSample(samples);
  const rawName = phaseNameMap[phaseNum];
  const displayName = rawName || `Phase ${phaseNum}`;
  const sysInfo = getPhaseEndSample(samples).systemInfo || {};
  const sysAnomalies = getPhaseSysAnomalies(samples, sysInfo);
  const bluetoothScaleConnection = getBluetoothScaleConnectionState(
    samples,
    bluetoothScaleWasConnected,
  );
  const scaleLostInThisPhase = isBrewByWeight && bluetoothScaleConnection.scaleLost;
  const nextScaleConnectionBroken = scaleConnectionBrokenPermanently || scaleLostInThisPhase;
  const delayTracker = createPhaseDelayTracker(isLastPhase);
  const exitState = createExitState();
  const profilePhase = findProfilePhase(profileData, rawName);
  const normalizedRecordedExitReasonCode = normalizePhaseExitReasonCode(recordedExitReasonCode);
  const hasRecordedExitReason = applyRecordedExitReason(
    exitState,
    normalizedRecordedExitReasonCode,
  );
  const recordedStopValue = hasRecordedExitReason
    ? getRecordedStopValue(
        exitState.exitType,
        samples,
        samples[0].t,
        closingSample,
        pumpedWaterSource,
      )
    : null;

  if (profilePhase && !hasRecordedExitReason) {
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
      pumpedWaterSource,
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
      water: calculatePumpedWater(samples, samples.length - 1, closingSample, pumpedWaterSource),
      weight: weightEndSample.v,
      stats: getPhaseStats(samples, weightSamples, sysInfo, sysAnomalies, {
        brewModeLabel: getBrewModeLabel(isBrewByWeight),
        configuredScaleDelayMs: Math.max(0, Number(shotData.brewDelay) || 0),
        recordedStopReason: getPhaseExitReasonMeta(normalizedRecordedExitReasonCode).label,
      }),
      exit: {
        code: exitState.exitCode,
        reason: exitState.exitReason,
        source: exitState.exitSource || (exitState.exitReason ? 'inferred' : null),
        type: exitState.exitType,
        actualValue: recordedStopValue,
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
      isFinalExecuted: isLastPhase,
    },
    bluetoothScaleWasConnected: bluetoothScaleConnection.bluetoothScaleWasConnected,
    scaleConnectionBrokenPermanently: nextScaleConnectionBroken,
  };
}
