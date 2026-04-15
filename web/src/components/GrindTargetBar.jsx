import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClock } from '@fortawesome/free-solid-svg-icons/faClock';
import { faWeightScale } from '@fortawesome/free-solid-svg-icons/faWeightScale';

export function GrindTargetBar({
  grindTarget,
  grindTargetVolume,
  grindTargetDuration,
  volumetricAvailable,
  onChangeTarget,
}) {
  if (!volumetricAvailable) return null;

  return (
    <div className='bg-base-300/90 flex w-full max-w-xs rounded-xl border border-base-300/65 p-1'>
      <button
        className={`flex-1 cursor-pointer rounded-lg px-3 py-1.5 text-sm transition-all duration-200 lg:py-2 ${
          grindTarget === 0
            ? 'bg-primary text-primary-content font-medium shadow-[0_10px_22px_-16px_rgba(0,0,0,0.9)]'
            : 'text-base-content/60 hover:text-base-content'
        }`}
        onClick={() => onChangeTarget(0)}
      >
        <FontAwesomeIcon icon={faClock} />
        <span className='ml-1'>Time</span>
      </button>
      <button
        className={`flex-1 cursor-pointer rounded-lg px-3 py-1.5 text-sm transition-all duration-200 lg:py-2 ${
          grindTarget === 1
            ? 'bg-primary text-primary-content font-medium shadow-[0_10px_22px_-16px_rgba(0,0,0,0.9)]'
            : 'text-base-content/60 hover:text-base-content'
        }`}
        onClick={() => onChangeTarget(1)}
      >
        <FontAwesomeIcon icon={faWeightScale} />
        <span className='ml-1'>Weight</span>
      </button>
    </div>
  );
}

GrindTargetBar.propTypes = {
  grindTarget: PropTypes.number.isRequired,
  grindTargetVolume: PropTypes.number,
  grindTargetDuration: PropTypes.number,
  volumetricAvailable: PropTypes.bool,
  onChangeTarget: PropTypes.func.isRequired,
};
