import { useState, useEffect, useCallback, useContext } from 'preact/hooks';
import { computed } from '@preact/signals';
import { ApiServiceContext, machine } from '../../../services/ApiService.js';
import { OverviewChart } from '../../../components/OverviewChart.jsx';
import { Spinner } from '../../../components/Spinner.jsx';
import Section from '../../../components/Card.jsx';
import { Tooltip } from '../../../components/Tooltip.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCrosshairs } from '@fortawesome/free-solid-svg-icons/faCrosshairs';

const ledControl = computed(() => machine.value.capabilities.ledControl);
const pressureAvailable = computed(() => machine.value.capabilities.pressure);
const tofDistance = computed(() => machine.value.status.tofDistance);

function SunriseColorField({ id, label, value, fallback, onChange }) {
  return (
    <div className='form-control'>
      <label htmlFor={id} className='mb-2 block text-sm font-medium'>
        {label}
      </label>
      <label className='input input-bordered w-full cursor-pointer p-1' htmlFor={id}>
        <div className='h-full w-full rounded-sm' style={{ backgroundColor: value || fallback }}>
          <input
            id={id}
            name={id}
            type='color'
            className='input input-bordered invisible w-full'
            value={value || fallback}
            onChange={onChange}
          />
        </div>
      </label>
    </div>
  );
}

function TankDistanceField({ id, label, value, onChange, onUseCurrent }) {
  return (
    <div className='form-control'>
      <label htmlFor={id} className='mb-2 block text-sm font-medium'>
        {label}
      </label>
      <div className='flex flex-row gap-2'>
        <div className='input-group flex-grow'>
          <label htmlFor={id} className='input w-full'>
            <input
              id={id}
              name={id}
              type='number'
              className='grow'
              placeholder='16'
              value={value}
              onChange={onChange}
            />
            <span aria-label='millimeter'>mm</span>
          </label>
        </div>
        <Tooltip content={`Set to current measurement: ${tofDistance}mm`}>
          <button type='button' className='btn btn-ghost' onClick={onUseCurrent}>
            <FontAwesomeIcon icon={faCrosshairs} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

export function MachineTab({ formData, onChange, setField }) {
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
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
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
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
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
            <div className='mt-2 text-xs opacity-75'>Set to 0 to disable feedforward control.</div>
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
          {pressureAvailable.value && (
            <div className='form-control'>
              <label htmlFor='pressureScaling' className='mb-2 block text-sm font-medium'>
                Pressure Sensor Rating
              </label>
              <div className='input-group'>
                <label htmlFor='pressureScaling' className='input w-full'>
                  <input
                    id='pressureScaling'
                    name='pressureScaling'
                    type='number'
                    step='any'
                    className='grow'
                    placeholder='0.0'
                    value={formData.pressureScaling}
                    onChange={onChange('pressureScaling')}
                  />
                  <span>bar</span>
                </label>
              </div>
              <div className='mt-2 text-xs opacity-70'>
                Enter the bar rating of the pressure sensor being used
              </div>
            </div>
          )}
          <div className='form-control'>
            <label htmlFor='steamPumpPercentage' className='mb-2 block text-sm font-medium'>
              Steam Pump Assist
            </label>
            <div className='input-group'>
              <label htmlFor='steamPumpPercentage' className='input w-full'>
                <input
                  id='steamPumpPercentage'
                  name='steamPumpPercentage'
                  type='number'
                  step='0.1'
                  className='grow'
                  placeholder={pressureAvailable.value ? '0.0' : '0.0 %'}
                  value={String(formData.steamPumpPercentage * (pressureAvailable.value ? 0.1 : 1))}
                  onBlur={e =>
                    setField(
                      'steamPumpPercentage',
                      (parseFloat(e.target.value) * (pressureAvailable.value ? 10 : 1)).toFixed(0),
                    )
                  }
                />
                <span aria-label={pressureAvailable.value ? 'milliliter per second' : 'percent'}>
                  {pressureAvailable.value ? 'ml/s' : '%'}
                </span>
              </label>
            </div>
            <div className='mt-2 text-xs opacity-70'>
              {pressureAvailable.value
                ? 'How many ml/s to pump into the boiler during steaming'
                : 'What percentage to run the pump at during steaming'}
            </div>
          </div>
          {pressureAvailable.value && (
            <div className='form-control'>
              <label htmlFor='steamPumpCutoff' className='mb-2 block text-sm font-medium'>
                Pump Assist Cutoff
              </label>
              <div className='input-group'>
                <label htmlFor='steamPumpCutoff' className='input w-full'>
                  <input
                    id='steamPumpCutoff'
                    name='steamPumpCutoff'
                    type='number'
                    step='any'
                    className='grow'
                    placeholder='0.0'
                    value={formData.steamPumpCutoff}
                    onChange={onChange('steamPumpCutoff')}
                  />
                  <span>bar</span>
                </label>
              </div>
              <div className='mt-2 text-xs opacity-70'>
                At how many bars should the pump assist stop. This makes it so the pump will only
                run when steam is flowing.
              </div>
            </div>
          )}
          <div className='form-control'>
            <label htmlFor='altRelayFunction' className='mb-2 block text-sm font-medium'>
              Alt Relay / SSR2 Function
            </label>
            <select
              id='altRelayFunction'
              name='altRelayFunction'
              className='select select-bordered w-full'
              value={formData.altRelayFunction ?? 1}
              onChange={onChange('altRelayFunction')}
            >
              <option value={0}>None</option>
              <option value={1}>Grind</option>
              <option value={2} disabled className='text-gray-400'>
                Steam Boiler (Coming Soon)
              </option>
            </select>
          </div>
        </div>
      </Section>

      {/* Display Settings */}
      <Section title='Display Settings'>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <div className='form-control'>
            <label htmlFor='mainBrightness' className='mb-2 block text-sm font-medium'>
              Main Brightness (1-16)
            </label>
            <input
              id='mainBrightness'
              name='mainBrightness'
              type='number'
              className='input input-bordered w-full'
              placeholder='16'
              min='1'
              max='16'
              value={formData.mainBrightness}
              onChange={onChange('mainBrightness')}
            />
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

        {/* Standby Display */}
        <div className='border-base-content/5 mt-6 border-t pt-6'>
          <div className='form-control mb-4'>
            <label className='label cursor-pointer justify-start gap-4'>
              <span className='label-text font-medium'>Enable standby display</span>
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
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            <div className='form-control'>
              <label htmlFor='standbyBrightness' className='mb-2 block text-sm font-medium'>
                Standby Brightness (0-16)
              </label>
              <input
                id='standbyBrightness'
                name='standbyBrightness'
                type='number'
                className='input input-bordered w-full'
                placeholder='8'
                min='0'
                max='16'
                disabled={!formData.standbyDisplayEnabled}
                value={formData.standbyDisplayEnabled ? formData.standbyBrightness : 0}
                onChange={onChange('standbyBrightness')}
              />
              <div className='mt-2 text-xs opacity-70'>
                When the toggle is off, brightness will be set to 0
              </div>
            </div>
            <div className='form-control'>
              <label htmlFor='standbyBrightnessTimeout' className='mb-2 block text-sm font-medium'>
                Standby Brightness Timeout
              </label>
              <div className='input-group'>
                <label htmlFor='standbyBrightnessTimeout' className='input w-full'>
                  <input
                    id='standbyBrightnessTimeout'
                    name='standbyBrightnessTimeout'
                    type='number'
                    min='1'
                    placeholder='60'
                    value={formData.standbyBrightnessTimeout}
                    onChange={onChange('standbyBrightnessTimeout')}
                  />
                  <span aria-label='seconds'>s</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Alba Settings */}
      {ledControl.value && (
        <Section title='Alba Settings'>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            <SunriseColorField
              id='sunriseIdle'
              label='Idle Color'
              value={formData.sunriseIdle}
              fallback='#00ffff'
              onChange={onChange('sunriseIdle')}
            />
            <SunriseColorField
              id='sunriseActive'
              label='Brew Color'
              value={formData.sunriseActive}
              fallback='#0000ff'
              onChange={onChange('sunriseActive')}
            />
            <SunriseColorField
              id='sunriseFinished'
              label='Finished Color'
              value={formData.sunriseFinished}
              fallback='#00ff00'
              onChange={onChange('sunriseFinished')}
            />
            <SunriseColorField
              id='sunriseError'
              label='Error Color'
              value={formData.sunriseError}
              fallback='#ff0000'
              onChange={onChange('sunriseError')}
            />
          </div>
          <div className='form-control mt-4'>
            <label htmlFor='sunriseExtBrightness' className='mb-2 block text-sm font-medium'>
              {`External LED (${((formData.sunriseExtBrightness / 255) * 100).toFixed(0)}%)`}
            </label>
            <input
              id='sunriseExtBrightness'
              name='sunriseExtBrightness'
              type='range'
              className='range w-full'
              min={0}
              max={255}
              step={1}
              value={formData.sunriseExtBrightness}
              onChange={onChange('sunriseExtBrightness')}
            />
          </div>
          <div className='border-base-content/5 mt-6 grid grid-cols-1 gap-4 border-t pt-6 md:grid-cols-2'>
            <TankDistanceField
              id='emptyTankDistance'
              label='Distance from sensor to bottom of the tank'
              value={formData.emptyTankDistance}
              onChange={onChange('emptyTankDistance')}
              onUseCurrent={() => setField('emptyTankDistance', tofDistance.value)}
            />
            <TankDistanceField
              id='fullTankDistance'
              label='Distance from sensor to the fill line'
              value={formData.fullTankDistance}
              onChange={onChange('fullTankDistance')}
              onUseCurrent={() => setField('fullTankDistance', tofDistance.value)}
            />
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
                <span className='text-base-content text-lg font-medium'>Autotune in Progress</span>
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
            <button
              type='button'
              className='btn btn-outline btn-sm mt-2'
              onClick={() => setAutotuneResult(null)}
            >
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
                  No valid gains were produced. Your existing PID settings have been preserved. Try
                  increasing Test Duration or confirm the boiler was cold at start.
                </div>
              </div>
            </div>
            <button
              type='button'
              className='btn btn-outline btn-sm mt-2'
              onClick={() => setAutotuneFailed(false)}
            >
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
                <div className='text-base-content/80 mt-2 text-xs opacity-70'>
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
                <div className='text-base-content/80 mt-2 text-xs opacity-70'>
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
                <div className='text-base-content/80 mt-2 text-xs opacity-70'>
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
