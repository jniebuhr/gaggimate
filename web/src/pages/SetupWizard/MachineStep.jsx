import { useContext, useEffect, useState } from 'preact/hooks';
import { Trans, useLingui } from '@lingui/react/macro';
import { ApiServiceContext, getCachedSettings } from '../../services/ApiService.js';
import { Spinner } from '../../components/Spinner.jsx';
import { SettingsFormField } from '../../components/SettingsFormField.jsx';
import { splitPidString } from '../Settings/settingsForm.js';
import { DEFAULT_HEATER_WATTAGE, MACHINE_PRESETS } from './machinePresets.js';
import { postSettings } from './setupState.js';

const CUSTOM = 'custom';

function Autotune({ wattage, onWattageChange }) {
  const { t } = useLingui();
  const apiService = useContext(ApiServiceContext);
  const [state, setState] = useState('idle');
  const [result, setResult] = useState(null);

  useEffect(() => {
    const ok = apiService.on('evt:autotune-result', event => {
      setResult(event.pid);
      setState('done');
    });
    const failed = apiService.on('evt:autotune-failed', () => setState('failed'));
    return () => {
      apiService.off('evt:autotune-result', ok);
      apiService.off('evt:autotune-failed', failed);
    };
  }, [apiService]);

  const start = () => {
    setResult(null);
    setState('running');
    try {
      apiService.send({
        tp: 'req:autotune-start',
        time: 120,
        samples: 6,
        wattage: Number(wattage),
      });
    } catch {
      setState('failed');
    }
  };

  return (
    <div className='bg-base-200 space-y-3 rounded-lg p-4'>
      <span className='text-lg font-medium'>
        <Trans>PID autotune</Trans>
      </span>
      <p className='text-sm opacity-70'>
        <Trans>
          Start with a cold machine. The boiler heats at full power until GaggiMate has learned how
          it responds, then the PID values are saved. This takes 1–3 minutes.
        </Trans>
      </p>
      <SettingsFormField label={t`Heater wattage (W)`} htmlFor='setupWattage'>
        <input
          id='setupWattage'
          type='number'
          className='input input-bordered w-full'
          min='100'
          max='3000'
          value={wattage}
          disabled={state === 'running'}
          onInput={e => onWattageChange(e.currentTarget.value)}
        />
      </SettingsFormField>
      {state === 'running' && (
        <div className='flex items-center gap-2'>
          <Spinner size={4} />
          <Trans>Autotune in progress…</Trans>
        </div>
      )}
      {state === 'done' && (
        <div className='alert alert-success'>
          <span>{t`Autotune finished. New PID values: ${result}`}</span>
        </div>
      )}
      {state === 'failed' && (
        <div className='alert alert-error'>
          <span>
            <Trans>Autotune failed. Let the machine cool down and try again.</Trans>
          </span>
        </div>
      )}
      <div className='flex justify-end'>
        <button
          type='button'
          className='btn btn-primary'
          disabled={state === 'running' || !(Number(wattage) > 0)}
          onClick={start}
        >
          {state === 'idle' ? <Trans>Start autotune</Trans> : <Trans>Run again</Trans>}
        </button>
      </div>
    </div>
  );
}

export function MachineStep({ onSaved }) {
  const { t, i18n } = useLingui();
  const [selected, setSelected] = useState(MACHINE_PRESETS[0].id);
  const [applied, setApplied] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [wattage, setWattage] = useState(DEFAULT_HEATER_WATTAGE);
  const [custom, setCustom] = useState(() => {
    const settings = getCachedSettings() || {};
    const { pid, kf } = splitPidString(settings.pid || MACHINE_PRESETS[0].settings.pid);
    return {
      pid,
      kf,
      temperatureOffset: settings.temperatureOffset ?? 0,
      targetSteamTemp: settings.targetSteamTemp ?? 145,
    };
  });

  const preset = MACHINE_PRESETS.find(p => p.id === selected);

  const select = id => {
    setSelected(id);
    setApplied(null);
  };

  const apply = async () => {
    setSaving(true);
    setError(false);
    try {
      const fields = preset
        ? preset.settings
        : {
            pid: `${custom.pid},${custom.kf}`,
            temperatureOffset: custom.temperatureOffset,
            targetSteamTemp: custom.targetSteamTemp,
          };
      await postSettings(fields);
      setApplied(selected);
      onSaved?.(preset);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  const setCustomField = key => e => setCustom({ ...custom, [key]: e.currentTarget.value });
  const showAutotune = !preset;

  return (
    <div className='space-y-4'>
      <p>
        <Trans>
          Pick your machine to load matching defaults, or choose a custom machine to enter your own
          values or run an autotune.
        </Trans>
      </p>
      <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
        {[...MACHINE_PRESETS, { id: CUSTOM, name: t`Custom machine` }].map(option => (
          <label
            key={option.id}
            className={`bg-base-200 flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 ${
              selected === option.id ? 'border-primary' : 'border-transparent'
            }`}
          >
            <input
              type='radio'
              name='setupMachine'
              className='radio radio-primary'
              checked={selected === option.id}
              onChange={() => select(option.id)}
            />
            <span className='font-medium'>{option.name}</span>
          </label>
        ))}
      </div>

      {preset?.note && (
        <div className='alert alert-info'>
          <span>{i18n._(preset.note)}</span>
        </div>
      )}

      {!preset && (
        <div className='bg-base-200 grid grid-cols-1 gap-x-4 rounded-lg p-4 sm:grid-cols-2'>
          <SettingsFormField
            label={t`PID values (Kp, Ki, Kd)`}
            htmlFor='setupPid'
            className='sm:col-span-2'
          >
            <input
              id='setupPid'
              type='text'
              className='input input-bordered w-full'
              value={custom.pid}
              onInput={setCustomField('pid')}
            />
          </SettingsFormField>
          <SettingsFormField label={t`Feed-forward (Kf)`} htmlFor='setupKf'>
            <input
              id='setupKf'
              type='number'
              step='any'
              className='input input-bordered w-full'
              value={custom.kf}
              onInput={setCustomField('kf')}
            />
          </SettingsFormField>
          <SettingsFormField label={t`Temperature offset (°C)`} htmlFor='setupOffset'>
            <input
              id='setupOffset'
              type='number'
              className='input input-bordered w-full'
              value={custom.temperatureOffset}
              onInput={setCustomField('temperatureOffset')}
            />
          </SettingsFormField>
          <SettingsFormField label={t`Steam temperature (°C)`} htmlFor='setupSteam'>
            <input
              id='setupSteam'
              type='number'
              className='input input-bordered w-full'
              value={custom.targetSteamTemp}
              onInput={setCustomField('targetSteamTemp')}
            />
          </SettingsFormField>
        </div>
      )}

      {error && (
        <div className='alert alert-error'>
          <span>
            <Trans>Saving failed. Check the connection to your machine and try again.</Trans>
          </span>
        </div>
      )}
      {applied === selected && (
        <div className='alert alert-success'>
          <span>
            <Trans>Machine settings saved.</Trans>
          </span>
        </div>
      )}
      <div className='flex justify-end'>
        <button type='button' className='btn btn-primary' disabled={saving} onClick={apply}>
          {saving && <Spinner size={4} />}
          {preset ? <Trans>Apply preset</Trans> : <Trans>Save values</Trans>}
        </button>
      </div>

      {showAutotune && <Autotune wattage={wattage} onWattageChange={setWattage} />}
    </div>
  );
}
