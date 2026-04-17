import Card from '../../components/Card.jsx';

export function ProfileMainInformation(props) {
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
          value={props.data?.label}
          onChange={props.onChangeLabel}
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
          value={props.data?.description}
          onChange={props.onChangeDescription}
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
              value={props.data?.temperature}
              onChange={props.onChangeTemperature}
              aria-label='Temperature in degrees Celsius'
              min='0'
              max='150'
              step='0.1'
            />
            <span aria-label='degrees Celsius'>°C</span>
          </label>
        </div>
      </div>
      <div className='form-control'>
        <label className='mb-2 block text-sm font-medium'>
          Type
        </label>
        <input
          id='utility'
          name='utility'
          type='checkbox'
          className='toggle border-primary checked:border-primary text-primary checked:text-primary'
          checked={!!props.data?.utility}
          onChange={props.onChangeUtility}
        />
        <label htmlFor='utility' className='ml-2'>
          {props.data?.utility ? 'Utility' : 'Extraction'}
        </label>
      </div>
    </Card>
  );
}

