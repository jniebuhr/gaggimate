import { useState, useEffect, useCallback, useContext } from 'preact/hooks';
import { ApiServiceContext } from '../../services/ApiService.js';
import { OverviewChart } from '../../components/OverviewChart.jsx';
import { Spinner } from '../../components/Spinner.jsx';
import Card from '../../components/Card.jsx';

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
    const listenerId = apiService.on('evt:autotune-result', msg => {
      setActive(false);
      setResult(msg.pid);
    });
    return () => {
      apiService.off('evt:autotune-result', listenerId);
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
                <div className='alert alert-info max-w-md'>
                  <span>
                    Please wait while the system optimizes your PID settings. This may take up to 30
                    seconds.
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

          {!active && !result && (
            <div className='space-y-4'>
              <div className='alert alert-warning'>
                <span>
                  Please ensure the boiler temperature is below 50°C before starting the autotune
                  process.
                </span>
              </div>

              <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                <div className='form-control'>
                  <label htmlFor='tuningGoal' className='mb-2 block text-sm font-medium'>
                    Tuning Goal
                  </label>
                  <input
                    id='tuningGoal'
                    type='number'
                    min='0'
                    max='100'
                    className='input input-bordered w-full'
                    value={time}
                    onChange={e => setTime(parseInt(e.target.value, 10) || 0)}
                    placeholder='60'
                  />
                  <div className='mb-2 text-xs opacity-70'>
                    0 = Conservative, 100 = Aggressive. Higher values result in faster response but
                    may cause overshoot.
                  </div>
                </div>

                <div className='form-control'>
                  <label htmlFor='windowSize' className='mb-2 block text-sm font-medium'>
                    Window Size
                  </label>
                  <input
                    id='windowSize'
                    type='number'
                    min='1'
                    max='10'
                    className='input input-bordered w-full'
                    value={samples}
                    onChange={e => setSamples(parseInt(e.target.value, 10) || 1)}
                    placeholder='4'
                  />
                  <div className='mb-2 text-xs opacity-70'>
                    Number of samples. More samples provide better accuracy but take longer.
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className='pt-4 lg:col-span-12'>
        <div className='flex flex-col gap-2 sm:flex-row'>
          {!active && !result && (
            <button
              className='btn btn-primary'
              onClick={onStart}
              disabled={time < 0 || time > 100 || samples < 1 || samples > 10}
            >
              Start Autotune
            </button>
          )}

          {result && (
            <button className='btn btn-outline' onClick={() => setResult(null)}>
              Back to Settings
            </button>
          )}
        </div>
      </div>
    </>
  );
}
