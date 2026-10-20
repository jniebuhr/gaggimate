import { i18n } from '@lingui/core';

// UI languages, in picker order; labels stay in their own language.
export const LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
];

const STORAGE_KEY = 'gaggimate.locale';
// 'auto' follows the browser/phone language.
export const AUTO_LOCALE = 'auto';

export function getStoredLocale() {
  try {
    return localStorage.getItem(STORAGE_KEY) || AUTO_LOCALE;
  } catch {
    return AUTO_LOCALE;
  }
}

function detectLocale() {
  const supported = new Set(LOCALES.map(l => l.code));
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = String(tag).toLowerCase().split('-')[0];
    if (supported.has(base)) return base;
  }
  return 'en';
}

function resolveLocale(preference) {
  return preference && preference !== AUTO_LOCALE ? preference : detectLocale();
}

// Catalogs are separate chunks, so a browser only downloads its own language.
export async function activateLocale(preference = getStoredLocale()) {
  const locale = resolveLocale(preference);
  const { messages } = await import(`./locales/${locale}/messages.po`);
  i18n.loadAndActivate({ locale, messages });
  document.documentElement.lang = locale;
}

export async function setLocale(preference) {
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Private mode or blocked storage: the choice lasts until reload.
  }
  await activateLocale(preference);
}

export { i18n };
