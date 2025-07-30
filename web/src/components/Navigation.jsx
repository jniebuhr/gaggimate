import { useLocation, useRoute } from 'preact-iso';

function MenuItem(props) {
  let className = 'btn btn-ghost btn-sm justify-start gap-2 w-full';
  const { path } = useLocation();
  if (props.active || path === props.link) {
    className += ' btn-active';
  }
  return (
    <a href={props.link} className={className}>
      <div className="min-w-6 flex flex-row justify-center align-middle">
        <i className={props.iconClass || ''} />
      </div>
      <span className="grow">{props.label}</span>
    </a>
  );
}

export function Navigation(props) {
  return (
    <nav class="hidden lg:col-span-3 lg:block">
      <MenuItem label="Dashboard" link="/" iconClass="fa fa-home" />
      <hr class="h-5 border-0" />
      <div className="space-y-1.5">
        <MenuItem label="Profiles" link="/profiles" iconClass="fa fa-list" />
        <MenuItem label="Shot History" link="/history" iconClass="fa fa-timeline" />
      </div>
      <hr className="h-5 border-0" />
      <div class="space-y-1.5">
        <MenuItem label="PID Autotune" link="/pidtune" iconClass="fa fa-temperature-half" />
        <MenuItem label="Bluetooth Scales" link="/scales" iconClass="fa-brands fa-bluetooth-b" />
        <MenuItem label="Settings" link="/settings" iconClass="fa fa-cog" />
      </div>
      <hr class="h-5 border-0" />
      <div class="space-y-1.5">
        <MenuItem label="System & Updates" link="/ota" iconClass="fa fa-rotate" />
      </div>
    </nav>
  );
}
