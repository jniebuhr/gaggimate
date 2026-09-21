import { faFileExport } from '@fortawesome/free-solid-svg-icons/faFileExport';
import { faFileImport } from '@fortawesome/free-solid-svg-icons/faFileImport';
import { faEllipsisVertical } from '@fortawesome/free-solid-svg-icons/faEllipsisVertical';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useCallback, useEffect, useRef, useState, useContext } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import {
  ApiServiceContext,
  machine,
  prefetchSettings,
  updateSettingsCache,
  getCachedSettings,
} from '../../services/ApiService.js';
import {
  DASHBOARD_LAYOUTS,
  setDashboardLayout,
  setClock24h,
} from '../../utils/dashboardManager.js';
import { downloadJson } from '../../utils/download.js';
import { getStoredTheme, handleThemeChange } from '../../utils/themeManager.js';

import PageLayout from '../../components/PageLayout.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import TabBar from '../../components/TabBar.jsx';

import lazy from 'preact-iso/lazy';

import { StickyFormFooter } from './StickyFormFooter.jsx';
import {
  GeneralTabSkeleton,
  MachineTabSkeleton,
  PluginsTabSkeleton,
  BluetoothTabSkeleton,
  SystemTabSkeleton,
} from '../../components/skeletons/SettingsSkeletons.jsx';
import { GeneralTab } from './tabs/GeneralTab.jsx';

const LazyMachineTab = lazy(() => import('./tabs/MachineTab.jsx').then(m => m.MachineTab));
const LazyCalibrationTab = lazy(() =>
  import('./tabs/CalibrationTab.jsx').then(m => m.CalibrationTab),
);
const LazyPluginsTab = lazy(() => import('./tabs/PluginsTab.jsx').then(m => m.PluginsTab));
const LazyBluetoothTab = lazy(() => import('./tabs/BluetoothTab.jsx').then(m => m.BluetoothTab));
const LazySystemTab = lazy(() => import('./tabs/SystemTab.jsx').then(m => m.SystemTab));

const loadMachineTab = () => import('./tabs/MachineTab.jsx');
const loadCalibrationTab = () => import('./tabs/CalibrationTab.jsx');
const loadPluginsTab = () => import('./tabs/PluginsTab.jsx');
const loadBluetoothTab = () => import('./tabs/BluetoothTab.jsx');
const loadSystemTab = () => import('./tabs/SystemTab.jsx');

// Icons
import { faSliders } from '@fortawesome/free-solid-svg-icons/faSliders';
import { faTemperatureHalf } from '@fortawesome/free-solid-svg-icons/faTemperatureHalf';
import { faCrosshairs } from '@fortawesome/free-solid-svg-icons/faCrosshairs';
import { faPuzzlePiece } from '@fortawesome/free-solid-svg-icons/faPuzzlePiece';
import { faBluetoothB } from '@fortawesome/free-brands-svg-icons/faBluetoothB';
import { faRotate } from '@fortawesome/free-solid-svg-icons/faRotate';

const CHECKBOX_KEYS = [
  'homekit',
  'boilerFillActive',
  'smartGrindActive',
  'homeAssistant',
  'momentaryButtons',
  'delayAdjust',
  'clock24hFormat',
  'autowakeupEnabled',
  'smartGrindToggle',
  'temperaturePredictorEnabled',
];

// Form-only fields that never come back from GET /api/settings.
const FORM_ONLY_KEYS = [
  'kf',
  'button0',
  'button1',
  'button2',
  'standbyDisplayEnabled',
  'dashboardLayout',
];

function splitPidString(pidString) {
  if (!pidString) return { pid: pidString ?? '', kf: '' };
  const parts = pidString.split(',').map(part => part.trim());
  const pid = parts.slice(0, 3).join(',');
  const kf = parts.length >= 4 && parts[3] !== '' ? parts[3] : '';
  return { pid, kf };
}

function splitButtons(buttonBehavior) {
  if (!buttonBehavior) return {};
  const [button0, button1, button2] = buttonBehavior.split(',');
  return { button0, button1, button2 };
}

function parseAutoWakeupSchedules(autowakeupSchedules) {
  const defaultSchedule = [{ time: '07:00', days: [true, true, true, true, true, true, true] }];
  if (!autowakeupSchedules) {
    return defaultSchedule;
  }
  const schedules = [];
  if (typeof autowakeupSchedules === 'string' && autowakeupSchedules.trim()) {
    const scheduleStrings = autowakeupSchedules.split(';');
    for (const scheduleStr of scheduleStrings) {
      const [time, daysStr] = scheduleStr.split('|');
      if (time && daysStr && daysStr.length === 7) {
        const days = daysStr.split('').map(d => d === '1');
        schedules.push({ time, days });
      }
    }
  }
  return schedules.length > 0 ? schedules : defaultSchedule;
}

function transformFetchedSettings(fetchedSettings) {
  if (!fetchedSettings) return {};
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

  if (fetchedSettings.pid) {
    const split = splitPidString(fetchedSettings.pid);
    settingsWithToggle.pid = split.pid;
    settingsWithToggle.kf = split.kf;
  }
  return settingsWithToggle;
}

function serializeAutoWakeupSchedules(autowakeupSchedules) {
  return autowakeupSchedules
    .map(schedule => `${schedule.time}|${schedule.days.map(d => (d ? '1' : '0')).join('')}`)
    .join(';');
}

function isTruthySetting(value) {
  return value === true || value === 1 || value === '1' || value === 'true' || value === 'on';
}

// Maps a full or partial settings file onto form fields; keys the file lacks stay untouched.
function normalizeImportedSettings(data, knownKeys) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('The file does not contain a settings object.');
  }
  const fields = {};
  const ignored = [];
  for (const [key, value] of Object.entries(data)) {
    if (!knownKeys.has(key) || value === null || typeof value === 'object') {
      ignored.push(key);
    } else {
      fields[key] = CHECKBOX_KEYS.includes(key) ? isTruthySetting(value) : value;
    }
  }
  const count = Object.keys(fields).length;
  // API-shaped files carry "p,i,d,kf" and "b0,b1,b2"; the form edits those as separate fields.
  if (typeof fields.pid === 'string' && fields.pid.split(',').length >= 4) {
    Object.assign(fields, splitPidString(fields.pid));
  }
  if (fields.buttonBehavior && fields.button0 === undefined) {
    Object.assign(fields, splitButtons(String(fields.buttonBehavior)));
  }
  if (fields.standbyBrightness !== undefined && fields.standbyDisplayEnabled === undefined) {
    fields.standbyDisplayEnabled = Number(fields.standbyBrightness) > 0;
  }
  const schedules =
    fields.autowakeupSchedules !== undefined
      ? parseAutoWakeupSchedules(fields.autowakeupSchedules)
      : null;
  return { fields, schedules, ignored, count };
}

function buildSubmitFormData(formData, autowakeupSchedules, restart) {
  const formDataToSubmit = new FormData();

  for (const [key, value] of Object.entries(formData)) {
    if (value === undefined || value === null) continue;

    if (CHECKBOX_KEYS.includes(key)) {
      // Always explicit: the firmware leaves absent booleans untouched (GM-214).
      formDataToSubmit.set(key, value ? '1' : '0');
    } else {
      formDataToSubmit.set(key, String(value));
    }
  }

  formDataToSubmit.set('steamPumpPercentage', String(formData.steamPumpPercentage ?? 0));
  formDataToSubmit.set(
    'altRelayFunction',
    formData.altRelayFunction !== undefined ? String(formData.altRelayFunction) : '1',
  );
  formDataToSubmit.set(
    'dumpValveDuration',
    formData.dumpValveDuration !== undefined ? String(formData.dumpValveDuration) : '2',
  );
  formDataToSubmit.set(
    'buttonBehavior',
    `${formData.button0},${formData.button1},${formData.button2}`,
  );

  if (formData.pid) {
    const kf = formData.kf === undefined || formData.kf === null ? '' : String(formData.kf).trim();
    // Blank Kff is "leave the stored value". An explicit 0 still disables it.
    // The device keeps the 4th CSV field when this request omits it.
    if (kf !== '') {
      formDataToSubmit.set('pid', `${formData.pid},${kf}`);
    }
  }

  formDataToSubmit.set('autowakeupSchedules', serializeAutoWakeupSchedules(autowakeupSchedules));

  if (!formData.standbyDisplayEnabled) {
    formDataToSubmit.set('standbyBrightness', '0');
  }

  if (restart) {
    formDataToSubmit.append('restart', '1');
  }

  return formDataToSubmit;
}

export function Settings() {
  const apiService = useContext(ApiServiceContext);
  const { params } = useRoute();
  const tab = params.tab || 'general';
  const isFormTab = ['general', 'machine', 'calibration', 'plugins'].includes(tab);

  const [profiles, setProfiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({});
  const [currentTheme, setCurrentTheme] = useState('light');
  const [showWifiPassword, setShowWifiPassword] = useState(false);
  const [showApPassword, setShowApPassword] = useState(false);
  const [autowakeupSchedules, setAutoWakeupSchedules] = useState([
    { time: '07:00', days: [true, true, true, true, true, true, true] },
  ]);

  const [importNotice, setImportNotice] = useState(null);

  const [fetchedSettings, setFetchedSettings] = useState(() => getCachedSettings());
  const [isLoading, setIsLoading] = useState(!fetchedSettings);

  useEffect(() => {
    if (!fetchedSettings) {
      prefetchSettings()
        .then(data => {
          setFetchedSettings(data);
          setIsLoading(false);
        })
        .catch(err => {
          console.error('Failed to prefetch settings:', err);
          setIsLoading(false);
        });
    }
  }, [fetchedSettings]);

  useEffect(() => {
    const loadProfiles = async () => {
      if (machine.value.connected) {
        const response = await apiService.request({ tp: 'req:profiles:list', minimal: true });
        setProfiles(response.profiles);
      }
    };
    loadProfiles();
  }, [machine.value.connected, apiService]);

  const formRef = useRef();
  const dropdownRef = useRef(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    if (!dropdownOpen) return;

    const handleOutsideClick = event => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [dropdownOpen]);

  useEffect(() => {
    if (fetchedSettings) {
      const settingsWithToggle = transformFetchedSettings(fetchedSettings);
      const parsedSchedules = parseAutoWakeupSchedules(fetchedSettings.autowakeupSchedules);
      setAutoWakeupSchedules(parsedSchedules);
      setClock24h(!!fetchedSettings.clock24hFormat);
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
      let value = e.currentTarget.value;
      if (CHECKBOX_KEYS.includes(key)) {
        value = !formData[key];
      }
      if (key === 'clock24hFormat') {
        setClock24h(value);
      }
      if (key === 'standbyDisplayEnabled') {
        value = !formData.standbyDisplayEnabled;
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

  const setField = useCallback((key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  }, []);

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
      if (e) e.preventDefault();
      setSubmitting(true);
      const form = formRef.current;
      const formDataToSubmit = buildSubmitFormData(formData, autowakeupSchedules, restart);

      try {
        const response = await fetch(form.action, {
          method: 'post',
          body: formDataToSubmit,
        });
        const data = await response.json();

        const splitPid = data.pid ? splitPidString(data.pid) : null;
        const buttonFields = data.buttonBehavior ? splitButtons(data.buttonBehavior) : {};

        const updatedData = {
          ...data,
          ...(splitPid !== null ? { pid: splitPid.pid, kf: splitPid.kf } : {}),
          ...buttonFields,
          standbyDisplayEnabled:
            data.standbyBrightness > 0 ? formData.standbyDisplayEnabled : false,
        };

        updateSettingsCache(data);
        setFormData(updatedData);
        setImportNotice(null);
      } catch (error) {
        console.error('Failed to save settings:', error);
      } finally {
        setSubmitting(false);
      }
    },
    [formData, autowakeupSchedules],
  );

  const onExport = useCallback(() => {
    const autowakeupSchedulesStr = serializeAutoWakeupSchedules(autowakeupSchedules);
    downloadJson({ ...formData, autowakeupSchedules: autowakeupSchedulesStr }, 'settings.json');
  }, [formData, autowakeupSchedules]);

  const onUpload = async evt => {
    const input = evt.target;
    const file = input.files?.[0];
    if (!file) return;
    try {
      // Merging onto a form that never loaded would save defaults over the real settings.
      if (isLoading || !Object.keys(formData).length) {
        throw new Error('Settings have not loaded yet.');
      }
      const knownKeys = new Set([...Object.keys(formData), ...FORM_ONLY_KEYS]);
      const { fields, schedules, ignored, count } = normalizeImportedSettings(
        JSON.parse(await file.text()),
        knownKeys,
      );
      if (!count) throw new Error('The file contains no known settings.');

      setFormData(prev => ({ ...prev, ...fields }));
      if (schedules) setAutoWakeupSchedules(schedules);
      if (fields.clock24hFormat !== undefined) setClock24h(fields.clock24hFormat);
      if (fields.dashboardLayout !== undefined) setDashboardLayout(fields.dashboardLayout);
      setImportNotice({ error: false, name: file.name, count, ignored });
    } catch (error) {
      setImportNotice({ error: true, name: file.name, message: error.message });
    } finally {
      // Lets the same file be picked again.
      input.value = '';
    }
  };

  const onDiscardImport = useCallback(() => {
    const current = getCachedSettings() ?? fetchedSettings;
    setFormData(transformFetchedSettings(current));
    setAutoWakeupSchedules(parseAutoWakeupSchedules(current?.autowakeupSchedules));
    setClock24h(!!current?.clock24hFormat);
    setImportNotice(null);
  }, [fetchedSettings]);

  const settingsTabs = [
    { id: 'general', label: 'General', icon: faSliders },
    { id: 'machine', label: 'Machine', icon: faTemperatureHalf, preload: loadMachineTab },
    { id: 'calibration', label: 'Calibration', icon: faCrosshairs, preload: loadCalibrationTab },
    { id: 'plugins', label: 'Plugins', icon: faPuzzlePiece, preload: loadPluginsTab },
    { id: 'bluetooth', label: 'Bluetooth', icon: faBluetoothB, preload: loadBluetoothTab },
    { id: 'system', label: 'System & Updates', icon: faRotate, preload: loadSystemTab },
  ];

  return (
    <PageLayout>
      <PageHeader
        title='Settings'
        noStack={true}
        tabs={<TabBar tabs={settingsTabs} activeTab={tab} basePath='/settings' />}
        actions={
          <div
            className={`action-dropdown relative ${dropdownOpen ? 'action-dropdown-open' : ''}`}
            ref={dropdownRef}
          >
            <button
              onClick={() => setDropdownOpen(open => !open)}
              className='btn btn-ghost btn-circle text-base-content/85 hover:bg-base-content/10'
              aria-label='More options'
              aria-expanded={dropdownOpen}
            >
              <FontAwesomeIcon icon={faEllipsisVertical} size='lg' />
            </button>
            <ul className='menu action-dropdown-menu bg-base-100 rounded-box border-base-content/10 right-0 z-50 mt-1 w-52 border p-2 shadow-lg'>
              <li>
                <button
                  type='button'
                  onClick={() => {
                    onExport();
                    setDropdownOpen(false);
                  }}
                  className='justify-start gap-2 font-medium'
                  aria-label='Export settings'
                >
                  <FontAwesomeIcon icon={faFileExport} />
                  <span>Export Settings</span>
                </button>
              </li>
              <li>
                <button
                  type='button'
                  onClick={() => {
                    document.getElementById('settingsImport')?.click();
                    setDropdownOpen(false);
                  }}
                  className='justify-start gap-2 font-medium'
                  aria-label='Import settings'
                >
                  <FontAwesomeIcon icon={faFileImport} />
                  <span>Import Settings</span>
                </button>
              </li>
            </ul>
            <input
              onChange={onUpload}
              className='hidden'
              id='settingsImport'
              type='file'
              accept='.json,application/json'
            />
          </div>
        }
      />

      {importNotice && (
        <div
          role='alert'
          className={`alert alert-vertical sm:alert-horizontal mb-4 ${importNotice.error ? 'alert-error' : 'alert-info'}`}
        >
          <div className='text-sm'>
            {importNotice.error ? (
              <span>
                Could not import {importNotice.name}: {importNotice.message}
              </span>
            ) : (
              <>
                <span>
                  Loaded {importNotice.count} {importNotice.count === 1 ? 'setting' : 'settings'}{' '}
                  from {importNotice.name}. All other settings are kept. Save to apply.
                </span>
                {importNotice.ignored.length > 0 && (
                  <span className='block text-xs opacity-80'>
                    Ignored unknown entries: {importNotice.ignored.join(', ')}
                  </span>
                )}
              </>
            )}
          </div>
          <div className='flex shrink-0 gap-2'>
            {!importNotice.error && (
              <button
                type='button'
                className='btn btn-sm btn-primary'
                disabled={submitting}
                onClick={() => onSubmit()}
              >
                Save Settings
              </button>
            )}
            <button
              type='button'
              className='btn btn-sm btn-ghost'
              onClick={importNotice.error ? () => setImportNotice(null) : onDiscardImport}
            >
              {importNotice.error ? 'Dismiss' : 'Discard'}
            </button>
          </div>
        </div>
      )}

      <form
        id='settings-page-form'
        key='settings'
        ref={formRef}
        method='post'
        action='/api/settings'
        onSubmit={onSubmit}
        className={isFormTab ? '' : 'hidden'}
      >
        {tab === 'general' &&
          (isLoading ? (
            <GeneralTabSkeleton />
          ) : (
            <GeneralTab
              formData={formData}
              onChange={onChange}
              profiles={profiles}
              currentTheme={currentTheme}
              setCurrentTheme={setCurrentTheme}
              handleThemeChange={handleThemeChange}
              showWifiPassword={showWifiPassword}
              setShowWifiPassword={setShowWifiPassword}
              showApPassword={showApPassword}
              setShowApPassword={setShowApPassword}
            />
          ))}
        {tab === 'machine' &&
          (isLoading ? (
            <MachineTabSkeleton />
          ) : (
            <LazyMachineTab formData={formData} onChange={onChange} setField={setField} />
          ))}
        {tab === 'calibration' && (
          <LazyCalibrationTab formData={formData} onChange={onChange} setField={setField} />
        )}
        {tab === 'plugins' &&
          (isLoading ? (
            <PluginsTabSkeleton />
          ) : (
            <LazyPluginsTab
              formData={formData}
              onChange={onChange}
              autowakeupSchedules={autowakeupSchedules}
              addAutoWakeupSchedule={addAutoWakeupSchedule}
              removeAutoWakeupSchedule={removeAutoWakeupSchedule}
              updateAutoWakeupTime={updateAutoWakeupTime}
              updateAutoWakeupDay={updateAutoWakeupDay}
            />
          ))}

        {isFormTab && (
          <StickyFormFooter submitting={submitting} onRestart={e => onSubmit(e, true)} />
        )}
      </form>

      {tab === 'calibration' && (
        <LazyCalibrationTab formData={formData} onChange={onChange} setField={setField} />
      )}
      {tab === 'bluetooth' && (isLoading ? <BluetoothTabSkeleton /> : <LazyBluetoothTab />)}
      {tab === 'system' && (isLoading ? <SystemTabSkeleton /> : <LazySystemTab />)}
    </PageLayout>
  );
}
