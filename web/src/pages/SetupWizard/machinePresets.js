// Machine presets for the setup wizard; `settings` is POSTed as-is to /api/settings.
// Machines without a verified PID set recommend an autotune with their heater wattage instead.
export const DEFAULT_PID = '58.397,1.027,249.055,0.0';

export const MACHINE_PRESETS = [
  {
    id: 'gaggia-classic',
    name: 'Gaggia Classic / Classic Pro',
    heaterWattage: 1360,
    settings: { pid: DEFAULT_PID, temperatureOffset: 0, targetSteamTemp: 145 },
    autotune: false,
  },
  {
    id: 'silvia-230',
    name: 'Rancilio Silvia (230 V)',
    heaterWattage: 1100,
    settings: { temperatureOffset: 0, targetSteamTemp: 145 },
    autotune: true,
  },
  {
    id: 'silvia-120',
    name: 'Rancilio Silvia (120 V)',
    heaterWattage: 950,
    settings: { temperatureOffset: 0, targetSteamTemp: 145 },
    autotune: true,
  },
];
