import { signal } from '@preact/signals';
import { i18n } from '@lingui/core';

// Simple i18n utility for loading and using translations
const currentLocale = signal('en');

// Initialize Lingui with English as default
i18n.loadAndActivate({ locale: 'en' });

// Load translations for a specific locale
export async function loadTranslations(locale) {
  try {
    // Import the single messages file for the locale
    const { messages } = await import(`../locales/${locale}/messages.po`);
    
    // Load and activate the locale with messages
    i18n.loadAndActivate({ locale, messages });
    currentLocale.value = locale;
  } catch (error) {
    console.error(`Error loading translations for locale ${locale}:`, error);
    // Fallback to English
    if (locale !== 'en') {
      await loadTranslations('en');
    }
  }
}

// Get translation for a key using Lingui's t function
export function t(key, values = {}) {
  return i18n._(key, values);
}

// Get current locale
export function getCurrentLocale() {
  return currentLocale.value;
}

// Set locale and load translations
export async function setLocale(locale) {
  await loadTranslations(locale);
}

// Initialize with default locale
export async function initI18n() {
  // Try to get locale from localStorage or default to 'en'
  const savedLocale = localStorage.getItem('locale') || 'en';
  await setLocale(savedLocale);
}

// Export signals for reactive components
export { currentLocale };
