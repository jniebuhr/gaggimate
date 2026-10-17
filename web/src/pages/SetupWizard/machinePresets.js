import { msg } from '@lingui/core/macro';

// Starting values from https://docs.gaggimate.eu/docs/usage-configuration/; `settings` is POSTed as-is to /api/settings.
// `plugins` are switched on in the plugins step as a recommendation the user can still undo.
export const MACHINE_PRESETS = [
  {
    id: 'gaggia-classic',
    name: 'Gaggia Classic (1991–2014)',
    settings: { pid: '58.397,1.027,249.055,0', temperatureOffset: 8 },
  },
  {
    id: 'gaggia-classic-pro',
    name: 'Gaggia Classic Pro / Evo / E24',
    settings: { pid: '58.397,1.027,249.055,0', temperatureOffset: 8 },
  },
  {
    id: 'rancilio-silvia',
    name: 'Rancilio Silvia',
    settings: { pid: '112.315,0.658,1436.887,0', temperatureOffset: 5 },
    plugins: ['boilerFillActive'],
    note: msg`The heating element sits in the water, so the boiler refill plugin is enabled in the next steps to keep the boiler filled.`,
  },
  {
    id: 'delonghi-dedica',
    name: 'DeLonghi Dedica',
    settings: { pid: '10,0.006,140,0.55', temperatureOffset: 10 },
  },
  {
    id: 'delonghi-ecp',
    name: 'DeLonghi ECP',
    settings: { pid: '32,0.05,42,0.46', temperatureOffset: 15 },
  },
];

export const DEFAULT_HEATER_WATTAGE = 1360;
