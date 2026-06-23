import {
  ANALYZER_DB_KEYS,
  MAX_PINNED_PROFILES,
  MAX_PINNED_SHOTS_PER_PROFILE,
  PINNED_NO_PROFILE_BUCKET,
} from './constants';
import { cleanName } from './formatting';
import { loadFromStorage, saveToStorage } from './storage';
import { resolveProfileFieldValue } from './profiles';

export const getShotStorageKey = shot => {
  if (!shot) return '';
  return shot.source === 'gaggimate' ? shot.id : shot.storageKey || shot.name || shot.id || '';
};

export const getShotIdentityKey = shot => {
  if (!shot) return '';

  const source = shot.source || 'temp';
  const storageKey = String(getShotStorageKey(shot) || '');
  if (source === 'gaggimate') return `gaggimate:${storageKey}`;
  if (source === 'temp') return `temp:${storageKey}`;

  return `browser:${storageKey}`;
};

export const getProfilePinKey = profile => {
  if (!profile) return '';

  if (typeof profile === 'string') {
    const normalized = cleanName(profile).trim().toLowerCase();
    return normalized === 'no profile loaded' ? '' : normalized;
  }

  const rawValue =
    profile.canonicalProfileName ||
    profile.profileName ||
    profile.profile ||
    resolveProfileFieldValue(profile) ||
    '';

  const normalized = cleanName(rawValue).trim().toLowerCase();
  return normalized === 'no profile loaded' ? '' : normalized;
};

export const getShotPinBucketKey = shot => {
  const profileKey = getProfilePinKey(shot);
  return profileKey || PINNED_NO_PROFILE_BUCKET;
};

function normalizePinnedProfiles(rawValue) {
  if (!Array.isArray(rawValue)) return [];

  const seen = new Set();
  const normalized = [];
  for (const entry of rawValue) {
    const key = getProfilePinKey(entry);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    normalized.push(key);
  }
  return normalized;
}

function normalizePinnedShotsByProfile(rawValue) {
  if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) return {};

  const normalized = {};

  Object.entries(rawValue).forEach(([bucketKey, shotKeys]) => {
    const resolvedBucketKey = String(bucketKey || '').trim() || PINNED_NO_PROFILE_BUCKET;
    if (!Array.isArray(shotKeys)) return;

    const seen = new Set();
    const normalizedShotKeys = [];
    shotKeys.forEach(shotKey => {
      const nextShotKey = String(shotKey || '').trim();
      if (!nextShotKey || seen.has(nextShotKey)) return;
      seen.add(nextShotKey);
      normalizedShotKeys.push(nextShotKey);
    });

    if (normalizedShotKeys.length > 0) {
      normalized[resolvedBucketKey] = normalizedShotKeys;
    }
  });

  return normalized;
}

export const getPinnedProfiles = () =>
  normalizePinnedProfiles(loadFromStorage(ANALYZER_DB_KEYS.PINNED_PROFILES, []));

export const getPinnedShotsByProfile = () =>
  normalizePinnedShotsByProfile(loadFromStorage(ANALYZER_DB_KEYS.PINNED_SHOTS_BY_PROFILE, {}));

export const isProfilePinned = (profile, pinnedProfiles = getPinnedProfiles()) =>
  pinnedProfiles.includes(getProfilePinKey(profile));

export const isShotPinned = (
  shot,
  bucketKey = getShotPinBucketKey(shot),
  pinnedShotsByProfile = getPinnedShotsByProfile(),
) => {
  const shotKey = typeof shot === 'string' ? shot : getShotIdentityKey(shot);
  if (!shotKey) return false;
  return (pinnedShotsByProfile[bucketKey] || []).includes(shotKey);
};

export const isShotPinnedAnywhere = (shot, pinnedShotsByProfile = getPinnedShotsByProfile()) => {
  const shotKey = typeof shot === 'string' ? shot : getShotIdentityKey(shot);
  if (!shotKey) return false;
  return Object.values(pinnedShotsByProfile).some(bucket => bucket.includes(shotKey));
};

export const toggleProfilePin = profile => {
  const profileKey = getProfilePinKey(profile);
  const pinnedProfiles = getPinnedProfiles();
  if (!profileKey) {
    return { changed: false, reason: 'invalid-profile', pinnedProfiles };
  }

  const isPinned = pinnedProfiles.includes(profileKey);
  if (!isPinned && pinnedProfiles.length >= MAX_PINNED_PROFILES) {
    return { changed: false, reason: 'profile-limit', pinnedProfiles };
  }

  const nextPinnedProfiles = isPinned
    ? pinnedProfiles.filter(entry => entry !== profileKey)
    : [...pinnedProfiles, profileKey];

  saveToStorage(ANALYZER_DB_KEYS.PINNED_PROFILES, nextPinnedProfiles);
  return { changed: true, reason: null, pinnedProfiles: nextPinnedProfiles, profileKey };
};

export const toggleShotPin = (shot, explicitBucketKey = '') => {
  const shotKey = typeof shot === 'string' ? shot : getShotIdentityKey(shot);
  const bucketKey = explicitBucketKey || getShotPinBucketKey(shot);
  const pinnedShotsByProfile = getPinnedShotsByProfile();

  if (!shotKey) {
    return { changed: false, reason: 'invalid-shot', pinnedShotsByProfile, bucketKey };
  }

  const currentBucket = [...(pinnedShotsByProfile[bucketKey] || [])];
  const isPinned = currentBucket.includes(shotKey);

  if (!isPinned && currentBucket.length >= MAX_PINNED_SHOTS_PER_PROFILE) {
    return { changed: false, reason: 'shot-limit', pinnedShotsByProfile, bucketKey };
  }

  const nextBucket = isPinned
    ? currentBucket.filter(entry => entry !== shotKey)
    : [...currentBucket, shotKey];

  const nextPinnedShotsByProfile = { ...pinnedShotsByProfile };
  if (nextBucket.length > 0) {
    nextPinnedShotsByProfile[bucketKey] = nextBucket;
  } else {
    delete nextPinnedShotsByProfile[bucketKey];
  }

  saveToStorage(ANALYZER_DB_KEYS.PINNED_SHOTS_BY_PROFILE, nextPinnedShotsByProfile);
  return {
    changed: true,
    reason: null,
    pinnedShotsByProfile: nextPinnedShotsByProfile,
    bucketKey,
    shotKey,
  };
};
