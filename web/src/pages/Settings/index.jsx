import { faEye, faEyeSlash, faFileExport, faFileImport } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { computed } from '@preact/signals';
import { useQuery } from 'preact-fetching';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import Card from '../../components/Card.jsx';
import { Spinner } from '../../components/Spinner.jsx';
import { timezones } from '../../config/zones.js';
import { machine } from '../../services/ApiService.js';
import { DASHBOARD_LAYOUTS, setDashboardLayout } from '../../utils/dashboardManager.js';
import { downloadJson } from '../../utils/download.js';
import { getStoredTheme, handleThemeChange } from '../../utils/themeManager.js';
import { PluginCard } from './PluginCard.jsx';

const ledControl = computed(() => machine.value.capabilities.ledControl);
const pressureAvailable = computed(() => machine.value.capabilities.pressure);

export function Settings() {
  const [submitting, setSubmitting] = useState(false);
  const [gen] = useState(0);
  const [formData, setFormData] = useState({});
  const [currentTheme, setCurrentTheme] = useState('light');
  const [showPassword, setShowPassword] = useState(false);
  const [autowakeupSchedules, setAutoWakeupSchedules] = useState([
    { time: '07:00', days: [true, true, true, true, true, true, true] }, // Default: all days enabled
  ]);
  const { isLoading, data: fetchedSettings } = useQuery(`settings/${gen}`, async () => {
    const response = await fetch(`/api/settings`);
    const data = await response.json();
    return data;
  });

  const formRef = useRef();

  useEffect(() => {
    if (fetchedSettings) {
      // Initialize standbyDisplayEnabled based on standby brightness value
      // but preserve it if it already exists in the fetched data
      const settingsWithToggle = {
        ...fetchedSettings,
        standbyDisplayEnabled:
          fetchedSettings.standbyDisplayEnabled !== undefined
            ? fetchedSettings.standbyDisplayEnabled
            : fetchedSettings.standbyBrightness > 0,
        dashboardLayout: fetchedSettings.dashboardLayout || DASHBOARD_LAYOUTS.ORDER_FIRST,
      };

      // Extract Kf from PID string and separate them
      if (fetchedSettings.pid) {
        const pidParts = fetchedSettings.pid.split(',');
        if (pidParts.length >= 4) {
          // PID string has Kf as 4th parameter
          settingsWithToggle.pid = pidParts.slice(0, 3).join(','); // First 3 params
          settingsWithToggle.kf = pidParts[3]; // 4th parameter
        } else {
          // No Kf in PID string, use default
          settingsWithToggle.kf = '0.000';
        }
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

      // Only preserve standbyDisplayEnabled if brightness is greater than 0
      // If brightness is 0, let the useEffect recalculate it based on the saved value
      const updatedData = {
        ...data,
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
            <div className='flex flex-col gap-4'>
              <div className='form-control'>
                <label htmlFor='targetSteamTemp' className='label py-1'>
                  <span className='label-text text-base-content/80 font-medium'>
                    Default Steam Temperature
                  </span>
                </label>
                <div className='join w-full'>
                  <input
                    id='targetSteamTemp'
                    name='targetSteamTemp'
                    type='number'
                    className='input input-bordered join-item w-full'
                    placeholder='135'
                    value={formData.targetSteamTemp}
                    onChange={onChange('targetSteamTemp')}
                  />
                  <span className='join-item border-base-content/20 bg-base-200 flex items-center border border-l-0 px-4 font-medium opacity-60'>
                    °C
                  </span>
                </div>
              </div>

              <div className='form-control'>
                <label htmlFor='targetWaterTemp' className='label py-1'>
                  <span className='label-text text-base-content/80 font-medium'>
                    Default Water Temperature
                  </span>
                </label>
                <div className='join w-full'>
                  <input
                    id='targetWaterTemp'
                    name='targetWaterTemp'
                    type='number'
                    className='input input-bordered join-item w-full'
                    placeholder='80'
                    value={formData.targetWaterTemp}
                    onChange={onChange('targetWaterTemp')}
                  />
                  <span className='join-item border-base-content/20 bg-base-200 flex items-center border border-l-0 px-4 font-medium opacity-60'>
                    °C
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* User Preferences Section */}
          <Card sm={10} lg={5} title='User Preferences'>
            <div className='flex flex-col gap-4'>
              {/* Startup Configuration */}
              <div className='form-control'>
                <label htmlFor='startupMode' className='label py-1'>
                  <span className='label-text text-base-content/80 font-medium'>Startup Mode</span>
                </label>
                <select
                  id='startupMode'
                  name='startupMode'
                  className='select select-bordered w-full'
                  value={formData.startupMode}
                  onChange={onChange('startupMode')}
                >
                  <option value='standby'>Standby</option>
                  <option value='brew'>Brew</option>
                </select>
              </div>

              {/* Predictive Scale Delay Logic */}
              <div className='divider my-2 text-xs tracking-widest uppercase opacity-50'>
                Predictive Scale Delay
              </div>
              <div className='form-control bg-base-200/30 rounded-lg px-4 py-3'>
                <div className='mb-2 flex items-center justify-between'>
                  <span className='label-text text-base-content/90 font-medium'>
                    Enable auto adjustment
                  </span>
                  <input
                    id='delayAdjust'
                    name='delayAdjust'
                    type='checkbox'
                    className='toggle toggle-primary'
                    checked={!!formData.delayAdjust}
                    onChange={onChange('delayAdjust')}
                  />
                </div>
                <p className='text-xs leading-relaxed opacity-60'>
                  Predicts the ideal time to stop the pump, ensuring the final weight in your cup
                  matches your target precisely.
                </p>
              </div>

              {/* Manual Offsets */}
              <div className='mt-2 grid grid-cols-2 gap-4 px-1'>
                <div className='form-control'>
                  <label htmlFor='brewDelay' className='label py-1'>
                    <span className='label-text text-base-content/80 font-medium'>Brew Offset</span>
                  </label>
                  <div className='join w-full'>
                    <input
                      id='brewDelay'
                      name='brewDelay'
                      type='number'
                      className='input input-bordered join-item w-full'
                      value={formData.brewDelay}
                      onChange={onChange('brewDelay')}
                    />
                    <span className='join-item border-base-content/20 bg-base-200 flex items-center border border-l-0 px-3 text-xs font-medium opacity-60'>
                      ms
                    </span>
                  </div>
                </div>
                <div className='form-control'>
                  <label htmlFor='grindDelay' className='label py-1'>
                    <span className='label-text text-base-content/80 font-medium'>
                      Grind Offset
                    </span>
                  </label>
                  <div className='join w-full'>
                    <input
                      id='grindDelay'
                      name='grindDelay'
                      type='number'
                      className='input input-bordered join-item w-full'
                      value={formData.grindDelay}
                      onChange={onChange('grindDelay')}
                    />
                    <span className='join-item border-base-content/20 bg-base-200 flex items-center border border-l-0 px-3 text-xs font-medium opacity-60'>
                      ms
                    </span>
                  </div>
                </div>
              </div>

              {/* Hardware Switch Configuration */}
              <div className='divider my-2 text-xs tracking-widest uppercase opacity-50'>
                Switch Control
              </div>
              <div className='form-control bg-base-200/30 rounded-lg px-4 py-3'>
                <div className='mb-2 flex items-center justify-between'>
                  <span className='label-text font-medium'>Use momentary switches</span>
                  <input
                    id='momentaryButtons'
                    name='momentaryButtons'
                    type='checkbox'
                    className='toggle toggle-primary'
                    checked={!!formData.momentaryButtons}
                    onChange={onChange('momentaryButtons')}
                  />
                </div>
                <p className='text-xs leading-relaxed opacity-60'>
                  Enable for spring-return buttons. Disable for original on/off rocker switches.
                </p>
              </div>
            </div>
          </Card>

          {/* Web Interface Settings */}
          <Card sm={10} lg={5} title='Web Settings'>
            <div className='flex flex-col gap-4'>
              {/* Visual Appearance */}
              <div className='form-control'>
                <label htmlFor='webui-theme' className='label py-1'>
                  <span className='label-text text-base-content/80 font-medium'>
                    Interface Theme
                  </span>
                </label>
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
              </div>

              {/* Dashboard Structure */}
              <div className='form-control'>
                <label htmlFor='dashboardLayout' className='label py-1'>
                  <span className='label-text text-base-content/80 font-medium'>
                    Interface Layout
                  </span>
                </label>
                <select
                  id='dashboardLayout'
                  name='dashboardLayout'
                  className='select select-bordered w-full'
                  value={formData.dashboardLayout || DASHBOARD_LAYOUTS.ORDER_FIRST}
                  onChange={e => {
                    const value = e.target.value;
                    setFormData({
                      ...formData,
                      dashboardLayout: value,
                    });
                    setDashboardLayout(value);
                  }}
                >
                  <option value={DASHBOARD_LAYOUTS.ORDER_FIRST}>Controls</option>
                  <option value={DASHBOARD_LAYOUTS.ORDER_LAST}>Visualizer</option>
                </select>
                <div className='px-1 pt-2'>
                  <p className='text-xs leading-relaxed opacity-60'>
                    Prioritizes either the brewing controls or the extraction chart on the
                    dashboard.
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* System Configuration */}
          <Card sm={10} lg={5} title='System Preferences'>
            <div className='flex flex-col gap-4'>
              {/* Network Settings */}
              <div className='form-control'>
                <label htmlFor='wifiSsid' className='label py-1'>
                  <span className='label-text text-base-content/80 font-medium'>Wi-Fi Network</span>
                </label>
                <input
                  id='wifiSsid'
                  name='wifiSsid'
                  type='text'
                  className='input input-bordered w-full'
                  placeholder='SSID'
                  value={formData.wifiSsid}
                  onChange={onChange('wifiSsid')}
                />
              </div>

              <div className='group relative flex items-center'>
                <input
                  id='wifiPassword'
                  name='wifiPassword'
                  type={showPassword ? 'text' : 'password'}
                  className='input input-bordered focus:border-primary w-full pr-11 transition-colors focus:outline-none'
                  placeholder='••••••••'
                  value={formData.wifiPassword}
                  onChange={onChange('wifiPassword')}
                />
                <button
                  type='button'
                  className='text-base-content/40 hover:text-primary pointer-events-auto absolute right-0 z-20 flex h-full items-center justify-center border-none bg-transparent px-4 transition-colors focus:outline-none'
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowPassword(!showPassword);
                  }}
                  tabIndex='-1'
                >
                  <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} className='text-sm' />
                </button>
              </div>

              <div className='form-control'>
                <label htmlFor='mdnsName' className='label py-1'>
                  <span className='label-text text-base-content/80 font-medium'>
                    Device Hostname
                  </span>
                </label>
                <div className='join w-full'>
                  <input
                    id='mdnsName'
                    name='mdnsName'
                    type='text'
                    className='input input-bordered join-item w-full'
                    placeholder='espresso'
                    value={formData.mdnsName}
                    onChange={onChange('mdnsName')}
                  />
                  <span className='join-item border-base-content/20 bg-base-200 flex items-center border border-l-0 px-4 font-mono text-xs opacity-60'>
                    .local
                  </span>
                </div>
                {/* Unified Help Text Pattern */}
                <div className='px-1 pt-2'>
                  <p className='text-xs leading-relaxed opacity-60'>
                    Sets the address used to access this interface on your local network.
                  </p>
                </div>
              </div>

              {/* Regional Settings */}
              <div className='divider my-2 text-xs tracking-widest uppercase opacity-50'>
                Localization
              </div>

              <div className='form-control'>
                <label htmlFor='timezone' className='label py-1'>
                  <span className='label-text text-base-content/80 font-medium'>Time Zone</span>
                </label>
                <select
                  id='timezone'
                  name='timezone'
                  className='select select-bordered w-full'
                  value={formData.timezone}
                  onChange={onChange('timezone')}
                >
                  {timezones.map(tz => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>

              <div className='form-control bg-base-200/30 rounded-lg px-4 py-3'>
                <div className='mb-2 flex items-center justify-between'>
                  <span className='label-text font-medium'>Use 24h format</span>
                  <input
                    id='clock24hFormat'
                    name='clock24hFormat'
                    type='checkbox'
                    className='toggle toggle-primary'
                    checked={!!formData.clock24hFormat}
                    onChange={onChange('clock24hFormat')}
                  />
                </div>
                <p className='text-xs leading-relaxed opacity-60'>
                  Switches the hardware display and web logs to military time.
                </p>
              </div>
            </div>
          </Card>

          <Card sm={10} lg={5} title='Machine Settings'>
            <div className='flex flex-col gap-6'>
              {/* Thermal Group */}
              <div className='flex flex-col gap-4'>
                <div className='divider my-0 text-[10px] tracking-[0.2em] uppercase opacity-40'>
                  Thermal Control
                </div>

                {/* PID Values */}
                <div className='form-control'>
                  <label htmlFor='pid' className='label py-1'>
                    <span className='label-text text-base-content/70 font-semibold'>
                      PID Values
                    </span>
                  </label>
                  <div className='join w-full'>
                    <input
                      id='pid'
                      name='pid'
                      type='text'
                      className='input input-bordered join-item w-full'
                      placeholder='2.0, 0.1, 0.01'
                      value={formData.pid}
                      onChange={onChange('pid')}
                    />
                    <span className='join-item border-base-content/20 bg-base-200 flex items-center border border-l-0 px-2 font-mono text-[10px] whitespace-nowrap opacity-60'>
                      K<sub>p</sub>, K<sub>i</sub>, K<sub>d</sub>
                    </span>
                  </div>
                  <div className='px-1 pt-2'>
                    <p className='text-xs leading-relaxed opacity-60'>
                      Fine-tune the boiler heating algorithm. Enter Kp, Ki, and Kd separated by
                      commas.
                    </p>
                  </div>
                </div>

                {/* Thermal Feedforward */}
                <div className='form-control'>
                  <label htmlFor='kf' className='label py-1'>
                    <span className='label-text text-base-content/70 font-semibold'>
                      Thermal Feedforward
                    </span>
                  </label>
                  <div className='join w-full'>
                    <input
                      id='kf'
                      name='kf'
                      type='number'
                      step='0.001'
                      className='input input-bordered join-item w-full'
                      placeholder='0.600'
                      value={formData.kf}
                      onChange={onChange('kf')}
                    />
                    <span className='join-item border-base-content/20 bg-base-200 flex items-center border border-l-0 px-2 text-xs whitespace-nowrap opacity-60'>
                      K<sub>ff</sub>
                    </span>
                  </div>
                  <div className='px-1 pt-2'>
                    <p className='text-xs leading-relaxed opacity-60'>
                      Anticipates the drop in temperature when cold water enters the boiler. Set to
                      0 to disable.
                    </p>
                  </div>
                </div>

                {/* Temperature Offset */}
                <div className='form-control'>
                  <label htmlFor='temperatureOffset' className='label py-1'>
                    <span className='label-text text-base-content/70 font-semibold'>
                      Temperature Offset
                    </span>
                  </label>
                  <div className='join w-full'>
                    <input
                      id='temperatureOffset'
                      name='temperatureOffset'
                      type='number'
                      className='input input-bordered join-item w-full'
                      placeholder='0'
                      value={formData.temperatureOffset}
                      onChange={onChange('temperatureOffset')}
                    />
                    <span className='join-item border-base-content/20 bg-base-200 flex items-center border border-l-0 px-2 text-xs whitespace-nowrap opacity-60'>
                      °C
                    </span>
                  </div>
                  <div className='px-1 pt-2'>
                    <p className='text-xs leading-relaxed opacity-60'>
                      Corrects for the heat loss between the boiler sensor and the grouphead.
                    </p>
                  </div>
                </div>
              </div>

              {/* Flow Group */}
              <div className='flex flex-col gap-4'>
                <div className='divider my-0 text-[10px] tracking-[0.2em] uppercase opacity-40'>
                  Flow & Pressure
                </div>

                {/* Pump Flow Coefficients */}
                <div className='form-control'>
                  <label htmlFor='pumpModelCoeffs' className='label py-1'>
                    <span className='label-text text-base-content/70 font-semibold'>
                      Pump Flow Coefficients
                    </span>
                  </label>
                  <div className='join w-full'>
                    <input
                      id='pumpModelCoeffs'
                      name='pumpModelCoeffs'
                      type='text'
                      className='input input-bordered join-item w-full'
                      placeholder='10.205, 5.521'
                      value={formData.pumpModelCoeffs}
                      onChange={onChange('pumpModelCoeffs')}
                    />
                    <span className='join-item border-base-content/20 bg-base-200 flex items-center border border-l-0 px-2 text-xs whitespace-nowrap opacity-60'>
                      bar
                    </span>
                  </div>
                  <div className='px-1 pt-2'>
                    <p className='text-xs leading-relaxed opacity-60'>
                      Calibration for flow estimation. Enter the measured flow rates (ml/s) at 1 bar
                      and 9 bar.
                    </p>
                  </div>
                </div>

                {pressureAvailable.value && (
                  <div className='form-control'>
                    <label htmlFor='pressureScaling' className='label py-1'>
                      <span className='label-text text-base-content/70 font-semibold'>
                        Sensor Rating
                      </span>
                    </label>
                    <div className='join w-full'>
                      <input
                        id='pressureScaling'
                        name='pressureScaling'
                        type='number'
                        className='input input-bordered join-item w-full'
                        placeholder='0.0'
                        value={formData.pressureScaling}
                        onChange={onChange('pressureScaling')}
                      />
                      <span className='join-item border-base-content/20 bg-base-200 flex items-center border border-l-0 px-2 text-xs whitespace-nowrap opacity-60'>
                        bar
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Steam Assist Group */}
              <div className='flex flex-col gap-4'>
                <div className='divider my-0 text-[10px] tracking-[0.2em] uppercase opacity-40'>
                  Steam Assist
                </div>

                <div className='form-control'>
                  <label htmlFor='steamPumpPercentage' className='label py-1'>
                    <span className='label-text text-base-content/70 font-semibold'>
                      Pump Assist
                    </span>
                  </label>
                  <div className='join w-full'>
                    <input
                      id='steamPumpPercentage'
                      name='steamPumpPercentage'
                      type='number'
                      className='input input-bordered join-item w-full'
                      value={String(
                        formData.steamPumpPercentage * (pressureAvailable.value ? 0.1 : 1),
                      )}
                      onChange={onChange('steamPumpPercentage')}
                      onBlur={e =>
                        setFormData({
                          ...formData,
                          steamPumpPercentage: (
                            parseFloat(e.target.value) * (pressureAvailable.value ? 10 : 1)
                          ).toFixed(0),
                        })
                      }
                    />
                    <span className='join-item border-base-content/20 bg-base-200 flex items-center border border-l-0 px-2 text-xs whitespace-nowrap opacity-60'>
                      {pressureAvailable.value ? 'ml/s' : '%'}
                    </span>
                  </div>
                  <div className='px-1 pt-2'>
                    <p className='text-xs leading-relaxed opacity-60'>
                      {pressureAvailable.value
                        ? 'Water volume to inject into the boiler to maintain steam pressure.'
                        : 'Fixed power percentage for the pump while steaming.'}
                    </p>
                  </div>
                </div>

                {pressureAvailable.value && (
                  <div className='form-control'>
                    <label htmlFor='steamPumpCutoff' className='label py-1'>
                      <span className='label-text text-base-content/70 font-semibold'>
                        Cutoff Pressure
                      </span>
                    </label>
                    <div className='join w-full'>
                      <input
                        id='steamPumpCutoff'
                        name='steamPumpCutoff'
                        type='number'
                        className='input input-bordered join-item w-full'
                        placeholder='0.0'
                        value={formData.steamPumpCutoff}
                        onChange={onChange('steamPumpCutoff')}
                      />
                      <span className='join-item border-base-content/20 bg-base-200 flex items-center border border-l-0 px-2 text-xs whitespace-nowrap opacity-60'>
                        bar
                      </span>
                    </div>
                    <div className='px-1 pt-2'>
                      <p className='text-xs leading-relaxed opacity-60'>
                        Prevents overfilling. The pump assist will stop once boiler pressure reaches
                        this limit.
                      </p>
                    </div>
                  </div>
                )}

                <div className='divider my-0 text-[10px] tracking-[0.2em] uppercase opacity-40'>
                  Expansion
                </div>
                <div className='form-control'>
                  <label htmlFor='altRelayFunction' className='label py-1'>
                    <span className='label-text text-base-content/70 font-semibold'>
                      SSR2 Function
                    </span>
                  </label>
                  <select
                    id='altRelayFunction'
                    name='altRelayFunction'
                    className='select select-bordered w-full'
                    value={formData.altRelayFunction !== undefined ? formData.altRelayFunction : 1}
                    onChange={onChange('altRelayFunction')}
                  >
                    <option value={0}>None</option>
                    <option value={1}>Grinder</option>
                    <option value={2} disabled>
                      Steam Boiler (Coming Soon)
                    </option>
                  </select>
                </div>
              </div>
            </div>
          </Card>

          <Card sm={10} lg={5} title='Display Settings'>
            <div className='flex flex-col gap-6'>
              {/* Main Interface Group */}
              <div className='flex flex-col gap-4'>
                <div className='form-control'>
                  <label htmlFor='mainBrightness' className='label py-1'>
                    <span className='label-text text-base-content/70 font-semibold'>
                      Main Brightness
                    </span>
                  </label>
                  <input
                    id='mainBrightness'
                    name='mainBrightness'
                    type='number'
                    className='input input-bordered w-full'
                    placeholder='16'
                    value={formData.mainBrightness}
                    onChange={onChange('mainBrightness')}
                  />
                  <div className='px-1 pt-2'>
                    <p className='text-xs leading-relaxed opacity-60'>
                      Sets the screen brightness during active use (1 to 16).
                    </p>
                  </div>
                </div>

                <div className='form-control'>
                  <label htmlFor='themeMode' className='label py-1'>
                    <span className='label-text text-base-content/70 font-semibold'>
                      Interface Theme
                    </span>
                  </label>
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
                </div>
              </div>

              {/* Standby Group */}
              <div className='flex flex-col gap-4'>
                <div className='divider my-0 text-[10px] tracking-[0.2em] uppercase opacity-40'>
                  Standby Mode
                </div>

                <div className='form-control'>
                  <label className='label cursor-pointer justify-start gap-4 py-1'>
                    <input
                      id='standbyDisplayEnabled'
                      name='standbyDisplayEnabled'
                      type='checkbox'
                      className='toggle toggle-primary toggle-sm'
                      checked={formData.standbyDisplayEnabled}
                      onChange={onChange('standbyDisplayEnabled')}
                    />
                    <span className='label-text text-base-content/70 font-semibold'>
                      Enable Standby Display
                    </span>
                  </label>
                </div>

                <div
                  className={`border-base-content/5 flex flex-col gap-4 border-l-2 pl-4 transition-opacity duration-200 ${!formData.standbyDisplayEnabled ? 'opacity-40' : 'opacity-100'}`}
                >
                  <div className='form-control'>
                    <label htmlFor='standbyBrightness' className='label py-1'>
                      <span className='label-text text-base-content/70 font-semibold'>
                        Standby Brightness
                      </span>
                    </label>
                    <input
                      id='standbyBrightness'
                      name='standbyBrightness'
                      type='number'
                      className='input input-bordered w-full'
                      placeholder='8'
                      value={formData.standbyBrightness}
                      onChange={onChange('standbyBrightness')}
                      disabled={!formData.standbyDisplayEnabled}
                    />
                    <div className='px-1 pt-2'>
                      <p className='text-xs leading-relaxed opacity-60'>
                        Brightness level when in standby (range 0 to 16).
                      </p>
                    </div>
                  </div>

                  <div className='form-control'>
                    <label htmlFor='standbyBrightnessTimeout' className='label py-1'>
                      <span className='label-text text-base-content/70 font-semibold'>
                        Standby Timeout
                      </span>
                    </label>
                    <div className='join w-full'>
                      <input
                        id='standbyBrightnessTimeout'
                        name='standbyBrightnessTimeout'
                        type='number'
                        className='input input-bordered join-item w-full'
                        placeholder='60'
                        value={formData.standbyBrightnessTimeout}
                        onChange={onChange('standbyBrightnessTimeout')}
                        disabled={!formData.standbyDisplayEnabled}
                      />
                      <span className='join-item border-base-content/20 bg-base-200 flex items-center border border-l-0 px-3 text-xs whitespace-nowrap opacity-60'>
                        sec
                      </span>
                    </div>
                    <div className='px-1 pt-2'>
                      <p className='text-xs leading-relaxed opacity-60'>
                        Seconds of inactivity before the display dims.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {ledControl.value && (
            <Card sm={10} lg={5} title='Sunrise Settings'>
              <div className='mb-2 text-sm opacity-70'>
                Set the colors for the LEDs when in idle mode with no warnings.
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div className='form-control'>
                  <label htmlFor='sunriseR' className='mb-2 block text-sm font-medium'>
                    Red (0 - 255)
                  </label>
                  <input
                    id='sunriseR'
                    name='sunriseR'
                    type='number'
                    className='input input-bordered w-full'
                    placeholder='16'
                    min='0'
                    max='255'
                    value={formData.sunriseR}
                    onChange={onChange('sunriseR')}
                  />
                </div>
                <div className='form-control'>
                  <label htmlFor='sunriseG' className='mb-2 block text-sm font-medium'>
                    Green (0 - 255)
                  </label>
                  <input
                    id='sunriseG'
                    name='sunriseG'
                    type='number'
                    className='input input-bordered w-full'
                    placeholder='16'
                    min='0'
                    max='255'
                    value={formData.sunriseG}
                    onChange={onChange('sunriseG')}
                  />
                </div>
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div className='form-control'>
                  <label htmlFor='sunriseB' className='mb-2 block text-sm font-medium'>
                    Blue (0 - 255)
                  </label>
                  <input
                    id='sunriseB'
                    name='sunriseB'
                    type='number'
                    className='input input-bordered w-full'
                    placeholder='16'
                    min='0'
                    max='255'
                    value={formData.sunriseB}
                    onChange={onChange('sunriseB')}
                  />
                </div>
                <div className='form-control'>
                  <label htmlFor='sunriseW' className='mb-2 block text-sm font-medium'>
                    White (0 - 255)
                  </label>
                  <input
                    id='sunriseW'
                    name='sunriseW'
                    type='number'
                    className='input input-bordered w-full'
                    placeholder='16'
                    min='0'
                    max='255'
                    value={formData.sunriseW}
                    onChange={onChange('sunriseW')}
                  />
                </div>
              </div>

              <div className='form-control'>
                <label htmlFor='sunriseExtBrightness' className='mb-2 block text-sm font-medium'>
                  External LED (0 - 255)
                </label>
                <input
                  id='sunriseExtBrightness'
                  name='sunriseExtBrightness'
                  type='number'
                  className='input input-bordered w-full'
                  placeholder='16'
                  min='0'
                  max='255'
                  value={formData.sunriseExtBrightness}
                  onChange={onChange('sunriseExtBrightness')}
                />
              </div>

              <div className='form-control'>
                <label htmlFor='emptyTankDistance' className='mb-2 block text-sm font-medium'>
                  Distance from sensor to bottom of the tank
                </label>
                <input
                  id='emptyTankDistance'
                  name='emptyTankDistance'
                  type='number'
                  className='input input-bordered w-full'
                  placeholder='16'
                  min='0'
                  max='1000'
                  value={formData.emptyTankDistance}
                  onChange={onChange('emptyTankDistance')}
                />
              </div>

              <div className='form-control'>
                <label htmlFor='fullTankDistance' className='mb-2 block text-sm font-medium'>
                  Distance from sensor to the fill line
                </label>
                <input
                  id='fullTankDistance'
                  name='fullTankDistance'
                  type='number'
                  className='input input-bordered w-full'
                  placeholder='16'
                  min='0'
                  max='1000'
                  value={formData.fullTankDistance}
                  onChange={onChange('fullTankDistance')}
                />
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
          <div className='alert alert-warning'>
            <span>Some options like Wi-Fi, NTP, and managing plugins require a restart.</span>
          </div>

          <div className='flex flex-col gap-2 pt-4 sm:flex-row'>
            <a href='/' className='btn btn-outline'>
              Back
            </a>
            <button type='submit' className='btn btn-primary' disabled={submitting}>
              {submitting && <Spinner size={4} />}
              Save
            </button>
            <button
              type='submit'
              name='restart'
              className='btn btn-secondary'
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
