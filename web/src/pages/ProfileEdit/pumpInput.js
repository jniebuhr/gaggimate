import { isNumber } from 'chart.js/helpers';

export function getPumpMode(pump) {
  if (Number.isNaN(pump)) return 'power';
  if (isNumber(pump)) return pump === 0 ? 'off' : 'power';
  return pump.target;
}

export function getPumpPowerInputValue(pump) {
  if (Number.isNaN(pump)) return '';
  if (isNumber(pump)) return pump;
  return 100;
}

export function getPumpInputState(pump) {
  return {
    mode: getPumpMode(pump),
    power: getPumpPowerInputValue(pump),
    pressure: isPumpObject(pump) ? pump.pressure : 0,
    flow: isPumpObject(pump) ? pump.flow : 0,
  };
}

export function normalizePumpPower(pump) {
  if (Number.isNaN(pump)) return 100;
  if (!isNumber(pump)) return pump;
  return Math.min(100, Math.max(0, pump));
}

export function normalizeProfilePumpPowers(profile) {
  return {
    ...profile,
    phases: profile.phases.map(phase => ({
      ...phase,
      pump: normalizePumpPower(phase.pump),
    })),
  };
}

export function isPumpObject(pump) {
  return !isNumber(pump) && !Number.isNaN(pump);
}

export function parsePumpPowerInput(raw) {
  if (raw === '') return Number.NaN;
  const parsed = Number.parseFloat(raw);
  if (!Number.isNaN(parsed)) return parsed;
  return undefined;
}

export function updatePumpPowerFromInput(raw, updatePump) {
  const parsed = parsePumpPowerInput(raw);
  if (parsed !== undefined) {
    updatePump(parsed);
  }
}

export function getPumpPowerInputProps(pump, updatePump) {
  return {
    value: getPumpPowerInputValue(pump),
    onChange: event => updatePumpPowerFromInput(event.target.value, updatePump),
    onBlur: () => updatePump(normalizePumpPower(pump)),
  };
}
