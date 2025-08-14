import { useState, useEffect, useRef, useCallback, useContext } from 'preact/hooks';
import { Spinner } from '../../components/Spinner.jsx';
import { ApiServiceContext } from '../../services/ApiService.js';
import Card from '../../components/Card.jsx';
import { t } from '@lingui/core/macro';
import { i18n } from '@lingui/core';

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
            ? i18n._(t`Updating Display firmware`)
            : phase === 2
              ? i18n._(t`Updating Display filesystem`)
              : phase === 3
                ? i18n._(t`Updating controller firmware`)
                : i18n._(t`Finished`)}
        </span>
        <span className='text-lg font-medium'>{phase === 4 ? 100 : progress}%</span>
        {phase === 4 && (
          <a href='/' className='btn btn-primary'>
            {i18n._(t`Back`)}
          </a>
        )}
      </div>
    );
  }

  return (
    <>
      <div className='mb-4 flex flex-row items-center gap-2'>
        <h2 className='flex-grow text-2xl font-bold sm:text-3xl'>{i18n._(t`System & Updates`)}</h2>
      </div>

      <form key='ota' method='post' action='/api/ota' ref={formRef} onSubmit={onSubmit}>
        <div className='grid grid-cols-1 gap-4 lg:grid-cols-12'>
          <Card sm={12} title={i18n._(t`System Information`)}>
            <div className='flex flex-col space-y-4'>
              <label htmlFor='channel' className='text-sm font-medium'>
                {i18n._(t`Update Channel`)}
              </label>
              <select id='channel' name='channel' className='select select-bordered w-full'>
                <option value='latest' selected={formData.channel === 'latest'}>
                  {i18n._(t`Stable`)}
                </option>
                <option value='nightly' selected={formData.channel === 'nightly'}>
                  {i18n._(t`Nightly`)}
                </option>
              </select>
            </div>

            <div className='flex flex-col space-y-4'>
              <label className='text-sm font-medium'>{i18n._(t`Hardware`)}</label>
              <div className='input input-bordered bg-base-200 cursor-default'>
                {formData.hardware}
              </div>
            </div>

            <div className='flex flex-col space-y-4'>
              <label className='text-sm font-medium'>{i18n._(t`Controller version`)}</label>
              <div className='input input-bordered bg-base-200 cursor-default'>
                {formData.controllerVersion}
                {formData.controllerUpdateAvailable && (
                  <span className='text-primary font-bold'>
                    {i18n._(t`Update available: {version}`, { version: formData.latestVersion })}
                  </span>
                )}
              </div>
            </div>

            <div className='flex flex-col space-y-4'>
              <label className='text-sm font-medium'>{i18n._(t`Display version`)}</label>
              <div className='input input-bordered bg-base-200 cursor-default'>
                {formData.displayVersion}
                {formData.displayUpdateAvailable && (
                  <span className='text-primary font-bold'>
                    {i18n._(t`Update available: {version}`, { version: formData.latestVersion })}
                  </span>
                )}
              </div>
            </div>

            <div className='alert alert-warning'>
              <span>
                {i18n._(t`Make sure to backup your profiles from the profile screen before updating the display.`)}
              </span>
            </div>
          </Card>
        </div>

        <div className='pt-4 lg:col-span-12'>
          <div className='flex flex-col flex-wrap gap-2 sm:flex-row'>
            <button type='submit' className='btn btn-primary' disabled={submitting}>
              {i18n._(t`Save & Refresh`)}
            </button>
            <button
              type='submit'
              name='update'
              className='btn btn-secondary'
              disabled={!formData.displayUpdateAvailable || submitting}
              onClick={() => onUpdate('display')}
            >
              {i18n._(t`Update Display`)}
            </button>
            <button
              type='submit'
              name='update'
              className='btn btn-accent'
              disabled={!formData.controllerUpdateAvailable || submitting}
              onClick={() => onUpdate('controller')}
            >
              {i18n._(t`Update Controller`)}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
