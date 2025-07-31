import { useState, useEffect, useCallback, useContext } from 'preact/hooks';
import { ApiServiceContext } from '../../services/ApiService.js';
import { OverviewChart } from '../../components/OverviewChart.jsx';
import { Spinner } from '../../components/Spinner.jsx';

export function Autotune() {
  const apiService = useContext(ApiServiceContext);
  const [active, setActive] = useState(false);
  const [result, setResult] = useState(null);
  const [time, setTime] = useState(60);
  const [samples, setSamples] = useState(4);

  const onStart = useCallback(() => {
    apiService.send({
      tp: 'req:autotune-start',
      time,
      samples,
    });
    setActive(true);
  }, [time, samples, apiService]);

  useEffect(() => {
    const listenerId = apiService.on('evt:autotune-result', (msg) => {
      setActive(false);
      setResult(msg.pid);
    });
    return () => {
      apiService.off('evt:autotune-result', listenerId);
    };
  }, [apiService]);

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-base-content">PID Autotune</h1>
      </div>

      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          {active && (
            <div className="space-y-6">
              <div className="w-full">
                <OverviewChart />
              </div>
              <div className="flex flex-col items-center justify-center space-y-4 py-8">
                <div className="flex items-center space-x-3">
                  <Spinner size={8} />
                  <span className="text-lg font-medium">Autotune in Progress</span>
                </div>
                <div className="alert alert-info max-w-md">
                  <span>Please wait while the system optimizes your PID settings. This may take up to 30 seconds.</span>
                </div>
              </div>
            </div>
          )}

          {result && (
            <div className="text-center space-y-6">
              <div className="alert alert-success max-w-md mx-auto">
                <div>
                  <h3 className="font-bold">Autotune Complete!</h3>
                  <div className="text-sm">Your new PID values have been saved successfully.</div>
                </div>
              </div>
              <div className="mockup-code bg-base-200 max-w-md mx-auto">
                <pre data-prefix="$">
                  <code>{result}</code>
                </pre>
              </div>
            </div>
          )}

          {!active && !result && (
            <div className="space-y-6">
              <div className="alert alert-warning">
                <span>Please ensure the boiler temperature is below 50°C before starting the autotune process.</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="form-control w-full">
                  <label className="label">
                    <span className="label-text font-medium">Tuning Goal</span>
                    <span className="label-text-alt">0 = Conservative, 100 = Aggressive</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="input input-bordered w-full"
                    value={time}
                    onChange={(e) => setTime(parseInt(e.target.value) || 0)}
                  />
                  <label className="label">
                    <span className="label-text-alt">Higher values result in faster response but may cause overshoot</span>
                  </label>
                </div>

                <div className="form-control w-full">
                  <label className="label">
                    <span className="label-text font-medium">Window Size</span>
                    <span className="label-text-alt">Number of samples</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    className="input input-bordered w-full"
                    value={samples}
                    onChange={(e) => setSamples(parseInt(e.target.value) || 1)}
                  />
                  <label className="label">
                    <span className="label-text-alt">More samples provide better accuracy but take longer</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-start space-x-4">
        {!active && !result && (
          <button
            className="btn btn-primary btn-lg"
            onClick={onStart}
            disabled={time < 0 || time > 100 || samples < 1 || samples > 10}
          >
            Start Autotune
          </button>
        )}

        {result && (
          <button className="btn btn-outline btn-lg" onClick={() => setResult(null)}>
            Back to Settings
          </button>
        )}
      </div>
    </div>
  );
}
