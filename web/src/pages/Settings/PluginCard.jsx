import homekitImage from '../../assets/homekit.png';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons/faTrashCan';
import { useState, useEffect } from 'preact/hooks';

export function PluginCard({
  formData,
  onChange,
  updateHomekitMode,
  autowakeupSchedules,
  addAutoWakeupSchedule,
  removeAutoWakeupSchedule,
  updateAutoWakeupTime,
  updateAutoWakeupDay,
}) {

 const homekitMode = parseInt(formData.homekitMode, 10) || 0;

  // state exposing
  const [isHomekitOpen, setIsHomekitOpen] = useState(homekitMode > 0);

  // sync
  useEffect(() => {
    if (homekitMode > 0) {
      setIsHomekitOpen(true);
    }
  }, [homekitMode]);

  const handleHomekitToggle = () => {
    const nextState = !isHomekitOpen;
    setIsHomekitOpen(nextState);
    if (!nextState) {
      updateHomekitMode(0);
    } else if (homekitMode === 0) {
      updateHomekitMode(1);
    }
  };

  return (
    <div className='space-y-4'>
      <div className='bg-base-200 rounded-lg p-4'>
        <div className='flex items-center justify-between'>
          <span className='text-xl font-medium'>Automatic Wakeup Schedule</span>
          <input
            id='autowakeupEnabled'
            name='autowakeupEnabled'
            value='autowakeupEnabled'
            type='checkbox'
            className='toggle toggle-primary'
            checked={!!formData.autowakeupEnabled}
            onChange={onChange('autowakeupEnabled')}
            aria-label='Enable Auto Wakeup'
          />
        </div>
        {formData.autowakeupEnabled && (
          <div className='border-base-300 mt-4 space-y-4 border-t pt-4'>
            <p className='text-sm opacity-70'>
              Automatically switch to brew mode at specified time(s) of day.
            </p>
            <div className='form-control'>
              <label className='mb-2 block text-sm font-medium'>Auto Wakeup Schedule</label>
              <div className='space-y-2'>
                {autowakeupSchedules?.map((schedule, scheduleIndex) => (
                  <div key={scheduleIndex} className='flex flex-wrap items-center gap-1'>
                    {/* Time input */}
                    <input
                      type='time'
                      className='input input-bordered input-sm w-auto min-w-0 pr-6'
                      value={schedule.time}
                      onChange={e => updateAutoWakeupTime(scheduleIndex, e.target.value)}
                      disabled={!formData.autowakeupEnabled}
                    />

                    {/* Days toggle buttons */}
                    <div className='join' role='group' aria-label='Days of week selection'>
                      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((dayLabel, dayIndex) => (
                        <button
                          key={dayIndex}
                          type='button'
                          className={`join-item btn btn-xs ${schedule.days[dayIndex] ? 'btn-primary' : 'btn-outline'}`}
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
                        className='btn btn-ghost btn-xs'
                        disabled={!formData.autowakeupEnabled}
                        title='Delete this schedule'
                      >
                        <FontAwesomeIcon icon={faTrashCan} className='text-xs' />
                      </button>
                    ) : (
                      <div
                        className='btn btn-ghost btn-xs cursor-not-allowed opacity-30'
                        title='Cannot delete the last schedule'
                      >
                        <FontAwesomeIcon icon={faTrashCan} className='text-xs' />
                      </div>
                    )}
                  </div>
                ))}
                <button
                  type='button'
                  onClick={addAutoWakeupSchedule}
                  className='btn btn-primary btn-sm'
                  disabled={!formData.autowakeupEnabled}
                >
                  Add Schedule
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/*homekit*/}
      <div className='bg-base-200 rounded-lg p-4'>
        <div className='flex items-center justify-between'>
          <span className='text-xl font-medium'>HomeKit Integration</span>
          <input
            type='checkbox'
            className='toggle toggle-primary'
            checked={isHomekitOpen}
            onChange={handleHomekitToggle}
          />
        </div>

        {isHomekitOpen && (
          <div className='border-base-300 mt-4 space-y-4 border-t pt-4'>
            <div className='form-control'>
              <label className='mb-2 block text-sm font-medium opacity-70'>Select Integration Mode</label>
              <div className='grid grid-cols-2 gap-2'>
                <button
                  type='button'
                  className={`btn btn-sm ${homekitMode === 1 ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => updateHomekitMode(1)}
                >
                  Thermostat
                </button>
                <button
                  type='button'
                  className={`btn btn-sm ${homekitMode === 2 ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => updateHomekitMode(2)}
                >
                  Bridge
                </button>
              </div>
            </div>

            {/* Descriptions */}
            <div className='text-sm bg-base-100 p-4 rounded-md shadow-sm border border-base-300'>
              {homekitMode === 1 && (
                <p><strong>Thermostat Mode:</strong> Emulates a thermostat for direct temperature control (as before).</p>
              )}
              {homekitMode === 2 && (
                <div>
                  <strong>Bridge Mode:</strong> Creates multiple devices:
                  <ul className='list-disc list-inside mt-2 ml-1 space-y-1 text-sm'>
                    <li>Sensor that reflects the heating status (red / heating = closed, green / ready = open)</li>
                    <li>Switch for Standby - Brew</li>
                    <li>Switch for Brew - Steam</li>
                  </ul>
                </div>
              )}
            </div>

            {/* Troubleshooting */}
            <div className='text-xs opacity-70'>
              <p>
                If HomeKit is not responding, try restarting first. If issues persist, cycle the modes: 
                Switch mode &rarr; Restart &rarr; Wait for Apple Home update &rarr; Switch back &rarr; Restart.
              </p>
            </div>

            {/* Pairing Code, Note and Reset Button */}
            <div className='flex flex-col items-center justify-center gap-4 pt-4 border-t border-base-300'>
              <img 
                src={homekitImage} 
                alt='Homekit Setup Code' 
                className='h-auto w-auto max-w-full object-contain'
                style={{ maxHeight: '150px' }} 
              />
              
              <div className='text-center space-y-2 max-w-md'>
                 <p className='text-sm font-medium'>
                  Open the Home app, select Add Accessory, and scan the code above.
                </p>

                {/* Note */}
                <div className='text-xs bg-base-300 p-3 rounded text-left mt-2 opacity-80'>
                    Note, that if the GaggiMate does not appear for pairing, reset HomeKit pairings. 
                    If this does not help, the display may need to be reset. 
                    To do this, you must reflash the display via USB. (Remember to back up your profiles and settings). 
                    Also remove the existing bridge or devices from GaggiMate from your Home app.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className='bg-base-200 rounded-lg p-4'>
        <div className='flex items-center justify-between'>
          <span className='text-xl font-medium'>Boiler Refill Plugin</span>
          <input
            id='boilerFillActive'
            name='boilerFillActive'
            value='boilerFillActive'
            type='checkbox'
            className='toggle toggle-primary'
            checked={!!formData.boilerFillActive}
            onChange={onChange('boilerFillActive')}
            aria-label='Enable Boiler Refill'
          />
        </div>
        {formData.boilerFillActive && (
          <div className='border-base-300 mt-4 grid grid-cols-2 gap-4 border-t pt-4'>
            <div className='form-control'>
              <label htmlFor='startupFillTime' className='mb-2 block text-sm font-medium'>
                On startup (s)
              </label>
              <input
                id='startupFillTime'
                name='startupFillTime'
                type='number'
                className='input input-bordered w-full'
                placeholder='0'
                value={formData.startupFillTime}
                onChange={onChange('startupFillTime')}
              />
            </div>
            <div className='form-control'>
              <label htmlFor='steamFillTime' className='mb-2 block text-sm font-medium'>
                On steam deactivate (s)
              </label>
              <input
                id='steamFillTime'
                name='steamFillTime'
                type='number'
                className='input input-bordered w-full'
                placeholder='0'
                value={formData.steamFillTime}
                onChange={onChange('steamFillTime')}
              />
            </div>
          </div>
        )}
      </div>

      <div className='bg-base-200 rounded-lg p-4'>
        <div className='flex items-center justify-between'>
          <span className='text-xl font-medium'>Smart Grind Plugin</span>
          <input
            id='smartGrindActive'
            name='smartGrindActive'
            value='smartGrindActive'
            type='checkbox'
            className='toggle toggle-primary'
            checked={!!formData.smartGrindActive}
            onChange={onChange('smartGrindActive')}
            aria-label='Enable Smart Grind'
          />
        </div>
        {formData.smartGrindActive && (
          <div className='border-base-300 mt-4 space-y-4 border-t pt-4'>
            <p className='text-sm opacity-70'>
              This feature controls a Tasmota Plug to turn off your grinder after the target has
              been reached.
            </p>
            <div className='form-control'>
              <label htmlFor='smartGrindIp' className='mb-2 block text-sm font-medium'>
                Tasmota IP
              </label>
              <input
                id='smartGrindIp'
                name='smartGrindIp'
                type='text'
                className='input input-bordered w-full'
                placeholder='0'
                value={formData.smartGrindIp}
                onChange={onChange('smartGrindIp')}
              />
            </div>
            <div className='form-control'>
              <label htmlFor='smartGrindMode' className='mb-2 block text-sm font-medium'>
                Mode
              </label>
              <select
                id='smartGrindMode'
                name='smartGrindMode'
                className='select select-bordered w-full'
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

      <div className='bg-base-200 rounded-lg p-4'>
        <div className='flex items-center justify-between'>
          <span className='text-xl font-medium'>Home Assistant (MQTT)</span>
          <input
            id='homeAssistant'
            name='homeAssistant'
            value='homeAssistant'
            type='checkbox'
            className='toggle toggle-primary'
            checked={!!formData.homeAssistant}
            onChange={onChange('homeAssistant')}
            aria-label='Enable Home Assistant'
          />
        </div>
        {formData.homeAssistant && (
          <div className='border-base-300 mt-4 space-y-4 border-t pt-4'>
            <p className='text-sm opacity-70'>
              This feature allows connection to a Home Assistant or MQTT installation and push the
              current state.
            </p>
            <div className='form-control'>
              <label htmlFor='haIP' className='mb-2 block text-sm font-medium'>
                MQTT IP
              </label>
              <input
                id='haIP'
                name='haIP'
                type='text'
                className='input input-bordered w-full'
                placeholder='0'
                value={formData.haIP}
                onChange={onChange('haIP')}
              />
            </div>

            <div className='form-control'>
              <label htmlFor='haPort' className='mb-2 block text-sm font-medium'>
                MQTT Port
              </label>
              <input
                id='haPort'
                name='haPort'
                type='number'
                className='input input-bordered w-full'
                placeholder='0'
                value={formData.haPort}
                onChange={onChange('haPort')}
              />
            </div>

            <div className='form-control'>
              <label htmlFor='haUser' className='mb-2 block text-sm font-medium'>
                MQTT User
              </label>
              <input
                id='haUser'
                name='haUser'
                type='text'
                className='input input-bordered w-full'
                placeholder='user'
                value={formData.haUser}
                onChange={onChange('haUser')}
              />
            </div>

            <div className='form-control'>
              <label htmlFor='haPassword' className='mb-2 block text-sm font-medium'>
                MQTT Password
              </label>
              <input
                id='haPassword'
                name='haPassword'
                type='password'
                className='input input-bordered w-full'
                placeholder='password'
                value={formData.haPassword}
                onChange={onChange('haPassword')}
              />
            </div>
            <div className='form-control'>
              <label htmlFor='haTopic' className='mb-2 block text-sm font-medium'>
                Home Assistant Autodiscovery Topic
              </label>
              <input
                id='haTopic'
                name='haTopic'
                type='text'
                className='input input-bordered w-full'
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
