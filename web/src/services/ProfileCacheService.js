import LocalCacheService from './LocalCacheService.js';

const cache = new LocalCacheService();

export async function loadProfilesWithCache(apiService, connected) {
  if (connected) {
    try {
      const response = await apiService.request({ tp: 'req:profiles:list' });
      const profiles = Array.isArray(response?.profiles) ? response.profiles : [];
      cache.setProfiles(profiles, 'gaggimate');
      return {
        profiles,
        source: 'gaggimate',
        cachedAt: new Date().toISOString(),
        offline: false,
      };
    } catch {
      // Fall through to cached profiles.
    }
  }

  const cached = cache.getProfiles();
  return {
    profiles: Array.isArray(cached.items) ? cached.items : [],
    source: cached.source || 'local-cache',
    cachedAt: cached.updatedAt,
    offline: true,
  };
}

export function cacheProfiles(profiles, source = 'gaggimate') {
  return cache.setProfiles(profiles, source);
}

export function getCachedProfiles() {
  return cache.getProfiles();
}
