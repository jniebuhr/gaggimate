import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTint } from '@fortawesome/free-solid-svg-icons/faTint';
import { getPrimaryIcon, getPrimaryLabel } from '../utils.js';
import { WarningIcon } from '../../../components/WarningIcon.jsx';
import { activeWarnings, WARNING_LEVEL } from '../../../utils/warnings.js';
import { useEffect, useState } from 'preact/hooks';
import TargetToggle from '../TargetToggle.jsx';
import Adjuster from '../Adjuster.jsx';

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
  currentTemperature,
  targetTemperature,
  changeTarget,
  grindTarget,
  volumetricAvailable,
  grindTargetDuration,
  grindTargetVolume,
  raiseTarget,
  lowerTarget,
  warnings = [],
}) {
  const [preheated, setPreheated] = useState(false);
  const showPrimary = mode === 1 || mode === 3 || mode === 4;
  const showStandby = mode === 0;
  const showSteam = mode === 2;

  const showFlush = isBrewing && !isActive && !isFinished;
  const grindValue =
    grindTarget === 1 && volumetricAvailable
      ? `${grindTargetVolume}g`
      : `${Math.round(grindTargetDuration / 1000)}s`;

  const handlePrimary = () => {
    if (isActive) deactivate();
    else if (isFinished) clear();
    else activate();
  };

  const primaryLabel = getPrimaryLabel(isActive, isFinished);
  const shownWarnings = activeWarnings(warnings);

  useEffect(() => {
    setPreheated(false);
  }, [targetTemperature, mode]);
  useEffect(() => {
    if (Math.abs(targetTemperature - currentTemperature) < 5) setPreheated(true);
  }, [currentTemperature, targetTemperature]);

  return (
    <div
      className={`grid grid-cols-[1fr_auto_1fr] items-center ${inCard ? '' : 'card bg-base-100 rounded-xl p-3'}`}
    >
      {isGrinding && (
        <div className='col-span-full mb-4 flex flex-col gap-4'>
          <div className='flex justify-center'>
            <TargetToggle value={grindTarget ? 1 : 0} onChange={changeTarget} />
          </div>
          <Adjuster
            label='Grind target'
            value={grindValue}
            onDecrease={lowerTarget}
            onIncrease={raiseTarget}
          />
        </div>
      )}
      <div className='flex items-center justify-start gap-2' aria-label='Active warnings'>
        {shownWarnings.map(w => (
          <WarningIcon
            key={w.key}
            icon={w.icon}
            title={w.label}
            className={`text-xl ${w.level === WARNING_LEVEL.ERROR ? 'text-error' : 'text-warning'}`}
          />
        ))}
      </div>
      {showPrimary && (
        <button
          type='button'
          className='btn btn-circle btn-lg btn-primary'
          onClick={handlePrimary}
          aria-label={primaryLabel}
          title={primaryLabel}
        >
          <FontAwesomeIcon icon={getPrimaryIcon(isActive, isFinished)} className='text-2xl' />
        </button>
      )}
      {showStandby && (
        <span className='text-base-content/70 py-2 text-sm'>Machine is ready, wake up to use</span>
      )}
      {showSteam && (
        <span className='text-base-content/70 py-2 text-sm'>
          {!preheated ? 'Preheating...' : 'Ready to steam, open wand'}
        </span>
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
  mode: PropTypes.number.isRequired,
  isActive: PropTypes.bool.isRequired,
  isFinished: PropTypes.bool.isRequired,
  isBrewing: PropTypes.bool.isRequired,
  isGrinding: PropTypes.bool.isRequired,
  isGrindAvailable: PropTypes.bool.isRequired,
  isFlushing: PropTypes.bool.isRequired,
  activate: PropTypes.func.isRequired,
  deactivate: PropTypes.func.isRequired,
  clear: PropTypes.func.isRequired,
  startFlush: PropTypes.func.isRequired,
  inCard: PropTypes.bool,
  warnings: PropTypes.array,
};
