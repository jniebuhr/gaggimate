import { useState, useEffect, useCallback } from 'preact/hooks';
import { useQuery } from 'preact-fetching';
import Card from '../../components/Card.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faScaleBalanced } from '@fortawesome/free-solid-svg-icons/faScaleBalanced';
import { machine } from '../../services/ApiService.js';
import { Spinner } from '../../components/Spinner.jsx';
import { faSignal } from '@fortawesome/free-solid-svg-icons/faSignal';
import { faNetworkWired } from '@fortawesome/free-solid-svg-icons';
import { faBatteryFull } from '@fortawesome/free-solid-svg-icons/faBatteryFull';
import { faBatteryThreeQuarters } from '@fortawesome/free-solid-svg-icons/faBatteryThreeQuarters';
import { faBatteryHalf } from '@fortawesome/free-solid-svg-icons/faBatteryHalf';
import { faBatteryQuarter } from '@fortawesome/free-solid-svg-icons/faBatteryQuarter';
import { faBatteryEmpty } from '@fortawesome/free-solid-svg-icons/faBatteryEmpty';

// Pick an icon that roughly matches the fill level for a richer at-a-glance
// read on the Scales page. The thresholds here are visual-only; the color
// below is what actually conveys "pay attention" (≤9% red, ≤29% yellow).
function batteryIcon(pct) {
  if (pct >= 87) return faBatteryFull;
  if (pct >= 62) return faBatteryThreeQuarters;
  if (pct >= 37) return faBatteryHalf;
  if (pct >= 12) return faBatteryQuarter;
  return faBatteryEmpty;
}

function batteryColorClass(pct) {
  if (pct <= 9) return 'text-error'; // critical — user must charge soon
  if (pct <= 29) return 'text-warning'; // heads-up
  return 'text-base-content/60'; // everyday — same tone as RSSI
}

// Map firmware-emitted connect:error `reason` codes to user-readable text.
// Stays in sync with BLEScalePlugin::emitConnectError call sites.
function describeConnectErrorReason(reason) {
  switch (reason) {
    case 'device_not_found':
      return "Device disappeared before connection could complete. Try scanning again.";
    case 'ble_connect_failed':
      return 'BLE connection refused. Power-cycle the scale and try again.';
    case 'factory_create_failed':
    case 'factory_null':
      return 'Scale driver unavailable. This model may not be supported.';
    case 'request_failed':
      return 'Network request failed. Check the device is reachable.';
    default:
      return 'Connection failed. See logs for details.';
  }
}

export function Scales() {
  const [key, setKey] = useState(0);
  const [scaleData, setScaleData] = useState([]);
  const [connectError, setConnectError] = useState(null);
  const [disconnectedAt, setDisconnectedAt] = useState(0);
  const mode = machine.value.status.mode;
  // Firmware-driven scan state: the back end emits evt:scale:scan:complete
  // SCAN_DURATION_MS (~5 s) after a scan starts, and ApiService writes
  // machine.scale.scanning. We mirror that here so the spinner stays up
  // for the actual scan window, not just until the HTTP POST returns.
  const isScanning = !!machine.value.scale?.scanning;

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
  } = useQuery(`scales-${key}`, async () => {
    const response = await fetch(`/api/scales/list`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return data;
  });

  const {
    isInfoLoading,
    isInfoError,
    data: connectedScale = [],
  } = useQuery(`scale-info-${key}`, async () => {
    const response = await fetch(`/api/scales/info`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return data;
  });

  useEffect(() => {
    // If a scale is already connected (e.g. auto-reconnected to the last
    // known scale at boot), show it even when the discovery list is empty.
    // The prior `fetchedScales.length === 0` early-return meant a connected
    // scale silently disappeared from /scales whenever no scan had populated
    // the list yet — even though it was correctly streaming weight to the
    // dashboard.
    if (!connectedScale) {
      setScaleData(fetchedScales);
      return;
    }
    if (connectedScale.connected) {
      setScaleData([connectedScale]);
      // Belt-and-suspenders: if a connect-success WS event was missed
      // (e.g. WS reconnected mid-event), the 10 s /api/scales/info poll
      // is our other source-of-truth for "scale is now connected." Clear
      // the stale disconnect banner + lingering connect error here too.
      setDisconnectedAt(0);
      setConnectError(null);
    } else {
      setScaleData(fetchedScales);
    }
  }, [connectedScale, fetchedScales]);

  const onScan = useCallback(async () => {
    // Optimistically flip scanning=true so the UI updates immediately;
    // the firmware will flip it back to false via evt:scale:scan:complete
    // when the scan window closes (or sooner if a connect attempt aborts
    // the scan).
    machine.value = {
      ...machine.value,
      scale: { ...(machine.value.scale || {}), scanning: true },
    };
    setConnectError(null);
    try {
      const response = await fetch('/api/scales/scan', {
        method: 'post',
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      // Refresh the displayed list after scan kicks off; the firmware
      // event drives the spinner-off transition independently.
      setKey(Date.now().valueOf());
    } catch (error) {
      console.error('Scan failed:', error);
      machine.value = {
        ...machine.value,
        scale: { ...(machine.value.scale || {}), scanning: false },
      };
    }
  }, []);

  const onConnect = useCallback(async uuid => {
    setConnectError(null);
    try {
      const data = new FormData();
      data.append('uuid', uuid);
      const response = await fetch('/api/scales/connect', {
        method: 'post',
        body: data,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      // Refresh the data after connection
      setKey(Date.now().valueOf());
    } catch (error) {
      console.error('Connection failed:', error);
      setConnectError({ address: uuid, reason: 'request_failed' });
    }
  }, []);

  // Mirror firmware-emitted scale events into local state for banners.
  // The machine.scale signal updates from ApiService when the WS event
  // arrives; we copy into setConnectError to scope per-page dismissal.
  useEffect(() => {
    const err = machine.value.scale?.lastConnectError;
    if (err && err.at) {
      setConnectError(err);
    }
  }, [machine.value.scale?.lastConnectError?.at]);

  useEffect(() => {
    const ts = machine.value.scale?.lastDisconnectAt;
    if (ts) {
      setDisconnectedAt(ts);
    }
  }, [machine.value.scale?.lastDisconnectAt]);

  // Force the disconnect banner to auto-clear at the 60 s deadline so it
  // doesn't sit stuck on screen if the user idles. The render-time
  // `Date.now() - disconnectedAt < 60000` check only re-evaluates on
  // parent state changes; without this timer the banner would stay
  // visible past its intended dismissal window.
  useEffect(() => {
    if (disconnectedAt === 0) return;
    const elapsed = Date.now() - disconnectedAt;
    if (elapsed >= 60000) {
      setDisconnectedAt(0);
      return;
    }
    const handle = setTimeout(() => setDisconnectedAt(0), 60000 - elapsed);
    return () => clearTimeout(handle);
  }, [disconnectedAt]);

  // Clear residual banners when the device enters standby. Without this
  // a "scale disconnected" or "connect failed" notice persists into a
  // mode where the user has no actionable response (scan is disabled),
  // confusing the dashboard until they navigate away and back.
  useEffect(() => {
    if (mode === 0) {
      setDisconnectedAt(0);
      setConnectError(null);
    }
  }, [mode]);

  const loading = isLoading || isInfoLoading || isScanning;

  return (
    <>
      <div className='mb-4 flex flex-row items-center justify-between gap-4'>
        <h1 className='text-2xl font-bold sm:text-3xl'>Bluetooth Devices</h1>
        <button className={`btn btn-primary`} onClick={onScan} disabled={loading || mode === 0}>
          {mode > 0 && loading ? 'Scanning...' : 'Scan for Devices'}
          {mode > 0 && loading && <Spinner size={8} className='ml-4' />}
        </button>
      </div>

      {connectError && (
        <div role='alert' className='alert alert-error mb-4'>
          <div className='flex-1'>
            <span className='font-semibold'>Connection failed.</span>{' '}
            <span className='opacity-80'>{describeConnectErrorReason(connectError.reason)}</span>
            {connectError.address && (
              <span className='ml-2 font-mono text-xs opacity-60'>({connectError.address})</span>
            )}
          </div>
          <button type='button' className='btn btn-sm' onClick={() => setConnectError(null)}>
            Dismiss
          </button>
        </div>
      )}
      {disconnectedAt > 0 && Date.now() - disconnectedAt < 60000 && (
        <div role='alert' className='alert alert-warning mb-4'>
          <div className='flex-1'>
            <span className='font-semibold'>Scale disconnected.</span>{' '}
            <span className='opacity-80'>
              Reconnection attempts were exhausted. Re-scan or check the scale's power.
            </span>
          </div>
          <button type='button' className='btn btn-sm' onClick={() => setDisconnectedAt(0)}>
            Dismiss
          </button>
        </div>
      )}

      <div className='grid grid-cols-1 gap-4 lg:grid-cols-12'>
        <Card sm={12} title='Available Devices'>
          {mode === 0 && (
            <div className='py-12 text-center'>
              <div className='flex flex-col items-center space-y-4'>
                <div>
                  <h3 className='text-base-content text-lg font-medium'>System in Standby</h3>
                  <p className='text-base-content/70'>
                    Please put GaggiMate in Brew or Grind mode to use Bluetooth scales.
                  </p>
                </div>
              </div>
            </div>
          )}
          {mode > 0 && (
            <ScaleList
              isLoading={loading}
              isError={isError}
              isInfoError={isInfoError}
              scaleData={scaleData}
              onConnect={onConnect}
            />
          )}
          <div className='mt-2 space-y-4 lg:col-span-12'>
            <div className='alert alert-warning'>
              <span>
                Scales are automatically refreshed every 10 seconds. Use the scan button to discover
                new devices.
              </span>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

function ScaleList(props) {
  const { isLoading, isInfoLoading, isError, isInfoError, scaleData, onConnect } = props;
  if (isError || isInfoError) {
    return (
      <div className='alert alert-error'>
        <span>Error loading devices. Please try again.</span>
      </div>
    );
  }
  if (scaleData.length > 0) {
    return (
      <div className='space-y-4'>
        {scaleData.map((scale, i) => (
          <div key={i} className='bg-base-200 border-base-300 rounded-lg border p-4'>
            <div className='flex items-center justify-between'>
              <div className='px-4 text-lg'>
                <FontAwesomeIcon icon={faScaleBalanced} />
              </div>
              <div className='flex-1'>
                <h3 className='text-base-content font-semibold'>{scale.name}</h3>
                <p className='text-base-content/60 text-sm'>
                  <FontAwesomeIcon icon={faNetworkWired} /> {scale.uuid}
                  <span className='mx-2'></span>
                  <FontAwesomeIcon icon={faSignal} /> {scale.rssi}dB
                  <span
                    className={`indicator-item status ml-2 ${scale.rssi < -90 ? 'status-error' : scale.rssi < -80 ? 'status-warning' : 'status-success'}`}
                  ></span>
                  {scale.connected && scale.hasBattery && typeof scale.battery === 'number' && (
                    <>
                      <span className='mx-2'></span>
                      <span className={batteryColorClass(scale.battery)}>
                        <FontAwesomeIcon icon={batteryIcon(scale.battery)} /> {scale.battery}%
                      </span>
                    </>
                  )}
                </p>
              </div>
              <div className='flex items-center space-x-3'>
                {scale.connected ? (
                  <div className='badge badge-success gap-2'>Connected</div>
                ) : (
                  <button className='btn btn-primary btn-sm' onClick={() => onConnect(scale.uuid)}>
                    Connect
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <>
      {isLoading || isInfoLoading ? (
        <div className='flex items-center justify-center py-12'>
          <span className='loading loading-spinner loading-lg' />
          <span className='text-base-content/70 ml-3'>Loading devices...</span>
        </div>
      ) : (
        <div className='py-12 text-center'>
          <div className='flex flex-col items-center space-y-4'>
            <div className='text-base-content/30 text-6xl'>
              <FontAwesomeIcon icon={faScaleBalanced} />
            </div>
            <div>
              <h3 className='text-base-content text-lg font-medium'>No scales found</h3>
              <p className='text-base-content/70'>
                Click "Scan" to discover Bluetooth scales nearby
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
