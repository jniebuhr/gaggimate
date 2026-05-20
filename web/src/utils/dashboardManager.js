const DASHBOARD_LAYOUT_KEY = 'dashboardLayout';
const DASHBOARD_UPDOWN_LAYOUT_KEY = 'upDownLayout';

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

export const getDashboardUpDownLayout = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }

  try {
    return localStorage.getItem(DASHBOARD_UPDOWN_LAYOUT_KEY) === 'true';
  } catch (error) {
    console.warn('getDashboardUpDownLayout: localStorage access failed:', error);
    return false;
  }
};

export const setDashboardUpDownLayout = layout => {
  if (layout === null || layout === undefined || typeof layout !== 'boolean') {
    console.error('setDashboardUpDownLayout: Layout must be a boolean value');
    return false;
  }

  try {
    localStorage.setItem(DASHBOARD_UPDOWN_LAYOUT_KEY, layout);
    return true;
  } catch (error) {
    console.error('setDashboardUpDownLayout: Failed to store layout in localStorage:', error);
    return false;
  }
}

export const DASHBOARD_LAYOUTS = {
  ORDER_FIRST: 'order-first',
  ORDER_LAST: 'order-last',
};
