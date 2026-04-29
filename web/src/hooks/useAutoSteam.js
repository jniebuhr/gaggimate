import { useState, useEffect } from 'preact/hooks';

const AUTO_STEAM_KEY = 'gaggimate-auto-steam';

export function useAutoSteam() {
  const [autoSteamEnabled, setAutoSteamEnabled] = useState(() => {
    try {
      return localStorage.getItem(AUTO_STEAM_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(AUTO_STEAM_KEY, String(autoSteamEnabled));
    } catch (error) {
      console.warn('Failed to persist auto-steam setting:', error);
    }
  }, [autoSteamEnabled]);

  const toggleAutoSteam = () => setAutoSteamEnabled(prev => !prev);

  return { autoSteamEnabled, toggleAutoSteam };
}