import { grindAvailable } from '../../../utils/grind.js';
import { computed } from '@preact/signals';
import { Trans, useLingui } from '@lingui/react/macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye } from '@fortawesome/free-solid-svg-icons/faEye';
import { faEyeSlash } from '@fortawesome/free-solid-svg-icons/faEyeSlash';
import { timezones } from '../../../config/zones.js';
import { DASHBOARD_LAYOUTS } from '../../../utils/dashboardManager.js';
import { isApp } from '../../../app/platform.js';
import Section from '../../../components/Card.jsx';
import { LanguageSelect } from '../../../components/LanguageSelect.jsx';
import { machine } from '../../../services/ApiService.js';
import { WarningIcon } from '../../../components/WarningIcon.jsx';
import { WARNING_LEVELS, WARNINGS } from '../../../utils/warnings.js';
import {
  InputGroupField,
  SettingsFormField,
  ToggleField,
} from '../../../components/SettingsFormField.jsx';

const pressureAvailable = computed(() => machine.value.capabilities.pressure);

const FLUSH_DURATION_STEPS = [0, 5, 10, 15, 20];

function WarningLevelSelect({ id, label, icon, value, onChange }) {
  const { t } = useLingui();
  const current = Number(value ?? 1);
  return (
    <SettingsFormField
      label={
        <span className='flex items-center gap-2'>
          <WarningIcon icon={icon} className='text-base-content/70 text-lg' />
          {label}
        </span>
      }
      htmlFor={id}
      noMargin
    >
      <div className='join w-full' role='group' aria-label={t`${label} severity`}>
        {WARNING_LEVELS.map(l => (
          <button
            key={l.value}
            type='button'
            id={l.value === current ? id : undefined}
            value={l.value}
            className={`join-item btn btn-sm flex-1 ${current === l.value ? l.activeClass : 'btn-outline'}`}
            onClick={onChange}
            aria-pressed={current === l.value}
          >
            {l.label}
          </button>
        ))}
      </div>
    </SettingsFormField>
  );
}

function PasswordField({ id, label, placeholder, value, onChange, shown, setShown, ...rest }) {
  const { t } = useLingui();
  return (
    <label className='input w-full'>
      <input
        id={id}
        name={id}
        type={shown ? 'text' : 'password'}
        placeholder={placeholder ?? label}
        value={value}
        onChange={onChange}
        {...rest}
      />
      <button
        type='button'
        className='hover:text-primary cursor-pointer focus:outline-none'
        aria-label={t`Show Password`}
        onClick={() => setShown(!shown)}
      >
        <FontAwesomeIcon icon={shown ? faEyeSlash : faEye} />
      </button>
    </label>
  );
}

export function GeneralTab({
  formData,
  onChange,
  profiles,
  currentTheme,
  setCurrentTheme,
  handleThemeChange,
  showWifiPassword,
  setShowWifiPassword,
  showApPassword,
  setShowApPassword,
}) {
  // Snap legacy free-form values onto the 5 s steps the slider offers.
  const { t } = useLingui();
  const flushDuration = Math.min(20, Math.round(Number(formData.flushDuration ?? 5) / 5) * 5);
  return (
    <div className='space-y-4 sm:space-y-6 lg:grid lg:grid-cols-2 lg:gap-4'>
      {/* User Preferences */}
      <Section title={t`User Preferences`} className='h-full'>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <SettingsFormField label={t`Startup Mode`} htmlFor='startup-mode' noMargin>
            <select
              id='startup-mode'
              name='startupMode'
              className='select select-bordered w-full'
              onChange={onChange('startupMode')}
            >
              <option value='standby' selected={formData.startupMode === 'standby'}>
                {t({ message: 'Standby', context: 'machine mode' })}
              </option>
              <option value='brew' selected={formData.startupMode === 'brew'}>
                {t({ message: 'Brew', context: 'machine mode' })}
              </option>
            </select>
          </SettingsFormField>
          <SettingsFormField label={t`Startup Profile`} htmlFor='startup-profile' noMargin>
            <select
              id='startup-profile'
              name='startupProfile'
              className='select select-bordered w-full'
              value={formData.startupProfile || ''}
              onChange={onChange('startupProfile')}
            >
              <option value=''>{t`Last used profile`}</option>
              {profiles.map(profile => (
                <option key={profile.id} value={profile.id}>
                  {profile.label}
                </option>
              ))}
            </select>
          </SettingsFormField>
          <InputGroupField
            label={t`Standby Timeout`}
            htmlFor='standbyTimeout'
            unit='s'
            unitAriaLabel={t`seconds`}
            noMargin
          >
            <input
              id='standbyTimeout'
              name='standbyTimeout'
              type='number'
              placeholder='0'
              value={formData.standbyTimeout}
              onChange={onChange('standbyTimeout')}
            />
          </InputGroupField>
        </div>

        {/* Predictive Scale Delay */}
        <div className='border-base-content/5 mt-6 border-t pt-6'>
          <h3 className='text-md text-base-content mb-2 font-semibold'>
            <Trans>Predictive Scale Delay</Trans>
          </h3>
          <p className='text-base-content/85 mb-4 text-sm opacity-70'>
            <Trans>
              Shuts off the process ahead of time based on the flow rate to account for any dripping
              or delays in the control.
            </Trans>
          </p>
          <div className='mb-4'>
            <ToggleField
              label={t`Auto Adjust`}
              htmlFor='delayAdjust'
              checked={!!formData.delayAdjust}
              onChange={onChange('delayAdjust')}
            />
          </div>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <InputGroupField
              label={t({ message: 'Brew', context: 'predictive scale delay' })}
              htmlFor='brewDelay'
              unit='ms'
              unitAriaLabel={t`milliseconds`}
              noMargin
            >
              <input
                id='brewDelay'
                name='brewDelay'
                type='number'
                step='any'
                className='grow'
                placeholder='0'
                value={formData.brewDelay}
                onChange={onChange('brewDelay')}
              />
            </InputGroupField>
            {grindAvailable(formData, machine.value.capabilities) && (
              <InputGroupField
                label={t({ message: 'Grind', context: 'predictive scale delay' })}
                htmlFor='grindDelay'
                unit='ms'
                unitAriaLabel={t`milliseconds`}
                noMargin
              >
                <input
                  id='grindDelay'
                  name='grindDelay'
                  type='number'
                  step='any'
                  className='grow'
                  placeholder='0'
                  value={formData.grindDelay}
                  onChange={onChange('grindDelay')}
                />
              </InputGroupField>
            )}
          </div>
        </div>

        {/* Flush */}
        <div className='border-base-content/5 mt-6 border-t pt-6'>
          <h3 className='text-md text-base-content mb-2 font-semibold'>
            <Trans context='settings section'>Flush</Trans>
          </h3>
          <SettingsFormField
            label={t`Flush Duration`}
            htmlFor='flushDuration'
            helpText={t`Hold runs the flush for as long as the button is held. The valve stays open for one more second after the pump stops.`}
            noMargin
          >
            <input
              id='flushDuration'
              name='flushDuration'
              type='range'
              className='range w-full'
              min={0}
              max={20}
              step={5}
              value={flushDuration}
              onChange={onChange('flushDuration')}
            />
            <div className='mt-1 flex justify-between px-1 text-xs opacity-70' aria-hidden='true'>
              {FLUSH_DURATION_STEPS.map(step => (
                <span key={step}>
                  {step === 0 ? t({ message: 'Hold', context: 'flush duration' }) : `${step}s`}
                </span>
              ))}
            </div>
          </SettingsFormField>
        </div>
      </Section>

      {/* Display Settings */}
      <Section title={t`Display Settings`} className='h-full'>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <SettingsFormField label={t`Main Brightness (1-16)`} htmlFor='mainBrightness' noMargin>
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
          </SettingsFormField>
          <SettingsFormField label={t`Display Theme`} htmlFor='themeMode' noMargin>
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
          </SettingsFormField>
          {pressureAvailable.value && (
            <SettingsFormField
              label={t`Brew Status Display`}
              htmlFor='statusDisplayMode'
              helpText={t`The chart is shown for Pro profiles only`}
              noMargin
            >
              <select
                id='statusDisplayMode'
                name='statusDisplayMode'
                className='select select-bordered w-full'
                value={formData.statusDisplayMode ?? 0}
                onChange={onChange('statusDisplayMode')}
              >
                <option value={0}>{t`Progress Bar`}</option>
                <option value={1}>{t`Shot Chart`}</option>
              </select>
            </SettingsFormField>
          )}
        </div>

        {/* Standby Display */}
        <div className='border-base-content/5 mt-6 border-t pt-6'>
          <div className='mb-4'>
            <ToggleField
              label={t`Enable standby display`}
              htmlFor='standbyDisplayEnabled'
              checked={!!formData.standbyDisplayEnabled}
              onChange={onChange('standbyDisplayEnabled')}
            />
          </div>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            <SettingsFormField
              label={t`Standby Brightness (0-16)`}
              htmlFor='standbyBrightness'
              helpText={t`When the toggle is off, brightness will be set to 0`}
              noMargin
            >
              <input
                id='standbyBrightness'
                name='standbyBrightness'
                type='number'
                className='input input-bordered w-full'
                placeholder='8'
                min='0'
                max='16'
                disabled={!formData.standbyDisplayEnabled}
                value={formData.standbyDisplayEnabled ? formData.standbyBrightness : 0}
                onChange={onChange('standbyBrightness')}
              />
            </SettingsFormField>
            <InputGroupField
              label={t`Standby Brightness Timeout`}
              htmlFor='standbyBrightnessTimeout'
              unit='s'
              unitAriaLabel={t`seconds`}
              noMargin
            >
              <input
                id='standbyBrightnessTimeout'
                name='standbyBrightnessTimeout'
                type='number'
                min='1'
                placeholder='60'
                value={formData.standbyBrightnessTimeout}
                onChange={onChange('standbyBrightnessTimeout')}
              />
            </InputGroupField>
          </div>
        </div>
      </Section>

      {/* Web Settings — in the app these live in App Settings and the dashboard customizer */}
      {isApp && (
        <Section title={t`Theme & Notifications`} className='h-full'>
          <p className='text-sm'>
            <Trans>
              Settings for this phone, like the theme and notifications, are in{' '}
              <a href='/app-settings' className='link link-primary font-medium'>
                App Settings
              </a>
              . The dashboard layout is in the dashboard's customize view.
            </Trans>
          </p>
        </Section>
      )}
      {!isApp && (
        <Section title={t`Web Settings`} className='h-full'>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            <SettingsFormField label={t`Theme`} htmlFor='webui-theme' noMargin>
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
                <option value='system'>{t({ message: 'System', context: 'theme' })}</option>
                <option value='light'>{t({ message: 'Light', context: 'theme' })}</option>
                <option value='dark'>{t({ message: 'Dark', context: 'theme' })}</option>
                <option value='coffee'>{t({ message: 'Coffee', context: 'theme' })}</option>
                <option value='nord'>Nord</option>
              </select>
            </SettingsFormField>
            <LanguageSelect />
            <SettingsFormField label={t`Dashboard Layout`} htmlFor='dashboardLayout' noMargin>
              <select
                id='dashboardLayout'
                name='dashboardLayout'
                className='select select-bordered w-full'
                value={formData.dashboardLayout || DASHBOARD_LAYOUTS.ORDER_FIRST}
                onChange={e => {
                  onChange('dashboardLayout')(e);
                }}
              >
                <option value={DASHBOARD_LAYOUTS.ORDER_FIRST}>{t`Process Controls First`}</option>
                <option value={DASHBOARD_LAYOUTS.ORDER_LAST}>{t`Chart First`}</option>
              </select>
            </SettingsFormField>
          </div>
        </Section>
      )}

      {/* Network / System Preferences */}
      <Section title={t`System & Network`} className='h-full'>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <SettingsFormField label={t`Wi-Fi SSID`} htmlFor='wifiSsid' noMargin>
            <input
              id='wifiSsid'
              name='wifiSsid'
              type='text'
              className='input input-bordered w-full'
              placeholder={t`Wi-Fi SSID`}
              value={formData.wifiSsid}
              onChange={onChange('wifiSsid')}
            />
          </SettingsFormField>
          <SettingsFormField label={t`Wi-Fi Password`} htmlFor='wifiPassword' noMargin>
            <PasswordField
              id='wifiPassword'
              label={t`Wi-Fi Password`}
              value={formData.wifiPassword}
              onChange={onChange('wifiPassword')}
              shown={showWifiPassword}
              setShown={setShowWifiPassword}
            />
          </SettingsFormField>
          <SettingsFormField
            label={t`Access Point Password`}
            htmlFor='apPassword'
            helpText={t`Used for the GaggiMate hotspot when no Wi-Fi is configured (min. 8 characters).`}
            noMargin
          >
            <PasswordField
              id='apPassword'
              label={t`Access Point Password`}
              minLength={8}
              maxLength={63}
              value={formData.apPassword}
              onChange={onChange('apPassword')}
              shown={showApPassword}
              setShown={setShowApPassword}
            />
          </SettingsFormField>
          <SettingsFormField label={t`Hostname`} htmlFor='mdnsName' noMargin>
            <input
              id='mdnsName'
              name='mdnsName'
              type='text'
              className='input input-bordered w-full'
              placeholder={t`Hostname`}
              value={formData.mdnsName}
              onChange={onChange('mdnsName')}
            />
          </SettingsFormField>
          <SettingsFormField label={t`Time Zone`} htmlFor='timezone' noMargin>
            <select
              id='timezone'
              name='timezone'
              className='select select-bordered w-full'
              onChange={onChange('timezone')}
            >
              {timezones.map(tz => (
                <option key={tz} value={tz} selected={formData.timezone === tz}>
                  {tz}
                </option>
              ))}
            </select>
          </SettingsFormField>
        </div>

        {/* Clock */}
        <div className='border-base-content/5 mt-6 border-t pt-6'>
          <ToggleField
            label={t`Use 24h Format`}
            htmlFor='clock24hFormat'
            checked={!!formData.clock24hFormat}
            onChange={onChange('clock24hFormat')}
          />
        </div>
      </Section>

      {/* Warnings */}
      <Section title={t`Warnings`} className='h-full'>
        <p className='text-base-content/70 mb-4 text-sm'>
          <Trans>
            Warnings are shown on the display. An error additionally asks for confirmation before a
            brew starts.
          </Trans>
        </p>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          {WARNINGS.map(w => (
            <WarningLevelSelect
              key={w.key}
              id={w.settingKey}
              label={w.label}
              icon={w.icon}
              value={formData[w.settingKey]}
              onChange={onChange(w.settingKey)}
            />
          ))}
        </div>
      </Section>
    </div>
  );
}
