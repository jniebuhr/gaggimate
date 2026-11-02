import { signal } from '@preact/signals';
import { appSettings } from './appSettings.js';

// Web bundles are published next to the firmware: stable on the latest release, nightly on the nightly pre-release.
const MANIFEST_URLS = {
  stable: 'https://github.com/jniebuhr/gaggimate/releases/latest/download/app-web.json',
  nightly: 'https://github.com/jniebuhr/gaggimate/releases/download/nightly/app-web.json',
};
const FAILED_KEY = 'gaggimate.failedBundle';

// Version of the web bundle that is running right now (stamped at build time).
export const bundleVersion = import.meta.env.BUNDLE_VERSION;
// Version downloaded and waiting to be applied on the next background, if any.
export const pendingUpdate = /* @__PURE__ */ signal(null);

let checking = false;

// Confirms the running bundle works; without it the updater rolls back to the previous bundle.
export async function markBundleHealthy() {
  const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
  await CapacitorUpdater.notifyAppReady();
  // Remember a bundle that had to be rolled back so it isn't downloaded again.
  await CapacitorUpdater.addListener('updateFailed', async ({ bundle }) => {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.set({ key: FAILED_KEY, value: bundle.version });
  });
}

// Downloads the channel's bundle when it differs from the running one; it applies on the next background.
export async function checkForUpdate() {
  if (checking) return;
  checking = true;
  try {
    const channel = appSettings.value.updateChannel;
    const response = await fetch(MANIFEST_URLS[channel], {
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!response.ok) return;
    const manifest = await response.json();
    if (!manifest?.version || !manifest.url || !manifest.checksum) return;
    if (manifest.version === bundleVersion || manifest.version === pendingUpdate.value) return;
    if (!(await nativeSupports(manifest.minAppVersion))) return;

    const { Preferences } = await import('@capacitor/preferences');
    const { value: failed } = await Preferences.get({ key: FAILED_KEY });
    if (failed === manifest.version) return;

    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
    const { bundles } = await CapacitorUpdater.list();
    const bundle =
      bundles.find(b => b.version === manifest.version && b.status !== 'error') ??
      (await CapacitorUpdater.download({
        url: manifest.url,
        version: manifest.version,
        checksum: manifest.checksum,
      }));
    await CapacitorUpdater.next({ id: bundle.id });
    pendingUpdate.value = manifest.version;
  } catch (err) {
    console.warn('Update check failed', err?.message || err);
  } finally {
    checking = false;
  }
}

// A bundle may rely on native code added in a later store release.
async function nativeSupports(minAppVersion) {
  if (!minAppVersion) return true;
  const { App } = await import('@capacitor/app');
  const { version } = await App.getInfo();
  return compareVersions(version, minAppVersion) >= 0;
}

function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
