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

effect(() => {
  if (!connected.value) profilesLoaded.value = false;
});

const loadProfiles = apiService => {
  if (profilesInflight) return profilesInflight;
  profilesInflight = apiService
    .request({ tp: 'req:profiles:list' })
    .then(response => {
      profiles.value = response?.profiles ?? [];
      profilesLoaded.value = true;
    })
    .catch(error => {
      console.error('Failed to load profiles:', error);
    })
    .finally(() => {
      profilesInflight = null;
      profilesLoading.value = false;
    });
  return profilesInflight;
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
