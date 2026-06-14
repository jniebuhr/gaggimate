import { useCallback, useContext, useEffect, useRef, useState } from 'preact/hooks';
import { ApiServiceContext } from '../../../services/ApiService.js';
import { downloadJson } from '../../../utils/download.js';
import { SystemTabSkeleton } from '../../../components/skeletons/SettingsSkeletons.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons/faCheck';
import { machine } from '../../../services/ApiService.js';
import { Spinner } from '../../../components/Spinner.jsx';
import Section from '../../../components/Card.jsx';

const imageUrlToBase64 = async blob => {
  return new Promise((onSuccess, onError) => {
    try {
      const reader = new FileReader();
      reader.onload = function () {
        onSuccess(this.result);
      };
      reader.onerror = function (e) {
        onError(e);
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      onError(e);
    }
  });
};

export function SystemTab() {
  const apiService = useContext(ApiServiceContext);
  const [isLoading, setIsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({});
  const [phase, setPhase] = useState(0);
  const [progress, setProgress] = useState(0);
  const rssi = machine.value.status.rssi;

  const downloadSupportData = useCallback(async () => {
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
  }, [formData]);

  useEffect(() => {
    const listenerId = apiService.on('res:ota-settings', msg => {
      setFormData(msg);
      setIsLoading(false);
      setSubmitting(false);
    });
    return () => {
      apiService.off('res:ota-settings', listenerId);
    };
  }, [apiService]);

  useEffect(() => {
    const listenerId = apiService.on('evt:ota-progress', msg => {
      setProgress(msg.progress);
      setPhase(msg.phase);
    });
    return () => {
      apiService.off('evt:ota-progress', listenerId);
    };
  }, [apiService]);

  useEffect(() => {
    const listenerId = apiService.on('evt:history-rebuild-progress', msg => {
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
      apiService.off('evt:history-rebuild-progress', listenerId);
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
      const data = new FormData(form);
      apiService.send({ tp: 'req:ota-settings', update: true, channel: data.get('channel') });
    },
    [apiService]
  );

  const onUpdate = useCallback(
    component => {
      apiService.send({ tp: 'req:ota-start', cp: component });
    },
    [apiService]
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

  // Remove spinner here

  if (phase > 0) {
    return (
      <div className='flex flex-col items-center gap-4 py-12'>
        <Spinner size={8} />
        <span className='text-xl font-medium text-base-content'>
          {phase === 1
            ? 'Updating Display firmware'
            : phase === 2
              ? 'Updating Display filesystem'
              : phase === 3
                ? 'Updating controller firmware'
                : 'Finished'}
        </span>
        <span className='text-lg font-medium text-base-content'>{phase === 4 ? 100 : progress}%</span>
        {phase === 4 && (
          <a href='/' className='btn btn-primary'>
            Back
          </a>
        )}
      </div>
    );
  }

  if (isLoading) {
    return <SystemTabSkeleton />;
  }

  return (
    <>
      <div className='space-y-4 sm:space-y-6'>
        {/* Firmware updates channel */}
        <Section title='System Version & Updates'>
          <form ref={formRef} onSubmit={onSubmit} className='space-y-4'>
            <div className='form-control max-w-md'>
              <label htmlFor='channel' className='mb-2 block text-sm font-medium'>
                Update Channel
              </label>
              <div className='flex gap-2 items-center'>
                <select id='channel' name='channel' className='select select-bordered grow'>
                  <option value='latest' selected={formData.channel === 'latest'}>
                    Stable
                  </option>
                  <option value='nightly' selected={formData.channel === 'nightly'}>
                    Nightly
                  </option>
                </select>
                <button type='submit' className='btn btn-secondary' disabled={submitting}>
                  Save Channel
                </button>
              </div>
            </div>
          </form>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t border-base-content/5'>
            <div className='flex flex-col space-y-1'>
              <span className='text-sm font-medium text-base-content/70'>Hardware</span>
              <span className='font-semibold text-base-content'>{formData.hardware}</span>
            </div>

            <div className='flex flex-col space-y-1'>
              <span className='text-sm font-medium text-base-content/70'>Controller Signal Strength</span>
              <span className='font-semibold text-base-content flex items-center gap-2'>
                {rssi}dB
                <span
                  className={`indicator-item status ${rssi < -90 ? 'status-error' : rssi < -80 ? 'status-warning' : 'status-success'}`}
                ></span>
              </span>
            </div>

            <div className='flex flex-col space-y-2'>
              <span className='text-sm font-medium text-base-content/70'>Controller Version</span>
              <div className='flex items-center gap-4 flex-wrap'>
                <span className='font-semibold text-base-content break-all'>{formData.controllerVersion}</span>
                {formData.controllerUpdateAvailable && (
                  <span className='text-primary font-bold text-sm'>
                    Update available: {formData.latestVersion}
                  </span>
                )}
                <button
                  type='button'
                  className='btn btn-secondary btn-sm'
                  disabled={!formData.controllerUpdateAvailable || submitting}
                  onClick={() => onUpdate('controller')}
                >
                  Update Controller
                </button>
              </div>
            </div>

            <div className='flex flex-col space-y-2'>
              <span className='text-sm font-medium text-base-content/70'>Display Version</span>
              <div className='flex items-center gap-4 flex-wrap'>
                <span className='font-semibold text-base-content break-all'>{formData.displayVersion}</span>
                {formData.displayUpdateAvailable && (
                  <span className='text-primary font-bold text-sm'>
                    Update available: {formData.latestVersion}
                  </span>
                )}
                <button
                  type='button'
                  className='btn btn-secondary btn-sm'
                  disabled={!formData.displayUpdateAvailable || submitting}
                  onClick={() => onUpdate('display')}
                >
                  Update Display
                </button>
              </div>
            </div>
          </div>

          <div className='alert alert-warning mt-6'>
            <span>
              Make sure to backup your profiles from the profiles screen before updating the display.
            </span>
          </div>
        </Section>

        {/* Storage and memory */}
        <Section title='Storage & Memory'>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
            {formData.spiffsTotal !== undefined && (
              <div className='flex flex-col space-y-2'>
                <span className='text-sm font-medium text-base-content/70'>Storage (SPIFFS)</span>
                <div className='bg-base-300 h-3 w-full overflow-hidden rounded'>
                  <div
                    className='bg-primary h-full transition-all'
                    style={{ width: `${formData.spiffsUsedPct || 0}%` }}
                  />
                </div>
                <div className='text-xs text-base-content/60'>
                  {((formData.spiffsUsed || 0) / 1024).toFixed(1)} KB /{' '}
                  {(formData.spiffsTotal / 1024).toFixed(1)} KB ({formData.spiffsUsedPct}%)
                </div>
              </div>
            )}

            {formData.sdTotal !== undefined && (
              <div className='flex flex-col space-y-2'>
                <span className='text-sm font-medium text-base-content/70'>Storage (SD-Card)</span>
                <div className='bg-base-300 h-3 w-full overflow-hidden rounded'>
                  <div
                    className='bg-primary h-full transition-all'
                    style={{ width: `${formData.sdUsedPct || 0}%` }}
                  />
                </div>
                <div className='text-xs text-base-content/60'>
                  {((formData.sdUsed || 0) / 1024 / 1024).toFixed(1)} MB /{' '}
                  {(formData.sdTotal / 1024 / 1024).toFixed(1)} MB ({formData.sdUsedPct}%)
                </div>
              </div>
            )}

            {formData.heapTotal !== undefined && (
              <div className='flex flex-col space-y-2'>
                <span className='text-sm font-medium text-base-content/70'>Free Memory (Heap)</span>
                <div className='bg-base-300 h-3 w-full overflow-hidden rounded'>
                  <div
                    className='bg-primary h-full transition-all'
                    style={{
                      width: `${((formData.heapTotal - formData.heapFree) / formData.heapTotal) * 100 || 0}%`,
                    }}
                  />
                </div>
                <div className='text-xs text-base-content/60'>
                  {((formData.heapTotal - formData.heapFree || 0) / 1024).toFixed(1)} kB /{' '}
                  {(formData.heapTotal / 1024).toFixed(1)} kB (
                  {(
                    ((formData.heapTotal - formData.heapFree) / formData.heapTotal) *
                    100
                  ).toFixed(2)}
                  %) (Frag:{' '}
                  {(100 - (formData.heapLargest * 100) / formData.heapFree).toFixed(2)}%)
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* Maintenance & Support */}
        <Section title='Maintenance & Support'>
          <div className='flex flex-col sm:flex-row gap-4 flex-wrap'>
            <button type='button' className='btn btn-outline btn-sm' onClick={downloadSupportData}>
              Download Support Data
            </button>
            
            <button
              type='button'
              className='btn btn-outline btn-sm'
              onClick={onHistoryRebuild}
              disabled={rebuilding}
            >
              Rebuild Shot History
              {rebuilding && (
                <>
                  <Spinner size={4} className='ml-2' />
                  {rebuildProgress.total > 0 && (
                    <span className='ml-2 text-xs'>
                      {rebuildProgress.current}/{rebuildProgress.total}
                    </span>
                  )}
                </>
              )}
              {rebuilt && (
                <span className='text-success ml-2'>
                  <FontAwesomeIcon icon={faCheck}></FontAwesomeIcon>
                </span>
              )}
            </button>
          </div>

          {rebuilding && (
            <div className='mt-4 max-w-md'>
              <div className='text-base-content/70 mb-1 text-xs'>
                {rebuildProgress.status === 'starting' ||
                rebuildProgress.status === 'scanning' ||
                rebuildProgress.total === 0
                  ? 'Scanning shot history files...'
                  : `Processing shot history files (${rebuildProgress.current}/${rebuildProgress.total})`}
              </div>
              <div className='bg-base-300 h-2 w-full overflow-hidden rounded'>
                <div
                  className={`h-full transition-all duration-300 ${
                    rebuildProgress.total === 0 ? 'bg-primary animate-pulse' : 'bg-primary'
                  }`}
                  style={{
                    width:
                      rebuildProgress.total > 0
                        ? `${(rebuildProgress.current / rebuildProgress.total) * 100}%`
                        : '30%',
                  }}
                />
              </div>
            </div>
          )}
        </Section>
      </div>
    </>
  );
}
