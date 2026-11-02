import { msg, t } from '@lingui/core/macro';
import { i18n } from '../i18n.js';

const MODE_LABELS = [
  msg({ message: 'Standby', context: 'machine mode' }),
  msg({ message: 'Brew', context: 'machine mode' }),
  msg({ message: 'Steam', context: 'machine mode' }),
  msg({ message: 'Water', context: 'machine mode' }),
  msg({ message: 'Grind', context: 'machine mode' }),
];
const MODE_STEAM = 2;

// One-line live summary like "Brew · 93 °C"; dual-boiler machines report steam on its own sensor.
export function formatMachineStatus(status) {
  const descriptor = MODE_LABELS[status.mode];
  const label = descriptor
    ? i18n._(descriptor)
    : t({ message: 'Unknown', context: 'machine mode' });
  const temperature =
    status.mode === MODE_STEAM && status.currentSteamTemperature > 0
      ? status.currentSteamTemperature
      : status.currentTemperature;
  return `${label} · ${Math.round(temperature)} °C`;
}
