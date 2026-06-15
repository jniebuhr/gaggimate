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
import { useCallback, useEffect, useMemo, useRef } from 'preact/hooks';

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
      {!collapsed && (
        <div
          className='fixed end-0 top-0 bottom-0 left-0 z-9998 cursor-pointer backdrop-blur-sm backdrop-brightness-50 md:hidden'
          onClick={onToggleCollapsed}
        ></div>
      )}
      <aside
        className={`sidebar border-base-300 bg-base-100 fixed top-0 left-0 z-9999 flex h-screen flex-col overflow-y-auto border-r p-5 md:static landscape:static ${
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
                <svg
                  width='100%'
                  height='100%'
                  viewBox='0 0 70 9'
                  version='1.1'
                  xmlns='http://www.w3.org/2000/svg'
                  style='fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2;'
                  className='mt-1'
                >
                  <g id='Artboard1' transform='matrix(1,0,0,1.01131,0,5.55112e-16)'>
                    <rect x='0' y='-0' width='70' height='8.227' style='fill:none;' />
                    <clipPath id='_clip1'>
                      <rect x='0' y='-0' width='70' height='8.227' />
                    </clipPath>
                    <g clip-path='url(#_clip1)'>
                      <g
                        id='text1815'
                        transform='matrix(1.08569,0,0,1.07354,-0.0469993,-0.00935695)'
                      >
                        <g id='Layer-1'>
                          <g id='text18151'>
                            <path
                              id='path825'
                              d='M3.991,7.623C3.419,7.623 2.894,7.532 2.414,7.348C1.934,7.158 1.518,6.893 1.165,6.554C0.812,6.209 0.537,5.806 0.34,5.348C0.142,4.889 0.043,4.385 0.043,3.834C0.043,3.284 0.142,2.78 0.34,2.321C0.537,1.862 0.812,1.464 1.165,1.125C1.525,0.779 1.945,0.515 2.425,0.331C2.904,0.141 3.433,0.046 4.012,0.046C4.598,0.046 5.134,0.141 5.621,0.331C6.108,0.522 6.52,0.808 6.859,1.189L6.203,1.845C5.899,1.548 5.568,1.333 5.208,1.199C4.855,1.058 4.471,0.988 4.054,0.988C3.631,0.988 3.236,1.058 2.869,1.199C2.509,1.34 2.195,1.538 1.927,1.792C1.666,2.046 1.461,2.349 1.313,2.702C1.172,3.048 1.102,3.425 1.102,3.834C1.102,4.237 1.172,4.614 1.313,4.967C1.461,5.313 1.666,5.616 1.927,5.877C2.195,6.131 2.509,6.329 2.869,6.47C3.229,6.611 3.62,6.681 4.044,6.681C4.439,6.681 4.816,6.621 5.176,6.501C5.543,6.374 5.882,6.166 6.192,5.877L6.795,6.681C6.429,6.992 5.998,7.228 5.504,7.39C5.017,7.546 4.513,7.623 3.991,7.623ZM5.779,6.544L5.779,3.792L6.795,3.792L6.795,6.681L5.779,6.544Z'
                              style='fill-rule:nonzero; fill: currentColor;'
                            />
                            <path
                              id='path827'
                              d='M7.69,7.539L11.044,0.13L12.092,0.13L15.458,7.539L14.346,7.539L11.351,0.723L11.775,0.723L8.78,7.539L7.69,7.539ZM9.118,5.687L9.404,4.84L13.574,4.84L13.881,5.687L9.118,5.687Z'
                              style='fill-rule:nonzero;  fill: currentColor;'
                            />
                            <path
                              id='path829'
                              d='M19.804,7.623C19.232,7.623 18.707,7.532 18.227,7.348C17.747,7.158 17.331,6.893 16.978,6.554C16.625,6.209 16.35,5.806 16.153,5.348C15.955,4.889 15.856,4.385 15.856,3.834C15.856,3.284 15.955,2.78 16.153,2.321C16.35,1.862 16.625,1.464 16.978,1.125C17.338,0.779 17.758,0.515 18.237,0.331C18.717,0.141 19.246,0.046 19.825,0.046C20.411,0.046 20.947,0.141 21.434,0.331C21.92,0.522 22.333,0.808 22.672,1.189L22.016,1.845C21.712,1.548 21.381,1.333 21.021,1.199C20.668,1.058 20.284,0.988 19.867,0.988C19.444,0.988 19.049,1.058 18.682,1.199C18.322,1.34 18.008,1.538 17.74,1.792C17.479,2.046 17.274,2.349 17.126,2.702C16.985,3.048 16.915,3.425 16.915,3.834C16.915,4.237 16.985,4.614 17.126,4.967C17.274,5.313 17.479,5.616 17.74,5.877C18.008,6.131 18.322,6.329 18.682,6.47C19.042,6.611 19.433,6.681 19.857,6.681C20.252,6.681 20.629,6.621 20.989,6.501C21.356,6.374 21.695,6.166 22.005,5.877L22.608,6.681C22.241,6.992 21.811,7.228 21.317,7.39C20.83,7.546 20.326,7.623 19.804,7.623ZM21.592,6.544L21.592,3.792L22.608,3.792L22.608,6.681L21.592,6.544Z'
                              style='fill-rule:nonzero;  fill: currentColor;'
                            />
                            <path
                              id='path831'
                              d='M27.969,7.623C27.397,7.623 26.872,7.532 26.392,7.348C25.912,7.158 25.496,6.893 25.143,6.554C24.79,6.209 24.515,5.806 24.317,5.348C24.12,4.889 24.021,4.385 24.021,3.834C24.021,3.284 24.12,2.78 24.317,2.321C24.515,1.862 24.79,1.464 25.143,1.125C25.503,0.779 25.923,0.515 26.402,0.331C26.882,0.141 27.411,0.046 27.99,0.046C28.575,0.046 29.112,0.141 29.598,0.331C30.085,0.522 30.498,0.808 30.837,1.189L30.181,1.845C29.877,1.548 29.546,1.333 29.186,1.199C28.833,1.058 28.448,0.988 28.032,0.988C27.609,0.988 27.214,1.058 26.847,1.199C26.487,1.34 26.173,1.538 25.905,1.792C25.644,2.046 25.439,2.349 25.291,2.702C25.15,3.048 25.079,3.425 25.079,3.834C25.079,4.237 25.15,4.614 25.291,4.967C25.439,5.313 25.644,5.616 25.905,5.877C26.173,6.131 26.487,6.329 26.847,6.47C27.207,6.611 27.598,6.681 28.022,6.681C28.417,6.681 28.794,6.621 29.154,6.501C29.521,6.374 29.86,6.166 30.17,5.877L30.773,6.681C30.406,6.992 29.976,7.228 29.482,7.39C28.995,7.546 28.491,7.623 27.969,7.623ZM29.757,6.544L29.757,3.792L30.773,3.792L30.773,6.681L29.757,6.544Z'
                              style='fill-rule:nonzero;  fill: currentColor;'
                            />
                            <rect
                              id='path833'
                              x='32.789'
                              y='0.13'
                              width='1.058'
                              height='7.408'
                              style='fill-rule:nonzero;  fill: currentColor;'
                            />
                            <path
                              id='path835'
                              d='M36.256,7.539L36.256,0.13L36.711,0.13L40.15,6.068L39.907,6.068L43.336,0.13L43.78,0.13L43.791,7.539L43.262,7.539L43.251,0.945L43.399,0.945L40.15,6.554L39.886,6.554L36.626,0.945L36.785,0.945L36.785,7.539L36.256,7.539Z'
                              style='fill-rule:nonzero;  fill: currentColor;'
                            />
                            <path
                              id='path837'
                              d='M45.125,7.539L48.533,0.13L49.073,0.13L52.481,7.539L51.899,7.539L48.681,0.469L48.914,0.469L45.707,7.539L45.125,7.539ZM46.374,5.454L46.554,4.999L50.988,4.999L51.168,5.454L46.374,5.454Z'
                              style='fill-rule:nonzero;  fill: currentColor;'
                            />
                            <path
                              id='path839'
                              d='M54.872,7.539L54.872,0.617L52.205,0.617L52.205,0.13L58.078,0.13L58.078,0.617L55.411,0.617L55.411,7.539L54.872,7.539Z'
                              style='fill-rule:nonzero;  fill: currentColor;'
                            />
                            <path
                              id='path841'
                              d='M59.883,3.538L63.894,3.538L63.894,4.014L59.883,4.014L59.883,3.538ZM59.946,7.052L64.518,7.052L64.518,7.539L59.407,7.539L59.407,0.13L64.36,0.13L64.36,0.617L59.946,0.617L59.946,7.052Z'
                              style='fill-rule:nonzero;  fill: currentColor;'
                            />
                          </g>
                        </g>
                      </g>
                    </g>
                  </g>
                </svg>
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
