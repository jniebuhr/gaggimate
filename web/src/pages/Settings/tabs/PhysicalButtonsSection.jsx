import { Trans, useLingui } from '@lingui/react/macro';
import Section from '../../../components/Card.jsx';
import { SettingsFormField, ToggleField } from '../../../components/SettingsFormField.jsx';

function ButtonBehaviorSelect({ id, label, value, onChange, profiles }) {
  const { t } = useLingui();
  return (
    <SettingsFormField label={label} htmlFor={id} noMargin>
      <select
        id={id}
        name={id}
        className='select select-bordered w-full'
        value={value}
        onChange={onChange}
      >
        <option value='none'>{t({ message: 'None', context: 'button behavior' })}</option>
        <option value='brew'>{t`Brew button`}</option>
        <option value='steam'>{t`Steam button`}</option>
        <option value='water'>{t`Water button`}</option>
        <option value='flush'>{t({ message: 'Flush', context: 'button behavior' })}</option>
        {profiles.map(p => (
          <ProfileOption key={p.id} profile={p} />
        ))}
      </select>
    </SettingsFormField>
  );
}

function ProfileOption({ profile }) {
  const { t } = useLingui();
  const profileLabel = profile.label;
  return <option value={profile.id}>{t`Profile: ${profileLabel}`}</option>;
}

export function PhysicalButtonsSection({ formData, onChange, profiles = [] }) {
  const { t } = useLingui();
  return (
    <Section title={t`Physical Buttons`}>
      <p className='text-base-content/85 mb-4 text-sm opacity-70'>
        <Trans>
          Define behavior for physical buttons when pressed. Make sure they are wired to the buttons
          header. Pressing the brew and steam buttons together (or a third button wired to both)
          triggers the water button behavior.
        </Trans>
      </p>
      <fieldset className='mb-4' disabled={!!formData.machineProfileSelection}>
        <ToggleField
          label={t`Momentary Buttons`}
          htmlFor='momentaryButtons'
          checked={!!formData.momentaryButtons}
          onChange={onChange('momentaryButtons')}
        />
      </fieldset>
      <p className='text-base-content/85 mb-4 text-sm opacity-70'>
        <Trans>
          Activate this if your coffee machine is equipped with momentary buttons. A momentary
          button set to Brew or a profile starts a flush instead when held.
        </Trans>
      </p>
      <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
        <ButtonBehaviorSelect
          id='button0'
          label={t`Brew Button Behavior`}
          value={formData.button0}
          onChange={onChange('button0')}
          profiles={profiles}
        />
        <ButtonBehaviorSelect
          id='button1'
          label={t`Steam Button Behavior`}
          value={formData.button1}
          onChange={onChange('button1')}
          profiles={profiles}
        />
        <ButtonBehaviorSelect
          id='button2'
          label={t`Water Button Behavior`}
          value={formData.button2}
          onChange={onChange('button2')}
          profiles={profiles}
        />
      </div>
    </Section>
  );
}
