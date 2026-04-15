import { useState, useEffect } from 'preact/hooks';

/**
 * Generic hook for handling async operations with cancellation support
 * @param {Function} asyncFn - Async function to execute
 * @param {Array} deps - Dependency array for useEffect
 * @param {Object} options - Configuration options
 * @returns {Object} { data, loading, error }
 */
function useAsyncEffect(asyncFn, deps, options = {}) {
  const [data, setData] = useState(options.initialData ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (options.skip) return;

    const abortController = new AbortController();

    const execute = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await asyncFn();
        
        if (abortController.signal.aborted) return;
        setData(result);
      } catch (err) {
        if (abortController.signal.aborted) return;
        setError(err);
        setData(options.fallbackData ?? null);
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    execute();
    return () => abortController.abort();
  }, deps);

  return { data, loading, error };
}

/**
 * Custom hook to fetch the list of available profiles
 *
 * @param {Object} api - ApiService instance
 * @param {boolean} brew - Whether brew mode is active
 * @returns {Object} { data, loading, error }
 */
function useProfilesList(api, brew) {
  return useAsyncEffect(
    async () => {
      const response = await api.request({ tp: 'req:profiles:list' });
      return response?.profiles ?? [];
    },
    [api, brew],
    {
      skip: !api || !brew,
      initialData: [],
      fallbackData: [],
    }
  );
}

/**
 * Custom hook to fetch a specific profile by ID
 * Only returns pro profiles, filters out standard profiles
 *
 * @param {Object} api - ApiService instance
 * @param {string} selectedProfileId - Profile ID to load
 * @returns {Object} { data, loading, error }
 */
function useSelectedProfile(api, selectedProfileId) {
  return useAsyncEffect(
    async () => {
      const response = await api.request({
        tp: 'req:profiles:load',
        id: selectedProfileId,
      });
      return response?.profile?.type === 'pro' ? response.profile : null;
    },
    [api, selectedProfileId],
    {
      skip: !api || !selectedProfileId,
      initialData: null,
      fallbackData: null,
    }
  );
}

/**
 * Custom hook to manage profile data loading
 * Handles both the profiles list and individual profile data fetching
 *
 * @param {Object} api - ApiService instance
 * @param {boolean} brew - Whether brew mode is active
 * @param {string} selectedProfileId - Currently selected profile ID
 * @returns {Object} { profiles, profileData, loading, error }
 */
export function useProfileData(api, brew, selectedProfileId) {
  const {
    data: profiles,
    loading: isProfilesLoading,
    error: profilesError,
  } = useProfilesList(api, brew);

  const {
    data: profileData,
    loading: isProfileLoading,
    error: profileError,
  } = useSelectedProfile(api, selectedProfileId);

  return {
    profiles,
    profileData,
    loading: {
      profiles: isProfilesLoading,
      profile: isProfileLoading,
    },
    error: {
      profiles: profilesError,
      profile: profileError,
    },
  };
}

// Made with Bob
