import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRectangleList } from '@fortawesome/free-solid-svg-icons/faRectangleList';
import { faLeaf } from '@fortawesome/free-solid-svg-icons/faLeaf';
import {
  clearCurrentBeanSelection,
  getCurrentBeanSelection,
  recordBeanSelection,
} from '../utils/beanManager.js';

export function ProfileBeanSelectors({
  profileOptions,
  selectedProfileId,
  selectedProfile,
  beanOptions,
  activeBean,
  profilesLoading,
  beansLoading,
  profileSelectBusy,
  beanSelectBusy,
  onProfileSelect,
  onBeanSelect,
}) {
  return (
    <div className='mb-2 grid gap-3 sm:grid-cols-2'>
      <SelectorCard
        label='Current Profile'
        icon={faRectangleList}
        value={selectedProfileId}
        options={profileOptions}
        onChange={onProfileSelect}
        loading={profilesLoading || profileSelectBusy}
        emptyLabel={selectedProfile || 'Default'}
      />
      <SelectorCard
        label='Current Bean'
        icon={faLeaf}
        value={activeBean?.beanId}
        options={beanOptions}
        onChange={onBeanSelect}
        loading={beansLoading || beanSelectBusy}
        emptyLabel={activeBean?.beanName || 'Not selected'}
      />
    </div>
  );
}

function SelectorCard({
  label,
  icon,
  value,
  options,
  onChange,
  loading = false,
  emptyLabel,
  disabled = false,
}) {
  return (
    <label className='block rounded-2xl border border-base-300/60 bg-base-100/90 p-4 text-left shadow-[0_12px_30px_-24px_rgba(0,0,0,0.85)] backdrop-blur'>
      <div className='mb-3 flex items-center gap-2 text-sm text-base-content/60'>
        <FontAwesomeIcon icon={icon} className='text-base' />
        <span>{label}</span>
      </div>
      <select
        className='select select-bordered w-full rounded-xl border-base-300/80 bg-base-100 text-base font-semibold'
        value={value}
        onChange={onChange}
        disabled={disabled || loading}
      >
        <option value=''>{loading ? `Loading ${label.toLowerCase()}...` : emptyLabel}</option>
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

ProfileBeanSelectors.propTypes = {
  profileOptions: PropTypes.arrayOf(
    PropTypes.shape({ value: PropTypes.string.isRequired, label: PropTypes.string.isRequired }),
  ).isRequired,
  selectedProfileId: PropTypes.string,
  selectedProfile: PropTypes.string,
  beanOptions: PropTypes.arrayOf(
    PropTypes.shape({ value: PropTypes.string.isRequired, label: PropTypes.string.isRequired }),
  ).isRequired,
  activeBean: PropTypes.object,
  profilesLoading: PropTypes.bool,
  beansLoading: PropTypes.bool,
  profileSelectBusy: PropTypes.bool,
  beanSelectBusy: PropTypes.bool,
  onProfileSelect: PropTypes.func.isRequired,
  onBeanSelect: PropTypes.func.isRequired,
};
