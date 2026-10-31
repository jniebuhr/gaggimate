import Card from '../../components/Card.jsx';
import { Spinner } from '../../components/Spinner.jsx';
import { isNumber } from 'chart.js/helpers';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons/faChevronDown';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons/faTrashCan';
import { Tooltip } from '../../components/Tooltip.jsx';
import { ProfileMainInformation } from './ProfileMainInformation.jsx';
import { getProfilePhases, removePhaseAt, updatePhaseAt } from './profilePhases.js';
import { Trans, useLingui } from '@lingui/react/macro';

export function StandardProfileForm(props) {
  const { t } = useLingui();
  const { data, onChange, onSave, saving = true, pressureAvailable = false } = props;
  const phases = getProfilePhases(data);

  const onFieldChange = (field, value) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  const onPhaseChange = (index, value) => {
    onChange({
      ...data,
      phases: updatePhaseAt(phases, index, value),
    });
  };

  const onPhaseAdd = () => {
    onChange({
      ...data,
      phases: [
        ...phases,
        {
          phase: 'brew',
          name: 'New Phase',
          pump: 100,
          valve: 1,
          duration: 0,
          targets: [],
        },
      ],
    });
  };

  const onPhaseRemove = index => {
    onChange({
      ...data,
      phases: removePhaseAt(phases, index),
    });
  };

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        onSave(data);
      }}
    >
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-10'>
        <ProfileMainInformation
          data={data}
          onChangeLabel={e => onFieldChange('label', e.target.value)}
          onChangeDescription={e => onFieldChange('description', e.target.value)}
          onChangeTemperature={e => onFieldChange('temperature', e.target.value)}
          onChangeUtility={e => onFieldChange('utility', !!e.target.checked)}
        />

        <Card sm={10} title={t`Brew Phases`}>
          <div className='space-y-4' role='group' aria-label={t`Brew phases configuration`}>
            {phases.map((value, index) => (
              <div key={index}>
                {index > 0 && (
                  <div className='flex flex-col items-center py-2' aria-hidden='true'>
                    <FontAwesomeIcon
                      icon={faChevronDown}
                      className='text-base-content/60 text-lg'
                    />
                  </div>
                )}
                <Phase
                  phase={value}
                  index={index}
                  onChange={phase => onPhaseChange(index, phase)}
                  onRemove={() => onPhaseRemove(index)}
                  pressureAvailable={pressureAvailable}
                />
              </div>
            ))}
            <div className='flex flex-row justify-center pt-4'>
              <button
                type='button'
                className='btn btn-outline gap-2'
                onClick={onPhaseAdd}
                aria-label={t`Add new brew phase`}
              >
                <FontAwesomeIcon icon={faPlus} />
                <span>
                  <Trans>Add phase</Trans>
                </span>
              </button>
            </div>
          </div>
        </Card>
      </div>

      <div className='pt-4 lg:col-span-10'>
        <div className='flex flex-col gap-2 sm:flex-row'>
          <a href='/profiles' className='btn btn-outline'>
            <Trans>Back</Trans>
          </a>
          <button
            type='submit'
            className='btn btn-primary gap-2'
            disabled={saving}
            aria-label={saving ? t`Saving profile...` : t`Save profile`}
          >
            <span>
              <Trans>Save</Trans>
            </span>
            {saving && <Spinner size={4} />}
          </button>
        </div>
      </div>
    </form>
  );
}

function Phase({ phase, index, onChange, onRemove, pressureAvailable }) {
  const { t } = useLingui();
  const onFieldChange = (field, value) => {
    onChange({
      ...phase,
      [field]: value,
    });
  };

  const onVolumetricTargetChange = value => {
    if (!Number.isFinite(value) || value <= 0) {
      onChange({
        ...phase,
        targets: [],
      });
      return;
    }
    onChange({
      ...phase,
      targets: [
        {
          type: 'volumetric',
          value: value,
        },
      ],
    });
  };

  const targets = phase?.targets || [];
  const volumetricTarget = targets.find(tg => tg.type === 'volumetric') || {};
  const phaseNumber = index + 1;
  const targetWeight = volumetricTarget?.value || 0;

  const pumpPower = isNumber(phase.pump) ? phase.pump : 100;
  const pressure = !isNumber(phase.pump) ? phase.pump.pressure : 0;
  const flow = !isNumber(phase.pump) ? phase.pump.flow : 0;
  const mode = isNumber(phase.pump) ? (phase.pump === 0 ? 'off' : 'power') : phase.pump.target;

  return (
    <div
      className='bg-base-200 border-base-300 space-y-4 rounded-lg border p-4'
      role='group'
      aria-label={t`Phase ${phaseNumber} configuration`}
    >
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <div className='form-control'>
          <label htmlFor={`phase-${index}-type`} className='mb-2 block text-sm font-medium'>
            <Trans>Phase Type</Trans>
          </label>
          <select
            id={`phase-${index}-type`}
            className='select select-bordered w-full'
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
        <div className='form-control'>
          <label htmlFor={`phase-${index}-name`} className='mb-2 block text-sm font-medium'>
            <Trans>Phase Name</Trans>
          </label>
          <div className='flex gap-2'>
            <input
              id={`phase-${index}-name`}
              className='input input-bordered flex-1'
              placeholder={t`Name...`}
              value={phase.name}
              onChange={e => onFieldChange('name', e.target.value)}
              aria-label={t`Enter a name for this phase`}
            />
            <Tooltip content={t`Delete this phase`}>
              <button
                type='button'
                onClick={onRemove}
                className='btn btn-sm btn-ghost text-error'
                aria-label={t`Delete phase ${phaseNumber}`}
              >
                <FontAwesomeIcon icon={faTrashCan} />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <div className='form-control'>
          <label htmlFor={`phase-${index}-duration`} className='mb-2 block text-sm font-medium'>
            <Trans>Duration</Trans>
          </label>
          <div className='input-group'>
            <label htmlFor={`phase-${index}-duration`} className='input w-full'>
              <input
                id={`phase-${index}-duration`}
                className='grow'
                type='number'
                min='1'
                value={phase.duration}
                onChange={e => onFieldChange('duration', e.target.value)}
                aria-label={t`Duration in seconds`}
              />
              <span aria-label={t`seconds`}>s</span>
            </label>
          </div>
        </div>
        <div className='form-control'>
          <label htmlFor={`phase-${index}-target`} className='mb-2 block text-sm font-medium'>
            <Trans>Volumetric Target</Trans>
          </label>
          <div className='input-group'>
            <label htmlFor={`phase-${index}-target`} className='input w-full'>
              <input
                id={`phase-${index}-target`}
                className='grow'
                type='number'
                value={targetWeight}
                onChange={e => onVolumetricTargetChange(parseFloat(e.target.value))}
                aria-label={t`Target weight in grams`}
                min='0'
                step='0.1'
              />
              <span aria-label={t`grams`}>g</span>
            </label>
          </div>
        </div>
      </div>

      <div className='form-control'>
        <fieldset>
          <legend className='mb-2 block text-sm font-medium'>
            <Trans>Valve</Trans>
          </legend>
          <div className='join' role='group' aria-label={t`Valve state selection`}>
            <button
              type='button'
              className={`join-item btn btn-sm ${!phase.valve ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => onFieldChange('valve', 0)}
              aria-pressed={!phase.valve}
              aria-label={t`Valve closed`}
            >
              <Trans context='valve state'>Closed</Trans>
            </button>
            <button
              type='button'
              className={`join-item btn btn-sm ${phase.valve ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => onFieldChange('valve', 1)}
              aria-pressed={phase.valve}
              aria-label={t`Valve open`}
            >
              <Trans context='valve state'>Open</Trans>
            </button>
          </div>
        </fieldset>
      </div>

      <div className='form-control'>
        <fieldset>
          <legend className='mb-2 block text-sm font-medium'>
            <Trans>Pump Mode</Trans>
          </legend>
          <div className='join' role='group' aria-label={t`Pump mode selection`}>
            <button
              type='button'
              className={`join-item btn btn-sm ${mode === 'off' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => onFieldChange('pump', 0)}
              aria-pressed={mode === 'off'}
              aria-label={t`Pump off`}
            >
              <Trans context='pump mode'>Off</Trans>
            </button>
            <button
              type='button'
              className={`join-item btn btn-sm ${mode === 'power' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => mode !== 'power' && onFieldChange('pump', 100)}
              aria-pressed={mode === 'power'}
              aria-label={t`Pump power mode`}
            >
              <Trans context='pump mode'>Power</Trans>
            </button>
            {pressureAvailable && (
              <>
                <button
                  type='button'
                  className={`join-item btn btn-sm ${mode === 'pressure' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() =>
                    mode !== 'pressure' &&
                    onFieldChange('pump', {
                      target: 'pressure',
                      pressure: phase.pump?.pressure || 0,
                      flow: phase.pump?.flow || 0,
                    })
                  }
                  aria-pressed={mode === 'pressure'}
                  aria-label={t`Pump pressure mode (PRO feature)`}
                >
                  <Trans context='pump mode'>Pressure</Trans> <sup>PRO</sup>
                </button>
                <button
                  type='button'
                  className={`join-item btn btn-sm ${mode === 'flow' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() =>
                    mode !== 'flow' &&
                    onFieldChange('pump', {
                      target: 'flow',
                      pressure: phase.pump?.pressure || 0,
                      flow: phase.pump?.flow || 0,
                    })
                  }
                  aria-pressed={mode === 'flow'}
                  aria-label={t`Pump flow mode (PRO feature)`}
                >
                  <Trans context='pump mode'>Flow</Trans> <sup>PRO</sup>
                </button>
              </>
            )}
          </div>
        </fieldset>
      </div>

      {mode === 'power' && (
        <div className='form-control'>
          <label htmlFor={`phase-${index}-power`} className='mb-2 block text-sm font-medium'>
            <Trans>Pump Power</Trans>
          </label>
          <div className='input-group'>
            <label htmlFor={`phase-${index}-power`} className='input w-full'>
              <input
                id={`phase-${index}-power`}
                className='grow'
                type='number'
                step='1'
                min={0}
                max={100}
                value={pumpPower}
                onChange={e => onFieldChange('pump', parseFloat(e.target.value))}
                aria-label={t`Pump power as percentage`}
              />
              <span aria-label={t`percent`}>%</span>
            </label>
          </div>
        </div>
      )}

      {(mode === 'pressure' || mode === 'flow') && (
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <div className='form-control'>
            <label htmlFor={`phase-${index}-pressure`} className='mb-2 block text-sm font-medium'>
              {mode === 'pressure' ? t`Pressure Target` : t`Pressure Limit`}
            </label>
            <div className='input-group'>
              <label htmlFor={`phase-${index}-pressure`} className='input w-full'>
                <input
                  id={`phase-${index}-pressure`}
                  className='grow'
                  type='number'
                  step='0.01'
                  value={pressure}
                  onChange={e =>
                    onFieldChange('pump', { ...phase.pump, pressure: parseFloat(e.target.value) })
                  }
                  aria-label={t`Pressure in bar`}
                  min='0'
                />
                <span aria-label='bar'>bar</span>
              </label>
            </div>
          </div>
          <div className='form-control'>
            <label htmlFor={`phase-${index}-flow`} className='mb-2 block text-sm font-medium'>
              {mode === 'flow' ? t`Flow Target` : t`Flow Limit`}
            </label>
            <div className='input-group'>
              <label htmlFor={`phase-${index}-flow`} className='input w-full'>
                <input
                  id={`phase-${index}-flow`}
                  className='grow'
                  type='number'
                  step='0.01'
                  value={flow}
                  onChange={e =>
                    onFieldChange('pump', { ...phase.pump, flow: parseFloat(e.target.value) })
                  }
                  aria-label={t`Flow rate in grams per second`}
                  min='0'
                />
                <span aria-label={t`grams per second`}>g/s</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
