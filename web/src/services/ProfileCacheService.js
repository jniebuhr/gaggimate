import { libraryService } from '../pages/ShotAnalyzer/services/LibraryService.js';

export async function loadProfilesWithCache(apiService, connected = false) {
  libraryService.setApiService(apiService);

  let profiles = [];
  let source = 'cache';

  if (connected) {
    profiles = await libraryService.getAllProfiles('gaggimate');
    source = 'gaggimate';
  }

  if (!Array.isArray(profiles) || profiles.length === 0) {
    profiles = await libraryService.getAllProfiles('both');
    source = 'library-service';
  }

  return {
    profiles: Array.isArray(profiles) ? profiles : [],
    source,
    cachedAt: null,
    offline: !connected,
  };
}

export function cacheProfiles() {
  return null;
}

export async function getCachedProfiles() {
  return {
    updatedAt: null,
    source: 'library-service',
    items: await libraryService.getBrowserProfiles(),
  };
}
