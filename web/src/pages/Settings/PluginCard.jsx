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
            
            <p className='text-sm opacity-70'>
              Control your machine via Apple Home.
            </p>

            {/* 1. MIGRATION WARNING */}
            <div className='alert alert-warning shadow-sm text-sm'>
              <div>
                <span className="font-bold">Important</span>
                <span className="block mt-1">
                  After the update, HomeKit might not establish a connection to the thermostat immediately. <b>Do NOT remove the device from Apple Home.</b> Instead, please refer to the <b>Troubleshooting</b> section below for instructions on how to cycle the integration modes if needed.
                </span>
              </div>
            </div>

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

            {/* Pairing Code */}
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
              </div>
            </div>

            {/* 3. COLLAPSIBLE TROUBLESHOOTING */}
            <details className="collapse collapse-arrow bg-base-100 border border-base-300 rounded-box">
                <summary className="collapse-title text-sm font-medium">
                    Troubleshooting: Connection Issues
                </summary>
                <div className="collapse-content text-xs text-base-content/70 space-y-3 pt-2">
                    
                    {/* Scenario 1: No Connection / Update */}
                    <div>
                        <p className="font-bold mb-1">Devices not updating or connecting:</p>
                        <ul className="list-disc list-inside ml-1 space-y-1">
                            <li>Try <b>Save & Restart</b> first.</li>
                            <li>
                                If issues persist, <b>cycle the modes</b>: 
                                Switch mode &rarr; Save & Restart &rarr; Wait for Apple Home to update GaggiMate devices 
                                (speed it up by tapping on one of the devices in the Home App and give it some time) 
                                &rarr; Switch back &rarr; Save & Restart.
                            </li>
                        </ul>
                    </div>

                    {/* Scenario 2: Pairing Issues */}
                    <div>
                        <p className="font-bold mb-1">GaggiMate does not appear for pairing:</p>
                        <ul className="list-disc list-inside ml-1 space-y-1">
                            <li>Check if any old GaggiMate devices still exist in your Home App and try the instructions above.</li>
                            <li>If that doesn't help, remove the device from the Home App and restart GaggiMate.</li>
                            <li className="text-error font-bold mt-2">
                                If GaggiMate still does not appear, you must reset the display. 
                                To do this, re-flash the display via USB (just like the initial installation). 
                                Don't forget to backup your profiles and settings first!
                            </li>
                        </ul>
                    </div>

                </div>
            </details>
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
