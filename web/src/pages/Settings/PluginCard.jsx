import { faTrashCan } from '@fortawesome/free-solid-svg-icons/faTrashCan';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import homekitImage from '../../assets/homekit.png';

const DAYS_OF_WEEK = [
  { short: 'M', full: 'Monday' },
  { short: 'T', full: 'Tuesday' },
  { short: 'W', full: 'Wednesday' },
  { short: 'Th', full: 'Thursday' },
  { short: 'F', full: 'Friday' },
  { short: 'S', full: 'Saturday' },
  { short: 'Su', full: 'Sunday' },
];

/** UI Atoms */
const CheckboxToggle = ({ checked, onChange, ariaLabel }) => (
  <input
    type='checkbox'
    className='toggle toggle-primary'
    checked={!!checked}
    onChange={onChange}
    aria-label={ariaLabel}
  />
);

const InputWrapper = ({ id, label, children }) => (
  <div className='form-control w-full'>
    <label htmlFor={id} className='mb-2 block text-sm font-medium'>
      {label}
    </label>
    {children}
  </div>
);

/** Plugin Layout Wrapper */
const PluginWrapper = ({ title, enabled, onToggle, children, actions, description }) => (
  <div className='bg-base-200 rounded-xl p-4 shadow-sm transition-all'>
    <div className='mb-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
      <span className='text-xl font-medium tracking-tight'>{title}</span>
      <div className='flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:gap-4'>
        {enabled && actions}
        <div className='flex justify-end'>
          <CheckboxToggle checked={enabled} onChange={onToggle} ariaLabel={`Toggle ${title}`} />
        </div>
      </div>
    </div>
    {description && enabled && <p className='mb-4 text-sm opacity-70'>{description}</p>}
    {enabled && <div className='border-base-300 border-t pt-4'>{children}</div>}
  </div>
);

/** Plugin Content Components */
function AutoWakeupSchedules({ schedules, updateTime, updateDay, removeSchedule }) {
  return (
    <div className='space-y-3'>
      {schedules?.map((schedule, idx) => (
        <div key={idx} className='flex items-center gap-2'>
          <div className='join border-base-content/20 hover:border-primary/50 overflow-hidden rounded-lg border shadow-sm transition-colors'>
            <input
              type='time'
              className='input join-item border-base-content/20 bg-base-100 h-8 min-h-0 w-[110px] border-0 border-r px-1 text-center text-sm focus:outline-none'
              value={schedule.time}
              onChange={e => updateTime(idx, e.target.value)}
            />
            <div className='join-item bg-base-100 flex'>
              {DAYS_OF_WEEK.map((day, dIdx) => (
                <button
                  key={dIdx}
                  type='button'
                  className={`btn h-8 min-h-0 w-8 rounded-none border-y-0 border-l-0 p-0 last:border-r-0 ${
                    schedule.days[dIdx]
                      ? 'btn-primary border-r-primary-focus/30'
                      : 'btn-ghost bg-base-300/50 border-r-base-content/10'
                  }`}
                  onClick={() => updateDay(idx, dIdx, !schedule.days[dIdx])}
                  title={day.full}
                >
                  {day.short}
                </button>
              ))}
            </div>
          </div>
          {schedules.length > 1 && (
            <button
              type='button'
              onClick={() => removeSchedule(idx)}
              className='btn btn-ghost btn-xs text-error hover:bg-error/10'
            >
              <FontAwesomeIcon icon={faTrashCan} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/** Main Entry Point */
export function PluginCard({
  formData,
  onChange,
  addAutoWakeupSchedule,
  autowakeupSchedules,
  removeAutoWakeupSchedule,
  updateAutoWakeupTime,
  updateAutoWakeupDay,
}) {
  return (
    <div className='space-y-4'>
      {/* Auto Wakeup */}
      <PluginWrapper
        title='Automatic Wakeup'
        enabled={formData.autowakeupEnabled}
        onToggle={onChange('autowakeupEnabled')}
        description='Automatically switch to brew mode at specified times.'
        actions={
          <button
            onClick={addAutoWakeupSchedule}
            className='btn btn-outline btn-primary btn-sm w-full border-2 sm:w-auto'
          >
            + Add Schedule
          </button>
        }
      >
        <AutoWakeupSchedules
          schedules={autowakeupSchedules}
          updateTime={updateAutoWakeupTime}
          updateDay={updateAutoWakeupDay}
          removeSchedule={removeAutoWakeupSchedule}
        />
      </PluginWrapper>

      {/* HomeKit */}
      <PluginWrapper title='HomeKit' enabled={formData.homekit} onToggle={onChange('homekit')}>
        <div className='flex flex-col items-center gap-4'>
          <img src={homekitImage} alt='HomeKit Setup' className='max-w-[200px]' />
          <p className='text-center text-sm'>
            Open the Home app, select Add Accessory, and enter the setup code shown above.
          </p>
        </div>
      </PluginWrapper>

      {/* Boiler Refill */}
      <PluginWrapper
        title='Boiler Refill'
        enabled={formData.boilerFillActive}
        onToggle={onChange('boilerFillActive')}
      >
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <InputWrapper id='startupFillTime' label='On startup (seconds)'>
            <input
              type='number'
              className='input input-bordered'
              value={formData.startupFillTime}
              onChange={onChange('startupFillTime')}
            />
          </InputWrapper>
          <InputWrapper id='steamFillTime' label='On steam deactivate (seconds)'>
            <input
              type='number'
              className='input input-bordered'
              value={formData.steamFillTime}
              onChange={onChange('steamFillTime')}
            />
          </InputWrapper>
        </div>
      </PluginWrapper>

      {/* Smart Grind */}
      <PluginWrapper
        title='Smart Grind'
        enabled={formData.smartGrindActive}
        onToggle={onChange('smartGrindActive')}
        description='Controls a Tasmota Plug to turn off your grinder when the target weight is reached.'
      >
        <div className='space-y-4'>
          <InputWrapper id='smartGrindIp' label='Tasmota IP'>
            <input
              type='text'
              className='input input-bordered'
              placeholder='192.168.1.XX'
              value={formData.smartGrindIp}
              onChange={onChange('smartGrindIp')}
            />
          </InputWrapper>
          <InputWrapper id='smartGrindMode' label='Mode'>
            <select
              className='select select-bordered'
              value={formData.smartGrindMode}
              onChange={onChange('smartGrindMode')}
            >
              <option value='0'>Turn off at target</option>
              <option value='1'>Toggle off and on at target</option>
              <option value='2'>Turn on at start, off at target</option>
            </select>
          </InputWrapper>
        </div>
      </PluginWrapper>

      {/* Home Assistant (Deprecated) */}
      <PluginWrapper
        title='Home Assistant (Deprecated)'
        enabled={formData.homeAssistant}
        onToggle={onChange('homeAssistant')}
      >
        <p className='mb-4 text-xs italic opacity-60'>
          Connects via MQTT. For modern setups, use the{' '}
          <a href='https://github.com/gaggimate/ha-integration' className='link link-primary'>
            Official Integration
          </a>
          .
        </p>
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
          {['haIP', 'haPort', 'haUser', 'haPassword', 'haTopic'].map(key => (
            <InputWrapper key={key} id={key} label={key.replace('ha', 'MQTT ')}>
              <input
                type={key === 'haPort' ? 'number' : 'text'}
                className='input input-bordered'
                value={formData[key]}
                onChange={onChange(key)}
              />
            </InputWrapper>
          ))}
        </div>
      </PluginWrapper>
    </div>
  );
}
