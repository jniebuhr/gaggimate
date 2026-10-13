import { useContext } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import PropTypes from 'prop-types';
import { Trans, useLingui, Plural } from '@lingui/react/macro';
import { msg } from '@lingui/core/macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons/faCheck';
import { faPlay } from '@fortawesome/free-solid-svg-icons/faPlay';
import { ApiServiceContext } from '../../../services/ApiService.js';
import Section from '../../../components/Card.jsx';
import { InputGroupField } from '../../../components/SettingsFormField.jsx';

const formatTimestamp = (timestamp, never) =>
  timestamp ? new Date(timestamp * 1000).toLocaleString() : never;

const TASKS = [
  {
    key: 'backflush',
    title: msg`Backflush`,
    timeField: 'backflushIntervalDays',
    timeUnit: msg`days`,
    timeDefault: 14,
    shotsField: 'backflushIntervalShots',
    lastTimeField: 'lastBackflushTime',
    shotsSinceField: 'shotsSinceBackflush',
  },
  {
    key: 'descaling',
    title: msg`Descaling`,
    timeField: 'descalingIntervalWeeks',
    timeUnit: msg`weeks`,
    timeDefault: 6,
    shotsField: 'descalingIntervalShots',
    lastTimeField: 'lastDescalingTime',
    shotsSinceField: 'shotsSinceDescaling',
  },
];

function CleaningTask({ task, formData, onChange, onStart, onComplete }) {
  const { t, i18n } = useLingui();
  const shotsSince = formData[task.shotsSinceField] ?? 0;
  const lastTime = formatTimestamp(formData[task.lastTimeField], t`Never`);
  return (
    <div className='border-base-300 rounded-lg border p-3'>
      <div className='mb-3 text-sm font-semibold'>{i18n._(task.title)}</div>
      <div className='grid grid-cols-2 gap-3'>
        <InputGroupField
          label={t`Every`}
          htmlFor={task.timeField}
          unit={i18n._(task.timeUnit)}
          noMargin
        >
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
        <InputGroupField label={t`Or every`} htmlFor={task.shotsField} unit={t`shots`} noMargin>
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
        <Trans>
          Last: {lastTime} · <Plural value={shotsSince} one='# shot since' other='# shots since' />
        </Trans>
      </div>
      <div className='mt-2 flex flex-wrap gap-2'>
        <button type='button' className='btn btn-primary btn-sm' onClick={onStart}>
          <FontAwesomeIcon icon={faPlay} /> <Trans>Start</Trans>
        </button>
        <button type='button' className='btn btn-sm' onClick={onComplete}>
          <FontAwesomeIcon icon={faCheck} /> <Trans>Mark complete</Trans>
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
  const { t } = useLingui();

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
    <Section title={t`Cleaning & Maintenance`}>
      <div className='text-base-content/60 mb-4 text-sm'>
        <Trans>
          A cleaning warning is shown once either interval is reached; set an interval to 0 to turn
          it off. Running the cleaning profile to the end marks it complete.
        </Trans>
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
