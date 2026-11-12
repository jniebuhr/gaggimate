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
import {
  PhaseDurationField,
  PhaseTypeAndNameFields,
  PumpFlowField,
  PumpModeField,
  PumpPowerField,
  PumpPressureField,
  ToggleButton,
  UnitInputField,
  ValveField,
} from './PhaseFields.jsx';

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
            {phases.length === 0 && (
              <p className='text-base-content/60 text-sm'>
                <Trans>No phases yet. Add a phase to configure brewing.</Trans>
              </p>
            )}
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
            disabled={saving || phases.length === 0}
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
          value,
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
      <PhaseTypeAndNameFields phase={phase} index={index} onFieldChange={onFieldChange}>
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
      </PhaseTypeAndNameFields>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <PhaseDurationField phase={phase} index={index} onFieldChange={onFieldChange} />
        <UnitInputField
          id={`phase-${index}-target`}
          label={<Trans>Volumetric Target</Trans>}
          unit='g'
          unitLabel={t`grams`}
          min='0'
          step='0.1'
          value={targetWeight}
          onChange={e => onVolumetricTargetChange(parseFloat(e.target.value))}
          aria-label={t`Target weight in grams`}
        />
      </div>

      <ValveField phase={phase} onFieldChange={onFieldChange} />

      <PumpModeField mode={mode} onFieldChange={onFieldChange}>
        {pressureAvailable && (
          <>
            <ToggleButton
              active={mode === 'pressure'}
              onClick={() =>
                mode !== 'pressure' &&
                onFieldChange('pump', {
                  target: 'pressure',
                  pressure: phase.pump?.pressure || 0,
                  flow: phase.pump?.flow || 0,
                })
              }
              aria-label={t`Pump pressure mode (PRO feature)`}
            >
              <Trans context='pump mode'>Pressure</Trans> <sup>PRO</sup>
            </ToggleButton>
            <ToggleButton
              active={mode === 'flow'}
              onClick={() =>
                mode !== 'flow' &&
                onFieldChange('pump', {
                  target: 'flow',
                  pressure: phase.pump?.pressure || 0,
                  flow: phase.pump?.flow || 0,
                })
              }
              aria-label={t`Pump flow mode (PRO feature)`}
            >
              <Trans context='pump mode'>Flow</Trans> <sup>PRO</sup>
            </ToggleButton>
          </>
        )}
      </PumpModeField>

      {mode === 'power' && (
        <PumpPowerField index={index} value={pumpPower} onFieldChange={onFieldChange} />
      )}

      {(mode === 'pressure' || mode === 'flow') && (
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <PumpPressureField
            phase={phase}
            index={index}
            label={mode === 'pressure' ? t`Pressure Target` : t`Pressure Limit`}
            value={pressure}
            min='0'
            onFieldChange={onFieldChange}
          />
          <PumpFlowField
            phase={phase}
            index={index}
            label={mode === 'flow' ? t`Flow Target` : t`Flow Limit`}
            value={flow}
            min='0'
            onFieldChange={onFieldChange}
          />
        </div>
      )}
    </div>
  );
}
