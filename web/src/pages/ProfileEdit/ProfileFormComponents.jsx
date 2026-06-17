import Card from '../../components/Card.jsx';
import { Spinner } from '../../components/Spinner.jsx';

export function ProfileInfoFields({ data, onFieldChange }) {
  return (
    <Card sm={10} title='Profile Information'>
      <div className='form-control'>
        <label htmlFor='label' className='mb-2 block text-sm font-medium'>
          Title
        </label>
        <input
          id='label'
          name='label'
          className='input input-bordered w-full'
          value={data?.label}
          onChange={e => onFieldChange('label', e.target.value)}
          aria-label='Enter a name for this profile'
          required
        />
      </div>
      <div className='form-control'>
        <label htmlFor='description' className='mb-2 block text-sm font-medium'>
          Description
        </label>
        <input
          id='description'
          name='description'
          className='input input-bordered w-full'
          value={data?.description}
          onChange={e => onFieldChange('description', e.target.value)}
          aria-label='Optional description for this profile'
        />
      </div>
      <div className='form-control'>
        <label htmlFor='temperature' className='mb-2 block text-sm font-medium'>
          Temperature
        </label>
        <div className='input-group'>
          <label htmlFor='temperature' className='input w-full'>
            <input
              id='temperature'
              name='temperature'
              type='number'
              className='grow'
              value={data?.temperature}
              onChange={e => onFieldChange('temperature', e.target.value)}
              aria-label='Temperature in degrees Celsius'
              min='0'
              max='150'
              step='0.1'
            />
            <span aria-label='degrees Celsius'>°C</span>
          </label>
        </div>
      </div>
    </Card>
  );
}

export function ProfileFormFooter({ saving, isNew }) {
  const getAriaLabel = () => {
    if (saving) {
      return isNew ? 'Creating profile...' : 'Saving profile...';
    }
    return isNew ? 'Create profile' : 'Save profile';
  };

  return (
    <div className='sticky bottom-0 z-40 border-t border-base-content/10 bg-base-300/95 backdrop-blur-md pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] mt-6'>
      <div className='flex flex-col sm:flex-row sm:items-center sm:justify-start gap-2 sm:gap-4'>
        <div className='flex items-center gap-2 w-full sm:w-auto'>
          <button
            type='submit'
            className='btn btn-primary btn-sm flex-1 sm:flex-none'
            disabled={saving}
            aria-label={getAriaLabel()}
          >
            {saving && <Spinner size={4} className='mr-2' />}
            {isNew ? 'Create' : 'Save'}
          </button>
          <a href='/profiles' className='btn btn-ghost btn-sm flex-1 sm:flex-none'>
            Cancel
          </a>
        </div>
      </div>
    </div>
  );
}
