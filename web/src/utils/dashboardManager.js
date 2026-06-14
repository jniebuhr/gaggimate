import { signal } from '@preact/signals';

const DASHBOARD_LAYOUT_KEY = 'dashboardLayout';
const DASHBOARD_CARD_MODE_KEY = 'dashboardCardMode';

export const DASHBOARD_LAYOUTS = {
  ORDER_FIRST: 'order-first',
  ORDER_LAST: 'order-last',
};

export const DASHBOARD_CARD_MODES = {
  MULTI: 'multi',
  SINGLE: 'single',
};

export const getDashboardLayout = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
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
  if (typeof window === 'undefined' || !window.localStorage) {
    return DASHBOARD_CARD_MODES.MULTI;
  }
  try {
    return localStorage.getItem(DASHBOARD_CARD_MODE_KEY) || DASHBOARD_CARD_MODES.MULTI;
  } catch {
    return DASHBOARD_CARD_MODES.MULTI;
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

export const getMetricOrder = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [...DEFAULT_METRIC_ORDER];
  }
  try {
    const stored = localStorage.getItem(DASHBOARD_METRICS_KEY);
    return stored ? JSON.parse(stored) : [...DEFAULT_METRIC_ORDER];
  } catch {
    return [...DEFAULT_METRIC_ORDER];
  }
};

export const metricOrderSignal = signal(getMetricOrder());

export const setMetricOrder = (ids) => {
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

const DEFAULT_PANEL_ORDER = ['mode', 'profile', 'favorites', 'metrics', 'watertank', 'action'];

export const getPanelOrder = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
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

export const setPanelOrder = (ids) => {
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
  if (typeof window === 'undefined' || !window.localStorage) return true;
  try {
    return localStorage.getItem(DASHBOARD_STICKY_BOTTOM_KEY) !== 'false';
  } catch {
    return true;
  }
};

export const stickyBottomSignal = signal(getStickyBottom());

export const setStickyBottom = (value) => {
  try {
    localStorage.setItem(DASHBOARD_STICKY_BOTTOM_KEY, String(value));
    stickyBottomSignal.value = value;
    return true;
  } catch {
    return false;
  }
};

// ── Recent Shots visibility ─────────────────────────────────────────────────

const DASHBOARD_SHOW_RECENT_SHOTS_KEY = 'dashboardShowRecentShots';

export const getShowRecentShots = () => {
  if (typeof window === 'undefined' || !window.localStorage) return true;
  try {
    return localStorage.getItem(DASHBOARD_SHOW_RECENT_SHOTS_KEY) !== 'false';
  } catch {
    return true;
  }
};

export const showRecentShotsSignal = signal(getShowRecentShots());

export const setShowRecentShots = (value) => {
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
  if (typeof window === 'undefined' || !window.localStorage) return 2;
  try {
    const stored = localStorage.getItem(DASHBOARD_METRICS_COLUMNS_KEY);
    const n = stored ? parseInt(stored, 10) : 2;
    return Number.isFinite(n) && n >= 1 && n <= 4 ? n : 2;
  } catch {
    return 2;
  }
};

export const metricsColumnsSignal = signal(getMetricsColumns());

export const setMetricsColumns = (n) => {
  if (!Number.isInteger(n) || n < 1 || n > 4) return false;
  try {
    localStorage.setItem(DASHBOARD_METRICS_COLUMNS_KEY, String(n));
    metricsColumnsSignal.value = n;
    return true;
  } catch {
    return false;
  }
};

// ── Metrics last row fill ─────────────────────────────────────────────────

const DASHBOARD_METRICS_LAST_ROW_FILL_KEY = 'dashboardMetricsLastRowFill';

export const METRICS_LAST_ROW_FILLS = {
  EVEN: 'even',
  GRID: 'grid',
};

export const getMetricsLastRowFill = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
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

export const setMetricsLastRowFill = (value) => {
  if (!Object.values(METRICS_LAST_ROW_FILLS).includes(value)) return false;
  try {
    localStorage.setItem(DASHBOARD_METRICS_LAST_ROW_FILL_KEY, value);
    metricsLastRowFillSignal.value = value;
    return true;
  } catch {
    return false;
  }
};
