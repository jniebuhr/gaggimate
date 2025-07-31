import { useCallback, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';

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
      <i className={props.iconClass} />
      <span>{props.label}</span>
    </a>
  );
}

export function Header() {
  const [open, setOpen] = useState(false);
  const openCb = useCallback(
    (newState) => {
      setOpen(newState);
    },
    [setOpen]
  );
  return (
    <header id="page-header" className="z-1 flex flex-none items-center">
      <div className="container mx-auto px-4 lg:px-8 xl:max-w-7xl">
        <div className="flex justify-between border-b-2 border-base-300 py-6">
          <div className="flex items-center">
            <a href="/" className="inline-flex" onClick={() => openCb(false)}>
              <span className="text-3xl font-light text-[#333333] dark:text-gray-300 font-logo">
                <span className="font-semibold">GAGGI</span>MATE
              </span>
            </a>
          </div>

          <div className="flex items-center gap-1 lg:gap-5">
            <div className="relative inline-block">
              <a
                rel="noopener noreferrer"
                href="https://github.com/jniebuhr/gaggimate"
                target="_blank"
                className="btn btn-sm btn-circle text-base-content hover:text-base-content hover:bg-base-content/10 bg-transparent border-none"
              >
                <i className="fa-brands fa-github text-lg" />
              </a>
            </div>

            <div className="relative inline-block">
              <a
                rel="noopener noreferrer"
                href="https://discord.gaggimate.eu/"
                target="_blank"
                className="btn btn-sm btn-circle text-base-content hover:text-base-content hover:bg-base-content/10 bg-transparent border-none"
              >
                <i className="fa-brands fa-discord text-lg" />
              </a>
            </div>

            <div className="lg:hidden">
              <button
                type="button"
                onClick={() => openCb(!open)}
                className="btn btn-sm btn-circle text-base-content hover:text-base-content hover:bg-base-content/10 bg-transparent border-none"
              >
                <svg fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
                  <path
                    fillRule="evenodd"
                    d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <nav className={`${open ? 'flex' : 'hidden'} flex-col py-4 lg:hidden`}>
          <HeaderItem label="Dashboard" link="/" iconClass="fa fa-home" onClick={() => openCb(false)} />
          <hr className="h-5 border-0" />
          <div className="space-y-1.5">
            <HeaderItem label="Profiles" link="/profiles" iconClass="fa fa-list" onClick={() => openCb(false)} />
            <HeaderItem label="Shot History" link="/history" iconClass="fa fa-timeline" onClick={() => openCb(false)} />
          </div>
          <hr className="h-5 border-0" />
          <div className="space-y-1.5">
            <HeaderItem label="PID Autotune" link="/pidtune" iconClass="fa fa-temperature-half" onClick={() => openCb(false)} />
            <HeaderItem
              label="Bluetooth Scales"
              link="/scales"
              iconClass="fa-brands fa-bluetooth-b"
              onClick={() => openCb(false)}
            />
            <HeaderItem label="Settings" link="/settings" iconClass="fa fa-cog" onClick={() => openCb(false)} />
          </div>
          <hr className="h-5 border-0" />
          <div className="space-y-1.5">
            <HeaderItem label="System & Updates" link="/ota" iconClass="fa fa-rotate" onClick={() => openCb(false)} />
          </div>
        </nav>
      </div>
    </header>
  );
}
