import { useState, useEffect, useRef, useCallback, useContext } from 'preact/hooks';
import { Spinner } from '../../components/Spinner.jsx';
import { ApiServiceContext } from '../../services/ApiService.js';
import Card from '../../components/Card.jsx';
import { t } from '@lingui/core/macro';

export function OTA() {
  const apiService = useContext(ApiServiceContext);
  const [isLoading, setIsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({});
  const [phase, setPhase] = useState(0);
  const [progress, setProgress] = useState(0);
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
      setSubmitting(true);
    },
    [setFormData, formRef],
  );

  const onUpdate = useCallback(
    component => {
      apiService.send({ tp: 'req:ota-start', cp: component });
    },
    [apiService],
  );

  if (isLoading) {
    return (
      <div className='flex w-full flex-row items-center justify-center py-16'>
        <Spinner size={8} />
      </div>
    );
  }

  if (phase > 0) {
    return (
      <div className='flex flex-col items-center gap-4 p-16'>
        <Spinner size={8} />
        <span className='text-xl font-medium'>
          {phase === 1
            ? t`Updating Display firmware`
            : phase === 2
              ? t`Updating Display filesystem`
              : phase === 3
                ? t`Updating controller firmware`
                : t`Finished`}
        </span>
        <span className='text-lg font-medium'>{phase === 4 ? 100 : progress}%</span>
        {phase === 4 && (
          <a href='/' className='btn btn-primary'>
            {t`Back`}
          </a>
        )}
      </div>
    );
  }

  return (
    <>
      <div className='mb-4 flex flex-row items-center gap-2'>
        <h2 className='flex-grow text-2xl font-bold sm:text-3xl'>{t`System & Updates`}</h2>
      </div>

      <form key='ota' method='post' action='/api/ota' ref={formRef} onSubmit={onSubmit}>
        <div className='grid grid-cols-1 gap-4 lg:grid-cols-12'>
          <Card sm={12} title={t`System Information`}>
            <div className='flex flex-col space-y-4'>
              <label htmlFor='channel' className='text-sm font-medium'>
                {t`Update Channel`}
              </label>
              <select id='channel' name='channel' className='select select-bordered w-full'>
                <option value='latest' selected={formData.channel === 'latest'}>
                  {t`Stable`}
                </option>
                <option value='nightly' selected={formData.channel === 'nightly'}>
                  {t`Nightly`}
                </option>
              </select>
            </div>

            <div className='flex flex-col space-y-4'>
              <label className='text-sm font-medium'>{t`Hardware`}</label>
              <div className='input input-bordered bg-base-200 cursor-default break-words whitespace-normal'>
                {formData.hardware}
              </div>
            </div>

            <div className='flex flex-col space-y-4'>
              <label className='text-sm font-medium'>{t`Controller version`}</label>
              <div className='input input-bordered bg-base-200 cursor-default break-words whitespace-normal'>
                <span className='break-all'>{formData.controllerVersion}</span>
                {formData.controllerUpdateAvailable && (
                  <span className='text-primary font-bold break-all'>
                    {t`(Update available: ${formData.latestVersion})`}
                  </span>
                )}
              </div>
            </div>

            <div className='flex flex-col space-y-4'>
              <label className='text-sm font-medium'>{t`Display version`}</label>
              <div className='input input-bordered bg-base-200 cursor-default break-words whitespace-normal'>
                <span className='break-all'>{formData.displayVersion}</span>
                {formData.displayUpdateAvailable && (
                  <span className='text-primary font-bold break-all'>
                    {t`(Update available: ${formData.latestVersion})`}
                  </span>
                )}
              </div>
            </div>

            <div className='alert alert-warning'>
              <span>
                {t`Make sure to backup your profiles from the profile screen before updating the display.`}
              </span>
            </div>
          </Card>
        </div>

        <div className='pt-4 lg:col-span-12'>
          <div className='flex flex-col flex-wrap gap-2 sm:flex-row'>
            <button type='submit' className='btn btn-primary' disabled={submitting}>
              {t`Save & Refresh`}
            </button>
            <button
              type='submit'
              name='update'
              className='btn btn-secondary'
              disabled={!formData.displayUpdateAvailable || submitting}
              onClick={() => onUpdate('display')}
            >
              {t`Update Display`}
            </button>
            <button
              type='submit'
              name='update'
              className='btn btn-accent'
              disabled={!formData.controllerUpdateAvailable || submitting}
              onClick={() => onUpdate('controller')}
            >
              {t`Update Controller`}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
