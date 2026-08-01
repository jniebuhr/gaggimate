export const PHASE_EXIT_REASON = Object.freeze({
  UNKNOWN: 0,
  TARGET_VOLUMETRIC: 1,
  TARGET_PRESSURE: 2,
  TARGET_FLOW: 3,
  TARGET_PUMPED: 4,
  DURATION: 5,
  SAFETY: 6,
  ABORTED: 7,
});

const EXIT_REASON_META = Object.freeze({
  [PHASE_EXIT_REASON.UNKNOWN]: {
    label: 'Unknown',
    stopReason: '',
    exitType: null,
  },
  [PHASE_EXIT_REASON.TARGET_VOLUMETRIC]: {
    label: 'Volumetric target',
    stopReason: 'Weight Stop',
    exitType: 'volumetric',
  },
  [PHASE_EXIT_REASON.TARGET_PRESSURE]: {
    label: 'Pressure target',
    stopReason: 'Pressure Stop',
    exitType: 'pressure',
  },
  [PHASE_EXIT_REASON.TARGET_FLOW]: {
    label: 'Flow target',
    stopReason: 'Pump Flow Stop',
    exitType: 'flow',
  },
  [PHASE_EXIT_REASON.TARGET_PUMPED]: {
    label: 'Pumped-water target',
    stopReason: 'Pumped Water Stop',
    exitType: 'pumped',
  },
  [PHASE_EXIT_REASON.DURATION]: {
    label: 'Duration',
    stopReason: 'Time Stop',
    exitType: 'duration',
  },
  [PHASE_EXIT_REASON.SAFETY]: {
    label: 'Safety timeout',
    stopReason: 'Safety Timeout',
    exitType: 'safety',
  },
  [PHASE_EXIT_REASON.ABORTED]: {
    label: 'Manually stopped',
    stopReason: 'Manually Stopped',
    exitType: 'manual',
  },
});

export function normalizePhaseExitReasonCode(value) {
  const code = Number(value);
  return Number.isInteger(code) && EXIT_REASON_META[code] ? code : PHASE_EXIT_REASON.UNKNOWN;
}

export function getPhaseExitReasonMeta(value) {
  return EXIT_REASON_META[normalizePhaseExitReasonCode(value)];
}

export function isKnownPhaseExitReason(value) {
  return normalizePhaseExitReasonCode(value) !== PHASE_EXIT_REASON.UNKNOWN;
}

export function isSafetyExitReason(value) {
  return normalizePhaseExitReasonCode(value) === PHASE_EXIT_REASON.SAFETY;
}

export function getBrewModeLabel(isBrewByWeight) {
  return isBrewByWeight ? 'Brewed by Weight' : 'Brewed by Time';
}

export function getBrewCompletionLabel(isBrewByWeight, finalExitReason) {
  const code = normalizePhaseExitReasonCode(finalExitReason);
  if (code === PHASE_EXIT_REASON.ABORTED) return 'Stopped: Manually';
  if (code === PHASE_EXIT_REASON.SAFETY) return 'Stopped: Safety timeout';
  return getBrewModeLabel(isBrewByWeight);
}

export function buildRecordedExitReasonByPhase(shotData) {
  const reasonByPhase = new Map();
  const transitions = Array.isArray(shotData?.phaseTransitions) ? shotData.phaseTransitions : [];

  // A transition stores why the phase immediately before it ended.
  for (let index = 1; index < transitions.length; index += 1) {
    const endedPhaseNumber = transitions[index - 1]?.phaseNumber;
    if (endedPhaseNumber == null) continue;
    reasonByPhase.set(
      String(endedPhaseNumber),
      normalizePhaseExitReasonCode(transitions[index]?.transitionReason),
    );
  }

  const samples = Array.isArray(shotData?.samples) ? shotData.samples : [];
  const finalPhaseNumber = samples.at(-1)?.phaseNumber ?? transitions.at(-1)?.phaseNumber;
  if (finalPhaseNumber != null) {
    reasonByPhase.set(
      String(finalPhaseNumber),
      normalizePhaseExitReasonCode(shotData?.finalExitReason),
    );
  }

  return reasonByPhase;
}
