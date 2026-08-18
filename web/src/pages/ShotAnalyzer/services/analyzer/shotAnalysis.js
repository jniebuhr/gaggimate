/** Orchestrates full-shot aggregation while delegating phase-level decisions. */

import {
  analyzerDebug,
  createDelayTotals,
  getDelayReviewMessage,
  isAnalyzerDebugEnabled,
} from './delayTracking';
import { getMetricStats } from './metricStats';
import { analyzeExecutedPhase } from './phaseAnalysis';
import { mergeSkippedProfilePhases } from './skippedPhases';
import {
  buildRecordedExitReasonByPhase,
  getBrewCompletionLabel,
  getBrewModeLabel,
  getPhaseExitReasonMeta,
  isSafetyExitReason,
  normalizePhaseExitReasonCode,
} from './exitReasons.js';

const CONFIGURED_SCALE_DELAY_WARNING_THRESHOLD_MS = 1200;

function buildPhaseNameMap(phaseTransitions = []) {
  const transitions = Array.isArray(phaseTransitions) ? phaseTransitions : [];
  return transitions.reduce((map, pt) => {
    map[pt.phaseNumber] = pt.phaseName;
    return map;
  }, {});
}

function groupSamplesByPhase(samples) {
  return samples.reduce((groups, sample) => {
    const pNum = sample.phaseNumber;
    if (!groups[pNum]) groups[pNum] = [];
    groups[pNum].push(sample);
    return groups;
  }, {});
}

function calculateWaterVolume(samples) {
  let water = 0;
  for (let i = 1; i < samples.length; i++) {
    const dt = (samples[i].t - samples[i - 1].t) / 1000;
    water += samples[i].fl * dt;
  }
  return water;
}

function applyConfiguredScaleDelayWarning(analyzedPhases, configuredScaleDelayMs) {
  const configuredHighScaleDelay =
    configuredScaleDelayMs > CONFIGURED_SCALE_DELAY_WARNING_THRESHOLD_MS;
  const lastExecutedPhase = analyzedPhases.at(-1);

  if (configuredHighScaleDelay && lastExecutedPhase) {
    lastExecutedPhase.highScaleDelay = true;
    lastExecutedPhase.estimatedScaleDelayMs = Math.max(
      lastExecutedPhase.estimatedScaleDelayMs || 0,
      configuredScaleDelayMs,
    );
  }

  return configuredHighScaleDelay;
}

function applySkippedPhaseSystemStats(analyzedPhases, brewModeLabel, configuredScaleDelayMs) {
  analyzedPhases.forEach(phase => {
    if (!phase.skipped) return;
    phase.stats.sys_brew_mode = brewModeLabel;
    phase.stats.sys_recorded_stop_reason = 'Not recorded';
    phase.stats.sys_scale_delay = configuredScaleDelayMs;
  });
}

function getAverageDelaySettings({ delayTotals, isAutoAdjusted, scaleDelayMs, sensorDelayMs }) {
  if (!isAutoAdjusted) {
    return { avgScaleDelay: scaleDelayMs, avgSensorDelay: sensorDelayMs };
  }

  const avgScaleDelay =
    delayTotals.countScaleHits > 0
      ? Math.round(delayTotals.sumScaleDelay / delayTotals.countScaleHits / 50) * 50
      : scaleDelayMs;
  const avgSensorDelay =
    delayTotals.countSensorHits > 0
      ? Math.round(delayTotals.sumSensorDelay / delayTotals.countSensorHits / 50) * 50
      : sensorDelayMs;

  return { avgScaleDelay, avgSensorDelay };
}

function getDelayReviewSummary(analyzedPhases) {
  const delayReviewPhases = analyzedPhases
    .map((phase, idx) => ({ ...phase, tablePhaseNumber: idx + 1 }))
    .filter(phase => phase.delayReviewHint);
  const primaryDelayReview =
    delayReviewPhases.length > 0
      ? [...delayReviewPhases].sort((a, b) => (b.delayReviewMs || 0) - (a.delayReviewMs || 0))[0]
      : null;
  const hideLastPhaseDelayReview = primaryDelayReview?.tablePhaseNumber === analyzedPhases.length;
  const shouldExposeDelayReview = Boolean(primaryDelayReview) && !hideLastPhaseDelayReview;
  const delayReviewPhaseNumber = shouldExposeDelayReview
    ? primaryDelayReview.tablePhaseNumber
    : null;
  const delayReviewMs = shouldExposeDelayReview ? primaryDelayReview.delayReviewMs : null;

  return {
    delayReviewHint: shouldExposeDelayReview,
    delayReviewPhaseNumber,
    delayReviewMs,
    delayReviewMessage: getDelayReviewMessage(delayReviewPhaseNumber, delayReviewMs),
  };
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
  const phaseNameMap = buildPhaseNameMap(shotData.phaseTransitions);
  const phases = groupSamplesByPhase(gSamples);

  const sortedPhaseKeys = Object.keys(phases).sort((a, b) => a - b);
  const lastPhaseKey = sortedPhaseKeys.at(-1);
  const recordedExitReasonByPhase = buildRecordedExitReasonByPhase(shotData);

  // --- 2. BREW MODE DETECTION ---
  const startSysInfo = gSamples[0].systemInfo || {};
  const isBrewByWeight = startSysInfo.shotStartedVolumetric === true;
  const brewModeLabel = getBrewModeLabel(isBrewByWeight);
  const configuredScaleDelayMs = Math.max(0, Number(shotData.brewDelay) || 0);
  const finalExitReasonCode = normalizePhaseExitReasonCode(shotData.finalExitReason);
  const finalExitReasonLabel = getPhaseExitReasonMeta(finalExitReasonCode).label;

  let globalScaleLost = false;
  if (isBrewByWeight) {
    globalScaleLost = gSamples.some(s => s.systemInfo?.activeScaleConnected === false);
  }

  // --- 3. GLOBAL TOTALS ---
  const gDuration = (gSamples.at(-1).t - gSamples[0].t) / 1000;
  const gWater = calculateWaterVolume(gSamples);
  const gWeight = gSamples.at(-1).v;

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
      recordedExitReasonCode: recordedExitReasonByPhase.get(String(phaseNum)) || 0,
      scaleConnectionBrokenPermanently,
      settings,
      shotData,
      sortedPhaseKeys,
    });
    analyzedPhases.push(result.phase);
    scaleConnectionBrokenPermanently = result.scaleConnectionBrokenPermanently;
  }

  const configuredHighScaleDelay = applyConfiguredScaleDelayWarning(
    analyzedPhases,
    configuredScaleDelayMs,
  );

  // --- 4b. DETECT SKIPPED PHASES (phases defined in profile but absent from shot) ---
  mergeSkippedProfilePhases({ analyzedPhases, phases, profileData });
  applySkippedPhaseSystemStats(analyzedPhases, brewModeLabel, configuredScaleDelayMs);

  // Calculate distinct Average Delays
  const { avgScaleDelay, avgSensorDelay } = getAverageDelaySettings({
    delayTotals,
    isAutoAdjusted,
    scaleDelayMs,
    sensorDelayMs,
  });

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
    sys_scale: finalSysInfo.activeScaleConnected,
    sys_vol_avail: finalSysInfo.volumetricAvailable,
    sys_ext: finalSysInfo.extendedRecording,
    sys_brew_mode: brewModeLabel,
    sys_recorded_stop_reason: finalExitReasonLabel,
    sys_scale_delay: configuredScaleDelayMs,
  };

  const highScaleDelayPhases = analyzedPhases.filter(p => p.highScaleDelay);
  const hasHighScaleDelay = highScaleDelayPhases.length > 0;
  const highScaleDelayMs = hasHighScaleDelay
    ? Math.max(...highScaleDelayPhases.map(p => p.estimatedScaleDelayMs || 0))
    : null;
  const delayReviewSummary = getDelayReviewSummary(analyzedPhases);

  return {
    isBrewByWeight,
    globalScaleLost,
    highScaleDelay: hasHighScaleDelay,
    highScaleDelayMs,
    delayReviewHint: delayReviewSummary.delayReviewHint,
    delayReviewPhaseNumber: delayReviewSummary.delayReviewPhaseNumber,
    delayReviewMs: delayReviewSummary.delayReviewMs,
    delayReviewMessage: delayReviewSummary.delayReviewMessage,
    isAutoAdjusted,
    brewModeLabel,
    completionLabel: getBrewCompletionLabel(isBrewByWeight, finalExitReasonCode),
    completionTone: isSafetyExitReason(finalExitReasonCode) ? 'warning' : 'default',
    configuredHighScaleDelay,
    configuredScaleDelayMs,
    finalExitReasonCode,
    finalExitReasonLabel,
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
