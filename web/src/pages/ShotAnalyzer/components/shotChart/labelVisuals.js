import { faBullseye } from '@fortawesome/free-solid-svg-icons/faBullseye';
import { faDroplet } from '@fortawesome/free-solid-svg-icons/faDroplet';
import { faFaucet } from '@fortawesome/free-solid-svg-icons/faFaucet';
import { faFilter } from '@fortawesome/free-solid-svg-icons/faFilter';
import { faGauge } from '@fortawesome/free-solid-svg-icons/faGauge';
import { faScaleBalanced } from '@fortawesome/free-solid-svg-icons/faScaleBalanced';
import { faTemperatureHalf } from '@fortawesome/free-solid-svg-icons/faTemperatureHalf';
import { WATER_DRAWN_PHASE_LABEL, WATER_DRAWN_TOTAL_LABEL } from './constants';

const DISPLAY_LABEL_BY_LABEL = {
  Temp: 'Temperature',
  'Target P': 'Target Pressure',
  'Target F': 'Target Flow',
  'Target T': 'Target Temperature',
};

const ICON_BY_LABEL = {
  Temp: faTemperatureHalf,
  'Target T': faBullseye,
  Pressure: faGauge,
  'Target P': faBullseye,
  Flow: faFaucet,
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
