import { useContext, useEffect, useMemo, useState } from 'preact/hooks';
import Card from '../../components/Card.jsx';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
import { libraryService } from '../ShotAnalyzer/services/LibraryService.js';
import { indexedDBService } from '../ShotAnalyzer/services/IndexedDBService.js';

function formatValue(value, fallback = 'Not reported') {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function formatNumber(value, suffix = '', fallback = 'Not reported') {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return `${numeric.toFixed(1)}${suffix}`;
}

function InfoRow({ label, value }) {
  return (
    <div className='border-base-content/10 flex items-start justify-between gap-4 border-b py-2 last:border-b-0'>
      <span className='text-base-content/65 text-sm'>{label}</span>
      <span className='text-base-content text-right text-sm font-medium'>{value}</span>
    </div>
  );
}

function SectionList({ items }) {
  return (
    <div className='divide-base-content/10 divide-y'>
      {items.map(item => (
        <InfoRow key={item.label} label={item.label} value={item.value} />
      ))}
    </div>
  );
}

export function Settings() {
  const apiService = useContext(ApiServiceContext);
  const [cacheStats, setCacheStats] = useState({ shots: 0, profiles: 0, total: 0 });
  const [libraryStats, setLibraryStats] = useState({ shots: 0, profiles: 0 });
  const [lastUpdated, setLastUpdated] = useState(null);

  const snapshot = machine.value;
  const status = snapshot.status || {};
  const capabilities = snapshot.capabilities || {};
  const connected = Boolean(snapshot.connected);

  useEffect(() => {
    let cancelled = false;

    async function loadReadOnlyStats() {
      try {
        libraryService.setApiService(apiService);
        const [storedStats, shotList, profileList] = await Promise.all([
          indexedDBService.getStats(),
          libraryService.getAllShots('both'),
          libraryService.getAllProfiles('both'),
        ]);

        if (cancelled) return;
        setCacheStats(storedStats);
        setLibraryStats({
          shots: Array.isArray(shotList) ? shotList.length : 0,
          profiles: Array.isArray(profileList) ? profileList.length : 0,
        });
        setLastUpdated(new Date());
      } catch (error) {
        if (cancelled) return;
        console.warn('Failed to load read-only settings stats:', error);
      }
    }

    loadReadOnlyStats();

    return () => {
      cancelled = true;
    };
  }, [apiService, connected]);

  const machineRows = useMemo(
    () => [
      { label: 'Connection', value: connected ? 'Connected' : 'Offline / cached mode' },
      { label: 'Mode', value: formatValue(status.mode) },
      { label: 'Selected profile', value: formatValue(status.selectedProfile) },
      { label: 'Selected profile ID', value: formatValue(status.selectedProfileId) },
      { label: 'RSSI', value: formatValue(status.rssi) },
      {
        label: 'Last status update',
        value: status.timestamp ? new Date(status.timestamp).toLocaleString() : 'Not reported',
      },
    ],
    [connected, status],
  );

  const temperatureRows = useMemo(
    () => [
      { label: 'Current temperature', value: formatNumber(status.currentTemperature, '°C') },
      { label: 'Target temperature', value: formatNumber(status.targetTemperature, '°C') },
    ],
    [status],
  );

  const pressureRows = useMemo(
    () => [
      { label: 'Current pressure', value: formatNumber(status.currentPressure, ' bar') },
      { label: 'Target pressure', value: formatNumber(status.targetPressure, ' bar') },
      { label: 'Pressure capability', value: formatValue(capabilities.pressure) },
    ],
    [capabilities, status],
  );

  const brewRows = useMemo(
    () => [
      { label: 'Brew target enabled', value: formatValue(status.brewTarget) },
      { label: 'Brew target duration', value: formatNumber(status.brewTargetDuration, ' s') },
      { label: 'Target weight', value: formatNumber(status.targetWeight, ' g') },
      { label: 'Active target weight', value: formatNumber(status.activeTargetWeight, ' g') },
      { label: 'Current weight', value: formatNumber(status.currentWeight, ' g') },
      { label: 'Current flow', value: formatNumber(status.currentFlow, ' g/s') },
      { label: 'Volumetric available', value: formatValue(status.volumetricAvailable) },
    ],
    [status],
  );

  const grinderRows = useMemo(
    () => [
      { label: 'Grind target', value: formatValue(status.grindTarget) },
      { label: 'Grind active', value: formatValue(status.grindActive) },
      { label: 'Grind target duration', value: formatNumber(status.grindTargetDuration, ' s') },
      { label: 'Grind target volume', value: formatNumber(status.grindTargetVolume, ' ml') },
    ],
    [status],
  );

  const capabilityRows = useMemo(
    () => [
      { label: 'Bluetooth scale connected', value: formatValue(status.bluetoothConnected) },
      { label: 'Display dimming capability', value: formatValue(capabilities.dimming) },
      { label: 'LED control capability', value: formatValue(capabilities.ledControl) },
      { label: 'ToF distance', value: formatNumber(status.tofDistance, ' mm') },
    ],
    [capabilities, status],
  );

  const cacheRows = useMemo(
    () => [
      { label: 'Library shots visible', value: formatValue(libraryStats.shots) },
      { label: 'Library profiles visible', value: formatValue(libraryStats.profiles) },
      { label: 'IndexedDB shots', value: formatValue(cacheStats.shots) },
      { label: 'IndexedDB profiles', value: formatValue(cacheStats.profiles) },
      { label: 'IndexedDB total records', value: formatValue(cacheStats.total) },
      {
        label: 'Local snapshot updated',
        value: lastUpdated ? lastUpdated.toLocaleString() : 'Not loaded yet',
      },
    ],
    [cacheStats, libraryStats, lastUpdated],
  );

  return (
    <>
      <div className='mb-4 flex flex-row items-center gap-2'>
        <h2 className='flex-grow text-2xl font-bold sm:text-3xl'>Settings</h2>
        <span className={`badge ${connected ? 'badge-success' : 'badge-warning'}`}>
          {connected ? 'Live' : 'Cached'}
        </span>
      </div>

      <div className='mb-4 alert alert-info shadow-sm'>
        <span>
          Read-only GaggiMate settings and machine status. GaggiGo does not change machine configuration.
        </span>
      </div>

      <div className='grid grid-cols-1 gap-4 lg:grid-cols-10'>
        <Card sm={10} lg={5} title='Machine'>
          <SectionList items={machineRows} />
        </Card>

        <Card sm={10} lg={5} title='Temperature'>
          <SectionList items={temperatureRows} />
        </Card>

        <Card sm={10} lg={5} title='Pressure'>
          <SectionList items={pressureRows} />
        </Card>

        <Card sm={10} lg={5} title='Brew / Weight'>
          <SectionList items={brewRows} />
        </Card>

        <Card sm={10} lg={5} title='Grinder'>
          <SectionList items={grinderRows} />
        </Card>

        <Card sm={10} lg={5} title='Capabilities'>
          <SectionList items={capabilityRows} />
        </Card>

        <Card sm={10} title='Local Data Snapshot'>
          <SectionList items={cacheRows} />
        </Card>

        <Card sm={10} title='Boundary'>
          <div className='space-y-3 text-sm leading-relaxed'>
            <p>
              This page is view-only. Machine writes, calibration, PID tuning, OTA, plugin management,
              and restart controls remain outside GaggiGo scope.
            </p>
            <div className='alert alert-warning shadow-sm'>
              <span>GaggiMate controls the machine. GaggiGo observes, stores, analyses, and syncs safe data.</span>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
