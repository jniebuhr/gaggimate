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
import { prefetchSettings } from '../services/ApiService.js';
import { GmLogoIcon } from './GmLogoIcon.jsx';
import { faGithub } from '@fortawesome/free-brands-svg-icons/faGithub';
import { faDiscord } from '@fortawesome/free-brands-svg-icons/faDiscord';
import { useCallback, useEffect, useMemo, useRef } from 'preact/hooks';
import { Tooltip } from './Tooltip.jsx';

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
    id: 'main',
    showDivider: true,
    items: [
      { label: 'Dashboard', link: '/', icon: faHome },
      { label: 'Profiles', link: '/profiles', icon: faList },
      { label: 'Analysis', link: '/analysis', icon: faMagnifyingGlassChart },
      { label: 'Settings', link: '/settings', icon: faCog, onHover: prefetchSettings },
    ],
  },
];

function MenuItem({ collapsed = false, icon, isNew = false, label, link, onHover }) {
  const { path } = useLocation();
  const isActive = link === '/' ? path === '/' : path.startsWith(link);
  const isExpanded = collapsed === false;

  const baseClassName = 'btn btn-md h-12 w-full text-base-content hover:text-base-content hover:bg-base-content/10 bg-transparent border-none nav-btn-transition';
  const activeClassName = 'btn btn-md h-12 w-full bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary border-none nav-btn-transition';

  const className = `${isActive ? activeClassName : baseClassName} flex items-center overflow-hidden ${
    collapsed ? 'nav-btn-collapsed' : ''
  }`;

  const handleHover = () => {
    if (onHover) onHover();
  };

  return (
    <Tooltip
      content={label}
      placement='right'
      disabled={!collapsed}
      className='w-full'
    >
      <a
        href={link}
        className={className}
        aria-label={collapsed ? label : undefined}
        aria-current={isActive ? 'page' : undefined}
        onMouseEnter={handleHover}
        onTouchStart={handleHover}
      >
        <div className='flex items-center justify-center shrink-0 w-6 h-6'>
          <FontAwesomeIcon size='md' icon={icon} />
        </div>
        <span
          className={`sidebar-label ${
            collapsed ? 'sidebar-label-collapsed' : 'sidebar-label-expanded'
          }`}
        >
          {isNew ? (
            <span className='indicator-item text-success pr-2 text-xs font-bold'>NEW</span>
          ) : null}
          {label}
        </span>
      </a>
    </Tooltip>
  );
}

export function Navigation({ collapsed = false, onToggleCollapsed }) {
  // Compute the icon once per mount so the avatar doesn't reshuffle on every render.
  const randomIcon = useMemo(() => getRandomIcon(), []);
  const loc = useLocation();

  // Track the previous route so the collapse-on-navigation effect only fires
  // when the route actually changes, not when `collapsed` flips back to false
  // (which would close the menu immediately after the user opens it on mobile).
  const previousPathRef = useRef(loc.path);

  useEffect(() => {
    const pathChanged = previousPathRef.current !== loc.path;
    previousPathRef.current = loc.path;
    // Re-check viewport width INSIDE the effect (was captured once at module
    // init, so iPad orientation changes were ignored).
    const isMdDown = typeof window !== 'undefined' && window.innerWidth < 768;
    if (pathChanged && !collapsed && isMdDown) {
      onToggleCollapsed();
    }
  }, [loc.path, collapsed, onToggleCollapsed]);

  return (
    <>
      <div
        className={`fixed inset-0 z-[9998] cursor-pointer backdrop-blur-sm backdrop-brightness-50 md:hidden sidebar-backdrop-transition ${
          collapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        onClick={onToggleCollapsed}
        aria-hidden="true"
      ></div>
      <aside
        className={`sidebar fixed top-0 left-0 z-[9999] flex h-screen flex-col overflow-hidden border-r border-base-content/10 bg-base-100 md:static landscape:static sidebar-transition ${
          collapsed ? '-translate-x-full w-[280px] md:translate-x-0 md:w-[80px] landscape:translate-x-0 landscape:w-[80px] sidebar-collapsed' : 'translate-x-0 w-[280px]'
        }`}
      >
        <div className='flex h-full flex-col w-full'>
          <div className='w-full'>
            <div
              className={`align-center flex h-12 flex-row items-center gap-2 overflow-hidden nav-btn-transition w-full ${
                collapsed ? 'nav-btn-collapsed' : ''
              }`}
            >
              <div className='shrink-0 flex items-center justify-center w-6 h-6'>
                <GmLogoIcon width={24} height={24} />
              </div>
              <img
                src='/logo.svg'
                alt='GaggiMate'
                className={`sidebar-logo-img ${
                  collapsed ? 'sidebar-logo-collapsed' : 'sidebar-logo-expanded'
                }`}
              />
            </div>
          </div>
          {NAVIGATION_SECTIONS.map(section => (
            <div key={section.id} className='w-full'>
              {section.showDivider ? <hr className='h-5 border-0' /> : null}
              <div className='space-y-1 w-full'>
                {section.items.map(item => (
                  <MenuItem key={item.link} collapsed={collapsed} {...item} />
                ))}
              </div>
            </div>
          ))}

          <div className='flex-grow'>&nbsp;</div>

          {/* Social icons and footer elements are always mounted, but transition opacity, scale, and height to prevent unmount reflow */}
          <div
            className={`sidebar-footer overflow-hidden flex flex-col w-full ${
              collapsed ? 'sidebar-footer-collapsed' : 'sidebar-footer-expanded'
            }`}
          >
            <div className='flex flex-row items-center justify-center gap-2 whitespace-nowrap overflow-hidden'>
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
            <div className='my-4 text-center text-xs text-base-content/70 whitespace-nowrap overflow-hidden'>
              <span>Crafted with</span>
              <span className='mx-1'>{randomIcon}</span>
              <span>
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
          </div>

          <div className='w-full'>
            <Tooltip
              content={collapsed ? 'Expand navigation' : 'Collapse navigation'}
              placement='right'
              disabled={!collapsed}
              className='w-full'
            >
              <button
                type='button'
                onClick={onToggleCollapsed}
                className={`btn btn-md h-12 w-full text-base-content hover:text-base-content hover:bg-base-content/10 border-none bg-transparent nav-btn-transition flex items-center overflow-hidden ${
                  collapsed ? 'nav-btn-collapsed' : ''
                }`}
                aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
              >
                <div className={`flex items-center justify-center shrink-0 w-6 h-6 chevron-rotate-transition ${
                  collapsed ? 'rotate-180' : 'rotate-0'
                }`}>
                  <FontAwesomeIcon
                    size='md'
                    icon={faCircleChevronLeft}
                  />
                </div>
                <span className={`sidebar-label ${
                  collapsed 
                    ? 'sidebar-label-collapsed' 
                    : 'sidebar-label-expanded'
                }`}>
                  Collapse
                </span>
              </button>
            </Tooltip>
          </div>
        </div>
      </aside>
    </>
  );
}

