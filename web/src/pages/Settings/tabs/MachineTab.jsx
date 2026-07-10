import { computed } from '@preact/signals';
import { machine } from '../../../services/ApiService.js';
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
    </div>
  );
}
