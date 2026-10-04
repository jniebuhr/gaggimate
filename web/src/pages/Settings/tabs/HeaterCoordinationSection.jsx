import Section from '../../../components/Card.jsx';
import { machine } from '../../../services/ApiService.js';
export function HeaterCoordinationSection({ formData, onChange }) {
  if (!machine.value.capabilities.dualBoiler || !formData.heaterCoordinationSupported) return null;
  return (
    <Section title='Heater Coordination' className='h-full'>
      <p className='mb-4 text-sm opacity-70'>Settings apply after restarting the machine.</p>
      <label
        htmlFor='heaterCoordinationEnabled'
        className='label cursor-pointer justify-start gap-3'
      >
        <input
          id='heaterCoordinationEnabled'
          name='heaterCoordinationEnabled'
          type='checkbox'
          className='toggle toggle-primary'
          checked={!!formData.heaterCoordinationEnabled}
          onChange={onChange('heaterCoordinationEnabled')}
        />
        <span>Enable heater coordination</span>
      </label>
      <p className='mb-4 text-sm opacity-70'>
        When enabled, the brew heater takes priority and the heaters run one at a time. Disable for
        machines powered to heat both boilers simultaneously.
      </p>
      <label htmlFor='heaterHandoverMs' className='fieldset'>
        <span className='fieldset-label'>Heater handover pause (ms)</span>
        <input
          id='heaterHandoverMs'
          name='heaterHandoverMs'
          type='number'
          min='20'
          max='5000'
          required
          className='input input-bordered w-full'
          value={formData.heaterHandoverMs}
          onChange={onChange('heaterHandoverMs')}
        />
      </label>
    </Section>
  );
}
