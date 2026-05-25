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
  const [time, setTime] = useState(120);
  const [samples, setSamples] = useState(6);
  // Default 680 W matches Gaggia Classic Pro 2019 / E24 boiler element on
  // 230 V. (120 V variant is 570 W; cafeparts.com EF0030-A datasheet.) Used
  // controller-side as combinedKff = TUNER_OUTPUT_SPAN / wattage so the
  // Thermal Feedforward Gain is auto-populated on completion.
  const [wattage, setWattage] = useState(680);

  const onStart = useCallback(() => {
    apiService.send({
      tp: 'req:autotune-start',
      time,
      samples,
      wattage,
    });
    setFailed(false);
    setResult(null);
    setActive(true);
  }, [time, samples, wattage, apiService]);

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
                    The boiler will heat at full power until its temperature inflection is detected,
                    then the SIMC tuning rule derives PID gains. Typically 1–3 minutes depending on
                    machine.
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
                    Try increasing Test Duration or confirm the boiler was cold at start.
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
                    onChange={e => setTime(Number.parseInt(e.target.value, 10) || 0)}
                    placeholder='120'
                  />
                  <div className='mb-2 text-xs opacity-70'>
                    Upper bound on the identification test. Most espresso boilers resolve within
                    60–120 s. Extend if Autotune fails before peak slope is detected.
                  </div>
                </div>

                <div className='form-control'>
                  <label htmlFor='slopeWindow' className='mb-2 block text-sm font-medium'>
                    Slope Window
                  </label>
                  <input
                    id='slopeWindow'
                    type='number'
                    min='4'
                    max='20'
                    className='input input-bordered w-full'
                    value={samples}
                    onChange={e => setSamples(Number.parseInt(e.target.value, 10) || 4)}
                    placeholder='6'
                  />
                  <div className='mb-2 text-xs opacity-70'>
                    Moving-window length (samples) used for slope estimation. Larger values smooth
                    MAX31855 quantisation but lag the inflection. 6 is the sweet spot.
                  </div>
                </div>

                <div className='form-control'>
                  <label htmlFor='heaterWattage' className='mb-2 block text-sm font-medium'>
                    Heater Wattage (W)
                  </label>
                  <input
                    id='heaterWattage'
                    type='number'
                    min='300'
                    max='1500'
                    className='input input-bordered w-full'
                    value={wattage}
                    onChange={e => setWattage(Number.parseInt(e.target.value, 10) || 0)}
                    placeholder='680'
                  />
                  <div className='mb-2 text-xs opacity-70'>
                    Boiler heating element wattage. Defaults: Gaggia Classic Pro 2019 / E24 = 680 W
                    (230 V) or 570 W (120 V); Rancilio Silvia ≈ 1100 W. Used to derive Thermal
                    Feedforward Gain after autotune completes.
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
              disabled={
                time < 30 ||
                time > 300 ||
                samples < 4 ||
                samples > 20 ||
                wattage < 300 ||
                wattage > 1500
              }
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
