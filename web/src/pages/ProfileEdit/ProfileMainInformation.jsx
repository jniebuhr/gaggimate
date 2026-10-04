import Card from '../../components/Card.jsx';
import {
  InputGroupField,
  SettingsFormField,
  ToggleField,
} from '../../components/SettingsFormField.jsx';

export function ProfileMainInformation(props) {
  console.log(props.data);
  return (
    <Card sm={10} title='Profile Information'>
      <SettingsFormField label='Title' htmlFor='label'>
        <input
          id='label'
          name='label'
          className='input input-bordered w-full'
          value={props.data?.label}
          onChange={props.onChangeLabel}
          aria-label='Enter a name for this profile'
          required
        />
      </SettingsFormField>
      <SettingsFormField label='Description' htmlFor='description'>
        <textarea
          id='description'
          name='description'
          rows={2}
          className='textarea textarea-bordered w-full text-wrap'
          value={props.data?.description}
          onChange={props.onChangeDescription}
          aria-label='Optional description for this profile'
        />
      </SettingsFormField>
      <InputGroupField
        label='Temperature'
        htmlFor='temperature'
        unit='°C'
        unitAriaLabel='degrees Celsius'
      >
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
      </InputGroupField>
      <ToggleField
        label='Utility profile'
        htmlFor='utility'
        checked={!!props.data?.utility}
        onChange={props.onChangeUtility}
      />
    </Card>
  );
}
