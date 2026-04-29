import { faTrashCan, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import homekitImage from '../../assets/homekit.png';

export function PluginCard({
  formData,
  onChange,
  autowakeupSchedules,
  addAutoWakeupSchedule,
  removeAutoWakeupSchedule,
  updateAutoWakeupTime,
  updateAutoWakeupDay,
}) {
  return (
    <div className='flex flex-col gap-5'>
      {/* Automatic Wakeup Schedule */}
      <div className='nd-card p-4'>
        <div className='flex items-center justify-between'>
          <span className='font-nd-mono text-[16px] text-[var(--text-primary,#e8e8e8)]'>
            Automatic Wakeup Schedule
          </span>
          <button
            type='button'
            className={`nd-toggle ${formData.autowakeupEnabled ? 'nd-toggle--active' : ''}`}
            onClick={onChange('autowakeupEnabled')}
            role='switch'
            aria-checked={!!formData.autowakeupEnabled}
          >
            <span className='nd-toggle-thumb' />
          </button>
        </div>
        {formData.autowakeupEnabled && (
          <div className='mt-5 border-t border-[var(--home-border,#222)] pt-4'>
            <div className='font-nd-mono text-[13px] text-[var(--text-disabled,#666)] mb-4'>
              Automatically switch to brew mode at specified time(s) of day.
            </div>
            <div className='flex flex-col gap-4'>
              {autowakeupSchedules?.map((schedule, scheduleIndex) => (
                <div key={scheduleIndex} className='flex flex-wrap items-center gap-3'>
                  {/* Time input */}
                  <input
                    type='time'
                    className='nd-input'
                    style={{ width: 'auto', minWidth: '0' }}
                    value={schedule.time}
                    onChange={e => updateAutoWakeupTime(scheduleIndex, e.target.value)}
                    disabled={!formData.autowakeupEnabled}
                  />

                  {/* Days toggle buttons */}
                  <div className='flex gap-1' role='group' aria-label='Days of week selection'>
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((dayLabel, dayIndex) => (
                      <button
                        key={dayIndex}
                        type='button'
                        className={`nd-day-btn ${schedule.days[dayIndex] ? 'nd-day-btn--active' : ''}`}
                        onClick={() =>
                          updateAutoWakeupDay(scheduleIndex, dayIndex, !schedule.days[dayIndex])
                        }
                        disabled={!formData.autowakeupEnabled}
                        aria-pressed={schedule.days[dayIndex]}
                        aria-label={
                          [
                            'Monday',
                            'Tuesday',
                            'Wednesday',
                            'Thursday',
                            'Friday',
                            'Saturday',
                            'Sunday',
                          ][dayIndex]
                        }
                        title={
                          [
                            'Monday',
                            'Tuesday',
                            'Wednesday',
                            'Thursday',
                            'Friday',
                            'Saturday',
                            'Sunday',
                          ][dayIndex]
                        }
                      >
                        {dayLabel}
                      </button>
                    ))}
                  </div>

                  {/* Delete button */}
                  {autowakeupSchedules.length > 1 ? (
                    <button
                      type='button'
                      onClick={() => removeAutoWakeupSchedule(scheduleIndex)}
                      className='nd-action-btn'
                      style={{ width: '36px', height: '36px' }}
                      disabled={!formData.autowakeupEnabled}
                      title='Delete this schedule'
                    >
                      <FontAwesomeIcon icon={faTrashCan} />
                    </button>
                  ) : (
                    <div
                      className='nd-action-btn'
                      style={{ width: '36px', height: '36px', opacity: 0.3, cursor: 'not-allowed' }}
                      title='Cannot delete the last schedule'
                    >
                      <FontAwesomeIcon icon={faTrashCan} />
                    </div>
                  )}
                </div>
              ))}
              <button
                type='button'
                onClick={addAutoWakeupSchedule}
                className='nd-action-btn nd-action-btn--primary nd-action-btn--text'
                style={{ width: 'fit-content' }}
                disabled={!formData.autowakeupEnabled}
              >
                <FontAwesomeIcon icon={faPlus} />
                Add Schedule
              </button>
            </div>
          </div>
        )}
      </div>

      {/* HomeKit */}
      <div className='nd-card p-4'>
        <div className='flex items-center justify-between'>
          <span className='font-nd-mono text-[16px] text-[var(--text-primary,#e8e8e8)]'>
            HomeKit
          </span>
          <button
            type='button'
            className={`nd-toggle ${formData.homekit ? 'nd-toggle--active' : ''}`}
            onClick={onChange('homekit')}
            role='switch'
            aria-checked={!!formData.homekit}
          >
            <span className='nd-toggle-thumb' />
          </button>
        </div>
        {formData.homekit && (
          <div className='mt-5 flex flex-col items-center justify-center gap-4 border-t border-[var(--home-border,#222)] pt-4'>
            <img src={homekitImage} alt='HomeKit Setup Code' />
            <p className='font-nd-mono text-[13px] text-[var(--text-disabled,#666)] text-center'>
              Open the Home app on your iOS device, select Add Accessory, and enter the setup code
              shown above.
            </p>
          </div>
        )}
      </div>

      {/* Boiler Refill Plugin */}
      <div className='nd-card p-4'>
        <div className='flex items-center justify-between'>
          <span className='font-nd-mono text-[16px] text-[var(--text-primary,#e8e8e8)]'>
            Boiler Refill Plugin
          </span>
          <button
            type='button'
            className={`nd-toggle ${formData.boilerFillActive ? 'nd-toggle--active' : ''}`}
            onClick={onChange('boilerFillActive')}
            role='switch'
            aria-checked={!!formData.boilerFillActive}
          >
            <span className='nd-toggle-thumb' />
          </button>
        </div>
        {formData.boilerFillActive && (
          <div className='mt-5 grid grid-cols-2 gap-4 border-t border-[var(--home-border,#222)] pt-4'>
            <div className='flex flex-col gap-2'>
              <label
                htmlFor='startupFillTime'
                className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
              >
                On startup (s)
              </label>
              <input
                id='startupFillTime'
                name='startupFillTime'
                type='number'
                className='nd-input'
                placeholder='0'
                value={formData.startupFillTime}
                onChange={onChange('startupFillTime')}
              />
            </div>
            <div className='flex flex-col gap-2'>
              <label
                htmlFor='steamFillTime'
                className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
              >
                On steam deactivate (s)
              </label>
              <input
                id='steamFillTime'
                name='steamFillTime'
                type='number'
                className='nd-input'
                placeholder='0'
                value={formData.steamFillTime}
                onChange={onChange('steamFillTime')}
              />
            </div>
          </div>
        )}
      </div>

      {/* Smart Grind Plugin */}
      <div className='nd-card p-4'>
        <div className='flex items-center justify-between'>
          <span className='font-nd-mono text-[16px] text-[var(--text-primary,#e8e8e8)]'>
            Smart Grind Plugin
          </span>
          <button
            type='button'
            className={`nd-toggle ${formData.smartGrindActive ? 'nd-toggle--active' : ''}`}
            onClick={onChange('smartGrindActive')}
            role='switch'
            aria-checked={!!formData.smartGrindActive}
          >
            <span className='nd-toggle-thumb' />
          </button>
        </div>
        {formData.smartGrindActive && (
          <div className='mt-5 flex flex-col gap-4 border-t border-[var(--home-border,#222)] pt-4'>
            <div className='font-nd-mono text-[13px] text-[var(--text-disabled,#666)]'>
              This feature controls a Tasmota Plug to turn off your grinder after the target has
              been reached.
            </div>
            <div className='flex flex-col gap-2'>
              <label
                htmlFor='smartGrindIp'
                className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
              >
                Tasmota IP
              </label>
              <input
                id='smartGrindIp'
                name='smartGrindIp'
                type='text'
                className='nd-input'
                placeholder='0'
                value={formData.smartGrindIp}
                onChange={onChange('smartGrindIp')}
              />
            </div>
            <div className='flex flex-col gap-2'>
              <label
                htmlFor='smartGrindMode'
                className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
              >
                Mode
              </label>
              <select
                id='smartGrindMode'
                name='smartGrindMode'
                className='nd-input'
                onChange={onChange('smartGrindMode')}
              >
                <option value='0' selected={formData.smartGrindMode?.toString() === '0'}>
                  Turn off at target
                </option>
                <option value='1' selected={formData.smartGrindMode?.toString() === '1'}>
                  Toggle off and on at target
                </option>
                <option value='2' selected={formData.smartGrindMode?.toString() === '2'}>
                  Turn on at start, off at target
                </option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Home Assistant over MQTT (Deprecated) */}
      <div className='nd-card p-4'>
        <div className='flex items-center justify-between'>
          <span className='font-nd-mono text-[16px] text-[var(--text-primary,#e8e8e8)]'>
            Home Assistant over MQTT (Deprecated)
          </span>
          <button
            type='button'
            className={`nd-toggle ${formData.homeAssistant ? 'nd-toggle--active' : ''}`}
            onClick={onChange('homeAssistant')}
            role='switch'
            aria-checked={!!formData.homeAssistant}
          >
            <span className='nd-toggle-thumb' />
          </button>
        </div>
        {formData.homeAssistant && (
          <div className='mt-5 flex flex-col gap-4 border-t border-[var(--home-border,#222)] pt-4'>
            <div className='font-nd-mono text-[13px] text-[var(--text-disabled,#666)]'>
              This feature allows connection to a Home Assistant or MQTT installation and push the
              current state. This feature is deprecated for usage with Home Assistant. Please see
              the{' '}
              <a
                href='https://github.com/gaggimate/ha-integration'
                target='_blank'
                rel='noreferrer'
                className='text-[var(--color-primary,#d71921)]'
              >
                Home Assistant Integration
              </a>{' '}
              for a more up-to-date solution.
            </div>
            <div className='flex flex-col gap-2'>
              <label
                htmlFor='haIP'
                className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
              >
                MQTT IP
              </label>
              <input
                id='haIP'
                name='haIP'
                type='text'
                className='nd-input'
                placeholder='0'
                value={formData.haIP}
                onChange={onChange('haIP')}
              />
            </div>

            <div className='flex flex-col gap-2'>
              <label
                htmlFor='haPort'
                className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
              >
                MQTT Port
              </label>
              <input
                id='haPort'
                name='haPort'
                type='number'
                className='nd-input'
                placeholder='0'
                value={formData.haPort}
                onChange={onChange('haPort')}
              />
            </div>

            <div className='flex flex-col gap-2'>
              <label
                htmlFor='haUser'
                className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
              >
                MQTT User
              </label>
              <input
                id='haUser'
                name='haUser'
                type='text'
                className='nd-input'
                placeholder='user'
                value={formData.haUser}
                onChange={onChange('haUser')}
              />
            </div>

            <div className='flex flex-col gap-2'>
              <label
                htmlFor='haPassword'
                className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
              >
                MQTT Password
              </label>
              <input
                id='haPassword'
                name='haPassword'
                type='password'
                className='nd-input'
                placeholder='password'
                value={formData.haPassword}
                onChange={onChange('haPassword')}
              />
            </div>
            <div className='flex flex-col gap-2'>
              <label
                htmlFor='haTopic'
                className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
              >
                Home Assistant Discovery Topic
              </label>
              <input
                id='haTopic'
                name='haTopic'
                type='text'
                className='nd-input'
                value={formData.haTopic}
                onChange={onChange('haTopic')}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
