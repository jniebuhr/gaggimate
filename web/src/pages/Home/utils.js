import { faPowerOff } from '@fortawesome/free-solid-svg-icons/faPowerOff';
import { faMugHot } from '@fortawesome/free-solid-svg-icons/faMugHot';
import { faWind } from '@fortawesome/free-solid-svg-icons/faWind';
import { faDroplet } from '@fortawesome/free-solid-svg-icons/faDroplet';
import { faMortarPestle } from '@fortawesome/free-solid-svg-icons/faMortarPestle';
import { faPause } from '@fortawesome/free-solid-svg-icons/faPause';
import { faCheck } from '@fortawesome/free-solid-svg-icons/faCheck';
import { faPlay } from '@fortawesome/free-solid-svg-icons/faPlay';
import { msg, t } from '@lingui/core/macro';
import { i18n } from '../../i18n.js';

// `label` is a getter so it reads in the active locale.
export const MODES = [
  { id: 0, icon: faPowerOff, labelMsg: msg({ message: 'Standby', context: 'machine mode' }) },
  { id: 1, icon: faMugHot, labelMsg: msg({ message: 'Brew', context: 'machine mode' }) },
  {
    id: 2,
    icon: faWind,
    labelMsg: msg({ message: 'Steam', context: 'machine mode' }),
    iconRotation: 90,
  },
  { id: 3, icon: faDroplet, labelMsg: msg({ message: 'Water', context: 'machine mode' }) },
  { id: 4, icon: faMortarPestle, labelMsg: msg({ message: 'Grind', context: 'machine mode' }) },
].map(m => ({
  ...m,
  get label() {
    return i18n._(m.labelMsg);
  },
}));

export const fmtElapsed = (ms = 0) => {
  const secs = Math.floor(ms / 1000);
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
};

export const fmtPhaseTarget = (p, grind) => {
  if (p?.tt === 'time') return `${(p.pt / 1000).toFixed(0)}s`;
  if (p?.tt === 'volumetric') return `${p.pt.toFixed(grind ? 1 : 0)}g`;
  return '';
};

export const getPhaseLabel = (p, grind) => {
  if (grind) return t`Grinding`;
  if (p?.s === 'brew') return t`Infusion`;
  return t`Preinfusion`;
};

export const getPrimaryIcon = (active, finished) => {
  if (active) return faPause;
  if (finished) return faCheck;
  return faPlay;
};

export const getPrimaryLabel = (active, finished) => {
  if (active) return t({ message: 'Pause', context: 'process action' });
  if (finished) return t({ message: 'Finish', context: 'process action' });
  return t({ message: 'Start', context: 'process action' });
};
