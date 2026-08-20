import { PluginCard } from '../PluginCard.jsx';
import Section from '../../../components/Card.jsx';
import { WaterReminderSetup } from '../WaterReminderSetup.jsx';

export function PluginsTab({
  formData,
  onChange,
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
        autowakeupSchedules={autowakeupSchedules}
        addAutoWakeupSchedule={addAutoWakeupSchedule}
        removeAutoWakeupSchedule={removeAutoWakeupSchedule}
        updateAutoWakeupTime={updateAutoWakeupTime}
        updateAutoWakeupDay={updateAutoWakeupDay}
      />
      <div className='mt-4'>
        <WaterReminderSetup formData={formData} onChange={onChange} />
      </div>
    </Section>
  );
}
