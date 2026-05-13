import { signal } from '@preact/signals';
import { useMemo } from 'preact/hooks';
import { useQuery } from 'preact-fetching';

const currentSettings = signal(null);

export function setGrindSettings(settings) {
  currentSettings.value = settings;
}

export function getGrindSettingsState(settings) {
  const isSmartGrindEnabled = settings?.smartGrindActive || false;
  const altRelayFunction = settings?.altRelayFunction !== undefined ? settings.altRelayFunction : 0;
  const isGrindAvailable = isSmartGrindEnabled || altRelayFunction === 1;
  const showGrindTab = isGrindAvailable;

  return {
    isSmartGrindEnabled,
    altRelayFunction,
    isGrindAvailable,
    showGrindTab,
    settings,
  };
}

/**
 * Custom hook to fetch and compute grind-related settings
 * 
 * @returns {Object} { isSmartGrindEnabled, altRelayFunction, isGrindAvailable, showGrindTab, settings }
 */
export function useGrindSettings() {
  const { data: settings } = useQuery(
    'settings-cache',
    async () => {
      const response = await fetch('/api/settings');
      return response.json();
    },
    { staleTime: 30000, refetchOnWindowFocus: false }
  );

  const settingsState = currentSettings.value || settings;

  return useMemo(() => {
    return getGrindSettingsState(settingsState);
  }, [settingsState]);
}

// Made with Bob
