import { faFileExport } from '@fortawesome/free-solid-svg-icons/faFileExport';
import { faFileImport } from '@fortawesome/free-solid-svg-icons/faFileImport';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { computed } from '@preact/signals';
import { useQuery } from 'preact-fetching';
import { useCallback, useContext, useEffect, useRef, useState } from 'preact/hooks';
import Card from '../../components/Card.jsx';
import { Spinner } from '../../components/Spinner.jsx';
import {
  InputGroupField,
  SettingsFormField,
  ToggleField,
} from '../../components/SettingsFormField.jsx';
import { timezones } from '../../config/zones.js';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
import { DASHBOARD_LAYOUTS, setDashboardLayout } from '../../utils/dashboardManager.js';
import { downloadJson } from '../../utils/download.js';
import { getStoredTheme, handleThemeChange } from '../../utils/themeManager.js';
import { PluginCard } from './PluginCard.jsx';
import { faEye } from '@fortawesome/free-solid-svg-icons/faEye';
import { faEyeSlash } from '@fortawesome/free-solid-svg-icons/faEyeSlash';
import { Tooltip } from '../../components/Tooltip.jsx';
import { faCrosshairs } from '@fortawesome/free-solid-svg-icons/faCrosshairs';

const ledControl = computed(() => machine.value.capabilities.ledControl);
const pressureAvailable = computed(() => machine.value.capabilities.pressure);
const connected = computed(() => machine.value.connected);
const tofDistance = computed(() => machine.value.status.tofDistance);

/**
 * Split a PID CSV string into the form's two-input shape.
 *
 * The firmware stores PID as a single CSV `Kp,Ki,Kd,Kff` string, but the
 * form edits Kp/Ki/Kd as one input and Kff as another. This converts the
 * on-wire shape into `{ pid, kf }` for the form. Used both on initial
 * fetch and after every Save — without re-splitting on the post-save
 * response, a fourth field leaks into the `pid` input and the next Save
 * sends a 5-field CSV.
 *
 * @param {string|undefined} pidString - CSV `Kp,Ki,Kd,Kff` string from the
 *   firmware, or empty/undefined if no PID has been saved yet.
 * @returns {{ pid: string, kf: string }} - `pid` is the first three CSV
 *   fields joined by commas; `kf` is the fourth field, or `'0.000'` if
 *   absent.
 */
function splitPidString(pidString) {
  if (!pidString) return { pid: pidString, kf: '0.000' };
  const parts = pidString.split(',');
  if (parts.length >= 4) {
    return { pid: parts.slice(0, 3).join(','), kf: parts[3] };
  }
  return { pid: pidString, kf: '0.000' };
}

function splitButtons(buttonBehavior) {
  if (!buttonBehavior) return {};
  const [button0, button1, button2] = buttonBehavior.split(',');
  return { button0, button1, button2 };
}

export function Settings() {
  const apiService = useContext(ApiServiceContext);
  const [profiles, setProfiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [gen] = useState(0);
  const [formData, setFormData] = useState({});
  const [currentTheme, setCurrentTheme] = useState('light');
  const [showWifiPassword, setShowWifiPassword] = useState(false);
  const [autowakeupSchedules, setAutoWakeupSchedules] = useState([
    { time: '07:00', days: [true, true, true, true, true, true, true] }, // Default: all days enabled
  ]);
  const { isLoading, data: fetchedSettings } = useQuery(`settings/${gen}`, async () => {
    const response = await fetch(`/api/settings`);
    const data = await response.json();
    return data;
  });

  // Fetch profiles via WebSocket (wait for connection)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const loadProfiles = async () => {
      if (connected.value) {
        const response = await apiService.request({ tp: 'req:profiles:list', minimal: true });
        setProfiles(response.profiles);
      }
    };
    loadProfiles();
  }, [connected.value]);

  const formRef = useRef();

  useEffect(() => {
    if (fetchedSettings) {
      // Initialize standbyDisplayEnabled based on standby brightness value
      // but preserve it if it already exists in the fetched data
      const buttonFields = fetchedSettings.buttonBehavior
        ? splitButtons(fetchedSettings.buttonBehavior)
        : {};
      const settingsWithToggle = {
        ...fetchedSettings,
        ...buttonFields,
        standbyDisplayEnabled:
          fetchedSettings.standbyDisplayEnabled !== undefined
            ? fetchedSettings.standbyDisplayEnabled
            : fetchedSettings.standbyBrightness > 0,
        dashboardLayout: fetchedSettings.dashboardLayout || DASHBOARD_LAYOUTS.ORDER_FIRST,
      };

      // Extract Kf from PID string and separate them. Mirrors the same
      // split applied in `onSubmit` after every save — keep these two in
      // sync via `splitPidString`.
      if (fetchedSettings.pid) {
        const split = splitPidString(fetchedSettings.pid);
        settingsWithToggle.pid = split.pid;
        settingsWithToggle.kf = split.kf;
      }

      // Initialize auto-wakeup schedules
      if (fetchedSettings.autowakeupSchedules) {
        // Parse new schedule format: "time1|days1;time2|days2"
        const schedules = [];
        if (
          typeof fetchedSettings.autowakeupSchedules === 'string' &&
          fetchedSettings.autowakeupSchedules.trim()
        ) {
          const scheduleStrings = fetchedSettings.autowakeupSchedules.split(';');
          for (const scheduleStr of scheduleStrings) {
            const [time, daysStr] = scheduleStr.split('|');
            if (time && daysStr && daysStr.length === 7) {
              const days = daysStr.split('').map(d => d === '1');
              schedules.push({ time, days });
            }
          }
        }
        if (schedules.length === 0) {
          schedules.push({ time: '07:00', days: [true, true, true, true, true, true, true] });
        }
        setAutoWakeupSchedules(schedules);
      } else {
        setAutoWakeupSchedules([
          { time: '07:00', days: [true, true, true, true, true, true, true] },
        ]);
      }

      setFormData(settingsWithToggle);
    } else {
      setFormData({});
      setAutoWakeupSchedules([{ time: '07:00', days: [true, true, true, true, true, true, true] }]);
    }
  }, [fetchedSettings]);

  // Initialize theme
  useEffect(() => {
    setCurrentTheme(getStoredTheme());
  }, []);

  const onChange = key => {
    return e => {
      let value = e.currentTarget.value;
      if (key === 'homekit') {
        value = !formData.homekit;
      }
      if (key === 'boilerFillActive') {
        value = !formData.boilerFillActive;
      }
      if (key === 'smartGrindActive') {
        value = !formData.smartGrindActive;
      }
      if (key === 'smartGrindToggle') {
        value = !formData.smartGrindToggle;
      }
      if (key === 'homeAssistant') {
        value = !formData.homeAssistant;
      }
      if (key === 'momentaryButtons') {
        value = !formData.momentaryButtons;
      }
      if (key === 'delayAdjust') {
        value = !formData.delayAdjust;
      }
      if (key === 'clock24hFormat') {
        value = !formData.clock24hFormat;
      }
      if (key === 'autowakeupEnabled') {
        value = !formData.autowakeupEnabled;
      }
      if (key === 'standbyDisplayEnabled') {
        value = !formData.standbyDisplayEnabled;
        // Set standby brightness to 0 when toggle is off
        const newFormData = {
          ...formData,
          [key]: value,
        };
        if (!value) {
          newFormData.standbyBrightness = 0;
        }
        setFormData(newFormData);
        return;
      }
      if (key === 'dashboardLayout') {
        setDashboardLayout(value);
      }
      setFormData({
        ...formData,
        [key]: value,
      });
    };
  };

  const addAutoWakeupSchedule = () => {
    setAutoWakeupSchedules([
      ...autowakeupSchedules,
      {
        time: '07:00',
        days: [true, true, true, true, true, true, true],
      },
    ]);
  };

  const removeAutoWakeupSchedule = index => {
    if (autowakeupSchedules.length > 1) {
      const newSchedules = autowakeupSchedules.filter((_, i) => i !== index);
      setAutoWakeupSchedules(newSchedules);
    }
  };

  const updateAutoWakeupTime = (index, value) => {
    const newSchedules = [...autowakeupSchedules];
    newSchedules[index].time = value;
    setAutoWakeupSchedules(newSchedules);
  };

  const updateAutoWakeupDay = (scheduleIndex, dayIndex, enabled) => {
    const newSchedules = [...autowakeupSchedules];
    newSchedules[scheduleIndex].days[dayIndex] = enabled;
    setAutoWakeupSchedules(newSchedules);
  };

  const onSubmit = useCallback(
    async (e, restart = false) => {
      e.preventDefault();
      setSubmitting(true);
      const form = formRef.current;
      const formDataToSubmit = new FormData(form);
      formDataToSubmit.set('steamPumpPercentage', formData.steamPumpPercentage);
      formDataToSubmit.set(
        'altRelayFunction',
        formData.altRelayFunction !== undefined ? formData.altRelayFunction : 1,
      );
      formDataToSubmit.set(
        'buttonBehavior',
        `${formData.button0},${formData.button1},${formData.button2}`,
      );

      // Combine PID and Kf into single PID string
      if (formData.pid && formData.kf !== undefined) {
        const combinedPid = `${formData.pid},${formData.kf}`;
        formDataToSubmit.set('pid', combinedPid);
      }

      // Add auto-wakeup schedules
      const schedulesStr = autowakeupSchedules
        .map(schedule => `${schedule.time}|${schedule.days.map(d => (d ? '1' : '0')).join('')}`)
        .join(';');
      formDataToSubmit.set('autowakeupSchedules', schedulesStr);

      // Ensure standbyBrightness is included even when the field is disabled
      if (!formData.standbyDisplayEnabled) {
        formDataToSubmit.set('standbyBrightness', '0');
      }

      if (restart) {
        formDataToSubmit.append('restart', '1');
      }
      const response = await fetch(form.action, {
        method: 'post',
        body: formDataToSubmit,
      });
      const data = await response.json();

      // Re-split `pid` the same way the initial load does. The server
      // returns the full `Kp,Ki,Kd,Kff` CSV; without splitting it here,
      // the next Save would combine `formData.pid` (already 4 fields)
      // with `formData.kf`, producing a 5-field CSV that grows on every
      // round-trip.
      const splitPid = data.pid ? splitPidString(data.pid) : null;
      const buttonFields = data.buttonBehavior ? splitButtons(data.buttonBehavior) : {};

      // Only preserve standbyDisplayEnabled if brightness is greater than 0
      // If brightness is 0, let the useEffect recalculate it based on the saved value
      const updatedData = {
        ...data,
        ...(splitPid !== null ? { pid: splitPid.pid, kf: splitPid.kf } : {}),
        ...buttonFields,
        standbyDisplayEnabled: data.standbyBrightness > 0 ? formData.standbyDisplayEnabled : false,
      };

      setFormData(updatedData);
      setSubmitting(false);
    },
    [setFormData, formRef, formData, autowakeupSchedules],
  );

  const onExport = useCallback(() => {
    downloadJson(formData, 'settings.json');
  }, [formData]);

  const onUpload = function (evt) {
    if (evt.target.files.length) {
      const file = evt.target.files[0];
      const reader = new FileReader();
      reader.onload = async e => {
        const data = JSON.parse(e.target.result);
        setFormData(data);
      };
      reader.readAsText(file);
    }
  };

  if (isLoading) {
    return (
      <div className='flex w-full flex-row items-center justify-center py-16'>
        <Spinner size={8} />
      </div>
    );
  }

  return (
    <>
      <div className='mb-4 flex flex-row items-center gap-2'>
        <h2 className='flex-grow text-2xl font-bold sm:text-3xl'>Settings</h2>
        <button
          type='button'
          onClick={onExport}
          className='btn btn-ghost btn-sm'
          title='Export Settings'
        >
          <FontAwesomeIcon icon={faFileExport} />
        </button>
        <label
          htmlFor='settingsImport'
          className='btn btn-ghost btn-sm cursor-pointer'
          title='Import Settings'
        >
          <FontAwesomeIcon icon={faFileImport} />
        </label>
        <input
          onChange={onUpload}
          className='hidden'
          id='settingsImport'
          type='file'
          accept='.json,application/json'
        />
      </div>

      <form key='settings' ref={formRef} method='post' action='/api/settings' onSubmit={onSubmit}>
        <div className='grid grid-cols-1 gap-4 lg:grid-cols-10'>
          {/* Temperature Settings */}
          <Card sm={10} lg={5} title='Temperature Settings'>
            <InputGroupField
              label='Default Steam Temperature'
              htmlFor='targetSteamTemp'
              unit='°C'
              unitAriaLabel='celsius'
            >
              <input
                id='targetSteamTemp'
                name='targetSteamTemp'
                type='number'
                placeholder='135'
                value={formData.targetSteamTemp}
                onChange={onChange('targetSteamTemp')}
              />
            </InputGroupField>
            <InputGroupField
              label='Default Water Temperature'
              htmlFor='targetWaterTemp'
              unit='°C'
              unitAriaLabel='celsius'
              noMargin
            >
              <input
                id='targetWaterTemp'
                name='targetWaterTemp'
                type='number'
                placeholder='80'
                value={formData.targetWaterTemp}
                onChange={onChange('targetWaterTemp')}
              />
            </InputGroupField>
          </Card>

          {/* Web Settings */}
          <Card sm={10} lg={5} title='Web Settings'>
            <SettingsFormField label='Theme' htmlFor='webui-theme'>
              <select
                id='webui-theme'
                name='webui-theme'
                className='select select-bordered w-full'
                value={currentTheme}
                onChange={e => {
                  setCurrentTheme(e.target.value);
                  handleThemeChange(e);
                }}
              >
                <option value='light'>Light</option>
                <option value='dark'>Dark</option>
                <option value='coffee'>Coffee</option>
                <option value='nord'>Nord</option>
              </select>
            </SettingsFormField>
            <SettingsFormField label='Dashboard Layout' htmlFor='dashboardLayout' noMargin>
              <select
                id='dashboardLayout'
                name='dashboardLayout'
                className='select select-bordered w-full'
                value={formData.dashboardLayout || DASHBOARD_LAYOUTS.ORDER_FIRST}
                onChange={e => {
                  setFormData({ ...formData, dashboardLayout: e.target.value });
                  setDashboardLayout(e.target.value);
                }}
              >
                <option value={DASHBOARD_LAYOUTS.ORDER_FIRST}>Process Controls First</option>
                <option value={DASHBOARD_LAYOUTS.ORDER_LAST}>Chart First</option>
              </select>
            </SettingsFormField>
          </Card>

          {/* System Preferences */}
          <Card sm={10} lg={5} title='System Preferences'>
            <SettingsFormField label='Wi-Fi SSID' htmlFor='wifiSsid'>
              <input
                id='wifiSsid'
                name='wifiSsid'
                type='text'
                className='input input-bordered w-full'
                placeholder='Wi-Fi SSID'
                value={formData.wifiSsid}
                onChange={onChange('wifiSsid')}
              />
            </SettingsFormField>
            <SettingsFormField label='Wi-Fi Password' htmlFor='wifiPassword'>
              <label className='input w-full'>
                <input
                  id='wifiPassword'
                  name='wifiPassword'
                  type={showWifiPassword ? 'text' : 'password'}
                  placeholder='Wi-Fi Password'
                  value={formData.wifiPassword}
                  onChange={onChange('wifiPassword')}
                />
                <span
                  className={`hover:text-primary cursor-pointer`}
                  aria-label='Show Password'
                  onClick={() => setShowWifiPassword(!showWifiPassword)}
                >
                  <FontAwesomeIcon icon={showWifiPassword ? faEyeSlash : faEye} />
                </span>
              </label>
            </SettingsFormField>
            <SettingsFormField label='Hostname' htmlFor='mdnsName'>
              <input
                id='mdnsName'
                name='mdnsName'
                type='text'
                className='input input-bordered w-full'
                placeholder='Hostname'
                value={formData.mdnsName}
                onChange={onChange('mdnsName')}
              />
            </SettingsFormField>
            <SettingsFormField label='Time Zone' htmlFor='timezone' noMargin>
              <select
                id='timezone'
                name='timezone'
                className='select select-bordered w-full'
                onChange={onChange('timezone')}
              >
                {timezones.map(tz => (
                  <option key={tz} value={tz} selected={formData.timezone === tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </SettingsFormField>
            <div className='divider'>Clock</div>
            <ToggleField
              label='Use 24h Format'
              htmlFor='clock24hFormat'
              checked={!!formData.clock24hFormat}
              onChange={onChange('clock24hFormat')}
            />
          </Card>

          {/* Display Settings */}
          <Card sm={10} lg={5} title='Display Settings'>
            <SettingsFormField label='Main Brightness (1-16)' htmlFor='mainBrightness'>
              <input
                id='mainBrightness'
                name='mainBrightness'
                type='number'
                className='input input-bordered w-full'
                placeholder='16'
                min='1'
                max='16'
                value={formData.mainBrightness}
                onChange={onChange('mainBrightness')}
              />
            </SettingsFormField>
            <div className='divider'>Standby Display</div>
            <ToggleField
              label='Enable standby display'
              htmlFor='standbyDisplayEnabled'
              checked={formData.standbyDisplayEnabled}
              onChange={onChange('standbyDisplayEnabled')}
            />
            <SettingsFormField
              label='Standby Brightness (0-16)'
              htmlFor='standbyBrightness'
              helpText='When the toggle is off, brightness will be set to 0'
            >
              <input
                id='standbyBrightness'
                name='standbyBrightness'
                type='number'
                className='input input-bordered w-full'
                placeholder='8'
                min='0'
                max='16'
                value={formData.standbyBrightness}
                onChange={onChange('standbyBrightness')}
                disabled={!formData.standbyDisplayEnabled}
              />
            </SettingsFormField>
            <InputGroupField
              label='Standby Brightness Timeout (s)'
              htmlFor='standbyBrightnessTimeout'
              unit='s'
              unitAriaLabel='seconds'
            >
              <input
                id='standbyBrightnessTimeout'
                name='standbyBrightnessTimeout'
                type='number'
                className='grow'
                placeholder='60'
                min='1'
                value={formData.standbyBrightnessTimeout}
                onChange={onChange('standbyBrightnessTimeout')}
              />
            </InputGroupField>
            <SettingsFormField label='Theme' htmlFor='themeMode' noMargin>
              <select
                id='themeMode'
                name='themeMode'
                className='select select-bordered w-full'
                value={formData.themeMode}
                onChange={onChange('themeMode')}
              >
                <option value={0}>Dark Theme</option>
                <option value={1}>Light Theme</option>
              </select>
            </SettingsFormField>
          </Card>

          {/* User Preferences */}
          <Card sm={10} lg={5} title='User Preferences'>
            <SettingsFormField label='Startup Mode' htmlFor='startup-mode'>
              <select
                id='startup-mode'
                name='startupMode'
                className='select select-bordered w-full'
                onChange={onChange('startupMode')}
              >
                <option value='standby' selected={formData.startupMode === 'standby'}>
                  Standby
                </option>
                <option value='brew' selected={formData.startupMode === 'brew'}>
                  Brew
                </option>
              </select>
            </SettingsFormField>
            <SettingsFormField label='Startup Profile' htmlFor='startup-profile'>
              <select
                id='startup-profile'
                name='startupProfile'
                className='select select-bordered w-full'
                value={formData.startupProfile || ''}
                onChange={onChange('startupProfile')}
              >
                <option value=''>Last used profile</option>
                {profiles.map(profile => (
                  <option key={profile.id} value={profile.id}>
                    {profile.label}
                  </option>
                ))}
              </select>
            </SettingsFormField>
            <InputGroupField
              label='Standby Timeout'
              htmlFor='standbyTimeout'
              unit='s'
              unitAriaLabel='seconds'
            >
              <input
                id='standbyTimeout'
                name='standbyTimeout'
                type='number'
                placeholder='0'
                value={formData.standbyTimeout}
                onChange={onChange('standbyTimeout')}
              />
            </InputGroupField>

            <div className='divider'>Predictive Scale Delay</div>
            <div className='mb-4 text-sm opacity-70'>
              Shuts off the process ahead of time based on the flow rate to account for any dripping
              or delays in the control.
            </div>
            <ToggleField
              label='Auto Adjust'
              htmlFor='delayAdjust'
              checked={!!formData.delayAdjust}
              onChange={onChange('delayAdjust')}
            />
            <div className='grid grid-cols-2 gap-4'>
              <InputGroupField
                label='Brew'
                htmlFor='brewDelay'
                unit='ms'
                unitAriaLabel='milliseconds'
              >
                <input
                  id='brewDelay'
                  name='brewDelay'
                  type='number'
                  step='any'
                  className='grow'
                  placeholder='0'
                  value={formData.brewDelay}
                  onChange={onChange('brewDelay')}
                />
              </InputGroupField>
              <InputGroupField
                label='Grind'
                htmlFor='grindDelay'
                unit='ms'
                unitAriaLabel='milliseconds'
              >
                <input
                  id='grindDelay'
                  name='grindDelay'
                  type='number'
                  step='any'
                  className='grow'
                  placeholder='0'
                  value={formData.grindDelay}
                  onChange={onChange('grindDelay')}
                />
              </InputGroupField>
            </div>

            <div className='divider'>Switch Control</div>
            <ToggleField
              label='Use momentary switches'
              htmlFor='momentaryButtons'
              checked={!!formData.momentaryButtons}
              onChange={onChange('momentaryButtons')}
            />
            <SettingsFormField label='Brew Button Behavior (Button 1)' htmlFor='button0'>
              <select
                id='button0'
                name='button0'
                className='select select-bordered w-full'
                value={formData.button0}
                onChange={onChange('button0')}
              >
                <option value='none'>None</option>
                <option value='brew'>Brew button</option>
                <option value='steam'>Steam button</option>
                <option value='water'>Water button</option>
                <option value='flush'>Flush</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>
                    Profile: {p.label}
                  </option>
                ))}
              </select>
            </SettingsFormField>
            <SettingsFormField label='Steam Button Behavior (Button 2)' htmlFor='button1'>
              <select
                id='button1'
                name='button1'
                className='select select-bordered w-full'
                value={formData.button1}
                onChange={onChange('button1')}
              >
                <option value='none'>None</option>
                <option value='brew'>Brew button</option>
                <option value='steam'>Steam button</option>
                <option value='water'>Water button</option>
                <option value='flush'>Flush</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>
                    Profile: {p.label}
                  </option>
                ))}
              </select>
            </SettingsFormField>
            <SettingsFormField label='Water Button Behavior (Button 3)' htmlFor='button2' noMargin>
              <select
                id='button2'
                name='button2'
                className='select select-bordered w-full'
                value={formData.button2}
                onChange={onChange('button2')}
              >
                <option value='none'>None</option>
                <option value='brew'>Brew button</option>
                <option value='steam'>Steam button</option>
                <option value='water'>Water button</option>
                <option value='flush'>Flush</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>
                    Profile: {p.label}
                  </option>
                ))}
              </select>
            </SettingsFormField>
          </Card>

          {/* Machine Settings */}
          <Card sm={10} lg={5} title='Machine Settings'>
            <SettingsFormField label='PID Values' htmlFor='pid'>
              <div className='input-group'>
                <label htmlFor='pid' className='input w-full'>
                  <input
                    id='pid'
                    name='pid'
                    type='text'
                    className='grow'
                    placeholder='2.0, 0.1, 0.01'
                    value={formData.pid}
                    onChange={onChange('pid')}
                  />
                  <span>
                    K<sub>p</sub>, K<sub>i</sub>, K<sub>d</sub>
                  </span>
                </label>
              </div>
            </SettingsFormField>
            <SettingsFormField
              label='Thermal Feedforward Gain'
              htmlFor='kf'
              helpText='Set to 0 to disable feedforward control.'
            >
              <div className='input-group'>
                <label htmlFor='kf' className='input w-full'>
                  <input
                    id='kf'
                    name='kf'
                    type='number'
                    step='0.001'
                    className='grow'
                    placeholder='0.600'
                    value={formData.kf}
                    onChange={onChange('kf')}
                  />
                  <span>
                    K<sub>ff</sub>
                  </span>
                </label>
              </div>
            </SettingsFormField>
            <SettingsFormField
              label='Pump Flow Coefficients'
              htmlFor='pumpModelCoeffs'
              helpText='Enter 2 values (flow at 1 bar, flow at 9 bar)'
            >
              <input
                id='pumpModelCoeffs'
                name='pumpModelCoeffs'
                type='text'
                className='input input-bordered w-full'
                placeholder='10.205,5.521'
                value={formData.pumpModelCoeffs}
                onChange={onChange('pumpModelCoeffs')}
              />
            </SettingsFormField>
            <InputGroupField
              label='Temperature Offset (°C)'
              htmlFor='temperatureOffset'
              unit='°C'
              unitAriaLabel='celsius'
            >
              <input
                id='temperatureOffset'
                name='temperatureOffset'
                type='number'
                step='any'
                className='grow'
                placeholder='0'
                value={formData.temperatureOffset}
                onChange={onChange('temperatureOffset')}
              />
            </InputGroupField>
            {pressureAvailable.value && (
              <SettingsFormField
                label='Pressure Sensor Rating'
                htmlFor='pressureScaling'
                helpText='Enter the bar rating of the pressure sensor being used'
              >
                <div className='input-group'>
                  <label htmlFor='pressureScaling' className='input w-full'>
                    <input
                      id='pressureScaling'
                      name='pressureScaling'
                      type='number'
                      step='any'
                      className='grow'
                      placeholder='0.0'
                      value={formData.pressureScaling}
                      onChange={onChange('pressureScaling')}
                    />
                    <span>bar</span>
                  </label>
                </div>
              </SettingsFormField>
            )}
            <SettingsFormField
              label='Steam Pump Assist'
              htmlFor='steamPumpPercentage'
              helpText={
                pressureAvailable.value
                  ? 'How many ml/s to pump into the boiler during steaming'
                  : 'What percentage to run the pump at during steaming'
              }
            >
              <div className='input-group'>
                <label htmlFor='steamPumpPercentage' className='input w-full'>
                  <input
                    id='steamPumpPercentage'
                    name='steamPumpPercentage'
                    type='number'
                    step='0.1'
                    className='grow'
                    placeholder={pressureAvailable.value ? '0.0' : '0.0 %'}
                    value={String(
                      formData.steamPumpPercentage * (pressureAvailable.value ? 0.1 : 1),
                    )}
                    onBlur={e =>
                      setFormData({
                        ...formData,
                        steamPumpPercentage: (
                          parseFloat(e.target.value) * (pressureAvailable.value ? 10 : 1)
                        ).toFixed(0),
                      })
                    }
                  />
                  <span aria-label={pressureAvailable.value ? 'milliliter per second' : 'percent'}>
                    {pressureAvailable.value ? 'ml/s' : '%'}
                  </span>
                </label>
              </div>
            </SettingsFormField>
            {pressureAvailable.value && (
              <SettingsFormField
                label='Pump Assist Cutoff'
                htmlFor='steamPumpCutoff'
                helpText='At how many bars should the pump assist stop. This makes it so the pump will only run when steam is flowing.'
              >
                <div className='input-group'>
                  <label htmlFor='steamPumpCutoff' className='input w-full'>
                    <input
                      id='steamPumpCutoff'
                      name='steamPumpCutoff'
                      type='number'
                      step='any'
                      className='grow'
                      placeholder='0.0'
                      value={formData.steamPumpCutoff}
                      onChange={onChange('steamPumpCutoff')}
                    />
                    <span>bar</span>
                  </label>
                </div>
              </SettingsFormField>
            )}
            <SettingsFormField
              label='Alt Relay / SSR2 Function'
              htmlFor='altRelayFunction'
              noMargin
            >
              <select
                id='altRelayFunction'
                name='altRelayFunction'
                className='select select-bordered w-full'
                value={formData.altRelayFunction ?? 1}
                onChange={onChange('altRelayFunction')}
              >
                <option value={0}>None</option>
                <option value={1}>Grind</option>
                <option value={2} disabled className='text-gray-400'>
                  Steam Boiler (Coming Soon)
                </option>
              </select>
            </SettingsFormField>
          </Card>

          {/* Sunrise Settings */}
          {ledControl.value && (
            <Card sm={10} lg={5} title='Alba Settings'>
              <div className='mb-4 text-sm opacity-70'>
                Set the colors for the LEDs when in idle mode with no warnings.
              </div>
              <div className='mb-4 grid grid-cols-2 gap-4'>
                <SettingsFormField label='Red (0 - 255)' htmlFor='sunriseR'>
                  <input
                    id='sunriseR'
                    name='sunriseR'
                    type='number'
                    className='input input-bordered w-full'
                    placeholder='16'
                    value={formData.sunriseR}
                    onChange={onChange('sunriseR')}
                  />
                </SettingsFormField>
                <SettingsFormField label='Green (0 - 255)' htmlFor='sunriseG'>
                  <input
                    id='sunriseG'
                    name='sunriseG'
                    type='number'
                    className='input input-bordered w-full'
                    placeholder='16'
                    value={formData.sunriseG}
                    onChange={onChange('sunriseG')}
                  />
                </SettingsFormField>
                <SettingsFormField label='Blue (0 - 255)' htmlFor='sunriseB'>
                  <input
                    id='sunriseB'
                    name='sunriseB'
                    type='number'
                    className='input input-bordered w-full'
                    placeholder='16'
                    value={formData.sunriseB}
                    onChange={onChange('sunriseB')}
                  />
                </SettingsFormField>
                <SettingsFormField label='White (0 - 255)' htmlFor='sunriseW'>
                  <input
                    id='sunriseW'
                    name='sunriseW'
                    type='number'
                    className='input input-bordered w-full'
                    placeholder='16'
                    value={formData.sunriseW}
                    onChange={onChange('sunriseW')}
                  />
                </SettingsFormField>
              </div>
              <SettingsFormField label='External LED (0 - 255)' htmlFor='sunriseExtBrightness'>
                <input
                  id='sunriseExtBrightness'
                  name='sunriseExtBrightness'
                  type='number'
                  className='input input-bordered w-full'
                  placeholder='16'
                  value={formData.sunriseExtBrightness}
                  onChange={onChange('sunriseExtBrightness')}
                />
              </SettingsFormField>
              <div className='form-control mb-3'>
                <label htmlFor='emptyTankDistance' className='mb-1 block text-sm font-medium'>
                  Distance from sensor to bottom of the tank
                </label>
                <div className='flex flex-row gap-2'>
                  <div className='input-group flex-grow'>
                    <label htmlFor='emptyTankDistance' className='input w-full'>
                      <input
                        id='emptyTankDistance'
                        name='emptyTankDistance'
                        type='number'
                        className='grow'
                        placeholder='16'
                        value={formData.emptyTankDistance}
                        onChange={onChange('emptyTankDistance')}
                      />
                      <span aria-label='millimeter'>mm</span>
                    </label>
                  </div>
                  <Tooltip content={`Set to current measurement: ${tofDistance}mm`}>
                    <button
                      type='button'
                      className='btn btn-ghost'
                      onClick={() =>
                        setFormData({
                          ...formData,
                          emptyTankDistance: tofDistance,
                        })
                      }
                    >
                      <FontAwesomeIcon icon={faCrosshairs} />
                    </button>
                  </Tooltip>
                </div>
              </div>
              <div className='form-control'>
                <label htmlFor='fullTankDistance' className='mb-1 block text-sm font-medium'>
                  Distance from sensor to the fill line
                </label>
                <div className='flex flex-row gap-2'>
                  <div className='input-group flex-grow'>
                    <label htmlFor='fullTankDistance' className='input w-full'>
                      <input
                        id='fullTankDistance'
                        name='fullTankDistance'
                        type='number'
                        className='grow'
                        placeholder='16'
                        value={formData.fullTankDistance}
                        onChange={onChange('fullTankDistance')}
                      />
                      <span aria-label='millimeter'>mm</span>
                    </label>
                  </div>
                  <Tooltip content={`Set to current measurement: ${tofDistance}mm`}>
                    <button
                      type='button'
                      className='btn btn-ghost'
                      onClick={() =>
                        setFormData({
                          ...formData,
                          fullTankDistance: tofDistance,
                        })
                      }
                    >
                      <FontAwesomeIcon icon={faCrosshairs} />
                    </button>
                  </Tooltip>
                </div>
              </div>
            </Card>
          )}

          <Card sm={10} title='Plugins'>
            <PluginCard
              formData={formData}
              onChange={onChange}
              autowakeupSchedules={autowakeupSchedules}
              addAutoWakeupSchedule={addAutoWakeupSchedule}
              removeAutoWakeupSchedule={removeAutoWakeupSchedule}
              updateAutoWakeupTime={updateAutoWakeupTime}
              updateAutoWakeupDay={updateAutoWakeupDay}
            />
          </Card>
        </div>

        <div className='pt-4 lg:col-span-10'>
          <div className='alert alert-warning shadow-sm'>
            <span>Some options like Wi-Fi, NTP, and managing plugins require a restart.</span>
          </div>
          <div className='flex flex-col gap-2 pt-4 sm:flex-row'>
            <a href='/' className='btn btn-outline flex-1 sm:flex-none'>
              Back
            </a>
            <button
              type='submit'
              className='btn btn-primary flex-1 sm:flex-none'
              disabled={submitting}
            >
              {submitting && <Spinner size={4} />} Save
            </button>
            <button
              type='submit'
              name='restart'
              className='btn btn-secondary flex-1 sm:flex-none'
              disabled={submitting}
              onClick={e => onSubmit(e, true)}
            >
              Save and Restart
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
