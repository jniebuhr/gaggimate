import { useContext } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons/faCheck';
import { faPlay } from '@fortawesome/free-solid-svg-icons/faPlay';
import { ApiServiceContext } from '../../../services/ApiService.js';
import Section from '../../../components/Card.jsx';
import { InputGroupField } from '../../../components/SettingsFormField.jsx';

const formatTimestamp = timestamp =>
  timestamp ? new Date(timestamp * 1000).toLocaleString() : 'Never';

const TASKS = [
  {
    key: 'backflush',
    title: 'Backflush',
    timeField: 'backflushIntervalDays',
    timeUnit: 'days',
    timeDefault: 14,
    shotsField: 'backflushIntervalShots',
    lastTimeField: 'lastBackflushTime',
    shotsSinceField: 'shotsSinceBackflush',
  },
  {
    key: 'descaling',
    title: 'Descaling',
    timeField: 'descalingIntervalWeeks',
    timeUnit: 'weeks',
    timeDefault: 6,
    shotsField: 'descalingIntervalShots',
    lastTimeField: 'lastDescalingTime',
    shotsSinceField: 'shotsSinceDescaling',
  },
];

function CleaningTask({ task, formData, onChange, onStart, onComplete }) {
  const shotsSince = formData[task.shotsSinceField] ?? 0;
  return (
    <div className='border-base-300 rounded-lg border p-3'>
      <div className='mb-3 text-sm font-semibold'>{task.title}</div>
      <div className='grid grid-cols-2 gap-3'>
        <InputGroupField label='Every' htmlFor={task.timeField} unit={task.timeUnit} noMargin>
          <input
            id={task.timeField}
            name={task.timeField}
            type='number'
            min='0'
            className='grow'
            value={formData[task.timeField] ?? task.timeDefault}
            onChange={onChange(task.timeField)}
          />
        </InputGroupField>
        <InputGroupField label='Or every' htmlFor={task.shotsField} unit='shots' noMargin>
          <input
            id={task.shotsField}
            name={task.shotsField}
            type='number'
            min='0'
            className='grow'
            value={formData[task.shotsField] ?? 0}
            onChange={onChange(task.shotsField)}
          />
        </InputGroupField>
      </div>
      <div className='text-base-content/60 mt-3 text-sm'>
        Last: {formatTimestamp(formData[task.lastTimeField])} · {shotsSince}{' '}
        {shotsSince === 1 ? 'shot' : 'shots'} since
      </div>
      <div className='mt-2 flex flex-wrap gap-2'>
        <button type='button' className='btn btn-primary btn-sm' onClick={onStart}>
          <FontAwesomeIcon icon={faPlay} /> Start
        </button>
        <button type='button' className='btn btn-sm' onClick={onComplete}>
          <FontAwesomeIcon icon={faCheck} /> Mark complete
        </button>
      </div>
    </div>
  );
}

CleaningTask.propTypes = {
  task: PropTypes.object.isRequired,
  formData: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  onStart: PropTypes.func.isRequired,
  onComplete: PropTypes.func.isRequired,
};

export function CleaningSection({ formData, onChange, setField }) {
  const apiService = useContext(ApiServiceContext);
  const { route } = useLocation();

  const start = task => {
    apiService.send({ tp: `req:cleaning:${task.key}:start` });
    route('/');
  };

  const complete = task => {
    apiService.send({ tp: `req:cleaning:${task.key}:complete` });
    setField(task.lastTimeField, Math.floor(Date.now() / 1000));
    setField(task.shotsSinceField, 0);
  };

  return (
    <Section title='Cleaning & Maintenance'>
      <div className='text-base-content/60 mb-4 text-sm'>
        A cleaning warning is shown once either interval is reached; set an interval to 0 to turn it
        off. Running the cleaning profile to the end marks it complete.
      </div>
      <div className='grid grid-cols-1 gap-3'>
        {TASKS.map(task => (
          <CleaningTask
            key={task.key}
            task={task}
            formData={formData}
            onChange={onChange}
            onStart={() => start(task)}
            onComplete={() => complete(task)}
          />
        ))}
      </div>
    </Section>
  );
}

CleaningSection.propTypes = {
  formData: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  setField: PropTypes.func.isRequired,
};
