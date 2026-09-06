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
import { BluetoothTabSkeleton } from '../../../components/skeletons/SettingsSkeletons.jsx';

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
          <div className='border-base-content/5 flex flex-row items-center justify-between gap-4 border-b pb-4'>
            <span className='text-base-content/75 text-sm'>
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
                  onConnect={onConnect}
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

function ScaleList(props) {
  const { isLoading, isInfoLoading, isError, isInfoError, scaleData, onConnect } = props;
  if (isError || isInfoError) {
    return (
      <div className='alert alert-error'>
        <span>Error loading devices. Please try again.</span>
      </div>
    );
  }
  if (isLoading || isInfoLoading) {
    return <BluetoothTabSkeleton />;
  }
  return (
    <>
      {scaleData.length > 0 ? (
        <div className='space-y-4'>
          {scaleData.map(scale => (
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
                    {scale.name || 'Unknown Scale'}
                    <span
                      className={`ml-2 inline-block h-2 w-2 rounded-full ${
                        scale.connected ? 'bg-success' : 'bg-base-content/20'
                      }`}
                    ></span>
                  </h4>
                  <p className='text-base-content/70 flex items-center space-x-2 text-sm'>
                    <span className='font-mono text-xs'>{scale.uuid}</span>
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
              <div className='flex items-center space-x-3'>
                {scale.connected ? (
                  <div className='badge badge-success gap-2'>Connected</div>
                ) : (
                  <button
                    type='button'
                    className='btn btn-primary btn-sm'
                    onClick={() => onConnect(scale.uuid)}
                  >
                    Connect
                  </button>
                )}
              </div>
            </div>
          ))}
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
