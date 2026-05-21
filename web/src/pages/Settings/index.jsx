import { useEffect, useState } from 'preact/hooks';
import Card from '../../components/Card.jsx';
import { DASHBOARD_LAYOUTS, getDashboardLayout, setDashboardLayout } from '../../utils/dashboardManager.js';
import { getStoredTheme, handleThemeChange } from '../../utils/themeManager.js';

const DISABLED_MACHINE_SETTINGS = [
  'PID tuning values',
  'Temperature targets and offsets',
  'Pump and pressure calibration',
  'Steam pump assist',
  'Relay / SSR function mapping',
  'Brew, steam, water, and grinder button behaviour',
  'Wi-Fi credential changes',
  'Plugin management',
  'Save and restart controls',
];

export function Settings() {
  const [currentTheme, setCurrentTheme] = useState('light');
  const [layout, setLayout] = useState(DASHBOARD_LAYOUTS.ORDER_FIRST);

  useEffect(() => {
    setCurrentTheme(getStoredTheme());
    setLayout(getDashboardLayout());
  }, []);

  const onThemeChange = event => {
    setCurrentTheme(event.target.value);
    handleThemeChange(event);
  };

  const onLayoutChange = event => {
    setLayout(event.target.value);
    setDashboardLayout(event.target.value);
  };

  return (
    <>
      <div className='mb-4 flex flex-row items-center gap-2'>
        <h2 className='flex-grow text-2xl font-bold sm:text-3xl'>Settings</h2>
      </div>

      <div className='grid grid-cols-1 gap-4 lg:grid-cols-10'>
        <Card sm={10} lg={5} title='GaggiGo Settings'>
          <div className='space-y-3 text-sm leading-relaxed'>
            <p>
              GaggiGo settings are limited to safe frontend preferences for viewing profiles,
              history, statistics, and analysis.
            </p>
            <div className='alert alert-info shadow-sm'>
              <span>
                Machine configuration is intentionally not editable from this frontend.
              </span>
            </div>
          </div>
        </Card>

        <Card sm={10} lg={5} title='Local UI Preferences'>
          <div className='form-control mb-4'>
            <label htmlFor='webui-theme' className='label'>
              <span className='label-text font-medium'>Theme</span>
            </label>
            <select
              id='webui-theme'
              name='webui-theme'
              className='select select-bordered w-full'
              value={currentTheme}
              onChange={onThemeChange}
            >
              <option value='light'>Light</option>
              <option value='dark'>Dark</option>
              <option value='coffee'>Coffee</option>
              <option value='nord'>Nord</option>
            </select>
          </div>

          <div className='form-control'>
            <label htmlFor='dashboardLayout' className='label'>
              <span className='label-text font-medium'>Dashboard Layout</span>
            </label>
            <select
              id='dashboardLayout'
              name='dashboardLayout'
              className='select select-bordered w-full'
              value={layout}
              onChange={onLayoutChange}
            >
              <option value={DASHBOARD_LAYOUTS.ORDER_FIRST}>Summary First</option>
              <option value={DASHBOARD_LAYOUTS.ORDER_LAST}>Chart First</option>
            </select>
          </div>
        </Card>

        <Card sm={10} lg={5} title='Safe Data Scope'>
          <div className='space-y-3 text-sm leading-relaxed'>
            <p>Allowed MVP areas:</p>
            <ul className='list-disc space-y-1 pl-5'>
              <li>Profile viewing</li>
              <li>Shot history viewing</li>
              <li>Statistics viewing</li>
              <li>Shot analysis viewing</li>
              <li>Local cache and offline review</li>
              <li>Safe sync later</li>
            </ul>
          </div>
        </Card>

        <Card sm={10} lg={5} title='Disabled Machine Settings'>
          <div className='space-y-3 text-sm leading-relaxed'>
            <p>
              These inherited GaggiMate settings are out of scope for GaggiGo and are not exposed.
            </p>
            <ul className='list-disc space-y-1 pl-5'>
              {DISABLED_MACHINE_SETTINGS.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </Card>

        <Card sm={10} title='Boundary'>
          <div className='alert alert-warning shadow-sm'>
            <span>
              GaggiMate controls the machine. GaggiGo observes, stores, analyses, and syncs safe data.
            </span>
          </div>
        </Card>
      </div>
    </>
  );
}
