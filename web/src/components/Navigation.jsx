import { useLocation, useRoute } from 'preact-iso';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHome } from '@fortawesome/free-solid-svg-icons/faHome';
import { faList } from '@fortawesome/free-solid-svg-icons/faList';
import { faTimeline } from '@fortawesome/free-solid-svg-icons/faTimeline';
import { faTemperatureHalf } from '@fortawesome/free-solid-svg-icons/faTemperatureHalf';
import { faBluetoothB } from '@fortawesome/free-brands-svg-icons/faBluetoothB';
import { faCog } from '@fortawesome/free-solid-svg-icons/faCog';
import { faRotate } from '@fortawesome/free-solid-svg-icons/faRotate';

function MenuItem(props) {
  let className =
    'btn btn-md justify-start gap-3 w-full text-base-content hover:text-base-content hover:bg-base-content/10 bg-transparent border-none px-2';
  const { path } = useLocation();
  if (props.active || path === props.link) {
    className =
      'btn btn-md justify-start gap-3 w-full bg-primary text-primary-content hover:bg-primary hover:text-primary-content px-2';
  }
  return (
    <a href={props.link} className={className}>
      <FontAwesomeIcon icon={props.icon} />
      <span>{props.label}</span>
    </a>
  );
}

export function Navigation(props) {
  return (
    <nav className='hidden lg:col-span-2 lg:block'>
      <MenuItem label='Dashboard' link='/' icon={faHome} />
      <hr className='h-5 border-0' />
      <div className='space-y-1.5'>
        <MenuItem label='Profiles' link='/profiles' icon={faList} />
        <MenuItem label='Shot History' link='/history' icon={faTimeline} />
      </div>
      <hr className='h-5 border-0' />
      <div className='space-y-1.5'>
        <MenuItem label='PID Autotune' link='/pidtune' icon={faTemperatureHalf} />
        <MenuItem label='Bluetooth Scales' link='/scales' icon={faBluetoothB} />
        <MenuItem label='Settings' link='/settings' icon={faCog} />
      </div>
      <hr className='h-5 border-0' />
      <div className='space-y-1.5'>
        <MenuItem label='System & Updates' link='/ota' icon={faRotate} />
      </div>
    </nav>
  );
}
