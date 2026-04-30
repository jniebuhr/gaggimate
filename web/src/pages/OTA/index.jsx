import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { memo } from 'preact/compat';
import Card from '../../components/Card.jsx';
import { Spinner } from '../../components/Spinner.jsx';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
import { downloadJson } from '../../utils/download.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons/faCheck';

// Constants
const REBUILD_STATUS = {
  STARTING: 'starting',
  SCANNING: 'scanning',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  ERROR: 'error',
};

const imageUrlToBase64 = async blob => {
  return new Promise((onSuccess, onError) => {
    try {
      const reader = new FileReader();
      reader.onload = function () {
        onSuccess(this.result);
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      onError(e);
    }
  });
};

const formatStorage = (value, unit) => {
  if (value === undefined || value === null) {
    return `0.0 ${unit}`;
  }

  const divisors = {
    KB: 1024,
    MB: 1024 * 1024,
  };

  const divisor = divisors[unit] || 1;
  return `${(value / divisor).toFixed(1)} ${unit}`;
};

const StorageDisplay = ({ label, used, total, usedPct }) => (
  <div className='flex flex-col gap-2'>
    <label className='font-nd-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'>
      {label}
    </label>
    <div className='flex flex-col gap-1'>
      <div className='h-3 w-full overflow-hidden rounded bg-[var(--home-surface-muted,rgba(5,5,5,0.95))]'>
        <div
          className='h-full transition-all'
          style={{ width: `${usedPct || 0}%`, backgroundColor: 'var(--color-warning,#d4a843)' }}
        />
      </div>
      <div className='font-nd-mono text-[12px] text-[var(--text-disabled,#666)]'>
        {used} / {total} ({usedPct}%)
      </div>
    </div>
  </div>
);

const getSignalStrengthClass = rssi => {
  if (rssi < -90) return 'status-error';
  if (rssi < -80) return 'status-warning';
  return 'status-success';
};

const UpdateBadge = ({ available, version }) =>
  available ? (
    <span className='font-nd-mono text-[13px] text-[var(--color-warning,#d4a843)] break-all'>
      (Update available: {version})
    </span>
  ) : null;

const VersionDisplay = ({ label, version, updateAvailable, latestVersion }) => (
  <div className='flex flex-col gap-2'>
    <label className='font-nd-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'>
      {label}
    </label>
    <div className='flex flex-row gap-2'>
      <span className='font-nd-mono text-[13px] text-[var(--text-primary,#e8e8e8)] break-all'>{version}</span>
      <UpdateBadge available={updateAvailable} version={latestVersion} />
    </div>
  </div>
);

const UpdateProgressView = ({ phase, progress }) => (
  <div className='flex flex-col items-center gap-4 p-16'>
    <Spinner size={8} />
    <span className='font-nd-mono text-[18px] text-[var(--text-primary,#e8e8e8)]'>
      {phase === 1
        ? 'Updating Display firmware'
        : phase === 2
          ? 'Updating Display filesystem'
          : phase === 3
            ? 'Updating controller firmware'
            : 'Finished'}
    </span>
    <span className='font-nd-mono text-[16px] text-[var(--text-secondary,#999)]'>{phase === 4 ? 100 : progress}%</span>
    {phase === 4 && (
      <a href='/' className='nd-action-btn nd-action-btn--primary nd-action-btn--text'>
        Back
      </a>
    )}
  </div>
);

const SystemInfoCard = ({ formData }) => {
  const {
    channel = 'latest',
    hardware,
    controllerVersion,
    controllerUpdateAvailable,
    displayVersion,
    displayUpdateAvailable,
    latestVersion,
    spiffsTotal,
    spiffsUsed,
    spiffsUsedPct,
    sdTotal,
    sdUsed,
    sdUsedPct,
  } = formData;

  const rssi = machine.value?.status?.rssi ?? -100;

  const spiffsStorage = useMemo(
    () => ({
      used: formatStorage(spiffsUsed, 'KB'),
      total: formatStorage(spiffsTotal, 'KB'),
      usedPct: spiffsUsedPct,
    }),
    [spiffsUsed, spiffsTotal, spiffsUsedPct],
  );

  const sdStorage = useMemo(
    () => ({
      used: formatStorage(sdUsed, 'MB'),
      total: formatStorage(sdTotal, 'MB'),
      usedPct: sdUsedPct,
    }),
    [sdUsed, sdTotal, sdUsedPct],
  );

  return (
    <Card sm={12} title='System Information'>
      <div className='flex flex-col gap-4'>
        <div className='flex flex-col gap-2'>
          <label htmlFor='channel' className='font-nd-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'>
            Update Channel
          </label>
          <select id='channel' name='channel' className='nd-input' value={channel}>
            <option value='latest'>Stable</option>
            <option value='nightly'>Nightly</option>
          </select>
        </div>

        <div className='flex flex-col gap-2'>
          <label className='font-nd-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'>
            Hardware
          </label>
          <span className='font-nd-mono text-[13px] text-[var(--text-primary,#e8e8e8)]'>{hardware}</span>
        </div>

        <VersionDisplay
          label='Controller Version'
          version={controllerVersion}
          updateAvailable={controllerUpdateAvailable}
          latestVersion={latestVersion}
        />

        <VersionDisplay
          label='Display Version'
          version={displayVersion}
          updateAvailable={displayUpdateAvailable}
          latestVersion={latestVersion}
        />

        <div className='flex flex-col gap-2'>
          <label className='font-nd-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'>
            Controller Signal Strength
          </label>
          <span className='font-nd-mono text-[13px] text-[var(--text-primary,#e8e8e8)]'>
            {rssi}dB{' '}
            <span className={`ml-2 inline-block h-2 w-2 rounded-full ${getSignalStrengthClass(rssi) === 'status-error' ? 'bg-[var(--color-error,#d71921)]' : getSignalStrengthClass(rssi) === 'status-warning' ? 'bg-[var(--color-warning,#d4a843)]' : 'bg-green-500'}`} />
          </span>
        </div>

        {spiffsTotal !== undefined && (
          <StorageDisplay
            label='Storage (SPIFFS)'
            used={spiffsStorage.used}
            total={spiffsStorage.total}
            usedPct={spiffsStorage.usedPct}
          />
        )}

        {sdTotal !== undefined && (
          <StorageDisplay
            label='Storage (SD-Card)'
            used={sdStorage.used}
            total={sdStorage.total}
            usedPct={sdStorage.usedPct}
          />
        )}

        <div className='mt-2 border-l-2 border-[var(--color-warning,#d4a843)] pl-4'>
          <span className='font-nd-mono text-[12px] text-[var(--text-disabled,#666)]'>
            Make sure to backup your profiles from the profile screen before updating the display.
          </span>
        </div>
      </div>
    </Card>
  );
};

// Helper functions
const isScanning = (status, total) =>
  status === REBUILD_STATUS.STARTING || status === REBUILD_STATUS.SCANNING || total === 0;

const calculateProgressWidth = (current, total) =>
  total > 0 ? `${(current / total) * 100}%` : '30%';

const getProgressStatusText = (current, total, status) =>
  isScanning(status, total)
    ? 'Scanning shot history files...'
    : `Processing shot history files (${current}/${total})`;

// Reusable ActionButton component
const ActionButton = ({ type = 'button', variant = 'primary', disabled, onClick, children }) => (
  <button type={type} className={`nd-action-btn nd-action-btn--text ${variant === 'secondary' ? '' : variant === 'primary' ? 'nd-action-btn--primary' : ''}`} disabled={disabled} onClick={onClick}>
    {children}
  </button>
);

// Rebuild button status indicator
const RebuildButtonStatus = ({ progress }) => (
  <>
    <Spinner size={4} className='ml-2' />
    {progress.total > 0 && (
      <span className='ml-2 font-nd-mono text-[11px] text-[var(--text-disabled,#666)]'>
        {progress.current}/{progress.total}
      </span>
    )}
  </>
);

// Rebuild success icon
const RebuildSuccessIcon = () => (
  <span className='ml-2 text-[var(--color-success,#22c55e)]'>
    <FontAwesomeIcon icon={faCheck} />
  </span>
);

// Rebuild button with integrated status
const RebuildButton = ({ rebuilding, rebuilt, rebuildProgress, onClick }) => (
  <ActionButton variant='outline' onClick={onClick} disabled={rebuilding}>
    Rebuild Shot History
    {rebuilding && <RebuildButtonStatus progress={rebuildProgress} />}
    {rebuilt && <RebuildSuccessIcon />}
  </ActionButton>
);

// Progress bar for rebuild operation
const RebuildProgressBar = ({ rebuildProgress }) => {
  const { current, total, status } = rebuildProgress;
  const statusText = getProgressStatusText(current, total, status);
  const progressWidth = calculateProgressWidth(current, total);
  const isIndeterminate = total === 0;

  return (
    <div className='mt-3'>
      <div className='font-nd-mono text-[12px] text-[var(--text-disabled,#666)] mb-1'>{statusText}</div>
      <div className='h-2 w-full overflow-hidden rounded bg-[var(--home-surface-muted,rgba(5,5,5,0.95))]'>
        <div
          className={`h-full transition-all duration-300 ${isIndeterminate ? 'animate-pulse' : ''}`}
          style={{ width: progressWidth, backgroundColor: 'var(--color-warning,#d4a843)' }}
        />
      </div>
    </div>
  );
};

// Main action buttons section with memoization
const ActionButtonsSection = memo(
  ({
    submitting,
    formData,
    onUpdate,
    downloadSupportData,
    onHistoryRebuild,
    rebuilding,
    rebuilt,
    rebuildProgress,
  }) => (
    <div className='pt-4'>
      <div className='flex flex-col flex-wrap gap-2 sm:flex-row'>
        <ActionButton type='submit' variant='primary' disabled={submitting}>
          Save & Refresh
        </ActionButton>

        <ActionButton
          type='submit'
          variant='secondary'
          disabled={!formData.displayUpdateAvailable || submitting}
          onClick={() => onUpdate('display')}
        >
          Update Display
        </ActionButton>

        <ActionButton
          type='submit'
          variant='secondary'
          disabled={!formData.controllerUpdateAvailable || submitting}
          onClick={() => onUpdate('controller')}
        >
          Update Controller
        </ActionButton>

        <ActionButton variant='outline' onClick={downloadSupportData}>
          Download Support Data
        </ActionButton>

        <RebuildButton
          rebuilding={rebuilding}
          rebuilt={rebuilt}
          rebuildProgress={rebuildProgress}
          onClick={onHistoryRebuild}
        />
      </div>

      {rebuilding && <RebuildProgressBar rebuildProgress={rebuildProgress} />}
    </div>
  ),
  (prevProps, nextProps) => {
    // Custom comparison for performance optimization
    return (
      prevProps.submitting === nextProps.submitting &&
      prevProps.formData.displayUpdateAvailable === nextProps.formData.displayUpdateAvailable &&
      prevProps.formData.controllerUpdateAvailable === nextProps.formData.controllerUpdateAvailable &&
      prevProps.rebuilding === nextProps.rebuilding &&
      prevProps.rebuilt === nextProps.rebuilt &&
      prevProps.rebuildProgress.current === nextProps.rebuildProgress.current &&
      prevProps.rebuildProgress.total === nextProps.rebuildProgress.total &&
      prevProps.rebuildProgress.status === nextProps.rebuildProgress.status
    );
  },
);

export function OTA() {
  const apiService = useContext(ApiServiceContext);
  const [isLoading, setIsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({});
  const [phase, setPhase] = useState(0);
  const [progress, setProgress] = useState(0);

  const downloadSupportData = useCallback(async () => {
    try {
      const settingsResponse = await fetch(`/api/settings`);
      const data = await settingsResponse.json();
      delete data.wifiPassword;
      delete data.haPassword;
      const coredumpBlob = await fetch(`/api/core-dump`).then(r => r.blob());
      let coredump = await imageUrlToBase64(coredumpBlob);
      coredump = coredump.substring(coredump.indexOf('base64,') + 7);
      const supportFile = {
        settings: data,
        versions: formData,
        coredump,
      };
      const ts = Date.now();
      downloadJson(supportFile, `support-${ts}.dat`);
    } catch (error) {
      console.error('Failed to download support data:', error);
      alert('Failed to download support data. Please try again.');
    }
  }, [formData]);
  useEffect(() => {
    const otaSettingsListener = apiService.on('res:ota-settings', msg => {
      setFormData(msg);
      setIsLoading(false);
      setSubmitting(false);
    });

    const otaProgressListener = apiService.on('evt:ota-progress', msg => {
      setProgress(msg.progress);
      setPhase(msg.phase);
    });

    const historyRebuildListener = apiService.on('evt:history-rebuild-progress', msg => {
      setRebuildProgress({
        total: msg.total || 0,
        current: msg.current || 0,
        status: msg.status || '',
      });

      if (msg.status === 'completed' || msg.status === 'error') {
        setRebuilding(false);
        setRebuilt(msg.status === 'completed');
      }
    });

    return () => {
      apiService.off('res:ota-settings', otaSettingsListener);
      apiService.off('evt:ota-progress', otaProgressListener);
      apiService.off('evt:history-rebuild-progress', historyRebuildListener);
    };
  }, [apiService]);
  useEffect(() => {
    setTimeout(() => {
      apiService.send({ tp: 'req:ota-settings' });
    }, 500);
  }, [apiService]);

  const formRef = useRef();

  const onSubmit = useCallback(
    async e => {
      e.preventDefault();
      setSubmitting(true);
      const form = formRef.current;
      const formData = new FormData(form);
      apiService.send({ tp: 'req:ota-settings', update: true, channel: formData.get('channel') });
    },
    [apiService],
  );

  const onUpdate = useCallback(
    component => {
      apiService.send({ tp: 'req:ota-start', cp: component });
    },
    [apiService],
  );

  const [rebuilding, setRebuilding] = useState(false);
  const [rebuilt, setRebuilt] = useState(false);
  const [rebuildProgress, setRebuildProgress] = useState({ total: 0, current: 0, status: '' });
  const onHistoryRebuild = useCallback(async () => {
    setRebuilt(false);
    setRebuilding(true);
    setRebuildProgress({ total: 0, current: 0, status: 'starting' });
    apiService.send({ tp: 'req:history:rebuild' });
  }, [apiService]);

  if (isLoading) {
    return (
      <div className='flex w-full flex-row items-center justify-center py-16'>
        <Spinner size={8} />
      </div>
    );
  }

  if (phase > 0) {
    return <UpdateProgressView phase={phase} progress={progress} />;
  }

  return (
    <div className='flex flex-col gap-6'>
      <div>
        <h1 className='font-nd-mono text-[20px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'>
          System & Updates
        </h1>
        <p className='font-nd-mono text-[13px] text-[var(--text-disabled,#666)] mt-2 max-w-xl'>
          Manage firmware updates, view system information, and rebuild shot history.
        </p>
      </div>

      <form key='ota' method='post' action='/api/ota' ref={formRef} onSubmit={onSubmit}>
        <div className='flex flex-col gap-4'>
          <SystemInfoCard formData={formData} />
        </div>

        <ActionButtonsSection
          submitting={submitting}
          formData={formData}
          onUpdate={onUpdate}
          downloadSupportData={downloadSupportData}
          onHistoryRebuild={onHistoryRebuild}
          rebuilding={rebuilding}
          rebuilt={rebuilt}
          rebuildProgress={rebuildProgress}
        />
      </form>
    </div>
  );
}
