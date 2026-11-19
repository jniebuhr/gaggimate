import { useState, useEffect, useCallback, useMemo, useRef } from 'preact/hooks';
import { useQuery } from 'preact-fetching';
import { Trans, useLingui } from '@lingui/react/macro';
import { msg } from '@lingui/core/macro';
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
import { GrinderIcon } from '../../../components/GrinderIcon.jsx';
import { buildDeviceList, deviceModelName, deviceStates } from '../../../utils/bluetoothDevices.js';

const DISCONNECT_BANNER_MS = 60000;
const CONNECT_PENDING_MS = 15000;

const CONNECT_ERROR_MESSAGES = {
  not_found: msg`The device wasn't found. Make sure it's switched on and nearby, then scan again.`,
  connect_failed: msg`The device was found, but the Bluetooth connection failed. Try again or restart the device.`,
  unsupported: msg`This device model couldn't be set up.`,
  request_failed: msg`GaggiMate didn't accept the request. Check the connection and try again.`,
};

// Labels per device type; the type icon carries the same text for screen readers.
const DEVICE_TYPE_LABELS = {
  scale: { name: msg`Scale`, saved: msg`Saved scale`, unknown: msg`Unknown Scale` },
  grinder: { name: msg`Grinder`, saved: msg`Saved grinder`, unknown: msg`Unknown grinder` },
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
  const { t, i18n } = useLingui();
  const [key, setKey] = useState(0);
  const [deviceData, setDeviceData] = useState([]);
  const [connectingUuid, setConnectingUuid] = useState(null);
  const [forgettingUuid, setForgettingUuid] = useState(null);
  const mode = machine.value.status.mode;
  const { scanning: isScanning, connectError, disconnected, connectedAt } = machine.value.scale;

  useEffect(() => {
    const intervalHandle = setInterval(() => {
      setKey(Date.now().valueOf());
    }, 10000);

    return () => clearInterval(intervalHandle);
  }, []);

  const {
    isLoading,
    isError,
    data: fetchedDevices = [],
  } = useQuery(`scales-${key}`, () => fetchJson('/api/scales/list'));

  const {
    isLoading: isInfoLoading,
    isError: isInfoError,
    data: deviceInfo,
  } = useQuery(`scale-info-${key}`, () => fetchJson('/api/scales/info'));

  useEffect(() => {
    if (!deviceInfo) {
      return;
    }
    setDeviceData(buildDeviceList(deviceInfo, fetchedDevices));
  }, [deviceInfo, fetchedDevices]);
  const connectedDevices = useMemo(
    () => deviceStates(deviceInfo).filter(device => device.connected),
    [deviceInfo],
  );

  // Refresh the list as soon as the firmware closes the scan window.
  const wasScanning = useRef(isScanning);
  useEffect(() => {
    if (wasScanning.current && !isScanning) {
      setKey(Date.now().valueOf());
    }
    wasScanning.current = isScanning;
  }, [isScanning]);

  // A device connected or dropped: show it right away instead of at the next periodic refresh.
  const disconnectedAt = disconnected?.at;
  useEffect(() => {
    if (connectedAt || disconnectedAt) {
      setKey(Date.now().valueOf());
    }
  }, [connectedAt, disconnectedAt]);

  // A connect attempt ends with a success/error event; also clear a stale one in case neither arrives.
  useEffect(() => {
    if (connectError || connectedDevices.some(device => device.uuid === connectingUuid)) {
      setConnectingUuid(null);
    }
  }, [connectedDevices, connectError, connectingUuid]);
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

  // The device reconnected: the disconnect notice no longer applies.
  useEffect(() => {
    if (disconnected && connectedDevices.some(device => device.type === disconnected.type)) {
      updateScaleState({ disconnected: null });
    }
  }, [connectedDevices, disconnected]);

  useEffect(() => {
    if (!disconnected) {
      return undefined;
    }
    const remaining = Math.max(0, disconnected.at + DISCONNECT_BANNER_MS - Date.now());
    const handle = setTimeout(() => updateScaleState({ disconnected: null }), remaining);
    return () => clearTimeout(handle);
  }, [disconnected]);

  // Nothing to act on in standby; the devices are disconnected on purpose.
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

  const onConnect = useCallback(async ({ uuid, type }) => {
    setConnectingUuid(uuid);
    updateScaleState({ connectError: null });
    try {
      const data = new FormData();
      data.append('uuid', uuid);
      data.append('type', type);
      await fetchJson('/api/scales/connect', { method: 'post', body: data });
      setKey(Date.now().valueOf());
    } catch (error) {
      console.error('Connection failed:', error);
      updateScaleState({
        connectError: { address: uuid, reason: 'request_failed', at: Date.now() },
      });
    }
  }, []);

  const onForget = useCallback(async ({ uuid, type }) => {
    setForgettingUuid(uuid);
    updateScaleState({ connectError: null, disconnected: null });
    try {
      const data = new FormData();
      data.append('type', type);
      await fetchJson('/api/scales/forget', { method: 'post', body: data });
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
  const errorAddress = connectError?.address;
  const errorMessage = CONNECT_ERROR_MESSAGES[connectError?.reason];
  const disconnectedType = disconnected?.type === 'grinder' ? 'grinder' : 'scale';
  const disconnectedName =
    (disconnected && (deviceModelName(disconnected.name, disconnectedType) || disconnected.name)) ||
    i18n._(DEVICE_TYPE_LABELS[disconnectedType].name);

  return (
    <div className='space-y-4 sm:space-y-6'>
      <Section title={t`Bluetooth Devices`}>
        <div className='flex flex-col gap-4'>
          <div className='border-base-content/5 flex flex-row items-center justify-between gap-4 border-b pb-4'>
            <span className='text-base-content/75 text-sm'>
              <Trans>
                Scan for nearby Bluetooth scales and grinders to connect them to GaggiMate.
              </Trans>
            </span>
            <button
              type='button'
              className='btn btn-primary btn-sm shrink-0'
              onClick={onScan}
              disabled={isScanning || mode === 0}
            >
              {mode > 0 && isScanning ? t`Scanning...` : t`Scan for Devices`}
              {mode > 0 && isScanning && <Spinner size={4} className='ml-2' />}
            </button>
          </div>

          {mode > 0 && connectError && (
            <ScaleNotice
              kind='error'
              title={errorAddress ? t`Couldn't connect to ${errorAddress}` : t`Scan failed`}
              message={errorMessage ? i18n._(errorMessage) : t`Connecting to the device failed.`}
              onDismiss={() => updateScaleState({ connectError: null })}
            />
          )}
          {mode > 0 && disconnected && (
            <ScaleNotice
              kind='warning'
              title={t`${disconnectedName} disconnected`}
              message={t`GaggiMate reconnects automatically once the device is switched on and in range.`}
              onDismiss={() => updateScaleState({ disconnected: null })}
            />
          )}

          <div className='w-full'>
            {mode === 0 && (
              <div className='border-base-content/8 bg-base-200/40 rounded-xl border py-12 text-center'>
                <div className='flex flex-col items-center space-y-4'>
                  <div>
                    <h3 className='text-base-content text-lg font-medium'>
                      <Trans>System in Standby</Trans>
                    </h3>
                    <p className='text-base-content/70 text-sm'>
                      <Trans>Please wake up GaggiMate from Standby to use Bluetooth devices.</Trans>
                    </p>
                  </div>
                </div>
              </div>
            )}
            {mode > 0 &&
              (loading ? (
                <BluetoothTabSkeleton />
              ) : (
                <DeviceList
                  isLoading={loading}
                  isError={isError}
                  isInfoError={isInfoError}
                  deviceData={deviceData}
                  connectingUuid={connectingUuid}
                  forgettingUuid={forgettingUuid}
                  onConnect={onConnect}
                  onForget={onForget}
                />
              ))}
            <div className='mt-4'>
              <div className='alert alert-warning text-xs'>
                <span>
                  <Trans>
                    Devices are automatically refreshed every 10 seconds. Use the scan button to
                    discover new devices.
                  </Trans>
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
        <Trans>Dismiss</Trans>
      </button>
    </div>
  );
}

function DeviceTypeIcon({ type, size }) {
  const { i18n } = useLingui();
  const label = i18n._(DEVICE_TYPE_LABELS[type].name);
  return (
    <span role='img' aria-label={label} title={label} className='inline-flex'>
      {type === 'grinder' ? (
        <GrinderIcon className={size === 'lg' ? 'fa-lg' : ''} />
      ) : (
        <FontAwesomeIcon icon={faScaleBalanced} size={size} />
      )}
    </span>
  );
}

// What the grinder itself reports, e.g. to check that the selected profile's settings arrived.
function GrinderSummary({ device }) {
  const { t } = useLingui();
  const { grindSize, rpm, feedRpm } = device;
  const parts = [];
  if (typeof grindSize === 'number') parts.push(t`Grind size ${grindSize}`);
  if (typeof rpm === 'number') parts.push(t`${rpm} rpm`);
  if (typeof feedRpm === 'number') parts.push(t`Feed ${feedRpm} rpm`);
  if (parts.length === 0) return null;
  return <p className='text-base-content/60 text-xs'>{parts.join(' · ')}</p>;
}

function DeviceList(props) {
  const {
    isLoading,
    isError,
    isInfoError,
    deviceData,
    connectingUuid,
    forgettingUuid,
    onConnect,
    onForget,
  } = props;
  const { t, i18n } = useLingui();
  if (isError || isInfoError) {
    return (
      <div className='alert alert-error'>
        <span>
          <Trans>Error loading devices. Please try again.</Trans>
        </span>
      </div>
    );
  }
  if (isLoading) {
    return <BluetoothTabSkeleton />;
  }
  return (
    <>
      {deviceData.length > 0 ? (
        <div className='space-y-4'>
          {deviceData.map(device => {
            const model = deviceModelName(device.name, device.type);
            const labels = DEVICE_TYPE_LABELS[device.type];
            return (
              <div
                key={`${device.type}-${device.uuid}`}
                className='border-base-content/10 bg-base-100 flex flex-col space-y-4 rounded-xl border p-4 shadow-sm md:flex-row md:items-center md:justify-between md:space-y-0'
              >
                <div className='flex items-center space-x-4'>
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                      device.connected
                        ? 'bg-success/20 text-success'
                        : 'bg-base-200 text-base-content/50'
                    }`}
                  >
                    <DeviceTypeIcon type={device.type} size='lg' />
                  </div>
                  <div>
                    <h4 className='text-base-content font-bold'>
                      {model || device.name || i18n._(device.saved ? labels.saved : labels.unknown)}
                      <span
                        className={`ml-2 inline-block h-2 w-2 rounded-full ${
                          device.connected ? 'bg-success' : 'bg-base-content/20'
                        }`}
                      />
                    </h4>
                    {model && <p className='text-base-content/60 text-xs'>{device.name}</p>}
                    {device.outOfRange && (
                      <p className='text-base-content/60 text-xs'>
                        <Trans>Not in range. Switch it on to reconnect.</Trans>
                      </p>
                    )}
                    {device.connected && device.type === 'grinder' && (
                      <GrinderSummary device={device} />
                    )}
                    <p className='text-base-content/70 flex items-center space-x-2 text-sm'>
                      <span className='font-mono text-xs'>{device.uuid}</span>
                      {device.saved && !device.connected && (
                        <span className='badge badge-ghost badge-xs'>
                          <Trans context='scale state'>Saved</Trans>
                        </span>
                      )}
                      {device.connected &&
                        device.hasBattery &&
                        typeof device.battery === 'number' && (
                          <span
                            className={`flex items-center gap-1 ${batteryColorClass(device.battery)}`}
                          >
                            <FontAwesomeIcon icon={batteryIcon(device.battery)} /> {device.battery}%
                          </span>
                        )}
                    </p>
                  </div>
                </div>
                <div className='flex w-full items-center gap-2 md:w-auto'>
                  {device.connected && (
                    <div className='badge badge-success gap-2'>
                      <Trans context='scale state'>Connected</Trans>
                    </div>
                  )}
                  {!device.connected && !device.outOfRange && (
                    <button
                      type='button'
                      className='btn btn-primary btn-sm flex-1 md:flex-none'
                      onClick={() => onConnect(device)}
                      disabled={!!connectingUuid || !!forgettingUuid}
                    >
                      {connectingUuid === device.uuid ? t`Connecting...` : t`Connect`}
                      {connectingUuid === device.uuid && <Spinner size={4} className='ml-2' />}
                    </button>
                  )}
                  {device.saved && (
                    <button
                      type='button'
                      className={`btn btn-ghost btn-sm text-error ${device.connected || device.outOfRange ? 'ml-auto md:ml-0' : ''}`}
                      onClick={() => onForget(device)}
                      disabled={!!forgettingUuid}
                    >
                      {forgettingUuid === device.uuid ? t`Forgetting...` : t`Forget`}
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
            <div className='text-base-content/30 flex gap-6 text-6xl'>
              <FontAwesomeIcon icon={faScaleBalanced} />
              <GrinderIcon />
            </div>
            <div>
              <h3 className='text-base-content text-lg font-medium'>
                <Trans>No devices found</Trans>
              </h3>
              <p className='text-base-content/70 text-sm'>
                <Trans>Click "Scan" to discover Bluetooth devices nearby</Trans>
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
