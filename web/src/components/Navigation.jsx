import { useEffect, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHome } from '@fortawesome/free-solid-svg-icons/faHome';
import { faTemperatureHalf } from '@fortawesome/free-solid-svg-icons/faTemperatureHalf';
import { faBluetoothB } from '@fortawesome/free-brands-svg-icons/faBluetoothB';
import { faCog } from '@fortawesome/free-solid-svg-icons/faCog';
import { faList } from '@fortawesome/free-solid-svg-icons/faList';
import { faLeaf } from '@fortawesome/free-solid-svg-icons/faLeaf';
import { faTimeline } from '@fortawesome/free-solid-svg-icons/faTimeline';
import { faRotate } from '@fortawesome/free-solid-svg-icons/faRotate';
import { faMagnifyingGlassChart } from '@fortawesome/free-solid-svg-icons/faMagnifyingGlassChart';
import { faChartSimple } from '@fortawesome/free-solid-svg-icons/faChartSimple';

const STORAGE_KEY = 'gaggimate.desktopNavCollapsed';

const readCollapsed = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    // Default to true (collapsed) if nothing stored yet
    return stored === null ? true : stored === 'true';
  } catch {
    return true;
  }
};

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
  const sharedClassName =
    'btn btn-sm relative h-10 w-full rounded-xl border transition-[gap,padding] duration-300 ease-in-out lg:justify-center lg:gap-0 lg:px-0 lg:group-hover:justify-start lg:group-hover:gap-3 lg:group-hover:px-3';
  const baseClassName = `${sharedClassName} border-transparent bg-transparent text-base-content/78 hover:border-base-content/12 hover:bg-base-content/6 hover:text-base-content focus-visible:border-primary/30 focus-visible:bg-primary/10 focus-visible:text-base-content focus-visible:outline-none`;
  const activeClassName = `${sharedClassName} border border-primary/20 bg-primary/88 text-primary-content shadow-[0_12px_24px_-16px_rgba(0,0,0,0.9)] hover:bg-primary hover:text-primary-content focus-visible:outline-none`;
  const className = isActive ? activeClassName : baseClassName;
  const iconSize = collapsed ? 'lg' : undefined;

  return (
    <a
      href={link}
      className={className}
      aria-current={isActive ? 'page' : undefined}
      title={label}
    >
      <FontAwesomeIcon icon={icon} size={iconSize} />
      <span className='nav-text flex max-w-0 items-center gap-2 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity] duration-200 ease-in-out lg:group-hover:max-w-[10rem] lg:group-hover:opacity-100'>
        <span className='truncate'>{label}</span>
        {isNew && <span className='text-success text-[0.65rem] font-bold shrink-0'>NEW</span>}
      </span>
    </a>
  );
}

export function Navigation({ onCollapsedChange } = {}) {
  const [collapsed, setCollapsed] = useState(readCollapsed);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {}
    onCollapsedChange?.(collapsed);
  }, [collapsed]);

  return (
    <nav
      className='nav-sidebar hidden lg:block lg:sticky lg:top-28 group'
      onMouseEnter={() => setCollapsed(false)}
      onMouseLeave={() => setCollapsed(true)}
    >
      <div className={`transition-[width] duration-300 ease-in-out ${collapsed ? 'w-14' : 'w-[14rem]'}`}>
        <div className='max-h-[calc(100vh-8rem)] overflow-y-auto rounded-2xl border border-base-300/65 bg-base-100/90 p-4 shadow-[0_26px_60px_-44px_rgba(0,0,0,0.9)] backdrop-blur-xl'>
          {NAVIGATION_SECTIONS.map(section => (
            <div key={section.id}>
              {section.showDivider && <div className='h-3' />}
              <div className='space-y-2'>
                {section.items.map(item => (
                  <MenuItem key={item.link} collapsed={collapsed} {...item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </nav>
  );
}
