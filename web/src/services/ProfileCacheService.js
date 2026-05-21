import { libraryService } from '../pages/ShotAnalyzer/services/LibraryService.js';

export async function loadProfilesWithCache(apiService) {
  libraryService.setApiService(apiService);

  const profiles = await libraryService.getAllProfiles('both');

  return {
    profiles: Array.isArray(profiles) ? profiles : [],
    source: 'library-service',
    cachedAt: null,
    offline: false,
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
