import { effect } from '@preact/signals';
import { WARNINGS } from '../utils/warnings.js';
import { appSettings } from './appSettings.js';
import { machines } from './machines.js';
import { nativePlatform } from './platform.js';

let BackgroundMonitor = null;

// Loads the plugin lazily; never return the plugin proxy from an async function.
async function loadBackgroundMonitor() {
  if (BackgroundMonitor) return;
  const { registerPlugin } = await import('@capacitor/core');
  BackgroundMonitor = registerPlugin('BackgroundMonitor');
}

// Frees all machine sockets in the background; on Android MachineMonitorService takes over meanwhile.
export async function watchAppLifecycle(apiService, notificationService) {
  const { App } = await import('@capacitor/app');
  await App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) {
      apiService.reopen();
      notificationService.resume();
    } else {
      notificationService.suspend();
      apiService.close();
    }
  });

  if (nativePlatform() !== 'android') return;
  await loadBackgroundMonitor();
  const warningLabels = Object.fromEntries(WARNINGS.map(w => [w.key, w.label]));
  effect(() => {
    const { enabled, ...events } = appSettings.value.notifications;
    BackgroundMonitor.configure({
      enabled: enabled && machines.value.length > 0,
      machines: machines.value.map(({ name, host }) => ({ name, host })),
      events,
      warningLabels,
    });
  });
}
