import { msg } from '@lingui/core/macro';
import { withTranslatedLabel } from './translatedLabel.js';

/**
 * Each entry describes one dashboard metric cell.
 *
 * Fields:
 *   id         — unique string key; stored in localStorage to represent order/visibility
 *   labelMsg   — msg descriptor; exposed translated as `label` (display label in the cell header)
 *   required   — if true: always visible, freely reorderable, but cannot be removed by the user
 *   available  — (ds) => bool — return false to hide this metric from the dashboard and the
 *                Settings configurator pool. ds is either the useDashboardState() result
 *                (in DashboardSidebar) or machine.value.status (in Settings) — both share
 *                the same shape for fields used by available guards.
 *   getValue   — (ds) => string — primary displayed value
 *   getTarget  — (ds) => string|null — secondary target value (shown as "/target unit"). Omit if none.
 *   unit       — string appended to the target value (e.g. ' bar', '°C')
 *   adjustable — (ds) => bool — whether +/- buttons are rendered
 *   disabled   — (ds) => bool — whether the rendered +/- buttons are disabled. Omit if never
 *                disabled. Defaults to false.
 *   onDecrease — (ds) => function — handler for the minus button. Omit if not adjustable.
 *   onIncrease — (ds) => function — handler for the plus button. Omit if not adjustable.
 */
export const METRIC_DEFINITIONS = [
  {
    id: 'pressure',
    labelMsg: msg`Pressure`,
    required: false,
    available: () => true,
    getValue: ds => (ds.currentPressure ?? 0).toFixed(1),
    getTarget: ds => (ds.targetPressure ?? 0).toFixed(1),
    unit: ' bar',
    adjustable: () => false,
  },
  {
    id: 'flow',
    labelMsg: msg`Flow`,
    required: false,
    available: () => true,
    getValue: ds => `${(ds.currentFlow ?? 0).toFixed(1)} ml/s`,
    getTarget: ds => (ds.targetFlow > 0 ? (ds.targetFlow ?? 0).toFixed(1) : null),
    unit: ' ml/s',
    adjustable: () => false,
  },
  {
    id: 'temp',
    labelMsg: msg`Temp`,
    required: true,
    available: () => true,
    getValue: ds => `${(ds.currentTemperature ?? 0).toFixed(1)}°`,
    getTarget: ds => (ds.targetTemperature ?? 0).toFixed(0),
    unit: '°C',
    adjustable: () => true,
    disabled: ds => (ds.isBrewing && ds.isActive) || ds.mode === 0,
    onDecrease: ds => ds.lowerTemp,
    onIncrease: ds => ds.raiseTemp,
  },
  {
    id: 'steamtemp',
    labelMsg: msg`Steam Temp`,
    required: true,
    available: ds => ds.dualBoiler,
    getValue: ds => `${(ds.currentSteamTemperature ?? 0).toFixed(1)}°`,
    getTarget: ds => (ds.targetSteamTemperature ?? 0).toFixed(0),
    unit: '°C',
    adjustable: () => false,
    disabled: ds => (ds.isBrewing && ds.isActive) || ds.mode === 0,
  },
  {
    id: 'pumppower',
    labelMsg: msg`Pump Power`,
    required: false,
    available: () => true,
    getValue: ds => `${Math.round(ds.currentPumpPower ?? 0)}%`,
    getTarget: () => null,
    unit: '%',
    adjustable: () => false,
  },
  {
    id: 'heaterpower',
    labelMsg: msg`Heater Power`,
    required: false,
    available: () => true,
    getValue: ds => `${Math.round(ds.mode === 0 ? 0 : (ds.currentBoilerPower ?? 0))}%`,
    getTarget: () => null,
    unit: '%',
    adjustable: () => false,
  },
  {
    id: 'puckresistance',
    labelMsg: msg`Puck Resistance`,
    required: false,
    available: () => true,
    getValue: ds => {
      const r = ds.currentPuckResistance ?? 0;
      return r > 0 && r < 100 ? `${r.toFixed(2)} s·√bar/mL` : '—';
    },
    getTarget: () => null,
    adjustable: () => false,
  },
  {
    id: 'puckflow',
    labelMsg: msg`Puck Flow`,
    required: false,
    available: () => true,
    getValue: ds => `${(ds.currentPuckFlow ?? 0).toFixed(1)} ml/s`,
    getTarget: () => null,
    adjustable: () => false,
  },
  {
    id: 'estimatedoutput',
    labelMsg: msg`Estimated Output`,
    required: false,
    available: () => true,
    getValue: ds => {
      const v = ds.currentCoffeeVolume ?? 0;
      return v > 0 ? `${v.toFixed(1)} ml` : '—';
    },
    getTarget: () => null,
    adjustable: () => false,
  },
  {
    id: 'waterlevel',
    labelMsg: msg`Water Level`,
    required: false,
    available: ds => !!ds.ledControl,
    getValue: ds => (ds.waterLevelPercent != null ? `${Math.round(ds.waterLevelPercent)}%` : '—'),
    getTarget: () => null,
    unit: '%',
    adjustable: () => false,
  },
  {
    id: 'weight',
    labelMsg: msg`Weight`,
    required: false,
    available: () => true, // always configurable; getValue shows '—' when scale not connected
    getValue: ds => (ds.volumetricAvailable ? `${(ds.currentWeight ?? 0).toFixed(1)}g` : '—'),
    getTarget: ds => (ds.brewTarget && ds.targetWeight != null ? ds.targetWeight.toFixed(0) : null),
    unit: 'g',
    adjustable: ds => ds.volumetricAvailable,
    disabled: ds =>
      (ds.isBrewing && ds.isActive) ||
      ds.mode === 0 ||
      ds.mode === 2 ||
      ds.mode === 3 ||
      ds.mode === 4 ||
      !ds.targetWeight,
    onDecrease: ds => ds.lowerTarget,
    onIncrease: ds => ds.raiseTarget,
  },
].map(withTranslatedLabel);
