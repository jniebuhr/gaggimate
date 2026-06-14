/**
 * Each entry describes one dashboard metric cell.
 *
 * Fields:
 *   id         — unique string key; stored in localStorage to represent order/visibility
 *   label      — display label shown in the cell header
 *   required   — if true: always visible, freely reorderable, but cannot be removed by the user
 *   available  — (ds) => bool — return false to hide this metric from the dashboard and the
 *                Settings configurator pool. ds is either the useDashboardState() result
 *                (in DashboardSidebar) or machine.value.status (in Settings) — both share
 *                the same shape for fields used by available guards.
 *   getValue   — (ds) => string — primary displayed value
 *   getTarget  — (ds) => string|null — secondary target value (shown as "/target unit"). Omit if none.
 *   unit       — string appended to the target value (e.g. ' bar', '°C')
 *   adjustable — (ds) => bool — whether +/- buttons are rendered
 *   onDecrease — (ds) => function — handler for the minus button. Omit if not adjustable.
 *   onIncrease — (ds) => function — handler for the plus button. Omit if not adjustable.
 */
export const METRIC_DEFINITIONS = [
  {
    id: 'pressure',
    label: 'Pressure',
    required: false,
    available: () => true,
    getValue: (ds) => (ds.currentPressure ?? 0).toFixed(1),
    getTarget: (ds) => (ds.targetPressure ?? 0).toFixed(1),
    unit: ' bar',
    adjustable: () => false,
  },
  {
    id: 'flow',
    label: 'Flow',
    required: false,
    available: () => true,
    getValue: (ds) => `${(ds.currentFlow ?? 0).toFixed(1)} ml/s`,
    getTarget: (ds) => (ds.targetFlow > 0 ? (ds.targetFlow ?? 0).toFixed(1) : null),
    unit: ' ml/s',
    adjustable: () => false,
  },
  {
    id: 'temp',
    label: 'Temp',
    required: true,
    available: () => true,
    getValue: (ds) => `${(ds.currentTemperature ?? 0).toFixed(1)}°`,
    getTarget: (ds) => (ds.targetTemperature ?? 0).toFixed(0),
    unit: '°C',
    adjustable: () => true,
    onDecrease: (ds) => ds.lowerTemp,
    onIncrease: (ds) => ds.raiseTemp,
  },
  {
    id: 'pumppower',
    label: 'Pump Power',
    required: false,
    available: () => true,
    getValue: (ds) => `${Math.round(ds.currentPumpPower ?? 0)}%`,
    getTarget: () => null,
    unit: '%',
    adjustable: () => false,
  },
  {
    id: 'heaterpower',
    label: 'Heater Power',
    required: false,
    available: () => true,
    getValue: (ds) => `${Math.round(ds.currentBoilerPower ?? 0)}%`,
    getTarget: () => null,
    unit: '%',
    adjustable: () => false,
  },
  {
    id: 'waterlevel',
    label: 'Water Level',
    required: false,
    available: (ds) => !!ds.tofDistance,
    getValue: (ds) => ds.waterLevelPercent !== null ? `${Math.round(ds.waterLevelPercent)}%` : '—',
    getTarget: () => null,
    unit: '%',
    adjustable: () => false,
  },
  {
    id: 'weight',
    label: 'Weight',
    required: false,
    available: () => true, // always configurable; getValue shows '—' when scale not connected
    getValue: (ds) => ds.volumetricAvailable ? `${(ds.currentWeight ?? 0).toFixed(1)}g` : '—',
    getTarget: (ds) =>
      ds.brewTarget && ds.targetWeight != null ? ds.targetWeight.toFixed(0) : null,
    unit: 'g',
    adjustable: (ds) => ds.volumetricAvailable,
    onDecrease: (ds) => ds.lowerTarget,
    onIncrease: (ds) => ds.raiseTarget,
  },
];
