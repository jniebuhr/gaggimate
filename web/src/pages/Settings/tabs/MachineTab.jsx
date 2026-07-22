import { useCallback, useContext, useState } from 'preact/hooks';
import { computed } from '@preact/signals';
import { ApiServiceContext, machine } from '../../../services/ApiService.js';
import Section from '../../../components/Card.jsx';
import { Tooltip } from '../../../components/Tooltip.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCrosshairs } from '@fortawesome/free-solid-svg-icons/faCrosshairs';
import { faWeightScale } from '@fortawesome/free-solid-svg-icons/faWeightScale';
import { InputGroupField, SettingsFormField } from '../../../components/SettingsFormField.jsx';

const ledControl = computed(() => machine.value.capabilities.ledControl);
const pressureAvailable = computed(() => machine.value.capabilities.pressure);
const tofDistance = computed(() => machine.value.status.tofDistance);
const hardwareScaleAvailable = computed(() => !!machine.value.capabilities.hardwareScale);
const status = computed(() => machine.value.status);

function SunriseColorField({ id, label, value, fallback, onChange }) {
  return (
    <SettingsFormField label={label} htmlFor={id} noMargin>
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
  const apiService = useContext(ApiServiceContext);
  const [steamPumpDraft, setSteamPumpDraft] = useState(null);
  const [calibrationWeight, setCalibrationWeight] = useState('');

  const tareScale = useCallback(() => {
    apiService.send({ tp: 'req:scale:tare' });
  }, [apiService]);

  const calibrateLoadCell = useCallback(
    cellNumber => {
      const measuredWeight = status.value?.currentWeight;
      const actualWeight = Number.parseFloat(calibrationWeight);
      if (!measuredWeight || !actualWeight || actualWeight <= 0) {
        window.alert(
          'Please ensure the scale is showing a weight and enter a valid calibration weight.',
        );
        return;
      }

      const currentFactor =
        cellNumber === 1
          ? Number.parseFloat(formData.scaleFactor1) || 1
          : Number.parseFloat(formData.scaleFactor2) || 1;
      const newFactor = (measuredWeight * currentFactor) / actualWeight;
      setField(`scaleFactor${cellNumber}`, newFactor.toFixed(2));
      setCalibrationWeight('');
    },
    [calibrationWeight, formData.scaleFactor1, formData.scaleFactor2, setField],
  );

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

      <Section title='Scales'>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <SettingsFormField
            label='Preferred Scale Source'
            htmlFor='preferredScaleSource'
            helpText='Choose which source to prefer when both hardware and Bluetooth scales are available.'
            noMargin
          >
            <select
              id='preferredScaleSource'
              name='preferredScaleSource'
              className='select select-bordered w-full'
              value={formData.preferredScaleSource || 'hardware'}
              onChange={onChange('preferredScaleSource')}
            >
              <option value='hardware'>Prefer Hardware Scale (Built-in)</option>
              <option value='bluetooth'>Prefer Bluetooth Scale</option>
              <option value='auto'>Auto (best available)</option>
            </select>
          </SettingsFormField>
        </div>

        {hardwareScaleAvailable.value && (
          <div className='border-base-content/5 mt-6 space-y-4 border-t pt-6'>
            <div>
              <h3 className='font-medium'>Hardware Scale Calibration</h3>
              <p className='text-base-content/60 mt-1 text-sm'>
                Tare the scale, then place a known weight and calibrate each load cell.
              </p>
            </div>

            <div className='bg-base-200 flex items-center justify-between rounded-lg p-3'>
              <div className='flex items-center gap-2'>
                <FontAwesomeIcon icon={faWeightScale} className='text-primary' />
                <span className='text-2xl font-bold'>
                  {status.value?.currentWeight?.toFixed(1) || '0.0'}g
                </span>
              </div>
              <button type='button' className='btn btn-outline btn-sm' onClick={tareScale}>
                Tare
              </button>
            </div>

            <SettingsFormField
              label='Actual Weight of Calibration Object'
              htmlFor='calibrationWeight'
              noMargin
            >
              <label className='input input-bordered w-full'>
                <input
                  id='calibrationWeight'
                  type='number'
                  className='grow'
                  placeholder='100.0'
                  min='0.1'
                  step='0.1'
                  value={calibrationWeight}
                  onChange={event => setCalibrationWeight(event.currentTarget.value)}
                />
                <span>g</span>
              </label>
            </SettingsFormField>

            <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
              <button
                type='button'
                className='btn btn-primary btn-sm'
                onClick={() => calibrateLoadCell(1)}
                disabled={!status.value?.currentWeight || !calibrationWeight}
              >
                Calibrate Load Cell 1
              </button>
              <button
                type='button'
                className='btn btn-primary btn-sm'
                onClick={() => calibrateLoadCell(2)}
                disabled={!status.value?.currentWeight || !calibrationWeight}
              >
                Calibrate Load Cell 2
              </button>
            </div>

            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
              <SettingsFormField label='Load Cell 1 Scale Factor' htmlFor='scaleFactor1' noMargin>
                <input
                  id='scaleFactor1'
                  name='scaleFactor1'
                  type='number'
                  className='input input-bordered w-full'
                  min='-50000'
                  max='50000'
                  step='0.01'
                  value={formData.scaleFactor1}
                  onChange={onChange('scaleFactor1')}
                />
              </SettingsFormField>
              <SettingsFormField label='Load Cell 2 Scale Factor' htmlFor='scaleFactor2' noMargin>
                <input
                  id='scaleFactor2'
                  name='scaleFactor2'
                  type='number'
                  className='input input-bordered w-full'
                  min='-50000'
                  max='50000'
                  step='0.01'
                  value={formData.scaleFactor2}
                  onChange={onChange('scaleFactor2')}
                />
              </SettingsFormField>
            </div>
          </div>
        )}
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
