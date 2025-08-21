const DASHBOARD_LAYOUT_KEY = 'dashboardLayout';

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
