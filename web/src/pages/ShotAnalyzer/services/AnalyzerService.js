/**
 * AnalyzerService.js
 * * Shot Analysis Engine for GaggiMate
 * Calculates metrics, detects phase transitions, and determines exit reasons
 */

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

          for (let step = 0; step < steps; step++) {
            const currentDelay = isAutoAdjusted ? step * 100 : null;
            const tScaleDelay = isAutoAdjusted ? currentDelay : scaleDelayMs;
            const tSensorDelay = isAutoAdjusted ? currentDelay : sensorDelayMs;

            // --- CALCULATIONS FOR CURRENT DELAY ---
            let wPumped = 0;
            for (let i = 1; i < samples.length; i++) {
              const dt = (samples[i].t - samples[i - 1].t) / 1000;
              wPumped += samples[i].fl * dt;
            }

            const lastSample = samples[samples.length - 1];
            const prevSample = samples.length > 1 ? samples[samples.length - 2] : lastSample;
            const dt = (lastSample.t - prevSample.t) / 1000.0;

            const lastP = lastSample.cp;
            const lastF = lastSample.fl;
            const lastW = lastSample.v;
            const lastVF = lastSample.vf;

            // Look ahead
            let nextPhaseFirstSample = null;
            const nextPNum = parseInt(phaseNum, 10) + 1;
            if (phases[nextPNum] && phases[nextPNum].length > 0) {
              nextPhaseFirstSample = phases[nextPNum][0];
            }

            // --- 1. PREDICTION LOGIC (Current Sample) ---
            let predictedW = lastW;
            let currentRate = lastVF !== undefined ? lastVF : lastF;

            if (lastW > 0.1 && !scaleConnectionBrokenPermanently) {
              let predictedAdded = currentRate * (tScaleDelay / 1000.0);
              if (predictedAdded < 0) predictedAdded = 0;
              if (predictedAdded > 8.0) predictedAdded = 8.0;
              predictedW = lastW + predictedAdded;
            }

            let predictedPumped = wPumped;
            if (lastF > 0) {
              predictedPumped += lastF * (tSensorDelay / 1000.0);
            }

            let predictedP = lastP;
            let predictedF = lastF;
            if (dt > 0) {
              const slopeP = (lastP - prevSample.cp) / dt;
              const slopeF = (lastF - prevSample.fl) / dt;
              predictedP = lastP + slopeP * (tSensorDelay / 1000.0);
              predictedF = lastF + slopeF * (tSensorDelay / 1000.0);
            }

            // --- 2. PREDICTION LOGIC (Look-Ahead Sample) ---
            // Calculates predictions for the exact moment after the phase transition
            // 'pumped' is intentionally excluded

            // Only calculate look-ahead if tested delay is >= 200ms
            const maxTestedDelay = Math.max(tScaleDelay || 0, tSensorDelay || 0);
            const useLookAhead = nextPhaseFirstSample && maxTestedDelay >= 200;

            let nextP = 0,
              nextF = 0,
              nextW = 0;
            let nextPredictedW = 0,
              nextPredictedP = 0,
              nextPredictedF = 0;

            // Only run if we actually need the look-ahead
            if (useLookAhead) {
              nextP = nextPhaseFirstSample.cp !== undefined ? nextPhaseFirstSample.cp : 0;
              nextF = nextPhaseFirstSample.fl !== undefined ? nextPhaseFirstSample.fl : 0;
              nextW = nextPhaseFirstSample.v !== undefined ? nextPhaseFirstSample.v : 0;

              const nextDt = (nextPhaseFirstSample.t - lastSample.t) / 1000.0;

              if (nextDt > 0) {
                nextPredictedW = nextW;
                // Use currentRate (from active phase) because nextF might be lower if the pump just stopped
                if (nextW > 0.1 && !scaleConnectionBrokenPermanently) {
                  let nextPredictedAdded = currentRate * (tScaleDelay / 1000.0);
                  if (nextPredictedAdded < 0) nextPredictedAdded = 0;
                  if (nextPredictedAdded > 8.0) nextPredictedAdded = 8.0;
                  nextPredictedW = nextW + nextPredictedAdded;
                }

                const nextSlopeP = (nextP - lastP) / nextDt;
                const nextSlopeF = (nextF - lastF) / nextDt;
                nextPredictedP = nextP + nextSlopeP * (tSensorDelay / 1000.0);
                nextPredictedF = nextF + nextSlopeF * (tSensorDelay / 1000.0);
              } else {
                // Fallback if timestamps are identical
                nextPredictedW = nextW;
                nextPredictedP = nextP;
                nextPredictedF = nextF;
              }
            }

            // --- 3. TARGET MATCHING LOGIC ---
            let hitTargets = [];
            for (let tgt of profilePhase.targets) {
              if (
                (tgt.type === 'volumetric' || tgt.type === 'weight') &&
                scaleConnectionBrokenPermanently
              )
                continue;

              let measured = 0,
                checkValue = 0,
                tolerance = 0;
              let nextMeasured = 0,
                nextCheckValue = 0;
              let hit = false;
              let hitByLookAhead = false; // Track if the look-ahead sample triggered the hit

              // Assign values based on target type
              if (tgt.type === 'pressure') {
                measured = lastP;
                checkValue = tgt.operator === 'gte' || tgt.operator === 'lte' ? predictedP : lastP;
                tolerance = TOL_PRESSURE;

                if (useLookAhead) {
                  nextMeasured = nextP;
                  nextCheckValue =
                    tgt.operator === 'gte' || tgt.operator === 'lte' ? nextPredictedP : nextP;
                }
              } else if (tgt.type === 'flow') {
                measured = lastF;
                checkValue = tgt.operator === 'gte' || tgt.operator === 'lte' ? predictedF : lastF;
                tolerance = TOL_FLOW;

                if (useLookAhead) {
                  nextMeasured = nextF;
                  nextCheckValue =
                    tgt.operator === 'gte' || tgt.operator === 'lte' ? nextPredictedF : nextF;
                }
              } else if (tgt.type === 'volumetric' || tgt.type === 'weight') {
                measured = lastW;
                checkValue = tgt.operator === 'gte' ? predictedW : lastW;

                if (useLookAhead) {
                  nextMeasured = nextW;
                  nextCheckValue = tgt.operator === 'gte' ? nextPredictedW : nextW;
                }
              } else if (tgt.type === 'pumped') {
                measured = wPumped;
                checkValue = tgt.operator === 'gte' ? predictedPumped : wPumped;
                // NO Look-Ahead assigned for pumped!
              }

              // Check 1: Current sample (Raw)
              if (tgt.operator === 'gte' && measured >= tgt.value) hit = true;
              if (tgt.operator === 'lte' && measured <= tgt.value) hit = true;

              // Check 2: Current sample (Predicted)
              if (!hit) {
                if (tgt.operator === 'gte' && checkValue >= tgt.value) hit = true;
                if (tgt.operator === 'lte' && checkValue <= tgt.value) hit = true;
              }

              // Check 3: Current sample (Tolerance)
              if (!hit && tolerance > 0) {
                if (tgt.operator === 'gte' && measured >= tgt.value - tolerance) hit = true;
                if (tgt.operator === 'lte' && measured <= tgt.value + tolerance) hit = true;
              }

              // Check 4: Look-Ahead Sample (Raw & Predicted)
              // Only for continuous metrics, avoiding phase-reset metrics like 'pumped'
              if (!hit && useLookAhead && tgt.type !== 'pumped') {
                if (
                  tgt.operator === 'gte' &&
                  (nextMeasured >= tgt.value || nextCheckValue >= tgt.value)
                ) {
                  hit = true;
                  hitByLookAhead = true;
                }
                if (
                  tgt.operator === 'lte' &&
                  (nextMeasured <= tgt.value || nextCheckValue <= tgt.value)
                ) {
                  hit = true;
                  hitByLookAhead = true;
                }
              }

              // Store both the target and whether it was hit via look-ahead
              if (hit) hitTargets.push({ target: tgt, lookAhead: hitByLookAhead });
            }

            if (hitTargets.length > 0) {
              hitTargets.sort((a, b) => {
                const getScore = type => {
                  if (type === 'flow') return 1;
                  if (type === 'weight' || type === 'volumetric') return 2;
                  if (type === 'pressure') return 3;
                  return 4;
                };
                // Access target object because hitTargets now contains objects
                return getScore(a.target.type) - getScore(b.target.type);
              });

              const bestMatchObj = hitTargets[0];
              const bestMatch = bestMatchObj.target;

              exitReason = formatStopReason(bestMatch.type);
              exitType = bestMatch.type;

              // Use the corresponding predicted weight for UI display based on WHEN it hit
              finalPredictedWeight = bestMatchObj.lookAhead ? nextPredictedW : predictedW;

              if (isAutoAdjusted) {
                if (exitType === 'weight' || exitType === 'volumetric') {
                  sumScaleDelay += currentDelay;
                  countScaleHits++;
                } else {
                  sumSensorDelay += currentDelay;
                  countSensorHits++;
                }
              }
              foundMatch = true;
              break;
            }
          }

          // --- FALLBACK: LAST PHASE SPECIAL LOGIC ---
          // Only run if: No match found yet, Last phase, Auto-adjust ON and shot started in Volumetric/Weight mode
          if (!foundMatch && isLastPhase && isAutoAdjusted && isBrewByWeight) {
            const weightTarget = profilePhase.targets.find(
              t => t.type === 'weight' || t.type === 'volumetric',
            );

            if (weightTarget) {
              const lastW = samples[samples.length - 1].v;
              const currentRate = samples[samples.length - 1].vf || samples[samples.length - 1].fl;

              // Sanity Check: Only assume it was a Weight Stop if we actually reached the target
              // (or are extremely close, e.g. within 2.5g).
              // If we stopped at 30g but target was 40g, it was a manual/time stop -> ignore.
              const hitTarget = lastW >= weightTarget.value - 2.5;

              if (hitTarget && currentRate > 0.1) {
                // Calculate overshoot
                const overshoot = lastW - weightTarget.value;
                // Assume overshoot is due to scale delay: Delay = Overshoot / FlowRate
                // (If overshoot is negative/zero, delay is 0)
                const calculatedDelay = Math.max(0, (overshoot / currentRate) * 1000);

                // Allow plausible delay (0-4000ms)
                if (calculatedDelay <= 4000) {
                  exitReason = formatStopReason(weightTarget.type);
                  exitType = weightTarget.type;
                  finalPredictedWeight = weightTarget.value;

                  sumScaleDelay += calculatedDelay;
                  countScaleHits++;
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

  return {
    isBrewByWeight,
    globalScaleLost,
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
