import { useState } from 'preact/hooks';
import { computed } from '@preact/signals';
import { machine } from '../../../services/ApiService.js';
import Section from '../../../components/Card.jsx';
import { Tooltip } from '../../../components/Tooltip.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCrosshairs } from '@fortawesome/free-solid-svg-icons/faCrosshairs';
import { InputGroupField, SettingsFormField } from '../../../components/SettingsFormField.jsx';

const ledControl = computed(() => machine.value.capabilities.ledControl);
const pressureAvailable = computed(() => machine.value.capabilities.pressure);
const tofDistance = computed(() => machine.value.status.tofDistance);

function SunriseColorField({ id, label, value, fallback, onChange }) {
  return (
    <SettingsFormField label={label} htmlFor={id} noMargin>
      <label className='input input-bordered w-full cursor-pointer p-1' htmlFor={id}>
        <div className='h-full w-full rounded-sm' style={{ backgroundColor: value || fallback }}>
          <input
            id={id}
            name={id}
            type='color'
            className='input cursor-pointer opacity-0'
            value={value || fallback}
            onChange={onChange}
          />
        </div>
      </label>
    </SettingsFormField>
  );
}

function TankDistanceField({ id, label, value, onChange, onUseCurrent }) {
  return (
    <SettingsFormField label={label} htmlFor={id} noMargin>
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
    </SettingsFormField>
  );
}

export function MachineTab({ formData, onChange, setField }) {
  const [steamPumpDraft, setSteamPumpDraft] = useState(null);

  return (
    <div className='space-y-4 sm:space-y-6 lg:grid lg:grid-cols-2 lg:gap-4'>
      {/* Machine Hardware Settings */}
      <Section title='Machine Settings' className='h-full'>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <InputGroupField
            label='PID Values'
            htmlFor='pid'
            unit={
              <>
                K<sub>p</sub>, K<sub>i</sub>, K<sub>d</sub>
              </>
            }
            noMargin
          >
            <input
              id='pid'
              name='pid'
              type='text'
              className='grow'
              placeholder='2.0, 0.1, 0.01'
              value={formData.pid}
              onChange={onChange('pid')}
            />
          </InputGroupField>
          <InputGroupField
            label='Thermal Feedforward Gain'
            htmlFor='kf'
            unit={
              <>
                K<sub>ff</sub>
              </>
            }
            helpText='Set to 0 to disable feedforward control.'
            noMargin
          >
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
          </InputGroupField>
          <SettingsFormField
            label='Pump Flow Coefficients'
            htmlFor='pumpModelCoeffs'
            helpText='Enter 2 values (flow at 1 bar, flow at 9 bar)'
            noMargin
          >
            <input
              id='pumpModelCoeffs'
              name='pumpModelCoeffs'
              type='text'
              className='input input-bordered w-full'
              placeholder='10.205,5.521'
              value={formData.pumpModelCoeffs}
              onChange={onChange('pumpModelCoeffs')}
            />
          </SettingsFormField>
          <InputGroupField
            label='Temperature Offset (°C)'
            htmlFor='temperatureOffset'
            unit='°C'
            unitAriaLabel='celsius'
            noMargin
          >
            <input
              id='temperatureOffset'
              name='temperatureOffset'
              type='number'
              step='any'
              className='grow'
              placeholder='0'
              value={formData.temperatureOffset}
              onChange={onChange('temperatureOffset')}
            />
          </InputGroupField>
          {pressureAvailable.value && (
            <InputGroupField
              label='Pressure Sensor Rating'
              htmlFor='pressureScaling'
              unit='bar'
              helpText='Enter the bar rating of the pressure sensor being used'
              noMargin
            >
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
            </InputGroupField>
          )}
          <InputGroupField
            label='Steam Pump Assist'
            htmlFor='steamPumpPercentage'
            unit={pressureAvailable.value ? 'ml/s' : '%'}
            unitAriaLabel={pressureAvailable.value ? 'milliliter per second' : 'percent'}
            helpText={
              pressureAvailable.value
                ? 'How many ml/s to pump into the boiler during steaming'
                : 'What percentage to run the pump at during steaming'
            }
            noMargin
          >
            <input
              id='steamPumpPercentage'
              name='steamPumpPercentage'
              type='number'
              step='0.1'
              className='grow'
              placeholder={pressureAvailable.value ? '0.0' : '0.0 %'}
              value={
                steamPumpDraft ??
                String(formData.steamPumpPercentage / (pressureAvailable.value ? 10 : 1))
              }
              onChange={e => setSteamPumpDraft(e.target.value)}
              onBlur={e => {
                setSteamPumpDraft(null);
                setField(
                  'steamPumpPercentage',
                  (parseFloat(e.target.value) * (pressureAvailable.value ? 10 : 1)).toFixed(0),
                );
              }}
            />
          </InputGroupField>
          {pressureAvailable.value && (
            <InputGroupField
              label='Pump Assist Cutoff'
              htmlFor='steamPumpCutoff'
              unit='bar'
              helpText='At how many bars should the pump assist stop. This makes it so the pump will only run when steam is flowing.'
              noMargin
            >
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
            </InputGroupField>
          )}
          <SettingsFormField label='Alt Relay / SSR2 Function' htmlFor='altRelayFunction' noMargin>
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
          </SettingsFormField>
        </div>
      </Section>
      {/* Temperature Settings */}
      <Section title='Temperature Settings' className='h-full md:order-3'>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <InputGroupField
            label='Default Steam Temperature'
            htmlFor='targetSteamTemp'
            unit='°C'
            unitAriaLabel='celsius'
            noMargin
          >
            <input
              id='targetSteamTemp'
              name='targetSteamTemp'
              type='number'
              placeholder='135'
              value={formData.targetSteamTemp}
              onChange={onChange('targetSteamTemp')}
            />
          </InputGroupField>
          <InputGroupField
            label='Default Water Temperature'
            htmlFor='targetWaterTemp'
            unit='°C'
            unitAriaLabel='celsius'
            noMargin
          >
            <input
              id='targetWaterTemp'
              name='targetWaterTemp'
              type='number'
              placeholder='80'
              value={formData.targetWaterTemp}
              onChange={onChange('targetWaterTemp')}
            />
          </InputGroupField>
        </div>
      </Section>
      {/* Alba Settings */}
      {ledControl.value && (
        <Section title='Alba Settings' className='h-full'>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
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
          <div className='border-base-content/5 mt-6 grid grid-cols-1 gap-4 border-t pt-6 md:grid-cols-4'>
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
          <SettingsFormField
            label={`External LED (${((formData.sunriseExtBrightness / 255) * 100).toFixed(0)}%)`}
            htmlFor='sunriseExtBrightness'
            className='mt-4'
            noMargin
          >
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
          </SettingsFormField>
        </Section>
      )}
    </div>
  );
}
