import { faFileExport } from '@fortawesome/free-solid-svg-icons/faFileExport';
import { faFileImport } from '@fortawesome/free-solid-svg-icons/faFileImport';
import { faEllipsisVertical } from '@fortawesome/free-solid-svg-icons/faEllipsisVertical';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQuery } from 'preact-fetching';
import { useCallback, useEffect, useRef, useState, useContext } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
import { DASHBOARD_LAYOUTS, setDashboardLayout } from '../../utils/dashboardManager.js';
import { downloadJson } from '../../utils/download.js';
import { getStoredTheme, handleThemeChange } from '../../utils/themeManager.js';
import { Spinner } from '../../components/Spinner.jsx';

import PageLayout from '../../components/PageLayout.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import TabBar from '../../components/TabBar.jsx';

import { StickyFormFooter } from './StickyFormFooter.jsx';
import { ProgressiveContent, preloadComponent } from '../../components/ProgressiveContent.jsx';
import {
  GeneralTabSkeleton,
  MachineTabSkeleton,
  PluginsTabSkeleton,
  BluetoothTabSkeleton,
  SystemTabSkeleton,
} from '../../components/Skeletons.jsx';

const loadGeneralTab = () => import('./tabs/GeneralTab.jsx').then(m => m.GeneralTab);
const loadMachineTab = () => import('./tabs/MachineTab.jsx').then(m => m.MachineTab);
const loadPluginsTab = () => import('./tabs/PluginsTab.jsx').then(m => m.PluginsTab);
const loadBluetoothTab = () => import('./tabs/BluetoothTab.jsx').then(m => m.BluetoothTab);
const loadSystemTab = () => import('./tabs/SystemTab.jsx').then(m => m.SystemTab);

// Icons
import { faSliders } from '@fortawesome/free-solid-svg-icons/faSliders';
import { faTemperatureHalf } from '@fortawesome/free-solid-svg-icons/faTemperatureHalf';
import { faPuzzlePiece } from '@fortawesome/free-solid-svg-icons/faPuzzlePiece';
import { faBluetoothB } from '@fortawesome/free-brands-svg-icons/faBluetoothB';
import { faRotate } from '@fortawesome/free-solid-svg-icons/faRotate';

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
  const { params } = useRoute();
  const tab = params.tab || 'general';
  const isFormTab = ['general', 'machine', 'plugins'].includes(tab);

  const [profiles, setProfiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [gen] = useState(0);
  const [formData, setFormData] = useState({});
  const [currentTheme, setCurrentTheme] = useState('light');
  const [showWifiPassword, setShowWifiPassword] = useState(false);
  const [autowakeupSchedules, setAutoWakeupSchedules] = useState([
    { time: '07:00', days: [true, true, true, true, true, true, true] },
  ]);

  const { isLoading, data: fetchedSettings } = useQuery(`settings/${gen}`, async () => {
    const response = await fetch(`/api/settings`);
    return await response.json();
  });

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
      let value = e.currentTarget.value;
      if (
        [
          'homekit',
          'boilerFillActive',
          'smartGrindActive',
          'smartGrindToggle',
          'homeAssistant',
          'momentaryButtons',
          'delayAdjust',
          'clock24hFormat',
          'autowakeupEnabled',
        ].includes(key)
      ) {
        value = !formData[key];
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
      const formDataToSubmit = new FormData();

      // Define which keys are checkboxes in the C++ backend
      const checkboxKeys = [
        'homekit',
        'boilerFillActive',
        'smartGrindActive',
        'homeAssistant',
        'momentaryButtons',
        'delayAdjust',
        'clock24hFormat',
        'autowakeupEnabled'
      ];

      // Populate form data from state
      for (const [key, value] of Object.entries(formData)) {
        if (value === undefined || value === null) continue;

        if (checkboxKeys.includes(key)) {
          if (value) {
            formDataToSubmit.set(key, '1');
          }
        } else {
          formDataToSubmit.set(key, String(value));
        }
      }

      // Explicit overrides matching original onSubmit logic:
      formDataToSubmit.set('steamPumpPercentage', String(formData.steamPumpPercentage));
      formDataToSubmit.set(
        'altRelayFunction',
        formData.altRelayFunction !== undefined ? String(formData.altRelayFunction) : '1',
      );
      formDataToSubmit.set(
        'buttonBehavior',
        `${formData.button0},${formData.button1},${formData.button2}`,
      );

      if (formData.pid && formData.kf !== undefined) {
        const combinedPid = `${formData.pid},${formData.kf}`;
        formDataToSubmit.set('pid', combinedPid);
      }

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
          standbyDisplayEnabled: data.standbyBrightness > 0 ? formData.standbyDisplayEnabled : false,
        };

        setFormData(updatedData);
      } catch (error) {
        console.error('Failed to save settings:', error);
      } finally {
        setSubmitting(false);
      }
    },
    [formData, autowakeupSchedules]
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

  const settingsTabs = [
    { id: 'general', label: 'General', icon: faSliders, preload: () => preloadComponent(loadGeneralTab) },
    { id: 'machine', label: 'Machine', icon: faTemperatureHalf, preload: () => preloadComponent(loadMachineTab) },
    { id: 'plugins', label: 'Plugins', icon: faPuzzlePiece, preload: () => preloadComponent(loadPluginsTab) },
    { id: 'bluetooth', label: 'Bluetooth', icon: faBluetoothB, preload: () => preloadComponent(loadBluetoothTab) },
    { id: 'system', label: 'System', icon: faRotate, preload: () => preloadComponent(loadSystemTab) },
  ];

  return (
    <PageLayout variant="narrow">
      <PageHeader
        title="Settings"
        noStack={true}
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
            <ul className='menu action-dropdown-menu bg-base-100 rounded-box border border-base-content/10 right-0 z-50 mt-1 w-52 p-2 shadow-lg'>
              <li>
                <button
                  type='button'
                  onClick={() => {
                    onExport();
                    setDropdownOpen(false);
                  }}
                  className='text-primary hover:bg-primary/10 justify-start gap-2 font-medium'
                  aria-label='Export settings'
                >
                  <FontAwesomeIcon icon={faFileExport} />
                  <span>Export Settings</span>
                </button>
              </li>
              <li>
                <label
                  htmlFor='settingsImport'
                  className='text-success hover:bg-success/10 flex cursor-pointer items-center justify-start gap-2 font-medium'
                  aria-label='Import settings'
                  onClick={() => setDropdownOpen(false)}
                >
                  <FontAwesomeIcon icon={faFileImport} />
                  <span>Import Settings</span>
                </label>
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

      <TabBar
        tabs={settingsTabs}
        activeTab={tab}
        basePath="/settings"
        className="-mb-4 lg:-mb-6"
      />

      <form key='settings' ref={formRef} method='post' action='/api/settings' onSubmit={onSubmit} className={isFormTab ? '' : 'hidden'}>
        {tab === 'general' && (
          <ProgressiveContent
            loader={loadGeneralTab}
            skeleton={GeneralTabSkeleton}
            formData={formData}
            onChange={onChange}
            profiles={profiles}
            currentTheme={currentTheme}
            setCurrentTheme={setCurrentTheme}
            handleThemeChange={handleThemeChange}
            showWifiPassword={showWifiPassword}
            setShowWifiPassword={setShowWifiPassword}
          />
        )}
        {tab === 'machine' && (
          <ProgressiveContent
            loader={loadMachineTab}
            skeleton={MachineTabSkeleton}
            formData={formData}
            onChange={onChange}
          />
        )}
        {tab === 'plugins' && (
          <ProgressiveContent
            loader={loadPluginsTab}
            skeleton={PluginsTabSkeleton}
            formData={formData}
            onChange={onChange}
            autowakeupSchedules={autowakeupSchedules}
            addAutoWakeupSchedule={addAutoWakeupSchedule}
            removeAutoWakeupSchedule={removeAutoWakeupSchedule}
            updateAutoWakeupTime={updateAutoWakeupTime}
            updateAutoWakeupDay={updateAutoWakeupDay}
          />
        )}

        {isFormTab && (
          <StickyFormFooter
            submitting={submitting}
            onRestart={(e) => onSubmit(e, true)}
          />
        )}
      </form>

      {tab === 'bluetooth' && (
        <ProgressiveContent
          loader={loadBluetoothTab}
          skeleton={BluetoothTabSkeleton}
        />
      )}
      {tab === 'system' && (
        <ProgressiveContent
          loader={loadSystemTab}
          skeleton={SystemTabSkeleton}
        />
      )}
    </PageLayout>
  );
}
