import { Trans } from '@lingui/react/macro';
import { updateGrinderSettings } from './grinderSettings.js';

export function ProfileGrinderSettings({ grinder, onChange }) {
  const hasValues = !!grinder && Object.keys(grinder).length > 0;
  const onFieldChange = field => e =>
    onChange(updateGrinderSettings(grinder, field, e.target.value));

  return (
    <details className='border-base-content/10 border-t pt-3' open={hasValues}>
      <summary className='cursor-pointer text-sm font-medium'>
        <Trans>Advanced grinder settings</Trans>
      </summary>
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
            min='0'
            step='any'
          />
        </div>
        <div className='form-control'>
          <label htmlFor='grinderRpm' className='mb-2 block text-sm font-medium'>
            <Trans>RPM</Trans>
          </label>
          <input
            id='grinderRpm'
            name='grinderRpm'
            type='number'
            className='input input-bordered w-full'
            value={grinder?.rpm ?? ''}
            onChange={onFieldChange('rpm')}
            min='0'
            step='1'
          />
        </div>
        <div className='form-control'>
          <label htmlFor='grinderFeedRpm' className='mb-2 block text-sm font-medium'>
            <Trans>Feed RPM</Trans>
          </label>
          <input
            id='grinderFeedRpm'
            name='grinderFeedRpm'
            type='number'
            className='input input-bordered w-full'
            value={grinder?.feedRpm ?? ''}
            onChange={onFieldChange('feedRpm')}
            min='0'
            step='1'
          />
        </div>
      </div>
    </details>
  );
}
