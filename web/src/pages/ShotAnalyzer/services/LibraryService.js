/**
 * LibraryService.js
 *
 * Loads device shots and profiles and prepares device or temporary data for export.
 */

import { t } from '@lingui/core/macro';
import { parseBinaryIndex, indexToShotList } from '../../../services/shotHistory/parseBinaryIndex';
import { parseBinaryShot } from '../../../services/shotHistory/parseBinaryShot';
import { toExportShot } from '../../../services/shotHistory/exportShot';
import { notesService } from './NotesService';
import { getProfileDisplayLabel, getShotStorageKey } from '../utils/analyzerUtils';

const HISTORY_NOTES_DEFAULTS = {
  id: '',
  rating: 0,
  beanType: '',
  doseIn: '',
  doseOut: '',
  ratio: '',
  grindSetting: '',
  balanceTaste: 'balanced',
  notes: '',
};

function normalizeNotesForHistoryExport(notes, shotId) {
  const merged = {
    ...HISTORY_NOTES_DEFAULTS,
    ...notes,
    id: String(shotId ?? notes?.id ?? ''),
  };

  return {
    id: merged.id,
    rating: merged.rating ?? 0,
    beanType: merged.beanType ?? '',
    doseIn: merged.doseIn ?? '',
    doseOut: merged.doseOut ?? '',
    ratio: merged.ratio ?? '',
    grindSetting: merged.grindSetting ?? '',
    balanceTaste: merged.balanceTaste ?? 'balanced',
    notes: merged.notes ?? '',
  };
}

function buildHistoryLikeShotExport(rawShot, listItem, notes) {
  const shotId = rawShot?.id ?? listItem?.id ?? listItem?.name ?? '';
  return toExportShot(
    {
      id: String(shotId),
      profile: rawShot?.profile || listItem?.profile || '',
      profileId: rawShot?.profileId || listItem?.profileId || '',
      ...rawShot,
      samples: Array.isArray(rawShot.samples) ? rawShot.samples : [],
      volume: listItem?.volume ?? rawShot?.volume ?? null,
      rating: listItem?.rating ?? null,
      incomplete: listItem?.incomplete ?? rawShot?.incomplete ?? false,
      loaded: true,
      data: null,
    },
    normalizeNotesForHistoryExport(notes, shotId),
  );
}

const PROFILE_EXPORT_METADATA_FIELDS = [
  'id',
  'selected',
  'favorite',
  'name',
  'source',
  'uploadedAt',
  'exportName',
  'fileName',
  'profileId',
  'storageKey',
  'data',
];

function ensureJsonFilename(filename) {
  const resolvedFilename = String(filename || 'export.json');
  if (
    resolvedFilename.toLowerCase().endsWith('.json') ||
    resolvedFilename.toLowerCase().endsWith('.slog')
  ) {
    return resolvedFilename;
  }
  return `${resolvedFilename}.json`;
}

function getProfileExportFilename(profile, fallback = 'profile') {
  const label = getProfileDisplayLabel(profile, fallback);
  return ensureJsonFilename(label || fallback || 'profile');
}

function getShotExportFilename(item) {
  if (item?.exportName) return ensureJsonFilename(item.exportName);
  if (item?.id) return ensureJsonFilename(`shot-${item.id}`);
  return ensureJsonFilename(item?.storageKey || item?.fileName || item?.name || 'shot');
}

function cleanProfileForExport(profile, fallbackProfile = null) {
  const clean = { ...profile };
  if (!clean.label && fallbackProfile) {
    clean.label = getProfileDisplayLabel(fallbackProfile, '');
  }

  PROFILE_EXPORT_METADATA_FIELDS.forEach(field => {
    delete clean[field];
  });

  return clean;
}

class LibraryService {
  apiService = null;

  /**
   * Set API service reference
   * @param {ApiService} apiService
   */
  setApiService(apiService) {
    this.apiService = apiService;
  }

  /**
   * Get shots from GaggiMate controller
   * @returns {Promise<Object[]>} List of GaggiMate shots with source tag
   */
  async getAllShots() {
    try {
      const response = await fetch('/api/history/index.bin');

      if (!response.ok) {
        if (response.status === 404) {
          return [];
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const indexData = parseBinaryIndex(arrayBuffer);
      const shotList = indexToShotList(indexData);

      // Add source tag and ensure name property exists
      return shotList
        .map(shot => ({
          ...shot,
          name: shot.profile || shot.id || 'Unknown', // Display Name for UI (e.g. "Turbo Bloom")
          exportName: `shot-${shot.id}.json`, // Real Filename for Export (e.g. "shot-1701234.json")
          source: 'gaggimate',
        }))
        .sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Failed to load GaggiMate shots:', error);
      return [];
    }
  }

  /**
   * Get profiles from GaggiMate controller
   * @returns {Promise<Object[]>} List of GaggiMate profiles with source tag
   */
  async getAllProfiles() {
    if (this.apiService?.socket?.readyState !== WebSocket.OPEN) {
      return [];
    }

    try {
      const response = await this.apiService.request({
        tp: 'req:profiles:list',
        minimal: true,
      });

      if (!response.profiles) {
        return [];
      }

      // Add source tag and preserve the API id for req:profiles:load.
      return response.profiles
        .map(profile => ({
          ...profile,
          exportName: getProfileExportFilename(profile),
          profileId: profile.id, // Keep real API id for req:profiles:load
          label: profile.label,
          source: 'gaggimate',
        }))
        .sort((a, b) => getProfileDisplayLabel(a, '').localeCompare(getProfileDisplayLabel(b, '')));
    } catch (error) {
      console.error('Failed to load GaggiMate profiles:', error);
      return [];
    }
  }

  /**
   * Load full shot data
   * @param {string} id - Shot ID
   * @param {{ signal?: AbortSignal }} options - Optional request controls for GaggiMate fetches
   * @returns {Promise<Object>} Full shot data with samples
   */
  async loadShot(id, { signal } = {}) {
    const idStr = String(id);

    const paddedId = idStr.padStart(6, '0');
    const response = await fetch(`/api/history/${paddedId}.slog`, { signal });

    if (!response.ok) {
      const status = response.status;
      throw new Error(t`Failed to load shot ${idStr}: HTTP ${status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const shot = parseBinaryShot(arrayBuffer, idStr);
    shot.source = 'gaggimate';
    return shot;
  }

  /**
   * Load full profile data
   * @param {string} id - Internal device profile ID
   * @returns {Promise<Object>} Full profile data
   */
  async loadProfile(id) {
    if (this.apiService?.socket?.readyState !== WebSocket.OPEN) {
      throw new Error(t`WebSocket not connected`);
    }

    const response = await this.apiService.request({
      tp: 'req:profiles:load',
      id,
    });

    if (!response.profile) {
      throw new Error(t`Profile ${id} not found`);
    }

    return {
      ...response.profile,
      source: 'gaggimate',
    };
  }

  /**
   * PREPARE EXPORT DATA
   * Fetches the original data and cleans it for export.
   * @param {Object} item - The library item (shot or profile)
   * @param {boolean} isShot - True if item is a shot
   * @returns {Promise<{ exportData: Object, filename: string }>} Export payload and filename
   */
  async exportItem(item, isShot) {
    let exportData = null;
    let filename = isShot
      ? getShotExportFilename(item)
      : ensureJsonFilename(item.exportName || item.name || item.id || 'export.json');

    if (item.source === 'gaggimate') {
      if (isShot) {
        // SHOT EXPORT (GM):
        // We MUST load the full shot because the list item only has summary data.
        // Use the 'id' (timestamp) to load, ignoring the 'name' (profile name).
        const loadId = item.id;
        if (!loadId) throw new Error(t`Shot ID missing for export`);

        const fullShot = await this.loadShot(loadId);
        delete fullShot.source;

        const notes = await notesService.loadExportNotes(loadId);
        const metadata = { ...item };
        ['source', 'name', 'exportName', 'storageKey', 'fileName'].forEach(key => {
          delete metadata[key];
        });
        exportData = toExportShot(
          {
            ...metadata,
            ...fullShot,
            volume: item.volume ?? fullShot.volume,
            rating: item.rating ?? fullShot.rating,
            incomplete: item.incomplete ?? fullShot.incomplete,
          },
          notes,
        );
      } else {
        // PROFILE EXPORT (GM):
        // Load fresh from controller using the hidden profileId
        const loadId = item.profileId || item.id;
        if (!loadId) throw new Error(t`Profile ID missing for export`);

        const raw = await this.loadProfile(loadId);
        filename = getProfileExportFilename(
          raw,
          item.label || item.name || item.fileName || item.exportName || item.id || 'profile',
        );
        exportData = cleanProfileForExport(raw, item);
      }
    } else if (isShot) {
      // Temporary imports already carry the full shot payload.
      const exportShot = { ...(item.data || item) };
      delete exportShot.source;
      delete exportShot.uploadedAt;

      const shotNotesKey = getShotStorageKey(item);
      const notes = await notesService.loadNotes(shotNotesKey, 'temp');
      exportData = buildHistoryLikeShotExport(exportShot, item, notes);
    } else {
      const rawProfile = item.data || item;
      filename = getProfileExportFilename(
        rawProfile,
        item.label || item.name || item.fileName || item.exportName || item.id || 'profile',
      );
      exportData = cleanProfileForExport(rawProfile, item);
    }

    // Return raw object
    // The UI helper 'downloadJson' will handle stringify and blob creation.
    return { exportData, filename };
  }

  /**
   * Delete a shot
   * @param {string} id - Shot ID
   */
  async deleteShot(id) {
    if (!this.apiService) throw new Error('ApiService not set');
    const response = await this.apiService.request({ tp: 'req:history:delete', id });
    if (response?.error) throw new Error(response.error);
  }

  /**
   * Delete a profile
   * @param {string} id - Internal device profile ID
   */
  async deleteProfile(id) {
    if (!this.apiService) throw new Error('ApiService not set');
    await this.apiService.request({ tp: 'req:profiles:delete', id });
  }
}

export const libraryService = new LibraryService();
