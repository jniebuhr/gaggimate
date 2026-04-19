import { useLocation } from 'preact-iso';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHome } from '@fortawesome/free-solid-svg-icons/faHome';
import { faList } from '@fortawesome/free-solid-svg-icons/faList';
import { faLeaf } from '@fortawesome/free-solid-svg-icons/faLeaf';
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
    id: 'control',
    items: [
      { label: 'Dashboard', link: '/', icon: faHome },
      { label: 'PID Autotune', link: '/pidtune', icon: faTemperatureHalf },
      { label: 'Bluetooth Devices', link: '/scales', icon: faBluetoothB },
      { label: 'Settings', link: '/settings', icon: faCog },
    ],
  },
  {
    id: 'review',
    showDivider: true,
    items: [
      { label: 'Profiles', link: '/profiles', icon: faList },
      { label: 'Beans', link: '/beans', icon: faLeaf },
      { label: 'Shot History', link: '/history', icon: faTimeline },
      { label: 'Shot Analyzer', link: '/analyzer', icon: faMagnifyingGlassChart, isNew: true },
      { label: 'Statistics', link: '/statistics', icon: faChartSimple, isNew: true },
      { label: 'System & Updates', link: '/ota', icon: faRotate },
    ],
  },
];

function MenuItem({ collapsed = false, icon, isNew = false, label, link }) {
  const { path } = useLocation();
  const isActive = path === link;
  const baseClassName = collapsed
    ? 'btn btn-square btn-md h-11 min-h-0 w-10 min-w-0 rounded-xl border-none bg-transparent px-0 text-base-content hover:bg-base-content/10 hover:text-base-content'
    : 'btn btn-sm h-10 justify-start gap-3 w-full rounded-xl border border-transparent bg-transparent px-3 text-base-content/78 hover:border-base-content/12 hover:bg-base-content/6 hover:text-base-content focus-visible:border-primary/30 focus-visible:bg-primary/10 focus-visible:text-base-content focus-visible:outline-none';
  const activeClassName = collapsed
    ? 'btn btn-square btn-md h-11 min-h-0 w-10 min-w-0 rounded-xl border-none bg-primary px-0 text-primary-content hover:bg-primary hover:text-primary-content'
    : 'btn btn-sm h-10 justify-start gap-3 w-full rounded-xl border border-primary/20 bg-primary/88 px-3 text-primary-content hover:bg-primary hover:text-primary-content shadow-[0_12px_24px_-16px_rgba(0,0,0,0.9)] focus-visible:outline-none';
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
      {!collapsed ? (
        <div className='indicator'>
          {isNew ? <span className='indicator-item text-success pl-8 text-xs font-bold'>NEW</span> : null}
          <span>{label}</span>
        </div>
      ) : null}
    </a>
  );
}

export function Navigation({ collapsed = false, onToggleCollapsed = () => {} }) {
  return (
    <nav className='hidden lg:block lg:sticky lg:top-28'>
      <div className={collapsed ? 'w-10' : 'w-full'}>
        <div className='max-h-[calc(100vh-8rem)] overflow-y-auto rounded-2xl border border-base-300/65 bg-base-100/90 p-4 shadow-[0_26px_60px_-44px_rgba(0,0,0,0.9)] backdrop-blur-xl'>
          {NAVIGATION_SECTIONS.map(section => (
            <div key={section.id}>
              {section.showDivider ? <hr className='h-5 border-0' /> : null}
              <div className='space-y-2'>
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
      </div>
    </nav>
  );
}