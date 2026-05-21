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

export function Scales() {
  const [key, setKey] = useState(0);
  const [scaleData, setScaleData] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const mode = machine.value.status.mode;

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
    const data = await response.json();
    return data;
  });

  const {
    isInfoLoading,
    isInfoError,
    data: connectedScale = [],
  } = useQuery(`scale-info-${key}`, async () => {
    const response = await fetch(`/api/scales/info`);
    const data = await response.json();
    return data;
  });

  useEffect(() => {
    if (!connectedScale || fetchedScales.length === 0) {
      return;
    }
    const scales = connectedScale.connected ? [connectedScale] : fetchedScales;
    setScaleData(scales);
  }, [connectedScale, fetchedScales]);

  const onScan = useCallback(async () => {
    setIsScanning(true);
    try {
      await fetch('/api/scales/scan', {
        method: 'post',
      });
      // Refresh the data after scan
      setKey(Date.now().valueOf());
    } catch (error) {
      console.error('Scan failed:', error);
    } finally {
      setIsScanning(false);
    }
  }, [setIsScanning]);

  const onConnect = useCallback(async uuid => {
    try {
      const data = new FormData();
      data.append('uuid', uuid);
      await fetch('/api/scales/connect', {
        method: 'post',
        body: data,
      });
      // Refresh the data after connection
      setKey(Date.now().valueOf());
    } catch (error) {
      console.error('Connection failed:', error);
    }
  }, []);

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
