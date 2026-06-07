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
