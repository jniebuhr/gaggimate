/**
 * AnalyzerService.js
 * * Shot Analysis Engine for GaggiMate
 * Calculates metrics, detects phase transitions, and determines exit reasons
 */

const PREDICTIVE_WINDOW_MS = 4000;
const BOUNDARY_MATCH_TOLERANCE_MS = 800;

/**
 * Helper: Calculate statistics for a metric across samples
 * @param {Array} samples - Shot samples
 * @param {string} key - Metric key (e.g., 'cp', 'fl', 'ct')
 * @returns {Object} { start, end, min, max, avg }
 */
function getMetricStats(samples, key) {
  let min = Infinity;
  let max = -Infinity;
  let weightedSum = 0;
  let totalTime = 0;

  // Start and End values
  let start = samples[0][key];
  let end = samples[samples.length - 1][key];

  // Check for both null and undefined using loose equality or explicit checks
  if (start == null) start = 0;
  if (end == null) end = 0;

  // Min, Max, and Time-Weighted Average
  for (let i = 0; i < samples.length; i++) {
    let val = samples[i][key];

    // Ensure val is a number (handle null/undefined)
    if (val == null) val = 0;

    if (val < min) min = val;
    if (val > max) max = val;

    // Time-weighted average (using time delta between samples)
    if (i > 0) {
      const dt = (samples[i].t - samples[i - 1].t) / 1000; // Convert to seconds
      if (dt > 0) {
        weightedSum += val * dt;
        totalTime += dt;
      }
    }
  }

  // Safety for Infinity (if no valid samples processed)
  if (min === Infinity) min = 0;
  if (max === -Infinity) max = 0;

  // For single-sample phases, totalTime is 0 — use the sample value directly
  const avg = totalTime > 0 ? weightedSum / totalTime : start;

  return { start, end, min, max, avg };
}

/**
 * Pick the sample index used as prediction anchor for the phase.
 * For the last phase, prefer the last non-extended-recording sample
 * to avoid tail-rate artifacts from post-stop drip logging.
 */
function getPhaseAnchorIndexForWeightRate(samples, isLastPhase) {
  if (!Array.isArray(samples) || samples.length === 0) return -1;
  if (!isLastPhase) return samples.length - 1;

  for (let i = samples.length - 1; i >= 0; i--) {
    const sys = samples[i].systemInfo || {};
    if (!sys.extendedRecording) return i;
  }
  return samples.length - 1;
}

/**
 * Backend-like weight-rate estimation:
 * Linear regression slope of volume over time in the last 4s window.
 * Returns g/s
 */
function getRegressionWeightRate(samples, endIndex, windowMs = PREDICTIVE_WINDOW_MS) {
  if (!Array.isArray(samples) || endIndex < 1 || endIndex >= samples.length) return 0;

  const endTime = samples[endIndex].t;
  const cutoff = endTime - windowMs;

  let startIndex = endIndex;
  while (startIndex > 0 && samples[startIndex - 1].t > cutoff) {
    startIndex--;
  }

  const count = endIndex - startIndex + 1;
  if (count < 2) return 0;

  let tMean = 0;
  let vMean = 0;
  for (let i = startIndex; i <= endIndex; i++) {
    tMean += samples[i].t;
    vMean += samples[i].v ?? 0;
  }
  tMean /= count;
  vMean /= count;

  let tdev2 = 0;
  let tdevVdev = 0;
  for (let i = startIndex; i <= endIndex; i++) {
    const tDev = samples[i].t - tMean;
    const vDev = (samples[i].v ?? 0) - vMean;
    tdevVdev += tDev * vDev;
    tdev2 += tDev * tDev;
  }

  if (tdev2 < 1e-10) return 0;

  const volumePerMillisecond = tdevVdev / tdev2;
  if (volumePerMillisecond <= 0) return 0;

  return volumePerMillisecond * 1000; // g/ms -> g/s
}

function getPhaseWeightRate(samples, isLastPhase) {
  const anchorIndex = getPhaseAnchorIndexForWeightRate(samples, isLastPhase);
  if (anchorIndex < 0) return 0;
  return getRegressionWeightRate(samples, anchorIndex, PREDICTIVE_WINDOW_MS);
}

function isDirectionallyValidLookAhead(operator, currentValue, nextValue) {
  if (!isFinite(currentValue) || !isFinite(nextValue)) return false;
  if (operator === 'gte') return nextValue >= currentValue;
  if (operator === 'lte') return nextValue <= currentValue;
  return true;
}

function getHitSourcePriority(source) {
  if (source === 'raw') return 1;
  if (source === 'predicted') return 2;
  if (source === 'tolerance') return 3;
  if (source === 'lookahead') return 4;
  if (source === 'lookahead-fallback') return 5;
  return 6;
}

function shouldAllowPredictedLteForSensorTarget(targetType, measured, targetValue, tolerance = 0) {
  if (targetType !== 'flow' && targetType !== 'pressure') return true;
  if (!isFinite(measured) || !isFinite(targetValue)) return false;
  return measured <= targetValue + tolerance;
}

function getLastNonExtendedIndex(samples) {
  if (!Array.isArray(samples) || samples.length === 0) return -1;
  for (let i = samples.length - 1; i >= 0; i--) {
    if (!samples[i].systemInfo?.extendedRecording) return i;
  }
  return samples.length - 1;
}

function isAnalyzerDebugEnabled() {
  if (typeof window === 'undefined') return false;
  try {
    return window.__SHOT_ANALYZER_DEBUG__ === true || window.localStorage?.getItem('shotAnalyzerDebug') === '1';
  } catch {
    return window.__SHOT_ANALYZER_DEBUG__ === true;
  }
}

function analyzerDebug(enabled, message, payload = null) {
  if (!enabled) return;
  if (payload == null) {
    console.debug(`[ShotAnalyzer] ${message}`);
  } else {
    console.debug(`[ShotAnalyzer] ${message}`, payload);
  }
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
  if (t === 'pumped') return 'Water Drawn Stop';
  if (t === 'volumetric' || t === 'weight') return 'Weight Stop';
  if (t === 'pressure') return 'Pressure Stop';
  if (t === 'flow') return 'Flow Stop';

  // Fallback
  return `${t.charAt(0).toUpperCase() + t.slice(1)} Stop`;
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
  const phases = {};
  const phaseNameMap = {};

  if (shotData.phaseTransitions) {
    shotData.phaseTransitions.forEach(pt => {
      phaseNameMap[pt.phaseNumber] = pt.phaseName;
    });
  }

  gSamples.forEach(sample => {
    const pNum = sample.phaseNumber;
    if (!phases[pNum]) phases[pNum] = [];
    phases[pNum].push(sample);
  });

  const sortedPhaseKeys = Object.keys(phases).sort((a, b) => a - b);
  const lastPhaseKey = sortedPhaseKeys[sortedPhaseKeys.length - 1];

  // --- 2. BREW MODE DETECTION ---
  const startSysInfo = gSamples[0].systemInfo || {};
  const isBrewByWeight = startSysInfo.shotStartedVolumetric === true;

  let globalScaleLost = false;
  if (isBrewByWeight) {
    globalScaleLost = gSamples.some(
      s => s.systemInfo && s.systemInfo.bluetoothScaleConnected === false,
    );
  }

  // --- 3. GLOBAL TOTALS ---
  let gDuration = (gSamples[gSamples.length - 1].t - gSamples[0].t) / 1000;

  let gWater = 0;
  for (let i = 1; i < gSamples.length; i++) {
    const dt = (gSamples[i].t - gSamples[i - 1].t) / 1000;
    gWater += gSamples[i].fl * dt;
  }

  let gWeight = gSamples[gSamples.length - 1].v;

  // --- 4. PHASE-BY-PHASE ANALYSIS ---
  const analyzedPhases = [];

  let sumScaleDelay = 0;
  let countScaleHits = 0;
  let sumSensorDelay = 0;
  let countSensorHits = 0;

  // Tolerances
  const TOL_PRESSURE = 0.15;
  const TOL_FLOW = 0.3;

  let scaleConnectionBrokenPermanently = false;

  sortedPhaseKeys.forEach(phaseNum => {
    const samples = phases[phaseNum];
    const pStart = (samples[0].t - globalStartTime) / 1000;
    const pEnd = (samples[samples.length - 1].t - globalStartTime) / 1000;
    const duration = pEnd - pStart;

    const isLastPhase = phaseNum === lastPhaseKey;
    const phaseWeightRate = getPhaseWeightRate(samples, isLastPhase);

    const rawName = phaseNameMap[phaseNum];
    const displayName = rawName ? rawName : `Phase ${phaseNum}`;

    // System Info
    const lastSampleInPhase = samples[samples.length - 1];
    const sysInfo = lastSampleInPhase.systemInfo || {};

    let scaleLostInThisPhase = false;
    if (isBrewByWeight) {
      scaleLostInThisPhase = samples.some(
        s => s.systemInfo && s.systemInfo.bluetoothScaleConnected === false,
      );
    }
    if (scaleLostInThisPhase) {
      scaleConnectionBrokenPermanently = true;
    }

    // --- EXIT REASON & AUTO-DELAY LOGIC ---
    let exitReason = null;
    let exitType = null;
    let finalPredictedWeight = null;
    let profilePhase = null;
    let phaseHighScaleDelay = false;
    let phaseEstimatedScaleDelayMs = null;
    let phaseDelayReviewHint = false;
    let phaseDelayReviewReason = null;
    let phaseDelayReviewMs = null;
    const setEstimatedScaleDelay = delayMs => {
      if (delayMs == null || !isFinite(delayMs) || delayMs < 0) return;
      const roundedDelay = Math.round(delayMs);
      if (phaseEstimatedScaleDelayMs == null) {
        phaseEstimatedScaleDelayMs = roundedDelay;
      } else if (roundedDelay > phaseEstimatedScaleDelayMs) {
        phaseEstimatedScaleDelayMs = roundedDelay;
      }
      if (isLastPhase && roundedDelay > 2000) {
        phaseHighScaleDelay = true;
      }
    };
    const setPhaseDelayReviewHint = (delayMs, reason) => {
      if (delayMs == null || !isFinite(delayMs) || delayMs < 1000) return;
      const roundedDelay = Math.round(delayMs);
      phaseDelayReviewHint = true;
      phaseDelayReviewReason = reason || 'manual-check';
      if (phaseDelayReviewMs == null || roundedDelay > phaseDelayReviewMs) {
        phaseDelayReviewMs = roundedDelay;
      }
    };

    if (profileData && profileData.phases) {
      const cleanName = rawName ? rawName.trim().toLowerCase() : '';
      profilePhase = profileData.phases.find(p => p.name.trim().toLowerCase() === cleanName);

      if (profilePhase) {
        const profDur = profilePhase.duration;

        // Time Limit Check (Always runs first)
        if (Math.abs(duration - profDur) < 0.5 || duration >= profDur) {
          exitReason = 'Time Limit';
          exitType = 'duration';
        }

        // Check target-based exits
        if (profilePhase.targets && (!exitType || duration < profDur - 0.5)) {
          const steps = isAutoAdjusted ? 31 : 1; // 0..3000 (31 steps) or 1 step
          let foundMatch = false;
          let bestStepMatch = null;

          const nextPNum = parseInt(phaseNum, 10) + 1;
          const nextPhaseFirstSample =
            phases[nextPNum] && phases[nextPNum].length > 0 ? phases[nextPNum][0] : null;
          const phaseBoundaryMs = nextPhaseFirstSample
            ? nextPhaseFirstSample.t
            : samples[samples.length - 1].t;
          const lastNonExtendedIndex = getLastNonExtendedIndex(samples);
          const lastNonExtendedSample =
            lastNonExtendedIndex >= 0 ? samples[lastNonExtendedIndex] : samples[samples.length - 1];

          // Ignore post-stop extension tail for replay decisions in the last phase.
          let replayEndIndex = samples.length - 1;
          if (isLastPhase) {
            const firstExtendedIndex = samples.findIndex(s => s.systemInfo?.extendedRecording === true);
            if (firstExtendedIndex > 0) replayEndIndex = firstExtendedIndex - 1;
          }
          if (replayEndIndex < 0) replayEndIndex = samples.length - 1;

          // Precompute cumulative phase-local pumped volume at each sample.
          const pumpedAtSample = new Array(samples.length).fill(0);
          for (let i = 1; i < samples.length; i++) {
            const dt = (samples[i].t - samples[i - 1].t) / 1000;
            pumpedAtSample[i] = pumpedAtSample[i - 1] + samples[i].fl * dt;
          }

          for (let step = 0; step < steps; step++) {
            const currentDelay = isAutoAdjusted ? step * 100 : null;
            const tScaleDelay = isAutoAdjusted ? currentDelay : scaleDelayMs;
            const tSensorDelay = isAutoAdjusted ? currentDelay : sensorDelayMs;
            const normalizedScaleDelayMs = Math.max(0, tScaleDelay || 0);
            const normalizedSensorDelayMs = Math.max(0, tSensorDelay || 0);
            const scaleDelaySec = normalizedScaleDelayMs / 1000.0;
            const sensorDelaySec = normalizedSensorDelayMs / 1000.0;

            let stepMatch = null;

            // Replay phase sample-by-sample (GM-like online decision).
            for (let si = 0; si <= replayEndIndex && !stepMatch; si++) {
              const sample = samples[si];
              const prevSample = si > 0 ? samples[si - 1] : sample;

              const dt = (sample.t - prevSample.t) / 1000.0;
              const lastP = sample.cp;
              const lastF = sample.fl;
              const lastW = sample.v;
              const lastVF = sample.vf;
              const wPumped = pumpedAtSample[si] || 0;

              let weightRateAnchor = si;
              if (isLastPhase) {
                while (weightRateAnchor > 0 && samples[weightRateAnchor].systemInfo?.extendedRecording) {
                  weightRateAnchor--;
                }
              }
              const weightRateAtSample = getRegressionWeightRate(
                samples,
                weightRateAnchor,
                PREDICTIVE_WINDOW_MS,
              );
              const fallbackInstantRate = lastVF !== undefined ? lastVF : lastF;
              const currentRate = weightRateAtSample > 0 ? weightRateAtSample : fallbackInstantRate;

              let predictedW = lastW;
              if (lastW > 0.1 && !scaleConnectionBrokenPermanently) {
                let predictedAdded = currentRate * scaleDelaySec;
                if (predictedAdded < 0) predictedAdded = 0;
                if (predictedAdded > 8.0) predictedAdded = 8.0;
                predictedW = lastW + predictedAdded;
              }

              let predictedPumped = wPumped;
              if (lastF > 0 && sensorDelaySec > 0) {
                predictedPumped += lastF * sensorDelaySec;
              }

              let predictedP = lastP;
              let predictedF = lastF;
              if (dt > 0 && sensorDelaySec > 0) {
                const slopeP = (lastP - prevSample.cp) / dt;
                const slopeF = (lastF - prevSample.fl) / dt;
                predictedP = lastP + slopeP * sensorDelaySec;
                predictedF = lastF + slopeF * sensorDelaySec;
                if (predictedP < 0) predictedP = 0;
                if (predictedF < 0) predictedF = 0;
              }

              for (let ti = 0; ti < profilePhase.targets.length; ti++) {
                const tgt = profilePhase.targets[ti];
                if (
                  (tgt.type === 'volumetric' || tgt.type === 'weight') &&
                  scaleConnectionBrokenPermanently
                ) {
                  continue;
                }

                const isWeightTarget = tgt.type === 'volumetric' || tgt.type === 'weight';
                if (isLastPhase && isWeightTarget && lastNonExtendedSample.v > tgt.value + 4) {
                  continue;
                }
                const enforceLastPhaseWeightCap = isLastPhase && isWeightTarget && tgt.operator === 'gte';
                const maxAllowedWeightStop = tgt.value + 4;
                const isWithinLastPhaseWeightCap = value =>
                  !enforceLastPhaseWeightCap ||
                  (typeof value === 'number' && isFinite(value) && value <= maxAllowedWeightStop);

                let measured = 0;
                let checkValue = 0;
                let tolerance = 0;
                let projectedDelayMs = 0;
                let hitSource = null;
                let hit = false;

                if (tgt.type === 'pressure') {
                  measured = lastP;
                  checkValue = predictedP;
                  tolerance = TOL_PRESSURE;
                  projectedDelayMs = normalizedSensorDelayMs;
                } else if (tgt.type === 'flow') {
                  measured = lastF;
                  checkValue = predictedF;
                  tolerance = TOL_FLOW;
                  projectedDelayMs = normalizedSensorDelayMs;
                } else if (isWeightTarget) {
                  measured = lastW;
                  checkValue = tgt.operator === 'gte' ? predictedW : lastW;
                  projectedDelayMs = tgt.operator === 'gte' ? normalizedScaleDelayMs : 0;
                } else if (tgt.type === 'pumped') {
                  measured = wPumped;
                  checkValue = tgt.operator === 'gte' ? predictedPumped : wPumped;
                  projectedDelayMs = tgt.operator === 'gte' ? normalizedSensorDelayMs : 0;
                }

                if (
                  tgt.operator === 'gte' &&
                  measured >= tgt.value &&
                  isWithinLastPhaseWeightCap(measured)
                ) {
                  hit = true;
                  hitSource = 'raw';
                  projectedDelayMs = 0;
                }
                if (tgt.operator === 'lte' && measured <= tgt.value) {
                  hit = true;
                  hitSource = 'raw';
                  projectedDelayMs = 0;
                }

                if (!hit) {
                  const allowPredictedLte = shouldAllowPredictedLteForSensorTarget(
                    tgt.type,
                    measured,
                    tgt.value,
                    tolerance,
                  );
                  if (
                    tgt.operator === 'gte' &&
                    checkValue >= tgt.value &&
                    isWithinLastPhaseWeightCap(checkValue)
                  ) {
                    hit = true;
                    hitSource = 'predicted';
                  }
                  if (tgt.operator === 'lte' && allowPredictedLte && checkValue <= tgt.value) {
                    hit = true;
                    hitSource = 'predicted';
                  }
                }

                if (!hit && tolerance > 0) {
                  if (
                    tgt.operator === 'gte' &&
                    measured >= tgt.value - tolerance &&
                    isWithinLastPhaseWeightCap(measured)
                  ) {
                    hit = true;
                    hitSource = 'tolerance';
                    projectedDelayMs = 0;
                  }
                  if (tgt.operator === 'lte' && measured <= tgt.value + tolerance) {
                    hit = true;
                    hitSource = 'tolerance';
                    projectedDelayMs = 0;
                  }
                }

                if (hit) {
                  const triggerTimeMs = sample.t + projectedDelayMs;
                  stepMatch = {
                    target: tgt,
                    lookAhead: false,
                    source: hitSource,
                    triggerTimeMs,
                    boundaryDeltaMs: Math.abs(phaseBoundaryMs - triggerTimeMs),
                    predictedWeight: isWeightTarget ? predictedW : null,
                    delayForAverageMs: projectedDelayMs,
                    testedDelayMs: currentDelay,
                  };
                  break;
                }
              }
            }

            // Use next-phase look-ahead only as fallback if replay found no reason.
            if (!stepMatch && nextPhaseFirstSample && replayEndIndex >= 0) {
              const anchorSample = samples[replayEndIndex];
              const prevAnchor = replayEndIndex > 0 ? samples[replayEndIndex - 1] : anchorSample;
              const nextP = nextPhaseFirstSample.cp ?? 0;
              const nextF = nextPhaseFirstSample.fl ?? 0;
              const nextW = nextPhaseFirstSample.v ?? 0;

              const anchorP = anchorSample.cp ?? 0;
              const anchorF = anchorSample.fl ?? 0;
              const anchorW = anchorSample.v ?? 0;
              const anchorVF = anchorSample.vf;
              const anchorDt = (anchorSample.t - prevAnchor.t) / 1000.0;
              const nextDt = (nextPhaseFirstSample.t - anchorSample.t) / 1000.0;

              let weightRateAnchor = replayEndIndex;
              if (isLastPhase) {
                while (weightRateAnchor > 0 && samples[weightRateAnchor].systemInfo?.extendedRecording) {
                  weightRateAnchor--;
                }
              }
              const weightRateAtBoundary = getRegressionWeightRate(
                samples,
                weightRateAnchor,
                PREDICTIVE_WINDOW_MS,
              );
              const fallbackInstantRate = anchorVF !== undefined ? anchorVF : anchorF;
              const currentRate = weightRateAtBoundary > 0 ? weightRateAtBoundary : fallbackInstantRate;

              let nextPredictedW = nextW;
              if (nextW > 0.1 && !scaleConnectionBrokenPermanently) {
                let nextPredictedAdded = currentRate * scaleDelaySec;
                if (nextPredictedAdded < 0) nextPredictedAdded = 0;
                if (nextPredictedAdded > 8.0) nextPredictedAdded = 8.0;
                nextPredictedW = nextW + nextPredictedAdded;
              }

              let nextPredictedP = nextP;
              let nextPredictedF = nextF;
              let fallbackLookAheadPredictedP = null;
              let fallbackLookAheadPredictedF = null;

              if (nextDt > 0 && sensorDelaySec > 0) {
                const nextSlopeP = (nextP - anchorP) / nextDt;
                const nextSlopeF = (nextF - anchorF) / nextDt;
                nextPredictedP = anchorP + nextSlopeP * sensorDelaySec;
                nextPredictedF = anchorF + nextSlopeF * sensorDelaySec;
                if (nextPredictedP < 0) nextPredictedP = 0;
                if (nextPredictedF < 0) nextPredictedF = 0;
              }

              if (anchorDt > 0 && sensorDelaySec > 0) {
                const anchorSlopeP = (anchorP - prevAnchor.cp) / anchorDt;
                const anchorSlopeF = (anchorF - prevAnchor.fl) / anchorDt;
                fallbackLookAheadPredictedP = anchorP + anchorSlopeP * sensorDelaySec;
                fallbackLookAheadPredictedF = anchorF + anchorSlopeF * sensorDelaySec;
                if (fallbackLookAheadPredictedP < 0) fallbackLookAheadPredictedP = 0;
                if (fallbackLookAheadPredictedF < 0) fallbackLookAheadPredictedF = 0;
              }

              for (let ti = 0; ti < profilePhase.targets.length && !stepMatch; ti++) {
                const tgt = profilePhase.targets[ti];
                if (tgt.type === 'pumped') continue;
                if (
                  (tgt.type === 'volumetric' || tgt.type === 'weight') &&
                  scaleConnectionBrokenPermanently
                ) {
                  continue;
                }

                const isWeightTarget = tgt.type === 'volumetric' || tgt.type === 'weight';
                if (isLastPhase && isWeightTarget && lastNonExtendedSample.v > tgt.value + 4) {
                  continue;
                }
                const enforceLastPhaseWeightCap = isLastPhase && isWeightTarget && tgt.operator === 'gte';
                const maxAllowedWeightStop = tgt.value + 4;
                const isWithinLastPhaseWeightCap = value =>
                  !enforceLastPhaseWeightCap ||
                  (typeof value === 'number' && isFinite(value) && value <= maxAllowedWeightStop);

                let measured = 0;
                let nextMeasured = 0;
                let nextCheckValue = 0;
                let projectedDelayMs = 0;
                let hit = false;
                let hitSource = null;

                if (tgt.type === 'pressure') {
                  measured = anchorP;
                  nextMeasured = nextP;
                  nextCheckValue = nextPredictedP;
                  projectedDelayMs = normalizedSensorDelayMs;
                } else if (tgt.type === 'flow') {
                  measured = anchorF;
                  nextMeasured = nextF;
                  nextCheckValue = nextPredictedF;
                  projectedDelayMs = normalizedSensorDelayMs;
                } else if (isWeightTarget) {
                  measured = anchorW;
                  nextMeasured = nextW;
                  nextCheckValue = tgt.operator === 'gte' ? nextPredictedW : nextW;
                  projectedDelayMs = tgt.operator === 'gte' ? normalizedScaleDelayMs : 0;
                }

                const directionalLookAheadValid = isDirectionallyValidLookAhead(
                  tgt.operator,
                  measured,
                  nextMeasured,
                );
                const lookAheadTolerance =
                  tgt.type === 'pressure' ? TOL_PRESSURE : tgt.type === 'flow' ? TOL_FLOW : 0;

                if (directionalLookAheadValid) {
                  let lookAheadRawHit = false;
                  let lookAheadPredictedHit = false;
                  if (
                    tgt.operator === 'gte' &&
                    nextMeasured >= tgt.value &&
                    isWithinLastPhaseWeightCap(nextMeasured)
                  ) {
                    lookAheadRawHit = true;
                  }
                  if (
                    tgt.operator === 'lte' &&
                    nextMeasured <= tgt.value
                  ) {
                    lookAheadRawHit = true;
                  }

                  if (
                    tgt.operator === 'gte' &&
                    nextCheckValue >= tgt.value &&
                    isWithinLastPhaseWeightCap(nextCheckValue)
                  ) {
                    lookAheadPredictedHit = true;
                  }
                  if (
                    tgt.operator === 'lte' &&
                    shouldAllowPredictedLteForSensorTarget(
                      tgt.type,
                      nextMeasured,
                      tgt.value,
                      lookAheadTolerance,
                    ) &&
                    nextCheckValue <= tgt.value
                  ) {
                    lookAheadPredictedHit = true;
                  }

                  if (lookAheadRawHit || lookAheadPredictedHit) {
                    hit = true;
                    hitSource = 'lookahead';
                    // Raw look-ahead means no projected delay was needed to trigger the stop.
                    projectedDelayMs = lookAheadRawHit ? 0 : projectedDelayMs;
                  }
                } else if (tgt.type === 'pressure' || tgt.type === 'flow') {
                  const fallbackValue =
                    tgt.type === 'pressure'
                      ? fallbackLookAheadPredictedP
                      : fallbackLookAheadPredictedF;
                  if (fallbackValue != null) {
                    if (
                      tgt.operator === 'gte' &&
                      fallbackValue >= tgt.value &&
                      isWithinLastPhaseWeightCap(fallbackValue)
                    ) {
                      hit = true;
                      hitSource = 'lookahead-fallback';
                    }
                    if (
                      tgt.operator === 'lte' &&
                      shouldAllowPredictedLteForSensorTarget(
                        tgt.type,
                        measured,
                        tgt.value,
                        lookAheadTolerance,
                      ) &&
                      fallbackValue <= tgt.value
                    ) {
                      hit = true;
                      hitSource = 'lookahead-fallback';
                    }
                  }
                }

                if (hit) {
                  const triggerTimeMs = anchorSample.t + projectedDelayMs;
                  stepMatch = {
                    target: tgt,
                    lookAhead: true,
                    source: hitSource,
                    triggerTimeMs,
                    boundaryDeltaMs: Math.abs(phaseBoundaryMs - triggerTimeMs),
                    predictedWeight: isWeightTarget ? nextPredictedW : null,
                    delayForAverageMs: projectedDelayMs,
                    testedDelayMs: currentDelay,
                  };
                }
              }
            }

            if (stepMatch) {
              if (!bestStepMatch) {
                bestStepMatch = stepMatch;
              } else {
                const deltaDiff = stepMatch.boundaryDeltaMs - bestStepMatch.boundaryDeltaMs;
                const sourceDiff =
                  getHitSourcePriority(stepMatch.source) - getHitSourcePriority(bestStepMatch.source);
                const lookAheadDiff = Number(stepMatch.lookAhead) - Number(bestStepMatch.lookAhead);
                const delayDiff = (stepMatch.testedDelayMs || 0) - (bestStepMatch.testedDelayMs || 0);

                const clearlyBetterBoundary = deltaDiff < -BOUNDARY_MATCH_TOLERANCE_MS;
                const similarBoundary = Math.abs(deltaDiff) <= BOUNDARY_MATCH_TOLERANCE_MS;
                const betterByTieBreakers =
                  (lookAheadDiff < 0) ||
                  (lookAheadDiff === 0 && sourceDiff < 0) ||
                  (lookAheadDiff === 0 && sourceDiff === 0 && delayDiff < 0);

                // Within a small boundary window, prefer more conservative (non-lookahead, lower-delay) matches.
                if (clearlyBetterBoundary || (similarBoundary && betterByTieBreakers)) {
                  bestStepMatch = stepMatch;
                }
              }
            }
          }

          if (bestStepMatch) {
            exitReason = formatStopReason(bestStepMatch.target.type);
            exitType = bestStepMatch.target.type;
            finalPredictedWeight = bestStepMatch.predictedWeight;
            if (isAutoAdjusted) {
              setPhaseDelayReviewHint(bestStepMatch.delayForAverageMs || 0, 'auto-delay');
            }

            analyzerDebug(debugEnabled, `Auto-delay match phase ${phaseNum}`, {
              shotId: shotData.id,
              phaseName: displayName,
              targetType: bestStepMatch.target.type,
              operator: bestStepMatch.target.operator,
              targetValue: bestStepMatch.target.value,
              source: bestStepMatch.source,
              lookAhead: bestStepMatch.lookAhead,
              delayMs: bestStepMatch.delayForAverageMs,
              boundaryDeltaMs: Math.round(bestStepMatch.boundaryDeltaMs),
              triggerTimeMs: Math.round(bestStepMatch.triggerTimeMs),
            });

            if (isAutoAdjusted) {
              if (exitType === 'weight' || exitType === 'volumetric') {
                sumScaleDelay += bestStepMatch.delayForAverageMs || 0;
                countScaleHits++;
              } else {
                sumSensorDelay += bestStepMatch.delayForAverageMs || 0;
                countSensorHits++;
              }
            }
            foundMatch = true;
          } else {
            analyzerDebug(debugEnabled, `Auto-delay no direct match phase ${phaseNum}`, {
              shotId: shotData.id,
              phaseName: displayName,
              targetCount: profilePhase.targets.length,
            });
          }

          // --- FALLBACK: LAST PHASE SPECIAL LOGIC ---
          // Only run if:
          // - No match found yet
          // - Last phase
          // - Auto-adjust ON
          // - Brew-by-weight mode
          // - Scale connection was never lost (weight stop must be ignored otherwise)
          if (
            !foundMatch &&
            isLastPhase &&
            isAutoAdjusted &&
            isBrewByWeight &&
            !scaleConnectionBrokenPermanently
          ) {
            const weightTarget = profilePhase.targets.find(
              t => t.type === 'weight' || t.type === 'volumetric',
            );

            if (weightTarget) {
              const finalSample = samples[samples.length - 1];
              const finalW = finalSample.v;
              const lastNonExtendedIndex = getLastNonExtendedIndex(samples);
              const stopW =
                lastNonExtendedIndex >= 0 ? samples[lastNonExtendedIndex].v : finalSample.v;

              // Hard guard: if the shot already exceeded target by >4g at stop moment,
              // treat as manual/other stop (never weight stop).
              if (stopW > weightTarget.value + 4) {
                analyzerDebug(debugEnabled, `Last-phase weight stop blocked (>+4g)`, {
                  shotId: shotData.id,
                  phaseName: displayName,
                  stopWeight: stopW,
                  targetWeight: weightTarget.value,
                });
                // Intentionally no weight-stop fallback.
              } else {
                const currentRate = phaseWeightRate;
                const overshoot = stopW - weightTarget.value;
                const undershootAtEnd = weightTarget.value - finalW;
                const finalInstantRate =
                  finalSample.vf !== undefined && finalSample.vf > 0.1
                    ? finalSample.vf
                    : finalSample.fl > 0.1
                      ? finalSample.fl
                      : 0;

                const conservativeRateCandidates = [currentRate, finalInstantRate].filter(
                  r => r != null && isFinite(r) && r > 0.1,
                );
                const conservativeRate =
                  conservativeRateCandidates.length > 0
                    ? Math.min(...conservativeRateCandidates)
                    : 0;

                // Fallback A: stopped above target within +4g
                const stoppedAboveTargetInRange = overshoot >= 0 && overshoot <= 4;

                if (stoppedAboveTargetInRange && currentRate > 0.1) {
                  // Assume overshoot is due to scale delay: Delay = Overshoot / FlowRate
                  // (If overshoot is negative/zero, delay is 0)
                  const calculatedDelay = Math.max(0, (overshoot / currentRate) * 1000);

                  // Allow plausible delay (0-4000ms)
                  if (calculatedDelay <= 4000) {
                    setEstimatedScaleDelay(calculatedDelay);

                    exitReason = formatStopReason(weightTarget.type);
                    exitType = weightTarget.type;
                    finalPredictedWeight = weightTarget.value;

                    sumScaleDelay += calculatedDelay;
                    countScaleHits++;
                    setPhaseDelayReviewHint(calculatedDelay, 'fallback-overshoot');
                    analyzerDebug(debugEnabled, `Last-phase fallback weight stop (overshoot)`, {
                      shotId: shotData.id,
                      phaseName: displayName,
                      stopWeight: stopW,
                      targetWeight: weightTarget.value,
                      estimatedDelayMs: Math.round(calculatedDelay),
                    });
                  }
                }

                // Fallback B: finished below target by up to 6g, likely due to too aggressive scale-delay setting.
                // Only classify when estimated delay is clearly high (>2000ms).
                const stoppedBelowTargetHighDelayCandidate =
                  undershootAtEnd >= 2 && undershootAtEnd <= 6;
                if (
                  !exitType &&
                  stoppedBelowTargetHighDelayCandidate &&
                  conservativeRate > 0.1
                ) {
                  const estimatedDelay = (undershootAtEnd / conservativeRate) * 1000;
                  if (estimatedDelay > 2000 && estimatedDelay <= 4000) {
                    setEstimatedScaleDelay(estimatedDelay);

                    exitReason = formatStopReason(weightTarget.type);
                    exitType = weightTarget.type;
                    finalPredictedWeight = weightTarget.value;

                    sumScaleDelay += estimatedDelay;
                    countScaleHits++;
                    setPhaseDelayReviewHint(estimatedDelay, 'fallback-undershoot');
                    analyzerDebug(debugEnabled, `Last-phase fallback weight stop (undershoot high delay)`, {
                      shotId: shotData.id,
                      phaseName: displayName,
                      stopWeight: stopW,
                      finalWeight: finalW,
                      targetWeight: weightTarget.value,
                      estimatedDelayMs: Math.round(estimatedDelay),
                    });
                  }
                }
              }
            }
          }

          // Independent high-delay warning detection for last phase (both undershoot/overshoot),
          // capped to +/-4g to avoid flagging clear manual stops.
          if (isLastPhase && isBrewByWeight && !scaleConnectionBrokenPermanently) {
            const weightTarget = profilePhase.targets.find(
              t => t.type === 'weight' || t.type === 'volumetric',
            );
            if (weightTarget) {
              const finalSample = samples[samples.length - 1];
              const finalW = finalSample.v;
              const lastNonExtendedIndex = getLastNonExtendedIndex(samples);
              const stopW =
                lastNonExtendedIndex >= 0 ? samples[lastNonExtendedIndex].v : finalSample.v;
              const finalInstantRate =
                finalSample.vf !== undefined && finalSample.vf > 0.1
                  ? finalSample.vf
                  : finalSample.fl > 0.1
                    ? finalSample.fl
                    : 0;
              const rateCandidates = [phaseWeightRate, finalInstantRate].filter(
                r => r != null && isFinite(r) && r > 0.1,
              );
              const conservativeRate = rateCandidates.length > 0 ? Math.min(...rateCandidates) : 0;
              const absDelta = Math.abs(finalW - weightTarget.value);

              // Ignore clear manual overshoot and tiny deltas.
              if (
                stopW <= weightTarget.value + 4 &&
                conservativeRate > 0.1 &&
                absDelta >= 2 &&
                absDelta <= 6
              ) {
                const estimatedDelay = (absDelta / conservativeRate) * 1000;
                if (estimatedDelay <= 4000) {
                  setEstimatedScaleDelay(estimatedDelay);
                }
              }
            }
          }
        }
      }
    }

    // --- PHASE METRICS ---
    let pWaterPumped = 0;
    for (let i = 1; i < samples.length; i++) {
      const dt = (samples[i].t - samples[i - 1].t) / 1000;
      pWaterPumped += samples[i].fl * dt;
    }

    analyzedPhases.push({
      number: phaseNum,
      name: rawName,
      displayName,
      start: pStart,
      end: pEnd,
      duration,
      water: pWaterPumped,
      weight: samples[samples.length - 1].v,
      stats: {
        p: getMetricStats(samples, 'cp'),
        tp: getMetricStats(samples, 'tp'),
        f: getMetricStats(samples, 'fl'),
        pf: getMetricStats(samples, 'pf'),
        tf: getMetricStats(samples, 'tf'),
        t: getMetricStats(samples, 'ct'),
        tt: getMetricStats(samples, 'tt'),
        w: getMetricStats(samples, 'v'),
        sys_raw: sysInfo.raw,
        sys_shot_vol: sysInfo.shotStartedVolumetric,
        sys_curr_vol: sysInfo.currentlyVolumetric,
        sys_scale: sysInfo.bluetoothScaleConnected,
        sys_vol_avail: sysInfo.volumetricAvailable,
        sys_ext: sysInfo.extendedRecording,
      },
      exit: {
        reason: exitReason,
        type: exitType,
      },
      profilePhase,
      scaleLost: scaleLostInThisPhase,
      scalePermanentlyLost: scaleConnectionBrokenPermanently,
      highScaleDelay: phaseHighScaleDelay,
      estimatedScaleDelayMs: phaseEstimatedScaleDelayMs,
      delayReviewHint: phaseDelayReviewHint,
      delayReviewReason: phaseDelayReviewReason,
      delayReviewMs: phaseDelayReviewMs,
      prediction: {
        finalWeight: finalPredictedWeight,
      },
    });
  });

  // Calculate distinct Average Delays
  let avgScaleDelay = scaleDelayMs;
  let avgSensorDelay = sensorDelayMs;

  if (isAutoAdjusted) {
    if (countScaleHits > 0) {
      avgScaleDelay = Math.round(sumScaleDelay / countScaleHits / 50) * 50;
    }
    if (countSensorHits > 0) {
      avgSensorDelay = Math.round(sumSensorDelay / countSensorHits / 50) * 50;
    }
  }

  analyzerDebug(debugEnabled, 'Auto-delay summary', {
    shotId: shotData.id,
    isAutoAdjusted,
    scaleHits: countScaleHits,
    sensorHits: countSensorHits,
    avgScaleDelayMs: avgScaleDelay,
    avgSensorDelayMs: avgSensorDelay,
  });

  // --- 5. TOTAL STATS ---
  const finalSysInfo = gSamples[gSamples.length - 1].systemInfo || {};

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
    sys_raw: finalSysInfo.raw,
    sys_shot_vol: finalSysInfo.shotStartedVolumetric,
    sys_curr_vol: finalSysInfo.currentlyVolumetric,
    sys_scale: finalSysInfo.bluetoothScaleConnected,
    sys_vol_avail: finalSysInfo.volumetricAvailable,
    sys_ext: finalSysInfo.extendedRecording,
  };

  const highScaleDelayPhases = analyzedPhases.filter(p => p.highScaleDelay);
  const hasHighScaleDelay = highScaleDelayPhases.length > 0;
  const highScaleDelayMs = hasHighScaleDelay
    ? Math.max(...highScaleDelayPhases.map(p => p.estimatedScaleDelayMs || 0))
    : null;
  const delayReviewPhases = analyzedPhases
    .map((phase, idx) => ({ ...phase, tablePhaseNumber: idx + 1 }))
    .filter(phase => phase.delayReviewHint);
  const hasDelayReviewHint = delayReviewPhases.length > 0;
  const primaryDelayReview = hasDelayReviewHint
    ? [...delayReviewPhases].sort(
        (a, b) => (b.delayReviewMs || 0) - (a.delayReviewMs || 0),
      )[0]
    : null;
  const delayReviewPhaseNumber = primaryDelayReview ? primaryDelayReview.tablePhaseNumber : null;
  const delayReviewMs = primaryDelayReview ? primaryDelayReview.delayReviewMs : null;
  const delayReviewMessage = delayReviewPhaseNumber
    ? delayReviewMs != null
      ? `Unusually high inferred delay in Phase ${delayReviewPhaseNumber} (${delayReviewMs} ms).`
      : `Unusually high inferred delay in Phase ${delayReviewPhaseNumber}.`
    : null;

  return {
    isBrewByWeight,
    globalScaleLost,
    highScaleDelay: hasHighScaleDelay,
    highScaleDelayMs,
    delayReviewHint: hasDelayReviewHint,
    delayReviewPhaseNumber,
    delayReviewMs,
    delayReviewMessage,
    isAutoAdjusted,
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
 * @param {number} manualDelay - User-configured delay (fallback)
 * @returns {Object} { delay: number, auto: boolean }
 */
export function detectAutoDelay(shotData, profileData, manualDelay) {
  // Perform a quick check using calculateShotMetrics logic
  const results = calculateShotMetrics(shotData, profileData, {
    scaleDelayMs: manualDelay,
    sensorDelayMs: manualDelay,
    isAutoAdjusted: true,
  });

  if (results && results.usedSettings) {
    // Return scale delay as primary "detected" delay for legacy compatibility
    return { delay: results.usedSettings.scaleDelayMs, auto: true };
  }

  return { delay: manualDelay, auto: false };
}
