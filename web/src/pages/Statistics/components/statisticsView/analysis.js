// Shot analysis engine: metrics computation, compare entry building, profile/date-range extraction
import {
  cleanName,
  getProfileDisplayLabel,
  getShotDisplayName,
} from '../../../ShotAnalyzer/utils/analyzerUtils';
import {
  calculateShotMetrics,
  detectAutoDelay,
} from '../../../ShotAnalyzer/services/AnalyzerService';
import { libraryService } from '../../../ShotAnalyzer/services/LibraryService';
import { DEFAULT_SETTINGS } from './constants';
import {
  getShotSelectionKey,
  getStatisticsCompareFallbackKey,
  buildStatisticsCompareEntry,
} from './helpers';

export function buildProfileLookupMap(profileList, existingMap = null) {
  const profileMap = new Map();
  for (const profile of profileList) {
    const displayName = getProfileDisplayLabel(profile, '');
    const key = displayName.toLowerCase();
    if (key && !existingMap?.has(key)) profileMap.set(key, profile);
  }
  return profileMap;
}

export function getStatisticsShotId(shot) {
  if (shot.source === 'gaggimate') return shot.id;
  return shot.storageKey || shot.name || shot.id;
}

export function buildFullStatisticsShot({ loadedShot, shot, shotId }) {
  if (!loadedShot) return null;
  return {
    ...loadedShot,
    source: loadedShot.source || shot.source,
    storageKey: loadedShot.storageKey || shot.storageKey || shot.name || String(shotId),
    name: loadedShot.name || shot.name || shot.storageKey || String(shotId),
  };
}

export function resolveMatchedProfileEntry({ fallbackProfileMap, fullShot, profileMap }) {
  const profileField = fullShot.profile || '';
  const profileKey = cleanName(profileField).toLowerCase();
  if (!profileKey) return null;
  return profileMap.get(profileKey) || fallbackProfileMap.get(profileKey) || null;
}

export function getProfileLoadId(profileEntry) {
  if (profileEntry.source === 'gaggimate') return profileEntry.profileId || profileEntry.id;
  return profileEntry.label || profileEntry.name;
}

export async function loadStatisticsMatchedProfile({ loadedProfileCache, matchedProfileEntry }) {
  if (!matchedProfileEntry) return null;
  if (matchedProfileEntry.data) return matchedProfileEntry.data;

  const profileId = getProfileLoadId(matchedProfileEntry);
  if (!profileId) return null;

  const cacheKey = `${matchedProfileEntry.source}:${String(profileId || '')}`;
  if (!loadedProfileCache.has(cacheKey)) {
    loadedProfileCache.set(
      cacheKey,
      libraryService.loadProfile(profileId, matchedProfileEntry.source).catch(() => null),
    );
  }
  return loadedProfileCache.get(cacheKey);
}

export function attachProfileSource(profile, matchedProfileEntry) {
  if (profile && matchedProfileEntry?.source && !profile.source) {
    return { ...profile, source: matchedProfileEntry.source };
  }
  return profile;
}

export function getStatisticsAnalysisSettings(fullShot, matchedProfile) {
  const settings = { ...DEFAULT_SETTINGS };
  const autoResult = detectAutoDelay(fullShot, matchedProfile, settings.scaleDelayMs);
  if (autoResult.auto) {
    settings.scaleDelayMs = autoResult.delay;
    settings.isAutoAdjusted = true;
  }
  return settings;
}

export async function analyzeStatisticsShot({
  fallbackProfileMap,
  loadedProfileCache,
  profileMap,
  shot,
}) {
  try {
    const shotId = getStatisticsShotId(shot);
    const loadedShot = await libraryService.loadShot(shotId, shot.source);
    const fullShot = buildFullStatisticsShot({ loadedShot, shot, shotId });
    if (!fullShot?.samples || fullShot.samples.length === 0) return null;

    const matchedProfileEntry = resolveMatchedProfileEntry({
      fallbackProfileMap,
      fullShot,
      profileMap,
    });
    const loadedProfile = await loadStatisticsMatchedProfile({
      loadedProfileCache,
      matchedProfileEntry,
    });
    const matchedProfile = attachProfileSource(loadedProfile, matchedProfileEntry);
    const settings = getStatisticsAnalysisSettings(fullShot, matchedProfile);
    const profileField = fullShot.profile || '';

    return {
      analysis: calculateShotMetrics(fullShot, matchedProfile, settings),
      shotData: fullShot,
      profileData: matchedProfile,
      meta: {
        id: shotId,
        selectionKey: getShotSelectionKey(shot),
        displayName: getShotDisplayName(fullShot),
        timestamp: shot.timestamp || shot.shotDate || shot.uploadedAt || 0,
        profileName: cleanName(profileField) || '(Unknown)',
        source: shot.source,
      },
    };
  } catch {
    return null;
  }
}

export async function analyzeStatisticsShotBatch({
  batch,
  fallbackProfileMap,
  loadedProfileCache,
  profileMap,
}) {
  return Promise.all(
    batch.map(shot =>
      analyzeStatisticsShot({
        fallbackProfileMap,
        loadedProfileCache,
        profileMap,
        shot,
      }),
    ),
  );
}

export function getStatisticsRunSources(runRequest) {
  const shotList = Array.isArray(runRequest.shots) ? runRequest.shots : [];
  const profileList = Array.isArray(runRequest.profiles) ? runRequest.profiles : [];
  const fallbackProfileList = Array.isArray(runRequest.fallbackProfiles)
    ? runRequest.fallbackProfiles
    : [];

  return { fallbackProfileList, profileList, shotList };
}

function appendDefinedEntries(targetEntries, batchResults) {
  for (const entry of batchResults) {
    if (entry) targetEntries.push(entry);
  }
}

export async function runStatisticsAnalysis({ isCurrentRun, onProgress, runRequest }) {
  const { fallbackProfileList, profileList, shotList } = getStatisticsRunSources(runRequest);
  const profileMap = buildProfileLookupMap(profileList);
  const fallbackProfileMap = buildProfileLookupMap(fallbackProfileList, profileMap);
  const loadedProfileCache = new Map();
  const total = shotList.length;

  onProgress({ current: 0, total });
  if (total === 0) return [];

  const entries = [];
  for (let i = 0; i < total; i += 2) {
    if (!isCurrentRun()) return null;

    const batch = shotList.slice(i, i + 2);
    const batchResults = await analyzeStatisticsShotBatch({
      batch,
      fallbackProfileMap,
      loadedProfileCache,
      profileMap,
    });
    appendDefinedEntries(entries, batchResults);

    if (!isCurrentRun()) return null;
    onProgress({ current: Math.min(i + 2, total), total });
  }

  return entries;
}

export function buildStatisticsCompareEntries(result, runRequest, entriesRef) {
  if (!result) return [];

  const cachedEntries = Array.isArray(entriesRef.current) ? entriesRef.current : [];
  const entryBySelectionKey = new Map(
    cachedEntries.map(entry => [entry?.meta?.selectionKey, entry]),
  );
  const orderedShotKeys = Array.isArray(runRequest?.orderedShotKeys)
    ? runRequest.orderedShotKeys.filter(Boolean)
    : [];
  const fallbackShotKeys = Array.isArray(runRequest?.shots)
    ? runRequest.shots.map(getShotSelectionKey).filter(Boolean)
    : [];
  const preferredShotOrder = orderedShotKeys.length > 0 ? orderedShotKeys : fallbackShotKeys;

  const orderedCompareEntries = preferredShotOrder
    .map((selectionKey, index) =>
      buildStatisticsCompareEntry(entryBySelectionKey.get(selectionKey), {
        key: selectionKey,
        isReference: index === 0,
      }),
    )
    .filter(Boolean);

  const matchedCompareKeys = new Set(orderedCompareEntries.map(entry => entry.key));
  const unmatchedCompareEntries = cachedEntries
    .map((entry, index) => {
      const fallbackKey = getStatisticsCompareFallbackKey(entry, index);
      if (matchedCompareKeys.has(fallbackKey)) return null;

      return buildStatisticsCompareEntry(entry, {
        key: fallbackKey,
        isReference: orderedCompareEntries.length === 0 && index === 0,
      });
    })
    .filter(Boolean);

  if (preferredShotOrder.length > 0) {
    if (orderedCompareEntries.length === cachedEntries.length) {
      return orderedCompareEntries;
    }
    if (orderedCompareEntries.length > 0 || unmatchedCompareEntries.length > 0) {
      return [...orderedCompareEntries, ...unmatchedCompareEntries];
    }
  }

  return cachedEntries
    .map((entry, index) =>
      buildStatisticsCompareEntry(entry, {
        key: getStatisticsCompareFallbackKey(entry, index),
        isReference: index === 0,
      }),
    )
    .filter(Boolean);
}

export function getBuiltProfileCount(entriesRef) {
  const cachedEntries = Array.isArray(entriesRef.current) ? entriesRef.current : [];
  const profileNames = new Set();

  cachedEntries.forEach(entry => {
    const rawName = entry?.meta?.profileName || getProfileDisplayLabel(entry?.profileData, '');
    const cleanedName = cleanName(rawName || '');
    if (cleanedName) {
      profileNames.add(cleanedName);
    }
  });

  return profileNames.size;
}

export function getBuiltDateRange(entriesRef, dateBasisMode) {
  const cachedEntries = Array.isArray(entriesRef.current) ? entriesRef.current : [];
  const timestamps = cachedEntries
    .map(entry => resolveShotEffectiveTimestampMs(entry?.shotData || entry?.meta, dateBasisMode))
    .filter(value => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  if (timestamps.length === 0) {
    return { startMs: null, endMs: null };
  }

  return {
    startMs: timestamps[0],
    endMs: timestamps[timestamps.length - 1],
  };
}

function resolveShotEffectiveTimestampMs(shotMeta, dateBasisMode) {
  if (dateBasisMode === 'shot' || dateBasisMode === 'auto') {
    const ts = shotMeta?.timestamp || shotMeta?.shotDate || 0;
    if (Number.isFinite(ts) && ts > 0) return Number(ts);
  }
  if (dateBasisMode === 'upload' || dateBasisMode === 'auto') {
    const ts = shotMeta?.uploadedAt || 0;
    if (Number.isFinite(ts) && ts > 0) return Number(ts);
  }
  return null;
}
