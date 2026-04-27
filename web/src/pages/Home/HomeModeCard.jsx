import { useCallback, useContext, useState } from 'preact/hooks';
import { computed } from '@preact/signals';
import { useLocation } from 'preact-iso';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTemperatureHigh } from '@fortawesome/free-solid-svg-icons/faTemperatureHigh';
import { faSliders } from '@fortawesome/free-solid-svg-icons/faSliders';
import { faPlugCircleBolt } from '@fortawesome/free-solid-svg-icons/faPlugCircleBolt';
import { faGauge } from '@fortawesome/free-solid-svg-icons/faGauge';
import { faLeaf } from '@fortawesome/free-solid-svg-icons/faLeaf';
import { faBookmark } from '@fortawesome/free-solid-svg-icons/faBookmark';
import { faBluetoothB } from '@fortawesome/free-brands-svg-icons/faBluetoothB';
import { faTimeline } from '@fortawesome/free-solid-svg-icons/faTimeline';
import { faMagnifyingGlassChart } from '@fortawesome/free-solid-svg-icons/faMagnifyingGlassChart';
import { faCog } from '@fortawesome/free-solid-svg-icons/faCog';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
import { listBeans, recordBeanSelection } from '../../utils/beanManager.js';
import { ProfilePopover, BeanPopover, TempPopover, StatPill, ModePopover } from '../../components/Header.jsx';

const status = computed(() => machine.value.status);

const MODE_LABELS = ['Standby', 'Brew', 'Steam', 'Water', 'Grind'];
function formatNumber(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : '0.0';
}

function ModeChip({ active, colorClass, label, onClick }) {
  return (
    <button
      type='button'
      onClick={onClick}
      className={`home-mode-chip ${active ? 'home-mode-chip-active' : ''}`}
      aria-pressed={active}
    >
      <span className={`size-2 rounded-full ${colorClass}`} />
      <span>{label}</span>
    </button>
  );
}

ModeChip.propTypes = {
  active: PropTypes.bool.isRequired,
  colorClass: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
};

function InfoPill({ icon, label, toneClass, value, onClick }) {
  const clickableClass = onClick ? 'cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all duration-200' : '';
  return (
    <div className={`home-info-pill ${toneClass} ${clickableClass}`} onClick={onClick}>
      <div className='flex items-center gap-2 text-[0.62rem] font-semibold uppercase tracking-[0.2em] opacity-72'>
        <FontAwesomeIcon icon={icon} />
        <span>{label}</span>
      </div>
      <div className='mt-2 truncate text-sm font-semibold leading-tight'>{value}</div>
    </div>
  );
}

InfoPill.propTypes = {
  icon: PropTypes.object.isRequired,
  label: PropTypes.string.isRequired,
  toneClass: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onClick: PropTypes.func,
};

function StepperButton({ disabled = false, label, onClick, children }) {
  return (
    <button
      type='button'
      className='home-stepper-button'
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

StepperButton.propTypes = {
  children: PropTypes.node.isRequired,
  disabled: PropTypes.bool,
  label: PropTypes.string.isRequired,
  onClick: PropTypes.func,
};

function MetricRow({ label, value, toneClass = 'text-base-content' }) {
  return (
    <div className='flex items-center justify-between gap-4 text-sm'>
      <span className='text-base-content/62'>{label}</span>
      <span className={`text-right font-medium ${toneClass}`}>{value}</span>
    </div>
  );
}

MetricRow.propTypes = {
  label: PropTypes.string.isRequired,
  toneClass: PropTypes.string,
  value: PropTypes.string.isRequired,
};

export default function HomeModeCard({ mode }) {
  const api = useContext(ApiServiceContext);
  const { path } = useLocation();
  const {
    currentTemperature,
    selectedBean,
    selectedProfile,
    selectedProfileId,
    targetPressure,
    targetTemperature,
  } = status.value;
  const connected = machine.value.connected;
  const pressureAvailable = machine.value.capabilities.pressure;

  const [activePopover, setActivePopover] = useState(null);
  const [profileOptions, setProfileOptions] = useState([]);
  const [beanOptions, setBeanOptions] = useState([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [loadingBeans, setLoadingBeans] = useState(false);

  const loadProfileOptions = useCallback(async () => {
    setLoadingProfiles(true);
    try {
      const response = await api.request({ tp: 'req:profiles:list' });
      const profiles = response?.profiles || [];
      setProfileOptions(profiles.filter(p => !p.archived));
    } catch (err) {
      console.error('Failed to load profiles:', err);
    } finally {
      setLoadingProfiles(false);
    }
  }, [api]);

  const loadBeanOptions = useCallback(async () => {
    setLoadingBeans(true);
    try {
      const beans = await listBeans(api);
      setBeanOptions((beans || []).filter(bean => !bean.archived));
    } catch (err) {
      console.error('Failed to load beans:', err);
    } finally {
      setLoadingBeans(false);
    }
  }, [api]);

  const handleProfileClick = useCallback(() => {
    loadProfileOptions();
    setActivePopover(activePopover === 'profile' ? null : 'profile');
  }, [activePopover, loadProfileOptions]);

  const handleBeanClick = useCallback(() => {
    loadBeanOptions();
    setActivePopover(activePopover === 'bean' ? null : 'bean');
  }, [activePopover, loadBeanOptions]);

  const handleProfileSelect = useCallback(
    async profileId => {
      try {
        await api.request({ tp: 'req:profiles:select', id: profileId });
        setActivePopover(null);
      } catch (err) {
        console.error('Failed to select profile:', err);
      }
    },
    [api]
  );

  const handleBeanSelect = useCallback(
    beanName => {
      try {
        api.send({ tp: 'req:beans:select', name: beanName });
        const selectedBeanObj = beanOptions.find(b => b.name === beanName);
        if (selectedBeanObj) {
          recordBeanSelection({
            profileId: machine.value.status.selectedProfileId,
            profileLabel: machine.value.status.selectedProfile,
            bean: selectedBeanObj,
          });
        }
        setActivePopover(null);
      } catch (err) {
        console.error('Failed to select bean:', err);
      }
    },
    [api, beanOptions]
  );

  const handleTempClick = useCallback(() => {
    setActivePopover(activePopover === 'temp' ? null : 'temp');
  }, [activePopover]);

  const handleModeSelect = useCallback(
    nextMode => {
      try {
        api.send({ tp: 'req:change-mode', mode: nextMode });
        setActivePopover(null);
      } catch (error) {
        console.error('Failed to change mode:', error);
      }
    },
    [api]
  );

  const handleModeClick = useCallback(() => {
    setActivePopover(activePopover === 'mode' ? null : 'mode');
  }, [activePopover]);

  const handleTempChange = useCallback(
    delta => {
      try {
        api.send({ tp: delta > 0 ? 'req:raise-temp' : 'req:lower-temp' });
      } catch (error) {
        console.error('Failed to change temperature:', error);
      }
    },
    [api]
  );

  const handlePressureChange = useCallback(
    delta => {
      try {
        api.send({ tp: delta > 0 ? 'req:raise-pressure' : 'req:lower-pressure' });
      } catch (error) {
        console.error('Failed to change pressure:', error);
      }
    },
    [api]
  );

  return (
    <div className='home-control-panel flex min-h-[27rem] flex-col gap-5'>
      <div className='flex gap-3'>
        <div className='flex-1'>
          <StatPill
            label='Connection'
            value={connected ? 'Online' : 'Offline'}
            tone={connected ? 'success' : 'warning'}
            icon={faPlugCircleBolt}
          />
        </div>
        <div className='relative flex-1'>
          <div
            className='stat-pill status-indicator-card flex-1 min-w-0 rounded-2xl border px-4 py-3 shadow-[0_10px_25px_-18px_rgba(0,0,0,0.9)] backdrop-blur border-[#FD744699]/25 bg-[#FD744699]/12 text-[#FD744699] cursor-pointer transition-all duration-200 hover:border-primary/50 hover:bg-primary/5'
            onClick={handleModeClick}
          >
            <div className='flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.22em] opacity-70'>
              <span className='inline-flex size-7 items-center justify-center rounded-xl border border-[#FD744699]/20 bg-[#FD744699]/10'>
                <FontAwesomeIcon icon={faSliders} className='text-xs text-[#FD744699]' />
              </span>
              <span>Mode</span>
            </div>
            <div className='mt-1 h-8 flex items-center truncate text-sm font-semibold leading-tight'>{MODE_LABELS[mode] || 'Unknown'}</div>
          </div>
          {activePopover === 'mode' && (
            <ModePopover currentMode={mode} onSelect={handleModeSelect} />
          )}
        </div>
      </div>

      <div className='grid grid-cols-2 gap-3'>
        <div className='relative'>
          <div
            className='stat-pill status-indicator-card flex-1 min-w-0 rounded-2xl border px-4 py-3 shadow-[0_10px_25px_-18px_rgba(0,0,0,0.9)] backdrop-blur border-[#FF6C99]/25 bg-[#FF6C99]/12 text-[#FF6C99] cursor-pointer transition-all duration-200 hover:border-primary/50 hover:bg-primary/5'
            onClick={handleProfileClick}
          >
            <div className='flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.22em] opacity-70'>
              <span className='inline-flex size-7 items-center justify-center rounded-xl border border-[#FF6C99]/20 bg-[#FF6C99]/10'>
                <FontAwesomeIcon icon={faBookmark} className='text-xs text-[#FF6C99]' />
              </span>
              <span>Profile</span>
            </div>
            <div className='mt-1 h-8 flex items-center truncate text-sm font-semibold leading-tight'>{selectedProfile || 'Default'}</div>
          </div>
          {activePopover === 'profile' && (
            <ProfilePopover
              profiles={profileOptions}
              selectedProfileId={selectedProfileId}
              onSelect={handleProfileSelect}
              loading={loadingProfiles}
            />
          )}
        </div>
        <div className='relative'>
          <div
            className='stat-pill status-indicator-card flex-1 min-w-0 rounded-2xl border px-4 py-3 shadow-[0_10px_25px_-18px_rgba(0,0,0,0.9)] backdrop-blur border-purple-500/25 bg-purple-500/12 text-purple-500 cursor-pointer transition-all duration-200 hover:border-primary/50 hover:bg-primary/5'
            onClick={handleBeanClick}
          >
            <div className='flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.22em] opacity-70'>
              <span className='inline-flex size-7 items-center justify-center rounded-xl border border-purple-500/20 bg-purple-500/10'>
                <FontAwesomeIcon icon={faLeaf} className='text-xs text-purple-500' />
              </span>
              <span>Bean</span>
            </div>
            <div className='mt-1 h-8 flex items-center truncate text-sm font-semibold leading-tight'>{selectedBean || 'Not selected'}</div>
          </div>
          {activePopover === 'bean' && (
            <BeanPopover
              beans={beanOptions}
              activeBean={beanOptions.find(b => b.name === selectedBean)}
              onSelect={handleBeanSelect}
              loading={loadingBeans}
            />
          )}
        </div>
      </div>

      <div className='flex gap-3'>
        <div className='relative flex-1'>
          <div
            className='stat-pill status-indicator-card flex-1 min-w-0 rounded-2xl border px-4 py-3 shadow-[0_10px_25px_-18px_rgba(0,0,0,0.9)] backdrop-blur border-error/25 bg-error/12 text-error cursor-pointer transition-all duration-200 hover:border-primary/50 hover:bg-primary/5'
            onClick={handleTempClick}
          >
            <div className='flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.22em] opacity-70'>
              <span className='inline-flex size-7 items-center justify-center rounded-xl border border-error/20 bg-error/10'>
                <FontAwesomeIcon icon={faTemperatureHigh} className='text-xs text-error' />
              </span>
              <span>Temperature</span>
            </div>
            <div className='mt-1 flex h-8 items-baseline gap-1.5 whitespace-nowrap text-[clamp(0.72rem,1.2vw,1rem)] leading-tight'>
              <span className='font-semibold text-error'>
                {formatNumber(currentTemperature)}°C
              </span>
              <span className='text-error/55'>/</span>
              <span className='font-medium text-error/72'>
                {formatNumber(targetTemperature)}°C target
              </span>
            </div>
          </div>
          {activePopover === 'temp' && (
            <TempPopover
              currentTemp={currentTemperature}
              targetTemp={targetTemperature}
              onChange={handleTempChange}
            />
          )}
        </div>

        <div className='relative flex-1'>
          <div className='stat-pill status-indicator-card flex-1 min-w-0 rounded-2xl border px-4 py-3 shadow-[0_10px_25px_-18px_rgba(0,0,0,0.9)] backdrop-blur border-[#FFD2FF]/25 bg-[#FFD2FF]/12 text-[#FFD2FF]'>
          <div className='flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.22em] opacity-70'>
            <span className='inline-flex size-7 items-center justify-center rounded-xl border border-[#FFD2FF]/15 bg-[#FFD2FF]/10'>
              <FontAwesomeIcon icon={faGauge} className='text-xs text-[#FFD2FF]' />
            </span>
            <span>Pressure</span>
          </div>
          <div className='mt-1 flex items-center justify-between'>
            <button
              type='button'
              onClick={() => handlePressureChange(-0.1)}
              className='flex h-8 w-8 items-center justify-center rounded-lg border border-[#FFD2FF]/30 bg-[#FFD2FF]/10 text-[#FFD2FF] transition-colors hover:bg-[#FFD2FF]/20 active:bg-[#FFD2FF]/30'
              aria-label='Lower target pressure'
            >
              -
            </button>
            <span className='text-[clamp(0.6rem,1.2vw,1rem)] font-semibold leading-tight'>
              {pressureAvailable ? `${formatNumber(targetPressure)} bar` : 'N/A'}
            </span>
            <button
              type='button'
              onClick={() => handlePressureChange(0.1)}
              className='flex h-8 w-8 items-center justify-center rounded-lg border border-[#FFD2FF]/30 bg-[#FFD2FF]/10 text-[#FFD2FF] transition-colors hover:bg-[#FFD2FF]/20 active:bg-[#FFD2FF]/30'
              aria-label='Raise target pressure'
            >
              +
            </button>
          </div>
          </div>
        </div>
      </div>

      <div className='grid grid-cols-2 gap-3'>
        <a
          href='/scales'
          className={`stat-pill status-indicator-card flex min-w-0 flex-col gap-2 rounded-2xl border px-4 py-3 shadow-[0_10px_25px_-18px_rgba(0,0,0,0.9)] backdrop-blur transition-all duration-200 hover:border-primary/50 hover:bg-primary/5 ${path === '/scales' ? 'border-info/30 bg-info/10 text-info' : 'border-info/25 bg-info/12 text-info'}`}
        >
          <div className='flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.22em] opacity-70'>
            <span className='inline-flex size-7 items-center justify-center rounded-xl border border-info/20 bg-info/10'>
              <FontAwesomeIcon icon={faBluetoothB} className='text-xs text-info' />
            </span>
            <span>Bluetooth</span>
          </div>
          <div className='truncate text-sm font-semibold leading-tight'>Devices</div>
        </a>
        <a
          href='/history'
          className={`stat-pill status-indicator-card flex min-w-0 flex-col gap-2 rounded-2xl border px-4 py-3 shadow-[0_10px_25px_-18px_rgba(0,0,0,0.9)] backdrop-blur transition-all duration-200 hover:border-primary/50 hover:bg-primary/5 ${path === '/history' ? 'border-[#43B3AE]/30 bg-[#43B3AE]/10 text-[#43B3AE]' : 'border-[#43B3AE]/25 bg-[#43B3AE]/12 text-[#43B3AE]'}`}
        >
          <div className='flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.22em] opacity-70'>
            <span className='inline-flex size-7 items-center justify-center rounded-xl border border-[#43B3AE]/20 bg-[#43B3AE]/10'>
              <FontAwesomeIcon icon={faTimeline} className='text-xs text-[#43B3AE]' />
            </span>
            <span>Shot</span>
          </div>
          <div className='truncate text-sm font-semibold leading-tight'>History</div>
        </a>
        <a
          href='/analyzer'
          className={`stat-pill status-indicator-card flex min-w-0 flex-col gap-2 rounded-2xl border px-4 py-3 shadow-[0_10px_25px_-18px_rgba(0,0,0,0.9)] backdrop-blur transition-all duration-200 hover:border-primary/50 hover:bg-primary/5 ${path === '/analyzer' ? 'border-[#FFBF00]/30 bg-[#FFBF00]/10 text-[#FFBF00]' : 'border-[#FFBF00]/25 bg-[#FFBF00]/12 text-[#FFBF00]'}`}
        >
          <div className='flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.22em] opacity-70'>
            <span className='inline-flex size-7 items-center justify-center rounded-xl border border-[#FFBF00]/20 bg-[#FFBF00]/10'>
              <FontAwesomeIcon icon={faMagnifyingGlassChart} className='text-xs text-[#FFBF00]' />
            </span>
            <span>Shot</span>
          </div>
          <div className='truncate text-sm font-semibold leading-tight'>Analyzer</div>
        </a>
        <a
          href='/settings'
          className={`stat-pill status-indicator-card flex min-w-0 flex-col gap-2 rounded-2xl border px-4 py-3 shadow-[0_10px_25px_-18px_rgba(0,0,0,0.9)] backdrop-blur transition-all duration-200 hover:border-primary/50 hover:bg-primary/5 ${path === '/settings' ? 'border-base-content/30 bg-base-content/10 text-base-content' : 'border-base-content/25 bg-base-content/12 text-base-content'}`}
        >
          <div className='flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.22em] opacity-70'>
            <span className='inline-flex size-7 items-center justify-center rounded-xl border border-base-content/15 bg-base-content/10'>
              <FontAwesomeIcon icon={faCog} className='text-xs text-base-content/60' />
            </span>
            <span>App</span>
          </div>
          <div className='truncate text-sm font-semibold leading-tight'>Settings</div>
        </a>
      </div>

    </div>
  );
}

HomeModeCard.propTypes = {
  mode: PropTypes.oneOf([0, 1, 2, 3, 4]).isRequired,
};
