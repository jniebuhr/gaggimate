import { effect, signal } from '@preact/signals';
import { machine } from '../services/ApiService.js';
import {
  activeMachineId,
  installMachineApiRewrite,
  loadMachines,
  updateMachineVersion,
} from './machines.js';
import { loadAppSettings } from './appSettings.js';
import { NotificationService } from './notifications.js';
import { watchAppLifecycle } from './lifecycle.js';
import { checkForUpdate, markBundleHealthy } from './updates.js';

// Becomes true once the active machine's live connection has opened in this session.
export const hasConnected = /* @__PURE__ */ signal(false);

// Native app (Capacitor) entry points; everything app-only lives in src/app.
export async function initApp() {
  await Promise.all([loadMachines(), loadAppSettings()]);
  installMachineApiRewrite();
  effect(() => {
    if (machine.value.connected) hasConnected.value = true;
  });
}

// Starts app-only services once the UI and its machine connection exist.
export function onAppRendered(apiService) {
  // The UI rendered, so this web bundle works; only then look for a newer one.
  markBundleHealthy()
    .then(checkForUpdate)
    .catch(err => console.warn('Updater unavailable', err?.message || err));
  trackFirmwareVersion(apiService);
  const notificationService = new NotificationService(apiService);
  watchAppLifecycle(apiService, notificationService);
  hideSplashAfterFirstPaint();
}

// Asks for the firmware version on every (re)connect so the machine selector's warning stays current.
function trackFirmwareVersion(apiService) {
  apiService.on('res:ota-settings', message => {
    updateMachineVersion(activeMachineId.value, message.displayVersion);
  });
  let wasConnected = false;
  effect(() => {
    const connected = machine.value.connected;
    if (connected && !wasConnected) {
      try {
        apiService.send({ tp: 'req:ota-settings' });
      } catch {
        // Socket closed again in the meantime; the next connect asks again.
      }
    }
    wasConnected = connected;
  });
}

// Hides the native splash after first paint, but keeps it up for at least SPLASH_MIN_MS since launch.
function hideSplashAfterFirstPaint() {
  const SPLASH_MIN_MS = 1500;
  requestAnimationFrame(() =>
    requestAnimationFrame(() =>
      setTimeout(
        () => import('@capacitor/splash-screen').then(({ SplashScreen }) => SplashScreen.hide()),
        Math.max(0, SPLASH_MIN_MS - performance.now()),
      ),
    ),
  );
}
