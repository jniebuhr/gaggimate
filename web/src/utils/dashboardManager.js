const DASHBOARD_LAYOUT_KEY = 'dashboardLayout';

export const DASHBOARD_LAYOUTS = {
  ORDER_FIRST: 'order-first',
  ORDER_LAST: 'order-last',
};

export const DEFAULT_LAYOUT = {
  cards: [
    { id: 'process', cols: 1, rows: 1 },
    { id: 'status', cols: 1, rows: 1 },
    { id: 'chart', cols: 2, rows: 2 },
  ]
};

export const getDashboardLayout = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_LAYOUT;
  }

  try {
    const stored = localStorage.getItem(DASHBOARD_LAYOUT_KEY);
    if (!stored) return DEFAULT_LAYOUT;
    return JSON.parse(stored);
  } catch (error) {
    console.warn('getDashboardLayout: localStorage access failed:', error);
    return DEFAULT_LAYOUT;
  }
};

export const setDashboardLayout = layout => {
  if (!layout || !layout.cards) {
    console.error('setDashboardLayout: Invalid layout object');
    return false;
  }

  try {
    localStorage.setItem(DASHBOARD_LAYOUT_KEY, JSON.stringify(layout));
    return true;
  } catch (error) {
    console.error('setDashboardLayout: Failed to store layout in localStorage:', error);
    return false;
  }
};