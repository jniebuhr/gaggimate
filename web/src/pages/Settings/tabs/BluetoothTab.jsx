import { useState, useEffect, useCallback } from 'preact/hooks';
import { useQuery } from 'preact-fetching';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faScaleBalanced } from '@fortawesome/free-solid-svg-icons/faScaleBalanced';
import { machine } from '../../../services/ApiService.js';
import { Spinner } from '../../../components/Spinner.jsx';
import Section from '../../../components/Card.jsx';
import { faSignal } from '@fortawesome/free-solid-svg-icons/faSignal';
import { faNetworkWired } from '@fortawesome/free-solid-svg-icons/faNetworkWired';
import { faBatteryFull } from '@fortawesome/free-solid-svg-icons/faBatteryFull';
import { faBatteryThreeQuarters } from '@fortawesome/free-solid-svg-icons/faBatteryThreeQuarters';
import { faBatteryHalf } from '@fortawesome/free-solid-svg-icons/faBatteryHalf';
import { faBatteryQuarter } from '@fortawesome/free-solid-svg-icons/faBatteryQuarter';
import { faBatteryEmpty } from '@fortawesome/free-solid-svg-icons/faBatteryEmpty';

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
      setKey(Date.now().valueOf());
    } catch (error) {
      console.error('Connection failed:', error);
    }
  }, []);

  const loading = isLoading || isInfoLoading || isScanning;

  return (
    <div className='space-y-4 sm:space-y-6'>
      <Section title='Bluetooth Devices'>
        <div className='flex flex-col gap-4'>
          <div className='flex flex-row items-center justify-between gap-4 border-b border-base-content/5 pb-4'>
            <span className='text-sm text-base-content/75'>
              Scan for nearby Bluetooth scales to connect them to GaggiMate.
            </span>
            <button
              type='button'
              className='btn btn-primary btn-sm shrink-0'
              onClick={onScan}
              disabled={loading || mode === 0}
            >
              {mode > 0 && loading ? 'Scanning...' : 'Scan for Devices'}
              {mode > 0 && loading && <Spinner size={4} className='ml-2' />}
            </button>
          </div>

          <div className='w-full'>
            {mode === 0 && (
              <div className='py-12 text-center border border-base-content/8 rounded-xl bg-base-200/40'>
                <div className='flex flex-col items-center space-y-4'>
                  <div>
                    <h3 className='text-base-content text-lg font-medium'>System in Standby</h3>
                    <p className='text-base-content/70 text-sm'>
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
            <div className='mt-4'>
              <div className='alert alert-warning text-xs'>
                <span>
                  Scales are automatically refreshed every 10 seconds. Use the scan button to discover
                  new devices.
                </span>
              </div>
            </div>
          </div>
        </div>
      </Section>
    </div>
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
          <div key={i} className='bg-base-200/40 border border-base-content/8 rounded-xl p-4'>
            <div className='flex items-center justify-between'>
              <div className='px-4 text-lg text-base-content'>
                <FontAwesomeIcon icon={faScaleBalanced} />
              </div>
              <div className='flex-1'>
                <h3 className='text-base-content font-semibold'>{scale.name}</h3>
                <p className='text-base-content/60 text-sm flex flex-wrap gap-x-4 gap-y-1 mt-1'>
                  <span className='flex items-center gap-1'>
                    <FontAwesomeIcon icon={faNetworkWired} /> {scale.uuid}
                  </span>
                  <span className='flex items-center gap-1'>
                    <FontAwesomeIcon icon={faSignal} /> {scale.rssi}dB
                    <span
                      className={`indicator-item status ml-1 ${scale.rssi < -90 ? 'status-error' : scale.rssi < -80 ? 'status-warning' : 'status-success'}`}
                    ></span>
                  </span>
                  {scale.connected && scale.hasBattery && typeof scale.battery === 'number' && (
                    <span className={`flex items-center gap-1 ${batteryColorClass(scale.battery)}`}>
                      <FontAwesomeIcon icon={batteryIcon(scale.battery)} /> {scale.battery}%
                    </span>
                  )}
                </p>
              </div>
              <div className='flex items-center space-x-3'>
                {scale.connected ? (
                  <div className='badge badge-success gap-2'>Connected</div>
                ) : (
                  <button type='button' className='btn btn-primary btn-sm' onClick={() => onConnect(scale.uuid)}>
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
          <Spinner size={8} />
          <span className='text-base-content/70 ml-3'>Loading devices...</span>
        </div>
      ) : (
        <div className='py-12 text-center border border-base-content/8 rounded-xl bg-base-200/40'>
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
