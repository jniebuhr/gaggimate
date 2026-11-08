import { useState } from 'preact/hooks';
import { useLingui } from '@lingui/react/macro';
import { SettingsFormField } from './SettingsFormField.jsx';
import { AUTO_LOCALE, LOCALES, getStoredLocale, setLocale } from '../i18n.js';

// UI language, stored per browser/phone; 'Automatic' follows the system language.
export function LanguageSelect() {
  const { t } = useLingui();
  const [value, setValue] = useState(getStoredLocale);

  return (
    <SettingsFormField label={t`Language`} htmlFor='ui-language' noMargin>
      <select
        id='ui-language'
        className='select select-bordered w-full'
        value={value}
        onChange={async e => {
          setValue(e.target.value);
          await setLocale(e.target.value);
          // Messages are resolved when components render, so reload to apply everywhere.
          window.location.reload();
        }}
      >
        <option value={AUTO_LOCALE}>{t`Automatic`}</option>
        {LOCALES.map(l => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </SettingsFormField>
  );
}
