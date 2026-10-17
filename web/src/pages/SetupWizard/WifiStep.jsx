import { useCallback, useContext, useEffect, useState } from 'preact/hooks';
import { Trans, useLingui } from '@lingui/react/macro';
import { msg } from '@lingui/core/macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock } from '@fortawesome/free-solid-svg-icons/faLock';
import { faRotate } from '@fortawesome/free-solid-svg-icons/faRotate';
import { ApiServiceContext } from '../../services/ApiService.js';
import { Spinner } from '../../components/Spinner.jsx';
import { SettingsFormField } from '../../components/SettingsFormField.jsx';

const OTHER = '\u0000other'; // can never collide with a real SSID
export const WPA_MIN_PASSWORD = 8;

const SCAN_ERRORS = {
  busy: msg`The machine is busy, try again in a moment.`,
  notAp: msg`Scanning only works while GaggiMate runs its own Wi-Fi network.`,
};

function signalLabel(rssi) {
  if (rssi >= -60) return msg`Strong`;
  if (rssi >= -72) return msg`Good`;
  return msg`Weak`;
}

// A network is chosen and, for WPA, has a password of 8+ characters; skipping has its own button.
export function isWifiChoiceValid(wifi) {
  if (!wifi.ssid) return false;
  return !wifi.secure || wifi.password.length >= WPA_MIN_PASSWORD;
}

export function WifiStep({ wifi, onChange }) {
  const { t, i18n } = useLingui();
  const apiService = useContext(ApiServiceContext);
  const [networks, setNetworks] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const id = apiService.on('evt:wifi:scan', event => {
      setScanning(false);
      // The firmware only joins networks with a password, so open ones are left out
      if (event.success) setNetworks((event.networks || []).filter(n => n.secure));
      else setError('failed');
    });
    return () => apiService.off('evt:wifi:scan', id);
  }, [apiService]);

  const scan = useCallback(async () => {
    setError(null);
    setScanning(true);
    try {
      const res = await apiService.request({ tp: 'req:wifi:scan' });
      if (!res.success) {
        setScanning(false);
        setError(res.error || 'failed');
      }
    } catch {
      setScanning(false);
      setError('failed');
    }
  }, [apiService]);

  useEffect(() => {
    scan();
  }, [scan]);

  const select = network => {
    if (network === OTHER) {
      onChange({ selected: OTHER, ssid: '', secure: true, password: '' });
    } else {
      onChange({
        selected: network.ssid,
        ssid: network.ssid,
        secure: network.secure,
        password: '',
      });
    }
  };

  const errorText =
    error && (SCAN_ERRORS[error] ? i18n._(SCAN_ERRORS[error]) : t`Scanning failed.`);
  const needsPassword = wifi.selected && wifi.secure;

  return (
    <div className='space-y-4'>
      <p>
        <Trans>
          GaggiMate is running its own Wi-Fi network. Pick your home network so you can reach
          GaggiMate from any device. It connects when it restarts at the end of the setup.
        </Trans>
      </p>

      <div className='flex items-center justify-between gap-2'>
        <span className='font-medium'>
          <Trans>Networks nearby</Trans>
        </span>
        <button type='button' className='btn btn-ghost btn-sm' disabled={scanning} onClick={scan}>
          {scanning ? <Spinner size={4} /> : <FontAwesomeIcon icon={faRotate} />}
          <Trans>Search again</Trans>
        </button>
      </div>

      {errorText && (
        <div className='alert alert-warning'>
          <span>{errorText}</span>
        </div>
      )}
      {networks === null && scanning && (
        <div className='flex items-center gap-2 text-sm opacity-70'>
          <Spinner size={4} />
          <Trans>Searching for networks…</Trans>
        </div>
      )}

      <div className='space-y-2'>
        {(networks || []).map(network => (
          <label
            key={network.ssid}
            className={`bg-base-200 flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 ${
              wifi.selected === network.ssid ? 'border-primary' : 'border-transparent'
            }`}
          >
            <input
              type='radio'
              name='setupWifi'
              className='radio radio-primary'
              checked={wifi.selected === network.ssid}
              onChange={() => select(network)}
            />
            <span className='flex-1 truncate font-medium'>{network.ssid}</span>
            {network.secure && <FontAwesomeIcon icon={faLock} className='opacity-60' />}
            <span className='text-sm opacity-70'>{i18n._(signalLabel(network.rssi))}</span>
          </label>
        ))}
        <label
          className={`bg-base-200 flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 ${
            wifi.selected === OTHER ? 'border-primary' : 'border-transparent'
          }`}
        >
          <input
            type='radio'
            name='setupWifi'
            className='radio radio-primary'
            checked={wifi.selected === OTHER}
            onChange={() => select(OTHER)}
          />
          <span className='font-medium'>
            <Trans>Other network…</Trans>
          </span>
        </label>
      </div>

      {wifi.selected === OTHER && (
        <SettingsFormField label={t`Network name (SSID)`} htmlFor='setupWifiSsid'>
          <input
            id='setupWifiSsid'
            type='text'
            className='input input-bordered w-full'
            autoComplete='off'
            value={wifi.ssid}
            onInput={e => onChange({ ...wifi, ssid: e.currentTarget.value })}
          />
        </SettingsFormField>
      )}

      {needsPassword && (
        <SettingsFormField
          label={t`Password`}
          htmlFor='setupWifiPassword'
          helpText={
            wifi.password.length > 0 && wifi.password.length < WPA_MIN_PASSWORD
              ? t`Wi-Fi passwords have at least ${WPA_MIN_PASSWORD} characters.`
              : null
          }
        >
          <div className='flex gap-2'>
            <input
              id='setupWifiPassword'
              type={showPassword ? 'text' : 'password'}
              className='input input-bordered w-full'
              autoComplete='off'
              value={wifi.password}
              onInput={e => onChange({ ...wifi, password: e.currentTarget.value })}
            />
            <button
              type='button'
              className='btn btn-ghost'
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <Trans>Hide</Trans> : <Trans>Show</Trans>}
            </button>
          </div>
        </SettingsFormField>
      )}

      <p className='text-sm opacity-70'>
        <Trans>
          Skip this to keep using the GaggiMate network. You can add your Wi-Fi later in the
          settings.
        </Trans>
      </p>
    </div>
  );
}
