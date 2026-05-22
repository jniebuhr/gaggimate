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
import { GmLogoIcon } from '../pages/ShotAnalyzer/components/SourceMarker.jsx';
import { faGithub } from '@fortawesome/free-brands-svg-icons/faGithub';
import { faDiscord } from '@fortawesome/free-brands-svg-icons/faDiscord';
import { useCallback, useEffect } from 'preact/hooks';

// List of random icons to display - add your icons here (SVG strings, text, or emojis)
const RANDOM_ICONS = [
  '🍝',
  '🍕',
  '☕️',
  '🥐',
  '🤌',
  <svg
    key='heart'
    xmlns='http://www.w3.org/2000/svg'
    viewBox='0 0 20 20'
    fill='currentColor'
    aria-hidden='true'
    className='text-error size-4'
  >
    <path d='M9.653 16.915l-.005-.003-.019-.01a20.759 20.759 0 01-1.162-.682 22.045 22.045 0 01-2.582-1.9C4.045 12.733 2 10.352 2 7.5a4.5 4.5 0 018-2.828A4.5 4.5 0 0118 7.5c0 2.852-2.044 5.233-3.885 6.82a22.049 22.049 0 01-3.744 2.582l-.019.01-.005.003h-.002a.739.739 0 01-.69.001l-.002-.001z' />
  </svg>,
];

function getRandomIcon() {
  const randomIndex = Math.floor(Math.random() * RANDOM_ICONS.length);
  return RANDOM_ICONS[randomIndex];
}

const NAVIGATION_SECTIONS = [
  {
    id: 'dashboard',
    showDivider: true,
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
    ? 'btn btn-square btn-md h-12 min-h-0 w-12 min-w-0 rounded-xl border-none bg-transparent px-0 text-base-content hover:bg-base-content/10 hover:text-base-content'
    : 'btn btn-md justify-start h-12 gap-3 w-full text-base-content hover:text-base-content hover:bg-base-content/10 bg-transparent border-none px-2';
  const activeClassName = collapsed
    ? 'btn btn-square btn-md h-12 min-h-0 w-12 min-w-0 rounded-xl border-none bg-primary px-0 text-primary-content hover:bg-primary hover:text-primary-content'
    : 'btn btn-md justify-start h-12 gap-3 w-full bg-primary text-primary-content hover:bg-primary hover:text-primary-content px-2';
  const className = isActive ? activeClassName : baseClassName;

  return (
    <a
      href={link}
      className={className}
      aria-label={collapsed ? label : undefined}
      aria-current={isActive ? 'page' : undefined}
      title={collapsed ? label : undefined}
    >
      <FontAwesomeIcon size='md' icon={icon} />
      {isExpanded ? (
        <div className='indicator'>
          {isNew ? (
            <span className='indicator-item text-success pl-8 text-xs font-bold'>NEW</span>
          ) : null}
          <span>{label}</span>
        </div>
      ) : null}
    </a>
  );
}

export function Navigation({ collapsed = false, onToggleCollapsed }) {
  const randomIcon = getRandomIcon();
  const mdDown = window.innerWidth < 768;
  const loc = useLocation();

  useEffect(() => {
    if (!collapsed && mdDown) {
      onToggleCollapsed();
    }
  }, [loc.path]);

  return (
    <>
      {!collapsed && (
        <div
          className='fixed end-0 top-0 bottom-0 left-0 z-9998 cursor-pointer backdrop-blur-sm backdrop-brightness-50 md:hidden'
          onClick={onToggleCollapsed}
        ></div>
      )}
      <aside
        className={`sidebar fixed top-0 left-0 z-9999 flex h-screen flex-col overflow-y-auto border-r border-gray-200 bg-white p-5 md:static landscape:static dark:border-gray-800 dark:bg-black ${
          collapsed ? 'hidden md:flex md:w-[90px] landscape:flex landscape:w-[90px]' : 'w-[290px]'
        }`}
      >
        <div className='flex h-full flex-col'>
          <div>
            <div
              className={`align-center flex h-12 flex-row items-center justify-center gap-2 ${collapsed ? 'w-12' : 'w-full'}`}
            >
              <GmLogoIcon width={30} height={30} />
              {collapsed ? null : (
                <span className='text-base-content font-logo text-3xl font-light'>
                  <span className='font-semibold'>GAGGI</span>MATE
                </span>
              )}
            </div>
          </div>
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

          <div className='flex-grow'>&nbsp;</div>

          {!collapsed && (
            <>
              <div className='flex flex-row items-center justify-center gap-2'>
                <div className='relative inline-block'>
                  <a
                    aria-label='github'
                    rel='noopener noreferrer'
                    href='https://github.com/jniebuhr/gaggimate'
                    target='_blank'
                    className='btn btn-sm btn-circle text-base-content hover:text-base-content hover:bg-base-content/10 border-none bg-transparent'
                  >
                    <FontAwesomeIcon icon={faGithub} className='text-lg' />
                  </a>
                </div>

                <div className='relative inline-block'>
                  <a
                    aria-label='discord'
                    rel='noopener noreferrer'
                    href='https://discord.gaggimate.eu/'
                    target='_blank'
                    className='btn btn-sm btn-circle text-base-content hover:text-base-content hover:bg-base-content/10 border-none bg-transparent'
                  >
                    <FontAwesomeIcon icon={faDiscord} className='text-lg' />
                  </a>
                </div>
              </div>
              <div className='my-5 text-center'>
                <span>Crafted with</span>
                <span className='mx-1'>{randomIcon}</span>
                <span>
                  {' '}
                  in Italy by&nbsp;
                  <a
                    className='text-primary hover:text-primary/80 font-medium transition'
                    href='https://gaggimate.eu'
                    target='_blank'
                    rel='noreferrer'
                  >
                    Caffinnova S.r.l.
                  </a>
                </span>
              </div>
            </>
          )}

          <div>
            <button
              type='button'
              onClick={onToggleCollapsed}
              className={
                collapsed
                  ? 'btn btn-square btn-md text-base-content hover:bg-base-content/10 hover:text-base-content h-12 min-h-0 w-12 min-w-0 rounded-xl border-none bg-transparent px-0'
                  : 'btn btn-md text-base-content hover:text-base-content hover:bg-base-content/10 h-12 w-full justify-start gap-3 border-none bg-transparent px-2'
              }
              aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
              title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            >
              <FontAwesomeIcon
                size='md'
                icon={collapsed ? faCircleChevronRight : faCircleChevronLeft}
              />
              {!collapsed ? (
                <div className='indicator'>
                  <span>Collapse</span>
                </div>
              ) : null}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
