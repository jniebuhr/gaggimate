import { ExtendedPhaseTarget, TargetTypes } from './ExtendedPhaseTarget.jsx';
import { isNumber } from 'chart.js/helpers';
import { Fragment } from 'preact';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { Tooltip } from '../../components/Tooltip.jsx';
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

export function ExtendedPhase({ phase, index, onChange, pressureAvailable }) {
  const { t, i18n } = useLingui();
  const onFieldChange = (field, value) => {
    onChange({
      ...phase,
      [field]: value,
    });
  };

  const onTargetChange = (index, value) => {
    const newPhase = {
      ...phase,
    };
    newPhase.targets[index] = value;
    onChange(newPhase);
  };

  const onTargetRemove = index => {
    const newPhase = {
      ...phase,
      targets: [],
    };
    for (let i = 0; i < phase.targets.length; i++) {
      if (i !== index) {
        newPhase.targets.push(phase.targets[i]);
      }
    }
    onChange(newPhase);
  };

  const onTargetAdd = target => {
    onChange({
      ...phase,
      targets: [...(phase.targets || []), target],
    });
  };

  const targets = phase?.targets || [];

  const pumpPower = isNumber(phase.pump) ? phase.pump : 100;
  const pressure = !isNumber(phase.pump) ? phase.pump.pressure : 0;
  const flow = !isNumber(phase.pump) ? phase.pump.flow : 0;
  let mode = isNumber(phase.pump) ? (phase.pump === 0 ? 'off' : 'power') : phase.pump.target;
  if (mode === 'pressure' && phase.pump.pressure === -1) mode = 'hold-pressure';
  if (mode === 'flow' && phase.pump.flow === -1) mode = 'hold-flow';
  const availableTargetTypes = TargetTypes.filter(
    tt => !targets.find(t2 => t2.type === tt.type && t2.operator === tt.operator),
  );
  const phaseNumber = index + 1;

  let rampUnit = 's';
  if (phase.transition?.target === 'volumetric') rampUnit = 'g';
  if (phase.transition?.target === 'pumped') rampUnit = 'ml';

  return (
    <div
      className='grid grid-cols-1 gap-2 p-2'
      role='group'
      aria-label={t`Phase ${phaseNumber} configuration`}
    >
      <PhaseTypeAndNameFields phase={phase} index={index} onFieldChange={onFieldChange} />

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <PhaseDurationField phase={phase} index={index} onFieldChange={onFieldChange} />
        <UnitInputField
          id={`phase-${index}-temperature`}
          label={<Trans>Temperature (0 = Default)</Trans>}
          unit='°C'
          unitLabel={t`celsius`}
          min='0'
          step='0.1'
          value={`${phase.temperature || 0}`}
          onChange={e => onFieldChange('temperature', parseFloat(e.target.value))}
          aria-label={t`Target temperature`}
        />
      </div>

      <ValveField phase={phase} onFieldChange={onFieldChange} />

      <PumpModeField
        mode={mode}
        onFieldChange={onFieldChange}
        className='join max-sm:join-vertical min-w-[50%]'
      >
        {pressureAvailable && (
          <>
            <ToggleButton
              active={mode === 'pressure'}
              onClick={() =>
                mode !== 'pressure' &&
                onFieldChange('pump', {
                  target: 'pressure',
                  pressure: Math.max(phase.pump.pressure || 0, 0),
                  flow: Math.max(phase.pump?.flow || 0, 0),
                })
              }
              aria-label={t`Pump pressure mode`}
            >
              <Trans context='pump mode'>Pressure</Trans>
            </ToggleButton>
            <ToggleButton
              active={mode === 'flow'}
              onClick={() =>
                mode !== 'flow' &&
                onFieldChange('pump', {
                  target: 'flow',
                  pressure: Math.max(phase.pump.pressure || 0, 0),
                  flow: Math.max(phase.pump?.flow || 0, 0),
                })
              }
              aria-label={t`Pump flow mode`}
            >
              <Trans context='pump mode'>Flow</Trans>
            </ToggleButton>
            <ToggleButton
              active={mode === 'hold-pressure'}
              onClick={() =>
                mode !== 'hold-pressure' &&
                onFieldChange('pump', {
                  target: 'pressure',
                  pressure: -1,
                  flow: Math.max(phase.pump?.flow || 0, 0),
                })
              }
              aria-label={t`Pump Maintain pressure mode`}
            >
              <Trans>Maintain Pressure</Trans>
            </ToggleButton>
            <ToggleButton
              active={mode === 'hold-flow'}
              onClick={() =>
                mode !== 'hold-flow' &&
                onFieldChange('pump', {
                  target: 'flow',
                  pressure: Math.max(phase.pump.pressure || 0, 0),
                  flow: -1,
                })
              }
              aria-label={t`Pump Maintain flow mode`}
            >
              <Trans>Maintain Flow</Trans>
            </ToggleButton>
          </>
        )}
      </PumpModeField>

      {mode === 'power' && (
        <PumpPowerField index={index} value={pumpPower.toString()} onFieldChange={onFieldChange} />
      )}

      {(mode === 'pressure' ||
        mode === 'flow' ||
        mode === 'hold-pressure' ||
        mode === 'hold-flow') && (
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          {mode !== 'hold-pressure' && (
            <PumpPressureField
              phase={phase}
              index={index}
              label={
                mode === 'pressure'
                  ? t`Target Pressure`
                  : mode === 'flow'
                    ? t`Maximum Pressure (0 = Ignore)`
                    : t`Maximum Pressure`
              }
              value={pressure.toString()}
              min={mode === 'pressure' ? '0.1' : '0'}
              onFieldChange={onFieldChange}
            />
          )}
          {mode !== 'hold-flow' && (
            <PumpFlowField
              phase={phase}
              index={index}
              label={
                mode === 'flow'
                  ? t`Target Flow`
                  : mode === 'pressure'
                    ? t`Maximum Flow (0 = Ignore)`
                    : t`Maximum Flow`
              }
              value={flow.toString()}
              min={mode === 'flow' ? '0.1' : '0'}
              onFieldChange={onFieldChange}
            />
          )}
        </div>
      )}

      <div className='grid grid-cols-1 gap-4'>
        <div>
          <fieldset>
            <legend className='mb-2 block text-sm font-medium'>
              <Trans>Ramp Style</Trans>
            </legend>
            <div
              className='join max-sm:join-vertical min-w-[50%]'
              role='group'
              aria-label={t`Ramp style selection`}
            >
              <button
                type='button'
                className={`join-item btn btn-sm ${(phase.transition?.type || 'instant') === 'instant' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() =>
                  onFieldChange('transition', { ...phase.transition, type: 'instant', duration: 0 })
                }
                aria-pressed={mode === 'off'}
                aria-label={t({ message: 'Instant', context: 'ramp style' })}
              >
                <Trans context='ramp style'>Instant</Trans>
              </button>
              <button
                type='button'
                className={`join-item btn btn-sm ${phase.transition?.type === 'linear' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => onFieldChange('transition', { ...phase.transition, type: 'linear' })}
                aria-pressed={phase.transition?.type === 'linear'}
                aria-label={t({ message: 'Linear', context: 'ramp style' })}
              >
                <Trans context='ramp style'>Linear</Trans>
              </button>
              <button
                type='button'
                className={`join-item btn btn-sm ${phase.transition?.type === 'ease-in' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() =>
                  onFieldChange('transition', { ...phase.transition, type: 'ease-in' })
                }
                aria-pressed={phase.transition?.type === 'ease-in'}
                aria-label={t`Ease In`}
              >
                <Trans>Ease In</Trans>
              </button>
              <button
                type='button'
                className={`join-item btn btn-sm ${phase.transition?.type === 'ease-out' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() =>
                  onFieldChange('transition', { ...phase.transition, type: 'ease-out' })
                }
                aria-pressed={phase.transition?.type === 'ease-out'}
                aria-label={t`Ease Out`}
              >
                <Trans>Ease Out</Trans>
              </button>
              <button
                type='button'
                className={`join-item btn btn-sm ${phase.transition?.type === 'ease-in-out' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() =>
                  onFieldChange('transition', { ...phase.transition, type: 'ease-in-out' })
                }
                aria-pressed={phase.transition?.type === 'ease-in-out'}
                aria-label={t`Ease In Out`}
              >
                <Trans>Ease In Out</Trans>
              </button>
            </div>
          </fieldset>
        </div>
      </div>
      {phase.transition?.type !== 'instant' && (
        <>
          <div className='grid grid-cols-1 gap-4'>
            <div>
              <fieldset>
                <legend className='mb-2 block text-sm font-medium'>
                  <Trans>Ramp Target</Trans>
                </legend>
                <div
                  className='join max-sm:join-vertical min-w-[50%]'
                  role='group'
                  aria-label={t`Ramp target selection`}
                >
                  <button
                    type='button'
                    className={`join-item btn btn-sm ${(phase.transition?.target || 'time') === 'time' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() =>
                      onFieldChange('transition', { ...phase.transition, target: 'time' })
                    }
                    aria-pressed={(phase.transition?.target || 'time') === 'time'}
                    aria-label={t({ message: 'Time', context: 'ramp target' })}
                  >
                    <Trans context='ramp target'>Time</Trans>
                  </button>
                  <button
                    type='button'
                    className={`join-item btn btn-sm ${phase.transition?.target === 'volumetric' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() =>
                      onFieldChange('transition', { ...phase.transition, target: 'volumetric' })
                    }
                    aria-pressed={phase.transition?.target === 'volumetric'}
                    aria-label={t`Weight in phase`}
                  >
                    <Trans>Weight in phase</Trans>
                  </button>
                  <button
                    type='button'
                    className={`join-item btn btn-sm ${phase.transition?.target === 'pumped' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() =>
                      onFieldChange('transition', { ...phase.transition, target: 'pumped' })
                    }
                    aria-pressed={phase.transition?.target === 'pumped'}
                    aria-label={t`Water pumped`}
                  >
                    <Trans>Water pumped in phase</Trans>
                  </button>
                </div>
              </fieldset>
            </div>
          </div>
          <div className='grid grid-cols-1 gap-4'>
            <div>
              <label
                htmlFor={`phase-${index}-transition-duration`}
                className='mb-2 block text-sm font-medium'
              >
                <Trans>Ramp Length</Trans>
              </label>
              <div>
                <label htmlFor={`phase-${index}-transition-duration`} className='input w-full'>
                  <input
                    id={`phase-${index}-transition-duration`}
                    className='grow'
                    type='number'
                    value={phase.transition?.duration || 0}
                    onChange={e =>
                      onFieldChange('transition', {
                        ...phase.transition,
                        duration: parseFloat(e.target.value),
                      })
                    }
                    aria-label={t`Transition duration in ${rampUnit}`}
                    min='0'
                    step='0.1'
                  />
                  <span aria-label={rampUnit}>{rampUnit}</span>
                </label>
              </div>
            </div>
            <div>
              <fieldset>
                <legend className='mb-2 block text-sm font-medium'>
                  <Trans>Start Ramp from</Trans>
                </legend>
                <div className='join' role='group' aria-label={t`Start Ramp from`}>
                  <button
                    type='button'
                    className={`join-item btn btn-sm ${!phase.transition?.adaptive ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() =>
                      onFieldChange('transition', { ...phase.transition, adaptive: false })
                    }
                    aria-pressed={!phase.transition?.adaptive}
                    aria-label={t`Start from previous setpoint`}
                  >
                    <Trans>Previous target</Trans>
                  </button>
                  <button
                    type='button'
                    className={`join-item btn btn-sm ${phase.transition?.adaptive ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() =>
                      onFieldChange('transition', { ...phase.transition, adaptive: true })
                    }
                    aria-pressed={!!phase.transition?.adaptive}
                    aria-label={t({ message: 'Linear', context: 'ramp style' })}
                  >
                    <Trans>Current value</Trans>
                  </button>
                </div>
              </fieldset>
            </div>
          </div>
        </>
      )}

      <div className='mt-2 flex flex-row gap-4'>
        <h3 className='text-lg font-medium'>
          <Trans>Stop when</Trans>
        </h3>
        <div className='dropdown'>
          <Tooltip content={t`Add stop condition`}>
            <div
              tabIndex='0'
              role='button'
              className='join-item btn btn-sm btn-outline'
              aria-label={t`Add target`}
            >
              <FontAwesomeIcon icon={faPlus} />
            </div>
          </Tooltip>
          <ul
            tabIndex='0'
            className='menu dropdown-content bg-base-100 rounded-box z-1 w-52 p-2 shadow-sm'
          >
            {availableTargetTypes.map(tt => (
              <li key={`${tt.type}-${tt.operator}`}>
                <span
                  role='button'
                  onClick={() =>
                    onTargetAdd({
                      type: tt.type,
                      operator: tt.operator,
                      value: 0,
                    })
                  }
                >
                  {i18n._(tt.label)}
                </span>
              </li>
            ))}
            {availableTargetTypes.length === 0 && (
              <li className='italic'>
                <a>
                  <Trans>No more types available</Trans>
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>
      {targets.map((target, idx) => (
        <Fragment key={`${target.type}-${target.operator || 'gte'}`}>
          {idx !== 0 && (
            <div className='divider'>
              <Trans context='stop condition separator'>OR</Trans>
            </div>
          )}
          <ExtendedPhaseTarget
            onChange={value => onTargetChange(idx, value)}
            onRemove={() => onTargetRemove(idx)}
            target={target}
            index={idx}
          />
        </Fragment>
      ))}
    </div>
  );
}
