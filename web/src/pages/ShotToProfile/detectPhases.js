const SMOOTH_WINDOW = 8;   // ~2 s rolling average at 250 ms/sample
const MIN_GAP = 20;        // ~5 s minimum between boundaries
const SUSTAIN = 3;         // derivative sign must hold for this many samples
export const MAX_BOUNDARIES = 5;  // allow up to 6 phases (5 split points)

/**
 * @param {Array} samples - parsed ShotLogSample array (fields: cp, fl, t)
 * @param {boolean} isFlowTargeted - true when the shot used a flow target
 * @returns {number[]} sorted sample indices where phase boundaries are placed
 */
export function detectPhases(samples, isFlowTargeted = false) {
  if (samples.length < SMOOTH_WINDOW * 2) return [];

  const raw = samples.map(s => (isFlowTargeted ? s.fl : s.cp));

  // Rolling average smoothing
  const smoothed = raw.map((_, i) => {
    const lo = Math.max(0, i - SMOOTH_WINDOW);
    const hi = Math.min(raw.length, i + SMOOTH_WINDOW + 1);
    const slice = raw.slice(lo, hi);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });

  // First-order derivative
  const deriv = smoothed.map((v, i) => (i === 0 ? 0 : v - smoothed[i - 1]));

  // Detect sustained sign changes and ramp-to-plateau transitions
  const candidates = [];
  let prevSign = Math.sign(deriv[1]) || 1;
  let run = 0;
  let runStart = 1;
  let runPeakMag = 0;
  let hadSignChange = false;
  // Index where current plateau began; -1 means not in a plateau.
  let plateauStart = -1;

  for (let i = 1; i < deriv.length; i++) {
    const s = Math.sign(deriv[i]);
    const mag = Math.abs(deriv[i]);
    if (s !== 0 && s === prevSign) {
      run++;
      plateauStart = -1; // back in a directional run, clear any pending plateau
      if (mag > runPeakMag) runPeakMag = mag;
    } else {
      if (s !== 0 && s !== prevSign && run >= SUSTAIN) {
        // True sign flip (positive ↔ negative) after a sustained run
        candidates.push({ index: i, magnitude: mag });
        hadSignChange = true;
      } else if (s === 0 && plateauStart === -1 && run >= SUSTAIN) {
        // Derivative dropped to zero after a sustained directional run — ramp-to-hold boundary
        plateauStart = i;
      }
      if (s !== 0) {
        // Emit a pending plateau boundary before starting the new directional run.
        // Without this, a rise-plateau-fall sequence loses the ramp-to-hold boundary
        // because plateauStart is cleared by the time the fall is processed.
        if (plateauStart !== -1) {
          candidates.push({ index: plateauStart, magnitude: runPeakMag });
        }
        prevSign = s;
        runStart = i;
        run = 1;
        runPeakMag = mag;
        plateauStart = -1;
      }
    }
  }

  // Ramp ended in a plateau: boundary is at plateau entry, not at runStart
  if (plateauStart !== -1) {
    candidates.push({ index: plateauStart, magnitude: runPeakMag });
  }
  // Capture final sustained directional run only when a prior sign change confirmed it.
  // Use peak magnitude within the run — deriv[runStart] is near-zero at a sign flip.
  if (hadSignChange && run >= SUSTAIN) {
    candidates.push({ index: runStart, magnitude: runPeakMag });
  }

  // Merge boundaries closer than MIN_GAP (keep larger magnitude)
  const merged = [];
  for (const c of candidates) {
    if (merged.length === 0 || c.index - merged[merged.length - 1].index >= MIN_GAP) {
      merged.push({ ...c });
    } else if (c.magnitude > merged[merged.length - 1].magnitude) {
      merged[merged.length - 1] = { ...c };
    }
  }

  // Keep at most MAX_BOUNDARIES by magnitude, then re-sort by position
  return merged
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, MAX_BOUNDARIES)
    .sort((a, b) => a.index - b.index)
    .map(c => c.index);
}
