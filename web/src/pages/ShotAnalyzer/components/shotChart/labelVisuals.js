import { faBullseye } from '@fortawesome/free-solid-svg-icons/faBullseye';
import { faClock } from '@fortawesome/free-solid-svg-icons/faClock';
import { faDroplet } from '@fortawesome/free-solid-svg-icons/faDroplet';
import { faFaucet } from '@fortawesome/free-solid-svg-icons/faFaucet';
import { faFilter } from '@fortawesome/free-solid-svg-icons/faFilter';
import { faGauge } from '@fortawesome/free-solid-svg-icons/faGauge';
import { faScaleBalanced } from '@fortawesome/free-solid-svg-icons/faScaleBalanced';
import { faTemperatureHalf } from '@fortawesome/free-solid-svg-icons/faTemperatureHalf';
import {
  BREW_BY_TIME_LABEL,
  BREW_BY_WEIGHT_LABEL,
  WATER_DRAWN_PHASE_LABEL,
  WATER_DRAWN_TOTAL_LABEL,
} from './constants';
import { readCssColorVar } from './helpers';

const DISPLAY_LABEL_BY_LABEL = {
  Temp: 'Temperature',
  'Target P': 'Target Pressure',
  'Target F': 'Target Pump Flow',
  'Target T': 'Target Temperature',
};

const ICON_BY_LABEL = {
  Temp: faTemperatureHalf,
  'Target T': faBullseye,
  Pressure: faGauge,
  'Target P': faBullseye,
  'Pump Flow': faFaucet,
  'Target F': faBullseye,
  'Puck Flow': faFilter,
  Weight: faScaleBalanced,
  'Weight Flow': faScaleBalanced,
  [WATER_DRAWN_PHASE_LABEL]: faDroplet,
  [WATER_DRAWN_TOTAL_LABEL]: faDroplet,
};

export function getShotChartDisplayLabel(label) {
  return DISPLAY_LABEL_BY_LABEL[label] || label;
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
