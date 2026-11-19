import { Trans, useLingui } from '@lingui/react/macro';
import { updateGrinderSettings } from './grinderSettings.js';

export function ProfileGrinderSettings({ grinder, onChange }) {
  const { t } = useLingui();
  const hasValues = !!grinder && Object.keys(grinder).length > 0;
  const onFieldChange = field => e =>
    onChange(updateGrinderSettings(grinder, field, e.target.value));

  return (
    <details className='border-base-content/10 border-t pt-3' open={hasValues}>
      <summary className='cursor-pointer text-sm font-medium'>
        <Trans>Advanced grinder settings</Trans>
      </summary>
      <p className='text-base-content/70 mt-2 text-xs'>
        <Trans>
          Sent to a connected Bluetooth grinder when this profile is selected. Leave a field empty
          to keep the grinder's own setting; values outside the grinder's range are limited to it.
        </Trans>
      </p>
      <div className='mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3'>
        <div className='form-control'>
          <label htmlFor='grinderGrindSize' className='mb-2 block text-sm font-medium'>
            <Trans>Grind size</Trans>
          </label>
          <input
            id='grinderGrindSize'
            name='grinderGrindSize'
            type='number'
            className='input input-bordered w-full'
            value={grinder?.grindSize ?? ''}
            onChange={onFieldChange('grindSize')}
            aria-label={t`Grind size in the grinder's own unit`}
            min='0'
            step='any'
          />
        </div>
        <div className='form-control'>
          <label htmlFor='grinderRpm' className='mb-2 block text-sm font-medium'>
            <Trans>Grinder speed</Trans>
          </label>
          <label htmlFor='grinderRpm' className='input w-full'>
            <input
              id='grinderRpm'
              name='grinderRpm'
              type='number'
              className='grow'
              value={grinder?.rpm ?? ''}
              onChange={onFieldChange('rpm')}
              aria-label={t`Grinder speed in rpm`}
              min='0'
              step='1'
            />
            <span>rpm</span>
          </label>
        </div>
        <div className='form-control'>
          <label htmlFor='grinderFeedRpm' className='mb-2 block text-sm font-medium'>
            <Trans>Feed speed</Trans>
          </label>
          <label htmlFor='grinderFeedRpm' className='input w-full'>
            <input
              id='grinderFeedRpm'
              name='grinderFeedRpm'
              type='number'
              className='grow'
              value={grinder?.feedRpm ?? ''}
              onChange={onFieldChange('feedRpm')}
              aria-label={t`Bean feed speed in rpm`}
              min='0'
              step='1'
            />
            <span>rpm</span>
          </label>
        </div>
      </div>
      <p className='text-base-content/60 mt-2 text-xs'>
        <Trans>
          The grind size uses the grinder's own unit (burr gap in µm on the Bookoo Motto 80, where
          it only sets the displayed value and the burrs are still adjusted by hand).
        </Trans>
      </p>
    </details>
  );
}
