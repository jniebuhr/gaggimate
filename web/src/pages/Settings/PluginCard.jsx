import { faTrashCan } from '@fortawesome/free-solid-svg-icons/faTrashCan';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import homekitImage from '../../assets/homekit.png';

// Constants for field definitions and day mappings
const DAYS_OF_WEEK = [
  { short: 'M', full: 'Monday' },
  { short: 'T', full: 'Tuesday' },
  { short: 'W', full: 'Wednesday' },
  { short: 'Th', full: 'Thursday' },
  { short: 'F', full: 'Friday' },
  { short: 'S', full: 'Saturday' },
  { short: 'Su', full: 'Sunday' },
];

// Fields for Home Assistant plugin configuration
const HA_FIELDS = [
  { key: 'haIP', label: 'MQTT IP', type: 'text' },
  { key: 'haPort', label: 'MQTT Port', type: 'number' },
  { key: 'haUser', label: 'MQTT User', type: 'text' },
  { key: 'haPassword', label: 'MQTT Password', type: 'password' },
  { key: 'haTopic', label: 'MQTT Topic', type: 'text' },
];

// A simple checkbox styled as a toggle switch, with proper accessibility attributes
const CheckboxToggle = ({ checked, onChange, ariaLabel }) => (
  <input
    type='checkbox'
    className='toggle toggle-primary'
    checked={!!checked}
    onChange={onChange}
    aria-label={ariaLabel}
  />
);

// Wrapper for individual input fields with consistent styling and optional labels
const InputWrapper = ({ id, label, children }) => (
  <div className='form-control w-full'>
    {label && (
      <label htmlFor={id} className='mb-2 block text-sm font-medium'>
        {label}
      </label>
    )}
    {children}
  </div>
);

// Reusable component for each plugin section, handling the title, toggle, description, and actions
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

// Component to manage and display the list of automatic wakeup schedules, allowing time and day configuration
function AutoWakeupSchedules({ schedules, updateTime, updateDay, removeSchedule }) {
  if (!schedules || schedules.length === 0) return null;

  return (
    <div className='space-y-3'>
      {schedules.map(schedule => (
        <div key={schedule.id} className='flex items-center gap-2'>
          <div className='join border-base-content/20 hover:border-primary/50 overflow-hidden rounded-lg border shadow-sm transition-colors'>
            <input
              type='time'
              className='input join-item border-base-content/20 bg-base-100 h-8 min-h-0 w-[110px] border-0 border-r px-1 text-center text-sm focus:outline-none'
              value={schedule.time || '07:30'}
              onChange={e => updateTime(schedule.id, e.target.value)}
              aria-label='Schedule time'
            />
            <div className='join-item bg-base-100 flex'>
              {DAYS_OF_WEEK.map((day, dIdx) => (
                <button
                  key={`${schedule.id}-${day.short}`}
                  type='button'
                  className={`btn h-8 min-h-0 w-8 rounded-none border-y-0 border-l-0 p-0 last:border-r-0 ${
                    schedule.days[dIdx]
                      ? 'btn-primary ring-primary/30 focus-visible:ring-2'
                      : 'btn-ghost bg-base-300/50 border-r-base-content/10'
                  }`}
                  onClick={() => updateDay(schedule.id, dIdx, !schedule.days[dIdx])}
                  title={day.full}
                >
                  {day.short}
                </button>
              ))}
            </div>
          </div>
          <button
            type='button'
            onClick={() => removeSchedule(schedule.id)}
            disabled={schedules.length <= 1}
            className={`btn btn-ghost btn-xs transition-colors ${
              schedules.length <= 1
                ? 'text-base-content/30 cursor-not-allowed bg-transparent grayscale'
                : 'text-error hover:bg-error/10'
            }`}
            title={schedules.length <= 1 ? 'At least one schedule is required' : 'Remove schedule'}
          >
            <FontAwesomeIcon icon={faTrashCan} />
          </button>
        </div>
      ))}
    </div>
  );
}

// Main component that renders all plugin settings, utilizing the PluginWrapper for consistent layout and handling specific configurations for each plugin type
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
      {/* Automatic Wakeup */}
      <PluginWrapper
        title='Automatic Wakeup'
        enabled={formData.autowakeupEnabled}
        onToggle={onChange('autowakeupEnabled')}
        description='Automatically switch to brew mode at specified times.'
        actions={
          <button
            type='button'
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
            Open the Home app, select <b>Add Accessory</b>, and enter the setup code shown above.
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
              id='startupFillTime'
              type='number'
              className='input input-bordered w-full'
              value={formData.startupFillTime || ''}
              onChange={onChange('startupFillTime')}
            />
          </InputWrapper>
          <InputWrapper id='steamFillTime' label='On steam deactivate (seconds)'>
            <input
              id='steamFillTime'
              type='number'
              className='input input-bordered w-full'
              value={formData.steamFillTime || ''}
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
        description='Controls a Tasmota Plug to turn off your grinder when target weight is reached.'
      >
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <InputWrapper id='smartGrindIp' label='Tasmota IP'>
            <input
              id='smartGrindIp'
              type='text'
              className='input input-bordered w-full'
              placeholder='192.168.1.XX'
              value={formData.smartGrindIp || ''}
              onChange={onChange('smartGrindIp')}
            />
          </InputWrapper>
          <InputWrapper id='smartGrindMode' label='Mode'>
            <select
              id='smartGrindMode'
              className='select select-bordered w-full'
              value={formData.smartGrindMode || '0'}
              onChange={onChange('smartGrindMode')}
            >
              <option value='0'>Turn off at target</option>
              <option value='1'>Toggle off/on at target</option>
              <option value='2'>Manual start, auto stop</option>
            </select>
          </InputWrapper>
        </div>
      </PluginWrapper>

      {/* Home Assistant (Deprecated) */}
      <PluginWrapper
        title='Home Assistant (Legacy)'
        enabled={formData.homeAssistant}
        onToggle={onChange('homeAssistant')}
      >
        <div className='alert alert-info mb-4 py-2 text-xs'>
          <span>
            Legacy MQTT support. For modern setups, use the{' '}
            <a
              href='https://github.com/gaggimate/ha-integration'
              target='_blank'
              className='link font-bold'
            >
              Official Integration
            </a>
            .
          </span>
        </div>
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
          {HA_FIELDS.map(field => (
            <InputWrapper key={field.key} id={field.key} label={field.label}>
              <input
                id={field.key}
                type={field.type}
                autoComplete={field.type === 'password' ? 'new-password' : 'off'}
                className='input input-bordered w-full'
                value={formData[field.key] || ''}
                onChange={onChange(field.key)}
              />
            </InputWrapper>
          ))}
        </div>
      </PluginWrapper>
    </div>
  );
}
