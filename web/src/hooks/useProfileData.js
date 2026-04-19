import { useState, useEffect } from 'preact/hooks';

/**
 * Custom hook to fetch the list of available profiles
 *
 * @param {Object} api - ApiService instance
 * @param {boolean} brew - Whether brew mode is active
 * @returns {Object} { data, loading, error }
 */
function useProfilesList(api, brew) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!api || !brew) {
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    const execute = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.request({ tp: 'req:profiles:list' });

        if (cancelled) return;
        setData(response?.profiles ?? []);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load profiles list:', err);
        setError(err);
        setData([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    execute();
    return () => {
      cancelled = true;
    };
  }, [api, brew]);

  return { data, loading, error };
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
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!api || !selectedProfileId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    const execute = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.request({
          tp: 'req:profiles:load',
          id: selectedProfileId,
        });

        if (cancelled) return;
        setData(response?.profile?.type === 'pro' ? response.profile : null);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load profile data:', err);
        setError(err);
        setData(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    execute();
    return () => {
      cancelled = true;
    };
  }, [api, selectedProfileId]);

  return { data, loading, error };
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
