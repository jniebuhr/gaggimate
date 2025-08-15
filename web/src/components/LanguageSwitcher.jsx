import { setLocale, currentLocale } from '../utils/i18n.js';

export function LanguageSwitcher() {
  const handleLanguageChange = async (event) => {
    const newLocale = event.target.value;
    await setLocale(newLocale);
    localStorage.setItem('locale', newLocale);
    // No need to reload the page since we're using signals
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="language-select" className="text-sm font-medium">
        Language:
      </label>
      <select
        id="language-select"
        value={currentLocale.value}
        onChange={handleLanguageChange}
        className="select select-bordered select-sm"
      >
        <option value="en">English</option>
        <option value="cs">Čeština</option>
        <option value="de">Deutsch</option>
      </select>
    </div>
  );
}
