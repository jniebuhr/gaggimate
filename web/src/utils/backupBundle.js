import { parseBinaryIndex, indexToShotList } from '../pages/ShotHistory/parseBinaryIndex.js';
import { parseBinaryShot } from '../pages/ShotHistory/parseBinaryShot.js';
import {
  buildShotHistoryArchive,
  importShotHistoryArchive,
} from '../pages/ShotHistory/historyArchive.js';
import { indexedDBService } from '../pages/ShotAnalyzer/services/IndexedDBService.js';
import { notesService } from '../pages/ShotAnalyzer/services/NotesService.js';
import {
  exportBeanData,
  getCurrentBeanSelection,
  restoreBeanData,
} from './beanManager.js';
import { getDashboardLayout, setDashboardLayout } from './dashboardManager.js';
import {
  getStoredGoogleDriveClientId,
  setStoredGoogleDriveClientId,
} from './googleDriveBackup.js';
import { getStoredTheme, setStoredTheme } from './themeManager.js';

const CURRENT_VERSION = 2;

const MIGRATIONS = {
  // v1 -> v2: rename type from 'gaggimate-google-drive-backup' to 'gaggimate-backup'
  1: (bundle) => ({
    ...bundle,
    type: 'gaggimate-backup',
    version: 2,
  }),
};

export function migrateToCurrent(bundle) {
  if (!bundle) {
    throw new Error('Cannot migrate null or undefined bundle.');
  }
  let current = bundle;

  // Handle legacy bundles with no version field (treat as v1)
  if (current.version === undefined) {
    current = { ...current, version: 1 };
  }

  const targetVersion = CURRENT_VERSION;

  while (current.version < targetVersion) {
    const nextVersion = current.version + 1;
    const migration = MIGRATIONS[current.version];
    if (!migration) {
      throw new Error(`No migration available from v${current.version} to v${nextVersion}`);
    }
    current = migration(current);
  }
  return current;
}

function sanitizeProfile(profile) {
  return { ...profile };
}

async function fetchSettingsSnapshot() {
  const response = await fetch('/api/settings');
  if (!response.ok) {
    throw new Error(`Failed to load settings (HTTP ${response.status}).`);
  }
  return response.json();
}

async function fetchProfilesSnapshot(apiService) {
  const response = await apiService.request({ tp: 'req:profiles:list' });
  if (!Array.isArray(response.profiles)) {
    console.warn('Profiles response missing expected array:', response);
    return [];
  }
  return response.profiles.map(sanitizeProfile);
}

async function loadDeviceShotSamples(shot) {
  const paddedId = String(shot.id).padStart(6, '0');
  try {
    const resp = await fetch(`/api/history/${paddedId}.slog`);
    if (!resp.ok) return shot;
    const parsed = parseBinaryShot(await resp.arrayBuffer(), shot.id);
    return { ...shot, samples: parsed.samples, loaded: true };
  } catch {
    return shot;
  }
}

async function fetchShotHistorySnapshot(apiService) {
  notesService.setApiService(apiService);
  const shots = [];

  const browserShots = await indexedDBService.getAllShots();
  for (const shot of browserShots) {
    const storageKey = shot.storageKey || shot.name || shot.id;
    const notes = await notesService.loadNotes(storageKey, 'browser');
    shots.push({
      ...shot,
      id: String(shot.id || storageKey),
      source: 'browser',
      notes,
      loaded: Array.isArray(shot.samples) && shot.samples.length > 0,
    });
  }

  const indexResponse = await fetch('/api/history/index.bin');
  if (indexResponse.ok) {
    const indexData = parseBinaryIndex(await indexResponse.arrayBuffer());
    const deviceShotsMeta = indexToShotList(indexData);
    const deviceShots = await Promise.all(
      deviceShotsMeta.map(async shot => {
        const notes = await notesService.loadNotes(String(shot.id), 'gaggimate');
        const withNotes = { ...shot, id: String(shot.id), source: 'gaggimate', notes };
        return loadDeviceShotSamples(withNotes);
      }),
    );
    shots.push(...deviceShots);
  } else if (indexResponse.status !== 404) {
    throw new Error(`Failed to load shot history index (HTTP ${indexResponse.status}).`);
  }

  return buildShotHistoryArchive(shots);
}

export async function createBackupBundle(apiService) {
  const [settings, profiles, shotHistory] = await Promise.all([
    fetchSettingsSnapshot(),
    fetchProfilesSnapshot(apiService),
    fetchShotHistorySnapshot(apiService),
  ]);

  return {
    type: 'gaggimate-backup',
    version: CURRENT_VERSION,
    exportedAt: new Date().toISOString(),
    web: {
      theme: getStoredTheme(),
      dashboardLayout: getDashboardLayout(),
      googleDriveClientId: getStoredGoogleDriveClientId(),
    },
    settings,
    profiles,
    beans: await exportBeanData(apiService),
    shotHistory,
    selectedBean: getCurrentBeanSelection(),
  };
}

function appendIfTruthy(formData, key, value) {
  if (value) {
    formData.append(key, 'on');
  }
}

async function restoreSettingsSnapshot(settings) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(settings || {})) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'boolean') {
      appendIfTruthy(formData, key, value);
    } else {
      formData.append(key, String(value));
    }
  }

  const response = await fetch('/api/settings', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Failed to restore settings (HTTP ${response.status}).`);
  }

  return response.json();
}

async function restoreProfilesSnapshot(apiService, profiles) {
  for (const profile of profiles || []) {
    await apiService.request({ tp: 'req:profiles:save', profile });
  }
}

async function restoreSelectedProfile(apiService, profiles) {
  const selected = (profiles || []).find(profile => profile.selected);
  if (selected?.id) {
    await apiService.request({ tp: 'req:profiles:select', id: selected.id });
  }
}

export async function restoreBackupBundle(apiService, bundle) {
  const migrated = migrateToCurrent(bundle);

  if (migrated.type !== 'gaggimate-backup') {
    throw new Error('Unsupported backup format.');
  }

  notesService.setApiService(apiService);

  if (migrated.web?.theme) {
    setStoredTheme(migrated.web.theme);
  }
  if (migrated.web?.dashboardLayout) {
    setDashboardLayout(migrated.web.dashboardLayout);
  }
  if (migrated.web?.googleDriveClientId) {
    setStoredGoogleDriveClientId(migrated.web.googleDriveClientId);
  }

  if (migrated.settings) {
    await restoreSettingsSnapshot(migrated.settings);
  }
  if (migrated.profiles) {
    await restoreProfilesSnapshot(apiService, migrated.profiles);
    await restoreSelectedProfile(apiService, migrated.profiles);
  }
  if (migrated.beans) {
    await restoreBeanData(apiService, migrated.beans);
  }
  if (migrated.selectedBean?.beanName !== undefined) {
    apiService.send({ tp: 'req:beans:select', name: migrated.selectedBean?.beanName || '' });
  }
  if (migrated.shotHistory) {
    await importShotHistoryArchive(migrated.shotHistory);
  }
}
