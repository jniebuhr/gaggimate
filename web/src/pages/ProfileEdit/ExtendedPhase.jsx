import { ExtendedPhaseTarget } from './ExtendedPhaseTarget.jsx';
import { isNumber } from 'chart.js/helpers';
import { useCallback } from 'preact/hooks';
import { t } from '@lingui/core/macro';

export function ExtendedPhase({ phase, index, onChange, onRemove, pressureAvailable }) {
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

  const onTargetAdd = () => {
    onChange({
      ...phase,
      targets: [
        ...(phase.targets || []),
        {
          type: 'volumetric',
          operator: 'gte',
          value: 0,
        },
      ],
    });
  };

  const targets = phase?.targets || [];

  const pumpPower = isNumber(phase.pump) ? phase.pump : 100;
  const pressure = !isNumber(phase.pump) ? phase.pump.pressure : 0;
  const flow = !isNumber(phase.pump) ? phase.pump.flow : 0;
  const mode = isNumber(phase.pump) ? (phase.pump === 0 ? 'off' : 'power') : phase.pump.target;

  return (
    <div
      className='grid grid-cols-1 gap-2 p-2'
      role='group'
      aria-label={t`Phase ${index + 1} configuration`}
    >
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <div className='form-control'>
          <label htmlFor={`phase-${index}-type`} className='mb-2 block text-sm font-medium'>
            {t`Phase Type`}
          </label>
          <select
            id={`phase-${index}-type`}
            className='select select-bordered w-full'
            onChange={e => onFieldChange('phase', e.target.value)}
            value={phase.phase}
            aria-label={t`Select the type of brew phase`}
          >
            <option value='preinfusion'>{t`Pre-Infusion`}</option>
            <option value='brew'>{t`Brew`}</option>
          </select>
        </div>
        <div className='form-control'>
          <label htmlFor={`phase-${index}-name`} className='mb-2 block text-sm font-medium'>
            {t`Phase Name`}
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
            {t`Duration`}
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
            {t`Temperature (0 = Default)`}
          </label>
          <div className='input-group'>
            <label htmlFor={`phase-${index}-temperature`} className='input w-full'>
              <input
                id={`phase-${index}-target`}
                className='grow'
                type='number'
                value={phase.temperature || 0}
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
          <legend className='mb-2 block text-sm font-medium'>{t`Valve`}</legend>
          <div className='join' role='group' aria-label={t`Valve state selection`}>
            <button
              type='button'
              className={`join-item btn btn-sm ${!phase.valve ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => onFieldChange('valve', 0)}
              aria-pressed={!phase.valve}
              aria-label={t`Valve closed`}
            >
              {t`Closed`}
            </button>
            <button
              type='button'
              className={`join-item btn btn-sm ${phase.valve ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => onFieldChange('valve', 1)}
              aria-pressed={phase.valve}
              aria-label={t`Valve open`}
            >
              {t`Open`}
            </button>
          </div>
        </fieldset>
      </div>

      <div className='form-control'>
        <fieldset>
          <legend className='mb-2 block text-sm font-medium'>{t`Pump Mode`}</legend>
          <div className='join' role='group' aria-label={t`Pump mode selection`}>
            <button
              type='button'
              className={`join-item btn btn-sm ${mode === 'off' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => onFieldChange('pump', 0)}
              aria-pressed={mode === 'off'}
              aria-label={t`Pump off`}
            >
              {t`Off`}
            </button>
            <button
              type='button'
              className={`join-item btn btn-sm ${mode === 'power' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => mode !== 'power' && onFieldChange('pump', 100)}
              aria-pressed={mode === 'power'}
              aria-label={t`Pump power mode`}
            >
              {t`Power`}
            </button>
            {pressureAvailable && (
              <>
                <button
                  type='button'
                  className={`join-item btn btn-sm ${mode === 'pressure' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() =>
                    mode !== 'pressure' &&
                    onFieldChange('pump', { target: 'pressure', pressure: 0, flow: 0 })
                  }
                  aria-pressed={mode === 'pressure'}
                  aria-label={t`Pump pressure mode (PRO feature)`}
                >
                  {t`Pressure`} <sup>PRO</sup>
                </button>
                <button
                  type='button'
                  className={`join-item btn btn-sm ${mode === 'flow' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() =>
                    mode !== 'flow' &&
                    onFieldChange('pump', { target: 'flow', pressure: 0, flow: 0 })
                  }
                  aria-pressed={mode === 'flow'}
                  aria-label={t`Pump flow mode (PRO feature)`}
                >
                  {t`Flow`} <sup>PRO</sup>
                </button>
              </>
            )}
          </div>
        </fieldset>
      </div>

      {mode === 'power' && (
        <div className='form-control'>
          <label htmlFor={`phase-${index}-power`} className='mb-2 block text-sm font-medium'>
            {t`Pump Power`}
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
              {t`Pressure`} {mode === 'pressure' ? t`Target` : t`Limit`}
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
                <span aria-label={t`bar`}>bar</span>
              </label>
            </div>
          </div>
          <div className='form-control'>
            <label htmlFor={`phase-${index}-flow`} className='mb-2 block text-sm font-medium'>
              {t`Flow`} {mode === 'flow' ? t`Target` : t`Limit`}
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

      <div className='grid grid-cols-1 gap-4'>
        <div className='form-control'>
          <fieldset>
            <legend className='mb-2 block text-sm font-medium'>{t`Transition`}</legend>
            <div className='join' role='group' aria-label={t`Pump mode selection`}>
              <button
                type='button'
                className={`join-item btn btn-sm ${(phase.transition?.type || 'instant') === 'instant' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() =>
                  onFieldChange('transition', { ...phase.transition, type: 'instant', duration: 0 })
                }
                aria-pressed={mode === 'off'}
                aria-label={t`Instant`}
              >
                {t`Instant`}
              </button>
              <button
                type='button'
                className={`join-item btn btn-sm ${phase.transition?.type === 'linear' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => onFieldChange('transition', { ...phase.transition, type: 'linear' })}
                aria-pressed={phase.transition?.type === 'linear'}
                aria-label={t`Linear`}
              >
                {t`Linear`}
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
                {t`Ease In`}
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
                {t`Ease Out`}
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
                {t`Ease In Out`}
              </button>
            </div>
          </fieldset>
        </div>
      </div>
      {phase.transition?.type !== 'instant' && (
        <div className='grid grid-cols-1 gap-4'>
          <div className='form-control'>
            <label
              htmlFor={`phase-${index}-transition-duration`}
              className='mb-2 block text-sm font-medium'
            >
              {t`Transition Duration`}
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
                  aria-label={t`Transition duration in seconds`}
                  min='0'
                  step='0.1'
                />
                <span aria-label={t`seconds`}>s</span>
              </label>
            </div>
          </div>
        </div>
      )}

      <div className='flex flex-row gap-4'>
        <h3 className='text-lg font-medium'>{t`Targets`}</h3>
        <button
          type='button'
          className={`join-item btn btn-sm btn-outline`}
          aria-label={t`Add target`}
          onClick={() => onTargetAdd()}
        >
          <i className='fa fa-plus' aria-hidden='true' />
        </button>
      </div>
      {targets.map((target, idx) => (
        <>
          {idx !== 0 && (
            <div key={`sep-${idx}`} className='divider'>
              {t`OR`}
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
