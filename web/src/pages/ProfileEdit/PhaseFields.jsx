import { Trans, useLingui } from '@lingui/react/macro';

// Fields shared by the standard and extended phase editors.

export function UnitInputField({ id, label, unit, unitLabel, ...inputProps }) {
  return (
    <div>
      <label htmlFor={id} className='mb-2 block text-sm font-medium'>
        {label}
      </label>
      <div>
        <label htmlFor={id} className='input w-full'>
          <input id={id} className='grow' type='number' {...inputProps} />
          <span aria-label={unitLabel}>{unit}</span>
        </label>
      </div>
    </div>
  );
}

export function ToggleButton({ active, ...buttonProps }) {
  return (
    <button
      type='button'
      className={`join-item btn btn-sm ${active ? 'btn-primary' : 'btn-outline'}`}
      aria-pressed={active}
      {...buttonProps}
    />
  );
}

function ToggleGroupField({ legend, groupLabel, className = 'join', children }) {
  return (
    <div>
      <fieldset>
        <legend className='mb-2 block text-sm font-medium'>{legend}</legend>
        <div className={className} role='group' aria-label={groupLabel}>
          {children}
        </div>
      </fieldset>
    </div>
  );
}

// `children` is rendered next to the name input (e.g. a delete button).
export function PhaseTypeAndNameFields({ phase, index, onFieldChange, children }) {
  const { t } = useLingui();
  return (
    <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
      <div>
        <label htmlFor={`phase-${index}-type`} className='mb-2 block text-sm font-medium'>
          <Trans>Phase Type</Trans>
        </label>
        <select
          id={`phase-${index}-type`}
          className='select w-full'
          onChange={e => onFieldChange('phase', e.target.value)}
          value={phase.phase}
          aria-label={t`Select the type of brew phase`}
        >
          <option value='preinfusion'>
            <Trans>Pre-Infusion</Trans>
          </option>
          <option value='brew'>
            <Trans context='phase type'>Brew</Trans>
          </option>
        </select>
      </div>
      <div>
        <label htmlFor={`phase-${index}-name`} className='mb-2 block text-sm font-medium'>
          <Trans>Phase Name</Trans>
        </label>
        <div className='flex gap-2'>
          <input
            id={`phase-${index}-name`}
            className='input flex-1'
            placeholder={t`Name...`}
            value={phase.name}
            onChange={e => onFieldChange('name', e.target.value)}
            aria-label={t`Enter a name for this phase`}
          />
          {children}
        </div>
      </div>
    </div>
  );
}

export function PhaseDurationField({ phase, index, onFieldChange }) {
  const { t } = useLingui();
  return (
    <UnitInputField
      id={`phase-${index}-duration`}
      label={<Trans>Duration</Trans>}
      unit='s'
      unitLabel={t`seconds`}
      min='1'
      value={phase.duration}
      onChange={e => onFieldChange('duration', e.target.value)}
      aria-label={t`Duration in seconds`}
    />
  );
}

export function ValveField({ phase, onFieldChange }) {
  const { t } = useLingui();
  return (
    <ToggleGroupField legend={<Trans>Valve</Trans>} groupLabel={t`Valve state selection`}>
      <ToggleButton
        active={!phase.valve}
        onClick={() => onFieldChange('valve', 0)}
        aria-label={t`Valve closed`}
      >
        <Trans context='valve state'>Closed</Trans>
      </ToggleButton>
      <ToggleButton
        active={!!phase.valve}
        onClick={() => onFieldChange('valve', 1)}
        aria-label={t`Valve open`}
      >
        <Trans context='valve state'>Open</Trans>
      </ToggleButton>
    </ToggleGroupField>
  );
}

// Renders the Off and Power modes; `children` adds the pressure/flow modes.
export function PumpModeField({ mode, onFieldChange, className, children }) {
  const { t } = useLingui();
  return (
    <ToggleGroupField
      legend={<Trans>Pump Mode</Trans>}
      groupLabel={t`Pump mode selection`}
      className={className}
    >
      <ToggleButton
        active={mode === 'off'}
        onClick={() => onFieldChange('pump', 0)}
        aria-label={t`Pump off`}
      >
        <Trans context='pump mode'>Off</Trans>
      </ToggleButton>
      <ToggleButton
        active={mode === 'power'}
        onClick={() => mode !== 'power' && onFieldChange('pump', 100)}
        aria-label={t`Pump power mode`}
      >
        <Trans context='pump mode'>Power</Trans>
      </ToggleButton>
      {children}
    </ToggleGroupField>
  );
}

export function PumpPowerField({ index, value, onFieldChange }) {
  const { t } = useLingui();
  return (
    <UnitInputField
      id={`phase-${index}-power`}
      label={<Trans>Pump Power</Trans>}
      unit='%'
      unitLabel={t`percent`}
      step='1'
      min={0}
      max={100}
      value={value}
      onChange={e => onFieldChange('pump', parseFloat(e.target.value))}
      aria-label={t`Pump power as percentage`}
    />
  );
}

export function PumpPressureField({ phase, index, label, value, min, onFieldChange }) {
  const { t } = useLingui();
  return (
    <UnitInputField
      id={`phase-${index}-pressure`}
      label={label}
      unit='bar'
      unitLabel='bar'
      step='0.01'
      min={min}
      value={value}
      onChange={e => onFieldChange('pump', { ...phase.pump, pressure: parseFloat(e.target.value) })}
      aria-label={t`Pressure in bar`}
    />
  );
}

export function PumpFlowField({ phase, index, label, value, min, onFieldChange }) {
  const { t } = useLingui();
  return (
    <UnitInputField
      id={`phase-${index}-flow`}
      label={label}
      unit='g/s'
      unitLabel={t`grams per second`}
      step='0.01'
      min={min}
      value={value}
      onChange={e => onFieldChange('pump', { ...phase.pump, flow: parseFloat(e.target.value) })}
      aria-label={t`Flow rate in grams per second`}
    />
  );
}
