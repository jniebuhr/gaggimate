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
import {
  buildTargetCalcValues,
  findManualTargetMatch,
  findTargetMatch,
  findTargetMatchWithDirection,
  formatStopReason,
  predictTargetValuesAtStep,
} from './targetMatching';
import {
  getLastNonExtendedIndex,
  getPhaseEndSample,
  getPhaseWeightRate,
  getSampleInstantWeightRate,
  isPositiveFiniteRate,
} from './weightRate';

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
