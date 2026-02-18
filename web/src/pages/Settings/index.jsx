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

// Default schedule used when no valid schedules are found in settings
const DEFAULT_WAKEUP_SCHEDULE = {
  time: '07:30',
  days: Array(7).fill(true),
};

// List of fields that should be treated as numeric for validation and parsing purposes
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
  'steamPumpPercentage',
];

// Fields that require special handling and should be excluded from the generic onChange handler logic
const EXCLUDED_FIELDS = ['dashboardLayout'];

// Derived capabilities from machine data to conditionally render certain settings sections
const ledControl = computed(() => machine.value?.capabilities?.ledControl ?? false);

// Pressure sensor availability affects whether we show steam pump assist as a flow rate or percentage
const pressureAvailable = computed(() => machine.value?.capabilities?.pressure ?? false);

/** REUSABLE FORM COMPONENTS */

// Wrapper for form fields to provide consistent spacing, labels, and help text
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

// Input component that can optionally display a unit next to the input field, with proper accessibility attributes for the unit
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

// Toggle component styled as a switch, with proper label association and accessibility attributes
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

// Select component wrapped in a Field for consistent styling, with proper label association and accessibility attributes
const Select = ({ label, id, children, ...props }) => (
  <Field label={label} id={id}>
    <select id={id} className='select select-bordered w-full' {...props}>
      {children}
    </select>
  </Field>
);

// Function to normalize and transform fetched settings data into the format expected by the form,
// including handling of combined fields like PID and conversion of numeric values to strings for controlled inputs
const normalizeSettings = data => {
  if (!data) return {};
  const transformed = { ...data };

  if (data.pid) {
    const parts = data.pid.split(',');
    transformed.pid = parts.slice(0, 3).join(',');
    transformed.kf = parts[3] || '0.000';
  }

  if (pressureAvailable.value && data.steamPumpPercentage != null) {
    transformed.steamPumpPercentage = (data.steamPumpPercentage / 10).toString();
  }

  NUMERIC_FIELDS.forEach(field => {
    if (transformed[field] !== undefined && transformed[field] !== null) {
      transformed[field] = transformed[field].toString();
    }
  });

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

// Function to parse the autowakeupSchedules string from the settings into an array of schedule objects with time and days,
// including validation and fallback to a default schedule if parsing fails
const parseSchedules = scheduleStr => {
  if (typeof scheduleStr !== 'string' || !scheduleStr.trim()) {
    return [{ ...DEFAULT_WAKEUP_SCHEDULE, id: crypto.randomUUID() }];
  }
  const parsed = scheduleStr
    .split(';')
    .map(str => {
      const [time, daysStr] = str.split('|');
      if (time && daysStr?.length === 7) {
        return {
          id: crypto.randomUUID(), // Generate a unique ID for each schedule for stable React rendering
          time,
          days: daysStr.split('').map(d => d === '1'),
        };
      }
      return null;
    })
    .filter(Boolean);
  return parsed.length > 0 ? parsed : [{ ...DEFAULT_WAKEUP_SCHEDULE, id: crypto.randomUUID() }];
};

// Reducer function to manage the state of automatic wakeup schedules,
// handling initialization, addition, removal, and updates to time and days based on dispatched actions
function autoWakeupReducer(state, action) {
  switch (action.type) {
    case 'INIT':
      return action.payload?.length
        ? action.payload
        : [{ ...DEFAULT_WAKEUP_SCHEDULE, id: crypto.randomUUID() }];
    case 'ADD':
      // Deep copy days array to avoid shared references
      return [
        ...state,
        {
          ...DEFAULT_WAKEUP_SCHEDULE,
          days: [...DEFAULT_WAKEUP_SCHEDULE.days],
          id: crypto.randomUUID(),
        },
      ];
    case 'REMOVE':
      // Filter by ID for stability, but prevent removing the last schedule to ensure there's always at least one
      return state.length > 1 ? state.filter(s => s.id !== action.id) : state;
    case 'UPDATE_TIME':
      return state.map(s => (s.id === action.id ? { ...s, time: action.time } : s));
    case 'UPDATE_DAY':
      return state.map(s =>
        s.id === action.id
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

// Special handlers for fields that require more complex state updates or side effects when changed,
// such as updating the dashboard layout immediately upon change
const SPECIAL_HANDLERS = {
  dashboardLayout: (setFormData, value, newState) => {
    setDashboardLayout(value);
  },
};

// Main Settings component that manages the overall state of the settings form, handles fetching and saving settings,
// and renders the form with all the different sections and fields, including the PluginCard for plugin integrations
export function Settings() {
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({});
  const [currentTheme, setCurrentTheme] = useState('light');
  const [showPassword, setShowPassword] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [autowakeupSchedules, dispatchAutoWakeup] = useReducer(autoWakeupReducer, []);
  const addAutoWakeupSchedule = () => dispatchAutoWakeup({ type: 'ADD' });
  const removeAutoWakeupSchedule = id => dispatchAutoWakeup({ type: 'REMOVE', id });
  const updateAutoWakeupTime = (id, time) => dispatchAutoWakeup({ type: 'UPDATE_TIME', id, time });
  const updateAutoWakeupDay = (id, dayIndex, enabled) =>
    dispatchAutoWakeup({
      type: 'UPDATE_DAY',
      id,
      dayIndex,
      enabled,
    });
  const saveMessageTimeoutRef = useRef(null);
  const formRef = useRef();

  // Fetch settings from the API when the component mounts, and handle loading state and errors
  const { isLoading, data: fetchedSettings } = useQuery('settings', async () => {
    const response = await fetch('/api/settings');
    if (!response.ok) throw new Error('Failed to fetch');
    return await response.json();
  });

  // When fetched settings change, normalize them and update the form state, and also parse the autowakeup schedules and initialize the reducer state
  useEffect(() => {
    if (fetchedSettings) {
      setFormData(normalizeSettings(fetchedSettings));
      const schedules = parseSchedules(fetchedSettings.autowakeupSchedules);
      dispatchAutoWakeup({ type: 'INIT', payload: schedules });
    } else {
      // If no settings are fetched, reset to defaults
      setFormData({});
      dispatchAutoWakeup({ type: 'INIT' });
    }
  }, [fetchedSettings]);

  // Initialize the current theme from localStorage when the component mounts,
  // and set up a cleanup function to clear any pending save message timeouts when the component unmounts
  useEffect(() => {
    setCurrentTheme(getStoredTheme());
    return () => {
      if (saveMessageTimeoutRef.current) clearTimeout(saveMessageTimeoutRef.current);
    };
  }, []);

  // onChange handler for form fields that updates the formData state, with special handling for certain fields like PID and steam pump percentage,
  // and also invokes any special handlers defined for specific fields to handle side effects or additional state updates
  const onChange = key => e => {
    const target = e.currentTarget;
    const value = target.type === 'checkbox' ? target.checked : target.value;

    setFormData(prev => {
      const newState = { ...prev, [key]: value };

      if (key === 'pid' && typeof value === 'string') {
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

      // Special handling for steamPumpPercentage to convert from percentage to raw value for firmware compatibility when the field changes in the form
      if (SPECIAL_HANDLERS[key]) {
        SPECIAL_HANDLERS[key](setFormData, value, newState);
      }

      return newState;
    });
  };

  // onSubmit handler for the form that prepares the payload for saving settings,
  // including handling of special fields and conversion to the format expected by the firmware
  const onSubmit = useCallback(
    async (e, restart = false) => {
      if (e) e.preventDefault();
      if (submitting) return;

      setSubmitting(true);
      if (saveMessageTimeoutRef.current) clearTimeout(saveMessageTimeoutRef.current);
      setSaveMessage(null);

      try {
        const payload = new FormData();

        // Prepare complex fields that require combining multiple form values into the format expected by the firmware
        const pidString = `${formData.pid || '0,0,0'},${formData.kf || '0.000'}`;
        const scheduleString = autowakeupSchedules
          .map(s => `${s.time}|${s.days.map(d => (d ? '1' : '0')).join('')}`)
          .join(';');

        // Define keys to skip during the generic payload construction, as they are handled separately or require special formatting
        const SKIPPED_KEYS = [...EXCLUDED_FIELDS, 'pid', 'kf'];

        Object.entries(formData).forEach(([key, value]) => {
          if (SKIPPED_KEYS.includes(key) || value === undefined || value === null) return;

          // Special handling for steamPumpPercentage to convert from percentage to raw value for firmware compatibility when preparing the payload for saving
          if (key === 'steamPumpPercentage') {
            const rawNum = parseFloat(value);
            payload.append(key, isNaN(rawNum) ? 0 : Math.round(rawNum * 10));
            return;
          }

          // Convert numeric fields to actual numbers for firmware compatibility when preparing the payload for saving
          if (NUMERIC_FIELDS.includes(key)) {
            const numValue = parseFloat(value);
            payload.append(key, isNaN(numValue) ? 0 : numValue);
            return;
          }

          // Convert boolean values to '1' or '0' strings for firmware compatibility when preparing the payload for saving
          if (typeof value === 'boolean') {
            payload.append(key, value ? '1' : '0');
            return;
          }

          payload.append(key, value);
        });

        // Append the combined PID string and the schedule string to the payload, as they require special formatting for the firmware
        payload.append('pid', pidString);
        payload.append('autowakeupSchedules', scheduleString);

        const response = await fetch('/api/settings' + (restart ? '?restart=true' : ''), {
          method: 'POST',
          body: payload,
        });

        if (!response.ok) throw new Error(`Server status ${response.status}`);

        setSaveMessage({
          type: 'success',
          text: restart ? 'Saved! Restarting...' : 'Settings saved successfully!',
        });

        saveMessageTimeoutRef.current = setTimeout(() => setSaveMessage(null), 3000);
      } catch (err) {
        setSaveMessage({ type: 'error', text: `Failed to save: ${err.message}` });
      } finally {
        setSubmitting(false);
      }
    },
    [formData, autowakeupSchedules, submitting],
  );

  // Handler for exporting settings to a JSON file, which prepares the data in the correct format expected by the firmware
  const onExport = useCallback(() => {
    // Prepare the autowakeupSchedules in the format expected by the firmware for export
    const scheduleString = autowakeupSchedules
      .map(s => `${s.time}|${s.days.map(d => (d ? '1' : '0')).join('')}`)
      .join(';');

    // Extract the PID and Kf values from formData to merge them back into the firmware format for export, while keeping the rest of the data intact
    const { kf, ...baseData } = formData;

    // Merge the PID and Kf values back into the firmware format for export, and include the autowakeupSchedules in the correct format as well
    const finalExport = {
      ...baseData,
      pid: `${formData.pid},${kf || '0.000'}`, // Merge them back into the firmware format
      autowakeupSchedules: scheduleString,
    };

    // Use the utility function to trigger a download of the settings as a JSON file, with the filename 'settings.json'
    downloadJson(finalExport, 'settings.json');
  }, [formData, autowakeupSchedules]);

  // Handler for importing settings from a JSON file, which reads the file, parses the JSON, normalizes it for the form, and updates the state accordingly
  const onUpload = function (evt) {
    if (evt.target.files.length) {
      const file = evt.target.files[0];
      const reader = new FileReader();
      reader.onload = async e => {
        try {
          const data = JSON.parse(e.target.result);
          setFormData(normalizeSettings(data));
          const schedules = parseSchedules(data.autowakeupSchedules);
          dispatchAutoWakeup({ type: 'INIT', payload: schedules });

          if (saveMessageTimeoutRef.current) clearTimeout(saveMessageTimeoutRef.current);
          setSaveMessage({ type: 'success', text: 'Settings imported successfully!' });
          saveMessageTimeoutRef.current = setTimeout(() => setSaveMessage(null), 3000);
        } catch (err) {
          setSaveMessage({
            type: 'error',
            text: 'Failed to import settings. Invalid file format.',
          });
        }
      };
      reader.readAsText(file);
    }
    evt.target.value = '';
  };

  return (
    <>
      {/* Header with title and import/export buttons, including proper labels and accessibility */}
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

      {/* Display a success or error message after saving settings, with appropriate styling based on the message type */}
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

          {/* Web UI Settings */}
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

          {/* Sunrise LED Settings - only show if the machine has LED control capability */}
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

        {/* Action buttons for saving settings, with options to save normally or save and restart the machine,
        and a warning about certain settings requiring a restart, all styled appropriately and with proper disabled states during submission */}
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
