import { useCallback, useEffect, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faList } from '@fortawesome/free-solid-svg-icons/faList';
import { faLeaf } from '@fortawesome/free-solid-svg-icons/faLeaf';
import { faHome } from '@fortawesome/free-solid-svg-icons/faHome';
import { faTimeline } from '@fortawesome/free-solid-svg-icons/faTimeline';
import { faTemperatureHalf } from '@fortawesome/free-solid-svg-icons/faTemperatureHalf';
import { faBluetoothB } from '@fortawesome/free-brands-svg-icons/faBluetoothB';
import { faCog } from '@fortawesome/free-solid-svg-icons/faCog';
import { faRotate } from '@fortawesome/free-solid-svg-icons/faRotate';
import { faGithub } from '@fortawesome/free-brands-svg-icons/faGithub';
import { faDiscord } from '@fortawesome/free-brands-svg-icons/faDiscord';
import { faMagnifyingGlassChart } from '@fortawesome/free-solid-svg-icons/faMagnifyingGlassChart';
import { faChartSimple } from '@fortawesome/free-solid-svg-icons/faChartSimple';
import { machine } from '../services/ApiService.js';
import { getCurrentBeanSelection } from '../utils/beanManager.js';

const MODE_LABELS = ['Standby', 'Brew', 'Steam', 'Water', 'Grind'];

function HeaderItem(props) {
  const { path } = useLocation();
  let className =
    'btn btn-sm h-10 justify-start gap-3 w-full rounded-xl border border-transparent bg-transparent px-3 text-base-content/80 hover:border-base-content/10 hover:bg-base-content/5 hover:text-base-content focus-visible:border-primary/30 focus-visible:bg-primary/10 focus-visible:text-base-content focus-visible:outline-none';

  if (path === props.link) {
    className =
      'btn btn-sm h-10 justify-start gap-3 w-full rounded-xl border border-primary/20 bg-primary px-3 text-primary-content hover:bg-primary hover:text-primary-content shadow-[0_12px_24px_-16px_rgba(0,0,0,0.9)] focus-visible:outline-none';
  }

  return (
    <a href={props.link} onClick={props.onClick} className={className}>
      <FontAwesomeIcon icon={props.icon} />
      <span>{props.label}</span>
    </a>
  );
}

export function Header() {
  const [open, setOpen] = useState(false);
  const [activeBean, setActiveBean] = useState(() => getCurrentBeanSelection());
  const connected = machine.value.connected;
  const modeLabel = MODE_LABELS[machine.value.status.mode] || 'Unknown';
  const profileLabel = machine.value.status.selectedProfile || 'Default';
  const openCb = useCallback(
    newState => {
      setOpen(newState);
    },
    [setOpen],
  );

  useEffect(() => {
    const syncBean = event => {
      if (event?.detail !== undefined) {
        setActiveBean(event.detail);
        return;
      }
      setActiveBean(getCurrentBeanSelection());
    };

    window.addEventListener('bean-selection-changed', syncBean);
    window.addEventListener('storage', syncBean);

    return () => {
      window.removeEventListener('bean-selection-changed', syncBean);
      window.removeEventListener('storage', syncBean);
    };
  }, []);

  return (
    <header id='page-header' className='sticky top-0 z-50'>
      <div className='mx-auto px-4 pt-3 lg:px-8 xl:container'>
        <div className='rounded-2xl border border-base-300/65 bg-base-100/90 px-4 py-3 shadow-[0_26px_60px_-42px_rgba(0,0,0,0.9)] backdrop-blur-xl lg:px-6'>
          <div className='flex items-center justify-between gap-4'>
            <a href='/' className='inline-flex items-center gap-3' onClick={() => openCb(false)}>
              <span className='grid size-10 place-items-center rounded-2xl bg-primary text-primary-content shadow-sm'>
                <span className='font-logo text-xl font-semibold'>G</span>
              </span>
              <span className='leading-tight'>
                <span className='font-logo text-2xl font-semibold tracking-wide'>
                  GAGGI<span className='font-normal'>MATE</span>
                </span>
                <span className='text-base-content/60 hidden text-xs uppercase tracking-[0.2em] sm:block'>
                  Live espresso control
                </span>
              </span>
            </a>

            <div className='hidden min-w-0 items-center gap-2 lg:flex'>
              <div className='status-live-pill rounded-2xl border border-base-300/65 bg-base-100/95 px-3 py-2 shadow-[0_10px_30px_-24px_rgba(0,0,0,0.9)]'>
                <div className='flex items-center gap-2'>
                  <span
                    className={`status-live-dot inline-flex size-2.5 rounded-full ${connected ? 'bg-success shadow-[0_0_0_5px_rgba(52,211,153,0.12)]' : 'bg-error shadow-[0_0_0_5px_rgba(248,113,113,0.12)]'}`}
                  />
                  <span className='text-[0.6rem] font-semibold uppercase tracking-[0.22em] text-base-content/55'>
                    Live state
                  </span>
                </div>
                <div className='mt-1 flex items-center gap-2 text-sm font-semibold'>
                  <span>{connected ? 'Connected' : 'Offline'}</span>
                  <span className='text-base-content/30'>{'\u2022'}</span>
                  <span>{modeLabel}</span>
                </div>
              </div>
              <div className='status-live-pill max-w-[12rem] rounded-2xl border border-base-300/65 bg-base-100/95 px-3 py-2 text-right shadow-[0_10px_30px_-24px_rgba(0,0,0,0.9)]'>
                <div className='text-[0.6rem] font-semibold uppercase tracking-[0.22em] text-base-content/55'>
                  Active profile
                </div>
                <div className='truncate text-sm font-semibold'>{profileLabel}</div>
              </div>
              <div className='status-live-pill max-w-[12rem] rounded-2xl border border-base-300/65 bg-base-100/95 px-3 py-2 text-right shadow-[0_10px_30px_-24px_rgba(0,0,0,0.9)]'>
                <div className='text-[0.6rem] font-semibold uppercase tracking-[0.22em] text-base-content/55'>
                  Active bean
                </div>
                <div className='truncate text-sm font-semibold'>
                  {activeBean?.beanName || 'Not selected'}
                </div>
              </div>
            </div>

            <div className='flex items-center gap-1 lg:gap-5'>
              <a
                aria-label='github'
                rel='noopener noreferrer'
                href='https://github.com/jniebuhr/gaggimate'
                target='_blank'
                className='btn btn-sm btn-circle border-none bg-transparent text-base-content hover:bg-base-content/10 hover:text-base-content focus-visible:bg-base-content/10 focus-visible:outline-none'
              >
                <FontAwesomeIcon icon={faGithub} className='text-lg' />
              </a>

              <a
                aria-label='discord'
                rel='noopener noreferrer'
                href='https://discord.gaggimate.eu/'
                target='_blank'
                className='btn btn-sm btn-circle border-none bg-transparent text-base-content hover:bg-base-content/10 hover:text-base-content focus-visible:bg-base-content/10 focus-visible:outline-none'
              >
                <FontAwesomeIcon icon={faDiscord} className='text-lg' />
              </a>

              <button
                type='button'
                onClick={() => openCb(!open)}
                aria-expanded={open}
                aria-controls='mobile-navigation'
                aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
                className='btn btn-sm btn-circle border-none bg-transparent text-base-content hover:bg-base-content/10 hover:text-base-content focus-visible:bg-base-content/10 focus-visible:outline-none lg:hidden'
              >
                <svg
                  fill='currentColor'
                  viewBox='0 0 20 20'
                  xmlns='http://www.w3.org/2000/svg'
                  className='h-5 w-5'
                >
                  <path
                    fillRule='evenodd'
                    d='M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z'
                    clipRule='evenodd'
                  />
                </svg>
              </button>
            </div>
          </div>

          <nav
            id='mobile-navigation'
            className={`${open ? 'grid' : 'hidden'} mt-4 max-h-[calc(100vh-8.5rem)] gap-3 overflow-y-auto pb-1 lg:hidden`}
          >
            <div className='space-y-2 rounded-2xl border border-base-300/65 bg-base-100/95 p-3'>
              <div className='px-2 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-base-content/45'>
                Control
              </div>
              <HeaderItem label='Dashboard' link='/' icon={faHome} onClick={() => openCb(false)} />
              <HeaderItem
                label='PID Autotune'
                link='/pidtune'
                icon={faTemperatureHalf}
                onClick={() => openCb(false)}
              />
              <HeaderItem
                label='Bluetooth Devices'
                link='/scales'
                icon={faBluetoothB}
                onClick={() => openCb(false)}
              />
              <HeaderItem
                label='Settings'
                link='/settings'
                icon={faCog}
                onClick={() => openCb(false)}
              />
            </div>
            <div className='space-y-2 rounded-2xl border border-base-300/65 bg-base-100/95 p-3'>
              <div className='px-2 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-base-content/45'>
                Review
              </div>
              <HeaderItem
                label='Profiles'
                link='/profiles'
                icon={faList}
                onClick={() => openCb(false)}
              />
              <HeaderItem label='Beans' link='/beans' icon={faLeaf} onClick={() => openCb(false)} />
              <HeaderItem
                label='Shot History'
                link='/history'
                icon={faTimeline}
                onClick={() => openCb(false)}
              />
              <HeaderItem
                label='Shot Analyzer'
                link='/analyzer'
                icon={faMagnifyingGlassChart}
                onClick={() => openCb(false)}
              />
              <HeaderItem
                label='Statistics'
                link='/statistics'
                icon={faChartSimple}
                onClick={() => openCb(false)}
              />
              <HeaderItem
                label='System & Updates'
                link='/ota'
                icon={faRotate}
                onClick={() => openCb(false)}
              />
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
