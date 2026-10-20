import { useCallback, useContext } from 'preact/hooks';
import { ApiServiceContext, machine } from './ApiService.js';
import { signal, computed, effect, useSignalEffect } from '@preact/signals';

const useApiService = () => {
  return useContext(ApiServiceContext);
};

const connected = computed(() => machine.value.connected);
const selectedProfileId = computed(() => machine.value.status.selectedProfileId);

const profiles = signal([]);
const profilesLoaded = signal(false);
const profilesLoading = signal(true);
let profilesInflight = null;

// Overlay the broadcast selection
const profilesWithSelection = computed(() => {
  const id = selectedProfileId.value;
  if (!id) return profiles.value;
  return profiles.value.map(p =>
    !!p.selected === (p.id === id) ? p : { ...p, selected: p.id === id },
  );
});

const RETRY_MIN_MS = 1000;
const RETRY_MAX_MS = 30000;
let profilesGeneration = 0;
let retryTimer = null;
let retryDelay = RETRY_MIN_MS;

// A request sent on a dropped socket is never answered, so abandon it instead of joining it
effect(() => {
  if (connected.value) return;
  profilesLoaded.value = false;
  profilesInflight = null;
  profilesGeneration++;
  clearTimeout(retryTimer);
  retryDelay = RETRY_MIN_MS;
});

const scheduleRetry = apiService => {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => {
    if (connected.value && !profilesLoaded.value) loadProfiles(apiService);
  }, retryDelay);
  retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
};

const loadProfiles = apiService => {
  if (profilesInflight) return profilesInflight;
  clearTimeout(retryTimer);
  const generation = profilesGeneration;
  const request = apiService
    .request({ tp: 'req:profiles:list' })
    .then(response => {
      if (generation !== profilesGeneration) return;
      profiles.value = response?.profiles ?? [];
      profilesLoaded.value = true;
      profilesLoading.value = false;
      retryDelay = RETRY_MIN_MS;
    })
    .catch(error => {
      if (generation !== profilesGeneration) return;
      console.error('Failed to load profiles:', error);
      scheduleRetry(apiService);
    })
    .finally(() => {
      if (profilesInflight === request) profilesInflight = null;
    });
  profilesInflight = request;
  return request;
};

const setProfilesLoading = loading => {
  profilesLoading.value = loading;
};

const setProfiles = update => {
  profiles.value = typeof update === 'function' ? update(profiles.value) : update;
};

const useProfileList = () => {
  const apiService = useApiService();

  const invalidate = useCallback(async () => {
    if (profilesInflight) await profilesInflight;
    profilesLoaded.value = false;
    await loadProfiles(apiService);
  }, [apiService]);

  useSignalEffect(() => {
    if (connected.value && !profilesLoaded.value) {
      loadProfiles(apiService);
    }
  });

  return {
    profiles: profilesWithSelection.value,
    loading: profilesLoading.value,
    invalidate,
    setLoading: setProfilesLoading,
    setProfiles,
  };
};

export { useApiService, useProfileList };
