import { useLocation } from 'preact-iso';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHome } from '@fortawesome/free-solid-svg-icons/faHome';
import { faList } from '@fortawesome/free-solid-svg-icons/faList';
import { faTimeline } from '@fortawesome/free-solid-svg-icons/faTimeline';
import { faTemperatureHalf } from '@fortawesome/free-solid-svg-icons/faTemperatureHalf';
import { faBluetoothB } from '@fortawesome/free-brands-svg-icons/faBluetoothB';
import { faCog } from '@fortawesome/free-solid-svg-icons/faCog';
import { faRotate } from '@fortawesome/free-solid-svg-icons/faRotate';
import { faMagnifyingGlassChart } from '@fortawesome/free-solid-svg-icons/faMagnifyingGlassChart';
import { faChartSimple } from '@fortawesome/free-solid-svg-icons/faChartSimple';
import { faCircleChevronLeft } from '@fortawesome/free-solid-svg-icons/faCircleChevronLeft';
import { faCircleChevronRight } from '@fortawesome/free-solid-svg-icons/faCircleChevronRight';

const NAVIGATION_SECTIONS = [
  {
    id: 'dashboard',
    items: [{ label: 'Dashboard', link: '/', icon: faHome }],
  },
  {
    id: 'analysis',
    showDivider: true,
    items: [
      { label: 'Profiles', link: '/profiles', icon: faList },
      { label: 'Shot History', link: '/history', icon: faTimeline },
      { label: 'Shot Analyzer', link: '/analyzer', icon: faMagnifyingGlassChart, isNew: true },
      { label: 'Statistics', link: '/statistics', icon: faChartSimple, isNew: true },
    ],
  },
  {
    id: 'devices',
    showDivider: true,
    items: [
      { label: 'PID Autotune', link: '/pidtune', icon: faTemperatureHalf },
      { label: 'Bluetooth Devices', link: '/scales', icon: faBluetoothB },
      { label: 'Settings', link: '/settings', icon: faCog },
    ],
  },
  {
    id: 'updates',
    showDivider: true,
    items: [{ label: 'System & Updates', link: '/ota', icon: faRotate }],
  },
];

function MenuItem({ collapsed = false, icon, isNew = false, label, link }) {
  const { path } = useLocation();
  const isActive = path === link;
  const isExpanded = collapsed === false;
  const baseClassName = collapsed
    ? 'btn btn-square btn-md h-11 min-h-0 w-10 min-w-0 rounded-xl border-none bg-transparent px-0 text-base-content hover:bg-base-content/10 hover:text-base-content'
    : 'btn btn-md justify-start gap-3 w-full text-base-content hover:text-base-content hover:bg-base-content/10 bg-transparent border-none px-2';
  const activeClassName = collapsed
    ? 'btn btn-square btn-md h-11 min-h-0 w-10 min-w-0 rounded-xl border-none bg-primary px-0 text-primary-content hover:bg-primary hover:text-primary-content'
    : 'btn btn-md justify-start gap-3 w-full bg-primary text-primary-content hover:bg-primary hover:text-primary-content px-2';
  const className = isActive ? activeClassName : baseClassName;

  return (
    <a
      href={link}
      className={className}
      aria-label={collapsed ? label : undefined}
      aria-current={isActive ? 'page' : undefined}
      title={collapsed ? label : undefined}
    >
      <FontAwesomeIcon icon={icon} />
      {isExpanded ? (
        <div className='indicator'>
          {isNew ? <span className='indicator-item text-success pl-8 text-xs font-bold'>NEW</span> : null}
          <span>{label}</span>
        </div>
      ) : null}
    </a>
  );
}

export function Navigation({ collapsed = false, onToggleCollapsed }) {
  return (
    <nav className='hidden lg:block'>
      <div className={collapsed ? 'w-10' : 'w-full'}>
        {NAVIGATION_SECTIONS.map(section => (
          <div key={section.id}>
            {section.showDivider ? <hr className='h-5 border-0' /> : null}
            <div className='space-y-1.5'>
              {section.items.map(item => (
                <MenuItem key={item.link} collapsed={collapsed} {...item} />
              ))}
            </div>
          </div>
        ))}

        <div className={`mt-4 flex ${collapsed ? 'justify-start' : 'justify-end'}`}>
          <button
            type='button'
            onClick={onToggleCollapsed}
            className={
              collapsed
                ? 'btn btn-square btn-md h-11 min-h-0 w-10 min-w-0 rounded-xl border-none bg-transparent px-0 text-base-content hover:bg-base-content/10 hover:text-base-content'
                : 'btn btn-square btn-sm border-none bg-transparent text-base-content hover:bg-base-content/10 hover:text-base-content'
            }
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            <FontAwesomeIcon icon={collapsed ? faCircleChevronRight : faCircleChevronLeft} />
          </button>
        </div>
      </div>
    </nav>
  );
}
