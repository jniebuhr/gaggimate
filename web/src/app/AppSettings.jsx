import { useState } from 'preact/hooks';
import { Trans, useLingui } from '@lingui/react/macro';
import { plural } from '@lingui/core/macro';
import PageLayout from '../components/PageLayout.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Section from '../components/Card.jsx';
import { SettingsFormField, ToggleField } from '../components/SettingsFormField.jsx';
import { LanguageSelect } from '../components/LanguageSelect.jsx';
import { getStoredTheme, handleThemeChange } from '../utils/themeManager.js';
import {
  NOTIFICATION_EVENTS,
  appSettings,
  setUpdateChannel,
  updateNotificationSettings,
} from './appSettings.js';
import { activeMachine, machines, showMachineSetup } from './machines.js';
import { requestNotificationPermission } from './notifications.js';
import { Notice } from './Notice.jsx';
import { nativePlatform } from './platform.js';
import { bundleVersion, checkForUpdate, pendingUpdate } from './updates.js';

// App-only settings stored on the phone; machine settings stay under Device Settings.
export function AppSettings() {
  const { t } = useLingui();
  const [theme, setTheme] = useState(getStoredTheme);
  const machineCount = machines.value.length;
  const pending = pendingUpdate.value;
  const name = activeMachine.value?.name;
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
      <PageHeader title={t`App Settings`} />

      <Section title={t`Appearance`}>
        <SettingsFormField label={t`Theme`} htmlFor='app-theme' noMargin>
          <select
            id='app-theme'
            className='select select-bordered w-full'
            value={theme}
            onChange={e => {
              setTheme(e.target.value);
              handleThemeChange(e);
            }}
          >
            <option value='system'>{t({ message: 'System', context: 'theme' })}</option>
            <option value='light'>{t({ message: 'Light', context: 'theme' })}</option>
            <option value='dark'>{t({ message: 'Dark', context: 'theme' })}</option>
            <option value='coffee'>Coffee</option>
            <option value='nord'>Nord</option>
          </select>
        </SettingsFormField>
        <div className='mt-4'>
          <LanguageSelect />
        </div>
      </Section>

      <Section title={t`Notifications`}>
        <div className='flex flex-col gap-2'>
          <ToggleField
            label={t`Enable notifications`}
            htmlFor='notifications-enabled'
            checked={notifications.enabled}
            onChange={toggleNotifications}
            helpText={plural(machineCount, {
              one: 'Watches # saved machine.',
              other: 'Watches all # saved machines.',
            })}
          />
          <Notice>
            {nativePlatform() === 'ios'
              ? t`iOS only lets GaggiMate stay connected to your machines while the app is open. Notifications stop a few seconds after you switch to another app or lock your phone.`
              : t`While GaggiMate is in the background it keeps watching your machines and shows a permanent “Watching machines” notification. This uses some extra battery.`}
          </Notice>
          {permissionDenied && (
            <Notice variant='warning'>
              <Trans>
                Notifications are blocked. Allow them for GaggiMate in your phone's settings.
              </Trans>
            </Notice>
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

      <Section title={t`Updates`}>
        <SettingsFormField
          label={t`Update channel`}
          htmlFor='app-update-channel'
          helpText={t`Nightly gets new features first, built from the same code as the nightly firmware.`}
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
            <option value='stable'>{t({ message: 'Stable', context: 'update channel' })}</option>
            <option value='nightly'>{t({ message: 'Nightly', context: 'update channel' })}</option>
          </select>
        </SettingsFormField>
        <p className='text-base-content/60 mt-3 text-xs'>
          <Trans>Version {bundleVersion}</Trans>
          {pending && (
            <>
              {' · '}
              <Trans>{pending} installs the next time you leave the app</Trans>
            </>
          )}
        </p>
      </Section>

      <Section title={t`Machines`}>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <span className='text-sm'>
            <Trans>
              Connected to <span className='font-medium'>{name}</span>
            </Trans>
            {machineCount > 1 && (
              <>
                {' · '}
                <Trans>{machineCount} saved</Trans>
              </>
            )}
          </span>
          <button
            type='button'
            className='btn btn-sm'
            onClick={() => (showMachineSetup.value = true)}
          >
            <Trans>Manage machines</Trans>
          </button>
        </div>
      </Section>
    </PageLayout>
  );
}
