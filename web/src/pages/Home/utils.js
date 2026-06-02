import { faPowerOff } from '@fortawesome/free-solid-svg-icons/faPowerOff';
import { faMugHot } from '@fortawesome/free-solid-svg-icons/faMugHot';
import { faWind } from '@fortawesome/free-solid-svg-icons/faWind';
import { faDroplet } from '@fortawesome/free-solid-svg-icons/faDroplet';
import { faMortarPestle } from '@fortawesome/free-solid-svg-icons/faMortarPestle';
import { faPause } from '@fortawesome/free-solid-svg-icons/faPause';
import { faCheck } from '@fortawesome/free-solid-svg-icons/faCheck';
import { faPlay } from '@fortawesome/free-solid-svg-icons/faPlay';

export const MODES = [
  { id: 0, icon: faPowerOff, label: 'Standby' },
  { id: 1, icon: faMugHot, label: 'Brew' },
  { id: 2, icon: faWind, label: 'Steam', iconRotation: 90 },
  { id: 3, icon: faDroplet, label: 'Water' },
  { id: 4, icon: faMortarPestle, label: 'Grind' },
];

export const fmtElapsed = (ms = 0) => {
  const secs = Math.floor(ms / 1000);
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
};

// fmtDuration takes a value in SECONDS (vs fmtElapsed which takes ms) and
// renders M:SS. Used by the Brew-mode stepper when the profile/scale combo
// puts it in time mode rather than weight mode.
export const fmtDuration = (s = 0) => {
  const secs = Math.floor(s);
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
};

export const fmtPhaseTarget = (p, grind) => {
  if (p?.tt === 'time') return `${(p.pt / 1000).toFixed(0)}s`;
  if (p?.tt === 'volumetric') return `${p.pt.toFixed(grind ? 1 : 0)}g`;
  return '';
};

export const getPhaseLabel = (p, grind) => {
  if (grind) return 'Grinding';
  if (p?.s === 'brew') return 'Infusion';
  return 'Preinfusion';
};

export const getPrimaryIcon = (active, finished) => {
  if (active) return faPause;
  if (finished) return faCheck;
  return faPlay;
};

export const getPrimaryLabel = (active, finished) => {
  if (active) return 'Pause';
  if (finished) return 'Finish';
  return 'Start';
};
