import Card from '../../components/Card.jsx';
import { Spinner } from '../../components/Spinner.jsx';
import { isNumber } from 'chart.js/helpers';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons/faChevronDown';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons/faTrashCan';

export function StandardProfileForm(props) {
  const { data, onChange, onSave, saving = true, pressureAvailable = false } = props;

  const onFieldChange = (field, value) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  const onPhaseChange = (index, value) => {
    const newData = {
      ...data,
    };
    newData.phases[index] = value;
    onChange(newData);
  };

  const onPhaseAdd = () => {
    onChange({
      ...data,
      phases: [
        ...data.phases,
        {
          phase: 'brew',
          name: 'New Phase',
          pump: 100,
          valve: 1,
          duration: 0,
        },
      ],
    });
  };

  const onPhaseRemove = index => {
    const newData = {
      ...data,
      phases: [],
    };
    for (let i = 0; i < data.phases.length; i++) {
      if (i !== index) {
        newData.phases.push(data.phases[i]);
      }
    }
    onChange(newData);
  };

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        onSave(data);
      }}
    >
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-10'>
        <Card sm={10} title='Profile Information'>
          <div className='form-control'>
            <label htmlFor='label' className='mb-2 block text-sm font-medium'>
              Title
            </label>
            <input
              id='label'
              name='label'
              className='input input-bordered w-full'
              value={data?.label}
              onChange={e => onFieldChange('label', e.target.value)}
              aria-label='Enter a name for this profile'
              required
            />
          </div>
          <div className='form-control'>
            <label htmlFor='description' className='mb-2 block text-sm font-medium'>
              Description
            </label>
            <input
              id='description'
              name='description'
              className='input input-bordered w-full'
              value={data?.description}
              onChange={e => onFieldChange('description', e.target.value)}
              aria-label='Optional description for this profile'
            />
          </div>
          <div className='form-control'>
            <label htmlFor='temperature' className='mb-2 block text-sm font-medium'>
              Temperature
            </label>
            <div className='input-group'>
              <label htmlFor='temperature' className='input w-full'>
                <input
                  id='temperature'
                  name='temperature'
                  type='number'
                  className='grow'
                  value={data?.temperature}
                  onChange={e => onFieldChange('temperature', e.target.value)}
                  aria-label='Temperature in degrees Celsius'
                  min='0'
                  max='150'
                  step='0.1'
                />
                <span aria-label='degrees Celsius'>°C</span>
              </label>
            </div>
          </div>
        </Card>

        <Card sm={10} title='Brew Phases'>
          <div className='space-y-4' role='group' aria-label='Brew phases configuration'>
            {data.phases.map((value, index) => (
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
                aria-label='Add new brew phase'
              >
                <FontAwesomeIcon icon={faPlus} />
                <span>Add phase</span>
              </button>
            </div>
          </div>
        </Card>
      </div>

      <div className='pt-4 lg:col-span-10'>
        <div className='flex flex-col gap-2 sm:flex-row'>
          <a href='/profiles' className='btn btn-outline'>
            Back
          </a>
          <button
            type='submit'
            className='btn btn-primary gap-2'
            disabled={saving}
            aria-label={saving ? 'Saving profile...' : 'Save profile'}
          >
            <span>Save</span>
            {saving && <Spinner size={4} />}
          </button>
        </div>
      </div>
    </form>
  );
}

function Phase({ phase, index, onChange, onRemove, pressureAvailable }) {
  const onFieldChange = (field, value) => {
    onChange({
      ...phase,
      [field]: value,
    });
  };

  const onVolumetricTargetChange = value => {
    if (value === 0) {
      onChange({
        ...phase,
        targets: null,
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
  const volumetricTarget = targets.find(t => t.type === 'volumetric') || {};
  const targetWeight = volumetricTarget?.value || 0;

  const pumpPower = isNumber(phase.pump) ? phase.pump : 100;
  const pressure = !isNumber(phase.pump) ? phase.pump.pressure : 0;
  const flow = !isNumber(phase.pump) ? phase.pump.flow : 0;
  const mode = isNumber(phase.pump) ? (phase.pump === 0 ? 'off' : 'power') : phase.pump.target;

  return (
    <div
      className='bg-base-200 border-base-300 space-y-4 rounded-lg border p-4'
      role='group'
      aria-label={`Phase ${index + 1} configuration`}
    >
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <div className='form-control'>
          <label htmlFor={`phase-${index}-type`} className='mb-2 block text-sm font-medium'>
            Phase Type
          </label>
          <select
            id={`phase-${index}-type`}
            className='select select-bordered w-full'
            onChange={e => onFieldChange('phase', e.target.value)}
            value={phase.phase}
            aria-label='Select the type of brew phase'
          >
            <option value='preinfusion'>Pre-Infusion</option>
            <option value='brew'>Brew</option>
          </select>
        </div>
        <div className='form-control'>
          <label htmlFor={`phase-${index}-name`} className='mb-2 block text-sm font-medium'>
            Phase Name
          </label>
          <div className='flex gap-2'>
            <input
              id={`phase-${index}-name`}
              className='input input-bordered flex-1'
              placeholder='Name...'
              value={phase.name}
              onChange={e => onFieldChange('name', e.target.value)}
              aria-label='Enter a name for this phase'
            />
            <button
              type='button'
              onClick={onRemove}
              className='btn btn-sm btn-ghost text-error'
              title='Delete this phase'
              aria-label={`Delete phase ${index + 1}`}
            >
              <FontAwesomeIcon icon={faTrashCan} />
            </button>
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <div className='form-control'>
          <label htmlFor={`phase-${index}-duration`} className='mb-2 block text-sm font-medium'>
            Duration
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
                aria-label='Duration in seconds'
              />
              <span aria-label='seconds'>s</span>
            </label>
          </div>
        </div>
        <div className='form-control'>
          <label htmlFor={`phase-${index}-target`} className='mb-2 block text-sm font-medium'>
            Volumetric Target
          </label>
          <div className='input-group'>
            <label htmlFor={`phase-${index}-target`} className='input w-full'>
              <input
                id={`phase-${index}-target`}
                className='grow'
                type='number'
                value={targetWeight}
                onChange={e => onVolumetricTargetChange(parseFloat(e.target.value))}
                aria-label='Target weight in grams'
                min='0'
                step='0.1'
              />
              <span aria-label='grams'>g</span>
            </label>
          </div>
        </div>
      </div>

      <div className='form-control'>
        <fieldset>
          <legend className='mb-2 block text-sm font-medium'>Valve</legend>
          <div className='join' role='group' aria-label='Valve state selection'>
            <button
              type='button'
              className={`join-item btn btn-sm ${!phase.valve ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => onFieldChange('valve', 0)}
              aria-pressed={!phase.valve}
              aria-label='Valve closed'
            >
              Closed
            </button>
            <button
              type='button'
              className={`join-item btn btn-sm ${phase.valve ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => onFieldChange('valve', 1)}
              aria-pressed={phase.valve}
              aria-label='Valve open'
            >
              Open
            </button>
          </div>
        </fieldset>
      </div>

      <div className='form-control'>
        <fieldset>
          <legend className='mb-2 block text-sm font-medium'>Pump Mode</legend>
          <div className='join' role='group' aria-label='Pump mode selection'>
            <button
              type='button'
              className={`join-item btn btn-sm ${mode === 'off' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => onFieldChange('pump', 0)}
              aria-pressed={mode === 'off'}
              aria-label='Pump off'
            >
              Off
            </button>
            <button
              type='button'
              className={`join-item btn btn-sm ${mode === 'power' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => mode !== 'power' && onFieldChange('pump', 100)}
              aria-pressed={mode === 'power'}
              aria-label='Pump power mode'
            >
              Power
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
                  aria-label='Pump pressure mode (PRO feature)'
                >
                  Pressure <sup>PRO</sup>
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
                  aria-label='Pump flow mode (PRO feature)'
                >
                  Flow <sup>PRO</sup>
                </button>
              </>
            )}
          </div>
        </fieldset>
      </div>

      {mode === 'power' && (
        <div className='form-control'>
          <label htmlFor={`phase-${index}-power`} className='mb-2 block text-sm font-medium'>
            Pump Power
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
                aria-label='Pump power as percentage'
              />
              <span aria-label='percent'>%</span>
            </label>
          </div>
        </div>
      )}

      {(mode === 'pressure' || mode === 'flow') && (
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <div className='form-control'>
            <label htmlFor={`phase-${index}-pressure`} className='mb-2 block text-sm font-medium'>
              Pressure {mode === 'pressure' ? 'Target' : 'Limit'}
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
                  aria-label='Pressure in bar'
                  min='0'
                />
                <span aria-label='bar'>bar</span>
              </label>
            </div>
          </div>
          <div className='form-control'>
            <label htmlFor={`phase-${index}-flow`} className='mb-2 block text-sm font-medium'>
              Flow {mode === 'flow' ? 'Target' : 'Limit'}
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
                  aria-label='Flow rate in grams per second'
                  min='0'
                />
                <span aria-label='grams per second'>g/s</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
