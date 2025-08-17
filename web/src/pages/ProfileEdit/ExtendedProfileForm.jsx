import Card from '../../components/Card.jsx';
import { Spinner } from '../../components/Spinner.jsx';
import { ExtendedProfileChart } from '../../components/ExtendedProfileChart.jsx';
import { useState } from 'preact/hooks';
import { ExtendedPhase } from './ExtendedPhase.jsx';

export function ExtendedProfileForm(props) {
  const { data, onChange, onSave, saving = true, pressureAvailable = false } = props;
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);

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
          transition: {
            type: 'instant',
            duration: 0,
            adaptive: true,
          },
        },
      ],
    });
    setCurrentPhaseIndex(data.phases.length);
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

  const currentPhase = data.phases[currentPhaseIndex];

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
        <Card sm={10}>
          <ExtendedProfileChart
            data={data}
            selectedPhase={currentPhaseIndex}
            className='max-h-72 w-full'
          />
        </Card>
        <Card sm={10}>
          <div className='card-header flex items-center gap-4'>
            <h2 className='card-title flex-grow text-lg sm:text-xl'>Brew Phases</h2>
            <h5 className='card-subtitle text-sm sm:text-base'>
              {currentPhaseIndex + 1} / {data.phases.length}
            </h5>
            <div>
              <div className='join' role='group' aria-label='Phase navigation'>
                <button
                  type='button'
                  className={`join-item btn btn-outline`}
                  aria-label='Previous'
                  disabled={currentPhaseIndex === 0}
                  onClick={() => setCurrentPhaseIndex(currentPhaseIndex - 1)}
                >
                  <i className='fa fa-chevron-left' aria-hidden='true' />
                </button>
                <button
                  type='button'
                  className={`join-item btn btn-outline`}
                  aria-label='Next'
                  disabled={currentPhaseIndex === data.phases.length - 1}
                  onClick={() => setCurrentPhaseIndex(currentPhaseIndex + 1)}
                >
                  <i className='fa fa-chevron-right' aria-hidden='true' />
                </button>
              </div>
            </div>
            <button
              type='button'
              className={`join-item btn btn-outline`}
              aria-label='Add phase'
              onClick={() => onPhaseAdd()}
            >
              <i className='fa fa-plus' aria-hidden='true' />
            </button>
            <button
              type='button'
              className={`join-item btn btn-outline text-error`}
              aria-label='Remove phase'
              onClick={() => onPhaseRemove(currentPhaseIndex)}
            >
              <i className='fa fa-trash-can' aria-hidden='true' />
            </button>
          </div>
          <div className='space-y-4' role='group' aria-label='Brew phases configuration'>
            <ExtendedPhase
              phase={currentPhase}
              index={currentPhaseIndex}
              onChange={phase => onPhaseChange(currentPhaseIndex, phase)}
              onRemove={() => onPhaseRemove(currentPhaseIndex)}
              pressureAvailable={pressureAvailable}
            />
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
