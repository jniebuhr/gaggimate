const THEME_STORAGE_KEY = 'gaggimate-daisyui-theme';
const AVAILABLE_THEMES = ['light', 'dark', 'coffee', 'nord'];

export function getStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored && AVAILABLE_THEMES.includes(stored) ? stored : 'light';
  } catch (error) {
    console.warn('Failed to get stored theme:', error);
    return 'light';
  }
}

export function setStoredTheme(theme) {
  try {
    if (AVAILABLE_THEMES.includes(theme)) {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
      applyTheme(theme);
      return true;
    }
    return false;
  } catch (error) {
    console.warn('Failed to set stored theme:', error);
    return false;
  }
}

export function applyTheme(theme) {
  if (AVAILABLE_THEMES.includes(theme)) {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

export function getAvailableThemes() {
  return AVAILABLE_THEMES.map(theme => ({
    value: theme,
    label: theme.charAt(0).toUpperCase() + theme.slice(1),
  }));
}

// Initialize theme on load
export function initializeTheme() {
  const theme = getStoredTheme();
  applyTheme(theme);
}

// Simple function to handle theme change from select element
export function handleThemeChange(event) {
  const theme = event.target.value;
  setStoredTheme(theme);
}
