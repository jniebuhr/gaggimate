import './style.css';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { useContext } from 'react';
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
    return () => { apiService.off('evt:autotune-result', listenerId); };
  }, [apiService]);

  return (
    <div key="autotune" className="grid grid-cols-1 gap-2 sm:grid-cols-12 md:gap-2">
        <div className="sm:col-span-12">
          <h2 className="text-2xl font-bold">PID Autotune</h2>
        </div>
        <div
          className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:bg-gray-800 dark:border-gray-600 sm:col-span-12"
        >
          <div className="lg:p-6 p-2 grid grid-cols-1 gap-2 sm:grid-cols-12">
            {
              active && (
                <>
                  <div className="col-span-12">
                    <OverviewChart />
                  </div>
                  <div className="col-span-12 text-lg gap-4 py-6 flex flex-row justify-center">
                    <Spinner size={8} />
                    <span>Autotune in Progress</span>
                  </div>
                </>
              )
            }
            {
              result && <>
                <div className="col-span-12 gap-4 flex flex-col items-center justify-center p-6">
                  <i className="fa fa-check text-green-600 text-4xl" />
                  <span className="text-lg">Process successful. Your new values {result} have been saved.</span>
                </div>
              </>
            }
            {
              !active && !result && (
                <>
                  <div className="sm:col-span-12">
                    Please run the Autotune with the boiler below 50°C. The process should take about 30 seconds.
                  </div>
                  <div className="sm:col-span-6">
                    <label htmlFor="testTime" className="block mb-2 text-sm font-medium text-gray-900 dark:text-gray-300">
                      Tuning Goal (0 = Conservative, 100 = Aggressive)
                    </label>
                    <input
                      id="testTime"
                      name="testTime"
                      type="number"
                      className="input-field"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-6">
                    <label htmlFor="samples" className="block mb-2 text-sm font-medium text-gray-900 dark:text-gray-300">
                      Window Size
                    </label>
                    <input
                      id="samples"
                      name="samples"
                      type="number"
                      className="input-field"
                      value={samples}
                      onChange={(e) => setSamples(e.target.value)}
                    />
                  </div>
                </>
              )
            }
          </div>
        </div>
        {!active && !result && (
          <div className="sm:col-span-12 flex flex-row">
            <button type="submit" className="menu-button" onClick={() => onStart()}>
              Start
            </button>
          </div>
        )}
        {result && (
          <div className="sm:col-span-12 flex flex-row">
            <button type="submit" className="menu-button" onClick={() => setResult(null)}>
              Back
            </button>
          </div>
        )}
      </div>
  );
}
