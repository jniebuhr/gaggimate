import { useState } from 'preact/hooks';
import { Trans } from '@lingui/react/macro';
import { getCachedSettings } from '../../services/ApiService.js';
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
  const [formData, setFormData] = useState(() => {
    const settings = getCachedSettings() || {};
    return Object.fromEntries(PLUGIN_KEYS.map(key => [key, settings[key]]));
  });
  const [initial] = useState(formData);
  const [schedules, setSchedules] = useState(() =>
    parseAutoWakeupSchedules(getCachedSettings()?.autowakeupSchedules),
  );
  return { formData, setFormData, initial, schedules, setSchedules };
}

export function PluginsStep({ form }) {
  const { formData, setFormData, schedules, setSchedules } = form;

  const onChange = key => e => {
    const value = CHECKBOX_KEYS.includes(key) ? !formData[key] : e.currentTarget.value;
    setFormData({ ...formData, [key]: value });
  };

  const updateSchedule = (index, patch) =>
    setSchedules(
      schedules.map((schedule, i) => (i === index ? { ...schedule, ...patch } : schedule)),
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
