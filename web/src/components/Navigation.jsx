import { useLocation, useRoute } from 'preact-iso';

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
      <i className={props.iconClass || ''} aria-hidden='true' />
      <span>{props.label}</span>
    </a>
  );
}

export function Navigation(props) {
  return (
    <nav className='hidden lg:col-span-2 lg:block'>
      <MenuItem label='Dashboard' link='/' iconClass='fa fa-home' />
      <hr className='h-5 border-0' />
      <div className='space-y-1.5'>
        <MenuItem label='Profiles' link='/profiles' iconClass='fa fa-list' />
        <MenuItem label='Shot History' link='/history' iconClass='fa fa-timeline' />
      </div>
      <hr className='h-5 border-0' />
      <div className='space-y-1.5'>
        <MenuItem label='PID Autotune' link='/pidtune' iconClass='fa fa-temperature-half' />
        <MenuItem label='Bluetooth Scales' link='/scales' iconClass='fa-brands fa-bluetooth-b' />
        <MenuItem label='Settings' link='/settings' iconClass='fa fa-cog' />
      </div>
      <hr className='h-5 border-0' />
      <div className='space-y-1.5'>
        <MenuItem label='System & Updates' link='/ota' iconClass='fa fa-rotate' />
      </div>
    </nav>
  );
}
