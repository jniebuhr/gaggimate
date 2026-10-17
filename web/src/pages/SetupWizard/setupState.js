import { signal } from '@preact/signals';
import {
  invalidateSettingsCache,
  prefetchSettings,
  updateSettingsCache,
} from '../../services/ApiService.js';

// True while the machine reports a first run that has not finished the setup wizard.
export const setupNeeded = signal(false);

export async function checkSetup({ fresh = false } = {}) {
  if (fresh) invalidateSettingsCache(); // another machine was selected in the app
  try {
    const settings = await prefetchSettings();
    setupNeeded.value = settings?.setupDone === false;
  } catch {
    // Older firmware or a failed fetch: never block the UI behind the wizard.
    setupNeeded.value = false;
  }
}

// Partial POST: the firmware only changes the fields a request carries (GM-214).
export async function postSettings(fields) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    body.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
  }
  const response = await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!response.ok) throw new Error(`POST /api/settings ${response.status}`);
  const data = await response.json();
  updateSettingsCache(data);
  return data;
}
