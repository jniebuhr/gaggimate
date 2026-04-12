import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import { useQuery } from 'preact-fetching';
import Card from '../../components/Card.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faScaleBalanced } from '@fortawesome/free-solid-svg-icons/faScaleBalanced';
import { machine } from '../../services/ApiService.js';
import { Spinner } from '../../components/Spinner.jsx';
import { faSignal } from '@fortawesome/free-solid-svg-icons/faSignal';
import { faNetworkWired } from '@fortawesome/free-solid-svg-icons';

// RSSI signal strength thresholds in dBm
const RSSI_POOR_THRESHOLD = -90;
const RSSI_WEAK_THRESHOLD = -80;

/**
 * Custom hook for auto-refreshing data at a specified interval
 * @param {number} intervalMs - Refresh interval in milliseconds
 * @returns {number} refreshKey - Timestamp that updates on each interval
 */
function useAutoRefresh(intervalMs = 10000) {
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const intervalHandle = setInterval(() => {
      setRefreshKey(Date.now());
    }, intervalMs);
    return () => clearInterval(intervalHandle);
  }, [intervalMs]);

  return refreshKey;
}

/**
 * Helper function to determine RSSI signal strength status class
 * @param {number} rssi - RSSI value in dBm
 * @returns {string} CSS class for signal strength indicator
 */
function getRssiStatusClass(rssi) {
  if (rssi < RSSI_POOR_THRESHOLD) return 'status-error';
  if (rssi < RSSI_WEAK_THRESHOLD) return 'status-warning';
  return 'status-success';
}

export function Scales() {
  const [isScanning, setIsScanning] = useState(false);
  const [manualRefreshKey, setManualRefreshKey] = useState(0);
  const refreshKey = useAutoRefresh(10000) + manualRefreshKey;
  const mode = machine.value.status.mode;

  // Combined query for both scales list and info - single network round-trip
  const {
    isLoading,
    isError,
    data,
  } = useQuery(`scales-${refreshKey}`, async () => {
    const [scalesRes, infoRes] = await Promise.all([
      fetch('/api/scales/list'),
      fetch('/api/scales/info'),
    ]);
    const [scales, info] = await Promise.all([scalesRes.json(), infoRes.json()]);
    return { scales, info };
  });

  // Derive scaleData from combined query result
  const scaleData = useMemo(() => {
    if (!data) return [];
    return data.info.connected ? [data.info] : data.scales;
  }, [data]);

  const onScan = useCallback(async () => {
    setIsScanning(true);
    try {
      await fetch('/api/scales/scan', {
        method: 'post',
      });
      setManualRefreshKey(Date.now());
    } catch (error) {
      console.error('Scan failed:', error);
    } finally {
      setIsScanning(false);
    }
  }, []);

  const onConnect = useCallback(
    async uuid => {
      try {
        const data = new FormData();
        data.append('uuid', uuid);
        await fetch('/api/scales/connect', {
          method: 'post',
          body: data,
        });
        setManualRefreshKey(Date.now());
      } catch (error) {
        console.error('Connection failed:', error);
      }
    },
    []
  );

  // Memoize loading state
  const loading = useMemo(() => isLoading || isScanning, [isLoading, isScanning]);

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
  const { isLoading, isError, scaleData, onConnect } = props;
  if (isError) {
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
                  <span className='mx-2' />
                  <FontAwesomeIcon icon={faSignal} /> {scale.rssi ?? 0}dB
                  <span className={`indicator-item status ml-2 ${getRssiStatusClass(scale.rssi ?? 0)}`} />
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
      {isLoading ? (
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
