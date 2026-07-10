const THEME_STORAGE_KEY = 'gaggimate-daisyui-theme';
const SYSTEM_THEME = 'system';
const EXPLICIT_THEME_LIST = ['light', 'dark', 'coffee', 'nord'];
const EXPLICIT_THEMES = new Set(EXPLICIT_THEME_LIST);
const AVAILABLE_THEMES = new Set([SYSTEM_THEME, ...EXPLICIT_THEME_LIST]);

export function getStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored && AVAILABLE_THEMES.has(stored) ? stored : SYSTEM_THEME;
  } catch (error) {
    console.warn('Failed to get stored theme:', error);
    return SYSTEM_THEME;
  }
}

export function setStoredTheme(theme) {
  try {
    if (AVAILABLE_THEMES.has(theme)) {
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
  if (theme === SYSTEM_THEME) {
    delete document.documentElement.dataset.theme;
    return;
  }

  if (EXPLICIT_THEMES.has(theme)) {
    document.documentElement.dataset.theme = theme;
  }
}

export function getAvailableThemes() {
  return [
    { value: SYSTEM_THEME, label: 'System' },
    ...EXPLICIT_THEME_LIST.map(theme => ({
      value: theme,
      label: theme.charAt(0).toUpperCase() + theme.slice(1),
    })),
  ];
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
