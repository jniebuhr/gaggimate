const THEME_STORAGE_KEY = 'gaggimate-daisyui-theme';
const NOTHING_THEME_VARIANT_KEY = 'gaggimate-nothing-theme';
const AVAILABLE_THEMES = ['light', 'dark', 'coffee', 'nord', 'amoled', 'stealth', 'crisp', 'nothing'];

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
    // Also check the corresponding theme-controller radio so daisyUI 5 CSS selectors work
    const radio = document.querySelector(`input.theme-controller[value="${theme}"]`);
    if (radio) {
      radio.checked = true;
    }
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
  // If nothing theme is selected, also apply the variant (dark/light)
  if (theme === 'nothing') {
    applyNothingThemeVariant();
  }
  // Also check the stored theme's radio on load
  const radio = document.querySelector(`input.theme-controller[value="${theme}"]`);
  if (radio) {
    radio.checked = true;
  }
}

// Nothing theme variant (dark = 'nothing', light = 'nothing-light')
export function getNothingThemeVariant() {
  try {
    const stored = localStorage.getItem(NOTHING_THEME_VARIANT_KEY);
    return stored === 'nothing-light' ? 'nothing-light' : 'nothing';
  } catch {
    return 'nothing';
  }
}

export function setNothingThemeVariant(variant) {
  try {
    localStorage.setItem(NOTHING_THEME_VARIANT_KEY, variant === 'nothing-light' ? 'nothing-light' : 'nothing');
  } catch (error) {
    console.warn('Failed to set nothing theme variant:', error);
  }
}

export function applyNothingThemeVariant() {
  const theme = getStoredTheme();
  if (theme === 'nothing') {
    const variant = getNothingThemeVariant();
    document.documentElement.setAttribute('data-theme', variant);
  }
}

// Simple function to handle theme change from select element
export function handleThemeChange(event) {
  const theme = event.target.value;
  setStoredTheme(theme);
  // If switching to nothing, also apply the stored variant
  if (theme === 'nothing') {
    applyNothingThemeVariant();
  }
}
