import { useEffect, useRef, useState } from 'preact/hooks';
import { Trans } from '@lingui/react/macro';
import { getCachedSettings, updateSettingsCache } from '../../services/ApiService.js';
import { requestSettings } from '../../utils/settingsRequest.js';
import { Spinner } from '../../components/Spinner.jsx';
import { PluginCard } from '../Settings/PluginCard.jsx';
import { CHECKBOX_KEYS, parseAutoWakeupSchedules } from '../Settings/settingsForm.js';

// Everything PluginCard edits; only these are POSTed from the wizard.
export const PLUGIN_KEYS = [
  'autowakeupEnabled',
  'homekit',
  'boilerFillActive',
  'startupFillTime',
  'steamFillTime',
  'smartGrindActive',
  'smartGrindIp',
  'smartGrindMode',
  'mahlkonigActive',
  'mahlkonigRecipeProfiles',
  'homeAssistant',
  'haIP',
  'haPort',
  'haUser',
  'haPassword',
  'haTopic',
  'commutationGain',
  'convergenceGain',
  'integralGain',
  'maxPumpPower',
  'pumpSlipCoeffs',
];

// Plugins the firmware only registers at boot; changing one needs a restart.
export const BOOT_PLUGIN_KEYS = [
  'homekit',
  'boilerFillActive',
  'smartGrindActive',
  'mahlkonigActive',
  'homeAssistant',
];

export function usePluginForm() {
  const [formData, setFormData] = useState(() => getCachedSettings() || {});
  const [initial, setInitial] = useState(formData);
  const [schedules, updateSchedules] = useState(() =>
    parseAutoWakeupSchedules(getCachedSettings()?.autowakeupSchedules),
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const edits = useRef({});
  const schedulesEdited = useRef(false);

  const setFields = values => {
    Object.assign(edits.current, values);
    setFormData(previous => ({ ...previous, ...values }));
  };
  const setSchedules = values => {
    schedulesEdited.current = true;
    updateSchedules(values);
  };
  const onSettingSaved = (key, value, settings) => {
    updateSettingsCache(settings);
    setFields({ [key]: value });
    setInitial(previous => ({ ...previous, [key]: value }));
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    requestSettings()
      .then(settings => {
        if (cancelled) return;
        updateSettingsCache(settings);
        setInitial(settings);
        // Keep explicit edits and preset recommendations made while the fetch was pending.
        setFormData({ ...settings, ...edits.current });
        if (!schedulesEdited.current)
          updateSchedules(parseAutoWakeupSchedules(settings.autowakeupSchedules));
      })
      .catch(error => {
        if (!cancelled) setLoadError(error.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return {
    formData,
    setFields,
    initial,
    schedules,
    setSchedules,
    loading,
    loadError,
    saving,
    setSaving,
    onSettingSaved,
    retry: () => setReloadKey(value => value + 1),
  };
}

export function PluginsStep({ form }) {
  const { formData, setFields, schedules, setSchedules } = form;

  const onChange = key => e => {
    const value = CHECKBOX_KEYS.includes(key) ? !formData[key] : e.currentTarget.value;
    setFields({ [key]: value });
  };

  const updateSchedule = (index, patch) =>
    setSchedules(
      schedules.map((schedule, i) => (i === index ? { ...schedule, ...patch } : schedule)),
    );

  if (form.loading)
    return (
      <div role='status' className='flex items-center gap-2'>
        <Spinner size={4} />
        <Trans>Loading plugin settings…</Trans>
      </div>
    );
  if (form.loadError)
    return (
      <div className='space-y-3'>
        <p role='alert' className='text-error'>
          {form.loadError}
        </p>
        <button type='button' className='btn btn-outline btn-sm' onClick={form.retry}>
          <Trans>Retry</Trans>
        </button>
      </div>
    );
  return (
    <div className='space-y-4'>
      <p>
        <Trans>
          GaggiMate can connect to your smart home, grinder and more. Enable what you need now; you
          can always change this later in the settings.
        </Trans>
      </p>
      <PluginCard
        onSettingSaved={form.onSettingSaved}
        onSaving={form.setSaving}
        settingsDisabled={form.saving}
        formData={formData}
        onChange={onChange}
        autowakeupSchedules={schedules}
        addAutoWakeupSchedule={() =>
          setSchedules([...schedules, { time: '07:00', days: Array(7).fill(true) }])
        }
        removeAutoWakeupSchedule={index => setSchedules(schedules.filter((_, i) => i !== index))}
        updateAutoWakeupTime={(index, time) => updateSchedule(index, { time })}
        updateAutoWakeupDay={(index, day, enabled) =>
          updateSchedule(index, {
            days: schedules[index].days.map((d, i) => (i === day ? enabled : d)),
          })
        }
      />
    </div>
  );
}
