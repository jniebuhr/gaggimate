export const MODE_STANDBY = 0;
export const MODE_BREW = 1;
export const MODE_STEAM = 2;
export const MODE_WATER = 3;
export const MODE_GRIND = 4;
export const TEMP_MIN = 0;
export const TEMP_MAX = 105;

const MIN_STEAM_TARGET = 120;
const DEFAULT_STEAM_TARGET = 150;

function finiteOrZero(value) {
  return Number.isFinite(value) ? value : 0;
}

function fractionBetween(value, min, max) {
  if (!Number.isFinite(max) || max <= min) return 0;
  return (finiteOrZero(value) - min) / (max - min);
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

export function getProcessKindForMode(mode) {
  if (mode === MODE_BREW) return 'brew';
  if (mode === MODE_STEAM) return 'steam';
  if (mode === MODE_WATER) return 'water';
  if (mode === MODE_GRIND) return 'grind';
  return null;
}

export function getPrimaryActionState({ active, finished, mode }) {
  const isSteamMode = mode === MODE_STEAM;

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
    label: isSteamMode ? 'START STEAM' : 'START SHOT',
    accent: isSteamMode ? 'var(--dm-warn)' : 'var(--dm-accent)',
    action: 'start-process',
    processKind: getProcessKindForMode(mode),
  };
}
