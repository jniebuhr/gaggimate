import { faBullseye } from '@fortawesome/free-solid-svg-icons/faBullseye';
import { faClock } from '@fortawesome/free-solid-svg-icons/faClock';
import { faDroplet } from '@fortawesome/free-solid-svg-icons/faDroplet';
import { faFaucet } from '@fortawesome/free-solid-svg-icons/faFaucet';
import { faFilter } from '@fortawesome/free-solid-svg-icons/faFilter';
import { faGauge } from '@fortawesome/free-solid-svg-icons/faGauge';
import { faGaugeHigh } from '@fortawesome/free-solid-svg-icons/faGaugeHigh';
import { faScaleBalanced } from '@fortawesome/free-solid-svg-icons/faScaleBalanced';
import { faTemperatureHalf } from '@fortawesome/free-solid-svg-icons/faTemperatureHalf';
import { msg } from '@lingui/core/macro';
import { i18n } from '../../../../i18n.js';
import {
  BREW_BY_TIME_LABEL,
  BREW_BY_WEIGHT_LABEL,
  WATER_DRAWN_PHASE_LABEL,
  WATER_DRAWN_TOTAL_LABEL,
} from './constants';
import { readCssColorVar } from './helpers';

// Series labels are internal keys; these are their translated display names.
const DISPLAY_LABEL_BY_LABEL = {
  Phases: msg`Phases`,
  Stops: msg`Stops`,
  Pressure: msg`Pressure`,
  'Pump Flow': msg`Pump Flow`,
  'Puck Flow': msg`Puck Flow`,
  'Puck Resistance': msg`Puck Resistance`,
  'Liquid Resistance': msg`Liquid Resistance`,
  Weight: msg`Weight`,
  'Weight Flow': msg`Weight Flow`,
  Temperature: msg`Temperature`,
  Temp: msg`Temperature`,
  'Target P': msg`Target Pressure`,
  'Target F': msg`Target Pump Flow`,
  'Target T': msg`Target Temperature`,
  'Pumped Water': msg`Pumped Water`,
  [WATER_DRAWN_PHASE_LABEL]: msg`Pumped Water (Phase)`,
  [WATER_DRAWN_TOTAL_LABEL]: msg`Pumped Water (Total)`,
};

// Short legend forms of the series keys, as drawn in exported legends.
const SHORT_LABEL_BY_LABEL = {
  Temp: msg({ message: 'Temp', context: 'short for temperature' }),
  'Target T': msg({ message: 'Target T', context: 'short for target temperature' }),
  'Target P': msg({ message: 'Target P', context: 'short for target pressure' }),
  'Target F': msg({ message: 'Target F', context: 'short for target pump flow' }),
};

const ICON_BY_LABEL = {
  Temp: faTemperatureHalf,
  'Target T': faBullseye,
  Pressure: faGauge,
  'Target P': faBullseye,
  'Pump Flow': faFaucet,
  'Target F': faBullseye,
  'Puck Flow': faFilter,
  'Puck Resistance': faGaugeHigh,
  'Liquid Resistance': faGaugeHigh,
  Weight: faScaleBalanced,
  'Weight Flow': faScaleBalanced,
  [WATER_DRAWN_PHASE_LABEL]: faDroplet,
  [WATER_DRAWN_TOTAL_LABEL]: faDroplet,
};

export function getShotChartDisplayLabel(label) {
  const descriptor = DISPLAY_LABEL_BY_LABEL[label];
  return descriptor ? i18n._(descriptor) : label;
}

export function getShotChartShortLabel(label) {
  const descriptor = SHORT_LABEL_BY_LABEL[label] || DISPLAY_LABEL_BY_LABEL[label];
  return descriptor ? i18n._(descriptor) : label;
}

export function getShotChartLabelIcon(label) {
  return ICON_BY_LABEL[label] || null;
}

export function getShotChartBrewModeMeta(results, colors) {
  return results?.isBrewByWeight
    ? {
        label: BREW_BY_WEIGHT_LABEL,
        iconDef: faScaleBalanced,
        backgroundColor: readCssColorVar('--analyzer-brew-by-weight-label-bg', colors.weight),
        textColor: readCssColorVar('--analyzer-brew-by-weight-label-text', '#ffffff'),
        borderColor: readCssColorVar('--analyzer-brew-by-weight-label-border', colors.weight),
      }
    : {
        label: BREW_BY_TIME_LABEL,
        iconDef: faClock,
        backgroundColor: readCssColorVar('--analyzer-brew-by-time-label-bg', '#475569'),
        textColor: readCssColorVar('--analyzer-brew-by-time-label-text', '#ffffff'),
        borderColor: readCssColorVar('--analyzer-brew-by-time-label-border', '#334155'),
      };
}
