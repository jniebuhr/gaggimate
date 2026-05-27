/**
 * LibraryService.js
 *
 * Unified service for loading shots and profiles from multiple sources:
 * - GaggiMate Controller (via safe hydration into IndexedDB)
 * - Browser Uploads (via IndexedDB)
 *
 * Rule: UI pages read the local mirror. Live GaggiMate calls hydrate the mirror.
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

function isCachedGaggiMateSource(source) {
  return source === GAGGIMATE_CACHE_SOURCE;
}

function isAnyGaggiMateSource(source) {
  return source === 'gaggimate' || isCachedGaggiMateSource(source);
}

function getGaggiMateShotId(value) {
  const raw = String(value?.gaggimateId || value?.id || value?.storageKey || value?.name || '').trim();
  return raw.startsWith('gaggimate:') ? raw.replace(/^gaggimate:/, '') : raw;
}

function getLocalShotLookupId(value) {
  return String(value?.storageKey || value?.name || value?.gaggimateId || value?.id || value || '').trim();
}

function hasLoadedSamples(shot) {
  return Array.isArray(shot?.samples) && shot.samples.length > 0;
}

function normalizeLocalShot(shot = {}) {
  const source = shot.source || 'browser';
  const gaggimateId = isAnyGaggiMateSource(source) ? getGaggiMateShotId(shot) : '';
  const storageKey =
    shot.storageKey || shot.name || (gaggimateId ? `gaggimate:${gaggimateId}` : String(shot.id || ''));

  return {
    ...shot,
    id: String(shot.id || gaggimateId || storageKey || ''),
    gaggimateId: gaggimateId || shot.gaggimateId,
    name: storageKey,
    storageKey,
    source,
    loaded: hasLoadedSamples(shot) || Boolean(shot.loaded),
  };
}

function mergeShotListEntry(existing, shot) {
  if (!existing) return normalizeLocalShot(shot);

  const existingHasSamples = hasLoadedSamples(existing);
  const nextHasSamples = hasLoadedSamples(shot);

  if (existingHasSamples && !nextHasSamples) {
    return normalizeLocalShot({
      ...shot,
      ...existing,
      source: existing.source,
      loaded: true,
    });
  }

  if (!existingHasSamples && nextHasSamples) {
    return normalizeLocalShot({
      ...existing,
      ...shot,
      loaded: true,
    });
  }

  if (existing.source === GAGGIMATE_CACHE_SOURCE && shot.source === 'gaggimate') {
    return normalizeLocalShot({ ...existing, ...shot, source: existing.source });
  }

  return normalizeLocalShot(existing);
}

function filterLocalShotsBySource(shots, sourceFilter = 'both') {
  if (sourceFilter === 'gaggimate') {
    return shots.filter(shot => isAnyGaggiMateSource(shot.source));
  }

  if (sourceFilter === 'browser') {
    return shots.filter(shot => !isAnyGaggiMateSource(shot.source));
  }

  return shots;
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
   * Hydrate the local shot mirror from the GaggiMate history index.
   * This is a live-to-local write path, not a render/read path.
   * @returns {Promise<Object[]>} Hydrated local shot summaries
   */
  async hydrateGaggiMateShotIndex() {
    try {
      const response = await fetchWithTimeout('/api/history/index.bin');

      if (!response.ok) {
        if (response.status === 404) {
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

      const cachedShots = await Promise.all(
        normalizedShots.map(shot => indexedDBService.saveCachedGaggiMateShot(shot)),
      );

      const missingPayloadShots = cachedShots
        .map(normalizeLocalShot)
        .filter(shot => isAnyGaggiMateSource(shot.source) && !hasLoadedSamples(shot))
        .map(shot => getGaggiMateShotId(shot))
        .filter(Boolean);

      const concurrency = 2;

      for (let i = 0; i < missingPayloadShots.length; i += concurrency) {
        const batch = missingPayloadShots.slice(i, i + concurrency);

        await Promise.all(
          batch.map(id =>
            this.hydrateGaggiMateShotPayload(id).catch(error => {
              console.warn(`Failed to hydrate cached shot payload ${id}:`, error);
              return null;
            }),
          ),
        );
      }

      return this.getLocalShots('gaggimate');
    } catch (error) {
      console.error('Failed to hydrate GaggiMate shot index:', error);
      return [];
    }
  }

  /**
   * Backward-compatible hydration alias.
   * UI code should prefer getAllShots/getLocalShots for reads.
   */
  async getGaggiMateShots() {
    return this.hydrateGaggiMateShotIndex();
  }

  /**
   * Get all shots from the local IndexedDB mirror.
   * @returns {Promise<Object[]>} List of local shots with source tag
   */
  async getLocalShots(sourceFilter = 'both') {
    try {
      const shots = await indexedDBService.getAllShots();
      const normalizedShots = shots.map(normalizeLocalShot);
      return filterLocalShotsBySource(normalizedShots, sourceFilter);
    } catch (error) {
      console.error('Failed to load local shots:', error);
      return [];
    }
  }

  /**
   * Get shots from browser uploads and offline mirrors.
   * Backward-compatible local read alias.
   * @returns {Promise<Object[]>} List of local shots with source tag
   */
  async getBrowserShots() {
    return this.getLocalShots('both');
  }

  /**
   * Get cached GaggiMate shot mirrors from IndexedDB.
   * @returns {Promise<Object[]>} List of cached GaggiMate shots
   */
  async getCachedGaggiMateShots() {
    return this.getLocalShots('gaggimate');
  }

  /**
   * Get merged shot list from the local mirror only.
   * Live GaggiMate access must hydrate IndexedDB before/around this call.
   * @param {string} sourceFilter - 'both', 'gaggimate', or 'browser'
   * @returns {Promise<Object[]>} Filtered and merged local shot list
   */
  async getAllShots(sourceFilter = 'both') {
    const localShots = await this.getLocalShots(sourceFilter);
    const deduped = new Map();

    localShots.forEach(shot => {
      const key = isAnyGaggiMateSource(shot.source)
        ? getGaggiMateShotId(shot)
        : String(shot.storageKey || shot.name || shot.id || '');
      const existing = deduped.get(key);
      deduped.set(key, mergeShotListEntry(existing, shot));
    });

    return Array.from(deduped.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
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
      const browserProfiles = await this.getBrowserProfiles();
      const gaggimateProfiles = await this.getGaggiMateProfiles();
      results = [browserProfiles.filter(profile => isCachedGaggiMateSource(profile.source)), gaggimateProfiles];
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
   * Hydrate one full GaggiMate shot payload into IndexedDB.
   * @param {string} id - GaggiMate shot ID
   * @returns {Promise<Object>} Stored local shot payload
   */
  async hydrateGaggiMateShotPayload(id) {
    const idStr = String(id);
    const paddedId = idStr.padStart(6, '0');
    const response = await fetchWithTimeout(`/api/history/${paddedId}.slog`, {}, 2500);

    if (!response.ok) {
      throw new Error(`Failed to hydrate shot ${idStr}: HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const shot = parseBinaryShot(arrayBuffer, idStr);
    const cachedShot = await indexedDBService.saveCachedGaggiMateShot({
      ...shot,
      loaded: true,
    });

    return normalizeLocalShot(cachedShot);
  }

  /**
   * Load full shot data from the local mirror. Connected GaggiMate may hydrate
   * missing GaggiMate payloads, then the stored local payload is returned.
   * @param {string} id - Shot ID or local storage key
   * @param {string} source - 'gaggimate', 'gaggimate-cache', 'browser', or local source
   * @returns {Promise<Object>} Full local shot data with samples when hydrated
   */
  async loadShot(id, source) {
    const idStr = String(id);
    const localShot = await indexedDBService.getShot(idStr);

    if (localShot) {
      const normalizedShot = normalizeLocalShot(localShot);
      if (hasLoadedSamples(normalizedShot) || !isAnyGaggiMateSource(source || normalizedShot.source)) {
        return normalizedShot;
      }
    }

    if (isAnyGaggiMateSource(source)) {
      const shotId = getGaggiMateShotId(localShot || { id: idStr });
      if (!shotId) {
        throw new Error(`GaggiMate shot ${idStr} has no stable id for hydration`);
      }

      await this.hydrateGaggiMateShotPayload(shotId);
      const hydratedShot = await indexedDBService.getShot(`gaggimate:${shotId}`);
      if (hydratedShot) return normalizeLocalShot(hydratedShot);
    }

    throw new Error(`Shot ${idStr} not found in local storage`);
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
    let filename = item.exportName || item.name || item.id || 'export.json';

    filename = ensureJsonFilename(filename);

    if (isAnyGaggiMateSource(item.source)) {
      if (isShot) {
        const loadId = item.gaggimateId || item.id;
        if (!loadId) throw new Error('Shot ID missing for export');

        const fullShot = await this.loadShot(loadId, item.source);
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
   * @returns {Promise<Object>} Stats from local mirror and hydration source
   */
  async getStats() {
    const [localShots, gmProfiles, browserProfiles] = await Promise.all([
      this.getLocalShots('both'),
      this.getGaggiMateProfiles(),
      this.getBrowserProfiles(),
    ]);

    const gmShots = localShots.filter(shot => isAnyGaggiMateSource(shot.source));
    const browserShots = localShots.filter(shot => !isAnyGaggiMateSource(shot.source));

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
        shots: localShots.length,
        profiles: gmProfiles.length + browserProfiles.length,
      },
    };
  }
}

export const libraryService = new LibraryService();


