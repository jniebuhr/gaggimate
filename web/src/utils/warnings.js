import tintSlash from '../assets/warnings/tint-slash.svg?raw';
import raindropsFilled from '../assets/warnings/raindrops-filled.svg?raw';
import lightSwitchOff from '../assets/warnings/light-switch-off.svg?raw';
import linkSlashAlt from '../assets/warnings/link-slash-alt.svg?raw';
import batteryExclamation from '../assets/warnings/battery-exclamation-2.svg?raw';
import highTemperatureAlert from '../assets/warnings/high-temperature-alert.svg?raw';
import broom from '../assets/warnings/broom.svg?raw';
import { msg } from '@lingui/core/macro';
import { withTranslatedLabel } from './translatedLabel.js';

export const WARNING_LEVEL = { IGNORE: 0, WARN: 1, ERROR: 2 };

// `label` is a getter so every consumer reads the string in the active locale.
const translated = entries => entries.map(withTranslatedLabel);

export const WARNING_LEVELS = translated([
  {
    value: WARNING_LEVEL.IGNORE,
    labelMsg: msg({ message: 'Ignore', context: 'warning level' }),
    activeClass: 'btn-primary',
  },
  {
    value: WARNING_LEVEL.WARN,
    labelMsg: msg({ message: 'Warn', context: 'warning level' }),
    activeClass: 'btn-warning',
  },
  {
    value: WARNING_LEVEL.ERROR,
    labelMsg: msg({ message: 'Error', context: 'warning level' }),
    activeClass: 'btn-error',
  },
]);

// Keys match WarningManager on the firmware; icons are the same SVGs the display uses.
export const WARNINGS = translated([
  { key: 'water', labelMsg: msg`Water tank low`, settingKey: 'warnWaterLevel', icon: tintSlash },
  {
    key: 'temperature',
    labelMsg: msg`Temperature not stable`,
    settingKey: 'warnTemperature',
    icon: highTemperatureAlert,
  },
  {
    key: 'switch',
    labelMsg: msg`Steam switch left on`,
    settingKey: 'warnSteamSwitch',
    icon: lightSwitchOff,
  },
  {
    key: 'flush',
    labelMsg: msg`Flush recommended`,
    settingKey: 'warnFlush',
    icon: raindropsFilled,
  },
  {
    key: 'scaleConnected',
    labelMsg: msg`Scale not connected`,
    settingKey: 'warnScaleConnected',
    icon: linkSlashAlt,
  },
  {
    key: 'scaleBattery',
    labelMsg: msg`Scale battery low`,
    settingKey: 'warnScaleBattery',
    icon: batteryExclamation,
  },
  { key: 'backflush', labelMsg: msg`Backflush due`, settingKey: 'warnBackflush', icon: broom },
  { key: 'descaling', labelMsg: msg`Descaling due`, settingKey: 'warnDescaling', icon: broom },
]);

export const warningByKey = key => WARNINGS.find(w => w.key === key);

// Translated label for a firmware warning key, falling back to the key itself.
export const warningLabel = key => warningByKey(key)?.label ?? key;

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
