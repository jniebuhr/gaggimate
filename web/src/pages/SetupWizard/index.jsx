import { useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { Trans, useLingui } from '@lingui/react/macro';
import Card from '../../components/Card.jsx';
import { Spinner } from '../../components/Spinner.jsx';
import { getCachedSettings } from '../../services/ApiService.js';
import { useProfileList } from '../../services/hooks.js';
import { serializeAutoWakeupSchedules } from '../Settings/settingsForm.js';
import { InfoNote } from './InfoNote.jsx';
import { MachineStep } from './MachineStep.jsx';
import { BOOT_PLUGIN_KEYS, PLUGIN_KEYS, PluginsStep, usePluginForm } from './PluginsStep.jsx';
import { TestStep } from './TestStep.jsx';
import { WifiStep, isWifiChoiceValid } from './WifiStep.jsx';
import { postSettings, setupNeeded } from './setupState.js';

function FinishStep({ joinSsid, pluginsPending }) {
  const { t } = useLingui();
  const { profiles } = useProfileList();
  const featured = profiles.filter(p => !p.utility).slice(0, 4);
  return (
    <div className='space-y-4'>
      {joinSsid && (
        <InfoNote title={t`Restart`}>
          <Trans>
            GaggiMate restarts when you finish so it can connect to {joinSsid}. Plugins you enabled
            start with it.
          </Trans>
        </InfoNote>
      )}
      {pluginsPending && (
        <InfoNote title={t`Plugins`}>
          <Trans>The plugins you enabled start the next time the machine is switched on.</Trans>
        </InfoNote>
      )}
      <p className='text-lg'>
        <Trans>Thank you for installing GaggiMate! Your machine is ready for its first shot.</Trans>
      </p>
      <p>
        <Trans>
          A few profiles come pre-installed so you can start right away, from a classic 9 bar shot
          to lever-style pressure curves:
        </Trans>
      </p>
      {featured.length > 0 && (
        <ul className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
          {featured.map(profile => (
            <li key={profile.id} className='bg-base-200 rounded-lg p-3'>
              <div className='font-medium'>{profile.label}</div>
              {profile.description && (
                <div className='text-sm opacity-70'>{profile.description}</div>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className='text-sm opacity-70'>
        <Trans>You can run this wizard again any time from Settings → System.</Trans>
      </p>
    </div>
  );
}

// Shown after saving Wi-Fi: the machine restarts onto the home network and this page loses its connection.
function JoiningWifi({ ssid }) {
  const host = `${getCachedSettings()?.mdnsName || 'gaggimate'}.local`;
  return (
    <div className='mx-auto flex w-full max-w-xl flex-col gap-4 py-8'>
      <h1 className='text-2xl font-bold'>
        <Trans>GaggiMate is joining {ssid}</Trans>
      </h1>
      <p>
        <Trans>
          The machine restarts and connects to your network. Connect this device to {ssid} as well,
          then open <span className='font-mono'>http://{host}</span> or scan the QR code on the
          machine's display.
        </Trans>
      </p>
      <p className='text-sm opacity-70'>
        <Trans>
          If it can't connect, GaggiMate opens its own network again so you can correct the password
          in the settings.
        </Trans>
      </p>
    </div>
  );
}

export function SetupWizard() {
  const { t } = useLingui();
  const location = useLocation();
  const pluginForm = usePluginForm();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [offerWifi] = useState(() => getCachedSettings()?.apMode === true);
  const [wifi, setWifi] = useState({ selected: null, ssid: '', secure: false, password: '' });
  const [joining, setJoining] = useState(null);

  // Plugins switched on by the last applied preset; another preset (or a custom machine) resets them first
  const [presetPlugins, setPresetPlugins] = useState([]);
  const applyPresetPlugins = preset => {
    const next = preset?.plugins || [];
    const changes = Object.fromEntries([
      ...presetPlugins.map(key => [key, pluginForm.initial[key]]),
      ...next.map(key => [key, true]),
    ]);
    pluginForm.setFormData(formData => ({ ...formData, ...changes }));
    setPresetPlugins(next);
  };

  const stepIds = ['tests', 'machine', 'plugins', ...(offerWifi ? ['wifi'] : []), 'done'];
  const stepLabels = {
    tests: t`Testing`,
    machine: t`Machine`,
    plugins: t`Plugins`,
    wifi: t`Wi-Fi`,
    done: t`Done`,
  };
  const current = stepIds[step];

  const savePlugins = async () => {
    const fields = Object.fromEntries(PLUGIN_KEYS.map(key => [key, pluginForm.formData[key]]));
    fields.autowakeupSchedules = serializeAutoWakeupSchedules(pluginForm.schedules);
    await postSettings(fields);
  };

  // Only new Wi-Fi credentials restart the machine; boot-time plugins load on the next power-up
  const joinWifi = offerWifi && !!wifi.ssid;
  const pluginsPending =
    !joinWifi &&
    BOOT_PLUGIN_KEYS.some(key => !!pluginForm.formData[key] && !pluginForm.initial[key]);

  const finish = async () => {
    setBusy(true);
    setError(false);
    try {
      await postSettings({
        setupDone: true,
        ...(joinWifi
          ? { wifiSsid: wifi.ssid, wifiPassword: wifi.secure ? wifi.password : '' }
          : {}),
        ...(joinWifi ? { restart: 1 } : {}),
      });
      if (joinWifi) {
        setJoining(wifi.ssid);
        return;
      }
      setupNeeded.value = false;
      location.route('/profiles');
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const skip = async () => {
    if (!confirm(t`Skip the setup wizard? You can run it later from Settings → System.`)) return;
    try {
      await postSettings({ setupDone: true });
    } catch {
      // Still let the user in; the wizard shows again next time.
    }
    setupNeeded.value = false;
    location.route('/');
  };

  const skipWifi = () => {
    setWifi({ selected: null, ssid: '', secure: false, password: '' });
    setStep(step + 1);
  };

  const next = async () => {
    if (current === 'plugins') {
      setBusy(true);
      setError(false);
      try {
        await savePlugins();
      } catch {
        setError(true);
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    setStep(step + 1);
  };

  if (joining) return <JoiningWifi ssid={joining} />;

  return (
    <div className='mx-auto flex w-full max-w-3xl flex-col gap-4 py-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <h1 className='text-2xl font-bold'>
          <Trans>Welcome to GaggiMate</Trans>
        </h1>
        {current !== 'done' && (
          <button type='button' className='btn btn-ghost btn-sm' onClick={skip}>
            <Trans>Skip setup</Trans>
          </button>
        )}
      </div>
      <ul className='steps w-full'>
        {stepIds.map((id, i) => (
          <li key={id} className={`step ${i <= step ? 'step-primary' : ''}`}>
            {stepLabels[id]}
          </li>
        ))}
      </ul>
      <Card title={stepLabels[current]}>
        {current === 'tests' && <TestStep />}
        {current === 'machine' && <MachineStep onSaved={applyPresetPlugins} />}
        {current === 'plugins' && <PluginsStep form={pluginForm} />}
        {current === 'wifi' && <WifiStep wifi={wifi} onChange={setWifi} />}
        {current === 'done' && (
          <FinishStep joinSsid={joinWifi ? wifi.ssid : null} pluginsPending={pluginsPending} />
        )}
        {error && (
          <InfoNote tone='error' title={t`Saving failed`}>
            <Trans>Check the connection to your machine and try again.</Trans>
          </InfoNote>
        )}
        <div className='mt-4 flex justify-between gap-2'>
          <button
            type='button'
            className='btn btn-ghost'
            disabled={step === 0 || busy}
            onClick={() => setStep(step - 1)}
          >
            <Trans>Back</Trans>
          </button>
          {current === 'wifi' && (
            <button type='button' className='btn btn-ghost ml-auto' onClick={skipWifi}>
              <Trans>Skip</Trans>
            </button>
          )}
          {current !== 'done' ? (
            <button
              type='button'
              className='btn btn-primary'
              disabled={busy || (current === 'wifi' && !isWifiChoiceValid(wifi))}
              onClick={next}
            >
              {busy && <Spinner size={4} />}
              <Trans>Next</Trans>
            </button>
          ) : (
            <button type='button' className='btn btn-primary' disabled={busy} onClick={finish}>
              {busy && <Spinner size={4} />}
              {joinWifi ? <Trans>Finish and restart</Trans> : <Trans>Start brewing</Trans>}
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}
