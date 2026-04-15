import { useMemo } from 'preact/hooks';
import { useQuery } from 'preact-fetching';

/**
 * Custom hook to fetch and compute grind-related settings
 * 
 * @param {number} mode - Current machine mode
 * @returns {Object} { isSmartGrindEnabled, altRelayFunction, isGrindAvailable, showGrindTab, settings }
 */
export function useGrindSettings(mode) {
  const { data: settings } = useQuery(
    'settings-cache',
    async () => {
      const response = await fetch('/api/settings');
      return response.json();
    },
    { staleTime: 30000, refetchOnWindowFocus: false }
  );

  return useMemo(() => {
    const isSmartGrindEnabled = settings?.smartGrindActive || false;
    const altRelayFunction = settings?.altRelayFunction !== undefined ? settings.altRelayFunction : 1;
    const isGrindAvailable = isSmartGrindEnabled || altRelayFunction === 1;
    const showGrindTab = isGrindAvailable || mode === 4;

    return {
      isSmartGrindEnabled,
      altRelayFunction,
      isGrindAvailable,
      showGrindTab,
      settings,
    };
  }, [settings, mode]);
}

// Made with Bob
