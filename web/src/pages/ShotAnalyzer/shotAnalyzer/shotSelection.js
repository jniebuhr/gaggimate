/** Normalizes shot selections and loads shots with their preferred profiles. */

import { calculateShotMetrics, detectAutoDelay } from '../services/AnalyzerService';
import { libraryService } from '../services/LibraryService';
import { cleanName, getProfileDisplayLabel, getShotStorageKey } from '../utils/analyzerUtils';

export const PROFILE_AUTO_MATCH_INITIAL_DELAY_MS = 250;
export const PROFILE_AUTO_MATCH_RETRY_DELAY_MS = 450;
export const PROFILE_AUTO_MATCH_MAX_ATTEMPTS = 4;
const SHOT_SELECTION_DEBOUNCE_MS = 400;
const DEFAULT_ANALYSIS_DELAY_MS = 200;

export function hasLoadedShotPayload(item) {
  return Boolean(item) && Array.isArray(item.samples);
}

function getShotSelectionName(item, loadKey = getShotStorageKey(item)) {
  if (!item) return 'No Shot Loaded';
  return item.name || item.storageKey || String(loadKey || item.id || 'No Shot Loaded');
}

export function getShotSelectionProfileName(item) {
  return item?.profile ? cleanName(item.profile) : 'No Profile Loaded';
}

function createSelectionBaseRequest(request) {
  const isRequestObject = Boolean(request) && typeof request === 'object';
  return isRequestObject && Object.hasOwn(request, 'item') ? request : { item: request };
}

export function normalizeSelectionRequest(request, defaults = {}) {
  const baseRequest = createSelectionBaseRequest(request);
  const item = baseRequest?.item;
  if (!item) return null;

  const shotItem = {
    ...item,
    source: item.source || 'temp',
  };

  return {
    direction: 0,
    targetIndex: -1,
    debounceMs: SHOT_SELECTION_DEBOUNCE_MS,
    ...defaults,
    ...baseRequest,
    item: shotItem,
    name: baseRequest.name || getShotSelectionName(shotItem),
    listSnapshot: Array.isArray(baseRequest.listSnapshot) ? baseRequest.listSnapshot : [],
  };
}

export function getNextDirectionalSelection(request) {
  if (!request?.direction || !Array.isArray(request.listSnapshot)) return null;

  const nextIndex = request.targetIndex + request.direction;
  if (nextIndex < 0 || nextIndex >= request.listSnapshot.length) return null;

  const item = request.listSnapshot[nextIndex];
  if (!item) return null;

  return {
    ...request,
    item,
    name: getShotSelectionName(item),
    targetIndex: nextIndex,
    requestSelectionScroll: false,
  };
}

export function findPreferredProfileMatch(allProfiles, shotProfileName, shotProfileId = '') {
  // Legacy shots may retain IDs from an older profile revision. Prefer the normalized
  // profile label so they follow the intended version, then fall back to the stored ID.
  const target = cleanName(shotProfileName).toLowerCase();
  if (target) {
    const match = allProfiles.find(
      profile => getProfileDisplayLabel(profile, '').toLowerCase() === target,
    );
    if (match) return match;
  }

  const targetId = String(shotProfileId || '').trim();
  if (targetId) {
    const idMatch = allProfiles.find(
      profile => String(profile.profileId || profile.id || '').trim() === targetId,
    );
    if (idMatch) return idMatch;
  }

  return null;
}

export function normalizeMatchedProfileSource(profileData, profileSource) {
  if (profileData && (profileSource === 'gaggimate' || profileSource === 'temp')) {
    return { ...profileData, source: profileSource };
  }
  return profileData;
}

export function shouldAutoScrollAnalyzerOnSelection() {
  const viewportWindow = globalThis.window;
  if (!viewportWindow || typeof viewportWindow.matchMedia !== 'function') return false;
  return viewportWindow.matchMedia('(max-width: 1023px)').matches;
}

export async function loadPreferredAutoMatchedProfile(shotWithMetadata, allProfiles) {
  const preferredMatch = findPreferredProfileMatch(
    allProfiles,
    shotWithMetadata.profile,
    shotWithMetadata.profileId,
  );

  if (!preferredMatch) return null;

  const profileName = getProfileDisplayLabel(preferredMatch, '');
  const profileId = preferredMatch.profileId || preferredMatch.id;
  const fullProfile = await libraryService.loadProfile(profileId);

  if (!fullProfile) return null;

  return {
    profile: normalizeMatchedProfileSource(fullProfile, preferredMatch.source),
    profileName,
  };
}

export function analyzeShot(shotData, profileData) {
  let usedSensorDelay = DEFAULT_ANALYSIS_DELAY_MS;
  let isAutoAdjusted = false;

  if (profileData) {
    const detection = detectAutoDelay(shotData, profileData, DEFAULT_ANALYSIS_DELAY_MS);
    usedSensorDelay = detection.delay;
    isAutoAdjusted = detection.auto;
  }

  return calculateShotMetrics(shotData, profileData, {
    scaleDelayMs: DEFAULT_ANALYSIS_DELAY_MS,
    sensorDelayMs: usedSensorDelay,
    isAutoAdjusted,
  });
}

export function buildShotWithMetadata({ item, loadedShot, loadKey }) {
  return {
    ...loadedShot,
    source: loadedShot.source || item.source || 'temp',
    storageKey: loadedShot.storageKey || item.storageKey || item.name || String(loadKey),
    name: loadedShot.name || item.name || item.storageKey || String(loadKey),
  };
}

export async function loadShotSelection({ item, signal }) {
  const loadKey = getShotStorageKey(item);
  const loadedShot = hasLoadedShotPayload(item)
    ? item
    : await libraryService.loadShot(loadKey, { signal });
  const shotWithMetadata = buildShotWithMetadata({
    item,
    loadedShot,
    loadKey,
  });

  return {
    loadKey,
    shotName: getShotSelectionName(item, loadKey),
    shotWithMetadata,
  };
}
