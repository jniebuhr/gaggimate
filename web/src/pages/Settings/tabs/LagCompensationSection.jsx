import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useRef } from 'preact/hooks';
import Section from '../../../components/Card.jsx';
import { InputGroupField } from '../../../components/SettingsFormField.jsx';

// Brew-boiler lag compensation; every field 0 keeps the plain PID loop. Each value is 0 (off) or within
// [min, max]: the same ranges as lag_limits in lib/NanoPbComm/src/LagCompensationLimits.h, which the display and
// controller enforce too.
const FIELDS = [
  { key: 'derivativeFilterS', unit: 's', min: 0.5, max: 10 },
  { key: 'integralZone', unit: '°C', min: 0.5, max: 5 },
  { key: 'sensorDeadTimeS', unit: 's', min: 2, max: 60 },
];

// What a number input can display: a padded or otherwise odd string (e.g. " 1100 " from an import) would show as
// blank there while Number() still accepts it.
const NUMBER_RE = /^-?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/;
const inRangeOrOff = (value, min, max) => {
  if (value === '' || value == null) return true;
  if (typeof value === 'string' && !NUMBER_RE.test(value)) return false;
  const v = Number(value);
  return v === 0 || (v >= min && v <= max);
};

// First lag field whose value is out of range, or null. The save handler checks this too: imports and Save & Restart
// skip the inputs' own validation, and the inputs aren't mounted off the Machine tab.
export const invalidLagField = formData =>
  FIELDS.find(({ key, min, max }) => !inRangeOrOff(formData[key], min, max))?.key ?? null;

// Values between 0 and the minimum are as silly as values above the maximum; block saving. The check follows the
// value itself, not just typing, so an import or Discard that changes it also clears or sets the error.
function RangeInput({ id, value, min, max, error, onChange }) {
  const ref = useRef(null);
  useEffect(() => {
    // The prop, not the input's own value: a number input blanks non-numbers like an imported "abc".
    ref.current?.setCustomValidity(inRangeOrOff(value, min, max) ? '' : error);
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
    sensorDeadTimeS: t`Sensor dead time`,
    derivativeFilterS: t`Derivative filter`,
    integralZone: t`Integral zone`,
  };
  const help = {
    sensorDeadTimeS: t`Delay from the heater switching on to the temperature starting to rise (about 20 s on a Silvia with the sensor on the boiler shell). With an integral zone set, the integral stays paused this long after water stops flowing.`,
    derivativeFilterS: t`Smooths the D term so the thermocouple's 0.25 °C steps don't switch the heater on and off. Try 2 s; long filters delay its braking.`,
    integralZone: t`The integral only runs within this distance of the target, and pauses while water flows and for the dead time after, so a flush can't wind it up into an overshoot. Try 1.5 °C.`,
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
  return (
    <Section title={t`Boiler Lag Compensation`}>
      <p className='mb-4 text-sm opacity-70'>
        <Trans>
          For boilers whose temperature sensor reacts long after the heater, like a sensor on the
          outside of the boiler. These keep the PID from overreacting to a slow, stepped reading and
          from winding up its integral during a flush. Leave everything at 0 to keep the plain PID.
        </Trans>
      </p>
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>{FIELDS.map(renderField)}</div>
    </Section>
  );
}
