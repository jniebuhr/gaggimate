const CACHE_PREFIX = 'gaggigo';
const CACHE_VERSION = 1;

function cacheKey(name) {
  return `${CACHE_PREFIX}:v${CACHE_VERSION}:${name}`;
}

function nowIso() {
  return new Date().toISOString();
}

function safeParse(rawValue, fallback) {
  if (!rawValue) return fallback;

  try {
    return JSON.parse(rawValue);
  } catch {
    return fallback;
  }
}

function readJson(name, fallback) {
  if (typeof window === 'undefined' || !window.localStorage) return fallback;
  return safeParse(window.localStorage.getItem(cacheKey(name)), fallback);
}

function writeJson(name, value) {
  if (typeof window === 'undefined' || !window.localStorage) return value;
  window.localStorage.setItem(cacheKey(name), JSON.stringify(value));
  return value;
}

export const LocalCacheKeys = Object.freeze({
  profiles: 'profiles',
  profileDrafts: 'profileDrafts',
  shotHistory: 'shotHistory',
  statistics: 'statistics',
  syncQueue: 'syncQueue',
});

export default class LocalCacheService {
  getProfiles() {
    return readJson(LocalCacheKeys.profiles, {
      updatedAt: null,
      source: null,
      items: [],
    });
  }

  setProfiles(items, source = 'gaggimate') {
    return writeJson(LocalCacheKeys.profiles, {
      updatedAt: nowIso(),
      source,
      items: Array.isArray(items) ? items : [],
    });
  }

  getProfileDrafts() {
    return readJson(LocalCacheKeys.profileDrafts, {
      updatedAt: null,
      items: {},
    });
  }

  saveProfileDraft(profile) {
    if (!profile) return this.getProfileDrafts();

    const drafts = this.getProfileDrafts();
    const id = profile.id || profile.label || `draft-${Date.now()}`;
    const nextDrafts = {
      updatedAt: nowIso(),
      items: {
        ...drafts.items,
        [id]: {
          ...profile,
          id,
          localUpdatedAt: nowIso(),
          syncStatus: 'pending',
        },
      },
    };

    return writeJson(LocalCacheKeys.profileDrafts, nextDrafts);
  }

  getShotHistory() {
    return readJson(LocalCacheKeys.shotHistory, {
      updatedAt: null,
      source: null,
      items: [],
    });
  }

  setShotHistory(items, source = 'gaggimate') {
    return writeJson(LocalCacheKeys.shotHistory, {
      updatedAt: nowIso(),
      source,
      items: Array.isArray(items) ? items : [],
    });
  }

  getStatistics() {
    return readJson(LocalCacheKeys.statistics, {
      updatedAt: null,
      source: null,
      data: null,
    });
  }

  setStatistics(data, source = 'gaggimate') {
    return writeJson(LocalCacheKeys.statistics, {
      updatedAt: nowIso(),
      source,
      data,
    });
  }

  getSyncQueue() {
    return readJson(LocalCacheKeys.syncQueue, {
      updatedAt: null,
      items: [],
    });
  }

  enqueueSyncItem(item) {
    if (!item) return this.getSyncQueue();

    const queue = this.getSyncQueue();
    const nextQueue = {
      updatedAt: nowIso(),
      items: [
        ...queue.items,
        {
          ...item,
          id: item.id || `sync-${Date.now()}`,
          queuedAt: nowIso(),
          status: 'pending',
        },
      ],
    };

    return writeJson(LocalCacheKeys.syncQueue, nextQueue);
  }

  clear() {
    if (typeof window === 'undefined' || !window.localStorage) return;

    Object.values(LocalCacheKeys).forEach(name => {
      window.localStorage.removeItem(cacheKey(name));
    });
  }
}
