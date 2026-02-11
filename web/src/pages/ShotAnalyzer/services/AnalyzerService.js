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
    if (start === undefined) start = 0;
    if (end === undefined) end = 0;
    
    // Min, Max, and Time-Weighted Average
    for (let i = 0; i < samples.length; i++) {
        const val = samples[i][key] !== undefined ? samples[i][key] : 0;
        
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
    
    if (min === Infinity) min = 0;
    if (max === -Infinity) max = 0;
    
    // For single-sample phases, totalTime is 0 — use the sample value directly
    const avg = totalTime > 0 ? (weightedSum / totalTime) : start;
    
    return { start, end, min, max, avg };
}

/**
 * Format stop reason type into human-readable string
 * @param {string} type - Raw stop reason type
 * @returns {string} Formatted reason
 */
export function formatStopReason(type) {
    if (!type) return "";
    
    const t = type.toLowerCase();
    
    // Map internal types to GM UI friendly labels
    if (t === "duration") return "Time Stop";
    if (t === "pumped") return "Water Drawn Stop";
    if (t === "volumetric" || t === "weight") return "Weight Stop";
    if (t === "pressure") return "Pressure Stop";
    if (t === "flow") return "Flow Stop";
    
    // Fallback
    return t.charAt(0).toUpperCase() + t.slice(1) + " Stop";
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
        globalScaleLost = gSamples.some(s => 
            s.systemInfo && s.systemInfo.bluetoothScaleConnected === false
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
    
    // Variables to calculate global average delay for UI
    let cumulativeDelaySum = 0;
    let phasesWithHits = 0;

    // Tolerances
    const TOL_PRESSURE = 0.15;
    const TOL_FLOW = 0.3;
    
    let scaleConnectionBrokenPermanently = false;
    
    sortedPhaseKeys.forEach(phaseNum => {
        const samples = phases[phaseNum];
        const pStart = (samples[0].t - globalStartTime) / 1000;
        const pEnd = (samples[samples.length - 1].t - globalStartTime) / 1000;
        const duration = pEnd - pStart;
        
        const isLastPhase = (phaseNum === lastPhaseKey);
        
        const rawName = phaseNameMap[phaseNum];
        const displayName = rawName ? rawName : `Phase ${phaseNum}`;
        
        // System Info
        const lastSampleInPhase = samples[samples.length - 1];
        const sysInfo = lastSampleInPhase.systemInfo || {};

        let scaleLostInThisPhase = false;
        if (isBrewByWeight) {
            scaleLostInThisPhase = samples.some(s => 
                s.systemInfo && s.systemInfo.bluetoothScaleConnected === false
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
            const cleanName = rawName ? rawName.trim().toLowerCase() : "";
            profilePhase = profileData.phases.find(p => 
                p.name.trim().toLowerCase() === cleanName
            );
            
            if (profilePhase) {
                const profDur = profilePhase.duration;
                
                // Time Limit Check (Always runs first)
                if (Math.abs(duration - profDur) < 0.5 || duration >= profDur) {
                    exitReason = "Time Limit";
                    exitType = "duration";
                }
                
                // Check target-based exits
                // If Auto-Adjust is ON: Loop delays from 0 to 3000ms simultaneously
                // If Auto-Adjust is OFF: Run once with manual settings
                if (profilePhase.targets && (!exitType || duration < (profDur - 0.5))) {
                    
                    const steps = isAutoAdjusted ? 31 : 1; // 0..3000 (31 steps) or 1 step
                    let foundMatch = false;

                    for (let step = 0; step < steps; step++) {
                        // In Auto mode: scale & sensor increase together (0, 100, 200...)
                        // In Manual mode: use specific settings
                        const currentDelay = isAutoAdjusted ? (step * 100) : null;
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
                        const nextPNum = parseInt(phaseNum) + 1;
                        if (phases[nextPNum] && phases[nextPNum].length > 0) {
                            nextPhaseFirstSample = phases[nextPNum][0];
                        }
                        
                        // Prediction Logic
                        let predictedW = lastW;
                        let currentRate = (lastVF !== undefined) ? lastVF : lastF;
                        
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
                            predictedP = lastP + (slopeP * (tSensorDelay / 1000.0));
                            predictedF = lastF + (slopeF * (tSensorDelay / 1000.0));
                        }

                        // Target Logic
                        let hitTargets = [];
                        for (let tgt of profilePhase.targets) {
                            if ((tgt.type === 'volumetric' || tgt.type === 'weight') && 
                                scaleConnectionBrokenPermanently) continue;
                            
                            let measured = 0;
                            let checkValue = 0;
                            let hit = false;
                            let tolerance = 0;
                            
                            if (tgt.type === 'pressure') {
                                measured = lastP;
                                checkValue = (tgt.operator === 'gte' || tgt.operator === 'lte') ? predictedP : lastP;
                                tolerance = TOL_PRESSURE;
                            } else if (tgt.type === 'flow') {
                                measured = lastF;
                                checkValue = (tgt.operator === 'gte' || tgt.operator === 'lte') ? predictedF : lastF;
                                tolerance = TOL_FLOW;
                            } else if (tgt.type === 'volumetric' || tgt.type === 'weight') {
                                measured = lastW;
                                checkValue = (tgt.operator === 'gte') ? predictedW : lastW;
                            } else if (tgt.type === 'pumped') {
                                measured = wPumped;
                                checkValue = (tgt.operator === 'gte') ? predictedPumped : wPumped;
                            }
                            
                            if (tgt.operator === 'gte' && measured >= tgt.value) hit = true;
                            if (tgt.operator === 'lte' && measured <= tgt.value) hit = true;
                            
                            if (!hit) {
                                if (tgt.operator === 'gte' && checkValue >= tgt.value) hit = true;
                                if (tgt.operator === 'lte' && checkValue <= tgt.value) hit = true;
                            }
                            
                            if (!hit && tolerance > 0) {
                                if (tgt.operator === 'gte' && measured >= tgt.value - tolerance) hit = true;
                                if (tgt.operator === 'lte' && measured <= tgt.value + tolerance) hit = true;
                            }
                            
                            if (!hit && nextPhaseFirstSample) {
                                if (tgt.type === 'pressure' && tgt.operator === 'gte' && nextPhaseFirstSample.cp >= tgt.value) hit = true;
                                if (tgt.type === 'flow' && tgt.operator === 'gte' && nextPhaseFirstSample.fl >= tgt.value) hit = true;
                                if ((tgt.type === 'weight' || tgt.type === 'volumetric') && tgt.operator === 'gte' && nextPhaseFirstSample.v >= tgt.value) hit = true;
                            }
                            
                            if (hit) hitTargets.push(tgt);
                        }

                        // Did we find a hit in this step?
                        if (hitTargets.length > 0) {
                            hitTargets.sort((a, b) => {
                                const getScore = (type) => {
                                    if (type === 'flow') return 1;
                                    if (type === 'weight' || type === 'volumetric') return 2;
                                    if (type === 'pressure') return 3;
                                    return 4;
                                };
                                return getScore(a.type) - getScore(b.type);
                            });
                            
                            const bestMatch = hitTargets[0];
                            exitReason = formatStopReason(bestMatch.type);
                            exitType = bestMatch.type;
                            finalPredictedWeight = predictedW; // Store the prediction that worked
                            
                            if (isAutoAdjusted) {
                                cumulativeDelaySum += currentDelay;
                                phasesWithHits++;
                            }
                            foundMatch = true;
                            break; // Stop loop, we found the lowest delay match
                        }
                    } // End delay loop

                    // --- FALLBACK: LAST PHASE SPECIAL LOGIC ---
                    // If no match found in loop, AND it's last phase, AND auto enabled:
                    // Try to calculate exactly what weight delay was needed.
                    if (!foundMatch && isLastPhase && isAutoAdjusted) {
                        // We iterate targets again to see if a weight target was the goal
                        const weightTarget = profilePhase.targets.find(t => t.type === 'weight' || t.type === 'volumetric');
                        if (weightTarget) {
                             const lastW = samples[samples.length - 1].v;
                             const currentRate = samples[samples.length - 1].vf || samples[samples.length - 1].fl;
                             const weightDiff = weightTarget.value - lastW;
                             
                             if (currentRate > 0.1) {
                                 const timeToTarget = weightDiff / currentRate;
                                 const requiredDelayMs = timeToTarget * 1000;
                                 
                                 // Allow plausible delay (0-4000ms)
                                 if (requiredDelayMs >= 0 && requiredDelayMs <= 4000) {
                                     exitReason = formatStopReason(weightTarget.type);
                                     exitType = weightTarget.type;
                                     finalPredictedWeight = weightTarget.value;
                                     
                                     // Add this "found" delay to the average
                                     cumulativeDelaySum += requiredDelayMs;
                                     phasesWithHits++;
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
            displayName: displayName,
            start: pStart,
            end: pEnd,
            duration: duration,
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
                sys_ext: sysInfo.extendedRecording
            },
            exit: {
                reason: exitReason,
                type: exitType
            },
            profilePhase: profilePhase,
            scaleLost: scaleLostInThisPhase,
            scalePermanentlyLost: scaleConnectionBrokenPermanently,
            prediction: {
                finalWeight: finalPredictedWeight
            }
        });
    });
    
    // Calculate Average Delay
    let avgDelay = 0;
    if (isAutoAdjusted && phasesWithHits > 0) {
        // Round to nearest 50ms for cleaner UI
        avgDelay = Math.round((cumulativeDelaySum / phasesWithHits) / 50) * 50;
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
        sys_ext: finalSysInfo.extendedRecording
    };
    
    return {
        isBrewByWeight,
        globalScaleLost,
        isAutoAdjusted,
        // RETURN USED SETTINGS FOR UI (Average if auto, otherwise manual)
        usedSettings: {
            scaleDelayMs: isAutoAdjusted ? avgDelay : scaleDelayMs,
            sensorDelayMs: isAutoAdjusted ? avgDelay : sensorDelayMs
        },
        phases: analyzedPhases,
        total: totalStats,
        rawSamples: gSamples,
        startTime: globalStartTime
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
    // Legacy support or initial detection
    // For consistency, we can just run the main calculation and return the average it found
    // But since this function is usually called separately, we can replicate the logic simplified 
    // or just return the result of calculateShotMetrics().
    
    // To avoid circular dependencies or overhead, we just return the manual delay with auto=true flag
    // and let the main analysis handle the fine-tuning per phase.
    
    // Better yet: Perform a quick check using calculateShotMetrics logic
    const results = calculateShotMetrics(shotData, profileData, { 
        scaleDelayMs: manualDelay, 
        sensorDelayMs: manualDelay, 
        isAutoAdjusted: true 
    });
    
    if (results && results.usedSettings) {
        return { delay: results.usedSettings.scaleDelayMs, auto: true };
    }
    
    return { delay: manualDelay, auto: false };
}