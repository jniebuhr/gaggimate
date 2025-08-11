const DASHBOARD_LAYOUT_KEY = 'dashboardLayout';

export const getDashboardLayout = () => {
  return localStorage.getItem(DASHBOARD_LAYOUT_KEY) || 'process-first';
};

export const setDashboardLayout = layout => {
  localStorage.setItem(DASHBOARD_LAYOUT_KEY, layout);
};

export const DASHBOARD_LAYOUTS = {
  PROCESS_FIRST: 'process-first',
  CHART_FIRST: 'chart-first',
};
