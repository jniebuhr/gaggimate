import { PluginCard } from '../PluginCard.jsx';
import Section from '../../../components/Card.jsx';

export function PluginsTab({
  formData,
  onChange,
  setField,
  onSubmit,
  autowakeupSchedules,
  addAutoWakeupSchedule,
  removeAutoWakeupSchedule,
  updateAutoWakeupTime,
  updateAutoWakeupDay,
}) {
  return (
    <Section title='Plugins'>
      <PluginCard
        formData={formData}
        onChange={onChange}
        setField={setField}
        onSubmit={onSubmit}
        autowakeupSchedules={autowakeupSchedules}
        addAutoWakeupSchedule={addAutoWakeupSchedule}
        removeAutoWakeupSchedule={removeAutoWakeupSchedule}
        updateAutoWakeupTime={updateAutoWakeupTime}
        updateAutoWakeupDay={updateAutoWakeupDay}
      />
    </Section>
  );
}
