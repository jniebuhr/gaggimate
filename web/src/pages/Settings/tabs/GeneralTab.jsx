import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye } from '@fortawesome/free-solid-svg-icons/faEye';
import { faEyeSlash } from '@fortawesome/free-solid-svg-icons/faEyeSlash';
import { timezones } from '../../../config/zones.js';
import { DASHBOARD_LAYOUTS } from '../../../utils/dashboardManager.js';
import Section from '../../../components/Card.jsx';

function ButtonBehaviorSelect({ id, label, value, onChange, profiles }) {
  return (
    <div className='form-control'>
      <label htmlFor={id} className='mb-2 block text-sm font-medium'>
        {label}
      </label>
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
    </div>
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
}) {
  return (
    <div className='space-y-4 sm:space-y-6'>
      {/* User Preferences */}
      <Section title='User Preferences'>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div className='form-control'>
            <label htmlFor='startup-mode' className='mb-2 block text-sm font-medium'>
              Startup Mode
            </label>
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
          </div>
          <div className='form-control'>
            <label htmlFor='startup-profile' className='mb-2 block text-sm font-medium'>
              Startup Profile
            </label>
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
          </div>
          <div className='form-control'>
            <label htmlFor='standbyTimeout' className='mb-2 block text-sm font-medium'>
              Standby Timeout
            </label>
            <div className='input-group'>
              <label htmlFor='standbyTimeout' className='input w-full'>
                <input
                  id='standbyTimeout'
                  name='standbyTimeout'
                  type='number'
                  placeholder='0'
                  value={formData.standbyTimeout}
                  onChange={onChange('standbyTimeout')}
                />
                <span aria-label='seconds'>s</span>
              </label>
            </div>
          </div>
        </div>

        {/* Predictive Scale Delay */}
        <div className='mt-6 border-t border-base-content/5 pt-6'>
          <h3 className='text-md font-semibold mb-2 text-base-content'>Predictive Scale Delay</h3>
          <p className='text-sm opacity-70 mb-4 text-base-content/85'>
            Shuts off the process ahead of time based on the flow rate to account for any dripping
            or delays in the control.
          </p>
          <div className='form-control mb-4'>
            <label className='label cursor-pointer justify-start gap-4'>
              <span className='label-text'>Auto Adjust</span>
              <input
                id='delayAdjust'
                name='delayAdjust'
                type='checkbox'
                className='toggle toggle-primary'
                checked={!!formData.delayAdjust}
                onChange={onChange('delayAdjust')}
              />
            </label>
          </div>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <div className='form-control'>
              <label htmlFor='scaleDelay' className='mb-2 block text-sm font-medium'>
                Scale Delay
              </label>
              <div className='input-group'>
                <label htmlFor='scaleDelay' className='input w-full'>
                  <input
                    id='scaleDelay'
                    name='scaleDelay'
                    type='number'
                    step='0.1'
                    placeholder='0'
                    value={formData.scaleDelay}
                    onChange={onChange('scaleDelay')}
                    disabled={formData.delayAdjust}
                  />
                  <span aria-label='seconds'>s</span>
                </label>
              </div>
            </div>
            <div className='form-control'>
              <label htmlFor='stopAdvanceWeight' className='mb-2 block text-sm font-medium'>
                Advance Stop Weight
              </label>
              <div className='input-group'>
                <label htmlFor='stopAdvanceWeight' className='input w-full'>
                  <input
                    id='stopAdvanceWeight'
                    name='stopAdvanceWeight'
                    type='number'
                    step='0.1'
                    placeholder='0'
                    value={formData.stopAdvanceWeight}
                    onChange={onChange('stopAdvanceWeight')}
                    disabled={formData.delayAdjust}
                  />
                  <span aria-label='grams'>g</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className='mt-6 border-t border-base-content/5 pt-6'>
          <h3 className='text-md font-semibold mb-2 text-base-content'>Physical Buttons</h3>
          <p className='text-sm opacity-70 mb-4 text-base-content/85'>
            Define behavior for physical buttons when pressed. Make sure they are wired to the Alt
            Relay Header.
          </p>
          <div className='form-control mb-4'>
            <label className='label cursor-pointer justify-start gap-4'>
              <span className='label-text font-medium'>Momentary Buttons</span>
              <input
                id='momentaryButtons'
                name='momentaryButtons'
                type='checkbox'
                className='toggle toggle-primary'
                checked={!!formData.momentaryButtons}
                onChange={onChange('momentaryButtons')}
              />
            </label>
          </div>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
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

      {/* Web Settings */}
      <Section title='Web Settings'>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div className='form-control'>
            <label htmlFor='webui-theme' className='mb-2 block text-sm font-medium'>
              Theme
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
              <option value='light'>Light</option>
              <option value='dark'>Dark</option>
              <option value='coffee'>Coffee</option>
              <option value='nord'>Nord</option>
            </select>
          </div>
          <div className='form-control'>
            <label htmlFor='dashboardLayout' className='mb-2 block text-sm font-medium'>
              Dashboard Layout
            </label>
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
          </div>
        </div>
      </Section>

      {/* Network / System Preferences */}
      <Section title='System & Network'>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div className='form-control'>
            <label htmlFor='wifiSsid' className='mb-2 block text-sm font-medium'>
              Wi-Fi SSID
            </label>
            <input
              id='wifiSsid'
              name='wifiSsid'
              type='text'
              className='input input-bordered w-full'
              placeholder='Wi-Fi SSID'
              value={formData.wifiSsid}
              onChange={onChange('wifiSsid')}
            />
          </div>
          <div className='form-control'>
            <label htmlFor='wifiPassword' className='mb-2 block text-sm font-medium'>
              Wi-Fi Password
            </label>
            <label className='input w-full'>
              <input
                id='wifiPassword'
                name='wifiPassword'
                type={showWifiPassword ? 'text' : 'password'}
                placeholder='Wi-Fi Password'
                value={formData.wifiPassword}
                onChange={onChange('wifiPassword')}
              />
              <button
                type='button'
                className='hover:text-primary cursor-pointer focus:outline-none'
                aria-label='Show Password'
                onClick={() => setShowWifiPassword(!showWifiPassword)}
              >
                <FontAwesomeIcon icon={showWifiPassword ? faEyeSlash : faEye} />
              </button>
            </label>
          </div>
          <div className='form-control'>
            <label htmlFor='mdnsName' className='mb-2 block text-sm font-medium'>
              Hostname
            </label>
            <input
              id='mdnsName'
              name='mdnsName'
              type='text'
              className='input input-bordered w-full'
              placeholder='Hostname'
              value={formData.mdnsName}
              onChange={onChange('mdnsName')}
            />
          </div>
          <div className='form-control'>
            <label htmlFor='timezone' className='mb-2 block text-sm font-medium'>
              Time Zone
            </label>
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
          </div>
        </div>

        {/* Clock */}
        <div className='mt-6 border-t border-base-content/5 pt-6'>
          <div className='form-control'>
            <label className='label cursor-pointer justify-start gap-4'>
              <span className='label-text font-medium'>Use 24h Format</span>
              <input
                id='clock24hFormat'
                name='clock24hFormat'
                type='checkbox'
                className='toggle toggle-primary'
                checked={!!formData.clock24hFormat}
                onChange={onChange('clock24hFormat')}
              />
            </label>
          </div>
        </div>
      </Section>
    </div>
  );
}
