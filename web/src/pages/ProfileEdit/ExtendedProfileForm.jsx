import Card from '../../components/Card.jsx';
import { Spinner } from '../../components/Spinner.jsx';
import { ProfileKeyframeChart } from './ProfileKeyframeChart.jsx';
import {
  addKeyframeAtTime,
  hasInitialSetupPhase,
  moveKeyframeTime,
  removeKeyframeAtIndex,
  updateKeyframeSegment,
} from './keyframeProfileLogic.js';
import { useState } from 'preact/hooks';
import { ExtendedPhase } from './ExtendedPhase.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons/faChevronLeft';
import { faChevronRight } from '@fortawesome/free-solid-svg-icons/faChevronRight';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons/faTrashCan';

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
    if (index > 0) {
      // For profiles without a zero-duration setup phase, profileToKeyframes synthesizes a
      // leading marker, shifting the marker index by 1 relative to the phase array. Use
      // `index` directly in that case so the right marker is targeted.
      const segmentIndex = hasInitialSetupPhase(data.phases) ? index - 1 : index;
      const pumpPatch = value.pump && typeof value.pump === 'object'
        ? {
            pressure: value.pump.pressure,
            flow: value.pump.flow,
            targetMode: value.pump.target,
          }
        : {};
      const result = updateKeyframeSegment(data, segmentIndex, {
        name: value.name,
        phase: value.phase,
        valve: value.valve,
        temperature: value.temperature,
        duration: value.duration,
        ...pumpPatch,
        rampType: value.transition?.type,
        rampDuration: value.transition?.duration,
        adaptive: value.transition?.adaptive,
        targets: value.targets,
      });
      onChange(result.profile);
      setCurrentPhaseIndex(result.selectedSegmentIndex + 1);
      return;
    }

    const newData = { ...data, phases: [...data.phases] };
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
          targets: [],
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
    setCurrentPhaseIndex(0);
  };

  const applyKeyframeResult = result => {
    onChange(result.profile);
    setCurrentPhaseIndex(result.selectedSegmentIndex + 1);
  };

  const onMarkerAdd = time => applyKeyframeResult(addKeyframeAtTime(data, time));
  const onMarkerMove = (markerIndex, time) => applyKeyframeResult(moveKeyframeTime(data, markerIndex, time));
  const onSegmentSelect = segmentIndex =>
    setCurrentPhaseIndex(segmentIndex + (hasInitialSetupPhase(data.phases) ? 1 : 0));

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
          <ProfileKeyframeChart
            data={data}
            selectedSegmentIndex={Math.max(0, currentPhaseIndex - 1)}
            onAddMarker={onMarkerAdd}
            onMoveMarker={onMarkerMove}
            onSelectSegment={onSegmentSelect}
            className='max-h-72 w-full'
          />
        </Card>
        <Card sm={10}>
          <div className='card-header flex items-center gap-4'>
            <h2 className='card-title flex-grow text-lg sm:text-xl'>Selected Segment</h2>
            <h5 className='card-subtitle text-sm sm:text-base'>
              {Math.max(1, currentPhaseIndex)} / {Math.max(1, data.phases.length - 1)}
            </h5>
            <div>
              <div className='join' role='group' aria-label='Phase navigation'>
                <button
                  type='button'
                  className={`join-item btn btn-outline max-sm:btn-sm`}
                  aria-label='Previous'
                  disabled={currentPhaseIndex === 0}
                  onClick={() => setCurrentPhaseIndex(currentPhaseIndex - 1)}
                >
                  <FontAwesomeIcon icon={faChevronLeft} />
                </button>
                <button
                  type='button'
                  className={`join-item btn btn-outline max-sm:btn-sm`}
                  aria-label='Next'
                  disabled={currentPhaseIndex === data.phases.length - 1}
                  onClick={() => setCurrentPhaseIndex(currentPhaseIndex + 1)}
                >
                  <FontAwesomeIcon icon={faChevronRight} />
                </button>
              </div>
            </div>
            <button
              type='button'
              className={`join-item btn btn-outline max-sm:btn-sm`}
              aria-label='Add phase'
              onClick={() => onPhaseAdd()}
            >
              <FontAwesomeIcon icon={faPlus} />
            </button>
            <button
              type='button'
              className={`join-item btn btn-outline text-error max-sm:btn-sm`}
              aria-label='Remove phase'
              disabled={data.phases.length <= 2 || currentPhaseIndex === 0}
              onClick={() => applyKeyframeResult(removeKeyframeAtIndex(data, currentPhaseIndex))}
            >
              <FontAwesomeIcon icon={faTrashCan} />
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
