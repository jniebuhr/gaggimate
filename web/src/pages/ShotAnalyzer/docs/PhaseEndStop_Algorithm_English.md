# PhaseEndStop_Algorithm_English  
##   
## Simplified Explanation:  
### This is how the stops are determined:  
The following steps are executed for each phase. The goal is to determine which parameter from the profile was responsible as the target value for ending the phase. At the end of each step, the process moves to the next one if no parameter could be assigned. Time-based stops are checked first, as they are static.  
1. In Step 1, it is checked whether the values at the end of the phase match the target. If this is the case, the parameter has been found.   
2. In Step 2, the values from the first sample of the following phase are considered. Based on the direction of the value change, it is decided whether the actual value can be used or whether a calculated prediction must be used. The values resulting from this decision are used as the comparison source and compared with the target values.   
3. In Step 3, Step 2 is repeated with the second sample of the following phase. If the correct target value is found here, the parameter is set and it is indicated that a review may be necessary.   
4. In Step 4, the last few samples are used to perform a linear extrapolation. Using this, the algorithm looks up to 4 seconds into the future starting from the end of the phase. A potentially excessive delay is indicated.  
*Note: We only examine the last phase value, the first phase value of the new phase, and the second phase value of the new phase, and calculate any remaining stop reasons solely based on these. If we were to use additional values from the new phase, the actual stop reason might be overlooked, as the values may already have changed too much due to the settings of the new phase. At the three points in time at which we examine the data, the stop reason must have occurred in any case (except for the Predictive Scale Delay function, which would have occurred earlier). Therefore, for stop detection it is more reasonable to continue working only with these three points in time if no stop reason has been found up to that point.*  
  
  
## Technical Explanation:  
### Mode: Auto, 4-step check (isAutoAdjusted = true)   
- Preparation: Check time-based stops first, as they do not require special logic. Also no tolerance calculation, since shot.json already uses rounded values.  
- Step 1: Check values at stop time (Delay = 0 ms) Take the last sample of the current phase (for the last phase: last non-extended sample) Check all targets against the current values (cp for pressure, fl for flow, v for weight, cumulative pumped volume) If match: set exitReason, estimatedDelay = 0  
- Step 2: Check first sample of next phase (Delay = 1 × sampleInterval) Take the first sample of the following phase Continue cumulative values (do not reset): pumped: previous cumulative value + nextSample.fl * dt weight: nextSample.v directly (is global)  
    - Direction check (for all target types including pressure/flow): For gte targets: nextValue >= currentValue → direction correct For lte targets: nextValue <= currentValue → direction correct  
    - If direction is correct: check actual value against target If direction is not correct: use prediction: For weight: getRegressionWeightRate() × sampleInterval/1000 + last value For pressure/flow: slope from the last two phase samples × sampleInterval/1000 + last value For pumped: lastFlow * sampleInterval/1000 + cumulative value  
    - If match: set exitReason, estimatedDelay = sampleInterval  
- Step 3: Check second sample of next phase (Delay = 2 × sampleInterval) Identical to Step 2, but using the second sample of the next phase Direction check: comparison with the value from Step 2 (or prediction if Step 2 used prediction) Prediction uses 2 × sampleInterval as time horizon (from the last phase sample)  
    - If match: set exitReason, estimatedDelay = 2 × sampleInterval Set delayReviewHint → User receives “REVIEW PHASE N” badge  
- Step 4: Predictive Extrapolation (Fallback) If no match after Step 3: continue linear extrapolation Continue extrapolating in sampleInterval steps until target is reached Reasonable maximum: LAST_PHASE_ESTIMATED_DELAY_MAX_MS (4000 ms) Set delayReviewHint  
  
### Mode: Manual, Fixed Delay (isAutoAdjusted = false)  
- Take the last sample of the phase Predict using the user-entered scaleDelayMs / sensorDelayMs:  
- Weight: lastW + getRegressionWeightRate() × scaleDelay/1000 Pressure/Flow: lastValue + slope × sensorDelay/1000 Pumped: pumpedTotal + lastFlow × sensorDelay/1000  
- Check predicted values against targets If match: set exitReason  
  
### Special Logic  
- Last-phase fallback: overshoot/undershoot calculation   
- Last-phase weight cap: LAST_PHASE_OVERSHOOT_MAX_G   
- Scale-lost detection: weight targets are skipped if scale is lost   
- Brew-by-Time: duration >= profDur check   
- Extended-recording filtering: for the last phase, the last non-extended sample is used as the anchor point  
- SampleInterval: Read from shotData.sampleInterval, Fallback: 250 ms (default sampling rate)  
