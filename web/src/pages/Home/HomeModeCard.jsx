import { useCallback, useContext, useState } from 'preact/hooks';
import { computed } from '@preact/signals';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons/faTimes';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
import { listBeans, recordBeanSelection } from '../../utils/beanManager.js';
import { MODE_LABELS, formatNumber, StatRow } from '../../utils/homeConstants.jsx';

const status = computed(() => machine.value.status);

// Temperature stepper popover
function TempPopover({ currentTemp, targetTemp, onChange, onClose }) {
  return (
    <div className='nd-card absolute left-0 top-full z-50 mt-2 w-full p-4' onClick={e => e.stopPropagation()}>
      <div className='mb-4 flex items-center justify-between'>
        <span className='font-nd-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'>
          Adjust Temperature
        </span>
        <button
          type='button'
          className='nd-popover-close'
          onClick={onClose}
          aria-label='Close'
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>
      </div>
      <div className='nd-stepper'>
        <button
          type='button'
          className='nd-stepper-btn'
          onClick={() => onChange(-1)}
          aria-label='Lower temperature'
        >
          −
        </button>
        <span className='nd-stepper-value'>{formatNumber(targetTemp)}°C</span>
        <button
          type='button'
          className='nd-stepper-btn'
          onClick={() => onChange(1)}
          aria-label='Raise temperature'
        >
          +
        </button>
      </div>
      <div className='mt-3 text-center font-nd-mono text-[11px] text-[var(--text-disabled,#666)]'>
        Current: {formatNumber(currentTemp)}°C
      </div>
    </div>
  );
}

TempPopover.propTypes = {
  currentTemp: PropTypes.number,
  targetTemp: PropTypes.number,
  onChange: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

// Profile popover
function ProfilePopover({ profiles, selectedProfileId, onSelect, onClose, loading, error }) {
  return (
    <div className='nd-card absolute left-0 top-full z-50 mt-2 w-full p-4' onClick={e => e.stopPropagation()}>
      <div className='mb-3 flex items-center justify-between'>
        <span className='font-nd-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'>
          Select Profile
        </span>
        <button
          type='button'
          className='nd-popover-close'
          onClick={onClose}
          aria-label='Close'
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>
      </div>
      {loading ? (
        <div className='py-4 text-center font-nd-mono text-[11px] text-[var(--text-disabled,#666)]'>
          [LOADING...]
        </div>
      ) : error ? (
        <div className='py-4 text-center font-nd-mono text-[11px] text-[var(--color-error,#d71921)]'>
          [{error.toUpperCase()}]
        </div>
      ) : (
        <div className='space-y-1'>
          {profiles.map(profile => (
            <button
              key={profile.id}
              type='button'
              className={`nd-popover-btn w-full px-3 py-2 text-left ${
                profile.id === selectedProfileId ? 'nd-popover-btn--active' : ''
              }`}
              onClick={() => onSelect(profile.id)}
            >
              {profile.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

ProfilePopover.propTypes = {
  profiles: PropTypes.array,
  selectedProfileId: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  error: PropTypes.string,
};

// Bean popover
function BeanPopover({ beans, activeBean, onSelect, onClose, loading, error }) {
  return (
    <div className='nd-card absolute left-0 top-full z-50 mt-2 w-full p-4' onClick={e => e.stopPropagation()}>
      <div className='mb-3 flex items-center justify-between'>
        <span className='font-nd-mono text-[11px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'>
          Select Bean
        </span>
        <button
          type='button'
          className='nd-popover-close'
          onClick={onClose}
          aria-label='Close'
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>
      </div>
      {loading ? (
        <div className='py-4 text-center font-nd-mono text-[11px] text-[var(--text-disabled,#666)]'>
          [LOADING...]
        </div>
      ) : error ? (
        <div className='py-4 text-center font-nd-mono text-[11px] text-[var(--color-error,#d71921)]'>
          [{error.toUpperCase()}]
        </div>
      ) : (
        <div className='space-y-1'>
          {beans.map(bean => (
            <button
              key={bean.name}
              type='button'
              className={`nd-popover-btn w-full px-3 py-2 text-left ${
                bean.name === activeBean ? 'nd-popover-btn--active' : ''
              }`}
              onClick={() => onSelect(bean.name)}
            >
              {bean.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

BeanPopover.propTypes = {
  beans: PropTypes.array,
  activeBean: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  error: PropTypes.string,
};

export default function HomeModeCard({ mode }) {
  const api = useContext(ApiServiceContext);
  const {
    currentTemperature,
    selectedBean,
    selectedProfile,
    selectedProfileId,
    targetPressure,
    targetTemperature,
  } = status.value;
  const connected = machine.value.connected;

  const [activePopover, setActivePopover] = useState(null);
  const [profileOptions, setProfileOptions] = useState([]);
  const [beanOptions, setBeanOptions] = useState([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [loadingBeans, setLoadingBeans] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [beanError, setBeanError] = useState(null);

  const loadProfileOptions = useCallback(async () => {
    if (profileOptions.length > 0) return;
    setLoadingProfiles(true);
    setProfileError(null);
    try {
      const response = await api.request({ tp: 'req:profiles:list' });
      const profiles = response?.profiles || [];
      setProfileOptions(profiles.filter(p => !p.archived));
    } catch (err) {
      console.error('Failed to load profiles:', err);
      setProfileError('Failed to load profiles');
    } finally {
      setLoadingProfiles(false);
    }
  }, [api, profileOptions.length]);

  const loadBeanOptions = useCallback(async () => {
    setLoadingBeans(true);
    setBeanError(null);
    try {
      const beans = await listBeans(api);
      setBeanOptions((beans || []).filter(bean => !bean.archived));
    } catch (err) {
      console.error('Failed to load beans:', err);
      setBeanError('Failed to load beans');
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
    <div className='flex flex-col gap-4'>
      {/* Connection + Temperature row */}
      <div className='flex gap-3'>
        <div className='nd-stat flex-1'>
          <div className='nd-stat-label'>
            <span className={`nd-status-dot mr-2 inline-block align-middle ${connected ? 'nd-status-dot--online' : ''}`} />
            Connection
          </div>
          <div className={`nd-stat-value ${connected ? '' : 'text-[var(--warning,#d4a843)]'}`}>
            {connected ? 'Online' : 'Offline'}
          </div>
        </div>
        <div
          className='nd-stat flex-1 cursor-pointer relative'
          onClick={handleTempClick}
        >
          <div className='nd-stat-label'>Temperature</div>
          <div className='nd-stat-value'>
            {formatNumber(currentTemperature)}°C
            <span className='ml-2 text-[11px] text-[var(--text-disabled,#666)]'>
              / {formatNumber(targetTemperature)}°
            </span>
          </div>
          {activePopover === 'temp' && (
            <TempPopover
              currentTemp={currentTemperature}
              targetTemp={targetTemperature}
              onChange={handleTempChange}
              onClose={() => setActivePopover(null)}
            />
          )}
        </div>
      </div>

      {/* Profile / Bean row */}
      <div className='flex gap-3'>
        <div
          className='nd-stat flex-1 cursor-pointer relative'
          onClick={handleProfileClick}
        >
          <div className='nd-stat-label'>Profile</div>
          <div className='nd-stat-value'>{selectedProfile || 'Default'}</div>
          {activePopover === 'profile' && (
            <ProfilePopover
              profiles={profileOptions}
              selectedProfileId={selectedProfileId}
              onSelect={handleProfileSelect}
              onClose={() => setActivePopover(null)}
              loading={loadingProfiles}
              error={profileError}
            />
          )}
        </div>

        <div
          className='nd-stat flex-1 cursor-pointer relative'
          onClick={handleBeanClick}
        >
          <div className='nd-stat-label'>Bean</div>
          <div className='nd-stat-value'>{selectedBean || 'Not selected'}</div>
          {activePopover === 'bean' && (
            <BeanPopover
              beans={beanOptions}
              activeBean={selectedBean}
              onSelect={handleBeanSelect}
              onClose={() => setActivePopover(null)}
              loading={loadingBeans}
              error={beanError}
            />
          )}
        </div>
      </div>

      {/* Shortcuts row */}
      <div className='border-b border-[var(--home-border,#222)] px-5 pt-4 pb-3'>
        <h3 className='font-nd-mono text-[11px] font-400 uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'>
          Shortcuts
        </h3>
      </div>
      <div className='flex gap-3'>
        <div className='nd-stat flex-1 cursor-pointer relative'>
          <div className='nd-stat-label'>Scales</div>
          <a href='/scales' className='nd-shortcut'>[Scales]</a>
        </div>

        <div className='nd-stat flex-1 cursor-pointer relative'>
          <div className='nd-stat-label'>History</div>
          <a href='/history' className='nd-shortcut'>[History]</a>
        </div>
      </div>
      <div className='flex gap-3'>
        <div className='nd-stat flex-1 cursor-pointer relative'>
          <div className='nd-stat-label'>Analyzer</div>
          <a href='/analyzer' className='nd-shortcut'>[Analyzer]</a>
        </div>

        <div className='nd-stat flex-1 cursor-pointer relative'>
          <div className='nd-stat-label'>Settings</div>
          <a href='/settings' className='nd-shortcut'>[Settings]</a>
        </div>
      </div>
    </div>
  );
}

HomeModeCard.propTypes = {
  mode: PropTypes.oneOf([0, 1, 2, 3, 4]).isRequired,
};