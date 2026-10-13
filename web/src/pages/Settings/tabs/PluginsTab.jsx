import { useLingui } from '@lingui/react/macro';
import { PluginCard } from '../PluginCard.jsx';
import Section from '../../../components/Card.jsx';

export function PluginsTab({
  formData,
  onChange,
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
