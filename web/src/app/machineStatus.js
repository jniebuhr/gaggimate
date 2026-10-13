const MODE_LABELS = ['Standby', 'Brew', 'Steam', 'Water', 'Grind'];
const MODE_STEAM = 2;

// One-line live summary like "Brew · 93 °C"; dual-boiler machines report steam on its own sensor.
export function formatMachineStatus(status) {
  const label = MODE_LABELS[status.mode] ?? 'Unknown';
  const temperature =
    status.mode === MODE_STEAM && status.currentSteamTemperature > 0
      ? status.currentSteamTemperature
      : status.currentTemperature;
  return `${label} · ${Math.round(temperature)} °C`;
}
