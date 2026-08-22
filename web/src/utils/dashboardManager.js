import { signal } from '@preact/signals';

const DASHBOARD_LAYOUT_KEY = 'dashboardLayout';
const DASHBOARD_CARD_MODE_KEY = 'dashboardCardMode';

/* global globalThis */

export const DASHBOARD_LAYOUTS = {
  ORDER_FIRST: 'order-first',
  ORDER_LAST: 'order-last',
};

export const DASHBOARD_CARD_MODES = {
  MULTI: 'multi',
  SINGLE: 'single',
};

export const getDashboardLayout = () => {
  if (!globalThis.window?.localStorage) {
    return DASHBOARD_LAYOUTS.ORDER_FIRST;
  }
  try {
    return localStorage.getItem(DASHBOARD_LAYOUT_KEY) || DASHBOARD_LAYOUTS.ORDER_FIRST;
  } catch {
    return DASHBOARD_LAYOUTS.ORDER_FIRST;
  }
};

export const dashboardLayoutSignal = signal(getDashboardLayout());

export const setDashboardLayout = layout => {
  if (layout === null || layout === undefined) return false;
  try {
    localStorage.setItem(DASHBOARD_LAYOUT_KEY, layout);
    dashboardLayoutSignal.value = layout;
    return true;
  } catch {
    return false;
  }
};

export const getDashboardCardMode = () => {
  if (!globalThis.window?.localStorage) {
    return DASHBOARD_CARD_MODES.SINGLE;
  }
  try {
    return localStorage.getItem(DASHBOARD_CARD_MODE_KEY) || DASHBOARD_CARD_MODES.SINGLE;
  } catch {
    return DASHBOARD_CARD_MODES.SINGLE;
  }
};

export const dashboardCardModeSignal = signal(getDashboardCardMode());

export const setDashboardCardMode = mode => {
  try {
    localStorage.setItem(DASHBOARD_CARD_MODE_KEY, mode);
    dashboardCardModeSignal.value = mode;
    return true;
  } catch {
    return false;
  }
};

const DASHBOARD_METRICS_KEY = 'dashboardMetrics';

const DEFAULT_METRIC_ORDER = ['pressure', 'flow', 'temp', 'weight'];
const DEFAULT_METRIC_ORDER_MOBILE = ['pressure', 'temp', 'weight'];

// Matches narrow portrait phones (max-width) as well as phones rotated into
// landscape, where width grows past the portrait breakpoint but height stays small.
const isMobileViewport = () =>
  !!globalThis.window?.matchMedia(
    '(max-width: 768px), (max-height: 768px) and (orientation: landscape)',
  ).matches;

export const getMetricOrder = () => {
  const isMobile = isMobileViewport();
  const defaultOrder = isMobile ? [...DEFAULT_METRIC_ORDER_MOBILE] : [...DEFAULT_METRIC_ORDER];

  if (!globalThis.window?.localStorage) {
    return [...defaultOrder];
  }
  try {
    const stored = localStorage.getItem(DASHBOARD_METRICS_KEY);
    return stored ? JSON.parse(stored) : [...defaultOrder];
  } catch {
    return [...defaultOrder];
  }
};

export const metricOrderSignal = signal(getMetricOrder());

export const setMetricOrder = ids => {
  if (!Array.isArray(ids)) return false;
  try {
    localStorage.setItem(DASHBOARD_METRICS_KEY, JSON.stringify(ids));
    metricOrderSignal.value = ids;
    return true;
  } catch {
    return false;
  }
};

// ── Panel order ────────────────────────────────────────────────────────────

const DASHBOARD_PANELS_KEY = 'dashboardPanels';

const DEFAULT_PANEL_ORDER = ['mode', 'profile', 'metrics', 'watertank', 'action'];

export const getPanelOrder = () => {
  if (!globalThis.window?.localStorage) {
    return [...DEFAULT_PANEL_ORDER];
  }
  try {
    const stored = localStorage.getItem(DASHBOARD_PANELS_KEY);
    return stored ? JSON.parse(stored) : [...DEFAULT_PANEL_ORDER];
  } catch {
    return [...DEFAULT_PANEL_ORDER];
  }
};

export const panelOrderSignal = signal(getPanelOrder());

export const setPanelOrder = ids => {
  if (!Array.isArray(ids)) return false;
  try {
    localStorage.setItem(DASHBOARD_PANELS_KEY, JSON.stringify(ids));
    panelOrderSignal.value = ids;
    return true;
  } catch {
    return false;
  }
};

// ── Sticky bottom ──────────────────────────────────────────────────────────

const DASHBOARD_STICKY_BOTTOM_KEY = 'dashboardStickyBottom';

export const getStickyBottom = () => {
  if (!globalThis.window?.localStorage) return true;
  try {
    return localStorage.getItem(DASHBOARD_STICKY_BOTTOM_KEY) !== 'false';
  } catch {
    return true;
  }
};

export const stickyBottomSignal = signal(getStickyBottom());

export const setStickyBottom = value => {
  try {
    localStorage.setItem(DASHBOARD_STICKY_BOTTOM_KEY, String(value));
    stickyBottomSignal.value = value;
    return true;
  } catch {
    return false;
  }
};

// ── Sticky top ─────────────────────────────────────────────────────────────

const DASHBOARD_STICKY_TOP_KEY = 'dashboardStickyTop';

export const getStickyTop = () => {
  if (!globalThis.window?.localStorage) return false;
  try {
    return localStorage.getItem(DASHBOARD_STICKY_TOP_KEY) === 'true';
  } catch {
    return false;
  }
};

export const stickyTopSignal = signal(getStickyTop());

export const setStickyTop = value => {
  try {
    localStorage.setItem(DASHBOARD_STICKY_TOP_KEY, String(value));
    stickyTopSignal.value = value;
    return true;
  } catch {
    return false;
  }
};

// ── Recent Shots visibility ─────────────────────────────────────────────────

const DASHBOARD_SHOW_RECENT_SHOTS_KEY = 'dashboardShowRecentShots';

export const getShowRecentShots = () => {
  if (!globalThis.window?.localStorage) return false;
  try {
    return localStorage.getItem(DASHBOARD_SHOW_RECENT_SHOTS_KEY) === 'true';
  } catch {
    return false;
  }
};

export const showRecentShotsSignal = signal(getShowRecentShots());

export const setShowRecentShots = value => {
  try {
    localStorage.setItem(DASHBOARD_SHOW_RECENT_SHOTS_KEY, String(value));
    showRecentShotsSignal.value = value;
    return true;
  } catch {
    return false;
  }
};

// ── Metrics columns ───────────────────────────────────────────────────────

const DASHBOARD_METRICS_COLUMNS_KEY = 'dashboardMetricsColumns';

export const getMetricsColumns = () => {
  if (!globalThis.window?.localStorage) return 3;
  try {
    const stored = localStorage.getItem(DASHBOARD_METRICS_COLUMNS_KEY);
    const n = stored ? Number.parseInt(stored, 10) : 3;
    return Number.isFinite(n) && n >= 1 && n <= 4 ? n : 3;
  } catch {
    return 3;
  }
};

export const metricsColumnsSignal = signal(getMetricsColumns());

export const setMetricsColumns = n => {
  if (!Number.isInteger(n) || n < 1 || n > 4) return false;
  try {
    localStorage.setItem(DASHBOARD_METRICS_COLUMNS_KEY, String(n));
    metricsColumnsSignal.value = n;
    return true;
  } catch {
    return false;
  }
};

// ── Compact panels ────────────────────────────────────────────────────────

const DASHBOARD_COMPACT_PANELS_KEY = 'dashboardCompactPanels';
const DEFAULT_COMPACT_PANELS_MOBILE = ['profile', 'favorites', 'metrics'];

export const getCompactPanels = () => {
  const isMobile = isMobileViewport();
  const defaultPanels = isMobile ? [...DEFAULT_COMPACT_PANELS_MOBILE] : [];

  if (!globalThis.window?.localStorage) return defaultPanels;
  try {
    const stored = localStorage.getItem(DASHBOARD_COMPACT_PANELS_KEY);
    return stored ? JSON.parse(stored) : defaultPanels;
  } catch {
    return defaultPanels;
  }
};

export const compactPanelsSignal = signal(getCompactPanels());

export const setCompactPanels = ids => {
  if (!Array.isArray(ids)) return false;
  try {
    localStorage.setItem(DASHBOARD_COMPACT_PANELS_KEY, JSON.stringify(ids));
    compactPanelsSignal.value = ids;
    return true;
  } catch {
    return false;
  }
};

export const toggleCompactPanel = id => {
  const current = compactPanelsSignal.value;
  const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
  return setCompactPanels(next);
};

// ── Metrics last row fill ─────────────────────────────────────────────────

const DASHBOARD_METRICS_LAST_ROW_FILL_KEY = 'dashboardMetricsLastRowFill';

export const METRICS_LAST_ROW_FILLS = {
  EVEN: 'even',
  GRID: 'grid',
};

export const getMetricsLastRowFill = () => {
  if (!globalThis.window?.localStorage) {
    return METRICS_LAST_ROW_FILLS.EVEN;
  }
  try {
    const stored = localStorage.getItem(DASHBOARD_METRICS_LAST_ROW_FILL_KEY);
    const valid = Object.values(METRICS_LAST_ROW_FILLS);
    return stored && valid.includes(stored) ? stored : METRICS_LAST_ROW_FILLS.EVEN;
  } catch {
    return METRICS_LAST_ROW_FILLS.EVEN;
  }
};

export const metricsLastRowFillSignal = signal(getMetricsLastRowFill());

export const setMetricsLastRowFill = value => {
  if (!Object.values(METRICS_LAST_ROW_FILLS).includes(value)) return false;
  try {
    localStorage.setItem(DASHBOARD_METRICS_LAST_ROW_FILL_KEY, value);
    metricsLastRowFillSignal.value = value;
    return true;
  } catch {
    return false;
  }
};

// ── Profile chart height ──────────────────────────────────────────────────

const DASHBOARD_PROFILE_CHART_HEIGHT_KEY = 'dashboardProfileChartHeight';

export const getProfileChartHeight = () => {
  if (!globalThis.window?.localStorage) return 128;
  try {
    const stored = localStorage.getItem(DASHBOARD_PROFILE_CHART_HEIGHT_KEY);
    const n = stored ? Number.parseInt(stored, 10) : 128;
    return Number.isFinite(n) && n >= 64 && n <= 256 ? n : 128;
  } catch {
    return 128;
  }
};

export const profileChartHeightSignal = signal(getProfileChartHeight());

export const setProfileChartHeight = n => {
  if (!Number.isInteger(n) || n < 64 || n > 256) return false;
  try {
    localStorage.setItem(DASHBOARD_PROFILE_CHART_HEIGHT_KEY, String(n));
    profileChartHeightSignal.value = n;
    return true;
  } catch {
    return false;
  }
};

// ── Column spacing ────────────────────────────────────────────────────────

const DASHBOARD_COLUMN_SPACING_KEY = 'dashboardColumnSpacing';

export const COLUMN_SPACINGS = {
  START: 'start',
  BETWEEN: 'between',
};

export const getColumnSpacing = () => {
  if (!globalThis.window?.localStorage) {
    return COLUMN_SPACINGS.START;
  }
  try {
    const stored = localStorage.getItem(DASHBOARD_COLUMN_SPACING_KEY);
    const valid = Object.values(COLUMN_SPACINGS);
    return stored && valid.includes(stored) ? stored : COLUMN_SPACINGS.START;
  } catch {
    return COLUMN_SPACINGS.START;
  }
};

export const columnSpacingSignal = signal(getColumnSpacing());

export const setColumnSpacing = value => {
  if (!Object.values(COLUMN_SPACINGS).includes(value)) return false;
  try {
    localStorage.setItem(DASHBOARD_COLUMN_SPACING_KEY, value);
    columnSpacingSignal.value = value;
    return true;
  } catch {
    return false;
  }
};

// ── Shot card metric slots ────────────────────────────────────────────────

const DASHBOARD_SHOT_METRIC_SLOTS_KEY = 'dashboardShotMetricSlots';
const DEFAULT_SHOT_METRIC_SLOTS = ['duration', 'weight', 'maxPressure'];

export const getShotMetricSlots = () => {
  if (!globalThis.window?.localStorage) {
    return [...DEFAULT_SHOT_METRIC_SLOTS];
  }
  try {
    const stored = localStorage.getItem(DASHBOARD_SHOT_METRIC_SLOTS_KEY);
    return stored ? JSON.parse(stored) : [...DEFAULT_SHOT_METRIC_SLOTS];
  } catch {
    return [...DEFAULT_SHOT_METRIC_SLOTS];
  }
};

export const shotMetricSlotsSignal = signal(getShotMetricSlots());

export const setShotMetricSlots = slots => {
  if (!Array.isArray(slots) || slots.length !== 3) return false;
  try {
    localStorage.setItem(DASHBOARD_SHOT_METRIC_SLOTS_KEY, JSON.stringify(slots));
    shotMetricSlotsSignal.value = slots;
    return true;
  } catch {
    return false;
  }
};

// ── Clock 24h mirror ──────────────────────────────────────────────────────

export const clock24hSignal = signal(false);

export const setClock24h = value => {
  clock24hSignal.value = !!value;
};

// ── Recent shot count ─────────────────────────────────────────────────────

const DASHBOARD_RECENT_SHOT_COUNT_KEY = 'dashboardRecentShotCount';

export const getRecentShotCount = () => {
  if (!globalThis.window?.localStorage) return 4;
  try {
    const stored = localStorage.getItem(DASHBOARD_RECENT_SHOT_COUNT_KEY);
    const n = stored ? Number.parseInt(stored, 10) : 4;
    return Number.isFinite(n) && n >= 1 && n <= 8 ? n : 4;
  } catch {
    return 4;
  }
};

export const recentShotCountSignal = signal(getRecentShotCount());

export const setRecentShotCount = n => {
  if (!Number.isInteger(n) || n < 1 || n > 8) return false;
  try {
    localStorage.setItem(DASHBOARD_RECENT_SHOT_COUNT_KEY, String(n));
    recentShotCountSignal.value = n;
    return true;
  } catch {
    return false;
  }
};

// ── Dashboard mode (Simple / Advanced / Customize) ─────────────────────────

const DASHBOARD_MODE_KEY = 'dashboardMode';

export const DASHBOARD_MODES = {
  SIMPLE: 'simple',
  ADVANCED: 'advanced',
  CUSTOM: 'custom',
};

// Preset values per mode; function values are resolved at apply time so
// viewport-dependent choices track the device the preset is applied on.
const DASHBOARD_PRESETS = {
  [DASHBOARD_MODES.SIMPLE]: {
    // Matches the pre-preset default dashboard.
    layout: DASHBOARD_LAYOUTS.ORDER_FIRST,
    cardMode: DASHBOARD_CARD_MODES.SINGLE,
    metricOrder: () =>
      isMobileViewport() ? [...DEFAULT_METRIC_ORDER_MOBILE] : [...DEFAULT_METRIC_ORDER],
    panelOrder: DEFAULT_PANEL_ORDER,
    stickyTop: false,
    stickyBottom: true,
    showRecentShots: false,
    recentShotCount: 4,
    metricsColumns: 3,
    metricsLastRowFill: METRICS_LAST_ROW_FILLS.EVEN,
    compactPanels: () => (isMobileViewport() ? [...DEFAULT_COMPACT_PANELS_MOBILE] : []),
    profileChartHeight: 128,
    columnSpacing: COLUMN_SPACINGS.START,
    shotMetricSlots: DEFAULT_SHOT_METRIC_SLOTS,
  },
  [DASHBOARD_MODES.ADVANCED]: {
    layout: DASHBOARD_LAYOUTS.ORDER_FIRST,
    cardMode: DASHBOARD_CARD_MODES.SINGLE,
    metricOrder: () =>
      isMobileViewport()
        ? ['pressure', 'flow', 'temp', 'weight']
        : ['pressure', 'flow', 'temp', 'weight', 'pumppower', 'heaterpower'],
    panelOrder: ['mode', 'profile', 'favorites', 'metrics', 'watertank', 'action'],
    stickyTop: false,
    stickyBottom: true,
    showRecentShots: true,
    recentShotCount: 4,
    metricsColumns: 3,
    metricsLastRowFill: METRICS_LAST_ROW_FILLS.EVEN,
    compactPanels: () => (isMobileViewport() ? [...DEFAULT_COMPACT_PANELS_MOBILE] : []),
    profileChartHeight: 128,
    columnSpacing: COLUMN_SPACINGS.START,
    shotMetricSlots: DEFAULT_SHOT_METRIC_SLOTS,
  },
};

// Binds each preset key to its signal and its stored-customization getter.
const DASHBOARD_SETTING_BINDINGS = [
  { key: 'layout', signal: dashboardLayoutSignal, get: getDashboardLayout },
  { key: 'cardMode', signal: dashboardCardModeSignal, get: getDashboardCardMode },
  { key: 'metricOrder', signal: metricOrderSignal, get: getMetricOrder },
  { key: 'panelOrder', signal: panelOrderSignal, get: getPanelOrder },
  { key: 'stickyTop', signal: stickyTopSignal, get: getStickyTop },
  { key: 'stickyBottom', signal: stickyBottomSignal, get: getStickyBottom },
  { key: 'showRecentShots', signal: showRecentShotsSignal, get: getShowRecentShots },
  { key: 'recentShotCount', signal: recentShotCountSignal, get: getRecentShotCount },
  { key: 'metricsColumns', signal: metricsColumnsSignal, get: getMetricsColumns },
  { key: 'metricsLastRowFill', signal: metricsLastRowFillSignal, get: getMetricsLastRowFill },
  { key: 'compactPanels', signal: compactPanelsSignal, get: getCompactPanels },
  { key: 'profileChartHeight', signal: profileChartHeightSignal, get: getProfileChartHeight },
  { key: 'columnSpacing', signal: columnSpacingSignal, get: getColumnSpacing },
  { key: 'shotMetricSlots', signal: shotMetricSlotsSignal, get: getShotMetricSlots },
];

export const getDashboardMode = () => {
  if (!globalThis.window?.localStorage) return DASHBOARD_MODES.SIMPLE;
  try {
    const stored = localStorage.getItem(DASHBOARD_MODE_KEY);
    if (Object.values(DASHBOARD_MODES).includes(stored)) return stored;
    // No mode stored yet: keep existing customizations on Customize; new users
    // start on the Simple preset (identical to the previous default dashboard).
    const hasCustomization = Object.keys(localStorage).some(
      k => k.startsWith('dashboard') && k !== DASHBOARD_MODE_KEY,
    );
    return hasCustomization ? DASHBOARD_MODES.CUSTOM : DASHBOARD_MODES.SIMPLE;
  } catch {
    return DASHBOARD_MODES.SIMPLE;
  }
};

export const dashboardModeSignal = signal(getDashboardMode());

// Points the setting signals at the preset values (Simple/Advanced) or back at
// the stored customization (Customize). Stored per-setting keys are never
// overwritten, so switching to a preset and back restores the customization.
const applyDashboardSettings = mode => {
  const preset = DASHBOARD_PRESETS[mode];
  for (const binding of DASHBOARD_SETTING_BINDINGS) {
    const value = preset ? preset[binding.key] : binding.get();
    const resolved = typeof value === 'function' ? value() : value;
    binding.signal.value = Array.isArray(resolved) ? [...resolved] : resolved;
  }
};

export const setDashboardMode = mode => {
  if (!Object.values(DASHBOARD_MODES).includes(mode)) return false;
  try {
    localStorage.setItem(DASHBOARD_MODE_KEY, mode);
  } catch {
    // Persisting failed — still apply the mode for this session.
  }
  dashboardModeSignal.value = mode;
  applyDashboardSettings(mode);
  return true;
};

// A preset may be active from a previous session — apply it on load.
applyDashboardSettings(dashboardModeSignal.value);
