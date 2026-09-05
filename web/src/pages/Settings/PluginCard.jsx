import { faTrashCan } from '@fortawesome/free-solid-svg-icons/faTrashCan';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import homekitImage from '../../assets/homekit.png';
import { faCalendarDays } from '@fortawesome/free-solid-svg-icons/faCalendarDays';
import { computed } from '@preact/signals';
import { useEffect, useState, useContext } from 'preact/hooks';
import { machine, ApiServiceContext, updateSettingsCache } from '../../services/ApiService.js';
import { parseBinaryIndex, indexToShotList } from '../ShotHistory/parseBinaryIndex.js';
import { faPrint } from '@fortawesome/free-solid-svg-icons/faPrint';
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons/faChevronLeft';
import { faChevronRight } from '@fortawesome/free-solid-svg-icons/faChevronRight';

const gearpumpAddon = computed(() => machine.value.capabilities.gearpumpAddon);

function formatShotDateTime(timestamp) {
  if (!timestamp || timestamp < 10000) return '';
  return new Date(timestamp * 1000).toLocaleString([]);
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
  const apiService = useContext(ApiServiceContext);
  const [shots, setShots] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0); // 0 = latest shot (default)
  const [printing, setPrinting] = useState(false);
  const [printStatus, setPrintStatus] = useState('');
  const [uploadFailure, setUploadFailure] = useState('');

  // Show a reminder below the print button when a shot exhausts all upload
  // retries (fired by ShotUploadPlugin as evt:shot-upload:failed).
  useEffect(() => {
    const id = apiService.on('evt:shot-upload:failed', msg => {
      setUploadFailure(msg?.msg ?? 'Upload failed after all retry attempts');
    });
    return () => apiService.off('evt:shot-upload:failed', id);
  }, [apiService]);

  // Load the most recent shots when the plugin is enabled (needed for the
  // "print a past shot" picker). Same truncated index endpoint as RecentShotsCard.
  useEffect(() => {
    if (!formData.shotUploadEnabled) return;
    let cancelled = false;
    fetch('/api/history/recent.bin?limit=20')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.arrayBuffer();
      })
      .then(buf => indexToShotList(parseBinaryIndex(buf)))
      .then(list => {
        if (!cancelled) {
          setShots(list);
          setSelectedIndex(0);
        }
      })
      .catch(() => {
        if (!cancelled) setShots([]);
      });
    return () => {
      cancelled = true;
    };
  }, [formData.shotUploadEnabled]);

  const selectCount = shots.length + 1; // +1 for the "latest shot" entry
  const selectOlderShot = () => setSelectedIndex(i => (i + 1) % selectCount);
  const selectNewerShot = () => setSelectedIndex(i => (i - 1 + selectCount) % selectCount);

  const startPrint = async () => {
    if (printing) return;
    setPrinting(true);
    setPrintStatus('');
    setUploadFailure('');
    try {
      const shot = selectedIndex > 0 ? shots[selectedIndex - 1] : null;
      const res = await apiService.request({
        tp: 'req:shot-upload:start',
        ...(shot ? { id: shot.id } : {}),
      });
      if (res?.success) {
        setPrintStatus(
          `Queued shot #${String(res.shotId ?? (shot ? shot.id : 'latest')).padStart(6, '0')} for upload`,
        );
      } else {
        setPrintStatus(`Failed: ${res?.msg ?? 'unknown error'}`);
      }
    } catch (err) {
      setPrintStatus(`Failed: ${err?.message ?? 'connection error'}`);
    } finally {
      setPrinting(false);
    }
  };

  // Save just this card's fields (enable toggle, server URL, machine id) so a
  // change takes effect without hunting for the page-level Save Settings
  // button. Same /api/settings multipart contract the main form uses.
  const [savingShotUpload, setSavingShotUpload] = useState(false);
  const [savedShotUpload, setSavedShotUpload] = useState(false);
  const saveShotUpload = async () => {
    if (savingShotUpload) return;
    setSavingShotUpload(true);
    setSavedShotUpload(false);
    try {
      const form = new FormData();
      if (formData.shotUploadEnabled) form.set('shotUploadEnabled', '1');
      if (formData.shotUploadServer) form.set('shotUploadServer', formData.shotUploadServer);
      if (formData.shotUploadMachineId) form.set('shotUploadMachineId', formData.shotUploadMachineId);
      const res = await fetch('/api/settings', { method: 'post', body: form });
      if (res.ok) {
        updateSettingsCache(await res.json());
        setSavedShotUpload(true);
        setTimeout(() => setSavedShotUpload(false), 2500);
      }
    } catch (err) {
      setSavedShotUpload(false);
    } finally {
      setSavingShotUpload(false);
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
                      aria-label='Days of week selection'
                    >
                      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((dayLabel, dayIndex) => (
                        <button
                          key={dayIndex}
                          type='button'
                          className={`join-item btn btn-sm md:btn-md flex-grow ${schedule.days[dayIndex] ? 'btn-primary' : 'btn-neutral text-neutral-content/20'}`}
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
                        className='btn btn-ghost btn-sm md:btn-md grow-1'
                        disabled={!formData.autowakeupEnabled}
                        title='Delete this schedule'
                      >
                        <FontAwesomeIcon icon={faTrashCan} className='text-base' />
                      </button>
                    ) : (
                      <div
                        className='btn btn-ghost btn-sm md:btn-md grow-1 cursor-not-allowed opacity-30'
                        title='Cannot delete the last schedule'
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
                  aria-label='Add schedule'
                  title='Add schedule'
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
            aria-label='Enable HomeKit'
          />
        </div>
        {formData.homekit && (
          <div className='border-base-300 mt-4 flex flex-col items-center justify-center gap-4 border-t pt-4'>
            <img src={homekitImage} alt='HomeKit Setup Code' />
            <p className='text-center'>
              Open the Home app on your iOS device, select Add Accessory, and enter the setup code
              shown above.
            </p>
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

      <div className='bg-base-200 rounded-lg p-4'>
        <div className='flex items-center justify-between'>
          <span className='text-xl font-medium'>Print The Shot</span>
          <input
            id='shotUploadEnabled'
            name='shotUploadEnabled'
            value='shotUploadEnabled'
            type='checkbox'
            className='toggle toggle-primary'
            checked={!!formData.shotUploadEnabled}
            onChange={onChange('shotUploadEnabled')}
            aria-label='Enable Print The Shot'
          />
        </div>
        {formData.shotUploadEnabled && (
          <div className='border-base-300 mt-4 space-y-4 border-t pt-4'>
            <p className='text-sm opacity-70'>
              Automatically uploads every newly completed shot as Decent-format JSON to a local
              server (e.g. a PrintTheShot server). Shots that fail to upload are dropped (not
              queued), so nothing is re-uploaded on the next boot.
            </p>
            <div className='form-control'>
              <label htmlFor='shotUploadServer' className='mb-2 block text-sm font-medium'>
                Server URL
              </label>
              <input
                id='shotUploadServer'
                name='shotUploadServer'
                type='text'
                className='input input-bordered w-full'
                placeholder='192.168.1.5:8000'
                value={formData.shotUploadServer}
                onChange={onChange('shotUploadServer')}
              />
            </div>

            <div className='form-control'>
              <label htmlFor='shotUploadMachineId' className='mb-2 block text-sm font-medium'>
                Machine ID (shown on the server)
              </label>
              <input
                id='shotUploadMachineId'
                name='shotUploadMachineId'
                type='text'
                className='input input-bordered w-full'
                placeholder='Gaggimate'
                value={formData.shotUploadMachineId}
                onChange={onChange('shotUploadMachineId')}
              />
            </div>

            <div className='form-control'>
              <label htmlFor='shotUploadRetries' className='mb-2 block text-sm font-medium'>
                Retry attempts
              </label>
              <input
                id='shotUploadRetries'
                name='shotUploadRetries'
                type='number'
                min='0'
                max='10'
                className='input input-bordered w-full'
                value={formData.shotUploadRetries ?? 3}
                onChange={onChange('shotUploadRetries')}
              />
            </div>

            <div className='flex items-center gap-2'>
              <button
                type='button'
                className='btn btn-outline btn-sm'
                disabled={savingShotUpload}
                onClick={saveShotUpload}
              >
                Save Settings
              </button>
              {savedShotUpload && <span className='text-sm text-success'>Saved ✓</span>}
              <span className='text-sm opacity-50'>
                Changes apply after saving (or via the page's Save Settings button).
              </span>
            </div>

            <div className='border-base-300 space-y-3 border-t border-dashed pt-4'>
              <span className='text-lg font-medium'>Print a past shot</span>
              <div className='flex items-center gap-2'>
                <button
                  type='button'
                  className='btn btn-outline btn-sm'
                  onClick={selectOlderShot}
                  aria-label='Older shot'
                >
                  <FontAwesomeIcon icon={faChevronLeft} />
                </button>
                <select
                  className='select select-bordered select-sm w-full'
                  value={selectedIndex}
                  onChange={e => setSelectedIndex(Number(e.currentTarget.value))}
                >
                  <option value={0}>Latest shot (default)</option>
                  {shots.map((shot, i) => (
                    <option key={shot.id} value={i + 1}>
                      #{shot.id} · {formatShotDateTime(shot.timestamp)} · {shot.profile}
                    </option>
                  ))}
                </select>
                <button
                  type='button'
                  className='btn btn-outline btn-sm'
                  onClick={selectNewerShot}
                  aria-label='Newer shot'
                >
                  <FontAwesomeIcon icon={faChevronRight} />
                </button>
              </div>
              <div className='flex items-center gap-2'>
                <button
                  type='button'
                  className='btn btn-primary btn-sm'
                  disabled={printing}
                  onClick={startPrint}
                >
                  <FontAwesomeIcon icon={faPrint} className='mr-1' />
                  Print The Shot
                </button>
                {printStatus && <span className='text-sm opacity-70'>{printStatus}</span>}
              </div>
              {uploadFailure && (
                <p className='text-error text-sm'>
                  {uploadFailure} — check the Server URL and that the server is reachable.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {gearpumpAddon.value && (
        <div className='bg-base-200 rounded-lg p-4'>
          <div className='flex items-center justify-between'>
            <span className='text-xl font-medium'>BLDC Pump Settings</span>
          </div>
          <div className='border-base-300 mt-4 space-y-4 border-t pt-4'>
            <p className='text-sm opacity-70'>
              The BLDC pump addon was detected in your system. You can change the pump control
              characteristics using the values below.
            </p>

            <div className='form-control'>
              <label htmlFor='commutationGain' className='mb-2 block text-sm font-medium'>
                Commutation Gain
              </label>
              <input
                id='commutationGain'
                name='commutationGain'
                type='number'
                className='input input-bordered w-full'
                placeholder='0'
                min='0'
                max='100'
                step='any'
                value={formData.commutationGain?.toString()}
                onChange={onChange('commutationGain')}
              />
            </div>

            <div className='form-control'>
              <label htmlFor='convergenceGain' className='mb-2 block text-sm font-medium'>
                Convergence Gain
              </label>
              <input
                id='convergenceGain'
                name='convergenceGain'
                type='number'
                className='input input-bordered w-full'
                placeholder='0'
                min='0'
                max='100'
                step='any'
                value={formData.convergenceGain?.toString()}
                onChange={onChange('convergenceGain')}
              />
            </div>

            <div className='form-control'>
              <label htmlFor='integralGain' className='mb-2 block text-sm font-medium'>
                Integral Gain
              </label>
              <input
                id='integralGain'
                name='integralGain'
                type='number'
                className='input input-bordered w-full'
                placeholder='0'
                min='0'
                max='100'
                step='any'
                value={formData.integralGain?.toString()}
                onChange={onChange('integralGain')}
              />
            </div>
            <div className='form-control'>
              <label htmlFor='maxPumpPower' className='mb-2 block text-sm font-medium'>
                Maximum Pump Power (0 - 1)
              </label>
              <input
                id='maxPumpPower'
                name='maxPumpPower'
                type='number'
                placeholder='0'
                min='0'
                max='1'
                step='any'
                className='input input-bordered w-full'
                value={formData.maxPumpPower?.toString()}
                onChange={onChange('maxPumpPower')}
              />
            </div>
            <div className='form-control'>
              <label htmlFor='pumpSlipCoeffs' className='mb-2 block text-sm font-medium'>
                Pump Slip Coefficients
              </label>
              <input
                id='pumpSlipCoeffs'
                name='pumpSlipCoeffs'
                type='text'
                className='input input-bordered w-full'
                placeholder='0,0,0,0'
                value={formData.pumpSlipCoeffs}
                onChange={onChange('pumpSlipCoeffs')}
              />
              <span className='mt-1 text-xs opacity-70'>
                Pressure polynomial (a,b,c,d) for vane-/gear-pump internal leakage. Leave at 0,0,0,0
                if uncalibrated.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
