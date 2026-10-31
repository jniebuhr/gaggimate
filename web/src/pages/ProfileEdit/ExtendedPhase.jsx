import { ExtendedPhaseTarget, TargetTypes } from './ExtendedPhaseTarget.jsx';
import { isNumber } from 'chart.js/helpers';
import { useCallback } from 'preact/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { Tooltip } from '../../components/Tooltip.jsx';
import { Trans, useLingui } from '@lingui/react/macro';

export function ExtendedPhase({ phase, index, onChange, onRemove, pressureAvailable }) {
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
          <label htmlFor={`phase-${index}-temperature`} className='mb-2 block text-sm font-medium'>
            <Trans>Temperature (0 = Default)</Trans>
          </label>
          <div className='input-group'>
            <label htmlFor={`phase-${index}-temperature`} className='input w-full'>
              <input
                id={`phase-${index}-target`}
                className='grow'
                type='number'
                value={`${phase.temperature || 0}`}
                onChange={e => onFieldChange('temperature', parseFloat(e.target.value))}
                aria-label={t`Target temperature`}
                min='0'
                step='0.1'
              />
              <span aria-label={t`celsius`}>°C</span>
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
          <div
            className='join max-sm:join-vertical min-w-[50%]'
            role='group'
            aria-label={t`Pump mode selection`}
          >
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
                      pressure: Math.max(phase.pump.pressure || 0, 0),
                      flow: Math.max(phase.pump?.flow || 0, 0),
                    })
                  }
                  aria-pressed={mode === 'pressure'}
                  aria-label={t`Pump pressure mode`}
                >
                  <Trans context='pump mode'>Pressure</Trans>
                </button>
                <button
                  type='button'
                  className={`join-item btn btn-sm ${mode === 'flow' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() =>
                    mode !== 'flow' &&
                    onFieldChange('pump', {
                      target: 'flow',
                      pressure: Math.max(phase.pump.pressure || 0, 0),
                      flow: Math.max(phase.pump?.flow || 0, 0),
                    })
                  }
                  aria-pressed={mode === 'flow'}
                  aria-label={t`Pump flow mode`}
                >
                  <Trans context='pump mode'>Flow</Trans>
                </button>
                <button
                  type='button'
                  className={`join-item btn btn-sm ${mode === 'hold-pressure' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() =>
                    mode !== 'hold-pressure' &&
                    onFieldChange('pump', {
                      target: 'pressure',
                      pressure: -1,
                      flow: Math.max(phase.pump?.flow || 0, 0),
                    })
                  }
                  aria-pressed={mode === 'hold-pressure'}
                  aria-label={t`Pump Maintain pressure mode`}
                >
                  <Trans>Maintain Pressure</Trans>
                </button>
                <button
                  type='button'
                  className={`join-item btn btn-sm ${mode === 'hold-flow' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() =>
                    mode !== 'hold-flow' &&
                    onFieldChange('pump', {
                      target: 'flow',
                      pressure: Math.max(phase.pump.pressure || 0, 0),
                      flow: -1,
                    })
                  }
                  aria-pressed={mode === 'hold-flow'}
                  aria-label={t`Pump Maintain flow mode`}
                >
                  <Trans>Maintain Flow</Trans>
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
                value={pumpPower.toString()}
                onChange={e => onFieldChange('pump', parseFloat(e.target.value))}
                aria-label={t`Pump power as percentage`}
              />
              <span aria-label={t`percent`}>%</span>
            </label>
          </div>
        </div>
      )}

      {(mode === 'pressure' ||
        mode === 'flow' ||
        mode === 'hold-pressure' ||
        mode === 'hold-flow') && (
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          {mode !== 'hold-pressure' && (
            <div className='form-control'>
              <label htmlFor={`phase-${index}-pressure`} className='mb-2 block text-sm font-medium'>
                {mode === 'pressure'
                  ? t`Target Pressure`
                  : mode === 'flow'
                    ? t`Maximum Pressure (0 = Ignore)`
                    : t`Maximum Pressure`}
              </label>
              <div className='input-group'>
                <label htmlFor={`phase-${index}-pressure`} className='input w-full'>
                  <input
                    id={`phase-${index}-pressure`}
                    className='grow'
                    type='number'
                    step='0.01'
                    min={mode === 'pressure' ? '0.1' : '0'}
                    value={pressure.toString()}
                    onChange={e =>
                      onFieldChange('pump', { ...phase.pump, pressure: parseFloat(e.target.value) })
                    }
                    aria-label={t`Pressure in bar`}
                  />
                  <span aria-label='bar'>bar</span>
                </label>
              </div>
            </div>
          )}
          {mode !== 'hold-flow' && (
            <div className='form-control'>
              <label htmlFor={`phase-${index}-flow`} className='mb-2 block text-sm font-medium'>
                {mode === 'flow'
                  ? t`Target Flow`
                  : mode === 'pressure'
                    ? t`Maximum Flow (0 = Ignore)`
                    : t`Maximum Flow`}
              </label>
              <div className='input-group'>
                <label htmlFor={`phase-${index}-flow`} className='input w-full'>
                  <input
                    id={`phase-${index}-flow`}
                    className='grow'
                    type='number'
                    step='0.01'
                    value={flow.toString()}
                    onChange={e =>
                      onFieldChange('pump', { ...phase.pump, flow: parseFloat(e.target.value) })
                    }
                    aria-label={t`Flow rate in grams per second`}
                    min={mode === 'flow' ? '0.1' : '0'}
                  />
                  <span aria-label={t`grams per second`}>g/s</span>
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      <div className='grid grid-cols-1 gap-4'>
        <div className='form-control'>
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
            <div className='form-control'>
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
            <div className='form-control'>
              <label
                htmlFor={`phase-${index}-transition-duration`}
                className='mb-2 block text-sm font-medium'
              >
                <Trans>Ramp Length</Trans>
              </label>
              <div className='input-group'>
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
            <div className='form-control'>
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
                    className={`join-item btn btn-sm ${!!phase.transition?.adaptive ? 'btn-primary' : 'btn-outline'}`}
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
                  onClick={e =>
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
        <>
          {idx !== 0 && (
            <div key={`sep-${idx}`} className='divider'>
              <Trans context='stop condition separator'>OR</Trans>
            </div>
          )}
          <ExtendedPhaseTarget
            onChange={value => onTargetChange(idx, value)}
            onRemove={() => onTargetRemove(idx)}
            key={`target-${idx}`}
            target={target}
            index={idx}
          />
        </>
      ))}
    </div>
  );
}
