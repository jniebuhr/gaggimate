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
    // Group samples by phase number
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
    
    // --- 2. BREW MODE DETECTION ---
    // Check if shot was started in volumetric (weight-based) mode
    const startSysInfo = gSamples[0].systemInfo || {};
    const isBrewByWeight = startSysInfo.shotStartedVolumetric === true;
    
    // Track if Bluetooth scale connection was lost
    let globalScaleLost = false;
    if (isBrewByWeight) {
        globalScaleLost = gSamples.some(s => 
            s.systemInfo && s.systemInfo.bluetoothScaleConnected === false
        );
    }
    
    // --- 3. GLOBAL TOTALS ---
    let gDuration = (gSamples[gSamples.length - 1].t - gSamples[0].t) / 1000;
    
    // Total water pumped (integrate flow over time)
    let gWater = 0;
    for (let i = 1; i < gSamples.length; i++) {
        const dt = (gSamples[i].t - gSamples[i - 1].t) / 1000;
        gWater += gSamples[i].fl * dt;
    }
    
    // Final weight
    let gWeight = gSamples[gSamples.length - 1].v;
    
    // --- 4. PHASE-BY-PHASE ANALYSIS ---
    const analyzedPhases = [];
    
    // Tolerances for target matching
    const TOL_PRESSURE = 0.15; // ±0.15 bar
    const TOL_FLOW = 0.3;      // ±0.3 ml/s
    
    let scaleConnectionBrokenPermanently = false;
    
    Object.keys(phases).sort((a, b) => a - b).forEach(phaseNum => {
        const samples = phases[phaseNum];
        const pStart = (samples[0].t - globalStartTime) / 1000;
        const pEnd = (samples[samples.length - 1].t - globalStartTime) / 1000;
        const duration = pEnd - pStart;
        
        const rawName = phaseNameMap[phaseNum];
        const displayName = rawName ? rawName : `Phase ${phaseNum}`;
        
        // --- System Info Extraction (Direct Access) ---
        // Grab the last sample of the phase to determine the state
        const lastSampleInPhase = samples[samples.length - 1];
        const sysInfo = lastSampleInPhase.systemInfo || {};

        // Check scale connection for this phase
        let scaleLostInThisPhase = false;
        if (isBrewByWeight) {
            scaleLostInThisPhase = samples.some(s => 
                s.systemInfo && s.systemInfo.bluetoothScaleConnected === false
            );
        }
        if (scaleLostInThisPhase) {
            scaleConnectionBrokenPermanently = true;
        }
        
        // --- EXIT REASON DETECTION ---
        let exitReason = null;
        let exitType = null;
        let finalPredictedWeight = null;
        let profilePhase = null;
        
        // Match with profile phase if available
        if (profileData && profileData.phases) {
            const cleanName = rawName ? rawName.trim().toLowerCase() : "";
            profilePhase = profileData.phases.find(p => 
                p.name.trim().toLowerCase() === cleanName
            );
            
            if (profilePhase) {
                const profDur = profilePhase.duration;
                
                // Check if phase ended due to time limit
                if (Math.abs(duration - profDur) < 0.5 || duration >= profDur) {
                    exitReason = "Time Limit";
                    exitType = "duration";
                }
                
                // Check target-based exits
                if (profilePhase.targets && (!exitType || duration < (profDur - 0.5))) {
                    // Calculate phase water pumped
                    let wPumped = 0;
                    for (let i = 1; i < samples.length; i++) {
                        const dt = (samples[i].t - samples[i - 1].t) / 1000;
                        wPumped += samples[i].fl * dt;
                    }
                    
                    // Last sample values
                    const lastSample = samples[samples.length - 1];
                    const prevSample = samples.length > 1 ? samples[samples.length - 2] : lastSample;
                    const dt = (lastSample.t - prevSample.t) / 1000.0;
                    
                    const lastP = lastSample.cp;
                    const lastF = lastSample.fl;
                    const lastW = lastSample.v;
                    const lastVF = lastSample.vf; // Volumetric flow (if available)
                    
                    // Look ahead to next phase first sample
                    let nextPhaseFirstSample = null;
                    const nextPNum = parseInt(phaseNum) + 1;
                    if (phases[nextPNum] && phases[nextPNum].length > 0) {
                        nextPhaseFirstSample = phases[nextPNum][0];
                    }
                    
                    // --- PREDICTIVE CALCULATIONS ---
                    
                    // Weight prediction (with scale delay compensation)
                    let predictedW = lastW;
                    if (lastW > 0.1 && !scaleConnectionBrokenPermanently) {
                        let currentRate = (lastVF !== undefined) ? lastVF : lastF;
                        let predictedAdded = currentRate * (scaleDelayMs / 1000.0);
                        
                        // Clamp prediction
                        if (predictedAdded < 0) predictedAdded = 0;
                        if (predictedAdded > 8.0) predictedAdded = 8.0;
                        
                        predictedW = lastW + predictedAdded;
                    }
                    finalPredictedWeight = predictedW;
                    
                    // Water pumped prediction
                    let predictedPumped = wPumped;
                    if (lastF > 0) {
                        predictedPumped += lastF * (sensorDelayMs / 1000.0);
                    }
                    
                    // Pressure and Flow predictions (linear extrapolation)
                    let predictedP = lastP;
                    let predictedF = lastF;
                    if (dt > 0) {
                        const slopeP = (lastP - prevSample.cp) / dt;
                        const slopeF = (lastF - prevSample.fl) / dt;
                        
                        predictedP = lastP + (slopeP * (sensorDelayMs / 1000.0));
                        predictedF = lastF + (slopeF * (sensorDelayMs / 1000.0));
                    }
                    
                    // --- TARGET MATCHING LOGIC ---
                    let hitTargets = [];
                    
                    for (let tgt of profilePhase.targets) {
                        // Skip weight targets if scale lost
                        if ((tgt.type === 'volumetric' || tgt.type === 'weight') && 
                            scaleConnectionBrokenPermanently) {
                            continue;
                        }
                        
                        let measured = 0;
                        let checkValue = 0;
                        let hit = false;
                        let tolerance = 0;
                        
                        // Select appropriate values based on target type
                        if (tgt.type === 'pressure') {
                            measured = lastP;
                            checkValue = (tgt.operator === 'gte' || tgt.operator === 'lte') 
                                ? predictedP : lastP;
                            tolerance = TOL_PRESSURE;
                        } else if (tgt.type === 'flow') {
                            measured = lastF;
                            checkValue = (tgt.operator === 'gte' || tgt.operator === 'lte') 
                                ? predictedF : lastF;
                            tolerance = TOL_FLOW;
                        } else if (tgt.type === 'volumetric' || tgt.type === 'weight') {
                            measured = lastW;
                            checkValue = (tgt.operator === 'gte') ? predictedW : lastW;
                        } else if (tgt.type === 'pumped') {
                            measured = wPumped;
                            checkValue = (tgt.operator === 'gte') ? predictedPumped : wPumped;
                        }
                        
                        // Check if target was hit (measured value)
                        if (tgt.operator === 'gte' && measured >= tgt.value) hit = true;
                        if (tgt.operator === 'lte' && measured <= tgt.value) hit = true;
                        
                        // Check predicted value if not hit yet
                        if (!hit) {
                            if (tgt.operator === 'gte' && checkValue >= tgt.value) hit = true;
                            if (tgt.operator === 'lte' && checkValue <= tgt.value) hit = true;
                        }
                        
                        // Apply tolerance for close misses
                        if (!hit && tolerance > 0) {
                            if (tgt.operator === 'gte' && measured >= tgt.value - tolerance) hit = true;
                            if (tgt.operator === 'lte' && measured <= tgt.value + tolerance) hit = true;
                        }
                        
                        // Check next phase's first sample (transition overshoot)
                        if (!hit && nextPhaseFirstSample) {
                            if (tgt.type === 'pressure' && tgt.operator === 'gte' && 
                                nextPhaseFirstSample.cp >= tgt.value) {
                                hit = true;
                            }
                            if (tgt.type === 'flow' && tgt.operator === 'gte' && 
                                nextPhaseFirstSample.fl >= tgt.value) {
                                hit = true;
                            }
                            // Look-ahead for Weight/Volumetric
                            if ((tgt.type === 'weight' || tgt.type === 'volumetric') && tgt.operator === 'gte' && 
                                nextPhaseFirstSample.v >= tgt.value) {
                                hit = true;
                            }
                        }
                        
                        if (hit) hitTargets.push(tgt);
                    }
                    
                    // Select best matching target (priority: flow > weight > pressure)
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
                p: getMetricStats(samples, 'cp'),   // Pressure
                tp: getMetricStats(samples, 'tp'),  // Target Pressure
                f: getMetricStats(samples, 'fl'),   // Flow
                pf: getMetricStats(samples, 'pf'),  // Puck Flow
                tf: getMetricStats(samples, 'tf'),  // Target Flow
                t: getMetricStats(samples, 'ct'),   // Temperature
                tt: getMetricStats(samples, 'tt'),  // Target Temp
                w: getMetricStats(samples, 'v'),    // Weight
                
                // --- System Info Flags (Direct Access from last sample) ---
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
    
    // --- 5. TOTAL STATS ---
    // Extract system info from the very last sample of the shot
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
        
        // System Info Totals
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
        phases: analyzedPhases,
        total: totalStats,
        rawSamples: gSamples,
        startTime: globalStartTime
    };
}

/**
 * Auto-Delay Detection
 * Attempts to find optimal sensor delay by testing target hit accuracy
 * * @param {Object} shotData - Shot data
 * @param {Object|null} profileData - Profile data with targets
 * @param {number} manualDelay - User-configured delay (fallback)
 * @returns {Object} { delay: number, auto: boolean }
 */
export function detectAutoDelay(shotData, profileData, manualDelay) {
    if (!profileData || !profileData.phases) {
        return { delay: manualDelay, auto: false };
    }

    // Guard against missing or empty samples
    if (!shotData || !Array.isArray(shotData.samples) || shotData.samples.length === 0) {
        return { delay: manualDelay, auto: false };
    }
    
    // Group samples by phase
    const phases = {};
    const phaseNameMap = {};
    
    if (shotData.phaseTransitions) {
        shotData.phaseTransitions.forEach(pt => {
            phaseNameMap[pt.phaseNumber] = pt.phaseName;
        });
    }
    
    shotData.samples.forEach(sample => {
        if (!phases[sample.phaseNumber]) phases[sample.phaseNumber] = [];
        phases[sample.phaseNumber].push(sample);
    });
    
    /**
     * Test a specific delay value and count how many targets it hits
     */
    const checkDelay = (delayVal) => {
        let hitCount = 0;
        
        Object.keys(phases).forEach(phaseNum => {
            const samples = phases[phaseNum];
            const rawName = phaseNameMap[phaseNum];
            const cleanName = rawName ? rawName.trim().toLowerCase() : "";
            
            const profilePhase = profileData.phases.find(p => 
                p.name.trim().toLowerCase() === cleanName
            );
            
            if (profilePhase && profilePhase.targets) {
                // Calculate water pumped
                let wPumped = 0;
                for (let i = 1; i < samples.length; i++) {
                    const dt = (samples[i].t - samples[i - 1].t) / 1000;
                    wPumped += samples[i].fl * dt;
                }
                
                const lastS = samples[samples.length - 1];
                const prevS = samples.length > 1 ? samples[samples.length - 2] : lastS;
                const dt = (lastS.t - prevS.t) / 1000.0;
                
                // Predictions with this delay
                let predPumped = wPumped;
                if (lastS.fl > 0) {
                    predPumped += lastS.fl * (delayVal / 1000.0);
                }
                
                let predP = lastS.cp;
                let predF = lastS.fl;
                if (dt > 0) {
                    const slopeP = (lastS.cp - prevS.cp) / dt;
                    const slopeF = (lastS.fl - prevS.fl) / dt;
                    predP = lastS.cp + (slopeP * (delayVal / 1000.0));
                    predF = lastS.fl + (slopeF * (delayVal / 1000.0));
                }
                
                // Check each target
                for (let tgt of profilePhase.targets) {
                    // Skip weight-based targets
                    if (tgt.type === 'volumetric' || tgt.type === 'weight') continue;
                    
                    let measured = 0;
                    let checkValue = 0;
                    
                    if (tgt.type === 'pressure') {
                        measured = lastS.cp;
                        checkValue = predP;
                    } else if (tgt.type === 'flow') {
                        measured = lastS.fl;
                        checkValue = predF;
                    } else if (tgt.type === 'pumped') {
                        measured = wPumped;
                        checkValue = predPumped;
                    }
                    
                    let hit = false;
                    if ((tgt.operator === 'gte' && (measured >= tgt.value || checkValue >= tgt.value)) ||
                        (tgt.operator === 'lte' && (measured <= tgt.value || checkValue <= tgt.value))) {
                        hit = true;
                    }
                    
                    if (hit) {
                        hitCount++;
                        break; // Only count one hit per phase
                    }
                }
            }
        });
        
        return hitCount;
    };
    
    // Test manual delay vs higher delay
    const hitsNormal = checkDelay(manualDelay);
    const hitsHigh = checkDelay(800);
    
    if (hitsHigh > hitsNormal) {
        return { delay: 800, auto: true };
    }
    
    return { delay: manualDelay, auto: false };
}