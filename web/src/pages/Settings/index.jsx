import { useQuery } from 'preact-fetching';
import { Spinner } from '../../components/Spinner.jsx';
import { useState, useEffect, useCallback, useRef, useContext } from 'preact/hooks';
import Card from '../../components/Card.jsx';
import { timezones } from '../../config/zones.js';
import { computed } from '@preact/signals';
import { machine, ApiServiceContext } from '../../services/ApiService.js';
import { getStoredTheme, handleThemeChange } from '../../utils/themeManager.js';
import { setDashboardLayout, DASHBOARD_LAYOUTS } from '../../utils/dashboardManager.js';
import { PluginCard } from './PluginCard.jsx';
import { downloadJson } from '../../utils/download.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileExport } from '@fortawesome/free-solid-svg-icons/faFileExport';
import { faFileImport } from '@fortawesome/free-solid-svg-icons/faFileImport';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons/faTrashCan';
import { faWeightScale } from '@fortawesome/free-solid-svg-icons/faWeightScale';

const ledControl = computed(() => machine.value.capabilities.ledControl);
const pressureAvailable = computed(() => machine.value.capabilities.pressure);
const hwScale = computed(() => machine.value.capabilities.hardwareScale);

export function Settings() {
  const [submitting, setSubmitting] = useState(false);
  const [gen] = useState(0);
  const [formData, setFormData] = useState({});
  const [currentTheme, setCurrentTheme] = useState('light');
  const [calibrationWeight, setCalibrationWeight] = useState('');
  const apiService = useContext(ApiServiceContext);
  const status = computed(() => machine.value.status);
  
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

  // Calibration helper functions
  const tareScale = useCallback(() => {
    apiService.send({
      tp: 'req:scale:tare',
    });
  }, [apiService]);

  const calibrateLoadCell = useCallback((cellNumber) => {
    const currentWeight = status.value?.currentWeight;
    const actualWeight = parseFloat(calibrationWeight);
    
    if (!currentWeight || !actualWeight || actualWeight <= 0) {
      alert('Please ensure the scale is showing a weight and enter a valid calibration weight.');
      return;
    }

    // Calculate new scale factor using the formula: Scale_Factor_New = (Current_Weight * Factor_Old) / Actual_Weight_Of_Calibration_Object
    const currentFactor = cellNumber === 1 ? parseFloat(formData.scaleFactor1) || 1 : parseFloat(formData.scaleFactor2) || 1;
    const newFactor = (currentWeight * currentFactor) / actualWeight;
    
    // Update the appropriate scale factor in the form
    if (cellNumber === 1) {
      setFormData(prev => ({ ...prev, scaleFactor1: newFactor.toFixed(2) }));
    } else {
      setFormData(prev => ({ ...prev, scaleFactor2: newFactor.toFixed(2) }));
    }
    
    // Clear the calibration weight input
    setCalibrationWeight('');
  }, [status, calibrationWeight, formData.scaleFactor1, formData.scaleFactor2, setFormData]);

  const onSubmit = useCallback(
    async (e, restart = false) => {
      e.preventDefault();
      setSubmitting(true);
      const form = formRef.current;
      const formDataToSubmit = new FormData(form);
      formDataToSubmit.set('steamPumpPercentage', formData.steamPumpPercentage);

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
                <option value={DASHBOARD_LAYOUTS.ORDER_FIRST}>Process Controls First</option>
                <option value={DASHBOARD_LAYOUTS.ORDER_LAST}>Chart First</option>
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
              <label htmlFor='pumpModelCoeffs' className='mb-2 block text-sm font-medium'>
                Pump Flow Coefficients <small>Enter 2 values (flow at 1bar, flow at 9bar)</small>
              </label>
              <input
                id='pumpModelCoeffs'
                name='pumpModelCoeffs'
                type='text'
                className='input input-bordered w-full'
                placeholder='10.205,5.521'
                value={formData.pumpModelCoeffs}
                onChange={onChange('pumpModelCoeffs')}
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

            {pressureAvailable.value && (
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
            )}

            <div className='form-control'>
              <label htmlFor='steamPumpPercentage' className='mb-2 block text-sm font-medium'>
                Steam Pump Assist
              </label>
              <div className='mb-2 text-xs opacity-70'>
                {pressureAvailable.value
                  ? 'How many ml/s to pump into the boiler during steaming'
                  : 'What percentage to run the pump at during steaming'}
              </div>
              <input
                id='steamPumpPercentage'
                name='steamPumpPercentage'
                type='number'
                inputmode='decimal'
                className='input input-bordered w-full'
                placeholder={pressureAvailable.value ? '0.0 ml/s' : '0.0 %'}
                min='0'
                step='0.1'
                value={String(formData.steamPumpPercentage * (pressureAvailable.value ? 0.1 : 1))}
                onBlur={e =>
                  setFormData({
                    ...formData,
                    steamPumpPercentage: (
                      parseFloat(e.target.value) * (pressureAvailable.value ? 10 : 1)
                    ).toFixed(0),
                  })
                }
              />
            </div>

            {pressureAvailable.value && (
              <div className='form-control'>
                <label htmlFor='steamPumpCutoff' className='mb-2 block text-sm font-medium'>
                  Pump Assist Cutoff
                </label>
                <div className='mb-2 text-xs opacity-70'>
                  At how many bars should the pump assist stop. This makes it so the pump will only
                  run when steam is flowing.
                </div>
                <input
                  id='steamPumpCutoff'
                  name='steamPumpCutoff'
                  type='number'
                  inputMode='decimal'
                  className='input input-bordered w-full'
                  placeholder='0.0 bar'
                  min='0'
                  step='any'
                  value={formData.steamPumpCutoff}
                  onChange={onChange('steamPumpCutoff')}
                />
              </div>
            )}
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

          <Card sm={10} lg={5} title='Scales'>
            <div className='mb-2 text-sm opacity-70'>
              Choose which scale to use when both hardware and Bluetooth scales are available
            </div>
            
            <div className='form-control'>
              <label htmlFor='preferredScaleSource' className='mb-2 block text-sm font-medium'>
                Preferred Scale Source
              </label>
              <select
                id='preferredScaleSource'
                name='preferredScaleSource'
                className='select select-bordered w-full'
                value={formData.preferredScaleSource || 'hardware'}
                onChange={onChange('preferredScaleSource')}
              >
                <option value='hardware'>Prefer Hardware Scale (Built-in)</option>
                <option value='bluetooth'>Prefer Bluetooth Scale</option>
                <option value='flow_estimation'>Prefer Flow Estimation</option>
              </select>
            </div>
            
            <div className='mt-2 text-xs opacity-60'>
              Note: Grinding by weight will always use Bluetooth scale regardless of this setting
            </div>

            {/* Hardware Scale Calibration */}
            {hwScale.value && (
              <>
                <div className='divider'>Hardware Scale Calibration</div>
                <div className='mb-4 text-sm opacity-70'>
                  Use this tool to calibrate your load cells with a known weight object.
                </div>
                
                {/* Current Weight Display */}
                <div className='form-control'>
                  <label className='mb-2 block text-sm font-medium'>Current Weight</label>
                  <div className='flex items-center justify-between rounded-lg border border-base-300 bg-base-100 p-3'>
                    <div className='flex items-center space-x-2'>
                      <FontAwesomeIcon icon={faWeightScale} className='text-primary' />
                      <span className='text-2xl font-bold'>
                        {status.value?.currentWeight?.toFixed(1) || '0.0'}g
                      </span>
                    </div>
                    <button
                      type='button'
                      className='btn btn-outline btn-sm'
                      onClick={tareScale}
                    >
                      Tare
                    </button>
                  </div>
                </div>
                
                {/* Calibration Weight Input */}
                <div className='form-control'>
                  <label className='mb-2 block text-sm font-medium'>
                    Actual Weight of Calibration Object
                  </label>
                  <div className='flex items-center space-x-3'>
                    <input
                      type='number'
                      className='input input-bordered flex-1'
                      placeholder='100.0'
                      min='0.1'
                      step='0.1'
                      value={calibrationWeight}
                      onChange={(e) => setCalibrationWeight(e.target.value)}
                    />
                    <span className='text-sm opacity-70'>grams</span>
                  </div>
                </div>
                
                {/* Calibration Buttons */}
                <div className='grid grid-cols-2 gap-4'>
                  <button
                    type='button'
                    className='btn btn-primary btn-sm'
                    onClick={() => calibrateLoadCell(1)}
                    disabled={!status.value?.currentWeight || !calibrationWeight}
                  >
                    Calibrate Load Cell 1
                  </button>
                  <button
                    type='button'
                    className='btn btn-primary btn-sm'
                    onClick={() => calibrateLoadCell(2)}
                    disabled={!status.value?.currentWeight || !calibrationWeight}
                  >
                    Calibrate Load Cell 2
                  </button>
                </div>
                
                <div className='text-xs opacity-60'>
                  Tare the scale.Place a known weight on one load cell, enter its actual weight above, then click the appropriate load cell calibration button. Repeat for the other load cell.
                </div>
                
                <div className='divider'>Manual Scale Factors</div>
                <div className='mb-2 text-sm opacity-70'>
                  Or manually set the calibration factors for the hardware scale
                </div>
                
                <div className='form-control mb-3'>
                  <label htmlFor='scaleFactor1' className='mb-2 block text-sm font-medium'>
                    Load Cell 1 Scale Factor
                  </label>
                  <input
                    id='scaleFactor1'
                    name='scaleFactor1'
                    type='number'
                    className='input input-bordered w-full'
                    placeholder='-2500.00'
                    min='-50000.00'
                    max='50000.00'
                    step='0.01'
                    value={formData.scaleFactor1}
                    onChange={onChange('scaleFactor1')}
                  />
                </div>
                
                <div className='form-control'>
                  <label htmlFor='scaleFactor2' className='mb-2 block text-sm font-medium'>
                    Load Cell 2 Scale Factor
                  </label>
                  <input
                    id='scaleFactor2'
                    name='scaleFactor2'
                    type='number'
                    className='input input-bordered w-full'
                    placeholder='2500.00'
                    min='-50000.00'
                    max='50000.00'
                    step='0.01'
                    value={formData.scaleFactor2}
                    onChange={onChange('scaleFactor2')}
                  />
                </div>
              </>
            )}
          </Card>

          <Card sm={10} title='Plugins'>
            <PluginCard formData={formData} onChange={onChange} />
          </Card>
        </div>

        <div className='pt-4 lg:col-span-10'>
          <div className='alert alert-warning'>
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