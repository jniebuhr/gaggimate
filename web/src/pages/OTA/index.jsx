import './style.css';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { useQuery } from 'preact-fetching';
import { Spinner } from '../../components/Spinner.jsx';
import { useContext } from 'react';
import { ApiServiceContext } from '../../services/ApiService.js';

export function OTA() {
  const apiService = useContext(ApiServiceContext);
  const [isLoading, setIsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({});
  const [phase, setPhase] = useState(0);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const listenerId = apiService.on('res:ota-settings', (msg) => {
      setFormData(msg);
      setIsLoading(false);
      setSubmitting(false);
    });
    return () => { apiService.off('res:ota-settings', listenerId); };
  }, [apiService]);
  useEffect(() => {
    const listenerId = apiService.on('evt:ota-progress', (msg) => {
      setProgress(msg.progress);
      setPhase(msg.phase);
    });
    return () => { apiService.off('evt:ota-progress', listenerId); };
  }, [apiService]);
  useEffect(() => {
    setTimeout(() => {
      apiService.send({ tp: 'req:ota-settings' });
    }, 500);
  }, [apiService]);

  const formRef = useRef();

  const onSubmit = useCallback(
    async (e, update = false) => {
      e.preventDefault();
      setSubmitting(true);
      const form = formRef.current;
      const formData = new FormData(form);
      apiService.send({ tp: 'req:ota-settings', update: true, channel: formData.get('channel') });
      setSubmitting(true);
    },
    [setFormData, formRef],
  );

  const onUpdate = useCallback((component) => {
    apiService.send({ tp: 'req:ota-start', cp: component });
  }, [apiService]);

  if (isLoading) {
    return (
      <div className="flex flex-row py-16 items-center justify-center w-full">
        <Spinner size={8} />
      </div>
    );
  }

  if (phase > 0) {
    return (
      <div class="p-16 flex flex-col items-center gap-5">
        <Spinner size={8} />
        <span className="text-xl font-medium">
          {
            phase === 1 ? 'Updating Display firmware' : phase === 2 ? 'Updating Display filesystem' : phase === 3
              ? 'Updating controller firmware'
              : 'Finished'
          }
        </span>
        <span className="text-lg font-medium">
          {phase === 4 ? 100 : progress}%
        </span>
        {
          phase === 4 &&
          <a href="/" className="menu-button">
            Back
          </a>
        }
      </div>
    );
  }

  return (
    <form key="ota" method="post" action="/api/ota" ref={formRef} onSubmit={onSubmit} className="grid grid-cols-1 gap-2 sm:grid-cols-12 md:gap-2">
        <div className="sm:col-span-12">
          <h2 className="text-2xl font-bold">System & Updates</h2>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white col-span-12 dark:bg-gray-800 dark:border-gray-600">
          <div className="p-6 flex flex-col gap-4">
            <div>
              <label for="channel" class="block font-medium text-gray-700 dark:text-gray-400">
                Update Channel
              </label>
              <select id="channel" name="channel" class="input-field">
                <option value="latest" selected={formData.channel === 'latest'}>
                  Stable
                </option>
                <option value="nightly" selected={formData.channel === 'nightly'}>
                  Nightly
                </option>
              </select>
            </div>

            <div>
              <span className="block font-medium text-gray-700 dark:text-gray-400">Hardware</span>
              <span className="display-field">{formData.hardware}</span>
            </div>

            <div>
              <span className="block font-medium text-gray-700 dark:text-gray-400">Controller version</span>
              <span className="display-field">
                {formData.controllerVersion}
                {formData.controllerUpdateAvailable && <span className="font-bold">(Update available: {formData.latestVersion})</span> }
              </span>
            </div>

            <div>
              <span className="block font-medium text-gray-700 dark:text-gray-400">Display version</span>
              <span className="display-field">
                {formData.displayVersion}
                {formData.displayUpdateAvailable && <span className="font-bold">(Update available: {formData.latestVersion})</span> }
              </span>
            </div>
          </div>
        </div>
        <div className="col-span-12 flex flex-row">
          <button type="submit" className="menu-button" disabled={submitting}>
            Save Preferences
          </button>
          <input
            type="submit"
            name="update"
            className="menu-button"
            value="Update Controller"
            disabled={!formData.controllerUpdateAvailable || submitting}
            onClick={(e) => onUpdate('controller')}
          />
          <input
            type="submit"
            name="update"
            className="menu-button"
            value="Update Display"
            disabled={!formData.displayUpdateAvailable || submitting}
            onClick={(e) => onUpdate('display')}
          />
        </div>
      </form>
  );
}
