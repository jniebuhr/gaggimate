import { faFileExport, faFileImport, faWarning, faCheck } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { computed } from '@preact/signals';
import { useQuery } from 'preact-fetching';
import { useCallback, useEffect, useRef, useState, useContext } from 'preact/hooks';
import Card from '../../components/Card.jsx';
import { Spinner } from '../../components/Spinner.jsx';
import { timezones } from '../../config/zones.js';
import { machine, ApiServiceContext } from '../../services/ApiService.js';
import { DASHBOARD_LAYOUTS, setDashboardLayout } from '../../utils/dashboardManager.js';
import { downloadJson, prepareDownload } from '../../utils/download.js';
import { getStoredTheme, handleThemeChange } from '../../utils/themeManager.js';
import { PluginCard } from './PluginCard.jsx';
import { faEye, faEyeSlash, faArrowLeft, faSave } from '@fortawesome/free-solid-svg-icons';
import { GoogleDriveBackupCard } from './GoogleDriveBackupCard.jsx';

const ledControl = computed(() => machine.value.capabilities.ledControl);
const pressureAvailable = computed(() => machine.value.capabilities.pressure);

export function Settings() {
  const apiService = useContext(ApiServiceContext);
  const [submitting, setSubmitting] = useState(false);
  const [gen, setGen] = useState(0);
  const [formData, setFormData] = useState({});
  const [currentTheme, setCurrentTheme] = useState('midnight');
  const [showWifiPassword, setShowWifiPassword] = useState(false);
  const [autowakeupSchedules, setAutoWakeupSchedules] = useState([
    { time: '07:00', days: [true, true, true, true, true, true, true] },
  ]);
  const { isLoading, data: fetchedSettings } = useQuery(`settings/${gen}`, async () => {
    const response = await fetch(`/api/settings`);
    const data = await response.json();
    return data;
  });

  const formRef = useRef();

  useEffect(() => {
    if (fetchedSettings) {
      const settingsWithToggle = {
        ...fetchedSettings,
        standbyDisplayEnabled:
          fetchedSettings.standbyDisplayEnabled !== undefined
            ? fetchedSettings.standbyDisplayEnabled
            : fetchedSettings.standbyBrightness > 0,
        dashboardLayout: fetchedSettings.dashboardLayout || DASHBOARD_LAYOUTS.ORDER_FIRST,
      };

      if (fetchedSettings.pid) {
        const pidParts = fetchedSettings.pid.split(',');
        if (pidParts.length >= 4) {
          settingsWithToggle.pid = pidParts.slice(0, 3).join(',');
          settingsWithToggle.kf = pidParts[3];
        } else {
          settingsWithToggle.kf = '0.000';
        }
      }

      if (fetchedSettings.autowakeupSchedules) {
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

  useEffect(() => {
    setCurrentTheme(getStoredTheme());
  }, []);

  const onChange = key => {
    return e => {
      const value = e.currentTarget.value;
      if (key === 'homekit') {
        setFormData(prev => ({ ...prev, homekit: !prev.homekit }));
      } else if (key === 'boilerFillActive') {
        setFormData(prev => ({ ...prev, boilerFillActive: !prev.boilerFillActive }));
      } else if (key === 'smartGrindActive') {
        setFormData(prev => ({ ...prev, smartGrindActive: !prev.smartGrindActive }));
      } else if (key === 'smartGrindToggle') {
        setFormData(prev => ({ ...prev, smartGrindToggle: !prev.smartGrindToggle }));
      } else if (key === 'homeAssistant') {
        setFormData(prev => ({ ...prev, homeAssistant: !prev.homeAssistant }));
      } else if (key === 'momentaryButtons') {
        setFormData(prev => ({ ...prev, momentaryButtons: !prev.momentaryButtons }));
      } else if (key === 'delayAdjust') {
        setFormData(prev => ({ ...prev, delayAdjust: !prev.delayAdjust }));
      } else if (key === 'clock24hFormat') {
        setFormData(prev => ({ ...prev, clock24hFormat: !prev.clock24hFormat }));
      } else if (key === 'autowakeupEnabled') {
        setFormData(prev => ({ ...prev, autowakeupEnabled: !prev.autowakeupEnabled }));
      } else if (key === 'standbyDisplayEnabled') {
        setFormData(prev => {
          const newFormData = { ...prev, standbyDisplayEnabled: !prev.standbyDisplayEnabled };
          if (newFormData.standbyDisplayEnabled === false) {
            newFormData.standbyBrightness = 0;
          }
          return newFormData;
        });
      } else if (key === 'dashboardLayout') {
        setDashboardLayout(value);
        setFormData(prev => ({ ...prev, dashboardLayout: value }));
      } else {
        setFormData(prev => ({ ...prev, [key]: value }));
      }
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
      try {
        const form = formRef.current;
        const formDataToSubmit = new FormData(form);
        formDataToSubmit.set('steamPumpPercentage', formData.steamPumpPercentage);
        formDataToSubmit.set(
          'altRelayFunction',
          formData.altRelayFunction !== undefined ? formData.altRelayFunction : 1,
        );

        if (formData.pid && formData.kf !== undefined) {
          const combinedPid = `${formData.pid},${formData.kf}`;
          formDataToSubmit.set('pid', combinedPid);
        }

        formDataToSubmit.set('autowakeupEnabled', formData.autowakeupEnabled ? '1' : '');
        formDataToSubmit.set('homekit', formData.homekit ? '1' : '');

        const schedulesStr = autowakeupSchedules
          .map(schedule => `${schedule.time}|${schedule.days.map(d => (d ? '1' : '0')).join('')}`)
          .join(';');
        formDataToSubmit.set('autowakeupSchedules', schedulesStr);

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

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();

        // Sync relay config to localStorage so browser uses relay on next connection
        if (data.cloudRelayUrl && data.cloudRelayToken) {
          localStorage.setItem('gaggimate_relay_url', data.cloudRelayUrl);
          localStorage.setItem('gaggimate_relay_token', data.cloudRelayToken);
        } else {
          localStorage.removeItem('gaggimate_relay_url');
          localStorage.removeItem('gaggimate_relay_token');
        }

        const updatedData = {
          ...data,
          standbyDisplayEnabled: data.standbyBrightness > 0 ? formData.standbyDisplayEnabled : false,
        };

        setFormData(updatedData);
      } catch (error) {
        console.error('Failed to save settings:', error);
        alert('Failed to save settings. Please try again.');
      } finally {
        setSubmitting(false);
      }
    },
    [setFormData, formRef, formData, autowakeupSchedules],
  );

  const onExport = useCallback(() => {
    const download = prepareDownload('settings.json');
    try {
      downloadJson(formData, 'settings.json', download);
    } catch (error) {
      download.fail(error);
      console.error('Failed to export settings:', error);
      alert(`Settings export failed: ${error.message}`);
    }
  }, [formData]);

  const onUpload = function (evt) {
    if (evt.target.files.length) {
      const file = evt.target.files[0];
      const reader = new FileReader();
      reader.onload = async e => {
        try {
          const data = JSON.parse(e.target.result);
          setFormData(data);
        } catch (error) {
          console.error('Failed to parse settings file:', error);
          alert('Failed to parse settings file. Please ensure it is valid JSON.');
        }
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
    <div className='flex flex-col gap-6'>
      {/* Header */}
      <div className='flex items-center justify-between gap-4'>
        <h1 className='font-nd-mono text-[20px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'>
          Settings
        </h1>
        <div className='flex items-center gap-2'>
          <button
            type='button'
            onClick={onExport}
            className='nd-action-btn'
            title='Export Settings'
          >
            <FontAwesomeIcon icon={faFileExport} />
          </button>
          <label
            htmlFor='settingsImport'
            className='nd-action-btn cursor-pointer'
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
      </div>

      <form key='settings' ref={formRef} method='post' action='/api/settings' onSubmit={onSubmit}>
        <div className='grid grid-cols-1 gap-4 lg:grid-cols-10'>
          {/* Temperature Settings */}
          <Card sm={10} lg={5} title='Temperature Settings'>
            <div className='flex flex-col gap-5'>
              <div className='flex flex-col gap-2'>
                <label
                  htmlFor='targetSteamTemp'
                  className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
                >
                  Default Steam Temperature
                </label>
                <div className='flex'>
                  <input
                    id='targetSteamTemp'
                    name='targetSteamTemp'
                    type='number'
                    className='nd-input nd-input--lg flex-1 rounded-r-none border-r-0'
                    placeholder='135'
                    value={formData.targetSteamTemp}
                    onChange={onChange('targetSteamTemp')}
                  />
                  <span className='nd-input-unit'>°C</span>
                </div>
              </div>
              <div className='flex flex-col gap-2'>
                <label
                  htmlFor='targetWaterTemp'
                  className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
                >
                  Default Water Temperature
                </label>
                <div className='flex'>
                  <input
                    id='targetWaterTemp'
                    name='targetWaterTemp'
                    type='number'
                    className='nd-input nd-input--lg flex-1 rounded-r-none border-r-0'
                    placeholder='80'
                    value={formData.targetWaterTemp}
                    onChange={onChange('targetWaterTemp')}
                  />
                  <span className='nd-input-unit'>°C</span>
                </div>
              </div>
            </div>
          </Card>

          {/* User Preferences */}
          <Card sm={10} lg={5} title='User Preferences'>
            <div className='flex flex-col gap-5'>
              <div className='flex flex-col gap-2'>
                <label
                  htmlFor='startup-mode'
                  className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
                >
                  Startup Mode
                </label>
                <select
                  id='startup-mode'
                  name='startupMode'
                  className='nd-input nd-input--lg'
                  value={formData.startupMode || 'standby'}
                  onChange={onChange('startupMode')}
                >
                  <option value='standby'>Standby</option>
                  <option value='brew'>Brew</option>
                </select>
              </div>
              <div className='flex flex-col gap-2'>
                <label
                  htmlFor='standbyTimeout'
                  className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
                >
                  Standby Timeout
                </label>
                <div className='flex'>
                  <input
                    id='standbyTimeout'
                    name='standbyTimeout'
                    type='number'
                    className='nd-input nd-input--lg flex-1 rounded-r-none border-r-0'
                    placeholder='0'
                    value={formData.standbyTimeout}
                    onChange={onChange('standbyTimeout')}
                  />
                  <span className='nd-input-unit'>s</span>
                </div>
              </div>

              <div className='border-l-2 border-[var(--color-warning,#d4a843)] pl-4'>
                <div className='font-nd-mono text-[13px] text-[var(--text-disabled,#666)]'>
                  Predictive Scale Delay
                </div>
              </div>
              <div className='font-nd-mono text-[13px] text-[var(--text-disabled,#666)]'>
                Shuts off the process ahead of time based on the flow rate to account for any dripping
                or delays in the control.
              </div>
              <div className='flex items-center justify-between'>
                <span className='font-nd-mono text-[14px] text-[var(--text-primary,#e8e8e8)]'>
                  Auto Adjust
                </span>
                <button
                  type='button'
                  className={`nd-toggle ${formData.delayAdjust ? 'nd-toggle--active' : ''}`}
                  onClick={onChange('delayAdjust')}
                  role='switch'
                  aria-checked={!!formData.delayAdjust}
                >
                  <span className='nd-toggle-thumb' />
                </button>
              </div>
              <div className='grid grid-cols-2 gap-4'>
                <div className='flex flex-col gap-2'>
                  <label
                    htmlFor='brewDelay'
                    className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
                  >
                    Brew
                  </label>
                  <div className='flex'>
                    <input
                      id='brewDelay'
                      name='brewDelay'
                      type='number'
                      step='any'
                      className='nd-input nd-input--lg flex-1 rounded-r-none border-r-0'
                      placeholder='0'
                      value={formData.brewDelay}
                      onChange={onChange('brewDelay')}
                    />
                    <span className='nd-input-unit'>ms</span>
                  </div>
                </div>
                <div className='flex flex-col gap-2'>
                  <label
                    htmlFor='grindDelay'
                    className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
                  >
                    Grind
                  </label>
                  <div className='flex'>
                    <input
                      id='grindDelay'
                      name='grindDelay'
                      type='number'
                      step='any'
                      className='nd-input nd-input--lg flex-1 rounded-r-none border-r-0'
                      placeholder='0'
                      value={formData.grindDelay}
                      onChange={onChange('grindDelay')}
                    />
                    <span className='nd-input-unit'>ms</span>
                  </div>
                </div>
              </div>

              <div className='border-l-2 border-[var(--text-secondary,#999)] pl-4'>
                <div className='font-nd-mono text-[13px] text-[var(--text-disabled,#666)]'>
                  Switch Control
                </div>
              </div>
              <div className='flex flex-col gap-2'>
                <label
                  htmlFor='flushDuration'
                  className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
                >
                  Flush Duration
                </label>
                <div className='font-nd-mono text-[11px] text-[var(--text-disabled,#666)] mb-2'>
                  Maximum duration for flushing. (1-60s)
                </div>
                <div className='flex'>
                  <input
                    id='flushDuration'
                    name='flushDuration'
                    type='number'
                    min='1'
                    max='60'
                    className='nd-input nd-input--lg flex-1 rounded-r-none border-r-0'
                    placeholder='5'
                    value={formData.flushDuration}
                    onChange={onChange('flushDuration')}
                    onBlur={e => {
                      const val = parseInt(e.target.value) || 5;
                      const clamped = Math.min(60, Math.max(1, val));
                      setFormData(prev => ({ ...prev, flushDuration: clamped }));
                    }}
                  />
                  <span className='nd-input-unit'>s</span>
                </div>
              </div>
              <div className='flex items-center justify-between'>
                <span className='font-nd-mono text-[14px] text-[var(--text-primary,#e8e8e8)]'>
                  Use momentary switches
                </span>
                <button
                  type='button'
                  className={`nd-toggle ${formData.momentaryButtons ? 'nd-toggle--active' : ''}`}
                  onClick={onChange('momentaryButtons')}
                  role='switch'
                  aria-checked={!!formData.momentaryButtons}
                >
                  <span className='nd-toggle-thumb' />
                </button>
              </div>
            </div>
          </Card>

          {/* Web Settings */}
          <Card sm={10} lg={5} title='Web Settings'>
            <div className='flex flex-col gap-5'>
              <div className='flex flex-col gap-2'>
                <label
                  htmlFor='webui-theme'
                  className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
                >
                  Theme
                </label>
                <select
                  id='webui-theme'
                  name='webui-theme'
                  className='nd-input nd-input--lg'
                  value={currentTheme}
                  onChange={e => {
                    setCurrentTheme(e.target.value);
                    handleThemeChange(e);
                  }}
                >
                  <option value='midnight'>Midnight</option>
                  <option value='espresso'>Espresso</option>
                  <option value='matcha'>Matcha</option>
                  <option value='blueprint'>Blueprint</option>
                </select>
              </div>
            </div>
          </Card>

          <GoogleDriveBackupCard
            apiService={apiService}
            onRestoreComplete={() => setGen(prev => prev + 1)}
          />

          {/* System Preferences */}
          <Card sm={10} lg={5} title='System Preferences'>
            <div className='flex flex-col gap-5'>
              <div className='flex flex-col gap-2'>
                <label
                  htmlFor='wifiSsid'
                  className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
                >
                  Wi-Fi SSID
                </label>
                <input
                  id='wifiSsid'
                  name='wifiSsid'
                  type='text'
                  className='nd-input nd-input--lg'
                  placeholder='Wi-Fi SSID'
                  value={formData.wifiSsid}
                  onChange={onChange('wifiSsid')}
                />
              </div>
              <div className='flex flex-col gap-2'>
                <label
                  htmlFor='wifiPassword'
                  className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
                >
                  Wi-Fi Password
                </label>
                <div className='flex'>
                  <input
                    id='wifiPassword'
                    name='wifiPassword'
                    type={showWifiPassword ? 'text' : 'password'}
                    className='nd-input nd-input--lg flex-1 rounded-r-none border-r-0'
                    placeholder='Wi-Fi Password'
                    value={formData.wifiPassword}
                    onChange={onChange('wifiPassword')}
                  />
                  <button
                    type='button'
                    className='nd-input-unit nd-input-unit--btn'
                    onClick={() => setShowWifiPassword(!showWifiPassword)}
                  >
                    <FontAwesomeIcon icon={showWifiPassword ? faEyeSlash : faEye} />
                  </button>
                </div>
              </div>
              <div className='flex flex-col gap-2'>
                <label
                  htmlFor='mdnsName'
                  className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
                >
                  Hostname
                </label>
                <input
                  id='mdnsName'
                  name='mdnsName'
                  type='text'
                  className='nd-input nd-input--lg'
                  placeholder='Hostname'
                  value={formData.mdnsName}
                  onChange={onChange('mdnsName')}
                />
              </div>
              <div className='flex flex-col gap-2'>
                <label
                  htmlFor='timezone'
                  className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
                >
                  Time Zone
                </label>
                <select
                  id='timezone'
                  name='timezone'
                  className='nd-input nd-input--lg'
                  value={formData.timezone || ''}
                  onChange={onChange('timezone')}
                >
                  {timezones.map(tz => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
              <div className='border-l-2 border-[var(--text-secondary,#999)] pl-4'>
                <div className='font-nd-mono text-[13px] text-[var(--text-disabled,#666)]'>
                  Clock
                </div>
              </div>
              <div className='flex items-center justify-between'>
                <span className='font-nd-mono text-[14px] text-[var(--text-primary,#e8e8e8)]'>
                  Use 24h Format
                </span>
                <button
                  type='button'
                  className={`nd-toggle ${formData.clock24hFormat ? 'nd-toggle--active' : ''}`}
                  onClick={onChange('clock24hFormat')}
                  role='switch'
                  aria-checked={!!formData.clock24hFormat}
                >
                  <span className='nd-toggle-thumb' />
                </button>
              </div>
            </div>
          </Card>

          {/* Machine Settings */}
          <Card sm={10} lg={5} title='Machine Settings'>
            <div className='flex flex-col gap-5'>
              <div className='flex flex-col gap-2'>
                <label
                  htmlFor='pid'
                  className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
                >
                  PID Values
                </label>
                <div className='flex'>
                  <input
                    id='pid'
                    name='pid'
                    type='text'
                    className='nd-input nd-input--lg flex-1 rounded-r-none border-r-0'
                    placeholder='2.0, 0.1, 0.01'
                    value={formData.pid}
                    onChange={onChange('pid')}
                  />
                  <span className='nd-input-unit'>Kp, Ki, Kd</span>
                </div>
              </div>
              <div className='flex flex-col gap-2'>
                <label
                  htmlFor='kf'
                  className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
                >
                  Thermal Feedforward Gain
                </label>
                <div className='flex'>
                  <input
                    id='kf'
                    name='kf'
                    type='number'
                    step='0.001'
                    className='nd-input nd-input--lg flex-1 rounded-r-none border-r-0'
                    placeholder='0.600'
                    value={formData.kf}
                    onChange={onChange('kf')}
                  />
                  <span className='nd-input-unit'>Kff</span>
                </div>
                <div className='font-nd-mono text-[11px] text-[var(--text-disabled,#666)] mt-1'>
                  Set to 0 to disable feedforward control.
                </div>
              </div>
              <div className='flex flex-col gap-2'>
                <label
                  htmlFor='pumpModelCoeffs'
                  className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
                >
                  Pump Flow Coefficients
                </label>
                <div className='font-nd-mono text-[11px] text-[var(--text-disabled,#666)] mb-2'>
                  Enter 2 values (flow at 1 bar, flow at 9 bar)
                </div>
                <input
                  id='pumpModelCoeffs'
                  name='pumpModelCoeffs'
                  type='text'
                  className='nd-input nd-input--lg'
                  placeholder='10.205,5.521'
                  value={formData.pumpModelCoeffs}
                  onChange={onChange('pumpModelCoeffs')}
                />
              </div>
              <div className='flex flex-col gap-2'>
                <label
                  htmlFor='temperatureOffset'
                  className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
                >
                  Temperature Offset (°C)
                </label>
                <div className='flex'>
                  <input
                    id='temperatureOffset'
                    name='temperatureOffset'
                    type='number'
                    step='any'
                    className='nd-input nd-input--lg flex-1 rounded-r-none border-r-0'
                    placeholder='0'
                    value={formData.temperatureOffset}
                    onChange={onChange('temperatureOffset')}
                  />
                  <span className='nd-input-unit'>°C</span>
                </div>
              </div>
              {pressureAvailable.value && (
                <div className='flex flex-col gap-2'>
                  <label
                    htmlFor='pressureScaling'
                    className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
                  >
                    Pressure Sensor Rating
                  </label>
                  <div className='font-nd-mono text-[11px] text-[var(--text-disabled,#666)] mb-2'>
                    Enter the bar rating of the pressure sensor being used
                  </div>
                  <div className='flex'>
                    <input
                      id='pressureScaling'
                      name='pressureScaling'
                      type='number'
                      step='any'
                      className='nd-input nd-input--lg flex-1 rounded-r-none border-r-0'
                      placeholder='0.0'
                      value={formData.pressureScaling}
                      onChange={onChange('pressureScaling')}
                    />
                    <span className='nd-input-unit'>bar</span>
                  </div>
                </div>
              )}
              <div className='flex flex-col gap-2'>
                <label
                  htmlFor='steamPumpPercentage'
                  className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
                >
                  Steam Pump Assist
                </label>
                <div className='font-nd-mono text-[11px] text-[var(--text-disabled,#666)] mb-2'>
                  {pressureAvailable.value
                    ? 'How many ml/s to pump into the boiler during steaming'
                    : 'What percentage to run the pump at during steaming'}
                </div>
                <div className='flex'>
                  <input
                    id='steamPumpPercentage'
                    name='steamPumpPercentage'
                    type='number'
                    step='0.1'
                    className='nd-input nd-input--lg flex-1 rounded-r-none border-r-0'
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
                  <span className='nd-input-unit'>
                    {pressureAvailable.value ? 'ml/s' : '%'}
                  </span>
                </div>
              </div>
              {pressureAvailable.value && (
                <div className='flex flex-col gap-2'>
                  <label
                    htmlFor='steamPumpCutoff'
                    className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
                  >
                    Pump Assist Cutoff
                  </label>
                  <div className='font-nd-mono text-[11px] text-[var(--text-disabled,#666)] mb-2'>
                    At how many bars should the pump assist stop. This makes it so the pump will only
                    run when steam is flowing.
                  </div>
                  <div className='flex'>
                    <input
                      id='steamPumpCutoff'
                      name='steamPumpCutoff'
                      type='number'
                      step='any'
                      className='nd-input nd-input--lg flex-1 rounded-r-none border-r-0'
                      placeholder='0.0'
                      value={formData.steamPumpCutoff}
                      onChange={onChange('steamPumpCutoff')}
                    />
                    <span className='nd-input-unit'>bar</span>
                  </div>
                </div>
              )}
              <div className='flex flex-col gap-2'>
                <label
                  htmlFor='altRelayFunction'
                  className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
                >
                  Alt Relay / SSR2 Function
                </label>
                <select
                  id='altRelayFunction'
                  name='altRelayFunction'
                  className='nd-input nd-input--lg'
                  value={formData.altRelayFunction ?? 1}
                  onChange={onChange('altRelayFunction')}
                >
                  <option value={0}>None</option>
                  <option value={1}>Grind</option>
                  <option value={2} disabled className='text-[var(--text-disabled,#666)]'>
                    Steam Boiler (Coming Soon)
                  </option>
                </select>
              </div>
            </div>
          </Card>

          {/* Display Settings */}
          <Card sm={10} lg={5} title='Display Settings'>
            <div className='flex flex-col gap-5'>
              <div className='flex flex-col gap-2'>
                <label
                  htmlFor='mainBrightness'
                  className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
                >
                  Main Brightness (1-16)
                </label>
                <input
                  id='mainBrightness'
                  name='mainBrightness'
                  type='number'
                  className='nd-input nd-input--lg'
                  placeholder='16'
                  min='1'
                  max='16'
                  value={formData.mainBrightness}
                  onChange={onChange('mainBrightness')}
                />
              </div>
              <div className='border-l-2 border-[var(--text-secondary,#999)] pl-4'>
                <div className='font-nd-mono text-[13px] text-[var(--text-disabled,#666)]'>
                  Standby Display
                </div>
              </div>
              <div className='flex items-center justify-between'>
                <span className='font-nd-mono text-[14px] text-[var(--text-primary,#e8e8e8)]'>
                  Enable standby display
                </span>
                <button
                  type='button'
                  className={`nd-toggle ${formData.standbyDisplayEnabled ? 'nd-toggle--active' : ''}`}
                  onClick={onChange('standbyDisplayEnabled')}
                  role='switch'
                  aria-checked={formData.standbyDisplayEnabled}
                >
                  <span className='nd-toggle-thumb' />
                </button>
              </div>
              <div className='flex flex-col gap-2'>
                <label
                  htmlFor='standbyBrightness'
                  className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
                >
                  Standby Brightness (0-16)
                </label>
                <input
                  id='standbyBrightness'
                  name='standbyBrightness'
                  type='number'
                  className='nd-input nd-input--lg'
                  placeholder='8'
                  min='0'
                  max='16'
                  value={formData.standbyBrightness}
                  onChange={onChange('standbyBrightness')}
                  disabled={!formData.standbyDisplayEnabled}
                />
              </div>
              <div className='flex flex-col gap-2'>
                <label
                  htmlFor='standbyBrightnessTimeout'
                  className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
                >
                  Standby Brightness Timeout (s)
                </label>
                <div className='flex'>
                  <input
                    id='standbyBrightnessTimeout'
                    name='standbyBrightnessTimeout'
                    type='number'
                    className='nd-input nd-input--lg flex-1 rounded-r-none border-r-0'
                    placeholder='60'
                    min='1'
                    value={formData.standbyBrightnessTimeout}
                    onChange={onChange('standbyBrightnessTimeout')}
                  />
                  <span className='nd-input-unit'>s</span>
                </div>
              </div>
              <div className='flex flex-col gap-2'>
                <label
                  htmlFor='themeMode'
                  className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
                >
                  Theme
                </label>
                <select
                  id='themeMode'
                  name='themeMode'
                  className='nd-input nd-input--lg'
                  value={formData.themeMode}
                  onChange={onChange('themeMode')}
                >
                  <option value={0}>Dark Theme</option>
                  <option value={1}>Light Theme</option>
                </select>
              </div>
            </div>
          </Card>

          {/* Sunrise Settings */}
          {ledControl.value && (
            <Card sm={10} lg={5} title='Sunrise Settings'>
              <div className='flex flex-col gap-5'>
                <div className='font-nd-mono text-[13px] text-[var(--text-disabled,#666)]'>
                  Set the colors for the LEDs when in idle mode with no warnings.
                </div>
                <div className='grid grid-cols-2 gap-4'>
                  <div className='flex flex-col gap-2'>
                    <label
                      htmlFor='sunriseR'
                      className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
                    >
                      Red (0 - 255)
                    </label>
                    <input
                      id='sunriseR'
                      name='sunriseR'
                      type='number'
                      className='nd-input nd-input--lg'
                      placeholder='16'
                      value={formData.sunriseR}
                      onChange={onChange('sunriseR')}
                    />
                  </div>
                  <div className='flex flex-col gap-2'>
                    <label
                      htmlFor='sunriseG'
                      className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
                    >
                      Green (0 - 255)
                    </label>
                    <input
                      id='sunriseG'
                      name='sunriseG'
                      type='number'
                      className='nd-input nd-input--lg'
                      placeholder='16'
                      value={formData.sunriseG}
                      onChange={onChange('sunriseG')}
                    />
                  </div>
                  <div className='flex flex-col gap-2'>
                    <label
                      htmlFor='sunriseB'
                      className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
                    >
                      Blue (0 - 255)
                    </label>
                    <input
                      id='sunriseB'
                      name='sunriseB'
                      type='number'
                      className='nd-input nd-input--lg'
                      placeholder='16'
                      value={formData.sunriseB}
                      onChange={onChange('sunriseB')}
                    />
                  </div>
                  <div className='flex flex-col gap-2'>
                    <label
                      htmlFor='sunriseW'
                      className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
                    >
                      White (0 - 255)
                    </label>
                    <input
                      id='sunriseW'
                      name='sunriseW'
                      type='number'
                      className='nd-input nd-input--lg'
                      placeholder='16'
                      value={formData.sunriseW}
                      onChange={onChange('sunriseW')}
                    />
                  </div>
                </div>
                <div className='flex flex-col gap-2'>
                  <label
                    htmlFor='sunriseExtBrightness'
                    className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
                  >
                    External LED (0 - 255)
                  </label>
                  <input
                    id='sunriseExtBrightness'
                    name='sunriseExtBrightness'
                    type='number'
                    className='nd-input nd-input--lg'
                    placeholder='16'
                    value={formData.sunriseExtBrightness}
                    onChange={onChange('sunriseExtBrightness')}
                  />
                </div>
                <div className='flex flex-col gap-2'>
                  <label
                    htmlFor='emptyTankDistance'
                    className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
                  >
                    Distance from sensor to bottom of the tank
                  </label>
                  <div className='flex'>
                    <input
                      id='emptyTankDistance'
                      name='emptyTankDistance'
                      type='number'
                      className='nd-input nd-input--lg flex-1 rounded-r-none border-r-0'
                      placeholder='16'
                      value={formData.emptyTankDistance}
                      onChange={onChange('emptyTankDistance')}
                    />
                    <span className='nd-input-unit'>mm</span>
                  </div>
                </div>
                <div className='flex flex-col gap-2'>
                  <label
                    htmlFor='fullTankDistance'
                    className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
                  >
                    Distance from sensor to the fill line
                  </label>
                  <div className='flex'>
                    <input
                      id='fullTankDistance'
                      name='fullTankDistance'
                      type='number'
                      className='nd-input nd-input--lg flex-1 rounded-r-none border-r-0'
                      placeholder='16'
                      value={formData.fullTankDistance}
                      onChange={onChange('fullTankDistance')}
                    />
                    <span className='nd-input-unit'>mm</span>
                  </div>
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

        {/* Remote Access */}
        <RemoteAccessCard formData={formData} onChange={onChange} />

        {/* Warning + Action buttons */}
        <div className='col-span-10 pt-6'>
          <div className='border-l-2 border-[var(--color-warning,#d4a843)] pl-4 mb-4'>
            <span className='font-nd-mono text-[14px] text-[var(--text-disabled,#666)]'>
              Some options like Wi-Fi, NTP, and managing plugins require a restart.
            </span>
          </div>
          <div className='flex flex-col gap-3 sm:flex-row'>
            <a
              href='/'
              className='nd-action-btn nd-action-btn--text flex items-center justify-center gap-2'
            >
              <FontAwesomeIcon icon={faArrowLeft} />
              Back
            </a>
            <button
              type='submit'
              className='nd-action-btn nd-action-btn--primary nd-action-btn--text flex items-center justify-center gap-2'
              disabled={submitting}
            >
              {submitting ? <Spinner size={4} /> : <FontAwesomeIcon icon={faSave} />}
              Save
            </button>
            <button
              type='submit'
              name='restart'
              className='nd-action-btn nd-action-btn--primary nd-action-btn--text flex items-center justify-center gap-2'
              style={{ minWidth: '160px' }}
              disabled={submitting}
              onClick={e => onSubmit(e, true)}
            >
              <FontAwesomeIcon icon={faSave} />
              Save and Restart
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function RemoteAccessCard({ formData, onChange }) {
  const [copied, setCopied] = useState(false);

  const relayUrl = formData.cloudRelayUrl || '';
  const relayToken = formData.cloudRelayToken || '';
  const hasRelay = relayUrl && relayToken;

  const remoteLink = hasRelay
    ? `${window.location.origin}?relay=${encodeURIComponent(relayUrl)}&token=${encodeURIComponent(relayToken)}`
    : null;

  function copyLink() {
    if (!remoteLink) return;
    navigator.clipboard.writeText(remoteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Card sm={10} lg={10} title='Remote Access'>
      <div className='flex flex-col gap-5'>
        <p className='text-[14px] text-[var(--text-disabled,#666)]'>
          Deploy the relay server and enter its URL below to access your machine from anywhere.
        </p>
        <div className='flex flex-col gap-2'>
          <label
            htmlFor='cloudRelayUrl'
            className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
          >
            Relay Server URL
          </label>
          <input
            id='cloudRelayUrl'
            name='cloudRelayUrl'
            type='url'
            className='nd-input nd-input--lg'
            placeholder='wss://my-relay.fly.dev'
            value={relayUrl}
            onChange={onChange('cloudRelayUrl')}
          />
        </div>
        <div className='flex flex-col gap-2'>
          <label
            htmlFor='cloudRelayToken'
            className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'
          >
            Relay Token
          </label>
          <input
            id='cloudRelayToken'
            name='cloudRelayToken'
            type='password'
            className='nd-input nd-input--lg'
            placeholder='secret token'
            value={relayToken}
            onChange={onChange('cloudRelayToken')}
          />
        </div>
        {hasRelay && (
          <div className='flex flex-col gap-2'>
            <span className='font-nd-mono text-[14px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'>
              Remote Access Link
            </span>
            <div className='flex items-center gap-2'>
              <input
                readOnly
                className='nd-input nd-input--lg flex-1 font-mono text-xs'
                value={remoteLink}
              />
              <button type='button' onClick={copyLink} className='nd-action-btn nd-action-btn--text px-3'>
                {copied ? <FontAwesomeIcon icon={faCheck} /> : 'Copy'}
              </button>
            </div>
            <p className='text-[12px] text-[var(--text-disabled,#666)]'>
              Bookmark this link to access your machine remotely. Save settings first to activate the relay.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
