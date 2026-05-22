/**
 * LibraryService.js
 *
 * Unified service for loading shots and profiles from multiple sources:
 * - GaggiMate Controller (via API)
 * - Browser Uploads (via IndexedDB)
 */

import { parseBinaryIndex, indexToShotList } from '../../ShotHistory/parseBinaryIndex';
import { parseBinaryShot } from '../../ShotHistory/parseBinaryShot';
import { indexedDBService } from './IndexedDBService';
import { notesService } from './NotesService';
import { getProfileDisplayLabel } from '../utils/analyzerUtils';
import { safeGaggiMateClient } from '../../../services/SafeGaggiMateClient.js';

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

const GAGGIMATE_CACHE_SOURCE = 'gaggimate-cache';
const GAGGIMATE_HTTP_TIMEOUT_MS = 1800;

function round2(v) {
  if (v == null || Number.isNaN(v)) return v;
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = GAGGIMATE_HTTP_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

function normalizeShotSampleForHistoryExport(sample = {}) {
  return {
    t: sample.t,
    tt: round2(sample.tt),
    ct: round2(sample.ct),
    tp: round2(sample.tp),
    cp: round2(sample.cp),
    fl: round2(sample.fl),
    tf: round2(sample.tf),
    pf: round2(sample.pf),
    vf: round2(sample.vf),
    v: round2(sample.v),
    ev: round2(sample.ev),
    pr: round2(sample.pr),
    systemInfo: sample.systemInfo,
    phaseNumber: sample.phaseNumber,
    phaseDisplayNumber: sample.phaseDisplayNumber,
  };
}

function normalizeNotesForHistoryExport(notes, shotId) {
  const merged = {
    ...HISTORY_NOTES_DEFAULTS,
    ...(notes || {}),
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

  const base = {
    id: String(shotId),
    profile: rawShot?.profile || listItem?.profile || '',
    profileId: rawShot?.profileId || listItem?.profileId || '',
    timestamp: rawShot?.timestamp,
    duration: rawShot?.duration,
    samples: Array.isArray(rawShot?.samples)
      ? rawShot.samples.map(normalizeShotSampleForHistoryExport)
      : [],
    volume: listItem?.volume ?? rawShot?.volume ?? null,
    rating: listItem?.rating ?? null,
    incomplete: listItem?.incomplete ?? rawShot?.incomplete ?? false,
    notes: normalizeNotesForHistoryExport(notes, shotId),
    loaded: true,
    data: null,
  };

  return {
    ...base,
    ...rawShot,
    samples: base.samples,
    volume: round2(base.volume),
    rating: base.rating,
    incomplete: base.incomplete,
    notes: base.notes,
    loaded: true,
    data: null,
  };
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
  'cachedAt',
  'gaggimateId',
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

function cleanProfileForExport(profile, fallbackProfile = null) {
  const clean = { ...(profile || {}) };
  if (!clean.label && fallbackProfile) {
    clean.label = getProfileDisplayLabel(fallbackProfile, '');
  }

  PROFILE_EXPORT_METADATA_FIELDS.forEach(field => {
    delete clean[field];
  });

  return clean;
}

class LibraryService {
  constructor() {
    this.apiService = null;
  }

  /**
   * Set API service reference
   * @param {ApiService} apiService
   */
  setApiService(apiService) {
    this.apiService = apiService;
    safeGaggiMateClient.setApiService(apiService);
  }

  /**
   * Get shots from GaggiMate controller
   * @returns {Promise<Object[]>} List of GaggiMate shots with source tag
   */
  async getGaggiMateShots() {
    try {
      const response = await fetchWithTimeout('/api/history/index.bin');

      if (!response.ok) {
        if (response.status === 404) {
          // No shots yet
          console.log('No shot index found on GM');
          return [];
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const indexData = parseBinaryIndex(arrayBuffer);
      const shotList = indexToShotList(indexData);

      const normalizedShots = shotList.map(shot => ({
        ...shot,
        name: shot.profile || shot.id || 'Unknown',
        exportName: `shot-${shot.id}.json`,
        source: 'gaggimate',
      }));

      // Mirror into IndexedDB for offline use without blocking the live UI.
      Promise.all(normalizedShots.map(shot => indexedDBService.saveCachedGaggiMateShot(shot))).catch(
        error => console.warn('Failed to cache GaggiMate shots:', error),
      );

      return normalizedShots;
    } catch (error) {
      console.error('Failed to load GaggiMate shots:', error);
      return [];
    }
  }

  /**
   * Get shots from browser uploads and offline mirrors
   * @returns {Promise<Object[]>} List of browser shots with source tag
   */
  async getBrowserShots() {
    try {
      const shots = await indexedDBService.getAllShots();
      return shots.map(shot => ({
        ...shot,
        storageKey: shot.storageKey || shot.name || String(shot.id || ''),
      }));
    } catch (error) {
      console.error('Failed to load browser shots:', error);
      return [];
    }
  }

  /**
   * Get merged shot list from all sources
   * @param {string} sourceFilter - 'both', 'gaggimate', or 'browser'
   * @returns {Promise<Object[]>} Filtered and merged shot list
   */
  async getAllShots(sourceFilter = 'both') {
    let results = [];

    if (sourceFilter === 'browser') {
      results = [await this.getBrowserShots()];
    } else if (sourceFilter === 'gaggimate') {
      results = [await this.getGaggiMateShots()];
    } else {
      const browserShots = await this.getBrowserShots();
      const gaggimateShots = await this.getGaggiMateShots();
      results = [browserShots, gaggimateShots];
    }

    const merged = results.flat();

    // Deduplicate preferring live GaggiMate over offline cache
    const deduped = new Map();

    merged.forEach(shot => {
      const key = String(shot.gaggimateId || shot.id || shot.storageKey || shot.name || '');
      const existing = deduped.get(key);

      if (!existing) {
        deduped.set(key, shot);
        return;
      }

      if (existing.source === GAGGIMATE_CACHE_SOURCE && shot.source === 'gaggimate') {
        deduped.set(key, shot);
      }
    });

    // Sort by timestamp (newest first)
    return Array.from(deduped.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get profiles from GaggiMate controller
   * @returns {Promise<Object[]>} List of GaggiMate profiles with source tag
   */
  async getGaggiMateProfiles() {
    if (!safeGaggiMateClient.isConnected()) {
      console.log('WebSocket not ready, skipping GM profiles');
      return [];
    }

    try {
      const response = await safeGaggiMateClient.listProfiles();

      if (!response.profiles) {
        return [];
      }

      const normalizedProfiles = response.profiles.map(profile => ({
        ...profile,
        exportName: getProfileExportFilename(profile),
        profileId: profile.id,
        label: profile.label,
        source: 'gaggimate',
      }));

      // Mirror into IndexedDB for offline use without blocking the live UI.
      Promise.all(
        normalizedProfiles.map(profile => indexedDBService.saveCachedGaggiMateProfile(profile)),
      ).catch(error => console.warn('Failed to cache GaggiMate profiles:', error));

      return normalizedProfiles;
    } catch (error) {
      console.error('Failed to load GaggiMate profiles:', error);
      return [];
    }
  }

  /**
   * Get profiles from browser uploads and offline mirrors
   * @returns {Promise<Object[]>} List of browser profiles with source tag
   */
  async getBrowserProfiles() {
    try {
      return await indexedDBService.getAllProfiles();
    } catch (error) {
      console.error('Failed to load browser profiles:', error);
      return [];
    }
  }

  /**
   * Get merged profile list from all sources
   * @param {string} sourceFilter - 'both', 'gaggimate', or 'browser'
   * @returns {Promise<Object[]>} Filtered and merged profile list
   */
  async getAllProfiles(sourceFilter = 'both') {
    let results = [];

    if (sourceFilter === 'browser') {
      results = [await this.getBrowserProfiles()];
    } else if (sourceFilter === 'gaggimate') {
      results = [await this.getGaggiMateProfiles()];
    } else {
      const browserProfiles = await this.getBrowserProfiles();
      const gaggimateProfiles = await this.getGaggiMateProfiles();
      results = [browserProfiles, gaggimateProfiles];
    }

    const merged = results.flat();

    // Deduplicate preferring live GaggiMate over offline cache
    const deduped = new Map();

    merged.forEach(profile => {
      const key = String(profile.profileId || profile.label || profile.id || '');
      const existing = deduped.get(key);

      if (!existing) {
        deduped.set(key, profile);
        return;
      }

      if (existing.source === GAGGIMATE_CACHE_SOURCE && profile.source === 'gaggimate') {
        deduped.set(key, profile);
      }
    });

    return Array.from(deduped.values()).sort((a, b) =>
      getProfileDisplayLabel(a, '').localeCompare(getProfileDisplayLabel(b, '')),
    );
  }

  /**
   * Load full shot data
   * @param {string} id - Shot ID
   * @param {string} source - 'gaggimate' or 'browser'
   * @returns {Promise<Object>} Full shot data with samples
   */
  async loadShot(id, source) {
    const idStr = String(id);

    if (source === 'gaggimate') {
      const paddedId = idStr.padStart(6, '0');
      const response = await fetchWithTimeout(`/api/history/${paddedId}.slog`, {}, 2500);

      if (!response.ok) {
        throw new Error(`Failed to load shot ${idStr}: HTTP ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const shot = parseBinaryShot(arrayBuffer, idStr);
      shot.source = 'gaggimate';

      // Persist loaded detailed shot for offline use without blocking UI.
      indexedDBService
        .saveCachedGaggiMateShot({
          ...shot,
          loaded: true,
        })
        .catch(error => console.warn('Failed to cache loaded GaggiMate shot:', error));

      return shot;
    }

    const shot = await indexedDBService.getShot(idStr);
    if (!shot) {
      throw new Error(`Shot ${idStr} not found in browser storage`);
    }

    shot.storageKey = shot.storageKey || shot.name || idStr;
    shot.source = shot.source || 'browser';
    return shot;
  }

  /**
   * Load full profile data
   * @param {string} nameOrId - Profile name/ID (for GM: use label)
   * @param {string} source - 'gaggimate' or 'browser'
   * @returns {Promise<Object>} Full profile data
   */
  async loadProfile(nameOrId, source) {
    if (source === 'gaggimate') {
      const response = await safeGaggiMateClient.loadProfile(nameOrId);

      if (!response.profile) {
        throw new Error(`Profile ${nameOrId} not found`);
      }

      const profile = {
        ...response.profile,
        source: 'gaggimate',
      };

      indexedDBService
        .saveCachedGaggiMateProfile(profile)
        .catch(error => console.warn('Failed to cache loaded GaggiMate profile:', error));

      return profile;
    }

    const profile = await indexedDBService.getProfile(nameOrId);
    if (!profile) {
      throw new Error(`Profile ${nameOrId} not found in browser storage`);
    }

    return profile;
  }

  /**
   * PREPARE EXPORT DATA
   * Fetches the original data and cleans it for export.
   * @param {Object} item - The library item (shot or profile)
   * @param {boolean} isShot - True if item is a shot
   * @returns {Promise<{ exportData: Object, filename: string }>} Export payload and filename
   */
  async exportItem(item, isShot) {
    console.log('Service Exporting:', item);

    let exportData = null;
    // 1. Prefer specific exportName (e.g. shot-123.json), else item.name/id
    let filename = item.exportName || item.name || item.id || 'export.json';

    // Ensure extension .json (or .slog if preferred)
    filename = ensureJsonFilename(filename);

    if (item.source === 'gaggimate') {
      if (isShot) {
        const loadId = item.id;
        if (!loadId) throw new Error('Shot ID missing for export');

        const fullShot = await this.loadShot(loadId, 'gaggimate');
        delete fullShot.source;

        const notes = await notesService.loadNotes(loadId, 'gaggimate');
        exportData = buildHistoryLikeShotExport(fullShot, item, notes);
      } else {
        const loadId = item.profileId || item.id;
        if (!loadId) throw new Error('Profile ID missing for export');

        const raw = await this.loadProfile(loadId, 'gaggimate');
        filename = getProfileExportFilename(
          raw,
          item.label || item.name || item.fileName || item.exportName || item.id || 'profile',
        );
        exportData = cleanProfileForExport(raw, item);
      }
    } else if (isShot) {
      const exportShot = { ...(item.data || item) };
      delete exportShot.source;
      delete exportShot.uploadedAt;
      delete exportShot.cachedAt;
      delete exportShot.gaggimateId;

      const shotNotesKey = item.storageKey || item.name || item.id;
      const notes = await notesService.loadNotes(shotNotesKey, 'browser');
      exportData = buildHistoryLikeShotExport(exportShot, item, notes);
    } else {
      const rawProfile = item.data || item;
      filename = getProfileExportFilename(
        rawProfile,
        item.label || item.name || item.fileName || item.exportName || item.id || 'profile',
      );
      exportData = cleanProfileForExport(rawProfile, item);
    }

    return { exportData, filename };
  }

  /**
   * Delete a shot
   * @param {string} id - Shot ID
   * @param {string} source - 'gaggimate' or 'browser'
   */
  async deleteShot(id, source) {
    if (source === 'gaggimate') {
      await safeGaggiMateClient.deleteRemoteShot(id);
    } else {
      await indexedDBService.deleteShot(id);
      await indexedDBService.deleteNotes(String(id));
    }
  }

  /**
   * Delete a profile
   * @param {string} id - Profile ID (gaggimate: internal API id, browser: name)
   * @param {string} source - 'gaggimate' or 'browser'
   */
  async deleteProfile(id, source) {
    if (source === 'gaggimate') {
      await safeGaggiMateClient.deleteRemoteProfile(id);
    } else {
      await indexedDBService.deleteProfile(id);
    }
  }

  /**
   * Get storage statistics
   * @returns {Promise<Object>} Stats from all sources
   */
  async getStats() {
    const [gmShots, browserShots, gmProfiles, browserProfiles] = await Promise.all([
      this.getGaggiMateShots(),
      this.getBrowserShots(),
      this.getGaggiMateProfiles(),
      this.getBrowserProfiles(),
    ]);

    return {
      gaggimate: {
        shots: gmShots.length,
        profiles: gmProfiles.length,
      },
      browser: {
        shots: browserShots.length,
        profiles: browserProfiles.length,
      },
      total: {
        shots: gmShots.length + browserShots.length,
        profiles: gmProfiles.length + browserProfiles.length,
      },
    };
  }
}

export const libraryService = new LibraryService();

