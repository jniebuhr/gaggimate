import { Trans } from '@lingui/react/macro';
import { machine } from '../../../services/ApiService.js';

export function HeaterCoordinationSection({ formData, onChange }) {
  if (!machine.value.capabilities.dualBoiler) return null;
  return (
    <section className='space-y-3'>
      <h3 className='font-medium'>
        <Trans>Heater Coordination</Trans>
      </h3>
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
          <Trans>Heater coordination</Trans>
        </span>
      </label>
      <p className='mb-4 text-sm opacity-70'>
        <Trans>
          Power the heaters one at a time instead of in parallel, brew boiler first. Only needed
          when the circuit cannot carry both heaters at once (e.g. 120 V); 230 V supplies can run
          both.
        </Trans>
      </p>
    </section>
  );
}
