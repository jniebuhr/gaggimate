import { useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { Trans, useLingui } from '@lingui/react/macro';
import Card from '../../components/Card.jsx';
import { Spinner } from '../../components/Spinner.jsx';
import { useProfileList } from '../../services/hooks.js';
import { serializeAutoWakeupSchedules } from '../Settings/settingsForm.js';
import { MachineStep } from './MachineStep.jsx';
import { BOOT_PLUGIN_KEYS, PLUGIN_KEYS, PluginsStep, usePluginForm } from './PluginsStep.jsx';
import { TestStep } from './TestStep.jsx';
import { postSettings, setupNeeded } from './setupState.js';

function FinishStep() {
  const { profiles } = useProfileList();
  const featured = profiles.filter(p => !p.utility).slice(0, 4);
  return (
    <div className='space-y-4'>
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

export function SetupWizard() {
  const { t } = useLingui();
  const location = useLocation();
  const pluginForm = usePluginForm();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const enablePresetPlugins = preset => {
    if (!preset?.plugins) return;
    const enabled = Object.fromEntries(preset.plugins.map(key => [key, true]));
    pluginForm.setFormData(formData => ({ ...formData, ...enabled }));
  };

  const steps = [t`Testing`, t`Machine`, t`Plugins`, t`Done`];

  const savePlugins = async () => {
    const fields = Object.fromEntries(PLUGIN_KEYS.map(key => [key, pluginForm.formData[key]]));
    fields.autowakeupSchedules = serializeAutoWakeupSchedules(pluginForm.schedules);
    await postSettings(fields);
  };

  const needsRestart = () =>
    BOOT_PLUGIN_KEYS.some(key => !!pluginForm.formData[key] !== !!pluginForm.initial[key]);

  const finish = async () => {
    setBusy(true);
    setError(false);
    try {
      // Boot-time plugins only load after a restart; the web UI reconnects on its own
      await postSettings({ setupDone: true, ...(needsRestart() ? { restart: 1 } : {}) });
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

  const next = async () => {
    if (step === 2) {
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

  return (
    <div className='mx-auto flex w-full max-w-3xl flex-col gap-4 py-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <h1 className='text-2xl font-bold'>
          <Trans>Welcome to GaggiMate</Trans>
        </h1>
        {step < steps.length - 1 && (
          <button type='button' className='btn btn-ghost btn-sm' onClick={skip}>
            <Trans>Skip setup</Trans>
          </button>
        )}
      </div>
      <ul className='steps w-full'>
        {steps.map((label, i) => (
          <li key={label} className={`step ${i <= step ? 'step-primary' : ''}`}>
            {label}
          </li>
        ))}
      </ul>
      <Card title={steps[step]}>
        {step === 0 && <TestStep />}
        {step === 1 && <MachineStep onSaved={enablePresetPlugins} />}
        {step === 2 && <PluginsStep form={pluginForm} />}
        {step === 3 && <FinishStep />}
        {error && (
          <div className='alert alert-error'>
            <span>
              <Trans>Saving failed. Check the connection to your machine and try again.</Trans>
            </span>
          </div>
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
          {step < steps.length - 1 ? (
            <button type='button' className='btn btn-primary' disabled={busy} onClick={next}>
              {busy && <Spinner size={4} />}
              <Trans>Next</Trans>
            </button>
          ) : (
            <button type='button' className='btn btn-primary' disabled={busy} onClick={finish}>
              {busy && <Spinner size={4} />}
              <Trans>Start brewing</Trans>
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}
