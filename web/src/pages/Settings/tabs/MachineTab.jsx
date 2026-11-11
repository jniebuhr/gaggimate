import { useCallback, useContext, useEffect, useRef, useState } from 'preact/hooks';
import { computed } from '@preact/signals';
import { Trans, useLingui } from '@lingui/react/macro';
import { ApiServiceContext, machine } from '../../../services/ApiService.js';
import Section from '../../../components/Card.jsx';
import { HeaterCoordinationSection } from './HeaterCoordinationSection.jsx';
import { Tooltip } from '../../../components/Tooltip.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCrosshairs } from '@fortawesome/free-solid-svg-icons/faCrosshairs';
import { faWeightScale } from '@fortawesome/free-solid-svg-icons/faWeightScale';
import { InputGroupField, SettingsFormField } from '../../../components/SettingsFormField.jsx';
import { CleaningSection } from './CleaningSection.jsx';
import { validateTankCalibration } from '../../../utils/waterLevel.js';

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
            className='input cursor-pointer opacity-0'
            value={value || fallback}
            onChange={onChange}
          />
        </div>
      </label>
    </SettingsFormField>
  );
}

function TankDistanceField({ id, label, value, error, onChange, onUseCurrent }) {
  const { t } = useLingui();
  const distance = tofDistance.value;
  const inputRef = useRef(null);

  // Feeds the rule into native form validation so a plain Save is blocked with the same message.
  useEffect(() => {
    inputRef.current?.setCustomValidity(error || '');
  }, [error]);

  return (
    <SettingsFormField label={label} htmlFor={id} error={error} noMargin>
      <div className='flex flex-row gap-2'>
        <div className='input-group flex-grow'>
          <label htmlFor={id} className={`input w-full ${error ? 'input-error' : ''}`}>
            <input
              ref={inputRef}
              id={id}
              name={id}
              type='number'
              className='grow'
              placeholder='16'
              required
              min='0'
              step='1'
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              value={value}
              onChange={onChange}
            />
            <span aria-label={t`millimeter`}>mm</span>
          </label>
        </div>
        <Tooltip content={t`Set to current measurement: ${distance}mm`}>
          <button
            type='button'
            className='btn btn-ghost'
            disabled={!distance}
            onClick={onUseCurrent}
          >
            <FontAwesomeIcon icon={faCrosshairs} />
          </button>
        </Tooltip>
      </div>
    </SettingsFormField>
  );
}

export function MachineTab({ formData, onChange, setField }) {
  const { t } = useLingui();
  const apiService = useContext(ApiServiceContext);
  const [steamPumpDraft, setSteamPumpDraft] = useState(null);
  const [calibrationWeight, setCalibrationWeight] = useState('');

  const tareScale = useCallback(() => {
    apiService.send({ tp: 'req:scale:tare' });
  }, [apiService]);

  const changeHardwareScaleSampleRate = useCallback(
    event => {
      const sampleRate = Number.parseInt(event.currentTarget.value, 10) === 80 ? 80 : 10;
      const defaultAlpha = sampleRate === 80 ? '0.40' : '0.80';
      setField('hardwareScaleSampleRateSps', sampleRate);
      setField('hardwareScaleIdleAlpha', defaultAlpha);
      setField('hardwareScaleActiveAlpha', defaultAlpha);
    },
    [setField],
  );

  const calibrateLoadCell = useCallback(
    cellNumber => {
      const measuredWeight =
        cellNumber === 1
          ? status.value?.hardwareScaleCell1Weight
          : status.value?.hardwareScaleCell2Weight;
      const measurementValid =
        cellNumber === 1
          ? status.value?.hardwareScaleCell1Valid
          : status.value?.hardwareScaleCell2Valid;
      const actualWeight = Number.parseFloat(calibrationWeight);
      if (
        !measurementValid ||
        !Number.isFinite(measuredWeight) ||
        Math.abs(measuredWeight) < 0.01 ||
        !Number.isFinite(actualWeight) ||
        actualWeight <= 0
      ) {
        window.alert(
          t`Please ensure the scale is showing a weight and enter a valid calibration weight.`,
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
    [calibrationWeight, formData.scaleFactor1, formData.scaleFactor2, setField, t],
  );

  const tankErrors = validateTankCalibration(formData.emptyTankDistance, formData.fullTankDistance);
  const tankErrorMessages = {
    invalid: t`Enter a whole number of millimeters, 0 or more.`,
    order: t`Must be larger than the distance to the fill line.`,
  };

  const extLedPct = ((formData.sunriseExtBrightness / 255) * 100).toFixed(0);

  return (
    <div className='space-y-4 sm:space-y-6 lg:grid lg:grid-cols-2 lg:gap-4'>
      {/* Machine Hardware Settings */}
      <Section title={t`Machine Settings`} className='h-full'>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <InputGroupField
            label={t`PID Values`}
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
            label={t`Thermal Feedforward Gain`}
            htmlFor='kf'
            unit={
              <>
                K<sub>ff</sub>
              </>
            }
            helpText={t`Set to 0 to disable feedforward control.`}
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
            label={t`Pump Flow Coefficients`}
            htmlFor='pumpModelCoeffs'
            helpText={t`Enter 2 values (flow at 1 bar, flow at 9 bar)`}
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
            label={t`Temperature Offset (°C)`}
            htmlFor='temperatureOffset'
            unit='°C'
            unitAriaLabel={t`celsius`}
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
              label={t`Pressure Offset`}
              htmlFor='pressureOffset'
              unit='bar'
              helpText={t`Cracking pressure of a grouphead mushroom valve (e.g. 4.0 on Delonghi machines). Subtracted from readings and added to targets only while a brew is running. Leave at 0.0 for a 3-way solenoid.`}
              noMargin
            >
              <input
                id='pressureOffset'
                name='pressureOffset'
                type='number'
                step='any'
                className='grow'
                placeholder='0.0'
                value={formData.pressureOffset}
                onChange={onChange('pressureOffset')}
              />
            </InputGroupField>
          )}
          {pressureAvailable.value && (
            <InputGroupField
              label={t`Pressure Sensor Rating`}
              htmlFor='pressureScaling'
              unit='bar'
              helpText={t`Enter the bar rating of the pressure sensor being used`}
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
            label={t`Steam Pump Assist`}
            htmlFor='steamPumpPercentage'
            unit={pressureAvailable.value ? 'ml/s' : '%'}
            unitAriaLabel={pressureAvailable.value ? t`milliliter per second` : t`percent`}
            helpText={
              pressureAvailable.value
                ? t`How many ml/s to pump into the boiler during steaming`
                : t`What percentage to run the pump at during steaming`
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
              label={t`Pump Assist Cutoff`}
              htmlFor='steamPumpCutoff'
              unit='bar'
              helpText={t`At how many bars should the pump assist stop. This makes it so the pump will only run when steam is flowing.`}
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
          <SettingsFormField
            label={t`Alt Relay / SSR2 Function`}
            htmlFor='altRelayFunction'
            noMargin
          >
            <select
              id='altRelayFunction'
              name='altRelayFunction'
              className='select select-bordered w-full'
              value={formData.altRelayFunction ?? 1}
              onChange={onChange('altRelayFunction')}
            >
              <option value={0}>{t({ message: 'None', context: 'relay function' })}</option>
              <option value={1}>{t({ message: 'Grind', context: 'relay function' })}</option>
              <option value={2} disabled className='text-gray-400'>
                {t`Steam Boiler (Coming Soon)`}
              </option>
            </select>
          </SettingsFormField>
        </div>
      </Section>
      {/* Temperature Settings */}
      <Section title={t`Temperature Settings`} className='h-full md:order-3'>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <InputGroupField
            label={t`Default Steam Temperature`}
            htmlFor='targetSteamTemp'
            unit='°C'
            unitAriaLabel={t`celsius`}
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
            label={t`Default Water Temperature`}
            htmlFor='targetWaterTemp'
            unit='°C'
            unitAriaLabel={t`celsius`}
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

      <HeaterCoordinationSection formData={formData} onChange={onChange} />
      {hardwareScaleAvailable.value && (
        <Section title={t`Scales`}>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            <SettingsFormField
              label={t`Preferred Scale Source`}
              htmlFor='preferredScaleSource'
              helpText={t`Choose which source to prefer when both hardware and Bluetooth scales are available.`}
              noMargin
            >
              <select
                id='preferredScaleSource'
                name='preferredScaleSource'
                className='select select-bordered w-full'
                value={formData.preferredScaleSource || 'auto'}
                onChange={onChange('preferredScaleSource')}
              >
                <option value='auto'>{t`Auto (Bluetooth when connected)`}</option>
                <option value='hardware'>{t`Prefer Hardware Scale (Built-in)`}</option>
                <option value='bluetooth'>{t`Prefer Bluetooth Scale`}</option>
              </select>
            </SettingsFormField>
          </div>

          <div className='border-base-content/5 mt-6 space-y-4 border-t pt-6'>
            <div>
              <h3 className='font-medium'>
                <Trans>Hardware Scale</Trans>
              </h3>
              <p className='text-base-content/60 mt-1 text-sm'>
                <Trans>
                  Configure acquisition and filtering, then tare and calibrate each load cell.
                </Trans>
              </p>
            </div>

            <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
              <SettingsFormField
                label={t`HX711 Sample Rate`}
                htmlFor='hardwareScaleSampleRateSps'
                helpText={t`Must match the physical RATE-jumper configuration on the HX711 board. This setting does not switch the RATE pin.`}
                noMargin
              >
                <select
                  id='hardwareScaleSampleRateSps'
                  name='hardwareScaleSampleRateSps'
                  className='select select-bordered w-full'
                  value={formData.hardwareScaleSampleRateSps || 10}
                  onChange={changeHardwareScaleSampleRate}
                >
                  <option value='10'>10 SPS</option>
                  <option value='80'>80 SPS</option>
                </select>
              </SettingsFormField>
              <SettingsFormField
                label={t`Idle Filter Alpha`}
                htmlFor='hardwareScaleIdleAlpha'
                helpText={t`Larger alpha responds faster with less smoothing; smaller alpha is smoother but slower.`}
                noMargin
              >
                <input
                  id='hardwareScaleIdleAlpha'
                  name='hardwareScaleIdleAlpha'
                  type='number'
                  className='input input-bordered w-full'
                  min='0.05'
                  max='1'
                  step='0.01'
                  value={formData.hardwareScaleIdleAlpha}
                  onChange={onChange('hardwareScaleIdleAlpha')}
                />
              </SettingsFormField>
              <SettingsFormField
                label={t`Brewing Filter Alpha`}
                htmlFor='hardwareScaleActiveAlpha'
                helpText={t`Larger alpha responds faster with less smoothing; smaller alpha is smoother but slower.`}
                noMargin
              >
                <input
                  id='hardwareScaleActiveAlpha'
                  name='hardwareScaleActiveAlpha'
                  type='number'
                  className='input input-bordered w-full'
                  min='0.05'
                  max='1'
                  step='0.01'
                  value={formData.hardwareScaleActiveAlpha}
                  onChange={onChange('hardwareScaleActiveAlpha')}
                />
              </SettingsFormField>
            </div>

            <p className='text-base-content/60 text-xs'>
              <Trans>
                A given alpha behaves faster in time at 80 SPS because it is applied more often.
                Tune the two alpha values independently for your installed sample rate. Changing
                sample rate resets both values to 0.80 at 10 SPS or 0.40 at 80 SPS as sensible
                starting points.
              </Trans>
            </p>

            <div>
              <h4 className='font-medium'>
                <Trans>Calibration</Trans>
              </h4>
              <p className='text-base-content/60 mt-1 text-sm'>
                <Trans>
                  Tare the scale, then place a known weight and calibrate each load cell.
                </Trans>
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
                <Trans>Tare</Trans>
              </button>
            </div>

            <SettingsFormField
              label={t`Actual Weight of Calibration Object`}
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
                disabled={!status.value?.hardwareScaleCell1Valid || !calibrationWeight}
              >
                <Trans>Calibrate Load Cell 1</Trans>
              </button>
              <button
                type='button'
                className='btn btn-primary btn-sm'
                onClick={() => calibrateLoadCell(2)}
                disabled={!status.value?.hardwareScaleCell2Valid || !calibrationWeight}
              >
                <Trans>Calibrate Load Cell 2</Trans>
              </button>
            </div>

            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
              <div>
                <p className='text-base-content/60 mb-1 text-xs'>
                  {t`Current:`}{' '}
                  {status.value?.hardwareScaleCell1Valid
                    ? `${status.value.hardwareScaleCell1Weight.toFixed(1)} g`
                    : t`Unavailable / uncalibrated`}
                </p>
                <SettingsFormField
                  label={t`Load Cell 1 Scale Factor`}
                  htmlFor='scaleFactor1'
                  noMargin
                >
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
              </div>
              <div>
                <p className='text-base-content/60 mb-1 text-xs'>
                  {t`Current:`}{' '}
                  {status.value?.hardwareScaleCell2Valid
                    ? `${status.value.hardwareScaleCell2Weight.toFixed(1)} g`
                    : t`Unavailable / uncalibrated`}
                </p>
                <SettingsFormField
                  label={t`Load Cell 2 Scale Factor`}
                  htmlFor='scaleFactor2'
                  noMargin
                >
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
          </div>
        </Section>
      )}

      <CleaningSection formData={formData} onChange={onChange} setField={setField} />

      {/* Alba Settings */}
      {ledControl.value && (
        <Section title={t`Alba Settings`} className='h-full'>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            <TankDistanceField
              id='emptyTankDistance'
              label={t`Distance from sensor to bottom of the tank`}
              value={formData.emptyTankDistance}
              error={tankErrorMessages[tankErrors.empty]}
              onChange={onChange('emptyTankDistance')}
              onUseCurrent={() => setField('emptyTankDistance', tofDistance.value)}
            />
            <TankDistanceField
              id='fullTankDistance'
              label={t`Distance from sensor to the fill line`}
              value={formData.fullTankDistance}
              error={tankErrorMessages[tankErrors.full]}
              onChange={onChange('fullTankDistance')}
              onUseCurrent={() => setField('fullTankDistance', tofDistance.value)}
            />
          </div>
          <div className='border-base-content/5 mt-6 grid grid-cols-1 gap-4 border-t pt-6 md:grid-cols-4'>
            <SunriseColorField
              id='sunriseIdle'
              label={t`Idle Color`}
              value={formData.sunriseIdle}
              fallback='#00ffff'
              onChange={onChange('sunriseIdle')}
            />
            <SunriseColorField
              id='sunriseActive'
              label={t`Brew Color`}
              value={formData.sunriseActive}
              fallback='#0000ff'
              onChange={onChange('sunriseActive')}
            />
            <SunriseColorField
              id='sunriseFinished'
              label={t`Finished Color`}
              value={formData.sunriseFinished}
              fallback='#00ff00'
              onChange={onChange('sunriseFinished')}
            />
            <SunriseColorField
              id='sunriseError'
              label={t`Error Color`}
              value={formData.sunriseError}
              fallback='#ff0000'
              onChange={onChange('sunriseError')}
            />
          </div>
          <SettingsFormField
            label={t`External LED (${extLedPct}%)`}
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
