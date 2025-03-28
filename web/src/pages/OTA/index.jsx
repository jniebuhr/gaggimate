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
    const listenerId = apiService.on("res:ota-settings", (msg) => {
      setFormData(msg);
      console.log(msg);
      setIsLoading(false);
      setSubmitting(false);
    });
    return () => { apiService.off("res:ota-settings", listenerId); };
  }, [apiService]);
  useEffect(() => {
    const listenerId = apiService.on("evt:ota-progress", (msg) => {
      setProgress(msg.progress);
      setPhase(msg.phase);
    });
    return () => { apiService.off("evt:ota-progress", listenerId); };
  }, [apiService]);
  useEffect(() => {
    setTimeout(() => {
      apiService.send({tp: 'req:ota-settings'});
    }, 500);
  }, [apiService]);

  const formRef = useRef();

  const onSubmit = useCallback(
    async (e, update = false) => {
      e.preventDefault();
      setSubmitting(true);
      const form = formRef.current;
      const formData = new FormData(form);
      apiService.send({tp: 'req:ota-settings', update: true, channel: formData.get('channel')});
      setSubmitting(true);
    },
    [setFormData, formRef]
  );

  const onUpdate = useCallback(() => {
    apiService.send({tp: 'req:ota-start'});
  }, [apiService]);

  if (isLoading) {
    return (
      <div class="p-16 flex flex-row items-center">
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
            phase === 1 ? "Updating Display firmware" : phase === 2 ? "Updating Display filesystem" : phase === 3 ? "Updating controller firmware" : "Finished, please refresh"
          }
        </span>
        <span className="text-lg font-medium">
          {phase === 4 ? 100 : progress}%
        </span>
      </div>
    );
  }

  return (
    <>
      <h2 class="text-3xl font-semibold mb-4 text-[#333333]">System & Updates</h2>
      <form
        method="post"
        action="/api/ota"
        ref={formRef}
        class="flex flex-col gap-4 w-full max-w-md border-b border-[#CCCCCC] pb-4"
        onSubmit={onSubmit}
      >
        <div>
          <label for="channel" class="block font-medium text-[#333333]">
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
          <span className="block font-medium text-[#333333]">Hardware</span>
          <span className="display-field">{formData.hardware}</span>
        </div>

        <div>
          <span className="block font-medium text-[#333333]">Controller version</span>
          <span className="display-field">{formData.controllerVersion}</span>
        </div>

        <div>
          <span className="block font-medium text-[#333333]">Display version</span>
          <span className="display-field">{formData.displayVersion}</span>
        </div>

        <div>
          <span className="block font-medium text-[#333333]">Newest version</span>
          <span className="display-field">
            v{formData.latestVersion} {formData.updateAvailable && <span className="font-bold">Update available!</span>}
          </span>
        </div>

        <div class="flex justify-center mt-6 flex-row gap-1">
          <a href="/" class="menu-button">
            Back
          </a>
          <button type="submit" class="menu-button" disabled={submitting}>
            Save Preferences
          </button>
          <input
            type="submit"
            name="update"
            class="menu-button"
            value="Update"
            disabled={submitting}
            onClick={(e) => onUpdate()}
          />
        </div>
      </form>
    </>
  );
}
