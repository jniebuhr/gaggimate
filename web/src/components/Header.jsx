import { useCallback, useEffect, useState, useRef, useContext } from 'preact/hooks';
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
import { faPlugCircleBolt } from '@fortawesome/free-solid-svg-icons/faPlugCircleBolt';
import { faSliders } from '@fortawesome/free-solid-svg-icons/faSliders';
import { faBookmark } from '@fortawesome/free-solid-svg-icons/faBookmark';
import { faTemperatureHigh } from '@fortawesome/free-solid-svg-icons/faTemperatureHigh';
import { faRectangleList } from '@fortawesome/free-solid-svg-icons/faRectangleList';
import { faMinus } from '@fortawesome/free-solid-svg-icons/faMinus';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { ApiServiceContext, machine } from '../services/ApiService.js';
import { getCurrentBeanSelection, listBeans } from '../utils/beanManager.js';

const MODE_LABELS = ['Standby', 'Brew', 'Steam', 'Water', 'Grind'];
const MODE_DOT_COLORS = ['bg-base-content/30', 'bg-primary', 'bg-warning', 'bg-error', 'bg-secondary'];

function formatReading(value, suffix) {
  return `${Number.isFinite(value) ? value.toFixed(1) : '0.0'}${suffix}`;
}

function StatPill({ label, value, tone = 'neutral', icon, onClick }) {
  const toneClasses = {
    neutral: 'border-base-300/60 bg-base-100/90 text-base-content',
    accent: 'border-primary/25 bg-primary/12 text-primary',
    success: 'border-success/25 bg-success/12 text-success',
    secondary: 'border-secondary/25 bg-secondary/12 text-secondary',
    error: 'border-error/25 bg-error/12 text-error',
    warning: 'border-warning/30 bg-warning/20 text-warning',
    orange: 'border-orange-500/30 bg-orange-500/15 text-orange-600',
    purple: 'border-purple-500/25 bg-purple-500/12 text-purple-500',
  };

  const clickableClass = onClick ? 'cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 stat-pill-clickable' : '';

  return (
    <div
      onClick={onClick}
      className={`stat-pill status-indicator-card flex-1 min-w-0 rounded-2xl border px-4 py-3 shadow-[0_10px_25px_-18px_rgba(0,0,0,0.9)] backdrop-blur ${toneClasses[tone]} ${clickableClass}`}
    >
      <div className='flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.22em] opacity-70'>
        <span className='inline-flex size-7 items-center justify-center rounded-xl border border-current/15 bg-current/10'>
          <FontAwesomeIcon icon={icon} className='text-xs' />
        </span>
        <span>{label}</span>
      </div>
      <div className='mt-1 text-[clamp(0.6rem,1.2vw,1rem)] font-semibold leading-tight text-wrap balance truncate'>{value}</div>
    </div>
  );
}

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

const ProfilePopover = ({ profiles, selectedProfileId, onSelect, loading, error }) => (
  <div className='stat-pill-popover absolute top-full left-1/2 -translate-x-1/2 mt-3 z-50 min-w-[220px] rounded-2xl border border-base-300/60 bg-base-100/95 p-4 shadow-[0_25px_60px_-20px_rgba(0,0,0,0.95)] backdrop-blur-xl'>
    <div className='mb-4 flex items-center gap-2 border-b border-base-300/40 pb-3'>
      <span className='flex size-8 items-center justify-center rounded-xl border border-secondary/20 bg-secondary/10'>
        <FontAwesomeIcon icon={faBookmark} className='text-sm text-secondary' />
      </span>
      <span className='text-sm font-semibold uppercase tracking-wider text-base-content/70'>Select Profile</span>
    </div>
    {loading ? (
      <div className='flex items-center justify-center py-8'>
        <span className='loading loading-spinner loading-md text-secondary' />
      </div>
    ) : error ? (
      <div className='py-4 text-center text-sm text-error'>{error}</div>
    ) : (
      <div className='space-y-1 max-h-56 overflow-y-auto pr-1 custom-scrollbar'>
        {profiles.map(profile => (
          <button
            key={profile.id}
            onClick={() => onSelect(profile.id)}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
              profile.id === selectedProfileId
                ? 'bg-secondary/15 text-secondary border border-secondary/30 shadow-sm'
                : 'hover:bg-base-content/5 text-base-content/80 border border-transparent hover:border-base-300/30'
            }`}
          >
            <span className='flex items-center gap-2'>
              <FontAwesomeIcon icon={faRectangleList} className='text-xs opacity-50' />
              {profile.name || profile.id}
            </span>
          </button>
        ))}
      </div>
    )}
  </div>
);

const BeanPopover = ({ beans, activeBean, onSelect, loading, error }) => (
  <div className='stat-pill-popover absolute top-full left-1/2 -translate-x-1/2 mt-3 z-50 min-w-[220px] rounded-2xl border border-base-300/60 bg-base-100/95 p-4 shadow-[0_25px_60px_-20px_rgba(0,0,0,0.95)] backdrop-blur-xl'>
    <div className='mb-4 flex items-center gap-2 border-b border-base-300/40 pb-3'>
      <span className='flex size-8 items-center justify-center rounded-xl border border-purple-500/20 bg-purple-500/10'>
        <FontAwesomeIcon icon={faLeaf} className='text-sm text-purple-500' />
      </span>
      <span className='text-sm font-semibold uppercase tracking-wider text-base-content/70'>Select Bean</span>
    </div>
    {loading ? (
      <div className='flex items-center justify-center py-8'>
        <span className='loading loading-spinner loading-md text-purple-500' />
      </div>
    ) : error ? (
      <div className='py-4 text-center text-sm text-error'>{error}</div>
    ) : (
      <div className='space-y-1 max-h-56 overflow-y-auto pr-1 custom-scrollbar'>
        {beans.map(bean => (
          <button
            key={bean.id}
            onClick={() => onSelect(bean.name)}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
              bean.id === activeBean?.beanId
                ? 'bg-purple-500/15 text-purple-500 border border-purple-500/30 shadow-sm'
                : 'hover:bg-base-content/5 text-base-content/80 border border-transparent hover:border-base-300/30'
            }`}
          >
            <span className='flex items-center gap-2'>
              <FontAwesomeIcon icon={faLeaf} className='text-xs opacity-50' />
              {bean.name}
            </span>
          </button>
        ))}
      </div>
    )}
  </div>
);

const TempPopover = ({ currentTemp, targetTemp, onChange }) => (
  <div className='stat-pill-popover absolute top-full left-1/2 -translate-x-1/2 mt-3 z-50 w-56 rounded-2xl border border-base-300/60 bg-base-100/95 p-5 shadow-[0_25px_60px_-20px_rgba(0,0,0,0.95)] backdrop-blur-xl'>
    <div className='mb-5 flex items-center gap-2 border-b border-base-300/40 pb-3'>
      <span className='flex size-8 items-center justify-center rounded-xl border border-error/20 bg-error/10'>
        <FontAwesomeIcon icon={faTemperatureHigh} className='text-sm text-error' />
      </span>
      <span className='text-sm font-semibold uppercase tracking-wider text-base-content/70'>Temperature</span>
    </div>

    <div className='flex items-center justify-between gap-3'>
      <button
        onClick={() => onChange(-1)}
        className='btn btn-circle btn-lg border-2 border-primary bg-primary/10 hover:bg-primary/20 hover:border-primary text-primary shadow-md transition-all duration-200 hover:scale-105'
      >
        <FontAwesomeIcon icon={faMinus} className='text-xl' />
      </button>

      <div className='flex flex-col items-center'>
        <div className='text-3xl font-bold text-base-content tracking-tight'>{targetTemp}</div>
        <div className='text-xs font-medium uppercase tracking-wider text-base-content/50'>Target °C</div>
        <div className='mt-1 text-xs text-base-content/40'>Current: {formatReading(currentTemp, '\u00B0C')}</div>
      </div>

      <button
        onClick={() => onChange(1)}
        className='btn btn-circle btn-lg border-2 border-primary bg-primary/10 hover:bg-primary/20 hover:border-primary text-primary shadow-md transition-all duration-200 hover:scale-105'
      >
        <FontAwesomeIcon icon={faPlus} className='text-xl' />
      </button>
    </div>

    <div className='mt-4 grid grid-cols-3 gap-1 text-center text-xs'>
      {[-5, 5, -10].map(delta => (
        <button
          key={delta}
          onClick={() => onChange(delta)}
          className='rounded-lg border border-base-300/40 bg-base-100/50 py-2 font-medium text-base-content/60 hover:bg-base-content/5 hover:text-base-content transition-colors'
        >
          {delta > 0 ? `+${delta}` : delta}
        </button>
      ))}
    </div>
  </div>
);

const ModePopover = ({ currentMode, onSelect }) => (
  <div className='stat-pill-popover absolute top-full left-1/2 -translate-x-1/2 mt-3 z-50 w-48 rounded-2xl border border-base-300/60 bg-base-100/95 p-4 shadow-[0_25px_60px_-20px_rgba(0,0,0,0.95)] backdrop-blur-xl'>
    <div className='mb-4 flex items-center gap-2 border-b border-base-300/40 pb-3'>
      <span className='flex size-8 items-center justify-center rounded-xl border border-primary/20 bg-primary/10'>
        <FontAwesomeIcon icon={faSliders} className='text-sm text-primary' />
      </span>
      <span className='text-sm font-semibold uppercase tracking-wider text-base-content/70'>Select Mode</span>
    </div>
    <div className='space-y-1'>
      {MODE_LABELS.map((label, index) => (
        <button
          key={index}
          onClick={() => onSelect(index)}
          className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
            index === currentMode
              ? 'bg-primary/15 text-primary border border-primary/30 shadow-sm'
              : 'hover:bg-base-content/5 text-base-content/80 border border-transparent hover:border-base-300/30'
          }`}
        >
          <span className='flex items-center gap-2'>
            <span className={`size-2 rounded-full ${MODE_DOT_COLORS[index]}`} />
            {label}
          </span>
        </button>
      ))}
    </div>
  </div>
);

export function Header() {
  const [open, setOpen] = useState(false);
  const [activeBean, setActiveBean] = useState(() => getCurrentBeanSelection());
  const apiService = useContext(ApiServiceContext);
  const connected = machine.value.connected;
  const mode = machine.value.status.mode;
  const currentMode = MODE_LABELS[mode] || 'Unknown';
  const profileLabel = machine.value.status.selectedProfile || 'Default';
  const temp = formatReading(machine.value.status.currentTemperature, '\u00B0C');
  const pressure = formatReading(machine.value.status.currentPressure, ' bar');

  const [activePopover, setActivePopover] = useState(null); // 'profile' | 'bean' | 'temp' | 'mode' | null
  const [profileOptions, setProfileOptions] = useState([]);
  const [beanOptions, setBeanOptions] = useState([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [loadingBeans, setLoadingBeans] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [beanError, setBeanError] = useState(null);
  const mountedRef = useRef(true);

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

  // Close popover when clicking outside or pressing Escape
  useEffect(() => {
    if (!activePopover) return;

    const handleClickOutside = (e) => {
      if (!e.target.closest('.stat-pill-popover') && !e.target.closest('.stat-pill-clickable')) {
        setActivePopover(null);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActivePopover(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activePopover]);

  const openCb = useCallback(
    newState => {
      setOpen(newState);
    },
    [setOpen],
  );

  // Load profile options when profile popover opens
  const loadProfileOptions = useCallback(async () => {
    if (profileOptions.length > 0) return;
    setLoadingProfiles(true);
    setProfileError(null);
    try {
      const response = await apiService.request({ tp: 'req:profiles:list' });
      if (mountedRef.current) {
        setProfileOptions(response.profiles || []);
      }
    } catch (err) {
      console.error('Failed to load profiles:', err);
      if (mountedRef.current) {
        setProfileError('Could not load profiles. Check your machine connection.');
      }
    } finally {
      if (mountedRef.current) {
        setLoadingProfiles(false);
      }
    }
  }, [profileOptions.length, apiService]);

  // Load bean options when bean popover opens
  const loadBeanOptions = useCallback(async () => {
    if (beanOptions.length > 0) return;
    setLoadingBeans(true);
    setBeanError(null);
    try {
      const beans = await listBeans(machine);
      if (mountedRef.current) {
        setBeanOptions(beans || []);
      }
    } catch (err) {
      console.error('Failed to load beans:', err);
      if (mountedRef.current) {
        setBeanError('Could not load beans. Check your machine connection.');
      }
    } finally {
      if (mountedRef.current) {
        setLoadingBeans(false);
      }
    }
  }, [beanOptions.length]);

  const handleProfileClick = useCallback(() => {
    loadProfileOptions();
    setActivePopover(activePopover === 'profile' ? null : 'profile');
  }, [activePopover, loadProfileOptions]);

  const handleBeanClick = useCallback(() => {
    loadBeanOptions();
    setActivePopover(activePopover === 'bean' ? null : 'bean');
  }, [activePopover, loadBeanOptions]);

  const handleTempClick = useCallback(() => {
    setActivePopover(activePopover === 'temp' ? null : 'temp');
  }, [activePopover]);

  const handleModeClick = useCallback(() => {
    setActivePopover(activePopover === 'mode' ? null : 'mode');
  }, [activePopover]);

  const handleProfileSelect = useCallback(async (profileId) => {
    try {
      await apiService.request({ tp: 'req:profiles:select', id: profileId });
      setActivePopover(null);
    } catch (err) {
      console.error('Failed to select profile:', err);
    }
  }, [apiService]);

  const handleBeanSelect = useCallback((beanName) => {
    try {
      apiService.send({ tp: 'req:beans:select', name: beanName });
      setActivePopover(null);
    } catch (err) {
      console.error('Failed to select bean:', err);
    }
  }, [apiService]);

  const handleTempChange = useCallback((delta) => {
    try {
      apiService.send({ tp: delta > 0 ? 'req:raise-temp' : 'req:lower-temp' });
    } catch (err) {
      console.error('Failed to change temperature:', err);
    }
  }, [apiService]);

  const handleModeSelect = useCallback((newMode) => {
    try {
      apiService.send({ tp: 'req:change-mode', mode: newMode });
      setActivePopover(null);
    } catch (err) {
      console.error('Failed to change mode:', err);
    }
  }, [apiService]);

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
              {/* Connection - not clickable */}
              <StatPill label='Connection' value={connected ? 'Online' : 'Offline'} tone={connected ? 'success' : 'warning'} icon={faPlugCircleBolt} />

              {/* Mode - clickable */}
              <div className='relative'>
                <StatPill label='Mode' value={currentMode} tone='orange' icon={faSliders} onClick={handleModeClick} />
                {activePopover === 'mode' && (
                  <ModePopover currentMode={mode} onSelect={handleModeSelect} />
                )}
              </div>

              {/* Profile - clickable */}
              <div className='relative'>
                <StatPill label='Profile' value={profileLabel} tone='secondary' icon={faBookmark} onClick={handleProfileClick} />
                {activePopover === 'profile' && (
                  <ProfilePopover
                    profiles={profileOptions}
                    selectedProfileId={machine.value.status.selectedProfileId}
                    onSelect={handleProfileSelect}
                    loading={loadingProfiles}
                    error={profileError}
                  />
                )}
              </div>

              {/* Bean - clickable */}
              <div className='relative'>
                <StatPill label='Active Bean' value={activeBean?.beanName || 'Not selected'} tone='purple' icon={faLeaf} onClick={handleBeanClick} />
                {activePopover === 'bean' && (
                  <BeanPopover
                    beans={beanOptions}
                    activeBean={activeBean}
                    onSelect={handleBeanSelect}
                    loading={loadingBeans}
                    error={beanError}
                  />
                )}
              </div>

              {/* Temp - clickable */}
              <div className='relative'>
                <StatPill label='Temp / Pressure' value={`${temp} · ${pressure}`} tone='error' icon={faTemperatureHigh} onClick={handleTempClick} />
                {activePopover === 'temp' && (
                  <TempPopover
                    currentTemp={machine.value.status.currentTemperature}
                    targetTemp={machine.value.status.targetTemperature}
                    onChange={handleTempChange}
                  />
                )}
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
