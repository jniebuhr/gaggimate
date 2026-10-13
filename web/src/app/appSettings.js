import { signal } from '@preact/signals';
import { isApp } from './platform.js';

// Settings that belong to the phone, not to a machine; persisted with Capacitor Preferences.
const STORAGE_KEY = 'gaggimate.appSettings';

export const NOTIFICATION_EVENTS = [
  { key: 'preheated', label: 'Machine preheated', help: 'The boiler reached brew temperature.' },
  { key: 'shotStarted', label: 'Shot started', help: 'A brew started on the machine.' },
  { key: 'shotFinished', label: 'Shot finished', help: 'With shot time and weight.' },
  {
    key: 'steamLeftOn',
    label: 'Steam mode left on',
    help: 'The machine has been in steam mode for 5 minutes.',
  },
  { key: 'warnings', label: 'Warnings', help: 'E.g. water tank low, scale battery low.' },
  { key: 'errors', label: 'Errors', help: 'Controller errors and error-level warnings.' },
];

const DEFAULTS = {
  // Release channel for web UI updates (see updates.js).
  updateChannel: 'stable',
  notifications: {
    enabled: false,
    preheated: true,
    shotStarted: false,
    shotFinished: true,
    steamLeftOn: true,
    warnings: false,
    errors: true,
  },
};

export const appSettings = /* @__PURE__ */ signal(DEFAULTS);

export async function loadAppSettings() {
  if (!isApp) return;
  // Never return the Preferences plugin from an async function: resolving it calls the proxy's then().
  const { Preferences } = await import('@capacitor/preferences');
  const { value } = await Preferences.get({ key: STORAGE_KEY });
  try {
    const stored = JSON.parse(value ?? '{}');
    appSettings.value = {
      ...DEFAULTS,
      ...stored,
      notifications: { ...DEFAULTS.notifications, ...stored.notifications },
    };
  } catch {
    appSettings.value = DEFAULTS;
  }
}

export function updateNotificationSettings(changes) {
  return saveAppSettings({
    ...appSettings.value,
    notifications: { ...appSettings.value.notifications, ...changes },
  });
}

export function setUpdateChannel(updateChannel) {
  return saveAppSettings({ ...appSettings.value, updateChannel });
}

async function saveAppSettings(next) {
  const { Preferences } = await import('@capacitor/preferences');
  await Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(next) });
  appSettings.value = next;
}
