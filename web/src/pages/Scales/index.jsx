import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import { useQuery } from 'preact-fetching';
import Card from '../../components/Card.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faScaleBalanced } from '@fortawesome/free-solid-svg-icons/faScaleBalanced';
import { machine } from '../../services/ApiService.js';
import { Spinner } from '../../components/Spinner.jsx';
import { faSignal } from '@fortawesome/free-solid-svg-icons/faSignal';
import { faNetworkWired } from '@fortawesome/free-solid-svg-icons/faNetworkWired';
import { faSearch } from '@fortawesome/free-solid-svg-icons/faSearch';
import { faPlug } from '@fortawesome/free-solid-svg-icons/faPlug';
import { faBolt } from '@fortawesome/free-solid-svg-icons/faBolt';

// RSSI signal strength thresholds in dBm
const RSSI_POOR_THRESHOLD = -90;
const RSSI_WEAK_THRESHOLD = -80;

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

function getRssiStatusClass(rssi) {
  if (rssi < RSSI_POOR_THRESHOLD) return 'text-[var(--color-error,#d71921)]';
  if (rssi < RSSI_WEAK_THRESHOLD) return 'text-[var(--color-warning,#d4a843)]';
  return 'text-[var(--color-success,#7cb876)]';
}

export function Scales() {
  const [isScanning, setIsScanning] = useState(false);
  const [manualRefreshKey, setManualRefreshKey] = useState(0);
  const refreshKey = useAutoRefresh(10000) + manualRefreshKey;
  const mode = machine.value.status.mode;

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
        const formData = new FormData();
        formData.append('uuid', uuid);
        await fetch('/api/scales/connect', {
          method: 'post',
          body: formData,
        });
        setManualRefreshKey(Date.now());
      } catch (error) {
        console.error('Connection failed:', error);
      }
    },
    []
  );

  const loading = useMemo(() => isLoading || isScanning, [isLoading, isScanning]);

  return (
    <div className='flex flex-col gap-6'>
      {/* Header */}
      <div className='flex items-center justify-between gap-4'>
        <h1 className='font-nd-mono text-[20px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'>
          Bluetooth Devices
        </h1>
        <button
          className='nd-action-btn nd-action-btn--primary'
          onClick={onScan}
          disabled={loading || mode === 0}
        >
          {loading ? <Spinner size={4} /> : <FontAwesomeIcon icon={faSearch} />}
        </button>
      </div>

      {/* Main card */}
      <Card sm={12} title='Available Devices'>
        {mode === 0 && (
          <div className='flex flex-col items-center gap-4 py-12 text-center'>
            <div className='font-nd-mono text-[18px] text-[var(--text-primary,#e8e8e8)]'>
              System in Standby
            </div>
            <div className='font-nd-mono text-[14px] text-[var(--text-disabled,#666)]'>
              Put GaggiMate in Brew or Grind mode to use Bluetooth scales.
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
        <div className='mt-4 border-l-2 border-[var(--color-warning,#d4a843)] pl-4'>
          <span className='font-nd-mono text-[14px] text-[var(--text-disabled,#666)]'>
            Scales are automatically refreshed every 10 seconds. Use the scan button to discover new devices.
          </span>
        </div>
      </Card>
    </div>
  );
}

function ScaleList(props) {
  const { isLoading, isError, scaleData, onConnect } = props;
  if (isError) {
    return (
      <div className='border-l-2 border-[var(--color-error,#d71921)] pl-4'>
        <span className='font-nd-mono text-[11px] text-[var(--color-error,#d71921)]'>
          Error loading devices. Please try again.
        </span>
      </div>
    );
  }
  if (scaleData.length > 0) {
    return (
      <div className='flex flex-col gap-3'>
        {scaleData.map((scale, i) => (
          <div key={i} className='nd-card p-4'>
            <div className='flex items-center gap-4'>
              <div className='flex items-center justify-center w-12 h-12 rounded-full bg-[var(--home-surface-muted,rgba(5,5,5,0.95))]'>
                <FontAwesomeIcon icon={faScaleBalanced} className='text-lg text-[var(--text-secondary,#999)]' />
              </div>
              <div className='flex-1 min-w-0'>
                <div className='font-nd-mono text-[16px] text-[var(--text-primary,#e8e8e8)] truncate'>
                  {scale.name}
                </div>
                <div className='font-nd-mono text-[13px] text-[var(--text-disabled,#666)] flex items-center gap-4 mt-2'>
                  <span className='flex items-center gap-2'>
                    <FontAwesomeIcon icon={faNetworkWired} />
                    {scale.uuid?.slice(0, 8)}...
                  </span>
                  <span className={`flex items-center gap-2 ${getRssiStatusClass(scale.rssi ?? 0)}`}>
                    <FontAwesomeIcon icon={faSignal} />
                    {scale.rssi ?? 0}dB
                  </span>
                </div>
              </div>
              <div>
                {scale.connected ? (
                  <div className='flex items-center gap-2 font-nd-mono text-[13px] text-[var(--color-success,#7cb876)]'>
                    <FontAwesomeIcon icon={faPlug} />
                    Connected
                  </div>
                ) : (
                  <button
                    className='nd-action-btn nd-action-btn--primary'
                    onClick={() => onConnect(scale.uuid)}
                  >
                    <FontAwesomeIcon icon={faBolt} />
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
    <div className='flex flex-col items-center gap-4 py-12 text-center'>
      {isLoading ? (
        <>
          <Spinner size={8} />
          <span className='font-nd-mono text-[14px] text-[var(--text-disabled,#666)]'>
            Loading devices...
          </span>
        </>
      ) : (
        <>
          <div className='text-5xl text-[var(--text-disabled,#666)]'>
            <FontAwesomeIcon icon={faScaleBalanced} />
          </div>
          <div>
            <div className='font-nd-mono text-[16px] text-[var(--text-primary,#e8e8e8)]'>
              No scales found
            </div>
            <div className='font-nd-mono text-[14px] text-[var(--text-disabled,#666)] mt-2'>
              Click scan to discover Bluetooth scales nearby
            </div>
          </div>
        </>
      )}
    </div>
  );
}
