import { signal } from '@preact/signals';

const DASHBOARD_LAYOUT_KEY = 'dashboardLayout';
const DASHBOARD_CARD_MODE_KEY = 'dashboardCardMode';

export const getDashboardLayout = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DASHBOARD_LAYOUTS.ORDER_FIRST;
  }

  try {
    return localStorage.getItem(DASHBOARD_LAYOUT_KEY) || DASHBOARD_LAYOUTS.ORDER_FIRST;
  } catch (error) {
    console.warn('getDashboardLayout: localStorage access failed:', error);
    return DASHBOARD_LAYOUTS.ORDER_FIRST;
  }
};

export const setDashboardLayout = layout => {
  if (layout === null || layout === undefined) {
    console.error('setDashboardLayout: Layout cannot be null or undefined');
    return false;
  }

  try {
    localStorage.setItem(DASHBOARD_LAYOUT_KEY, layout);
    return true;
  } catch (error) {
    console.error('setDashboardLayout: Failed to store layout in localStorage:', error);
    return false;
  }
};

export const DASHBOARD_LAYOUTS = {
  ORDER_FIRST: 'order-first',
  ORDER_LAST: 'order-last',
};

export const DASHBOARD_CARD_MODES = {
  MULTI: 'multi',
  SINGLE: 'single',
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

export const setDashboardCardMode = mode => {
  try {
    localStorage.setItem(DASHBOARD_CARD_MODE_KEY, mode);
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
