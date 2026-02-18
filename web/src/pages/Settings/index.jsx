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

const ledControl = computed(() => machine.value?.capabilities?.ledControl ?? false);
const pressureAvailable = computed(() => machine.value?.capabilities?.pressure ?? false);

/**
 * Converts raw API response into UI-friendly state.
 * Ensures all values are strings for controlled inputs.
 */
const normalizeSettings = data => {
  if (!data) return {};
  const transformed = { ...data };

  // Handle PID + Kf Merging
  if (data.pid) {
    const parts = data.pid.split(',');
    transformed.pid = parts.slice(0, 3).join(',');
    transformed.kf = parts[3] || '0.000';
  }

  // Steam Pump Math (Integer API -> Decimal UI)
  if (pressureAvailable.value && data.steamPumpPercentage != null) {
    transformed.steamPumpPercentage = (data.steamPumpPercentage / 10).toString();
  }

  // Ensure all numeric fields are strings for the input elements
  NUMERIC_FIELDS.forEach(field => {
    if (transformed[field] !== undefined && transformed[field] !== null) {
      transformed[field] = transformed[field].toString();
    }
  });

  // Ensure text fields are strings
  ['wifiSsid', 'wifiPassword', 'mdnsName', 'pumpModelCoeffs', 'startupMode', 'timezone'].forEach(
    field => {
      if (transformed[field] === undefined || transformed[field] === null) {
        transformed[field] = '';
      }
    },
  );

  return transformed;
};

/** REUSABLE FORM COMPONENTS */

// Base wrapper for every form row
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

// Standard input with optional unit suffix
const Input = ({ id, unit, unitLabel, className = '', ...props }) => (
  <div className='input-group'>
    <label
      htmlFor={id}
      className={`input input-bordered flex w-full items-center gap-2 ${className}`}
    >
      <input id={id} className='grow' {...props} />
      {unit && (
        <span
          className='text-sm whitespace-nowrap opacity-50'
          aria-label={unitLabel || (typeof unit === 'string' ? unit : undefined)}
        >
          {unit}
        </span>
      )}
    </label>
  </div>
);

// Toggle switch wrapper
const Toggle = ({ label, id, checked, onChange }) => (
  <div className='form-control mb-4'>
    <label className='label cursor-pointer p-0'>
      <span className='label-text text-sm font-medium'>{label}</span>
      <input
        id={id}
        type='checkbox'
        className='toggle toggle-primary'
        checked={!!checked}
        onChange={onChange}
      />
    </label>
  </div>
);

// Select dropdown wrapper
const Select = ({ label, id, children, ...props }) => (
  <Field label={label} id={id}>
    <select id={id} className='select select-bordered w-full' {...props}>
      {children}
    </select>
  </Field>
);

/**
 * Converts the custom schedule string into a Reducer-friendly array
 */
const parseSchedules = scheduleStr => {
  if (typeof scheduleStr !== 'string' || !scheduleStr.trim()) {
    return [DEFAULT_WAKEUP_SCHEDULE];
  }
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

const DEFAULT_WAKEUP_SCHEDULE = {
  time: '07:30',
  days: Array(7).fill(true),
};

/**
 * @typedef {Object} Action
 * @property {'INIT'|'ADD'|'REMOVE'|'UPDATE_TIME'|'UPDATE_DAY'} type
 * @property {AutoWakeupSchedule[]} [payload] - Only for INIT
 * @property {number} [index] - For REMOVE and UPDATE_TIME
 * @property {string} [time] - For UPDATE_TIME
 * @property {number} [scheduleIndex] - For UPDATE_DAY
 * @property {number} [dayIndex] - For UPDATE_DAY
 * @property {boolean} [enabled] - For UPDATE_DAY
 */

/**
 * Reducer for managing auto-wakeup schedules.
 * @param {AutoWakeupSchedule[]} state
 * @param {Action} action
 */
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
          ? {
              ...s,
              days: s.days.map((d, di) => (di === action.dayIndex ? action.enabled : d)),
            }
          : s,
      );
    default:
      return state;
  }
}

/**
 * Handlers for fields that require special state updates.
 */
const SPECIAL_HANDLERS = {
  dashboardLayout: (setFormData, value) => {
    setDashboardLayout(value);
    // Use the functional updater to ensure we are merging with the latest state
    setFormData(prev => ({ ...prev, dashboardLayout: value }));
  },
};

export function Settings() {
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({});
  const [currentTheme, setCurrentTheme] = useState('light');
  const [showPassword, setShowPassword] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null); // For user feedback
  const [autowakeupSchedules, dispatchAutoWakeup] = useReducer(autoWakeupReducer, [
    DEFAULT_WAKEUP_SCHEDULE,
  ]);

  const { isLoading, data: fetchedSettings } = useQuery('settings', async () => {
    const response = await fetch('/api/settings');
    const data = await response.json();
    return data;
  });

  const formRef = useRef();

  useEffect(() => {
    if (fetchedSettings) {
      // Set the main form state
      setFormData(normalizeSettings(fetchedSettings));
      // Initialize the reducer
      const schedules = parseSchedules(fetchedSettings.autowakeupSchedules);
      dispatchAutoWakeup({ type: 'INIT', payload: schedules });
    } else {
      setFormData({});
      dispatchAutoWakeup({ type: 'INIT' });
    }
  }, [fetchedSettings]);

  // Initialize theme
  useEffect(() => {
    setCurrentTheme(getStoredTheme());
  }, []);

  /**
   * Returns an onChange handler for a given form field.
   */
  const onChange = key => e => {
    const target = e.currentTarget;
    const value = target.type === 'checkbox' ? target.checked : target.value;

    setFormData(prev => {
      const newState = { ...prev, [key]: value };

      // Handle PID logic inside the functional update
      if (key === 'pid' && typeof value === 'string') {
        // Sanitize input by allowing only numbers, commas, and dots
        const sanitized = value.replace(/[^0-9.,-]/g, '');
        newState.pid = sanitized;

        if (sanitized.includes(',')) {
          const parts = sanitized.split(',');
          if (parts.length > 3) {
            newState.pid = parts.slice(0, 3).join(',');
            newState.kf = parts[3];
          }
        }
      }
      return newState;
    });

    // Pass setFormData
    if (SPECIAL_HANDLERS[key]) {
      SPECIAL_HANDLERS[key](setFormData, value);
    }
  };

  const addAutoWakeupSchedule = () => dispatchAutoWakeup({ type: 'ADD' });
  const removeAutoWakeupSchedule = index => dispatchAutoWakeup({ type: 'REMOVE', index });
  const updateAutoWakeupTime = (index, time) =>
    dispatchAutoWakeup({ type: 'UPDATE_TIME', index, time });
  const updateAutoWakeupDay = (scheduleIndex, dayIndex, enabled) =>
    dispatchAutoWakeup({
      type: 'UPDATE_DAY',
      scheduleIndex,
      dayIndex,
      enabled,
    });

  const onSubmit = useCallback(
    async (e, restart = false) => {
      if (e) e.preventDefault();
      if (submitting) return;

      setSubmitting(true);
      setSaveMessage(null);

      try {
        const payload = new FormData();
        let pidProcessed = false;

        Object.entries(formData).forEach(([key, value]) => {
          if (value === undefined || value === null) return;

          // Handle PID + Kf Merging
          if (key === 'pid' || key === 'kf') {
            if (pidProcessed) return;
            const p = formData.pid?.split(',').slice(0, 3).join(',') || '0,0,0';
            const k = formData.kf || '0.000';
            payload.append('pid', `${p},${k}`);
            pidProcessed = true;
            return;
          }

          // Steam Pump Math (Decimal UI -> Integer API)
          if (key === 'steamPumpPercentage' && pressureAvailable.value) {
            const rawNum = parseFloat(value);
            payload.append(key, isNaN(rawNum) ? 0 : Math.round(rawNum * 10));
            return;
          }

          // Numeric Field Casting
          if (NUMERIC_FIELDS.includes(key)) {
            const numValue = parseFloat(value);
            payload.append(key, isNaN(numValue) ? 0 : numValue);
            return;
          }

          // Boolean to Integer
          if (typeof value === 'boolean') {
            payload.append(key, value ? '1' : '0');
            return;
          }

          payload.append(key, value);
        });

        // Build Wakeup Schedule String
        const scheduleString = autowakeupSchedules
          .map(s => {
            const dayBits = s.days.map(d => (d ? '1' : '0')).join('');
            return `${s.time}|${dayBits}`;
          })
          .join(';');
        payload.append('autowakeupSchedules', scheduleString);

        const response = await fetch('/api/settings' + (restart ? '?restart=true' : ''), {
          method: 'POST',
          body: payload,
        });

        if (!response.ok) {
          throw new Error(`Server responded with status ${response.status}`);
        }

        setSaveMessage({
          type: 'success',
          text: restart ? 'Saved! Restarting...' : 'Settings saved successfully!',
        });

        // Clear success message after 3 seconds
        setTimeout(() => setSaveMessage(null), 3000);
      } catch (err) {
        console.error('Save failed', err);
        setSaveMessage({ type: 'error', text: `Failed to save settings: ${err.message}` });
      } finally {
        setSubmitting(false);
      }
    },
    [formData, autowakeupSchedules, submitting],
  );

  const onExport = useCallback(() => {
    const scheduleString = autowakeupSchedules
      .map(s => `${s.time}|${s.days.map(d => (d ? '1' : '0')).join('')}`)
      .join(';');

    // Create a combined object for the export
    const exportData = {
      ...formData,
      autowakeupSchedules: scheduleString,
    };

    // Download the merged data
    downloadJson(exportData, 'settings.json');
  }, [formData, autowakeupSchedules]);

  const onUpload = function (evt) {
    if (evt.target.files.length) {
      const file = evt.target.files[0];
      const reader = new FileReader();
      reader.onload = async e => {
        try {
          const data = JSON.parse(e.target.result);
          // Update the main form state
          setFormData(normalizeSettings(data));
          // Sync the Auto-Wakeup Reducer
          const schedules = parseSchedules(data.autowakeupSchedules);
          dispatchAutoWakeup({ type: 'INIT', payload: schedules });
          setSaveMessage({ type: 'success', text: 'Settings imported successfully!' });
          setTimeout(() => setSaveMessage(null), 3000);
        } catch (err) {
          console.error('Failed to parse imported settings', err);
          setSaveMessage({
            type: 'error',
            text: 'Failed to import settings. Invalid file format.',
          });
        }
      };
      reader.readAsText(file);
    }
    // Reset input so same file can be uploaded again
    evt.target.value = '';
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
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              document.getElementById('settingsImport').click();
            }
          }}
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

      {/* Save message feedback */}
      {saveMessage && (
        <div
          className={`alert mb-4 ${saveMessage.type === 'success' ? 'alert-success' : 'alert-error'}`}
        >
          <span>{saveMessage.text}</span>
        </div>
      )}

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
                value={formData.targetSteamTemp || ''}
                onChange={onChange('targetSteamTemp')}
              />
            </Field>
            <Field label='Default Water Temperature' id='targetWaterTemp'>
              <Input
                id='targetWaterTemp'
                type='number'
                unit='°C'
                placeholder='80'
                value={formData.targetWaterTemp || ''}
                onChange={onChange('targetWaterTemp')}
              />
            </Field>
          </Card>

          {/* User Preferences */}
          <Card sm={10} lg={5} title='User Preferences'>
            <Select
              label='Startup Mode'
              id='startupMode'
              value={formData.startupMode || 'standby'}
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
                value={formData.standbyTimeout || ''}
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
              checked={formData.delayAdjust}
              onChange={onChange('delayAdjust')}
            />
            <div className='grid grid-cols-2 gap-4'>
              <Field label='Brew' id='brewDelay'>
                <Input
                  id='brewDelay'
                  type='number'
                  unit='ms'
                  value={formData.brewDelay || ''}
                  onChange={onChange('brewDelay')}
                />
              </Field>
              <Field label='Grind' id='grindDelay'>
                <Input
                  id='grindDelay'
                  type='number'
                  unit='ms'
                  value={formData.grindDelay || ''}
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
              checked={formData.momentaryButtons}
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
              value={formData.dashboardLayout || DASHBOARD_LAYOUTS.ORDER_FIRST}
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
                value={formData.wifiSsid || ''}
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
                  value={formData.wifiPassword || ''}
                  onChange={onChange('wifiPassword')}
                />
                <button
                  type='button'
                  className='absolute right-0 h-full px-4 opacity-50 hover:opacity-100'
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex='-1'
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
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
                value={formData.mdnsName || ''}
                onChange={onChange('mdnsName')}
              />
            </Field>
            <Select
              label='Time Zone'
              id='timezone'
              value={formData.timezone || ''}
              onChange={onChange('timezone')}
            >
              <option value=''>Select timezone...</option>
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
              checked={formData.clock24hFormat}
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
                value={formData.pid || ''}
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
                value={formData.kf || ''}
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
                value={formData.pumpModelCoeffs || ''}
                onChange={onChange('pumpModelCoeffs')}
              />
            </Field>
            <Field label='Temperature Offset (°C)' id='temperatureOffset'>
              <Input
                id='temperatureOffset'
                type='number'
                step='1'
                inputmode='decimal'
                unit='°C'
                value={formData.temperatureOffset || ''}
                onChange={onChange('temperatureOffset')}
              />
            </Field>
            {pressureAvailable.value && (
              <Field
                label='Pressure Sensor Rating'
                id='pressureScaling'
                helpText='Enter the bar rating of the sensor'
              >
                <Input
                  id='pressureScaling'
                  type='number'
                  step='any'
                  unit='bar'
                  value={formData.pressureScaling || ''}
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
                inputmode='decimal'
                unit={pressureAvailable.value ? 'ml/s' : '%'}
                value={formData.steamPumpPercentage || ''}
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
                  value={formData.steamPumpCutoff || ''}
                  onChange={onChange('steamPumpCutoff')}
                />
              </Field>
            )}
            <Select
              label='Alt Relay / SSR2 Function'
              id='altRelayFunction'
              value={formData.altRelayFunction ?? '1'}
              onChange={onChange('altRelayFunction')}
            >
              <option value='0'>None</option>
              <option value='1'>Grind</option>
              <option value='2' disabled>
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
                value={formData.mainBrightness || ''}
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
                value={formData.standbyBrightness || ''}
                onChange={onChange('standbyBrightness')}
              />
            </Field>
            <Field label='Standby Brightness Timeout (s)' id='standbyBrightnessTimeout'>
              <Input
                id='standbyBrightnessTimeout'
                type='number'
                min='1'
                unit='s'
                value={formData.standbyBrightnessTimeout || ''}
                onChange={onChange('standbyBrightnessTimeout')}
              />
            </Field>
            <Select
              label='Theme'
              id='themeMode'
              value={formData.themeMode || '0'}
              onChange={onChange('themeMode')}
            >
              <option value='0'>Dark Theme</option>
              <option value='1'>Light Theme</option>
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
                    value={formData.sunriseR || ''}
                    onChange={onChange('sunriseR')}
                  />
                </Field>
                <Field label='Green' id='sunriseG'>
                  <input
                    id='sunriseG'
                    type='number'
                    className='input input-bordered w-full'
                    value={formData.sunriseG || ''}
                    onChange={onChange('sunriseG')}
                  />
                </Field>
                <Field label='Blue' id='sunriseB'>
                  <input
                    id='sunriseB'
                    type='number'
                    className='input input-bordered w-full'
                    value={formData.sunriseB || ''}
                    onChange={onChange('sunriseB')}
                  />
                </Field>
                <Field label='White' id='sunriseW'>
                  <input
                    id='sunriseW'
                    type='number'
                    className='input input-bordered w-full'
                    value={formData.sunriseW || ''}
                    onChange={onChange('sunriseW')}
                  />
                </Field>
              </div>
              <Field label='External LED (0 - 255)' id='sunriseExtBrightness'>
                <input
                  id='sunriseExtBrightness'
                  type='number'
                  min='0'
                  max='255'
                  className='input input-bordered w-full'
                  value={formData.sunriseExtBrightness || ''}
                  onChange={onChange('sunriseExtBrightness')}
                />
              </Field>
              <Field label='Distance to bottom (mm)' id='emptyTankDistance'>
                <Input
                  id='emptyTankDistance'
                  type='number'
                  unit='mm'
                  value={formData.emptyTankDistance || ''}
                  onChange={onChange('emptyTankDistance')}
                />
              </Field>
              <Field label='Distance to fill line (mm)' id='fullTankDistance'>
                <Input
                  id='fullTankDistance'
                  type='number'
                  unit='mm'
                  value={formData.fullTankDistance || ''}
                  onChange={onChange('fullTankDistance')}
                />
              </Field>
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

        {/* Form Footer */}
        <div className='pt-4 lg:col-span-10'>
          <div className='alert alert-warning mb-4 shadow-sm'>
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
