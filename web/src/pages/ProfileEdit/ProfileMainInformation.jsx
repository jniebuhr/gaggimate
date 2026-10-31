import Card from '../../components/Card.jsx';
import { isSystemProfile } from '../../utils/systemProfiles.js';
import { ProfileImageUpload } from './ProfileImageUpload.jsx';
import { Trans, useLingui } from '@lingui/react/macro';

export function ProfileMainInformation(props) {
  const { t } = useLingui();
  console.log(props.data);
  return (
    <Card sm={10} title={t`Profile Information`}>
      <div className='form-control'>
        <label htmlFor='label' className='mb-2 block text-sm font-medium'>
          <Trans>Title</Trans>
        </label>
        <input
          id='label'
          name='label'
          className='input input-bordered w-full'
          value={props.data?.label}
          onChange={props.onChangeLabel}
          aria-label={t`Enter a name for this profile`}
          required
        />
      </div>
      <div className='form-control'>
        <label htmlFor='description' className='mb-2 block text-sm font-medium'>
          <Trans>Description</Trans>
        </label>
        <textarea
          id='description'
          name='description'
          rows={2}
          className='textarea textarea-bordered w-full text-wrap'
          value={props.data?.description}
          onChange={props.onChangeDescription}
          aria-label={t`Optional description for this profile`}
        />
      </div>
      <div className='form-control'>
        <label htmlFor='temperature' className='mb-2 block text-sm font-medium'>
          <Trans>Temperature</Trans>
        </label>
        <div className='input-group'>
          <label htmlFor='temperature' className='input w-full'>
            <input
              id='temperature'
              name='temperature'
              type='number'
              className='grow'
              value={props.data?.temperature}
              onChange={props.onChangeTemperature}
              aria-label={t`Temperature in degrees Celsius`}
              min='0'
              max='150'
              step='0.1'
            />
            <span aria-label={t`degrees Celsius`}>°C</span>
          </label>
        </div>
      </div>
      <div className='form-control'>
        <label htmlFor='dose' className='mb-2 block text-sm font-medium'>
          <Trans>Dose</Trans>
        </label>
        <div className='input-group'>
          <label htmlFor='dose' className='input w-full'>
            <input
              id='dose'
              name='dose'
              type='number'
              className='grow'
              value={props.data?.dose}
              onChange={props.onChangeDose}
              aria-label={t`Dose in g`}
              min='0'
              max='100'
              step='0.1'
            />
            <span aria-label={t`grams`}>g</span>
          </label>
        </div>
      </div>
      <div className='form-control'>
        <label
          htmlFor='utility'
          className='mb-2 block text-sm font-medium'
          aria-label={t`Utility profile toggle`}
        >
          <Trans>Utility profile</Trans>
        </label>
        <input
          id='utility'
          name='utility'
          type='checkbox'
          className='toggle toggle-primary'
          checked={!!props.data?.utility || isSystemProfile(props.data?.id)}
          disabled={isSystemProfile(props.data?.id)}
          onChange={props.onChangeUtility}
        />
      </div>
      <ProfileImageUpload profileId={props.data?.id} />
    </Card>
  );
}
