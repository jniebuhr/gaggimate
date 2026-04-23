import { useState, useEffect, useCallback, useContext } from 'preact/hooks';
import { ApiServiceContext } from '../../services/ApiService.js';
import { OverviewChart } from '../../components/OverviewChart.jsx';
import { Spinner } from '../../components/Spinner.jsx';
import Card from '../../components/Card.jsx';

export function Autotune() {
  const apiService = useContext(ApiServiceContext);
  const [active, setActive] = useState(false);
  const [result, setResult] = useState(null);
  const [failed, setFailed] = useState(false);
  const [time, setTime] = useState(90);
  const [samples, setSamples] = useState(250);

  const onStart = useCallback(() => {
    apiService.send({
      tp: 'req:autotune-start',
      time,
      samples,
    });
    setFailed(false);
    setResult(null);
    setActive(true);
  }, [time, samples, apiService]);

  useEffect(() => {
    const resultListener = apiService.on('evt:autotune-result', msg => {
      setActive(false);
      setFailed(false);
      setResult(msg.pid);
    });
    const failedListener = apiService.on('evt:autotune-failed', () => {
      setActive(false);
      setResult(null);
      setFailed(true);
    });
    return () => {
      apiService.off('evt:autotune-result', resultListener);
      apiService.off('evt:autotune-failed', failedListener);
    };
  }, [apiService]);

  return (
    <>
      <div className='mb-4 flex flex-row items-center gap-2'>
        <h1 className='flex-grow text-2xl font-bold sm:text-3xl'>PID Autotune</h1>
      </div>

      <div className='grid grid-cols-1 gap-4 lg:grid-cols-12'>
        <Card sm={12} title='PID Autotune Settings'>
          {active && (
            <div className='space-y-4'>
              <div className='w-full'>
                <OverviewChart />
              </div>
              <div className='flex flex-col items-center justify-center space-y-4 py-4'>
                <div className='flex items-center space-x-3'>
                  <Spinner size={8} />
                  <span className='text-lg font-medium'>Autotune in Progress</span>
                </div>
                <div className='alert alert-warning max-w-md'>
                  <span>
                    Please wait while the system runs a step-response test and identifies PID gains.
                    Typically 1–3 minutes depending on machine.
                  </span>
                </div>
              </div>
            </div>
          )}

          {result && (
            <div className='space-y-4 text-center'>
              <div className='alert alert-success mx-auto max-w-md'>
                <div>
                  <h3 className='font-bold'>Autotune Complete!</h3>
                  <div className='text-sm'>Your new PID values have been saved successfully.</div>
                </div>
              </div>
              <div className='mockup-code bg-base-200 mx-auto max-w-md'>
                <pre data-prefix='$'>
                  <code>{result}</code>
                </pre>
              </div>
            </div>
          )}

          {failed && (
            <div className='space-y-4 text-center'>
              <div className='alert alert-error mx-auto max-w-md'>
                <div>
                  <h3 className='font-bold'>Autotune Failed</h3>
                  <div className='text-sm'>
                    No valid gains were produced. Your existing PID settings have been preserved.
                    Try increasing the test duration or check that the boiler was cold at start.
                  </div>
                </div>
              </div>
            </div>
          )}

          {!active && !result && !failed && (
            <div className='space-y-4'>
              <div className='alert alert-warning'>
                <span>
                  Please ensure the boiler temperature is below 50°C before starting the autotune
                  process.
                </span>
              </div>

              <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                <div className='form-control'>
                  <label htmlFor='testTime' className='mb-2 block text-sm font-medium'>
                    Test Duration (seconds)
                  </label>
                  <input
                    id='testTime'
                    type='number'
                    min='30'
                    max='300'
                    className='input input-bordered w-full'
                    value={time}
                    onChange={e => setTime(parseInt(e.target.value, 10) || 0)}
                    placeholder='90'
                  />
                  <div className='mb-2 text-xs opacity-70'>
                    Approximate boiler time constant. 90 suits Rancilio Silvia; 60 suits Gaggia
                    Classic. The test ends at inflection (~½ this value).
                  </div>
                </div>

                <div className='form-control'>
                  <label htmlFor='samples' className='mb-2 block text-sm font-medium'>
                    Sample Count
                  </label>
                  <input
                    id='samples'
                    type='number'
                    min='200'
                    max='500'
                    className='input input-bordered w-full'
                    value={samples}
                    onChange={e => setSamples(parseInt(e.target.value, 10) || 200)}
                    placeholder='250'
                  />
                  <div className='mb-2 text-xs opacity-70'>
                    Samples across the test window. 250 is the sweet spot; higher values tighten
                    the inflection-point estimate at the cost of sample rate.
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className='pt-4 lg:col-span-12'>
        <div className='flex flex-col gap-2 sm:flex-row'>
          {!active && !result && !failed && (
            <button
              className='btn btn-primary'
              onClick={onStart}
              disabled={time < 30 || time > 300 || samples < 200 || samples > 500}
            >
              Start Autotune
            </button>
          )}

          {result && (
            <button className='btn btn-outline' onClick={() => setResult(null)}>
              Back to Settings
            </button>
          )}

          {failed && (
            <button className='btn btn-outline' onClick={() => setFailed(false)}>
              Back to Settings
            </button>
          )}
        </div>
      </div>
    </>
  );
}
