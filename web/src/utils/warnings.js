import tintSlash from '../assets/warnings/tint-slash.svg?raw';
import raindropsFilled from '../assets/warnings/raindrops-filled.svg?raw';
import lightSwitchOff from '../assets/warnings/light-switch-off.svg?raw';
import linkSlashAlt from '../assets/warnings/link-slash-alt.svg?raw';
import batteryExclamation from '../assets/warnings/battery-exclamation-2.svg?raw';
import highTemperatureAlert from '../assets/warnings/high-temperature-alert.svg?raw';

export const WARNING_LEVEL = { IGNORE: 0, WARN: 1, ERROR: 2 };

export const WARNING_LEVELS = [
  { value: WARNING_LEVEL.IGNORE, label: 'Ignore', activeClass: 'btn-primary' },
  { value: WARNING_LEVEL.WARN, label: 'Warn', activeClass: 'btn-warning' },
  { value: WARNING_LEVEL.ERROR, label: 'Error', activeClass: 'btn-error' },
];

// Keys match WarningManager on the firmware; icons are the same SVGs the display uses.
export const WARNINGS = [
  { key: 'water', label: 'Water tank low', settingKey: 'warnWaterLevel', icon: tintSlash },
  {
    key: 'temperature',
    label: 'Temperature not stable',
    settingKey: 'warnTemperature',
    icon: highTemperatureAlert,
  },
  {
    key: 'switch',
    label: 'Steam switch left on',
    settingKey: 'warnSteamSwitch',
    icon: lightSwitchOff,
  },
  { key: 'flush', label: 'Flush recommended', settingKey: 'warnFlush', icon: raindropsFilled },
  {
    key: 'scaleConnected',
    label: 'Scale not connected',
    settingKey: 'warnScaleConnected',
    icon: linkSlashAlt,
  },
  {
    key: 'scaleBattery',
    label: 'Scale battery low',
    settingKey: 'warnScaleBattery',
    icon: batteryExclamation,
  },
];

export const warningByKey = key => WARNINGS.find(w => w.key === key);

// Expand the compact firmware form ({k, l, a}) used in evt:status and evt:brew:confirm.
export function parseWarningStates(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(w => ({ key: w.k, level: w.l ?? 0, active: w.a ?? true }));
}

// Join firmware warning states with their definitions, keeping only shown (non-ignored) active ones.
export function activeWarnings(states = []) {
  return states
    .filter(s => s.level > WARNING_LEVEL.IGNORE && (s.active ?? true))
    .map(s => ({ ...warningByKey(s.key), ...s }))
    .filter(w => w.icon);
}
