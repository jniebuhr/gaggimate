import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTint } from '@fortawesome/free-solid-svg-icons/faTint';
import { getPrimaryIcon, getPrimaryLabel } from '../utils.js';

export function ActionCard({
  mode,
  isActive,
  isFinished,
  isBrewing,
  isGrinding,
  isGrindAvailable,
  isFlushing,
  activate,
  deactivate,
  clear,
  startFlush,
  inCard = false,
}) {
  const showPrimary =
    mode === 1 ||
    mode === 3 ||
    (isGrinding && isGrindAvailable);

  const showFlush = isBrewing && !isActive && !isFinished;

  const handlePrimary = () => {
    if (isActive) deactivate();
    else if (isFinished) clear();
    else activate();
  };

  if (!showPrimary && !showFlush) return null;

  const primaryLabel = getPrimaryLabel(isActive, isFinished);

  return (
    <div className={`grid grid-cols-[1fr_auto_1fr] items-center ${inCard ? '' : 'card bg-base-100 rounded-xl p-3'}`}>
      <div />
      {showPrimary && (
        <button
          type='button'
          className='btn btn-circle btn-lg btn-primary'
          onClick={handlePrimary}
          aria-label={primaryLabel}
          title={primaryLabel}
        >
          <FontAwesomeIcon
            icon={getPrimaryIcon(isActive, isFinished)}
            className='text-2xl'
          />
        </button>
      )}
      <div className='flex justify-end'>
        {showFlush && (
          <button
            className='btn btn-ghost btn-sm text-base-content/60 hover:text-base-content rounded-full text-sm'
            onClick={startFlush}
            disabled={isFlushing}
            aria-label='Flush water'
          >
            <FontAwesomeIcon icon={faTint} />
            Flush
          </button>
        )}
      </div>
    </div>
  );
}

ActionCard.propTypes = {
  mode:             PropTypes.number.isRequired,
  isActive:         PropTypes.bool.isRequired,
  isFinished:       PropTypes.bool.isRequired,
  isBrewing:        PropTypes.bool.isRequired,
  isGrinding:       PropTypes.bool.isRequired,
  isGrindAvailable: PropTypes.bool.isRequired,
  isFlushing:       PropTypes.bool.isRequired,
  activate:         PropTypes.func.isRequired,
  deactivate:       PropTypes.func.isRequired,
  clear:            PropTypes.func.isRequired,
  startFlush:       PropTypes.func.isRequired,
  inCard:           PropTypes.bool,
};
