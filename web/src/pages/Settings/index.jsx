import { useQuery } from 'preact-fetching';
import { Spinner } from '../../components/Spinner.jsx';
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import Card from '../../components/Card.jsx';
import { timezones } from '../../config/zones.js';
import { computed } from '@preact/signals';
import { machine } from '../../services/ApiService.js';
import { getStoredTheme, handleThemeChange } from '../../utils/themeManager.js';
import { setDashboardLayout, DASHBOARD_LAYOUTS } from '../../utils/dashboardManager.js';
import { PluginCard } from './PluginCard.jsx';
import { setLocale, currentLocale } from '../../utils/i18n.js';
import { t } from '@lingui/core/macro';

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
        <h2 className='flex-grow text-2xl font-bold sm:text-3xl'>{t`Settings`}</h2>
        <button
          type='button'
          onClick={onExport}
          className='btn btn-ghost btn-sm'
          title={t`Export Settings`}
        >
          <i className='fa fa-file-export' />
        </button>
        <label
          htmlFor='settingsImport'
          className='btn btn-ghost btn-sm cursor-pointer'
          title={t`Import Settings`}
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
      <form key='settings' ref={formRef} method='post' action='/api/settings' onSubmit={onSubmit}>
        <div className='grid grid-cols-1 gap-4 lg:grid-cols-10'>
          <Card sm={10} lg={5} title={t`Temperature settings`}>
            <div className='form-control'>
              <label htmlFor='targetSteamTemp' className='mb-2 block text-sm font-medium'>
                {t`Default Steam Temperature (°C)`}
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
                {t`Default Water Temperature (°C)`}
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

          <Card sm={10} lg={5} title={t`User preferences`}>
            <div className='form-control'>
              <label htmlFor='startup-mode' className='mb-2 block text-sm font-medium'>
                {t`Startup Mode`}
              </label>
              <select
                id='startup-mode'
                name='startupMode'
                className='select select-bordered w-full'
                onChange={onChange('startupMode')}
              >
                <option value='standby' selected={formData.startupMode === 'standby'}>
                  {t`Standby`}
                </option>
                <option value='brew' selected={formData.startupMode === 'brew'}>
                  {t`Brew`}
                </option>
              </select>
            </div>

            <div className='form-control'>
              <label htmlFor='standbyTimeout' className='mb-2 block text-sm font-medium'>
                {t`Standby Timeout (s)`}
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

            <div className='divider'>{t`Predictive scale delay`}</div>
            <div className='mb-2 text-sm opacity-70'>
              {t`Shuts off the process ahead of time based on the flow rate to account for any dripping or delays in the control.`}
            </div>

            <div className='form-control'>
              <label className='label cursor-pointer'>
                <span className='label-text'>{t`Auto Adjust`}</span>
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

            <div className='divider'>{t`Switch control`}</div>
            <div className='form-control'>
              <label className='label cursor-pointer'>
                <span className='label-text'>{t`Use momentary switches`}</span>
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

          <Card sm={10} lg={5} title={t`Web Settings`}>
            <div className='form-control'>
              <label htmlFor='webui-theme' className='label'>
                <span className='label-text font-medium'>{t`Theme`}</span>
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
                <option value='light'>{t`Light`}</option>
                <option value='dark'>{t`Dark`}</option>
                <option value='coffee'>{t`Coffee`}</option>
                <option value='nord'>{t`Nord`}</option>
              </select>
            </div>

            <div className='form-control'>
              <label htmlFor='dashboardLayout' className='label'>
                <span className='label-text font-medium'>{t`Dashboard Layout`}</span>
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
                <option value={DASHBOARD_LAYOUTS.ORDER_FIRST}>{t`Process Controls First`}</option>
                <option value={DASHBOARD_LAYOUTS.ORDER_LAST}>{t`Chart First`}</option>
              </select>
            </div>

            <div className='form-control'>
              <label htmlFor='language' className='label'>
                <span className='label-text font-medium'>{t`Language`}</span>
              </label>
              <select
                id='language'
                name='language'
                className='select select-bordered w-full'
                value={currentLocale.value}
                onChange={async (e) => {
                  const newLocale = e.target.value;
                  await setLocale(newLocale);
                  localStorage.setItem('locale', newLocale);
                }}
              >
                <option value='en'>{t`English`}</option>
                <option value='fr'>{t`French`}</option>
                <option value='es'>{t`Spanish`}</option>
                <option value='de'>{t`German`}</option>
              </select>
            </div>
          </Card>

          <Card sm={10} lg={5} title={t`System preferences`}>
            <div className='form-control'>
              <label htmlFor='wifiSsid' className='mb-2 block text-sm font-medium'>
                {t`WiFi SSID`}
              </label>
              <input
                id='wifiSsid'
                name='wifiSsid'
                type='text'
                className='input input-bordered w-full'
                placeholder={t`WiFi SSID`}
                value={formData.wifiSsid}
                onChange={onChange('wifiSsid')}
              />
            </div>

            <div className='form-control'>
              <label htmlFor='wifiPassword' className='mb-2 block text-sm font-medium'>
                {t`WiFi Password`}
              </label>
              <input
                id='wifiPassword'
                name='wifiPassword'
                type='password'
                className='input input-bordered w-full'
                placeholder={t`WiFi Password`}
                value={formData.wifiPassword}
                onChange={onChange('wifiPassword')}
              />
            </div>

            <div className='form-control'>
              <label htmlFor='mdnsName' className='mb-2 block text-sm font-medium'>
                {t`Hostname`}
              </label>
              <input
                id='mdnsName'
                name='mdnsName'
                type='text'
                className='input input-bordered w-full'
                placeholder={t`Hostname`}
                value={formData.mdnsName}
                onChange={onChange('mdnsName')}
              />
            </div>

            <div className='form-control'>
              <label htmlFor='timezone' className='mb-2 block text-sm font-medium'>
                {t`Timezone`}
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

            <div className='divider'>{t`Clock`}</div>
            <div className='form-control'>
              <label className='label cursor-pointer'>
                <span className='label-text'>{t`24 Hour Clock`}</span>
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

          <Card sm={10} lg={5} title={t`Machine settings`}>
            <div className='form-control'>
              <label htmlFor='pid' className='mb-2 block text-sm font-medium'>
                {t`PID Values (Kp, Ki, Kd)`}
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
                {t`Pump Flow Coefficients`} <small>{t`Enter 2 values (flow at 1bar, flow at 9bar)`}</small>
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
                {t`Temperature Offset`}
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
                {t`Pressure sensor rating`}
              </label>
              <div className='mb-2 text-xs opacity-70'>
                {t`Enter the bar rating of the pressure sensor being used`}
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
                {t`Steam Pump Assist`}
              </label>
              <div className='mb-2 text-xs opacity-70'>
                {t`What percentage to run the pump at during steaming`}
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

          <Card sm={10} lg={5} title={t`Display settings`}>
            <div className='form-control'>
              <label htmlFor='mainBrightness' className='mb-2 block text-sm font-medium'>
                {t`Main Brightness (1-16)`}
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

            <div className='divider'>{t`Standby Display`}</div>
            <div className='form-control'>
              <label className='label cursor-pointer'>
                <span className='label-text'>{t`Enable Standby Display`}</span>
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
                {t`Standby Brightness (0-16)`}
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
                {t`Standby Brightness Timeout (seconds)`}
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
                {t`Display Theme`}
              </label>
              <select
                id='themeMode'
                name='themeMode'
                className='select select-bordered w-full'
                value={formData.themeMode}
                onChange={onChange('themeMode')}
              >
                <option value={0}>{t`Dark Theme`}</option>
                <option value={1}>{t`Light Theme`}</option>
              </select>
            </div>
          </Card>

          {ledControl.value && (
            <Card sm={10} lg={5} title={t`Sunrise Settings`}>
              <div className='mb-2 text-sm opacity-70'>
                {t`Set the colors for the LEDs when in idle mode with no warnings.`}
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div className='form-control'>
                  <label htmlFor='sunriseR' className='mb-2 block text-sm font-medium'>
                    {t`Red (0 - 255)`}
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
                    {t`Green (0 - 255)`}
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
                    {t`Blue (0 - 255)`}
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
                    {t`White (0 - 255)`}
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
                  {t`External LED (0 - 255)`}
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
                  {t`Distance from sensor to bottom of the tank`}
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
                  {t`Distance from sensor to the fill line`}
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

          <Card sm={10} title={t`Plugins`}>
            <PluginCard formData={formData} onChange={onChange} />
          </Card>
        </div>

        <div className='pt-4 lg:col-span-10'>
          <div className='alert alert-info'>
            <span>{t`Some options like WiFi, NTP and managing Plugins require a restart.`}</span>
          </div>

          <div className='flex flex-col gap-2 pt-4 sm:flex-row'>
            <a href='/' className='btn btn-outline'>
              {t`Back`}
            </a>
            <button type='submit' className='btn btn-primary' disabled={submitting}>
              {submitting && <Spinner size={4} />}
              {t`Save`}
            </button>
            <button
              type='submit'
              name='restart'
              className='btn btn-secondary'
              disabled={submitting}
              onClick={e => onSubmit(e, true)}
            >
              {t`Save and Restart`}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
