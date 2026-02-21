/**
 * AnalyzerService.js
 * * Shot Analysis Engine for GaggiMate
 * Calculates metrics, detects phase transitions, and determines exit reasons
 */

const PREDICTIVE_WINDOW_MS = 4000;
// Last-phase fallback thresholds (g)
const LAST_PHASE_UNDERSHOOT_MIN_G = 2;
const LAST_PHASE_UNDERSHOOT_MAX_G = 6;
const LAST_PHASE_OVERSHOOT_MAX_G = 4;
const LAST_PHASE_ESTIMATED_DELAY_MAX_MS = 4000;

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

function getSampleInstantWeightRate(sample) {
  if (!sample) return 0;
  if (sample.vf !== undefined && sample.vf > 0.1) return sample.vf;
  if (sample.fl > 0.1) return sample.fl;
  return 0;
}

function isDirectionallyValidLookAhead(operator, currentValue, nextValue) {
  if (!isFinite(currentValue) || !isFinite(nextValue)) return false;
  if (operator === 'gte') return nextValue >= currentValue;
  if (operator === 'lte') return nextValue <= currentValue;
  return true;
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
    let targetCalcValues = null;
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
          let foundMatch = false;

          const sInterval = shotData.sampleInterval || 250;
          const sIntervalSec = sInterval / 1000;
          const currentKeyIndex = sortedPhaseKeys.indexOf(phaseNum);
          const nextPhaseKey = currentKeyIndex >= 0 && currentKeyIndex < sortedPhaseKeys.length - 1
            ? sortedPhaseKeys[currentKeyIndex + 1]
            : null;
          const nextPhaseSamples = nextPhaseKey ? (phases[nextPhaseKey] || []) : [];
          const lastNonExtendedIndex = getLastNonExtendedIndex(samples);
          const lastNonExtendedSample =
            lastNonExtendedIndex >= 0 ? samples[lastNonExtendedIndex] : samples[samples.length - 1];

          // Anchor: last non-extended sample for last phase, otherwise last sample
          const anchorIdx = isLastPhase && lastNonExtendedIndex >= 0
            ? lastNonExtendedIndex
            : samples.length - 1;
          const anchor = samples[anchorIdx];
          const prevAnchor = anchorIdx > 0 ? samples[anchorIdx - 1] : anchor;

          // Cumulative pumped water up to anchor
          let anchorPumped = 0;
          for (let i = 1; i <= anchorIdx; i++) {
            const dt = (samples[i].t - samples[i - 1].t) / 1000;
            anchorPumped += samples[i].fl * dt;
          }

          // Prediction setup: weight rate and pressure/flow slopes
          const wRate = getPhaseWeightRate(samples, isLastPhase);
          const anchorDt = (anchor.t - prevAnchor.t) / 1000;
          const pSlope = anchorDt > 0 ? (anchor.cp - prevAnchor.cp) / anchorDt : 0;
          const fSlope = anchorDt > 0 ? (anchor.fl - prevAnchor.fl) / anchorDt : 0;

          // --- Helper: check targets against given values ---
          const tryTargets = (p, f, w, pumped, delayMs) => {
            for (let ti = 0; ti < profilePhase.targets.length; ti++) {
              const tgt = profilePhase.targets[ti];
              const isWt = tgt.type === 'volumetric' || tgt.type === 'weight';
              if (isWt && !isBrewByWeight) continue;
              if (isWt && scaleConnectionBrokenPermanently) continue;
              if (isLastPhase && isWt && lastNonExtendedSample.v > tgt.value + LAST_PHASE_OVERSHOOT_MAX_G) continue;

              let val;
              if (tgt.type === 'pressure') { val = p; }
              else if (tgt.type === 'flow') { val = f; }
              else if (isWt) { val = w; }
              else if (tgt.type === 'pumped') { val = pumped; }
              else continue;

              let hit = false;
              if (tgt.operator === 'gte' && val >= tgt.value) {
                if (!(isLastPhase && isWt && val > tgt.value + LAST_PHASE_OVERSHOOT_MAX_G)) hit = true;
              }
              if (tgt.operator === 'lte' && val <= tgt.value) hit = true;

              if (hit) return { target: tgt, delayMs, predictedWeight: isWt ? val : null };
            }
            return null;
          };

          // --- Helper: check targets with direction validation per target ---
          const tryTargetsWithDir = (nextSample, nSteps) => {
            const horizon = nSteps * sIntervalSec;
            const nextDt = (nextSample.t - anchor.t) / 1000;

            for (let ti = 0; ti < profilePhase.targets.length; ti++) {
              const tgt = profilePhase.targets[ti];
              const isWt = tgt.type === 'volumetric' || tgt.type === 'weight';
              if (isWt && !isBrewByWeight) continue;
              if (isWt && scaleConnectionBrokenPermanently) continue;
              if (isLastPhase && isWt && lastNonExtendedSample.v > tgt.value + LAST_PHASE_OVERSHOOT_MAX_G) continue;

              let anchorVal, nextVal, predVal;
              if (tgt.type === 'pressure') {
                anchorVal = anchor.cp;
                nextVal = nextSample.cp;
                predVal = Math.max(0, anchor.cp + pSlope * horizon);
              } else if (tgt.type === 'flow') {
                anchorVal = anchor.fl;
                nextVal = nextSample.fl;
                predVal = Math.max(0, anchor.fl + fSlope * horizon);
              } else if (isWt) {
                anchorVal = anchor.v;
                nextVal = nextSample.v;
                predVal = anchor.v + (wRate > 0 ? wRate * horizon : 0);
              } else if (tgt.type === 'pumped') {
                anchorVal = anchorPumped;
                nextVal = anchorPumped + nextSample.fl * nextDt;
                predVal = anchorPumped + Math.max(0, anchor.fl) * horizon;
              } else continue;

              // Use actual value if direction is valid, otherwise fall back to prediction
              const dirValid = isDirectionallyValidLookAhead(tgt.operator, anchorVal, nextVal);
              const val = dirValid ? nextVal : predVal;

              // No tolerance at look-ahead steps — these are actual/predicted values, not raw sensor readings
              let hit = false;
              if (tgt.operator === 'gte' && val >= tgt.value) {
                if (!(isLastPhase && isWt && val > tgt.value + LAST_PHASE_OVERSHOOT_MAX_G)) hit = true;
              }
              if (tgt.operator === 'lte' && val <= tgt.value) hit = true;

              if (hit) {
                return {
                  target: tgt,
                  delayMs: nSteps * sInterval,
                  predictedWeight: isWt ? val : null,
                };
              }
            }
            return null;
          };

          // --- Helper: predict values at N steps ahead (pure extrapolation) ---
          const predictAt = (nSteps) => {
            const h = nSteps * sIntervalSec;
            return {
              p: Math.max(0, anchor.cp + pSlope * h),
              f: Math.max(0, anchor.fl + fSlope * h),
              w: anchor.v + (wRate > 0 ? wRate * h : 0),
              pumped: anchorPumped + Math.max(0, anchor.fl) * h,
            };
          };

          let match = null;

          if (isAutoAdjusted) {
            // AUTO MODE: 4-step detection using actual recorded data

            // STEP 1: Check at anchor point (delay = 0) — with sensor tolerance
            match = tryTargets(anchor.cp, anchor.fl, anchor.v, anchorPumped, 0);

            // STEP 2: First next-phase sample (delay ≈ 1 × sampleInterval)
            if (!match && nextPhaseSamples.length > 0) {
              match = tryTargetsWithDir(nextPhaseSamples[0], 1);
            }

            // STEP 3: Second next-phase sample (delay ≈ 2 × sampleInterval)
            if (!match && nextPhaseSamples.length > 1) {
              match = tryTargetsWithDir(nextPhaseSamples[1], 2);
            }

            // STEP 4: Predictive extrapolation fallback
            if (!match) {
              const maxSteps = Math.ceil(LAST_PHASE_ESTIMATED_DELAY_MAX_MS / sInterval);
              for (let step = 3; step <= maxSteps && !match; step++) {
                const pred = predictAt(step);
                match = tryTargets(pred.p, pred.f, pred.w, pred.pumped, step * sInterval);
              }
            }
          } else {
            // MANUAL MODE: predict with user-configured delays
            const normScaleMs = Math.max(0, scaleDelayMs || 0);
            const normSensorMs = Math.max(0, sensorDelayMs || 0);
            const scaleDelaySec = normScaleMs / 1000;
            const sensorDelaySec = normSensorMs / 1000;

            for (let ti = 0; ti < profilePhase.targets.length && !match; ti++) {
              const tgt = profilePhase.targets[ti];
              const isWt = tgt.type === 'volumetric' || tgt.type === 'weight';
              if (isWt && !isBrewByWeight) continue;
              if (isWt && scaleConnectionBrokenPermanently) continue;
              if (isLastPhase && isWt && lastNonExtendedSample.v > tgt.value + LAST_PHASE_OVERSHOOT_MAX_G) continue;

              let val, delayMs = 0;
              if (tgt.type === 'pressure') {
                val = Math.max(0, anchor.cp + pSlope * sensorDelaySec);
                delayMs = normSensorMs;
              } else if (tgt.type === 'flow') {
                val = Math.max(0, anchor.fl + fSlope * sensorDelaySec);
                delayMs = normSensorMs;
              } else if (isWt) {
                val = anchor.v + (wRate > 0 ? wRate * scaleDelaySec : 0);
                delayMs = normScaleMs;
              } else if (tgt.type === 'pumped') {
                val = anchorPumped + Math.max(0, anchor.fl) * sensorDelaySec;
                delayMs = normSensorMs;
              } else continue;

              // No tolerance for predicted values — tolerance only at step 1 (raw sensor readings)
              let hit = false;
              if (tgt.operator === 'gte' && val >= tgt.value) {
                if (!(isLastPhase && isWt && val > tgt.value + LAST_PHASE_OVERSHOOT_MAX_G)) hit = true;
              }
              if (tgt.operator === 'lte' && val <= tgt.value) hit = true;

              if (hit) {
                match = { target: tgt, delayMs, predictedWeight: isWt ? val : null };
              }
            }
          }

          // --- Process match result ---
          if (match) {
            exitReason = formatStopReason(match.target.type);
            exitType = match.target.type;
            finalPredictedWeight = match.predictedWeight;

            setEstimatedScaleDelay(match.delayMs);

            // Review hint when stop was found at step 3 or later (delay >= 2 × sampleInterval)
            if (isAutoAdjusted && match.delayMs >= sInterval * 2) {
              setPhaseDelayReviewHint(match.delayMs, 'auto-delay');
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
              if (exitType === 'weight' || exitType === 'volumetric') {
                sumScaleDelay += match.delayMs;
                countScaleHits++;
              } else {
                sumSensorDelay += match.delayMs;
                countSensorHits++;
              }
            }
            foundMatch = true;

            // Compute calculated values for ALL targets at the matched delay
            if (match.delayMs > 0) {
              targetCalcValues = {};
              const matchStep = Math.round(match.delayMs / sInterval);

              for (const tgt of profilePhase.targets) {
                const isWt = tgt.type === 'volumetric' || tgt.type === 'weight';
                if (isWt && !isBrewByWeight) continue;
                if (isWt && scaleConnectionBrokenPermanently) continue;

                let calcVal;
                const nextSampleIdx = matchStep - 1;
                if (isAutoAdjusted && nextSampleIdx >= 0 && nextSampleIdx < nextPhaseSamples.length) {
                  const ns = nextPhaseSamples[nextSampleIdx];
                  const horizon = matchStep * sIntervalSec;
                  const nextDt = (ns.t - anchor.t) / 1000;
                  let anchorVal, nextVal, predVal;
                  if (tgt.type === 'pressure') { anchorVal = anchor.cp; nextVal = ns.cp; predVal = Math.max(0, anchor.cp + pSlope * horizon); }
                  else if (tgt.type === 'flow') { anchorVal = anchor.fl; nextVal = ns.fl; predVal = Math.max(0, anchor.fl + fSlope * horizon); }
                  else if (isWt) { anchorVal = anchor.v; nextVal = ns.v; predVal = anchor.v + (wRate > 0 ? wRate * horizon : 0); }
                  else if (tgt.type === 'pumped') { anchorVal = anchorPumped; nextVal = anchorPumped + ns.fl * nextDt; predVal = anchorPumped + Math.max(0, anchor.fl) * horizon; }
                  else continue;
                  const dirValid = isDirectionallyValidLookAhead(tgt.operator, anchorVal, nextVal);
                  calcVal = dirValid ? nextVal : predVal;
                } else {
                  const h = match.delayMs / 1000;
                  if (tgt.type === 'pressure') calcVal = Math.max(0, anchor.cp + pSlope * h);
                  else if (tgt.type === 'flow') calcVal = Math.max(0, anchor.fl + fSlope * h);
                  else if (isWt) calcVal = anchor.v + (wRate > 0 ? wRate * h : 0);
                  else if (tgt.type === 'pumped') calcVal = anchorPumped + Math.max(0, anchor.fl) * h;
                  else continue;
                }

                targetCalcValues[tgt.type] = {
                  value: calcVal,
                  isStopReason: tgt === match.target,
                };
              }
            }
          } else {
            analyzerDebug(debugEnabled, `No stop match phase ${phaseNum}`, {
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
              const stopSample =
                lastNonExtendedIndex >= 0 ? samples[lastNonExtendedIndex] : finalSample;
              const stopW = stopSample.v;

              // If the shot already exceeded target above configured overshoot cap,
              // treat as manual/other stop (never weight stop).
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
                // Intentionally no weight-stop fallback.
              } else {
                const currentRate = phaseWeightRate;
                const overshoot = stopW - weightTarget.value;
                const undershootAtEnd = weightTarget.value - finalW;
                const stopInstantRate = getSampleInstantWeightRate(stopSample);

                const conservativeRateCandidates = [currentRate, stopInstantRate].filter(
                  r => r != null && isFinite(r) && r > 0.1,
                );
                const conservativeRate =
                  conservativeRateCandidates.length > 0
                    ? Math.min(...conservativeRateCandidates)
                    : 0;

                // Fallback A: stopped above target
                const stoppedAboveTargetInRange =
                  overshoot >= 0 && overshoot <= LAST_PHASE_OVERSHOOT_MAX_G;

                if (stoppedAboveTargetInRange && currentRate > 0.1) {
                  // Assume overshoot is due to scale delay: Delay = Overshoot / FlowRate
                  // (If overshoot is negative/zero, delay is 0)
                  const calculatedDelay = Math.max(0, (overshoot / currentRate) * 1000);

                  // Allow plausible delay (0..configured max)
                  if (calculatedDelay <= LAST_PHASE_ESTIMATED_DELAY_MAX_MS) {
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

                // Fallback B: finished below target
                // Only classify when estimated delay is clearly high (>2000ms).
                const stoppedBelowTargetHighDelayCandidate =
                  undershootAtEnd >= LAST_PHASE_UNDERSHOOT_MIN_G &&
                  undershootAtEnd <= LAST_PHASE_UNDERSHOOT_MAX_G;
                if (
                  !exitType &&
                  stoppedBelowTargetHighDelayCandidate &&
                  conservativeRate > 0.1
                ) {
                  const estimatedDelay = (undershootAtEnd / conservativeRate) * 1000;
                  if (estimatedDelay > 2000 && estimatedDelay <= LAST_PHASE_ESTIMATED_DELAY_MAX_MS) {
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

          // Independent high-delay warning detection for last phase (undershoot up to configured max,
          // overshoot up to configured max) to avoid flagging clear manual stops.
          if (isLastPhase && isBrewByWeight && !scaleConnectionBrokenPermanently) {
            const weightTarget = profilePhase.targets.find(
              t => t.type === 'weight' || t.type === 'volumetric',
            );
            if (weightTarget) {
              const finalSample = samples[samples.length - 1];
              const finalW = finalSample.v;
              const lastNonExtendedIndex = getLastNonExtendedIndex(samples);
              const stopSample =
                lastNonExtendedIndex >= 0 ? samples[lastNonExtendedIndex] : finalSample;
              const stopW = stopSample.v;
              const stopInstantRate = getSampleInstantWeightRate(stopSample);
              const rateCandidates = [phaseWeightRate, stopInstantRate].filter(
                r => r != null && isFinite(r) && r > 0.1,
              );
              const conservativeRate = rateCandidates.length > 0 ? Math.min(...rateCandidates) : 0;
              const absDelta = Math.abs(finalW - weightTarget.value);

              // Ignore clear manual overshoot and tiny deltas.
              if (
                stopW <= weightTarget.value + LAST_PHASE_OVERSHOOT_MAX_G &&
                conservativeRate > 0.1 &&
                absDelta >= LAST_PHASE_UNDERSHOOT_MIN_G &&
                absDelta <= LAST_PHASE_UNDERSHOOT_MAX_G
              ) {
                const estimatedDelay = (absDelta / conservativeRate) * 1000;
                if (estimatedDelay <= LAST_PHASE_ESTIMATED_DELAY_MAX_MS) {
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
      targetCalcValues,
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
