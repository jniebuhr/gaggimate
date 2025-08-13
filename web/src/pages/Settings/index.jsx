import { useQuery } from 'preact-fetching';
import { Spinner } from '../../components/Spinner.jsx';
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import Card from '../../components/Card.jsx';
import { timezones } from '../../config/zones.js';
import { computed } from '@preact/signals';
import { machine } from '../../services/ApiService.js';
import { getStoredTheme, handleThemeChange } from '../../utils/themeManager.js';
import { setDashboardLayout } from '../../utils/dashboardManager.js';
import { PluginCard } from './PluginCard.jsx';

const ledControl = computed(() => machine.value.capabilities.ledControl);

export function Settings() {
  const [submitting, setSubmitting] = useState(false);
  const [gen] = useState(0);
  const [formData, setFormData] = useState({});
  const [currentTheme, setCurrentTheme] = useState('light');
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
        dashboardLayout: fetchedSettings.dashboardLayout || 'process-first',
      };
      setFormData(settingsWithToggle);
    } else {
      setFormData({});
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

  const onSubmit = useCallback(
    async (e, restart = false) => {
      e.preventDefault();
      setSubmitting(true);
      const form = formRef.current;
      const formDataToSubmit = new FormData(form);

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
    [setFormData, formRef, formData],
  );

  const onExport = useCallback(() => {
    const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(formData, undefined, 2))}`;
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', dataStr);
    downloadAnchorNode.setAttribute('download', 'settings.json');
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
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
          <i className='fa fa-file-export' />
        </button>
        <label
          htmlFor='settingsImport'
          className='btn btn-ghost btn-sm cursor-pointer'
          title='Import Settings'
        >
          <i className='fa fa-file-import' />
        </label>
        <input
          onChange={onUpload}
          className='hidden'
          id='settingsImport'
          type='file'
          accept='.json,application/json'
        />
      </div>
      <Card xs={12} lg={6} title="Temperature settings">
        <div>
          <label htmlFor="targetSteamTemp" className="block font-medium text-gray-700 dark:text-gray-400">
            Default Steam Temperature (°C)
          </label>
          <input
            id="targetSteamTemp"
            name="targetSteamTemp"
            type="number"
            className="input-field"
            placeholder="135"
            value={formData.targetSteamTemp}
            onChange={onChange('targetSteamTemp')}
          />
        </div>

        <div>
          <label htmlFor="targetWaterTemp" className="block font-medium text-gray-700 dark:text-gray-400">
            Default Water Temperature (°C)
          </label>
          <input
            id="targetWaterTemp"
            name="targetWaterTemp"
            type="number"
            className="input-field"
            placeholder="80"
            value={formData.targetWaterTemp}
            onChange={onChange('targetWaterTemp')}
          />
        </div>
      </Card>
      <Card xs={12} lg={6} title="User preferences">
        <div>
          <label htmlFor="startup-mode" className="block font-medium text-gray-700 dark:text-gray-400">
            Startup Mode
          </label>
          <select id="startup-mode" name="startupMode" className="input-field" onChange={onChange('startupMode')}>
            <option value="standby" selected={formData.startupMode === 'standby'}>
              Standby
            </option>
            <option value="brew" selected={formData.startupMode === 'brew'}>
              Brew
            </option>
          </select>
        </div>
        <div>
          <label htmlFor="standbyTimeout" className="block font-medium text-gray-700 dark:text-gray-400">
            Standby Timeout (s)
          </label>
          <input
            id="standbyTimeout"
            name="standbyTimeout"
            type="number"
            className="input-field"
            placeholder="0"
            value={formData.standbyTimeout}
            onChange={onChange('standbyTimeout')}
          />
        </div>

        <div>
          <b>Predictive scale delay</b>
        </div>
        <div>
          <small>
            Shuts off the process ahead of time based on the flow rate to account for any dripping or delays in the control.
          </small>
        </div>

        <div className="flex flex-row gap-4">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              id="delayAdjust"
              name="delayAdjust"
              value="delayAdjust"
              type="checkbox"
              className="sr-only peer"
              checked={!!formData.delayAdjust}
              onChange={onChange('delayAdjust')}
            />
            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
          <p>Auto Adjust</p>
        </div>
        <div className="flex flex-row gap-4">
          <div className="flex-auto">
            <label htmlFor="brewDelay" className="block font-medium text-gray-700 dark:text-gray-400">
              Brew (ms)
            </label>
            <input
              id="brewDelay"
              name="brewDelay"
              type="number"
              step="any"
              className="input-field"
              placeholder="0"
              value={formData.brewDelay}
              onChange={onChange('brewDelay')}
            />
          </div>
          <div className="flex-auto">
            <label htmlFor="grindDelay" className="block font-medium text-gray-700 dark:text-gray-400">
              Grind (ms)
            </label>
            <input
              id="grindDelay"
              name="grindDelay"
              type="number"
              step="any"
              className="input-field"
              placeholder="0"
              value={formData.grindDelay}
              onChange={onChange('grindDelay')}
            />
          </div>
        </div>

        <div>
          <b>Switch control</b>
        </div>
        <div className="flex flex-row gap-4">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              id="momentaryButtons"
              name="momentaryButtons"
              value="momentaryButtons"
              type="checkbox"
              className="sr-only peer"
              checked={!!formData.momentaryButtons}
              onChange={onChange('momentaryButtons')}
            />
            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
          <p>Use momentary switches</p>
        </div>
      </Card>
      <Card xs={12} lg={6} title="System preferences">
        <div>
          <label htmlFor="wifiSsid" className="block font-medium text-gray-700 dark:text-gray-400">
            WiFi SSID
          </label>
          <input
            id="wifiSsid"
            name="wifiSsid"
            type="text"
            className="input-field"
            placeholder="WiFi SSID"
            value={formData.wifiSsid}
            onChange={onChange('wifiSsid')}
          />
        </div>
        <div>
          <label htmlFor="wifiPassword" className="block font-medium text-gray-700 dark:text-gray-400">
            WiFi Password
          </label>
          <input
            id="wifiPassword"
            name="wifiPassword"
            type="password"
            className="input-field"
            placeholder="WiFi Password"
            value={formData.wifiPassword}
            onChange={onChange('wifiPassword')}
          />
        </div>
        <div>
          <label htmlFor="mdnsName" className="block font-medium text-gray-700 dark:text-gray-400">
            Hostname
          </label>
          <input
            id="mdnsName"
            name="mdnsName"
            type="text"
            className="input-field"
            placeholder="Hostname"
            value={formData.mdnsName}
            onChange={onChange('mdnsName')}
          />
        </div>
        <div>
          <label htmlFor="timezone" className="block font-medium text-gray-700 dark:text-gray-400">
            Timezone
          </label>
          <select id="timezone" name="timezone" className="input-field" onChange={onChange('timezone')}>
            {timezones.map((timezone) => (
              <option key={timezone} value={timezone} selected={formData.timezone === timezone}>
                {timezone}
              </option>
            ))}
          </select>
        </div>
        <div>
          <b>Clock</b>
        </div>
        <div className="flex flex-row gap-4">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              id="clock24hFormat"
              name="clock24hFormat"
              value="clock24hFormat"
              type="checkbox"
              className="sr-only peer"
              checked={!!formData.clock24hFormat}
              onChange={onChange('clock24hFormat')}
            />
            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
          <p>Use 24h Format</p>
        </div>
      </Card>
      <Card xs={12} lg={6} title="Machine settings">
        <div>
          <label htmlFor="pid" className="block font-medium text-gray-700 dark:text-gray-400">
            PID Values (Kp, Ki, Kd)
          </label>
          <input
            id="pid"
            name="pid"
            type="text"
            className="input-field"
            placeholder="2.0, 0.1, 0.01"
            value={formData.pid}
            onChange={onChange('pid')}
          />
        </div>
        <div>
          <label htmlFor="pumpModelCoeffs" className="block font-medium text-gray-700 dark:text-gray-400">
            Pump Flow Coefficients <small>Enter 2 values (flow at 1bar, flow at 9bar)</small>
          </label>
          <input
            id="pumpModelCoeffs"
            name="pumpModelCoeffs"
            type="text"
            className="input-field"
            placeholder="10.205,5.521"
            value={formData.pumpModelCoeffs}
            onChange={onChange('pumpModelCoeffs')}
          />
        </div>
        <div>
          <label htmlFor="temperatureOffset" className="block font-medium text-gray-700 dark:text-gray-400">
            Temperature Offset
          </label>
          <div className="flex">
            <input
              id="temperatureOffset"
              name="temperatureOffset"
              type="number"
              className="input-field addition"
              placeholder="0"
              value={formData.temperatureOffset}
              onChange={onChange('temperatureOffset')}
            />
            <span className="input-addition">°C</span>
          </div>
        </div>
        <div>
          <label htmlFor="pressureScaling" className="block font-medium text-gray-700 dark:text-gray-400">
            Pressure sensor rating <small>Enter the bar rating of the pressure sensor being used</small>
          </label>
          <div className="flex">
            <input
              id="pressureScaling"
              name="pressureScaling"
              type="number"
              inputMode="decimal"
              placeholder="0.0"
              className="input-field addition"
              min="0"
              step="any"
              value={formData.pressureScaling}
              onChange={onChange('pressureScaling')}
            />
            <span className="input-addition">bar</span>
          </div>
        </div>
        <div>
          <label htmlFor="pressureScaling" className="block font-medium text-gray-700 dark:text-gray-400">
            Steam Pump Assist <small>What percentage to run the pump at during steaming</small>
          </label>
          <div className="flex">
            <input
              id="steamPumpPercentage"
              name="steamPumpPercentage"
              type="number"
              inputMode="decimal"
              placeholder="0.0"
              className="input-field addition"
              min="0"
              step="any"
              value={formData.steamPumpPercentage}
              onChange={onChange('steamPumpPercentage')}
            />
            <span className="input-addition">%</span>
          </div>
        </div>
      </Card>
      <Card xs={12} lg={6} title="Display settings">
        <div>
          <label htmlFor="mainBrightness" className="block font-medium text-gray-700 dark:text-gray-400">
            Main Brightness (1-16)
          </label>
          <input
            id="mainBrightness"
            name="mainBrightness"
            type="number"
            className="input-field"
            placeholder="16"
            min="1"
            max="16"
            value={formData.mainBrightness}
            onChange={onChange('mainBrightness')}
          />
        </div>

      <form key='settings' ref={formRef} method='post' action='/api/settings' onSubmit={onSubmit}>
        <div className='grid grid-cols-1 gap-4 lg:grid-cols-10'>
          <Card sm={10} lg={5} title='Temperature settings'>
            <div className='form-control'>
              <label htmlFor='targetSteamTemp' className='mb-2 block text-sm font-medium'>
                Default Steam Temperature (°C)
              </label>
              <input
                id='targetSteamTemp'
                name='targetSteamTemp'
                type='number'
                className='input input-bordered w-full'
                placeholder='135'
                value={formData.targetSteamTemp}
                onChange={onChange('targetSteamTemp')}
              />
            </div>

            <div className='form-control'>
              <label htmlFor='targetWaterTemp' className='mb-2 block text-sm font-medium'>
                Default Water Temperature (°C)
              </label>
              <input
                id='targetWaterTemp'
                name='targetWaterTemp'
                type='number'
                className='input input-bordered w-full'
                placeholder='80'
                value={formData.targetWaterTemp}
                onChange={onChange('targetWaterTemp')}
              />
            </div>
          </Card>

          <Card sm={10} lg={5} title='User preferences'>
            <div className='form-control'>
              <label htmlFor='startup-mode' className='mb-2 block text-sm font-medium'>
                Startup Mode
              </label>
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
            </div>

            <div className='form-control'>
              <label htmlFor='standbyTimeout' className='mb-2 block text-sm font-medium'>
                Standby Timeout (s)
              </label>
              <input
                id='standbyTimeout'
                name='standbyTimeout'
                type='number'
                className='input input-bordered w-full'
                placeholder='0'
                value={formData.standbyTimeout}
                onChange={onChange('standbyTimeout')}
              />
            </div>

            <div className='divider'>Predictive scale delay</div>
            <div className='mb-2 text-sm opacity-70'>
              Shuts off the process ahead of time based on the flow rate to account for any dripping
              or delays in the control.
            </div>

            <div className='form-control'>
              <label className='label cursor-pointer'>
                <span className='label-text'>Auto Adjust</span>
                <input
                  id='delayAdjust'
                  name='delayAdjust'
                  value='delayAdjust'
                  type='checkbox'
                  className='toggle toggle-primary'
                  checked={!!formData.delayAdjust}
                  onChange={onChange('delayAdjust')}
                />
              </label>
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div className='form-control'>
                <label htmlFor='brewDelay' className='mb-2 block text-sm font-medium'>
                  Brew (ms)
                </label>
                <input
                  id='brewDelay'
                  name='brewDelay'
                  type='number'
                  step='any'
                  className='input input-bordered w-full'
                  placeholder='0'
                  value={formData.brewDelay}
                  onChange={onChange('brewDelay')}
                />
              </div>
              <div className='form-control'>
                <label htmlFor='grindDelay' className='mb-2 block text-sm font-medium'>
                  Grind (ms)
                </label>
                <input
                  id='grindDelay'
                  name='grindDelay'
                  type='number'
                  step='any'
                  className='input input-bordered w-full'
                  placeholder='0'
                  value={formData.grindDelay}
                  onChange={onChange('grindDelay')}
                />
              </div>
            </div>

            <div className='divider'>Switch control</div>
            <div className='form-control'>
              <label className='label cursor-pointer'>
                <span className='label-text'>Use momentary switches</span>
                <input
                  id='momentaryButtons'
                  name='momentaryButtons'
                  value='momentaryButtons'
                  type='checkbox'
                  className='toggle toggle-primary'
                  checked={!!formData.momentaryButtons}
                  onChange={onChange('momentaryButtons')}
                />
              </label>
            </div>
          </Card>

          <Card sm={10} lg={5} title='Web Settings'>
            <div className='form-control'>
              <label htmlFor='webui-theme' className='label'>
                <span className='label-text font-medium'>Theme</span>
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

            <div className='form-control'>
              <label htmlFor='dashboardLayout' className='label'>
                <span className='label-text font-medium'>Dashboard Layout</span>
              </label>
              <select
                id='dashboardLayout'
                name='dashboardLayout'
                className='select select-bordered w-full'
                value={formData.dashboardLayout || 'process-first'}
                onChange={e => {
                  const value = e.target.value;
                  setFormData({
                    ...formData,
                    dashboardLayout: value,
                  });
                  setDashboardLayout(value);
                }}
              >
                <option value='process-first'>Process Controls Left</option>
                <option value='chart-first'>Chart Left</option>
              </select>
            </div>
          </Card>

          <Card sm={10} lg={5} title='System preferences'>
            <div className='form-control'>
              <label htmlFor='wifiSsid' className='mb-2 block text-sm font-medium'>
                WiFi SSID
              </label>
              <input
                id='wifiSsid'
                name='wifiSsid'
                type='text'
                className='input input-bordered w-full'
                placeholder='WiFi SSID'
                value={formData.wifiSsid}
                onChange={onChange('wifiSsid')}
              />
            </div>

            <div className='form-control'>
              <label htmlFor='wifiPassword' className='mb-2 block text-sm font-medium'>
                WiFi Password
              </label>
              <input
                id='wifiPassword'
                name='wifiPassword'
                type='password'
                className='input input-bordered w-full'
                placeholder='WiFi Password'
                value={formData.wifiPassword}
                onChange={onChange('wifiPassword')}
              />
            </div>

            <div className='form-control'>
              <label htmlFor='mdnsName' className='mb-2 block text-sm font-medium'>
                Hostname
              </label>
              <input
                id='mdnsName'
                name='mdnsName'
                type='text'
                className='input input-bordered w-full'
                placeholder='Hostname'
                value={formData.mdnsName}
                onChange={onChange('mdnsName')}
              />
            </div>

            <div className='form-control'>
              <label htmlFor='timezone' className='mb-2 block text-sm font-medium'>
                Timezone
              </label>
              <select
                id='timezone'
                name='timezone'
                className='select select-bordered w-full'
                onChange={onChange('timezone')}
              >
                {timezones.map(timezone => (
                  <option key={timezone} value={timezone} selected={formData.timezone === timezone}>
                    {timezone}
                  </option>
                ))}
              </select>
            </div>

            <div className='divider'>Clock</div>
            <div className='form-control'>
              <label className='label cursor-pointer'>
                <span className='label-text'>Use 24h Format</span>
                <input
                  id='clock24hFormat'
                  name='clock24hFormat'
                  value='clock24hFormat'
                  type='checkbox'
                  className='toggle toggle-primary'
                  checked={!!formData.clock24hFormat}
                  onChange={onChange('clock24hFormat')}
                />
              </label>
            </div>
          </Card>

          <Card sm={10} lg={5} title='Machine settings'>
            <div className='form-control'>
              <label htmlFor='pid' className='mb-2 block text-sm font-medium'>
                PID Values (Kp, Ki, Kd)
              </label>
              <input
                id='pid'
                name='pid'
                type='text'
                className='input input-bordered w-full'
                placeholder='2.0, 0.1, 0.01'
                value={formData.pid}
                onChange={onChange('pid')}
              />
            </div>

            <div className='form-control'>
              <label htmlFor='temperatureOffset' className='mb-2 block text-sm font-medium'>
                Temperature Offset
              </label>
              <input
                id='temperatureOffset'
                name='temperatureOffset'
                type='number'
                inputMode='decimal'
                className='input input-bordered w-full'
                placeholder='0 °C'
                min='0'
                step='any'
                value={formData.temperatureOffset}
                onChange={onChange('temperatureOffset')}
              />
            </div>

            <div className='form-control'>
              <label htmlFor='pressureScaling' className='mb-2 block text-sm font-medium'>
                Pressure sensor rating
              </label>
              <div className='mb-2 text-xs opacity-70'>
                Enter the bar rating of the pressure sensor being used
              </div>
              <input
                id='pressureScaling'
                name='pressureScaling'
                type='number'
                inputMode='decimal'
                className='input input-bordered w-full'
                placeholder='0.0 bar'
                min='0'
                step='any'
                value={formData.pressureScaling}
                onChange={onChange('pressureScaling')}
              />
            </div>

            <div className='form-control'>
              <label htmlFor='steamPumpPercentage' className='mb-2 block text-sm font-medium'>
                Steam Pump Assist
              </label>
              <div className='mb-2 text-xs opacity-70'>
                What percentage to run the pump at during steaming
              </div>
              <input
                id='steamPumpPercentage'
                name='steamPumpPercentage'
                type='number'
                inputMode='decimal'
                className='input input-bordered w-full'
                placeholder='0.0 %'
                min='0'
                step='any'
                value={formData.steamPumpPercentage}
                onChange={onChange('steamPumpPercentage')}
              />
            </div>
          </Card>

          <Card sm={10} lg={5} title='Display settings'>
            <div className='form-control'>
              <label htmlFor='mainBrightness' className='mb-2 block text-sm font-medium'>
                Main Brightness (1-16)
              </label>
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
            </div>

            <div className='divider'>Standby Display</div>
            <div className='form-control'>
              <label className='label cursor-pointer'>
                <span className='label-text'>Enable standby display</span>
                <input
                  id='standbyDisplayEnabled'
                  name='standbyDisplayEnabled'
                  value='standbyDisplayEnabled'
                  type='checkbox'
                  className='toggle toggle-primary'
                  checked={formData.standbyDisplayEnabled}
                  onChange={onChange('standbyDisplayEnabled')}
                />
              </label>
            </div>

            <div className='form-control'>
              <label htmlFor='standbyBrightness' className='mb-2 block text-sm font-medium'>
                Standby Brightness (0-16)
              </label>
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
            </div>

            <div className='form-control'>
              <label htmlFor='standbyBrightnessTimeout' className='mb-2 block text-sm font-medium'>
                Standby Brightness Timeout (seconds)
              </label>
              <input
                id='standbyBrightnessTimeout'
                name='standbyBrightnessTimeout'
                type='number'
                className='input input-bordered w-full'
                placeholder='60'
                min='1'
                value={formData.standbyBrightnessTimeout}
                onChange={onChange('standbyBrightnessTimeout')}
              />
            </div>

            <div className='form-control'>
              <label htmlFor='themeMode' className='mb-2 block text-sm font-medium'>
                Theme
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
            <PluginCard formData={formData} onChange={onChange} />
          </Card>
        </div>

        <div className='pt-4 lg:col-span-10'>
          <div className='alert alert-info'>
            <span>Some options like WiFi, NTP and managing Plugins require a restart.</span>
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
