import { useCallback, useContext, useEffect, useMemo, useState } from 'preact/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye } from '@fortawesome/free-solid-svg-icons/faEye';
import { faEyeSlash } from '@fortawesome/free-solid-svg-icons/faEyeSlash';
import Card from '../../components/Card.jsx';
import { Spinner } from '../../components/Spinner.jsx';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
import { libraryService } from '../ShotAnalyzer/services/LibraryService.js';

const SETTINGS_SNAPSHOT_KEY = 'gaggigo.readonlySettingsSnapshot';
const SETTINGS_HTTP_TIMEOUT_MS = 1800;

const SETTINGS_GROUPS = [
  {
    title: 'Temperature Settings',
    keys: ['targetSteamTemp', 'targetWaterTemp', 'temperatureOffset', 'pid', 'kf'],
  },
  {
    title: 'User Preferences',
    keys: [
      'startupMode',
      'startupProfile',
      'standbyTimeout',
      'delayAdjust',
      'brewDelay',
      'grindDelay',
      'momentaryButtons',
      'buttonBehavior',
      'button0',
      'button1',
      'button2',
    ],
  },
  {
    title: 'Machine Settings',
    keys: [
      'pumpModelCoeffs',
      'pressureScaling',
      'steamPumpPercentage',
      'steamPumpCutoff',
      'altRelayFunction',
    ],
  },
  {
    title: 'Display Settings',
    keys: [
      'mainBrightness',
      'standbyDisplayEnabled',
      'standbyBrightness',
      'standbyBrightnessTimeout',
      'themeMode',
      'dashboardLayout',
    ],
  },
  {
    title: 'Sunrise / LED Settings',
    keys: [
      'sunriseR',
      'sunriseG',
      'sunriseB',
      'sunriseW',
      'sunriseExtBrightness',
      'emptyTankDistance',
      'fullTankDistance',
    ],
  },
];

function humanizeKey(key) {
  return String(key || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, char => char.toUpperCase());
}

function isSecretKey(key) {
  return /password|secret|token|key/i.test(String(key || ''));
}

function formatValue(value, { revealSecrets = false, key = '' } = {}) {
  if (value === null || value === undefined || value === '') return 'Not set';
  if (isSecretKey(key) && !revealSecrets) return value ? '••••••••' : 'Not set';
  if (typeof value === 'boolean') return value ? 'Enabled' : 'Disabled';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function splitPidString(pidString) {
  if (!pidString) return { pid: pidString, kf: '0.000' };
  const parts = String(pidString).split(',');
  if (parts.length >= 4) {
    return { pid: parts.slice(0, 3).join(','), kf: parts[3] };
  }
  return { pid: pidString, kf: '0.000' };
}

function splitButtons(buttonBehavior) {
  if (!buttonBehavior) return {};
  const [button0, button1, button2] = String(buttonBehavior).split(',');
  return { button0, button1, button2 };
}

function normalizeSettings(settings) {
  if (!settings || typeof settings !== 'object') return {};

  const nextSettings = { ...settings };

  if (nextSettings.pid) {
    const split = splitPidString(nextSettings.pid);
    nextSettings.pid = split.pid;
    nextSettings.kf = split.kf;
  }

  if (nextSettings.buttonBehavior) {
    Object.assign(nextSettings, splitButtons(nextSettings.buttonBehavior));
  }

  if (nextSettings.standbyDisplayEnabled === undefined && nextSettings.standbyBrightness !== undefined) {
    nextSettings.standbyDisplayEnabled = Number(nextSettings.standbyBrightness) > 0;
  }

  return nextSettings;
}

function getStoredSettingsSnapshot() {
  try {
    const raw = localStorage.getItem(SETTINGS_SNAPSHOT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function storeSettingsSnapshot(settings) {
  try {
    localStorage.setItem(
      SETTINGS_SNAPSHOT_KEY,
      JSON.stringify({ settings, cachedAt: new Date().toISOString() }),
    );
  } catch {
    // Ignore storage failures.
  }
}

async function fetchSettingsWithTimeout() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), SETTINGS_HTTP_TIMEOUT_MS);

  try {
    return await fetch('/api/settings', { signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

function SettingsRows({ settings, keys, revealSecrets }) {
  const visibleKeys = keys.filter(key => Object.hasOwn(settings, key));

  if (visibleKeys.length === 0) {
    return <p className='text-base-content/50 text-sm'>No reported values in this section.</p>;
  }

  return (
    <div className='divide-base-content/10 divide-y'>
      {visibleKeys.map(key => (
        <div key={key} className='flex items-start justify-between gap-4 py-2'>
          <span className='text-base-content/65 text-sm'>{humanizeKey(key)}</span>
          <span className='text-base-content max-w-[60%] break-words text-right text-sm font-medium'>
            {formatValue(settings[key], { revealSecrets, key })}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Settings() {
  const apiService = useContext(ApiServiceContext);
  const connected = Boolean(machine.value.connected);
  const [settings, setSettings] = useState({});
  const [cachedAt, setCachedAt] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [revealSecrets, setRevealSecrets] = useState(false);

  const applyCachedSnapshot = useCallback(() => {
    const snapshot = getStoredSettingsSnapshot();
    if (!snapshot?.settings) return false;

    setSettings(normalizeSettings(snapshot.settings));
    setCachedAt(snapshot.cachedAt || null);
    setLoading(false);
    return true;
  }, []);

  const loadSettings = useCallback(async ({ manual = false } = {}) => {
    const hasCache = applyCachedSnapshot();
    setRefreshing(true);
    setError(hasCache ? 'Showing cached settings while checking for live settings.' : null);
    if (!hasCache) setLoading(true);

    try {
      libraryService.setApiService(apiService);
      const [settingsResponse, profileList] = await Promise.all([
        fetchSettingsWithTimeout(),
        libraryService.getAllProfiles('both').catch(() => []),
      ]);

      if (!settingsResponse.ok) {
        throw new Error(`Settings request failed: HTTP ${settingsResponse.status}`);
      }

      const rawSettings = await settingsResponse.json();
      const normalized = normalizeSettings(rawSettings);
      setSettings(normalized);
      setProfiles(Array.isArray(profileList) ? profileList : []);
      setCachedAt(new Date().toISOString());
      setError(null);
      storeSettingsSnapshot(normalized);
    } catch (loadError) {
      const snapshotLoaded = hasCache || applyCachedSnapshot();
      if (snapshotLoaded) {
        setError('Live settings unavailable. Showing cached settings snapshot.');
      } else {
        setSettings({});
        setCachedAt(null);
        setError(loadError.message || 'Failed to load GaggiMate settings.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiService, applyCachedSnapshot]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings, connected]);

  const startupProfileLabel = useMemo(() => {
    const profileId = String(settings.startupProfile || '');
    if (!profileId) return null;
    const match = profiles.find(profile => String(profile.profileId || profile.id || '') === profileId);
    return match ? `${profileId} (${match.label || match.name || 'profile'})` : profileId;
  }, [profiles, settings.startupProfile]);

  const displaySettings = useMemo(() => {
    if (!startupProfileLabel) return settings;
    return {
      ...settings,
      startupProfile: startupProfileLabel,
    };
  }, [settings, startupProfileLabel]);

  if (loading) {
    return (
      <div className='flex w-full flex-row items-center justify-center py-16'>
        <Spinner size={8} />
      </div>
    );
  }

  return (
    <>
      <div className='mb-4 flex flex-row items-center gap-2'>
        <h2 className='flex-grow text-2xl font-bold sm:text-3xl'>Settings</h2>
        <span className={`badge ${connected ? 'badge-success' : 'badge-warning'}`}>
          {connected ? 'Live' : 'Cached'}
        </span>
        <button
          className='btn btn-sm btn-outline'
          type='button'
          onClick={() => loadSettings({ manual: true })}
          disabled={refreshing}
        >
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
        <button
          className='btn btn-sm btn-ghost'
          type='button'
          onClick={() => setRevealSecrets(value => !value)}
        >
          <FontAwesomeIcon icon={revealSecrets ? faEyeSlash : faEye} />
        </button>
      </div>

      <div className='mb-4 alert alert-info shadow-sm'>
        <span>
          Read-only GaggiMate settings viewer using /api/settings. Save/restart/import controls are intentionally disabled.
        </span>
      </div>

      {error && (
        <div className='alert alert-warning mb-4 shadow-sm'>
          <span>{error}</span>
        </div>
      )}

      <div className='mb-4 text-sm opacity-60'>
        Snapshot: {cachedAt ? new Date(cachedAt).toLocaleString() : 'No snapshot loaded'}
      </div>

      <div className='grid grid-cols-1 gap-4 lg:grid-cols-10'>
        {SETTINGS_GROUPS.map(group => (
          <Card key={group.title} sm={10} lg={5} title={group.title}>
            <SettingsRows
              settings={displaySettings}
              keys={group.keys}
              revealSecrets={revealSecrets}
            />
          </Card>
        ))}

        <Card sm={10} title='Boundary'>
          <div className='alert alert-warning shadow-sm'>
            <span>GaggiMate controls the machine. GaggiGo displays settings only.</span>
          </div>
        </Card>
      </div>
    </>
  );
}
