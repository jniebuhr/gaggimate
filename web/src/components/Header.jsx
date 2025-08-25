import { useCallback, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faList } from '@fortawesome/free-solid-svg-icons/faList';
import { faHome } from '@fortawesome/free-solid-svg-icons/faHome';
import { faTimeline } from '@fortawesome/free-solid-svg-icons/faTimeline';
import { faTemperatureHalf } from '@fortawesome/free-solid-svg-icons/faTemperatureHalf';
import { faBluetoothB } from '@fortawesome/free-brands-svg-icons/faBluetoothB';
import { faCog } from '@fortawesome/free-solid-svg-icons/faCog';
import { faRotate } from '@fortawesome/free-solid-svg-icons/faRotate';
import { faGithub } from '@fortawesome/free-brands-svg-icons/faGithub';
import { faDiscord } from '@fortawesome/free-brands-svg-icons/faDiscord';

function HeaderItem(props) {
  const { path } = useLocation();
  let className =
    'btn btn-md justify-start gap-3 w-full text-base-content hover:text-base-content hover:bg-base-content/10 bg-transparent border-none px-2';

  if (path === props.link) {
    className =
      'btn btn-md justify-start gap-3 w-full bg-primary text-primary-content hover:bg-primary hover:text-primary-content px-2';
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
  const openCb = useCallback(
    newState => {
      setOpen(newState);
    },
    [setOpen],
  );
  return (
    <header id='page-header' className='z-1'>
      <div className='mx-auto px-4 lg:px-8 xl:container'>
        <div className='border-base-300 flex justify-between border-b-2 py-2 lg:py-6'>
          <div className='flex items-center'>
            <a href='/' className='inline-flex' onClick={() => openCb(false)}>
              <span className='text-base-content font-logo text-3xl font-light'>
                <span className='font-semibold'>GAGGI</span>MATE
              </span>
            </a>
          </div>

          <div className='flex items-center gap-1 lg:gap-5'>
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

            <div className='lg:hidden'>
              <button
                type='button'
                onClick={() => openCb(!open)}
                className='btn btn-sm btn-circle text-base-content hover:text-base-content hover:bg-base-content/10 border-none bg-transparent'
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
        </div>

        <nav className={`${open ? 'flex' : 'hidden'} flex-col py-4 lg:hidden`}>
          <HeaderItem label='Dashboard' link='/' icon={faHome} onClick={() => openCb(false)} />
          <hr className='h-5 border-0' />
          <div className='space-y-1.5'>
            <HeaderItem
              label='Profiles'
              link='/profiles'
              icon={faList}
              onClick={() => openCb(false)}
            />
            <HeaderItem
              label='Shot History'
              link='/history'
              icon={faTimeline}
              onClick={() => openCb(false)}
            />
          </div>
          <hr className='h-5 border-0' />
          <div className='space-y-1.5'>
            <HeaderItem
              label='PID Autotune'
              link='/pidtune'
              icon={faTemperatureHalf}
              onClick={() => openCb(false)}
            />
            <HeaderItem
              label='Bluetooth Scales'
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
          <hr className='h-5 border-0' />
          <div className='space-y-1.5'>
            <HeaderItem
              label='System & Updates'
              link='/ota'
              icon={faRotate}
              onClick={() => openCb(false)}
            />
          </div>
        </nav>
      </div>
    </header>
  );
}
