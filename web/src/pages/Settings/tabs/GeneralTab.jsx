import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye } from '@fortawesome/free-solid-svg-icons/faEye';
import { faEyeSlash } from '@fortawesome/free-solid-svg-icons/faEyeSlash';
import { timezones } from '../../../config/zones.js';
import { DASHBOARD_LAYOUTS } from '../../../utils/dashboardManager.js';
import Section from '../../../components/Card.jsx';

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
              <label htmlFor='brewDelay' className='mb-2 block text-sm font-medium'>
                Brew
              </label>
              <div className='input-group'>
                <label htmlFor='brewDelay' className='input w-full'>
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
                  <span aria-label='milliseconds'>ms</span>
                </label>
              </div>
            </div>
            <div className='form-control'>
              <label htmlFor='grindDelay' className='mb-2 block text-sm font-medium'>
                Grind
              </label>
              <div className='input-group'>
                <label htmlFor='grindDelay' className='input w-full'>
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
                  <span aria-label='milliseconds'>ms</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Switch Control */}
        <div className='mt-6 border-t border-base-content/5 pt-6'>
          <h3 className='text-md font-semibold mb-2 text-base-content'>Switch Control</h3>
          <div className='form-control mb-4'>
            <label className='label cursor-pointer justify-start gap-4'>
              <span className='label-text'>Use momentary switches</span>
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
            <div className='form-control'>
              <label htmlFor='button0' className='mb-2 block text-sm font-medium'>
                Brew Button Behavior
              </label>
              <select
                id='button0'
                name='button0'
                className='select select-bordered w-full'
                value={formData.button0}
                onChange={onChange('button0')}
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
            <div className='form-control'>
              <label htmlFor='button1' className='mb-2 block text-sm font-medium'>
                Steam Button Behavior
              </label>
              <select
                id='button1'
                name='button1'
                className='select select-bordered w-full'
                value={formData.button1}
                onChange={onChange('button1')}
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
            <div className='form-control'>
              <label htmlFor='button2' className='mb-2 block text-sm font-medium'>
                Water Button Behavior
              </label>
              <select
                id='button2'
                name='button2'
                className='select select-bordered w-full'
                value={formData.button2}
                onChange={onChange('button2')}
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
              <span
                className='hover:text-primary cursor-pointer'
                aria-label='Show Password'
                onClick={() => setShowWifiPassword(!showWifiPassword)}
              >
                <FontAwesomeIcon icon={showWifiPassword ? faEyeSlash : faEye} />
              </span>
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
