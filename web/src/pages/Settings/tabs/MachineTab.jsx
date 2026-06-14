import { useState, useEffect, useCallback, useContext } from 'preact/hooks';
import { computed } from '@preact/signals';
import { ApiServiceContext, machine } from '../../../services/ApiService.js';
import { OverviewChart } from '../../../components/OverviewChart.jsx';
import { Spinner } from '../../../components/Spinner.jsx';
import Section from '../../../components/Card.jsx';

const ledControl = computed(() => machine.value.capabilities.ledControl);

export function MachineTab({ formData, onChange }) {
  const apiService = useContext(ApiServiceContext);
  
  // Autotune state
  const [autotuneActive, setAutotuneActive] = useState(false);
  const [autotuneResult, setAutotuneResult] = useState(null);
  const [autotuneFailed, setAutotuneFailed] = useState(false);
  const [autotuneTime, setAutotuneTime] = useState(120);
  const [autotuneSamples, setAutotuneSamples] = useState(6);
  const [autotuneWattage, setAutotuneWattage] = useState(680);

  const onStartAutotune = useCallback(() => {
    apiService.send({
      tp: 'req:autotune-start',
      time: autotuneTime,
      samples: autotuneSamples,
      wattage: autotuneWattage,
    });
    setAutotuneFailed(false);
    setAutotuneResult(null);
    setAutotuneActive(true);
  }, [autotuneTime, autotuneSamples, autotuneWattage, apiService]);

  useEffect(() => {
    const resultListener = apiService.on('evt:autotune-result', msg => {
      setAutotuneActive(false);
      setAutotuneFailed(false);
      setAutotuneResult(msg.pid);
    });
    const failedListener = apiService.on('evt:autotune-failed', () => {
      setAutotuneActive(false);
      setAutotuneResult(null);
      setAutotuneFailed(true);
    });
    return () => {
      apiService.off('evt:autotune-result', resultListener);
      apiService.off('evt:autotune-failed', failedListener);
    };
  }, [apiService]);

  return (
    <div className='space-y-4 sm:space-y-6'>
      {/* Temperature Settings */}
      <Section title='Temperature Settings'>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div className='form-control'>
            <label htmlFor='targetSteamTemp' className='mb-2 block text-sm font-medium'>
              Default Steam Temperature
            </label>
            <div className='input-group'>
              <label htmlFor='targetSteamTemp' className='input w-full'>
                <input
                  id='targetSteamTemp'
                  name='targetSteamTemp'
                  type='number'
                  placeholder='135'
                  value={formData.targetSteamTemp}
                  onChange={onChange('targetSteamTemp')}
                />
                <span aria-label='celsius'>°C</span>
              </label>
            </div>
          </div>
          <div className='form-control'>
            <label htmlFor='targetWaterTemp' className='mb-2 block text-sm font-medium'>
              Default Water Temperature
            </label>
            <div className='input-group'>
              <label htmlFor='targetWaterTemp' className='input w-full'>
                <input
                  id='targetWaterTemp'
                  name='targetWaterTemp'
                  type='number'
                  placeholder='80'
                  value={formData.targetWaterTemp}
                  onChange={onChange('targetWaterTemp')}
                />
                <span aria-label='celsius'>°C</span>
              </label>
            </div>
          </div>
        </div>
      </Section>

      {/* Machine Hardware Settings */}
      <Section title='Machine Settings'>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div className='form-control'>
            <label htmlFor='pid' className='mb-2 block text-sm font-medium'>
              PID Values
            </label>
            <div className='input-group'>
              <label htmlFor='pid' className='input w-full'>
                <input
                  id='pid'
                  name='pid'
                  type='text'
                  className='grow'
                  placeholder='2.0, 0.1, 0.01'
                  value={formData.pid}
                  onChange={onChange('pid')}
                />
                <span>
                  K<sub>p</sub>, K<sub>i</sub>, K<sub>d</sub>
                </span>
              </label>
            </div>
          </div>
          <div className='form-control'>
            <label htmlFor='kf' className='mb-2 block text-sm font-medium'>
              Thermal Feedforward Gain
            </label>
            <div className='input-group'>
              <label htmlFor='kf' className='input w-full'>
                <input
                  id='kf'
                  name='kf'
                  type='number'
                  step='0.001'
                  className='grow'
                  placeholder='0.600'
                  value={formData.kf}
                  onChange={onChange('kf')}
                />
                <span>
                  K<sub>ff</sub>
                </span>
              </label>
            </div>
            <div className='mt-2 text-xs opacity-75'>
              Set to 0 to disable feedforward control.
            </div>
          </div>
          <div className='form-control'>
            <label htmlFor='pumpModelCoeffs' className='mb-2 block text-sm font-medium'>
              Pump Flow Coefficients
            </label>
            <div className='mb-2 text-xs opacity-70'>
              Enter 2 values (flow at 1 bar, flow at 9 bar)
            </div>
            <input
              id='pumpModelCoeffs'
              name='pumpModelCoeffs'
              type='text'
              className='input input-bordered w-full'
              placeholder='10.205,5.521'
              value={formData.pumpModelCoeffs}
              onChange={onChange('pumpModelCoeffs')}
            />
          </div>
          <div className='form-control'>
            <label htmlFor='temperatureOffset' className='mb-2 block text-sm font-medium'>
              Temperature Offset (°C)
            </label>
            <div className='input-group'>
              <label htmlFor='temperatureOffset' className='input w-full'>
                <input
                  id='temperatureOffset'
                  name='temperatureOffset'
                  type='number'
                  step='any'
                  placeholder='0'
                  value={formData.temperatureOffset}
                  onChange={onChange('temperatureOffset')}
                />
                <span aria-label='celsius'>°C</span>
              </label>
            </div>
          </div>
          <div className='form-control'>
            <label htmlFor='steamPumpPercentage' className='mb-2 block text-sm font-medium'>
              Steam Pump Power
            </label>
            <div className='input-group'>
              <label htmlFor='steamPumpPercentage' className='input w-full'>
                <input
                  id='steamPumpPercentage'
                  name='steamPumpPercentage'
                  type='number'
                  placeholder='25'
                  value={formData.steamPumpPercentage}
                  onChange={onChange('steamPumpPercentage')}
                />
                <span aria-label='percent'>%</span>
              </label>
            </div>
          </div>
          <div className='form-control'>
            <label htmlFor='altRelayFunction' className='mb-2 block text-sm font-medium'>
              Alternate Relay Function
            </label>
            <select
              id='altRelayFunction'
              name='altRelayFunction'
              className='select select-bordered w-full'
              onChange={onChange('altRelayFunction')}
            >
              <option value='0' selected={formData.altRelayFunction === 0 || formData.altRelayFunction === '0'}>
                Disabled
              </option>
              <option value='1' selected={formData.altRelayFunction === 1 || formData.altRelayFunction === '1'}>
                Active during steam
              </option>
              <option value='2' selected={formData.altRelayFunction === 2 || formData.altRelayFunction === '2'}>
                Active when hot
              </option>
              <option value='3' selected={formData.altRelayFunction === 3 || formData.altRelayFunction === '3'}>
                Active during process
              </option>
            </select>
          </div>
        </div>
      </Section>

      {/* Display Settings */}
      <Section title='Display Settings'>
        <div className='form-control mb-4'>
          <label className='label cursor-pointer justify-start gap-4'>
            <span className='label-text font-medium'>Standby Display Enabled</span>
            <input
              id='standbyDisplayEnabled'
              name='standbyDisplayEnabled'
              type='checkbox'
              className='toggle toggle-primary'
              checked={!!formData.standbyDisplayEnabled}
              onChange={onChange('standbyDisplayEnabled')}
            />
          </label>
        </div>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div className='form-control'>
            <label htmlFor='standbyBrightness' className='mb-2 block text-sm font-medium'>
              Standby Brightness
            </label>
            <div className='input-group'>
              <label htmlFor='standbyBrightness' className='input w-full'>
                <input
                  id='standbyBrightness'
                  name='standbyBrightness'
                  type='number'
                  min='0'
                  max='100'
                  placeholder='0'
                  disabled={!formData.standbyDisplayEnabled}
                  value={formData.standbyDisplayEnabled ? formData.standbyBrightness : 0}
                  onChange={onChange('standbyBrightness')}
                />
                <span aria-label='percent'>%</span>
              </label>
            </div>
          </div>
          <div className='form-control'>
            <label htmlFor='standbyBrightnessTimeout' className='mb-2 block text-sm font-medium'>
              Standby Timeout
            </label>
            <div className='input-group'>
              <label htmlFor='standbyBrightnessTimeout' className='input w-full'>
                <input
                  id='standbyBrightnessTimeout'
                  name='standbyBrightnessTimeout'
                  type='number'
                  min='1'
                  value={formData.standbyBrightnessTimeout}
                  onChange={onChange('standbyBrightnessTimeout')}
                />
                <span aria-label='seconds'>s</span>
              </label>
            </div>
          </div>
          <div className='form-control'>
            <label htmlFor='themeMode' className='mb-2 block text-sm font-medium'>
              Display Theme
            </label>
            <select
              id='themeMode'
              name='themeMode'
              className='select select-bordered w-full'
              value={formData.themeMode}
              onChange={onChange('themeMode')}
            >
              <option value={0}>Dark Theme</option>
              <option value={1}>Light Theme</option>
            </select>
          </div>
        </div>

        {/* Wake Settings */}
        <div className='mt-6 border-t border-base-content/5 pt-6 space-y-2'>
          <h3 className='text-md font-semibold text-base-content mb-2'>Wake Screen</h3>
          <div className='form-control'>
            <label className='label cursor-pointer justify-start gap-4'>
              <span className='label-text'>Wake screen when scale becomes active</span>
              <input
                id='wakeScaleActive'
                name='wakeScaleActive'
                type='checkbox'
                className='toggle toggle-primary'
                checked={!!formData.wakeScaleActive}
                onChange={onChange('wakeScaleActive')}
              />
            </label>
          </div>
          <div className='form-control'>
            <label className='label cursor-pointer justify-start gap-4'>
              <span className='label-text'>Wake screen when brew button pressed</span>
              <input
                id='wakeBrewActive'
                name='wakeBrewActive'
                type='checkbox'
                className='toggle toggle-primary'
                checked={!!formData.wakeBrewActive}
                onChange={onChange('wakeBrewActive')}
              />
            </label>
          </div>
        </div>
      </Section>

      {/* Alba Settings */}
      {ledControl.value && (
        <Section title='Alba Settings'>
          <p className='text-sm opacity-70 mb-4 text-base-content/85'>
            Set the colors for the LEDs when in idle mode with no warnings.
          </p>
          <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
            <div className='form-control'>
              <label htmlFor='sunriseR' className='mb-2 block text-sm font-medium'>
                Red (0 - 255)
              </label>
              <input
                id='sunriseR'
                name='sunriseR'
                type='number'
                className='input input-bordered w-full'
                placeholder='16'
                value={formData.sunriseR}
                onChange={onChange('sunriseR')}
              />
            </div>
            <div className='form-control'>
              <label htmlFor='sunriseG' className='mb-2 block text-sm font-medium'>
                Green (0 - 255)
              </label>
              <input
                id='sunriseG'
                name='sunriseG'
                type='number'
                className='input input-bordered w-full'
                placeholder='16'
                value={formData.sunriseG}
                onChange={onChange('sunriseG')}
              />
            </div>
            <div className='form-control'>
              <label htmlFor='sunriseB' className='mb-2 block text-sm font-medium'>
                Blue (0 - 255)
              </label>
              <input
                id='sunriseB'
                name='sunriseB'
                type='number'
                className='input input-bordered w-full'
                placeholder='16'
                value={formData.sunriseB}
                onChange={onChange('sunriseB')}
              />
            </div>
            <div className='form-control'>
              <label htmlFor='sunriseW' className='mb-2 block text-sm font-medium'>
                White (0 - 255)
              </label>
              <input
                id='sunriseW'
                name='sunriseW'
                type='number'
                className='input input-bordered w-full'
                placeholder='16'
                value={formData.sunriseW}
                onChange={onChange('sunriseW')}
              />
            </div>
          </div>
        </Section>
      )}

      {/* PID Autotune Section */}
      <Section title='PID Autotune'>
        {autotuneActive && (
          <div className='space-y-4'>
            <div className='w-full'>
              <OverviewChart />
            </div>
            <div className='flex flex-col items-center justify-center space-y-4 py-4'>
              <div className='flex items-center space-x-3'>
                <Spinner size={8} />
                <span className='text-lg font-medium text-base-content'>Autotune in Progress</span>
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

        {autotuneResult && (
          <div className='space-y-4 text-center'>
            <div className='alert alert-success mx-auto max-w-md'>
              <div>
                <h3 className='font-bold'>Autotune Complete!</h3>
                <div className='text-sm'>Your new PID values have been saved successfully.</div>
              </div>
            </div>
            <div className='mockup-code bg-base-200 mx-auto max-w-md'>
              <pre data-prefix='$'>
                <code>{autotuneResult}</code>
              </pre>
            </div>
            <button type='button' className='btn btn-outline btn-sm mt-2' onClick={() => setAutotuneResult(null)}>
              Dismiss
            </button>
          </div>
        )}

        {autotuneFailed && (
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
            <button type='button' className='btn btn-outline btn-sm mt-2' onClick={() => setAutotuneFailed(false)}>
              Retry
            </button>
          </div>
        )}

        {!autotuneActive && !autotuneResult && !autotuneFailed && (
          <div className='space-y-4'>
            <div className='alert alert-warning'>
              <span>
                Please ensure the boiler temperature is below 50°C before starting the autotune
                process.
              </span>
            </div>

            <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
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
                  value={autotuneTime}
                  onChange={e => setAutotuneTime(Number.parseInt(e.target.value, 10) || 0)}
                  placeholder='120'
                />
                <div className='mt-2 text-xs opacity-70 text-base-content/80'>
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
                  value={autotuneSamples}
                  onChange={e => setAutotuneSamples(Number.parseInt(e.target.value, 10) || 4)}
                  placeholder='6'
                />
                <div className='mt-2 text-xs opacity-70 text-base-content/80'>
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
                  value={autotuneWattage}
                  onChange={e => setAutotuneWattage(Number.parseInt(e.target.value, 10) || 0)}
                  placeholder='680'
                />
                <div className='mt-2 text-xs opacity-70 text-base-content/80'>
                  Heater wattage in Watts (e.g. 680 W).
                </div>
              </div>
            </div>
            
            <div className='pt-2'>
              <button
                type='button'
                className='btn btn-primary'
                onClick={onStartAutotune}
                disabled={
                  autotuneTime < 30 ||
                  autotuneTime > 300 ||
                  autotuneSamples < 4 ||
                  autotuneSamples > 20 ||
                  autotuneWattage < 300 ||
                  autotuneWattage > 1500
                }
              >
                Start Autotune
              </button>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
