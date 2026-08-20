import { faDroplet } from '@fortawesome/free-solid-svg-icons/faDroplet';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import PropTypes from 'prop-types';

const usageExample =
  'A Silvia flat-white workflow might begin at 4 yellow and 5 red. Enter counts that match your own routine.';
const modeLabels = ['Usage based', 'Schedule based'];
const thresholdFields = [
  ['Yellow after', 'waterReminderWarningCount', 1, 65534, 4],
  ['Red after', 'waterReminderCriticalCount', 2, 65535, 5],
];

export function WaterReminderSetup({ formData, onChange }) {
  const mode = Number(formData.waterReminderMode ?? 0);
  const modeChanged = mode !== Number(formData.waterReminderSavedMode ?? mode);
  const warning = Number(formData.waterReminderWarningCount || 4);
  const critical = Number(formData.waterReminderCriticalCount || 5);
  const thresholdsValid = warning >= 1 && critical > warning;
  const scheduleDays = Number(formData.waterReminderScheduleDays || 4);
  const scheduleValid = scheduleDays >= 1 && scheduleDays <= 30;
  const sdAvailable = !!formData.waterReminderSdAvailable;
  const setupRequired = !!formData.waterReminderSetupRequired;
  const requiresTankConfirmation = setupRequired || modeChanged;
  const littleFsAccepted = sdAvailable || !!formData.waterReminderStorageWarningAccepted;
  const tankConfirmed = !!formData.waterReminderTankFullConfirmed;
  const modeValid = mode === 0 ? thresholdsValid : scheduleValid;
  const hardwareSensorAvailable = !!formData.waterReminderHardwareSensorAvailable;
  const clockReady = !!formData.waterReminderClockReady;
  const setupComplete =
    modeValid &&
    (mode === 0 || clockReady) &&
    littleFsAccepted &&
    (!requiresTankConfirmation || tankConfirmed);

  return (
    <div className='bg-base-200 rounded-lg p-4'>
      <div className='flex items-center justify-between gap-4'>
        <div className='flex min-w-0 items-center gap-3'>
          <FontAwesomeIcon icon={faDroplet} className='text-info shrink-0' />
          <div>
            <div className='text-xl font-medium'>Water Refill Reminder</div>
            <div className='text-base-content/60 text-sm'>Experimental virtual reminder</div>
          </div>

          {mode === 1 && !clockReady && (
            <div className='alert alert-info text-sm'>
              Waiting for clock sync before the schedule can start.
            </div>
          )}
        </div>
        <input
          id='waterReminderEnabled'
          name='waterReminderEnabled'
          type='checkbox'
          className='toggle toggle-primary shrink-0'
          checked={!!formData.waterReminderEnabled}
          disabled={hardwareSensorAvailable || (!formData.waterReminderEnabled && !setupComplete)}
          onChange={onChange('waterReminderEnabled')}
          aria-label='Enable water refill reminder'
        />
      </div>

      {hardwareSensorAvailable ? (
        <div className='alert alert-info mt-4 text-sm'>
          The installed water-level sensor remains authoritative, so the virtual reminder is
          suspended.
        </div>
      ) : (
        <div className='border-base-300 mt-4 space-y-4 border-t pt-4'>
          <div>
            <div className='join grid w-full grid-cols-2'>
              {modeLabels.map((label, value) => (
                <label
                  key={label}
                  className={`btn join-item h-auto min-h-12 py-2 ${mode === value ? 'btn-active' : ''}`}
                >
                  <input
                    type='radio'
                    name='waterReminderMode'
                    className='sr-only'
                    value={value}
                    checked={mode === value}
                    onChange={onChange('waterReminderMode')}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <p className='text-base-content/60 mt-2 text-xs'>
              {mode === 0
                ? 'Counts completed drinks and learns whether brewing, steaming, and flushing use water faster.'
                : 'Shows a simple recurring reminder. It does not estimate tank level or water use.'}
            </p>
          </div>

          {mode === 0 ? (
            <fieldset className='space-y-2'>
              <legend className='text-sm font-semibold'>Reminder thresholds</legend>
              <div className='grid grid-cols-2 gap-3'>
                {thresholdFields.map(([label, name, min, max, fallback]) => (
                  <label key={name} className='form-control'>
                    <span className='label-text mb-1 text-sm'>{label}</span>
                    <input
                      type='number'
                      min={min}
                      max={max}
                      step='1'
                      className='input input-bordered w-full'
                      value={formData[name] ?? fallback}
                      onChange={onChange(name)}
                    />
                  </label>
                ))}
              </div>
              <p className='text-base-content/55 text-xs'>{usageExample}</p>
              {!thresholdsValid && (
                <p className='text-error text-xs'>
                  Red must be greater than yellow, and yellow must be at least 1.
                </p>
              )}
            </fieldset>
          ) : (
            <fieldset className='space-y-2'>
              <legend className='text-sm font-semibold'>Reminder schedule</legend>
              <div className='grid grid-cols-2 gap-3'>
                <label className='form-control'>
                  <span className='label-text mb-1 text-sm'>Every</span>
                  <div className='join'>
                    <input
                      type='number'
                      min='1'
                      max='30'
                      step='1'
                      className='input input-bordered join-item w-full'
                      value={formData.waterReminderScheduleDays ?? 4}
                      onChange={onChange('waterReminderScheduleDays')}
                    />
                    <span className='join-item border-base-300 bg-base-200 flex items-center border px-3 text-sm'>
                      days
                    </span>
                  </div>
                </label>
                <label className='form-control'>
                  <span className='label-text mb-1 text-sm'>At</span>
                  <input
                    type='time'
                    className='input input-bordered w-full'
                    value={formData.waterReminderScheduleTime ?? '20:00'}
                    onChange={onChange('waterReminderScheduleTime')}
                  />
                </label>
              </div>
              {!scheduleValid && (
                <p className='text-error text-xs'>Choose an interval from 1 to 30 days.</p>
              )}
            </fieldset>
          )}

          {sdAvailable && (
            <p className='text-base-content/55 text-xs'>
              Reminder state will be stored on the SD card.
            </p>
          )}

          {!sdAvailable && !littleFsAccepted && (
            <label className='label cursor-pointer justify-start gap-3 py-2'>
              <input
                type='checkbox'
                className='checkbox checkbox-warning checkbox-sm'
                checked={!!formData.waterReminderStorageWarningAccepted}
                onChange={onChange('waterReminderStorageWarningAccepted')}
              />
              <span className='label-text text-sm'>
                I understand that a full filesystem reflash can erase internal reminder history.
              </span>
            </label>
          )}

          {requiresTankConfirmation && (
            <label className='label cursor-pointer justify-start gap-3 py-2'>
              <input
                type='checkbox'
                className='checkbox checkbox-primary checkbox-sm'
                checked={tankConfirmed}
                onChange={onChange('waterReminderTankFullConfirmed')}
              />
              <span className='label-text text-sm'>
                The tank is full and ready to start this reminder.
              </span>
            </label>
          )}

          {mode === 0 && (
            <p className='text-base-content/55 text-xs'>
              Water-use learning begins after the first valid refill cycle. Until then, the reminder
              uses drink count only.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

WaterReminderSetup.propTypes = {
  formData: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
};
