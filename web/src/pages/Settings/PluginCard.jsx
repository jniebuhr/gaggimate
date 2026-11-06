import { faTrashCan } from '@fortawesome/free-solid-svg-icons/faTrashCan';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import homekitImage from '../../assets/homekit.png';
import { faCalendarDays } from '@fortawesome/free-solid-svg-icons/faCalendarDays';
import { ApiServiceContext } from '../../services/ApiService.js';
import { useContext, useEffect, useState } from 'preact/hooks';
import { Trans, useLingui } from '@lingui/react/macro';
import { useProfileList } from '../../services/hooks.js';

const MAHLKONIG_MIN_RECIPES = 4;

// Profile per grinder recipe slot, stored as "r1,r2,..."; the grinder reports only the recipe number.
function MahlkonigRecipeProfiles({ formData, onChange }) {
  const { t } = useLingui();
  const apiService = useContext(ApiServiceContext);
  const [lastRecipe, setLastRecipe] = useState(null);
  const { profiles: allProfiles } = useProfileList();
  const profiles = allProfiles.filter(p => !p.utility);
  const mapped = String(formData.mahlkonigRecipeProfiles || '').split(',');
  const count = Math.max(MAHLKONIG_MIN_RECIPES, mapped.length, lastRecipe || 0);
  const recipes = Array.from({ length: count }, (_, i) => i + 1);

  useEffect(() => {
    apiService
      .request({ tp: 'req:mahlkonig:status' })
      .then(res => setLastRecipe(res.grind?.recipe || null))
      .catch(() => setLastRecipe(null));
  }, [apiService]);

  const setProfile = (recipe, value) => {
    const next = recipes.map(r => (r === recipe ? value : (mapped[r - 1] ?? '')));
    while (next.length > MAHLKONIG_MIN_RECIPES && !next[next.length - 1]) next.pop();
    onChange('mahlkonigRecipeProfiles')({ currentTarget: { value: next.join(',') } });
  };

  return (
    <div className='form-control'>
      <span className='mb-2 block text-sm font-medium'>
        <Trans>Profile per grinder recipe</Trans>
      </span>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
        {recipes.map(recipe => {
          const value = mapped[recipe - 1] ?? '';
          const missing = value && profiles.length > 0 && !profiles.some(p => p.id === value);
          return (
            <div key={recipe}>
              <label htmlFor={`mahlkonigRecipe${recipe}`} className='mb-1 block text-sm opacity-70'>
                <Trans>Recipe {recipe}</Trans>
              </label>
              <select
                id={`mahlkonigRecipe${recipe}`}
                className='select select-bordered w-full'
                value={value}
                onChange={e => setProfile(recipe, e.currentTarget.value)}
              >
                <option value=''>{t`Keep selected profile`}</option>
                {missing && <option value={value}>{t`Deleted profile`}</option>}
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
      <p className='mt-2 text-sm opacity-70'>
        {lastRecipe
          ? t`Your grinder last ground recipe ${lastRecipe}.`
          : t`Grind once with GbS to see which recipe number your grinder reports.`}{' '}
        <Trans>The profile's dose is saved to the shot history.</Trans>
      </p>
    </div>
  );
}

export function PluginCard({
  formData,
  onChange,
  autowakeupSchedules,
  addAutoWakeupSchedule,
  removeAutoWakeupSchedule,
  updateAutoWakeupTime,
  updateAutoWakeupDay,
}) {
  const { t } = useLingui();
  const dayNames = [
    t`Monday`,
    t`Tuesday`,
    t`Wednesday`,
    t`Thursday`,
    t`Friday`,
    t`Saturday`,
    t`Sunday`,
  ];
  const dayLetters = [
    t({ message: 'M', context: 'Monday, one letter' }),
    t({ message: 'T', context: 'Tuesday, one letter' }),
    t({ message: 'W', context: 'Wednesday, one letter' }),
    t({ message: 'T', context: 'Thursday, one letter' }),
    t({ message: 'F', context: 'Friday, one letter' }),
    t({ message: 'S', context: 'Saturday, one letter' }),
    t({ message: 'S', context: 'Sunday, one letter' }),
  ];
  return (
    <div className='space-y-4'>
      <div className='bg-base-200 rounded-lg p-4'>
        <div className='flex items-center justify-between'>
          <span className='text-xl font-medium'>
            <Trans>Automatic Wakeup Schedule</Trans>
          </span>
          <input
            id='autowakeupEnabled'
            name='autowakeupEnabled'
            value='autowakeupEnabled'
            type='checkbox'
            className='toggle toggle-primary'
            checked={!!formData.autowakeupEnabled}
            onChange={onChange('autowakeupEnabled')}
            aria-label={t`Enable Auto Wakeup`}
          />
        </div>
        {formData.autowakeupEnabled && (
          <div className='border-base-300 mt-4 space-y-4 border-t pt-4'>
            <p className='text-sm opacity-70'>
              <Trans>Automatically switch to brew mode at specified time(s) of day.</Trans>
            </p>
            <div className='form-control'>
              <label className='mb-2 block text-sm font-medium'>
                <Trans>Auto Wakeup Schedule</Trans>
              </label>
              <div className='space-y-2'>
                {autowakeupSchedules?.map((schedule, scheduleIndex) => (
                  <div
                    key={scheduleIndex}
                    className='flex flex-wrap items-center gap-1 md:flex-nowrap'
                  >
                    {/* Time input */}
                    <div className='grow-1 text-center sm:text-start'>
                      <input
                        type='time'
                        className='input input-bordered input-sm md:input-md w-auto min-w-0 pr-6 text-center'
                        value={schedule.time}
                        onChange={e => updateAutoWakeupTime(scheduleIndex, e.target.value)}
                        disabled={!formData.autowakeupEnabled}
                      />
                    </div>

                    {/* Days toggle buttons */}
                    <div
                      className='join flex grow-8'
                      role='group'
                      aria-label={t`Days of week selection`}
                    >
                      {dayLetters.map((dayLabel, dayIndex) => (
                        <button
                          key={dayIndex}
                          type='button'
                          className={`join-item btn btn-sm md:btn-md flex-grow ${schedule.days[dayIndex] ? 'btn-primary' : 'btn-neutral text-neutral-content/20'}`}
                          onClick={() =>
                            updateAutoWakeupDay(scheduleIndex, dayIndex, !schedule.days[dayIndex])
                          }
                          disabled={!formData.autowakeupEnabled}
                          aria-pressed={schedule.days[dayIndex]}
                          aria-label={dayNames[dayIndex]}
                          title={dayNames[dayIndex]}
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
                        className='btn btn-ghost btn-sm md:btn-md grow-1'
                        disabled={!formData.autowakeupEnabled}
                        title={t`Delete this schedule`}
                      >
                        <FontAwesomeIcon icon={faTrashCan} className='text-base' />
                      </button>
                    ) : (
                      <div
                        className='btn btn-ghost btn-sm md:btn-md grow-1 cursor-not-allowed opacity-30'
                        title={t`Cannot delete the last schedule`}
                      >
                        <FontAwesomeIcon icon={faTrashCan} className='text-base' />
                      </div>
                    )}
                  </div>
                ))}
                <button
                  type='button'
                  onClick={addAutoWakeupSchedule}
                  className='btn btn-primary btn-sm md:btn-md mt-2'
                  disabled={!formData.autowakeupEnabled}
                  aria-label={t`Add schedule`}
                  title={t`Add schedule`}
                >
                  <FontAwesomeIcon icon={faCalendarDays} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className='bg-base-200 rounded-lg p-4'>
        <div className='flex items-center justify-between'>
          <span className='text-xl font-medium'>HomeKit</span>
          <input
            id='homekit'
            name='homekit'
            value='homekit'
            type='checkbox'
            className='toggle toggle-primary'
            checked={!!formData.homekit}
            onChange={onChange('homekit')}
            aria-label={t`Enable HomeKit`}
          />
        </div>
        {formData.homekit && (
          <div className='border-base-300 mt-4 flex flex-col items-center justify-center gap-4 border-t pt-4'>
            <img src={homekitImage} alt={t`HomeKit Setup Code`} />
            <p className='text-center'>
              <Trans>
                Open the Home app on your iOS device, select Add Accessory, and enter the setup code
                shown above.
              </Trans>
            </p>
          </div>
        )}
      </div>

      <div className='bg-base-200 rounded-lg p-4'>
        <div className='flex items-center justify-between'>
          <span className='text-xl font-medium'>
            <Trans>Boiler Refill Plugin</Trans>
          </span>
          <input
            id='boilerFillActive'
            name='boilerFillActive'
            value='boilerFillActive'
            type='checkbox'
            className='toggle toggle-primary'
            checked={!!formData.boilerFillActive}
            onChange={onChange('boilerFillActive')}
            aria-label={t`Enable Boiler Refill`}
          />
        </div>
        {formData.boilerFillActive && (
          <div className='border-base-300 mt-4 grid grid-cols-2 gap-4 border-t pt-4'>
            <div className='form-control'>
              <label htmlFor='startupFillTime' className='mb-2 block text-sm font-medium'>
                <Trans>On startup (s)</Trans>
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
                <Trans>On steam deactivate (s)</Trans>
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
          <span className='text-xl font-medium'>
            <Trans>Smart Grind Plugin</Trans>
          </span>
          <input
            id='smartGrindActive'
            name='smartGrindActive'
            value='smartGrindActive'
            type='checkbox'
            className='toggle toggle-primary'
            checked={!!formData.smartGrindActive}
            onChange={onChange('smartGrindActive')}
            aria-label={t`Enable Smart Grind`}
          />
        </div>
        {formData.smartGrindActive && (
          <div className='border-base-300 mt-4 space-y-4 border-t pt-4'>
            <p className='text-sm opacity-70'>
              <Trans>
                This feature controls a Tasmota Plug to turn off your grinder after the target has
                been reached.
              </Trans>
            </p>
            <div className='form-control'>
              <label htmlFor='smartGrindIp' className='mb-2 block text-sm font-medium'>
                <Trans>Tasmota IP</Trans>
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
                <Trans context='smart grind mode'>Mode</Trans>
              </label>
              <select
                id='smartGrindMode'
                name='smartGrindMode'
                className='select select-bordered w-full'
                onChange={onChange('smartGrindMode')}
              >
                <option value='0' selected={formData.smartGrindMode?.toString() === '0'}>
                  {t`Turn off at target`}
                </option>
                <option value='1' selected={formData.smartGrindMode?.toString() === '1'}>
                  {t`Toggle off and on at target`}
                </option>
                <option value='2' selected={formData.smartGrindMode?.toString() === '2'}>
                  {t`Turn on at start, off at target`}
                </option>
              </select>
            </div>
          </div>
        )}
      </div>

      <div className='bg-base-200 rounded-lg p-4'>
        <div className='flex items-center justify-between'>
          <span className='text-xl font-medium'>Mahlkönig E64 WS Grind-by-Sync</span>
          <input
            id='mahlkonigActive'
            name='mahlkonigActive'
            value='mahlkonigActive'
            type='checkbox'
            className='toggle toggle-primary'
            checked={!!formData.mahlkonigActive}
            onChange={onChange('mahlkonigActive')}
            aria-label={t`Enable Mahlkönig E64 WS Grind-by-Sync`}
          />
        </div>
        {formData.mahlkonigActive && (
          <div className='border-base-300 mt-4 space-y-4 border-t pt-4'>
            <p className='text-sm opacity-70'>
              <Trans>
                Lets an E64 WS start shots with its knob and dial in its grind from the shot time
                and weight. A grind selects the profile mapped to its recipe, and the grinder's
                target weight overrides that profile's weight target. Save and restart to apply.
              </Trans>
            </p>
            <div className='form-control'>
              <span className='mb-2 block text-sm font-medium'>
                <Trans>Machine address for the grinder</Trans>
              </span>
              <code className='bg-base-300 rounded px-2 py-1 text-lg'>
                {formData.deviceIp || t`Not connected to Wi-Fi`}
              </code>
              <div className='mt-2 text-sm opacity-70'>
                <Trans>
                  The grinder reaches GaggiMate at this address, so both need to share a network
                  (the E64 WS is 2.4 GHz only) and the address must not change: reserve it for
                  GaggiMate in your router.
                </Trans>
              </div>
            </div>
            <div className='space-y-1 text-sm opacity-70'>
              <div>
                <Trans>
                  <span className='font-medium'>Pairing:</span> GaggiMate shows up to the grinder as
                  a Xenia machine. Under Settings → Connectivity → Machine To Machine, turn on
                  Enable Xenia, then type the address above into Configuration. Automatic discovery
                  does not see GaggiMate.
                </Trans>
              </div>
              <div>
                <Trans>
                  <span className='font-medium'>Brewing:</span> recipes with GbS turned on report
                  each grind here; pressing the rotary knob afterwards starts the shot.
                </Trans>
              </div>
            </div>
            <MahlkonigRecipeProfiles formData={formData} onChange={onChange} />
            <div className='text-xs opacity-50'>
              <Trans>
                GaggiMate is not affiliated with, endorsed by or supported by Mahlkönig or its
                parent company, the Hemro Group. Mahlkönig, E64 WS, Grind-by-Sync and Xenia are
                trademarks of their respective owners.
              </Trans>
            </div>
          </div>
        )}
      </div>

      <div className='bg-base-200 rounded-lg p-4'>
        <div className='flex items-center justify-between'>
          <span className='text-xl font-medium'>
            <Trans>Home Assistant over MQTT (Deprecated)</Trans>
          </span>
          <input
            id='homeAssistant'
            name='homeAssistant'
            value='homeAssistant'
            type='checkbox'
            className='toggle toggle-primary'
            checked={!!formData.homeAssistant}
            onChange={onChange('homeAssistant')}
            aria-label={t`Enable Home Assistant`}
          />
        </div>
        {formData.homeAssistant && (
          <div className='border-base-300 mt-4 space-y-4 border-t pt-4'>
            <p className='text-sm opacity-70'>
              <Trans>
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
              </Trans>
            </p>
            <div className='form-control'>
              <label htmlFor='haIP' className='mb-2 block text-sm font-medium'>
                <Trans>MQTT IP</Trans>
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
                <Trans>MQTT Port</Trans>
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
                <Trans>MQTT User</Trans>
              </label>
              <input
                id='haUser'
                name='haUser'
                type='text'
                className='input input-bordered w-full'
                placeholder={t`user`}
                value={formData.haUser}
                onChange={onChange('haUser')}
              />
            </div>

            <div className='form-control'>
              <label htmlFor='haPassword' className='mb-2 block text-sm font-medium'>
                <Trans>MQTT Password</Trans>
              </label>
              <input
                id='haPassword'
                name='haPassword'
                type='password'
                className='input input-bordered w-full'
                placeholder={t`password`}
                value={formData.haPassword}
                onChange={onChange('haPassword')}
              />
            </div>
            <div className='form-control'>
              <label htmlFor='haTopic' className='mb-2 block text-sm font-medium'>
                <Trans>Home Assistant Discovery Topic</Trans>
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
