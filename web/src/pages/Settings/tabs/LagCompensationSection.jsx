import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useRef } from 'preact/hooks';
import Section from '../../../components/Card.jsx';
import { InputGroupField } from '../../../components/SettingsFormField.jsx';

// Brew-boiler lag compensation; every field 0 keeps the plain PID loop. Each value is 0 (off) or within
// [min, max]: the same ranges as lag_limits in lib/NanoPbComm/src/LagCompensationLimits.h, which the display and
// controller enforce too.
const FIELDS = [
  { key: 'modelHeaterW', unit: 'W', min: 200, max: 2500 },
  { key: 'modelHeatRate', unit: '°C/s', min: 0.05, max: 3 },
  { key: 'sensorDeadTimeS', unit: 's', min: 2, max: 60 },
  { key: 'waterDeadTimeS', unit: 's', min: 1, max: 60 },
  { key: 'derivativeFilterS', unit: 's', min: 0.5, max: 10 },
  { key: 'integralZone', unit: '°C', min: 0.5, max: 5 },
  { key: 'valveDumpMl', unit: 'ml', min: 0.5, max: 30 },
];
// Always shown: the heat-balance model. The PID refinements and the valve dump sit under Advanced.
const MAIN_KEYS = new Set(['modelHeaterW', 'modelHeatRate', 'sensorDeadTimeS', 'waterDeadTimeS']);

const inRangeOrOff = (value, min, max) => {
  const v = Number(value);
  return value === '' || v === 0 || (v >= min && v <= max);
};

// Values between 0 and the minimum are as silly as values above the maximum; block saving. The check follows the
// value itself, not just typing, so an import or Discard that changes it also clears or sets the error.
function RangeInput({ id, value, min, max, error, onChange }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.setCustomValidity(inRangeOrOff(ref.current.value, min, max) ? '' : error);
  }, [value, min, max, error]);
  return (
    <input
      ref={ref}
      id={id}
      name={id}
      type='number'
      step='any'
      min='0'
      max={max}
      className='grow'
      placeholder='0'
      value={value}
      onInput={e => e.target.setCustomValidity(inRangeOrOff(e.target.value, min, max) ? '' : error)}
      onChange={onChange}
    />
  );
}

export function LagCompensationSection({ formData, onChange }) {
  const { t } = useLingui();
  const labels = {
    modelHeaterW: t`Heater power`,
    modelHeatRate: t`Full-power heat-up rate`,
    sensorDeadTimeS: t`Delay from the heater switching on to the temperature starting to rise (about 20 s on a Silvia with the sensor on the boiler shell). With an integral zone set, the integral stays paused this long after water stops flowing.`,
    waterDeadTimeS: t`When the pump puts cold water into the boiler, the sensor takes a while to notice the boiler getting cooler. This is how long it takes. To measure it, wait until the temperature is steady, then run a 5 second flush. Afterwards, look at the temperature graph on the home page: note the temperature before the flush and the lowest it dropped to, and work out the temperature half way between them (from 93 °C down to 85 °C, half way is 89 °C). Count the seconds from the water starting until the line reached that temperature. On a Silvia that's about 12 seconds. 0 means use the sensor dead time.`,
    derivativeFilterS: t`Derivative filter`,
    integralZone: t`Integral zone`,
    valveDumpMl: t`Valve dump per flush`,
  };
  const help = {
    modelHeaterW: t`Element power from the machine's rating plate, e.g. 1100 W for a 230 V Rancilio Silvia.`,
    modelHeatRate: t`Steady temperature rise at full power, read off the middle of a warm-up from cold (about 0.6 °C/s on a Silvia).`,
    sensorDeadTimeS: t`Delay from the heater switching on to the temperature starting to rise (about 20 s on a Silvia with the sensor on the boiler shell).`,
    waterDeadTimeS: t`Time from water starting to flow until the temperature has dropped about half way; often shorter than the heater's (about 12 s on a Silvia). 0 uses the sensor dead time.`,
    derivativeFilterS: t`Smooths the D term so the thermocouple's 0.25 °C steps don't switch the heater on and off. Try 2 s; long filters delay its braking.`,
    integralZone: t`The integral only runs within this distance of the target, and pauses while water flows and for the dead time after, so a flush can't wind it up into an overshoot. Try 1.5 °C.`,
    valveDumpMl: t`Water the 3-way valve dumps into the drip tray when a flush or shot ends: weigh the tray after a flush. It leaves the boiler too. 0 counts none (about 5 ml on a Silvia).`,
  };
  const renderField = ({ key, unit, min, max }) => {
    const range = t`0 (off) or ${min}–${max} ${unit}`;
    const allowed = t`Allowed: ${range}.`;
    return (
      <InputGroupField
        key={key}
        label={labels[key]}
        htmlFor={key}
        unit={unit}
        helpText={`${help[key]} ${allowed}`}
        noMargin
      >
        <RangeInput
          id={key}
          value={formData[key] ?? 0}
          min={min}
          max={max}
          error={t`Use ${range}.`}
          onChange={onChange(key)}
        />
      </InputGroupField>
    );
  };
  const learnedLoss = Math.round(Number(formData.modelLossW) || 0);
  return (
    <Section title={t`Boiler Lag Compensation`}>
      <p className='mb-4 text-sm opacity-70'>
        <Trans>
          For boilers whose temperature sensor reacts long after the heater, like a sensor on the
          outside of the boiler. With heater power, heat-up rate and dead time set, the PID works on
          the measured temperature plus the heat still on its way to the sensor, so it stops heating
          in time instead of overshooting. Leave everything at 0 to keep the plain PID.
        </Trans>
      </p>
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        {FIELDS.filter(f => MAIN_KEYS.has(f.key)).map(renderField)}
      </div>
      <details className='border-base-content/10 mt-4 rounded-lg border p-3'>
        <summary className='cursor-pointer text-sm font-medium'>
          <Trans>Advanced</Trans>
        </summary>
        <div className='mt-4 grid grid-cols-1 gap-4 md:grid-cols-2'>
          {FIELDS.filter(f => !MAIN_KEYS.has(f.key)).map(renderField)}
        </div>
      </details>
      {learnedLoss > 0 && (
        <p className='mt-4 text-sm opacity-70'>
          <Trans>
            Learned standing heat loss: {learnedLoss} W. The predictor starts from this after a
            restart.
          </Trans>
        </p>
      )}
    </Section>
  );
}
