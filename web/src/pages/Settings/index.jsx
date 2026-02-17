import { faEye, faEyeSlash, faFileExport, faFileImport } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { computed } from '@preact/signals';
import { useQuery } from 'preact-fetching';
import { useCallback, useEffect, useReducer, useRef, useState } from 'preact/hooks';

import Card from '../../components/Card.jsx';
import { Spinner } from '../../components/Spinner.jsx';
import { timezones } from '../../config/zones.js';
import { machine } from '../../services/ApiService.js';
import { DASHBOARD_LAYOUTS, setDashboardLayout } from '../../utils/dashboardManager.js';
import { downloadJson } from '../../utils/download.js';
import { getStoredTheme, handleThemeChange } from '../../utils/themeManager.js';
import { PluginCard } from './PluginCard.jsx';

// --- Constants ---
const NUMERIC_FIELDS = [
  'targetSteamTemp',
  'targetWaterTemp',
  'standbyTimeout',
  'brewDelay',
  'grindDelay',
  'mainBrightness',
  'standbyBrightness',
  'standbyBrightnessTimeout',
  'sunriseR',
  'sunriseG',
  'sunriseB',
  'sunriseW',
  'sunriseExtBrightness',
  'emptyTankDistance',
  'fullTankDistance',
  'altRelayFunction',
  'themeMode',
  'temperatureOffset',
  'pressureScaling',
  'steamPumpCutoff',
  'startupFillTime',
  'steamFillTime',
  'haPort',
];

const DEFAULT_WAKEUP_SCHEDULE = {
  time: '07:30',
  days: Array(7).fill(true),
};

const ledControl = computed(() => machine.value?.capabilities?.ledControl ?? false);
const pressureAvailable = computed(() => machine.value?.capabilities?.pressure ?? false);

// --- Helpers ---
const normalizeValue = ({ type, value, checked }) => (type === 'checkbox' ? checked : value);

const transformAPItoForm = data => {
  if (!data) return {};
  const transformed = { ...data };

  if (data.pid) {
    const parts = data.pid.split(',');
    transformed.pid = parts.slice(0, 3).join(',');
    transformed.kf = parts[3] || '0.000';
  }

  if (pressureAvailable.value && data.steamPumpPercentage) {
    transformed.steamPumpPercentage = (data.steamPumpPercentage / 10).toString();
  }

  NUMERIC_FIELDS.forEach(field => {
    if (transformed[field] != null) {
      transformed[field] = transformed[field].toString();
    }
  });

  return transformed;
};

const parseSchedules = scheduleStr => {
  if (typeof scheduleStr !== 'string' || !scheduleStr.trim()) return [DEFAULT_WAKEUP_SCHEDULE];
  const parsed = scheduleStr
    .split(';')
    .map(str => {
      const [time, daysStr] = str.split('|');
      if (time && daysStr?.length === 7) {
        return { time, days: daysStr.split('').map(d => d === '1') };
      }
      return null;
    })
    .filter(Boolean);
  return parsed.length > 0 ? parsed : [DEFAULT_WAKEUP_SCHEDULE];
};

// --- Sub-Components ---
const Field = ({ label, id, children, helpText, className = 'mb-4' }) => (
  <div className={`form-control ${className}`}>
    {label && (
      <label htmlFor={id} className='mb-2 block text-sm font-medium'>
        {label}
      </label>
    )}
    {children}
    {helpText && <div className='mt-2 text-xs opacity-70'>{helpText}</div>}
  </div>
);

const Input = ({ id, unit, className = '', suffix, ...props }) => (
  <div className='join w-full'>
    <input id={id} className={`input input-bordered join-item w-full ${className}`} {...props} />
    {unit && (
      <span className='btn btn-disabled join-item no-animation bg-base-300 border-base-content/20'>
        {unit}
      </span>
    )}
  </div>
);

const Toggle = ({ label, id, checked, onChange }) => (
  <Field className='mb-4'>
    <label className='label cursor-pointer p-0'>
      <span className='label-text font-medium'>{label}</span>
      <input
        id={id}
        type='checkbox'
        className='toggle toggle-primary'
        checked={checked}
        onChange={onChange}
      />
    </label>
  </Field>
);

const Select = ({ label, id, children, ...props }) => (
  <Field label={label} id={id}>
    <select id={id} className='select select-bordered w-full' {...props}>
      {children}
    </select>
  </Field>
);

// --- Reducer ---
function autoWakeupReducer(state, action) {
  switch (action.type) {
    case 'INIT':
      return action.payload?.length ? action.payload : [DEFAULT_WAKEUP_SCHEDULE];
    case 'ADD':
      return [...state, { ...DEFAULT_WAKEUP_SCHEDULE }];
    case 'REMOVE':
      return state.length > 1 ? state.filter((_, i) => i !== action.index) : state;
    case 'UPDATE_TIME':
      return state.map((s, i) => (i === action.index ? { ...s, time: action.time } : s));
    case 'UPDATE_DAY':
      return state.map((s, i) =>
        i === action.scheduleIndex
          ? { ...s, days: s.days.map((d, di) => (di === action.dayIndex ? action.enabled : d)) }
          : s,
      );
    default:
      return state;
  }
}

// --- Main Component ---
export function Settings() {
  const formRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'success' or 'error'
  const [formData, setFormData] = useState({});
  const [currentTheme, setCurrentTheme] = useState('light');
  const [showPassword, setShowPassword] = useState(false);
  const [autowakeupSchedules, dispatchAutoWakeup] = useReducer(autoWakeupReducer, [
    DEFAULT_WAKEUP_SCHEDULE,
  ]);

  const { isLoading, data: fetchedSettings } = useQuery('settings', async () => {
    const response = await fetch('/api/settings');
    return response.json();
  });

  useEffect(() => {
    if (fetchedSettings) {
      setFormData(transformAPItoForm(fetchedSettings));
      dispatchAutoWakeup({
        type: 'INIT',
        payload: parseSchedules(fetchedSettings.autowakeupSchedules),
      });
    }
    setCurrentTheme(getStoredTheme());
  }, [fetchedSettings]);

  const onChange = key => e => {
    const value = normalizeValue(e.currentTarget);
    setFormData(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'pid' && typeof value === 'string' && value.includes(',')) {
        const parts = value.split(',');
        if (parts.length > 3) {
          next.pid = parts.slice(0, 3).join(',');
          next.kf = parts[3];
        }
      }
      return next;
    });
    if (key === 'dashboardLayout') setDashboardLayout(value);
  };

  const addAutoWakeupSchedule = () => dispatchAutoWakeup({ type: 'ADD' });
  const removeAutoWakeupSchedule = index => dispatchAutoWakeup({ type: 'REMOVE', index });
  const updateAutoWakeupTime = (index, time) =>
    dispatchAutoWakeup({ type: 'UPDATE_TIME', index, time });
  const updateAutoWakeupDay = (scheduleIndex, dayIndex, enabled) =>
    dispatchAutoWakeup({ type: 'UPDATE_DAY', scheduleIndex, dayIndex, enabled });

  const saveSettings = useCallback(
    async (e, restart = false) => {
      if (e) e.preventDefault();
      if (submitting) return;
      setSubmitting(true);
      setSaveStatus(null); // Clear previous status

      try {
        const payload = new FormData();
        let pidHandled = false;

        Object.entries(formData).forEach(([key, value]) => {
          if (value == null) return;
          if (key === 'pid' || key === 'kf') {
            if (pidHandled) return;
            const p = formData.pid?.split(',').slice(0, 3).join(',') || '0,0,0';
            payload.append('pid', `${p},${formData.kf || '0.000'}`);
            pidHandled = true;
          } else if (key === 'steamPumpPercentage' && pressureAvailable.value) {
            payload.append(key, Math.round(parseFloat(value || 0) * 10));
          } else if (NUMERIC_FIELDS.includes(key)) {
            payload.append(key, parseFloat(value || 0));
          } else if (typeof value === 'boolean') {
            payload.append(key, value ? '1' : '0');
          } else {
            payload.append(key, value);
          }
        });

        const scheduleStr = autowakeupSchedules
          .map(s => `${s.time}|${s.days.map(d => (d ? '1' : '0')).join('')}`)
          .join(';');
        payload.append('autowakeupSchedules', scheduleStr);

        const res = await fetch(`/api/settings${restart ? '?restart=true' : ''}`, {
          method: 'POST',
          body: payload,
        });

        if (!res.ok) throw new Error('Save failed');

        // --- Success logic ---
        setSaveStatus('success');
        setTimeout(() => setSaveStatus(null), 3000); // Remove message after 3 seconds
      } catch (err) {
        console.error(err);
        // --- Error logic ---
        setSaveStatus('error');
        setTimeout(() => setSaveStatus(null), 5000);
      } finally {
        setSubmitting(false);
      }
    },
    [formData, autowakeupSchedules, submitting],
  );

  const onSubmit = (e, restart = false) => saveSettings(e, restart);

  const onExport = () => {
    const scheduleStr = autowakeupSchedules
      .map(s => `${s.time}|${s.days.map(d => (d ? '1' : '0')).join('')}`)
      .join(';');
    downloadJson({ ...formData, autowakeupSchedules: scheduleStr }, 'settings.json');
  };

  const onUpload = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const json = JSON.parse(ev.target.result);
        setFormData(transformAPItoForm(json));
        if (json.autowakeupSchedules) {
          dispatchAutoWakeup({ type: 'INIT', payload: parseSchedules(json.autowakeupSchedules) });
        }
      } catch (err) {
        console.error('Invalid JSON', err);
      }
    };
    reader.readAsText(file);
  };

  if (isLoading)
    return (
      <div className='flex w-full justify-center py-16'>
        <Spinner size={8} />
      </div>
    );

  return (
    <>
      {/* Header with Import and Export buttons */}
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
          tabIndex='0'
          onKeyDown={e =>
            (e.key === 'Enter' || e.key === ' ') &&
            document.getElementById('settingsImport').click()
          }
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
            <Field label='Default Steam Temperature' id='targetSteamTemp'>
              <Input
                id='targetSteamTemp'
                type='number'
                unit='°C'
                placeholder='135'
                value={formData.targetSteamTemp}
                onChange={onChange('targetSteamTemp')}
              />
            </Field>

            <Field label='Default Water Temperature' id='targetWaterTemp'>
              <Input
                id='targetWaterTemp'
                type='number'
                unit='°C'
                placeholder='80'
                value={formData.targetWaterTemp}
                onChange={onChange('targetWaterTemp')}
              />
            </Field>
          </Card>

          {/* User Preferences */}
          <Card sm={10} lg={5} title='User Preferences'>
            <Select
              label='Startup Mode'
              id='startupMode'
              value={formData.startupMode}
              onChange={onChange('startupMode')}
            >
              <option value='standby'>Standby</option>
              <option value='brew'>Brew</option>
            </Select>

            <Field label='Standby Timeout' id='standbyTimeout'>
              <Input
                id='standbyTimeout'
                type='number'
                unit='s'
                placeholder='0'
                value={formData.standbyTimeout}
                onChange={onChange('standbyTimeout')}
              />
            </Field>

            <div className='divider text-xs tracking-widest uppercase opacity-50'>
              Predictive Scale Delay
            </div>
            <p className='mb-4 text-sm opacity-70'>
              Shuts off ahead of time based on flow rate to account for dripping.
            </p>

            <Toggle
              label='Auto Adjust'
              id='delayAdjust'
              checked={!!formData.delayAdjust}
              onChange={onChange('delayAdjust')}
            />

            <div className='grid grid-cols-2 gap-4'>
              <Field label='Brew' id='brewDelay'>
                <Input
                  id='brewDelay'
                  type='number'
                  unit='ms'
                  value={formData.brewDelay}
                  onChange={onChange('brewDelay')}
                />
              </Field>
              <Field label='Grind' id='grindDelay'>
                <Input
                  id='grindDelay'
                  type='number'
                  unit='ms'
                  value={formData.grindDelay}
                  onChange={onChange('grindDelay')}
                />
              </Field>
            </div>

            <div className='divider text-xs tracking-widest uppercase opacity-50'>
              Switch Control
            </div>
            <Toggle
              label='Use momentary switches'
              id='momentaryButtons'
              checked={!!formData.momentaryButtons}
              onChange={onChange('momentaryButtons')}
            />
          </Card>

          {/* Web Settings */}
          <Card sm={10} lg={5} title='Web Settings'>
            <Select
              label='Theme'
              id='webui-theme'
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
            </Select>

            <Select
              label='Dashboard Layout'
              id='dashboardLayout'
              value={formData.dashboardLayout}
              onChange={onChange('dashboardLayout')}
            >
              <option value={DASHBOARD_LAYOUTS.ORDER_FIRST}>Process Controls First</option>
              <option value={DASHBOARD_LAYOUTS.ORDER_LAST}>Chart First</option>
            </Select>
          </Card>

          {/* System Preferences */}
          <Card sm={10} lg={5} title='System Preferences'>
            <Field label='Wi-Fi SSID' id='wifiSsid'>
              <input
                id='wifiSsid'
                type='text'
                className='input input-bordered w-full'
                placeholder='SSID'
                value={formData.wifiSsid}
                onChange={onChange('wifiSsid')}
              />
            </Field>

            <Field label='Wi-Fi Password' id='wifiPassword'>
              <div className='relative flex items-center'>
                <input
                  id='wifiPassword'
                  type={showPassword ? 'text' : 'password'}
                  className='input input-bordered w-full pr-12'
                  placeholder='Password'
                  value={formData.wifiPassword}
                  onChange={onChange('wifiPassword')}
                />
                <button
                  type='button'
                  className='absolute right-0 h-full px-4 opacity-50 hover:opacity-100'
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex='-1'
                >
                  <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                </button>
              </div>
            </Field>

            <Field label='Hostname' id='mdnsName'>
              <input
                id='mdnsName'
                type='text'
                className='input input-bordered w-full'
                value={formData.mdnsName}
                onChange={onChange('mdnsName')}
              />
            </Field>

            <Select
              label='Time Zone'
              id='timezone'
              value={formData.timezone || ''}
              onChange={onChange('timezone')}
            >
              {timezones.map(tz => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </Select>

            <div className='divider text-xs tracking-widest uppercase opacity-50'>Clock</div>
            <Toggle
              label='Use 24h Format'
              id='clock24hFormat'
              checked={!!formData.clock24hFormat}
              onChange={onChange('clock24hFormat')}
            />
          </Card>

          {/* Machine Settings */}
          <Card sm={10} lg={5} title='Machine Settings'>
            <Field label='PID Values' id='pid'>
              <Input
                id='pid'
                type='text'
                unit={
                  <span>
                    K<sub>p</sub>, K<sub>i</sub>, K<sub>d</sub>
                  </span>
                }
                value={formData.pid}
                onChange={onChange('pid')}
              />
            </Field>

            <Field
              label='Thermal Feedforward Gain'
              id='kf'
              helpText='Set to 0 to disable feedforward control.'
            >
              <Input
                id='kf'
                type='number'
                step='0.001'
                unit={
                  <span>
                    K<sub>f</sub>
                  </span>
                }
                value={formData.kf}
                onChange={onChange('kf')}
              />
            </Field>

            <Field
              label='Pump Flow Coefficients'
              id='pumpModelCoeffs'
              helpText='Enter 2 values (flow at 1 bar, flow at 9 bar)'
            >
              <input
                id='pumpModelCoeffs'
                type='text'
                className='input input-bordered w-full'
                placeholder='10.205,5.521'
                value={formData.pumpModelCoeffs}
                onChange={onChange('pumpModelCoeffs')}
              />
            </Field>

            <Field label='Temperature Offset (°C)' id='temperatureOffset'>
              <Input
                id='temperatureOffset'
                type='number'
                step='any'
                unit='°C'
                value={formData.temperatureOffset}
                onChange={onChange('temperatureOffset')}
              />
            </Field>

            {pressureAvailable.value && (
              <Field
                label='Pressure Sensor Rating'
                id='pressureScaling'
                helpText='Enter the bar rating'
              >
                <Input
                  id='pressureScaling'
                  type='number'
                  step='any'
                  unit='bar'
                  value={formData.pressureScaling}
                  onChange={onChange('pressureScaling')}
                />
              </Field>
            )}

            <Field
              label='Steam Pump Assist'
              id='steamPumpPercentage'
              helpText={
                pressureAvailable.value
                  ? 'Flow rate (ml/s) during steaming'
                  : 'Pump % during steaming'
              }
            >
              <Input
                id='steamPumpPercentage'
                type='number'
                step='0.1'
                unit={pressureAvailable.value ? 'ml/s' : '%'}
                value={formData.steamPumpPercentage}
                onChange={onChange('steamPumpPercentage')}
              />
            </Field>

            {pressureAvailable.value && (
              <Field
                label='Pump Assist Cutoff'
                id='steamPumpCutoff'
                helpText='Pressure at which assist stops.'
              >
                <Input
                  id='steamPumpCutoff'
                  type='number'
                  step='any'
                  unit='bar'
                  value={formData.steamPumpCutoff}
                  onChange={onChange('steamPumpCutoff')}
                />
              </Field>
            )}

            <Select
              label='Alt Relay / SSR2 Function'
              id='altRelayFunction'
              value={formData.altRelayFunction ?? 1}
              onChange={onChange('altRelayFunction')}
            >
              <option value={0}>None</option>
              <option value={1}>Grind</option>
              <option value={2} disabled>
                Steam Boiler (Soon)
              </option>
            </Select>
          </Card>

          {/* Display Settings */}
          <Card sm={10} lg={5} title='Display Settings'>
            <Field label='Main Brightness (1-16)' id='mainBrightness'>
              <input
                id='mainBrightness'
                type='number'
                min='1'
                max='16'
                className='input input-bordered w-full'
                value={formData.mainBrightness}
                onChange={onChange('mainBrightness')}
              />
            </Field>

            <div className='divider text-xs tracking-widest uppercase opacity-50'>
              Standby Display
            </div>
            <Toggle
              label='Enable standby display'
              id='standbyDisplayEnabled'
              checked={formData.standbyDisplayEnabled}
              onChange={onChange('standbyDisplayEnabled')}
            />

            <Field label='Standby Brightness (0-16)' id='standbyBrightness'>
              <input
                id='standbyBrightness'
                type='number'
                min='0'
                max='16'
                className='input input-bordered w-full'
                disabled={!formData.standbyDisplayEnabled}
                value={formData.standbyBrightness}
                onChange={onChange('standbyBrightness')}
              />
            </Field>

            <Field label='Standby Brightness Timeout (s)' id='standbyBrightnessTimeout'>
              <Input
                id='standbyBrightnessTimeout'
                type='number'
                min='1'
                unit='s'
                value={formData.standbyBrightnessTimeout}
                onChange={onChange('standbyBrightnessTimeout')}
              />
            </Field>

            <Select
              label='Theme'
              id='themeMode'
              value={formData.themeMode}
              onChange={onChange('themeMode')}
            >
              <option value={0}>Dark Theme</option>
              <option value={1}>Light Theme</option>
            </Select>
          </Card>

          {/* Sunrise Settings */}
          {ledControl.value && (
            <Card sm={10} lg={5} title='Sunrise Settings'>
              <p className='mb-4 text-sm opacity-70'>Color settings for idle LEDs.</p>
              <div className='mb-4 grid grid-cols-2 gap-4'>
                <Field label='Red' id='sunriseR'>
                  <input
                    id='sunriseR'
                    type='number'
                    className='input input-bordered w-full'
                    value={formData.sunriseR}
                    onChange={onChange('sunriseR')}
                  />
                </Field>
                <Field label='Green' id='sunriseG'>
                  <input
                    id='sunriseG'
                    type='number'
                    className='input input-bordered w-full'
                    value={formData.sunriseG}
                    onChange={onChange('sunriseG')}
                  />
                </Field>
                <Field label='Blue' id='sunriseB'>
                  <input
                    id='sunriseB'
                    type='number'
                    className='input input-bordered w-full'
                    value={formData.sunriseB}
                    onChange={onChange('sunriseB')}
                  />
                </Field>
                <Field label='White' id='sunriseW'>
                  <input
                    id='sunriseW'
                    type='number'
                    className='input input-bordered w-full'
                    value={formData.sunriseW}
                    onChange={onChange('sunriseW')}
                  />
                </Field>
              </div>

              <Field label='External LED (0 - 255)' id='sunriseExtBrightness'>
                <input
                  id='sunriseExtBrightness'
                  type='number'
                  className='input input-bordered w-full'
                  value={formData.sunriseExtBrightness}
                  onChange={onChange('sunriseExtBrightness')}
                />
              </Field>

              <Field label='Distance to bottom (mm)' id='emptyTankDistance'>
                <Input
                  id='emptyTankDistance'
                  type='number'
                  unit='mm'
                  value={formData.emptyTankDistance}
                  onChange={onChange('emptyTankDistance')}
                />
              </Field>

              <Field label='Distance to fill line (mm)' id='fullTankDistance'>
                <Input
                  id='fullTankDistance'
                  type='number'
                  unit='mm'
                  value={formData.fullTankDistance}
                  onChange={onChange('fullTankDistance')}
                />
              </Field>
            </Card>
          )}

          {/* Plugins */}
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

        {/* Form Footer */}
        <div className='pt-4 lg:col-span-10'>
          <div className='alert alert-warning mb-4 text-sm shadow-sm'>
            <span>Some options like Wi-Fi and NTP require a restart.</span>
          </div>

          <div className='flex flex-col gap-2 sm:flex-row'>
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

            {/* In-line Status Message */}
            {saveStatus === 'success' && (
              <span className='text-success flex animate-pulse items-center px-2 text-sm font-bold'>
                ✓ Saved!
              </span>
            )}
            {saveStatus === 'error' && (
              <span className='text-error flex items-center px-2 text-sm font-bold'>
                ✕ Error Saving
              </span>
            )}

            <button
              type='button'
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
