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

export function normalizePumpPower(pump) {
  if (Number.isNaN(pump)) return 100;
  if (!isNumber(pump)) return pump;
  return Math.min(100, Math.max(0, pump));
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
