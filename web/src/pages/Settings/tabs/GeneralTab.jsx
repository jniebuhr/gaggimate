import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye } from '@fortawesome/free-solid-svg-icons/faEye';
import { faEyeSlash } from '@fortawesome/free-solid-svg-icons/faEyeSlash';
import { timezones } from '../../../config/zones.js';
import { DASHBOARD_LAYOUTS } from '../../../utils/dashboardManager.js';
import Section from '../../../components/Card.jsx';
import { WarningIcon } from '../../../components/WarningIcon.jsx';
import { WARNING_LEVELS, WARNINGS } from '../../../utils/warnings.js';
import {
  InputGroupField,
  SettingsFormField,
  ToggleField,
} from '../../../components/SettingsFormField.jsx';

const FLUSH_DURATION_STEPS = [0, 5, 10, 15, 20];

function ButtonBehaviorSelect({ id, label, value, onChange, profiles }) {
  return (
    <SettingsFormField label={label} htmlFor={id} noMargin>
      <select
        id={id}
        name={id}
        className='select select-bordered w-full'
        value={value}
        onChange={onChange}
      >
        <option value='none'>None</option>
        <option value='brew'>Brew button</option>
        <option value='steam'>Steam button</option>
        <option value='water'>Water button</option>
        <option value='flush'>Flush</option>
        {profiles.map(p => (
          <option key={p.id} value={p.id}>
            Profile: {p.label}
          </option>
        ))}
      </select>
    </SettingsFormField>
  );
}

function WarningLevelSelect({ id, label, icon, value, onChange }) {
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
      <div className='join w-full' role='group' aria-label={`${label} severity`}>
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
        aria-label='Show Password'
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
  const flushDuration = Math.min(20, Math.round(Number(formData.flushDuration ?? 5) / 5) * 5);
  return (
    <div className='space-y-4 sm:space-y-6 lg:grid lg:grid-cols-2 lg:gap-4'>
      {/* User Preferences */}
      <Section title='User Preferences' className='h-full'>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <SettingsFormField label='Startup Mode' htmlFor='startup-mode' noMargin>
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
          </SettingsFormField>
          <SettingsFormField label='Startup Profile' htmlFor='startup-profile' noMargin>
            <select
              id='startup-profile'
              name='startupProfile'
              className='select select-bordered w-full'
              value={formData.startupProfile || ''}
              onChange={onChange('startupProfile')}
            >
              <option value=''>Last used profile</option>
              {profiles.map(profile => (
                <option key={profile.id} value={profile.id}>
                  {profile.label}
                </option>
              ))}
            </select>
          </SettingsFormField>
          <InputGroupField
            label='Standby Timeout'
            htmlFor='standbyTimeout'
            unit='s'
            unitAriaLabel='seconds'
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
          <h3 className='text-md text-base-content mb-2 font-semibold'>Predictive Scale Delay</h3>
          <p className='text-base-content/85 mb-4 text-sm opacity-70'>
            Shuts off the process ahead of time based on the flow rate to account for any dripping
            or delays in the control.
          </p>
          <div className='mb-4'>
            <ToggleField
              label='Auto Adjust'
              htmlFor='delayAdjust'
              checked={!!formData.delayAdjust}
              onChange={onChange('delayAdjust')}
            />
          </div>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <InputGroupField
              label='Brew'
              htmlFor='brewDelay'
              unit='ms'
              unitAriaLabel='milliseconds'
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
            <InputGroupField
              label='Grind'
              htmlFor='grindDelay'
              unit='ms'
              unitAriaLabel='milliseconds'
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
          </div>
        </div>

        {/* Flush */}
        <div className='border-base-content/5 mt-6 border-t pt-6'>
          <h3 className='text-md text-base-content mb-2 font-semibold'>Flush</h3>
          <SettingsFormField
            label='Flush Duration'
            htmlFor='flushDuration'
            helpText='Hold runs the flush for as long as the button is held. The valve stays open for one more second after the pump stops.'
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
                <span key={step}>{step === 0 ? 'Hold' : `${step}s`}</span>
              ))}
            </div>
          </SettingsFormField>
        </div>

        {/* Buttons */}
        <div className='border-base-content/5 mt-6 border-t pt-6'>
          <h3 className='text-md text-base-content mb-2 font-semibold'>Physical Buttons</h3>
          <p className='text-base-content/85 mb-4 text-sm opacity-70'>
            Define behavior for physical buttons when pressed. Make sure they are wired to the
            buttons header. Pressing the brew and steam buttons together (or a third button wired to
            both) triggers the water button behavior.
          </p>
          <div className='mb-4'>
            <ToggleField
              label='Momentary Buttons'
              htmlFor='momentaryButtons'
              checked={!!formData.momentaryButtons}
              onChange={onChange('momentaryButtons')}
            />
          </div>
          <p className='text-base-content/85 mb-4 text-sm opacity-70'>
            Activate this if your coffee machine is equipped with momentary buttons. A momentary
            button set to Brew or a profile starts a flush instead when held.
          </p>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
            <ButtonBehaviorSelect
              id='button0'
              label='Brew Button Behavior'
              value={formData.button0}
              onChange={onChange('button0')}
              profiles={profiles}
            />
            <ButtonBehaviorSelect
              id='button1'
              label='Steam Button Behavior'
              value={formData.button1}
              onChange={onChange('button1')}
              profiles={profiles}
            />
            <ButtonBehaviorSelect
              id='button2'
              label='Water Button Behavior'
              value={formData.button2}
              onChange={onChange('button2')}
              profiles={profiles}
            />
          </div>
        </div>
      </Section>

      {/* Display Settings */}
      <Section title='Display Settings' className='h-full'>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <SettingsFormField label='Main Brightness (1-16)' htmlFor='mainBrightness' noMargin>
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
          <SettingsFormField label='Display Theme' htmlFor='themeMode' noMargin>
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
          </SettingsFormField>
        </div>

        {/* Standby Display */}
        <div className='border-base-content/5 mt-6 border-t pt-6'>
          <div className='mb-4'>
            <ToggleField
              label='Enable standby display'
              htmlFor='standbyDisplayEnabled'
              checked={!!formData.standbyDisplayEnabled}
              onChange={onChange('standbyDisplayEnabled')}
            />
          </div>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            <SettingsFormField
              label='Standby Brightness (0-16)'
              htmlFor='standbyBrightness'
              helpText='When the toggle is off, brightness will be set to 0'
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
              label='Standby Brightness Timeout'
              htmlFor='standbyBrightnessTimeout'
              unit='s'
              unitAriaLabel='seconds'
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

      {/* Web Settings */}
      <Section title='Web Settings' className='h-full'>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <SettingsFormField label='Theme' htmlFor='webui-theme' noMargin>
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
              <option value='system'>System</option>
              <option value='light'>Light</option>
              <option value='dark'>Dark</option>
              <option value='coffee'>Coffee</option>
              <option value='nord'>Nord</option>
            </select>
          </SettingsFormField>
          <SettingsFormField label='Dashboard Layout' htmlFor='dashboardLayout' noMargin>
            <select
              id='dashboardLayout'
              name='dashboardLayout'
              className='select select-bordered w-full'
              value={formData.dashboardLayout || DASHBOARD_LAYOUTS.ORDER_FIRST}
              onChange={e => {
                onChange('dashboardLayout')(e);
              }}
            >
              <option value={DASHBOARD_LAYOUTS.ORDER_FIRST}>Process Controls First</option>
              <option value={DASHBOARD_LAYOUTS.ORDER_LAST}>Chart First</option>
            </select>
          </SettingsFormField>
        </div>
      </Section>

      {/* Network / System Preferences */}
      <Section title='System & Network' className='h-full'>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <SettingsFormField label='Wi-Fi SSID' htmlFor='wifiSsid' noMargin>
            <input
              id='wifiSsid'
              name='wifiSsid'
              type='text'
              className='input input-bordered w-full'
              placeholder='Wi-Fi SSID'
              value={formData.wifiSsid}
              onChange={onChange('wifiSsid')}
            />
          </SettingsFormField>
          <SettingsFormField label='Wi-Fi Password' htmlFor='wifiPassword' noMargin>
            <PasswordField
              id='wifiPassword'
              label='Wi-Fi Password'
              value={formData.wifiPassword}
              onChange={onChange('wifiPassword')}
              shown={showWifiPassword}
              setShown={setShowWifiPassword}
            />
          </SettingsFormField>
          <SettingsFormField
            label='Access Point Password'
            htmlFor='apPassword'
            helpText='Used for the GaggiMate hotspot when no Wi-Fi is configured (min. 8 characters).'
            noMargin
          >
            <PasswordField
              id='apPassword'
              label='Access Point Password'
              minLength={8}
              maxLength={63}
              value={formData.apPassword}
              onChange={onChange('apPassword')}
              shown={showApPassword}
              setShown={setShowApPassword}
            />
          </SettingsFormField>
          <SettingsFormField label='Hostname' htmlFor='mdnsName' noMargin>
            <input
              id='mdnsName'
              name='mdnsName'
              type='text'
              className='input input-bordered w-full'
              placeholder='Hostname'
              value={formData.mdnsName}
              onChange={onChange('mdnsName')}
            />
          </SettingsFormField>
          <SettingsFormField label='Time Zone' htmlFor='timezone' noMargin>
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
            label='Use 24h Format'
            htmlFor='clock24hFormat'
            checked={!!formData.clock24hFormat}
            onChange={onChange('clock24hFormat')}
          />
        </div>
      </Section>

      {/* Warnings */}
      <Section title='Warnings' className='h-full'>
        <p className='text-base-content/70 mb-4 text-sm'>
          Warnings are shown on the display. An error additionally asks for confirmation before a
          brew starts.
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
