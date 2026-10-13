import { useState } from 'preact/hooks';
import PageLayout from '../components/PageLayout.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Section from '../components/Card.jsx';
import { SettingsFormField, ToggleField } from '../components/SettingsFormField.jsx';
import { getStoredTheme, handleThemeChange } from '../utils/themeManager.js';
import {
  NOTIFICATION_EVENTS,
  appSettings,
  setUpdateChannel,
  updateNotificationSettings,
} from './appSettings.js';
import { activeMachine, machines, showMachineSetup } from './machines.js';
import { requestNotificationPermission } from './notifications.js';
import { nativePlatform } from './platform.js';
import { bundleVersion, checkForUpdate, pendingUpdate } from './updates.js';

// App-only settings stored on the phone; machine settings stay under Device Settings.
export function AppSettings() {
  const [theme, setTheme] = useState(getStoredTheme);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const notifications = appSettings.value.notifications;

  const toggleNotifications = async () => {
    if (notifications.enabled) {
      await updateNotificationSettings({ enabled: false });
      return;
    }
    const granted = await requestNotificationPermission();
    setPermissionDenied(!granted);
    if (granted) await updateNotificationSettings({ enabled: true });
  };

  return (
    <PageLayout variant='narrow'>
      <PageHeader title='App Settings' />

      <Section title='Appearance'>
        <SettingsFormField label='Theme' htmlFor='app-theme' noMargin>
          <select
            id='app-theme'
            className='select select-bordered w-full'
            value={theme}
            onChange={e => {
              setTheme(e.target.value);
              handleThemeChange(e);
            }}
          >
            <option value='system'>System</option>
            <option value='light'>Light</option>
            <option value='dark'>Dark</option>
            <option value='coffee'>Coffee</option>
            <option value='nord'>Nord</option>
          </select>
        </SettingsFormField>
      </Section>

      <Section title='Notifications'>
        <div className='flex flex-col gap-2'>
          <ToggleField
            label='Enable notifications'
            htmlFor='notifications-enabled'
            checked={notifications.enabled}
            onChange={toggleNotifications}
            helpText={`Watches all ${machines.value.length} saved machines.`}
          />
          <div className='alert alert-info alert-soft text-sm'>
            {nativePlatform() === 'ios'
              ? 'iOS only lets GaggiMate stay connected to your machines while the app is open. Notifications stop a few seconds after you switch to another app or lock your phone.'
              : 'While GaggiMate is in the background it keeps watching your machines and shows a permanent “Watching machines” notification. This uses some extra battery.'}
          </div>
          {permissionDenied && (
            <div role='alert' className='alert alert-warning alert-soft text-sm'>
              Notifications are blocked. Allow them for GaggiMate in your phone's settings.
            </div>
          )}
          <div className={`flex flex-col gap-2 ${notifications.enabled ? '' : 'opacity-50'}`}>
            {NOTIFICATION_EVENTS.map(event => (
              <ToggleField
                key={event.key}
                label={event.label}
                htmlFor={`notify-${event.key}`}
                checked={notifications[event.key]}
                onChange={() =>
                  updateNotificationSettings({ [event.key]: !notifications[event.key] })
                }
                helpText={event.help}
              />
            ))}
          </div>
        </div>
      </Section>

      <Section title='Updates'>
        <SettingsFormField
          label='Update channel'
          htmlFor='app-update-channel'
          helpText='Nightly gets new features first, built from the same code as the nightly firmware.'
          noMargin
        >
          <select
            id='app-update-channel'
            className='select select-bordered w-full'
            value={appSettings.value.updateChannel}
            onChange={async e => {
              await setUpdateChannel(e.target.value);
              checkForUpdate();
            }}
          >
            <option value='stable'>Stable</option>
            <option value='nightly'>Nightly</option>
          </select>
        </SettingsFormField>
        <p className='text-base-content/60 mt-3 text-xs'>
          Version {bundleVersion}
          {pendingUpdate.value &&
            ` · ${pendingUpdate.value} installs the next time you leave the app`}
        </p>
      </Section>

      <Section title='Machines'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <span className='text-sm'>
            Connected to <span className='font-medium'>{activeMachine.value?.name}</span>
            {machines.value.length > 1 && ` · ${machines.value.length} saved`}
          </span>
          <button
            type='button'
            className='btn btn-sm'
            onClick={() => (showMachineSetup.value = true)}
          >
            Manage machines
          </button>
        </div>
      </Section>
    </PageLayout>
  );
}
