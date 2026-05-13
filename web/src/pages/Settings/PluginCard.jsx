import { faTrashCan } from '@fortawesome/free-solid-svg-icons/faTrashCan';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { faMinus } from '@fortawesome/free-solid-svg-icons/faMinus';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import homekitImage from '../../assets/homekit.png';
import { useState } from 'preact/hooks';

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
  const homekitEnabled = homekitMode > 0;
  const [troubleshootingExpanded, setTroubleshootingExpanded] = useState(false);

  const handleHomekitToggle = () => {
    updateHomekitMode(homekitEnabled ? 0 : 1);
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

      <div className='bg-base-200 rounded-lg p-4'>
        <div className='flex items-center justify-between'>
          <span className='text-xl font-medium'>HomeKit Integration</span>
          <input
            type='checkbox'
            className='toggle toggle-primary'
            checked={homekitEnabled}
            onChange={handleHomekitToggle}
            aria-label='Enable HomeKit'
          />
        </div>

        {homekitEnabled && (
          <div className='border-base-300 mt-4 space-y-4 border-t pt-4'>
            <p className='text-sm opacity-70'>Control GaggiMate from the Apple Home app.</p>

            <div className='form-control'>
              <label className='mb-2 block text-sm font-medium opacity-70'>Integration mode</label>
              <div className='grid grid-cols-2 gap-2'>
                <button
                  type='button'
                  className={`btn btn-sm ${homekitMode === 1 ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => updateHomekitMode(1)}
                  aria-pressed={homekitMode === 1}
                >
                  Thermostat
                </button>
                <button
                  type='button'
                  className={`btn btn-sm ${homekitMode === 2 ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => updateHomekitMode(2)}
                  aria-pressed={homekitMode === 2}
                >
                  Bridge
                </button>
              </div>
            </div>

            <div className='bg-base-100 border-base-300 rounded-md border p-4 text-sm'>
              {homekitMode === 1 && (
                <p>
                  <strong>Thermostat mode:</strong> Emulates a thermostat for direct temperature
                  control.
                </p>
              )}
              {homekitMode === 2 && (
                <div>
                  <strong>Bridge mode:</strong> Exposes the machine capabilities as separate HomeKit
                  accessories.
                  <div className='border-base-300 mt-4 border-t pt-4'>
                    <p className='mb-3 text-sm font-medium opacity-70'>Enabled Accessories</p>

                    <div className='space-y-4'>
                      <div className='form-control'>
                        <label className='label cursor-pointer items-start justify-start gap-4'>
                          <input
                            id='hkPowerEnabled'
                            name='hkPowerEnabled'
                            type='checkbox'
                            className='toggle toggle-primary toggle-sm mt-1'
                            checked={formData.hkPowerEnabled !== false}
                            onChange={onChange('hkPowerEnabled')}
                          />
                          <div className='flex min-w-0 flex-1 flex-col'>
                            <span className='label-text font-medium'>Power Switch</span>
                            <span className='block text-xs whitespace-normal opacity-70'>
                              Controls the main machine state (Standby / Brew).
                            </span>
                          </div>
                        </label>
                      </div>

                      <div className='form-control'>
                        <label className='label cursor-pointer items-start justify-start gap-4'>
                          <input
                            id='hkSteamEnabled'
                            name='hkSteamEnabled'
                            type='checkbox'
                            className='toggle toggle-primary toggle-sm mt-1'
                            checked={formData.hkSteamEnabled !== false}
                            onChange={onChange('hkSteamEnabled')}
                          />
                          <div className='flex min-w-0 flex-1 flex-col'>
                            <span className='label-text font-medium'>Steam Switch</span>
                            <span className='block text-xs whitespace-normal opacity-70'>
                              Toggles the Steam Mode.
                            </span>
                          </div>
                        </label>
                      </div>

                      <div className='form-control'>
                        <label className='label cursor-pointer items-start justify-start gap-4'>
                          <input
                            id='hkSensorEnabled'
                            name='hkSensorEnabled'
                            type='checkbox'
                            className='toggle toggle-primary toggle-sm mt-1'
                            checked={formData.hkSensorEnabled !== false}
                            onChange={onChange('hkSensorEnabled')}
                          />
                          <div className='flex min-w-0 flex-1 flex-col'>
                            <span className='label-text font-medium'>Heating Sensor</span>
                            <span className='block text-xs whitespace-normal opacity-70'>
                              A contact sensor indicating boiler stability (Closed = Heating, Open =
                              Ready).
                            </span>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className='border-base-300 flex flex-col items-center justify-center gap-4 border-t pt-4'>
              <img
                src={homekitImage}
                alt='HomeKit Setup Code'
                className='h-auto max-h-[150px] w-auto max-w-full object-contain'
              />

              <div className='max-w-md space-y-2 text-center'>
                <p className='text-sm font-medium'>
                  Open the Home app, select Add Accessory, and scan the code above.
                </p>
              </div>
            </div>

            <div className='bg-base-100 border-base-300 rounded-box border'>
              <button
                type='button'
                className='flex w-full items-center gap-3 p-4 text-left text-sm font-medium'
                onClick={() => setTroubleshootingExpanded(expanded => !expanded)}
                aria-expanded={troubleshootingExpanded}
                aria-controls='homekit-troubleshooting'
              >
                <span className='border-base-content/20 text-base-content/60 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border'>
                  <FontAwesomeIcon
                    icon={troubleshootingExpanded ? faMinus : faPlus}
                    className='h-3 w-3'
                  />
                </span>
                <span>Troubleshooting</span>
              </button>
              {troubleshootingExpanded && (
                <div
                  id='homekit-troubleshooting'
                  className='text-base-content/70 space-y-3 px-4 pb-4 text-xs'
                >
                  <div>
                    <p className='mb-1 font-bold'>Devices do not update or connect:</p>
                    <ul className='ml-1 list-inside list-disc space-y-1'>
                      <li>
                        <b>Cycle the modes:</b> Switch mode &rarr; Save & Restart &rarr; Wait for
                        the Home app to refresh the GaggiMate devices &rarr; Switch back &rarr; Save
                        & Restart.
                      </li>
                    </ul>
                  </div>

                  <div>
                    <p className='mb-1 font-bold'>GaggiMate does not appear for pairing:</p>
                    <ul className='ml-1 list-inside list-disc space-y-1'>
                      <li>
                        Ensure no stale GaggiMate accessories remain in the Home app (check{' '}
                        <i>Home Settings &rarr; Home Hubs & Bridges</i>). If unsure, try cycling the
                        modes as described above.
                      </li>
                      <li className='mt-2 mb-1'>
                        <span className='font-semibold'>
                          Reset the HomeKit plugin via the console:
                        </span>
                        <ol className='mt-1 ml-2 list-inside list-decimal space-y-1'>
                          <li>
                            Connect your GaggiMate to the flashing web interface and open{' '}
                            <b>Logs & Console</b>.
                          </li>
                          <li>
                            In the console, send <code>?</code> to list available HomeKit commands.
                          </li>
                          <li>
                            Send <code>H</code> to perform a HomeKit reset (this clears pairing info
                            and restarts the accessory).
                          </li>
                          <li>Re-add GaggiMate in the Home app using the setup code.</li>
                        </ol>
                        <div className='mt-1 ml-2 opacity-90'>
                          If <code>H</code> is not available, check the console help (<code>?</code>
                          ). If this does not resolve your issue, you may need to do a full reset
                          with <code>E</code>.
                        </div>
                      </li>
                      <li className='text-error mt-2 font-bold'>
                        If GaggiMate still does not appear, perform a full display reset by
                        re-flashing the display via USB, as you would during the initial
                        installation. Back up your profiles and settings before continuing.
                      </li>
                    </ul>
                  </div>
                </div>
              )}
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
          <span className='text-xl font-medium'>Home Assistant over MQTT (Deprecated)</span>
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
              current state. This feature is deprecated for usage with Home Assistant. Please see
              the{' '}
              <a
                href='https://github.com/gaggimate/ha-integration'
                target='_blank'
                rel='noreferrer'
              >
                Home Assistant Integration
              </a>{' '}
              for a more up-to-date solution.
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
                Home Assistant Discovery Topic
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
