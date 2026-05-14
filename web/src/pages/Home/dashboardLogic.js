export const MODE_STANDBY = 0;
export const MODE_BREW = 1;
export const MODE_STEAM = 2;
export const MODE_WATER = 3;
export const MODE_GRIND = 4;
export const MODE_MANUAL = 5;
export const TEMP_MIN = 0;
export const TEMP_MAX = 105;
export const MANUAL_TARGET_PRESSURE = 'pressure';
export const MANUAL_TARGET_FLOW = 'flow';
export const MANUAL_TEMP_MIN = 80;
export const MANUAL_TEMP_MAX = 105;
export const MANUAL_PRESSURE_MIN = 0;
export const MANUAL_PRESSURE_MAX = 12;
export const MANUAL_FLOW_MIN = 0;
export const MANUAL_FLOW_MAX = 6;

export const MODE_OPTIONS = [
  { id: MODE_STANDBY, name: 'STANDBY' },
  { id: MODE_BREW, name: 'BREW' },
  { id: MODE_STEAM, name: 'STEAM' },
  { id: MODE_WATER, name: 'WATER' },
  { id: MODE_MANUAL, name: 'MANUAL' },
  { id: MODE_GRIND, name: 'GRIND' },
];

const MIN_STEAM_TARGET = 120;
const DEFAULT_STEAM_TARGET = 150;

function finiteOrZero(value) {
  return Number.isFinite(value) ? value : 0;
}

function fractionBetween(value, min, max) {
  if (!Number.isFinite(max) || max <= min) return 0;
  return (finiteOrZero(value) - min) / (max - min);
}

function clampNumber(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
}

export function clampManualTemperature(value) {
  return clampNumber(value, MANUAL_TEMP_MIN, MANUAL_TEMP_MAX);
}

export function clampManualPressure(value) {
  return clampNumber(value, MANUAL_PRESSURE_MIN, MANUAL_PRESSURE_MAX);
}

export function clampManualFlow(value) {
  return clampNumber(value, MANUAL_FLOW_MIN, MANUAL_FLOW_MAX);
}

export function getManualControlLabels(targetType) {
  return targetType === MANUAL_TARGET_FLOW
    ? { pressure: 'PRESSURE LIMIT', flow: 'FLOW TARGET' }
    : { pressure: 'PRESSURE TARGET', flow: 'FLOW LIMIT' };
}

export function getSteamTarget(targetTemp) {
  return Number.isFinite(targetTemp) && targetTemp > MIN_STEAM_TARGET
    ? targetTemp
    : DEFAULT_STEAM_TARGET;
}

export function getTemperatureRingMetrics({ mode, tempVal, targetTemp }) {
  const ringMax = mode === MODE_STEAM ? getSteamTarget(targetTemp) : TEMP_MAX;
  const ringTarget = mode === MODE_STEAM ? ringMax : finiteOrZero(targetTemp);

  return {
    progressFraction: fractionBetween(tempVal, TEMP_MIN, ringMax),
    targetFraction: fractionBetween(ringTarget, TEMP_MIN, ringMax),
    color: mode === MODE_STEAM ? 'var(--dm-warn)' : 'var(--dm-accent)',
  };
}

export function getBoilerHeatingState({ mode, active, finished, targetTemp, tempVal }) {
  const isSteamMode = mode === MODE_STEAM;
  return (
    (mode === MODE_BREW || mode === MODE_STEAM || mode === MODE_WATER || mode === MODE_MANUAL) &&
    (!active || isSteamMode) &&
    (!finished || isSteamMode) &&
    targetTemp > 0 &&
    tempVal < targetTemp
  );
}

export function shouldSendManualUpdate({ active, isManualMode, partial }) {
  if (!isManualMode) return false;
  if (active) return true;
  return Object.prototype.hasOwnProperty.call(partial ?? {}, 'temperature');
}

export function shouldKeepManualDraftDirty({ active, partial }) {
  return !active && Object.keys(partial ?? {}).length > 0;
}

export function getAvailableModeOptions(isGrindAvailable = true, isManualAvailable = true) {
  return MODE_OPTIONS.filter(option => {
    if (option.id === MODE_GRIND) return isGrindAvailable;
    if (option.id === MODE_MANUAL) return isManualAvailable;
    return true;
  });
}

export function getProcessKindForMode(mode, isGrindAvailable = true, isManualAvailable = true) {
  if (mode === MODE_BREW) return 'brew';
  if (mode === MODE_STEAM) return 'steam';
  if (mode === MODE_WATER) return 'water';
  if (mode === MODE_MANUAL && isManualAvailable) return 'manual';
  if (mode === MODE_GRIND && isGrindAvailable) return 'grind';
  return null;
}

export function getPrimaryActionState({ active, finished, mode, isGrindAvailable = true, isManualAvailable = true }) {
  const isSteamMode = mode === MODE_STEAM;
  const isManualMode = mode === MODE_MANUAL;

  if (mode === MODE_GRIND && !isGrindAvailable) {
    return {
      label: 'GRIND UNAVAILABLE',
      accent: 'var(--dm-fg-dim)',
      action: 'noop',
      processKind: null,
    };
  }

  if (isManualMode && !isManualAvailable) {
    return {
      label: 'MANUAL UNAVAILABLE',
      accent: 'var(--dm-fg-dim)',
      action: 'noop',
      processKind: null,
    };
  }

  if (active && isManualMode) {
    return {
      label: 'STOP MANUAL',
      accent: 'var(--dm-accent)',
      action: 'deactivate',
      processKind: null,
    };
  }

  if (active && isSteamMode) {
    return {
      label: 'STOP STEAM',
      accent: 'var(--dm-warn)',
      action: 'change-mode',
      mode: MODE_STANDBY,
      processKind: null,
    };
  }

  if (active) {
    return {
      label: 'STOP SHOT',
      accent: 'var(--dm-accent)',
      action: 'deactivate',
    };
  }

  if (finished) {
    return {
      label: 'CLEAR',
      accent: isSteamMode ? 'var(--dm-warn)' : 'var(--dm-accent)',
      action: 'clear',
    };
  }

  return {
    label: isManualMode ? 'START MANUAL' : isSteamMode ? 'START STEAM' : 'START SHOT',
    accent: isSteamMode ? 'var(--dm-warn)' : 'var(--dm-accent)',
    action: 'start-process',
    processKind: getProcessKindForMode(mode, isGrindAvailable, isManualAvailable),
  };
}
