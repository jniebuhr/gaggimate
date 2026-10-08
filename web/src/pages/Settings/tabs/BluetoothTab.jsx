import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { useQuery } from 'preact-fetching';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faScaleBalanced } from '@fortawesome/free-solid-svg-icons/faScaleBalanced';
import { machine, updateScaleState } from '../../../services/ApiService.js';
import { Spinner } from '../../../components/Spinner.jsx';
import Section from '../../../components/Card.jsx';
import { faBatteryFull } from '@fortawesome/free-solid-svg-icons/faBatteryFull';
import { faBatteryThreeQuarters } from '@fortawesome/free-solid-svg-icons/faBatteryThreeQuarters';
import { faBatteryHalf } from '@fortawesome/free-solid-svg-icons/faBatteryHalf';
import { faBatteryQuarter } from '@fortawesome/free-solid-svg-icons/faBatteryQuarter';
import { faBatteryEmpty } from '@fortawesome/free-solid-svg-icons/faBatteryEmpty';
import { BluetoothTabSkeleton } from '../../../components/skeletons/SettingsSkeletons.jsx';
import { scaleModelName } from '../../../utils/scaleModels.js';

const DISCONNECT_BANNER_MS = 60000;
const CONNECT_PENDING_MS = 15000;

const CONNECT_ERROR_MESSAGES = {
  not_found: "The scale wasn't found. Make sure it's switched on and nearby, then scan again.",
  connect_failed:
    'The scale was found, but the Bluetooth connection failed. Try again or restart the scale.',
  unsupported: "This scale model couldn't be set up.",
  request_failed: "GaggiMate didn't accept the request. Check the connection and try again.",
};

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

function batteryIcon(pct) {
  if (pct >= 87) return faBatteryFull;
  if (pct >= 62) return faBatteryThreeQuarters;
  if (pct >= 37) return faBatteryHalf;
  if (pct >= 12) return faBatteryQuarter;
  return faBatteryEmpty;
}

function batteryColorClass(pct) {
  if (pct <= 9) return 'text-error';
  if (pct <= 29) return 'text-warning';
  return 'text-base-content/60';
}

export function BluetoothTab() {
  const [key, setKey] = useState(0);
  const [scaleData, setScaleData] = useState([]);
  const [connectingUuid, setConnectingUuid] = useState(null);
  const [forgettingUuid, setForgettingUuid] = useState(null);
  const mode = machine.value.status.mode;
  const { scanning: isScanning, connectError, disconnected } = machine.value.scale;

  useEffect(() => {
    const intervalHandle = setInterval(() => {
      setKey(Date.now().valueOf());
    }, 10000);

    return () => clearInterval(intervalHandle);
  }, []);

  const {
    isLoading,
    isError,
    data: fetchedScales = [],
  } = useQuery(`scales-${key}`, () => fetchJson('/api/scales/list'));

  const {
    isLoading: isInfoLoading,
    isError: isInfoError,
    data: connectedScale,
  } = useQuery(`scale-info-${key}`, () => fetchJson('/api/scales/info'));

  useEffect(() => {
    if (!connectedScale) {
      return;
    }
    if (connectedScale.connected) {
      setScaleData([{ ...connectedScale, saved: true }]);
      return;
    }
    const saved = connectedScale.saved;
    const scales = fetchedScales.map(scale => ({ ...scale, saved: scale.uuid === saved }));
    if (saved && !scales.some(scale => scale.saved)) {
      // Saved but not advertising: keep it listed so it can still be forgotten.
      scales.push({
        uuid: saved,
        name: connectedScale.savedName || '',
        saved: true,
        outOfRange: true,
      });
    }
    scales.sort((a, b) => Number(b.saved) - Number(a.saved));
    setScaleData(scales);
  }, [connectedScale, fetchedScales]);

  // Refresh the list as soon as the firmware closes the scan window.
  const wasScanning = useRef(isScanning);
  useEffect(() => {
    if (wasScanning.current && !isScanning) {
      setKey(Date.now().valueOf());
    }
    wasScanning.current = isScanning;
  }, [isScanning]);

  // A connect attempt ends with a success/error event; also clear a stale one in case neither arrives.
  useEffect(() => {
    if (connectedScale?.connected || connectError) {
      setConnectingUuid(null);
    }
  }, [connectedScale, connectError]);
  useEffect(() => {
    if (!connectingUuid) {
      return undefined;
    }
    const handle = setTimeout(() => {
      setConnectingUuid(null);
      setKey(Date.now().valueOf());
    }, CONNECT_PENDING_MS);
    return () => clearTimeout(handle);
  }, [connectingUuid]);

  // The scale reconnected: the disconnect notice no longer applies.
  useEffect(() => {
    if (connectedScale?.connected && disconnected) {
      updateScaleState({ disconnected: null });
    }
  }, [connectedScale, disconnected]);

  useEffect(() => {
    if (!disconnected) {
      return undefined;
    }
    const remaining = Math.max(0, disconnected.at + DISCONNECT_BANNER_MS - Date.now());
    const handle = setTimeout(() => updateScaleState({ disconnected: null }), remaining);
    return () => clearTimeout(handle);
  }, [disconnected]);

  // Nothing to act on in standby; the scale is powered off on purpose.
  useEffect(() => {
    if (mode === 0) {
      updateScaleState({ connectError: null, disconnected: null });
      setConnectingUuid(null);
    }
  }, [mode]);

  const onScan = useCallback(async () => {
    updateScaleState({ scanning: true, connectError: null });
    try {
      await fetchJson('/api/scales/scan', { method: 'post' });
    } catch (error) {
      console.error('Scan failed:', error);
      updateScaleState({
        scanning: false,
        connectError: { address: null, reason: 'request_failed', at: Date.now() },
      });
    }
  }, []);

  const onConnect = useCallback(async uuid => {
    setConnectingUuid(uuid);
    updateScaleState({ connectError: null });
    try {
      const data = new FormData();
      data.append('uuid', uuid);
      await fetchJson('/api/scales/connect', { method: 'post', body: data });
      setKey(Date.now().valueOf());
    } catch (error) {
      console.error('Connection failed:', error);
      updateScaleState({
        connectError: { address: uuid, reason: 'request_failed', at: Date.now() },
      });
    }
  }, []);

  const onForget = useCallback(async uuid => {
    setForgettingUuid(uuid);
    updateScaleState({ connectError: null, disconnected: null });
    try {
      await fetchJson('/api/scales/forget', { method: 'post' });
      // The plugin forgets on its next loop tick; refresh just after.
      setTimeout(() => {
        setForgettingUuid(null);
        setKey(Date.now().valueOf());
      }, 500);
    } catch (error) {
      console.error('Forget failed:', error);
      setForgettingUuid(null);
    }
  }, []);

  const loading = isLoading || isInfoLoading;

  return (
    <div className='space-y-4 sm:space-y-6'>
      <Section title='Bluetooth Devices'>
        <div className='flex flex-col gap-4'>
          <div className='border-base-content/5 flex flex-row items-center justify-between gap-4 border-b pb-4'>
            <span className='text-base-content/75 text-sm'>
              Scan for nearby Bluetooth scales to connect them to GaggiMate.
            </span>
            <button
              type='button'
              className='btn btn-primary btn-sm shrink-0'
              onClick={onScan}
              disabled={isScanning || mode === 0}
            >
              {mode > 0 && isScanning ? 'Scanning...' : 'Scan for Devices'}
              {mode > 0 && isScanning && <Spinner size={4} className='ml-2' />}
            </button>
          </div>

          {mode > 0 && connectError && (
            <ScaleNotice
              kind='error'
              title={
                connectError.address ? `Couldn't connect to ${connectError.address}` : 'Scan failed'
              }
              message={
                CONNECT_ERROR_MESSAGES[connectError.reason] || 'Connecting to the scale failed.'
              }
              onDismiss={() => updateScaleState({ connectError: null })}
            />
          )}
          {mode > 0 && disconnected && (
            <ScaleNotice
              kind='warning'
              title={`${scaleModelName(disconnected.name) || disconnected.name || 'Scale'} disconnected`}
              message='GaggiMate reconnects automatically once the scale is switched on and in range.'
              onDismiss={() => updateScaleState({ disconnected: null })}
            />
          )}

          <div className='w-full'>
            {mode === 0 && (
              <div className='border-base-content/8 bg-base-200/40 rounded-xl border py-12 text-center'>
                <div className='flex flex-col items-center space-y-4'>
                  <div>
                    <h3 className='text-base-content text-lg font-medium'>System in Standby</h3>
                    <p className='text-base-content/70 text-sm'>
                      Please wake up GaggiMate from Standby to use Bluetooth scales.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {mode > 0 &&
              (loading ? (
                <BluetoothTabSkeleton />
              ) : (
                <ScaleList
                  isLoading={loading}
                  isError={isError}
                  isInfoError={isInfoError}
                  scaleData={scaleData}
                  connectingUuid={connectingUuid}
                  forgettingUuid={forgettingUuid}
                  onConnect={onConnect}
                  onForget={onForget}
                />
              ))}
            <div className='mt-4'>
              <div className='alert alert-warning text-xs'>
                <span>
                  Scales are automatically refreshed every 10 seconds. Use the scan button to
                  discover new devices.
                </span>
              </div>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}

function ScaleNotice({ kind, title, message, onDismiss }) {
  return (
    <div
      role='alert'
      className={`alert ${kind === 'error' ? 'alert-error' : 'alert-warning'} flex justify-between`}
    >
      <div className='flex flex-col'>
        <span className='font-semibold'>{title}</span>
        <span className='text-sm'>{message}</span>
      </div>
      <button type='button' className='btn btn-ghost btn-sm' onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}

function ScaleList(props) {
  const {
    isLoading,
    isError,
    isInfoError,
    scaleData,
    connectingUuid,
    forgettingUuid,
    onConnect,
    onForget,
  } = props;
  if (isError || isInfoError) {
    return (
      <div className='alert alert-error'>
        <span>Error loading devices. Please try again.</span>
      </div>
    );
  }
  if (isLoading) {
    return <BluetoothTabSkeleton />;
  }
  return (
    <>
      {scaleData.length > 0 ? (
        <div className='space-y-4'>
          {scaleData.map(scale => {
            const model = scaleModelName(scale.name);
            return (
              <div
                key={scale.uuid}
                className='border-base-content/10 bg-base-100 flex flex-col space-y-4 rounded-xl border p-4 shadow-sm md:flex-row md:items-center md:justify-between md:space-y-0'
              >
                <div className='flex items-center space-x-4'>
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                      scale.connected
                        ? 'bg-success/20 text-success'
                        : 'bg-base-200 text-base-content/50'
                    }`}
                  >
                    <FontAwesomeIcon icon={faScaleBalanced} size='lg' />
                  </div>
                  <div>
                    <h4 className='text-base-content font-bold'>
                      {model || scale.name || (scale.saved ? 'Saved scale' : 'Unknown Scale')}
                      <span
                        className={`ml-2 inline-block h-2 w-2 rounded-full ${
                          scale.connected ? 'bg-success' : 'bg-base-content/20'
                        }`}
                      />
                    </h4>
                    {model && <p className='text-base-content/60 text-xs'>{scale.name}</p>}
                    {scale.outOfRange && (
                      <p className='text-base-content/60 text-xs'>
                        Not in range. Switch it on to reconnect.
                      </p>
                    )}
                    <p className='text-base-content/70 flex items-center space-x-2 text-sm'>
                      <span className='font-mono text-xs'>{scale.uuid}</span>
                      {scale.saved && !scale.connected && (
                        <span className='badge badge-ghost badge-xs'>Saved</span>
                      )}
                      {scale.connected && scale.hasBattery && typeof scale.battery === 'number' && (
                        <span
                          className={`flex items-center gap-1 ${batteryColorClass(scale.battery)}`}
                        >
                          <FontAwesomeIcon icon={batteryIcon(scale.battery)} /> {scale.battery}%
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className='flex w-full items-center gap-2 md:w-auto'>
                  {scale.connected && <div className='badge badge-success gap-2'>Connected</div>}
                  {!scale.connected && !scale.outOfRange && (
                    <button
                      type='button'
                      className='btn btn-primary btn-sm flex-1 md:flex-none'
                      onClick={() => onConnect(scale.uuid)}
                      disabled={!!connectingUuid || !!forgettingUuid}
                    >
                      {connectingUuid === scale.uuid ? 'Connecting...' : 'Connect'}
                      {connectingUuid === scale.uuid && <Spinner size={4} className='ml-2' />}
                    </button>
                  )}
                  {scale.saved && (
                    <button
                      type='button'
                      className={`btn btn-ghost btn-sm text-error ${scale.connected || scale.outOfRange ? 'ml-auto md:ml-0' : ''}`}
                      onClick={() => onForget(scale.uuid)}
                      disabled={!!forgettingUuid}
                    >
                      {forgettingUuid === scale.uuid ? 'Forgetting...' : 'Forget'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className='border-base-content/8 bg-base-200/40 rounded-xl border py-12 text-center'>
          <div className='flex flex-col items-center space-y-4'>
            <div className='text-base-content/30 text-6xl'>
              <FontAwesomeIcon icon={faScaleBalanced} />
            </div>
            <div>
              <h3 className='text-base-content text-lg font-medium'>No scales found</h3>
              <p className='text-base-content/70 text-sm'>
                Click "Scan" to discover Bluetooth scales nearby
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
