export const LAST_PHASE_UNDERSHOOT_MIN_G = 2;
export const LAST_PHASE_UNDERSHOOT_MAX_G = 6;
export const LAST_PHASE_OVERSHOOT_MAX_G = 4;
export const LAST_PHASE_ESTIMATED_DELAY_MAX_MS = 4000;

export function isAnalyzerDebugEnabled() {
  if (typeof globalThis === 'undefined') return false;
  try {
    return (
      globalThis.__SHOT_ANALYZER_DEBUG__ === true ||
      globalThis.localStorage?.getItem('shotAnalyzerDebug') === '1'
    );
  } catch {
    return globalThis.__SHOT_ANALYZER_DEBUG__ === true;
  }
}

export function analyzerDebug(enabled, message, payload = null) {
  if (!enabled) return;
  if (payload == null) {
    console.debug(`[ShotAnalyzer] ${message}`);
  } else {
    console.debug(`[ShotAnalyzer] ${message}`, payload);
  }
}

export function getDelayReviewMessage(phaseNumber, delayMs) {
  if (!phaseNumber) return null;
  if (delayMs != null) {
    return `Unusually high inferred delay in Phase ${phaseNumber} (${delayMs} ms).`;
  }
  return `Unusually high inferred delay in Phase ${phaseNumber}.`;
}

export function createDelayTotals() {
  return {
    sumScaleDelay: 0,
    countScaleHits: 0,
    sumSensorDelay: 0,
    countSensorHits: 0,
  };
}

export function addDelayHit(delayTotals, exitType, delayMs) {
  if (exitType === 'weight' || exitType === 'volumetric') {
    delayTotals.sumScaleDelay += delayMs;
    delayTotals.countScaleHits++;
    return;
  }
  delayTotals.sumSensorDelay += delayMs;
  delayTotals.countSensorHits++;
}

export function createPhaseDelayTracker(isLastPhase) {
  const state = {
    highScaleDelay: false,
    estimatedScaleDelayMs: null,
    delayReviewHint: false,
    delayReviewReason: null,
    delayReviewMs: null,
  };

  const setEstimatedScaleDelay = delayMs => {
    if (delayMs == null || !Number.isFinite(delayMs) || delayMs < 0) return;
    const roundedDelay = Math.round(delayMs);
    state.estimatedScaleDelayMs =
      state.estimatedScaleDelayMs == null
        ? roundedDelay
        : Math.max(state.estimatedScaleDelayMs, roundedDelay);
    if (isLastPhase && roundedDelay > 2000) {
      state.highScaleDelay = true;
    }
  };

  const setPhaseDelayReviewHint = (delayMs, reason) => {
    if (delayMs == null || !Number.isFinite(delayMs) || delayMs < 1000) return;
    const roundedDelay = Math.round(delayMs);
    state.delayReviewHint = true;
    state.delayReviewReason = reason || 'manual-check';
    state.delayReviewMs =
      state.delayReviewMs == null ? roundedDelay : Math.max(state.delayReviewMs, roundedDelay);
  };

  return { state, setEstimatedScaleDelay, setPhaseDelayReviewHint };
}
