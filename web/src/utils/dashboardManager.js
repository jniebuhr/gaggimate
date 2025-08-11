const DASHBOARD_LAYOUT_KEY = 'dashboardLayout';

export const getDashboardLayout = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return 'process-first';
  }

  try {
    return localStorage.getItem(DASHBOARD_LAYOUT_KEY) || 'process-first';
  } catch (error) {
    console.warn('getDashboardLayout: localStorage access failed:', error);
    return 'process-first';
  }
};

export const setDashboardLayout = layout => {
  if (layout === null || layout === undefined) {
    console.error('setDashboardLayout: Layout cannot be null or undefined');
    return false;
  }

  let serializedLayout;
  try {
    serializedLayout = JSON.stringify(layout);
  } catch (error) {
    console.error('setDashboardLayout: Layout is not JSON-serializable:', error);
    return false;
  }

  try {
    localStorage.setItem(DASHBOARD_LAYOUT_KEY, serializedLayout);
    return true;
  } catch (error) {
    console.error('setDashboardLayout: Failed to store layout in localStorage:', error);
    return false;
  }
};

export const DASHBOARD_LAYOUTS = {
  PROCESS_FIRST: 'process-first',
  CHART_FIRST: 'chart-first',
};
