import { useLocation } from 'preact-iso';
import { t } from '@lingui/core/macro';

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

export function Navigation() {
  return (
    <nav className='hidden lg:col-span-2 lg:block'>
      <MenuItem label={t`Dashboard`} link='/' iconClass='fa fa-home' />
      <hr className='h-5 border-0' />
      <div className='space-y-1.5'>
        <MenuItem label={t`Profiles`} link='/profiles' iconClass='fa fa-list' />
        <MenuItem label={t`Shot History`} link='/history' iconClass='fa fa-timeline' />
      </div>
      <hr className='h-5 border-0' />
      <div className='space-y-1.5'>
        <MenuItem label={t`PID Autotune`} link='/pidtune' iconClass='fa fa-temperature-half' />
        <MenuItem label={t`Bluetooth Scales`} link='/scales' iconClass='fa-brands fa-bluetooth-b' />
        <MenuItem label={t`Settings`} link='/settings' iconClass='fa fa-cog' />
      </div>
      <hr className='h-5 border-0' />
      <div className='space-y-1.5'>
        <MenuItem label={t`System & Updates`} link='/ota' iconClass='fa fa-rotate' />
      </div>
    </nav>
  );
}
