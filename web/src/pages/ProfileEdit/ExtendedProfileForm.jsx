import Card from '../../components/Card.jsx';
import { ExtendedProfileChart } from '../../components/ExtendedProfileChart.jsx';
import { useState } from 'preact/hooks';
import { ExtendedPhase } from './ExtendedPhase.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons/faChevronLeft';
import { faChevronRight } from '@fortawesome/free-solid-svg-icons/faChevronRight';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons/faTrashCan';
import { Tooltip } from '../../components/Tooltip.jsx';
import { ProfileInfoFields, ProfileFormFooter } from './ProfileFormComponents.jsx';

export function ExtendedProfileForm(props) {
  const { data, onChange, onSave, saving = true, pressureAvailable = false, isNew = false } = props;
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

  const currentPhase = data.phases[currentPhaseIndex];

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        onSave(data);
      }}
    >
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-10'>
        <ProfileInfoFields data={data} onFieldChange={onFieldChange} />
        
        <Card sm={10}>
          <ExtendedProfileChart
            data={data}
            selectedPhase={currentPhaseIndex}
            className='max-h-72 w-full'
          />
        </Card>
        <Card sm={10}>
          <div className='card-header flex items-center gap-4'>
            <h2 className='card-title flex-grow text-lg sm:text-xl'>Phases</h2>
            <h5 className='card-subtitle text-sm sm:text-base'>
              {currentPhaseIndex + 1} / {data.phases.length}
            </h5>
            <div>
              <fieldset className='flex gap-1' aria-label='Phase navigation'>
                <Tooltip content='Previous Phase'>
                  <button
                    type='button'
                    className={`btn btn-outline max-sm:btn-sm`}
                    aria-label='Previous'
                    disabled={currentPhaseIndex === 0}
                    onClick={() => setCurrentPhaseIndex(currentPhaseIndex - 1)}
                  >
                    <FontAwesomeIcon icon={faChevronLeft} />
                  </button>
                </Tooltip>
                <Tooltip content='Next Phase'>
                  <button
                    type='button'
                    className={`btn btn-outline max-sm:btn-sm`}
                    aria-label='Next'
                    disabled={currentPhaseIndex === data.phases.length - 1}
                    onClick={() => setCurrentPhaseIndex(currentPhaseIndex + 1)}
                  >
                    <FontAwesomeIcon icon={faChevronRight} />
                  </button>
                </Tooltip>
              </fieldset>
            </div>
            <Tooltip content='Add Phase'>
              <button
                type='button'
                className={`btn btn-outline max-sm:btn-sm`}
                aria-label='Add phase'
                onClick={() => onPhaseAdd()}
              >
                <FontAwesomeIcon icon={faPlus} />
              </button>
            </Tooltip>
            <Tooltip content='Remove Phase'>
              <button
                type='button'
                className={`btn btn-outline text-error max-sm:btn-sm`}
                aria-label='Remove phase'
                onClick={() => onPhaseRemove(currentPhaseIndex)}
              >
                <FontAwesomeIcon icon={faTrashCan} />
              </button>
            </Tooltip>
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

      <ProfileFormFooter saving={saving} isNew={isNew} />
    </form>
  );
}
