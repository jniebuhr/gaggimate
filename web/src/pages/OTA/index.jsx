import { useState, useEffect, useRef, useCallback, useContext } from 'preact/hooks';
import { Spinner } from '../../components/Spinner.jsx';
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
    return () => {
      apiService.off('res:ota-settings', listenerId);
    };
  }, [apiService]);
  useEffect(() => {
    const listenerId = apiService.on('evt:ota-progress', (msg) => {
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
    async (e) => {
      e.preventDefault();
      setSubmitting(true);
      const form = formRef.current;
      const formData = new FormData(form);
      apiService.send({ tp: 'req:ota-settings', update: true, channel: formData.get('channel') });
      setSubmitting(true);
    },
    [setFormData, formRef]
  );

  const onUpdate = useCallback(
    (component) => {
      apiService.send({ tp: 'req:ota-start', cp: component });
    },
    [apiService]
  );

  if (isLoading) {
    return (
      <div className="flex flex-row py-16 items-center justify-center w-full">
        <Spinner size={8} />
      </div>
    );
  }

  if (phase > 0) {
    return (
      <div className="p-16 flex flex-col items-center gap-5">
        <Spinner size={8} />
        <span className="text-xl font-medium">
          {phase === 1
            ? 'Updating Display firmware'
            : phase === 2
              ? 'Updating Display filesystem'
              : phase === 3
                ? 'Updating controller firmware'
                : 'Finished'}
        </span>
        <span className="text-lg font-medium">{phase === 4 ? 100 : progress}%</span>
        {phase === 4 && (
          <a href="/" className="btn btn-primary">
            Back
          </a>
        )}
      </div>
    );
  }

  return (
    <form
      key="ota"
      method="post"
      action="/api/ota"
      ref={formRef}
      onSubmit={onSubmit}
      className="grid grid-cols-1 gap-2 sm:grid-cols-12 md:gap-2"
    >
      <div className="sm:col-span-12">
        <h2 className="text-2xl font-bold">System & Updates</h2>
      </div>
      <div className="card bg-base-100 shadow-xl col-span-12">
        <div className="card-body space-y-6">
          <div className="flex flex-col space-y-2">
            <label htmlFor="channel" className="text-sm font-medium">
              Update Channel
            </label>
            <select id="channel" name="channel" className="select select-bordered w-full">
              <option value="latest" selected={formData.channel === 'latest'}>
                Stable
              </option>
              <option value="nightly" selected={formData.channel === 'nightly'}>
                Nightly
              </option>
            </select>
          </div>

          <div className="flex flex-col space-y-2">
            <label className="text-sm font-medium">
              Hardware
            </label>
            <div className="input input-bordered bg-base-200 cursor-default">{formData.hardware}</div>
          </div>

          <div className="flex flex-col space-y-2">
            <label className="text-sm font-medium">
              Controller version
            </label>
            <div className="input input-bordered bg-base-200 cursor-default">
              {formData.controllerVersion}
              {formData.controllerUpdateAvailable && (
                <span className="font-bold text-primary">(Update available: {formData.latestVersion})</span>
              )}
            </div>
          </div>

          <div className="flex flex-col space-y-2">
            <label className="text-sm font-medium">
              Display version
            </label>
            <div className="input input-bordered bg-base-200 cursor-default">
              {formData.displayVersion}
              {formData.displayUpdateAvailable && <span className="font-bold text-primary">(Update available: {formData.latestVersion})</span>}
            </div>
          </div>
          
          <div className="alert alert-warning">
            <span>Make sure to backup your profiles from the profile screen before updating the display.</span>
          </div>
        </div>
      </div>
      
      <div className="col-span-12 flex flex-col sm:flex-row flex-wrap gap-2">
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          Save & Refresh
        </button>
        <button
          type="submit"
          name="update"
          className="btn btn-secondary"
          disabled={!formData.displayUpdateAvailable || submitting}
          onClick={() => onUpdate('display')}
        >
          Update Display
        </button>
        <button
          type="submit"
          name="update"
          className="btn btn-accent"
          disabled={!formData.controllerUpdateAvailable || submitting}
          onClick={() => onUpdate('controller')}
        >
          Update Controller
        </button>
      </div>
    </form>
  );
}
