import { Trans, useLingui } from '@lingui/react/macro';
import Section from '../../../components/Card.jsx';
import { machine } from '../../../services/ApiService.js';

export function HeaterCoordinationSection({ formData, onChange }) {
  const { t } = useLingui();
  if (!machine.value.capabilities.dualBoiler) return null;
  return (
    <Section title={t`Heater Coordination`} className='h-full'>
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
        <span>
          <Trans>Enable heater coordination</Trans>
        </span>
      </label>
      <p className='mb-4 text-sm opacity-70'>
        <Trans>
          Power the heaters one at a time instead of in parallel, brew boiler first. Only needed
          when the circuit cannot carry both heaters at once (e.g. 120 V); 230 V supplies can run
          both.
        </Trans>
      </p>
      <label htmlFor='heaterHandoverMs' className='fieldset'>
        <span className='fieldset-label'>
          <Trans>Heater handover pause (ms)</Trans>
        </span>
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
