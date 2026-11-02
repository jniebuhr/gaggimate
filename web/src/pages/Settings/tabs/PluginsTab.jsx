import { useLingui } from '@lingui/react/macro';
import { PluginCard } from '../PluginCard.jsx';
import Section from '../../../components/Card.jsx';

export function PluginsTab({
  formData,
  onChange,
  onSmartDoseSaved,
  onSmartDoseSaving,
  settingsDisabled,
  autowakeupSchedules,
  addAutoWakeupSchedule,
  removeAutoWakeupSchedule,
  updateAutoWakeupTime,
  updateAutoWakeupDay,
}) {
  const { t } = useLingui();
  return (
    <Section title={t`Plugins`}>
      <PluginCard
        onSmartDoseSaved={onSmartDoseSaved}
        onSmartDoseSaving={onSmartDoseSaving}
        settingsDisabled={settingsDisabled}
        formData={formData}
        onChange={onChange}
        autowakeupSchedules={autowakeupSchedules}
        addAutoWakeupSchedule={addAutoWakeupSchedule}
        removeAutoWakeupSchedule={removeAutoWakeupSchedule}
        updateAutoWakeupTime={updateAutoWakeupTime}
        updateAutoWakeupDay={updateAutoWakeupDay}
      />
    </Section>
  );
}
