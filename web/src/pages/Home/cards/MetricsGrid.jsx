import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMinus } from '@fortawesome/free-solid-svg-icons/faMinus';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';

function AdjBtn({ icon, onClick, visible }) {
  return (
    <button
      onClick={onClick}
      style={{ visibility: visible ? 'visible' : 'hidden' }}
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      className='btn btn-ghost btn-xs flex h-6 w-6 items-center justify-center rounded-full p-0'
    >
      <FontAwesomeIcon icon={icon} className='h-2.5 w-2.5' />
    </button>
  );
}

function MetricCell({ label, current, target, unit, onDecrease, onIncrease, adjustable, inCard = false }) {
  return (
    <div className={`flex flex-col items-center justify-between gap-1 rounded-xl p-2 ${inCard ? 'bg-base-200/60' : 'card bg-base-100'}`}>
      <div className='text-base-content/50 text-[0.6rem] font-semibold tracking-wider uppercase'>
        {label}
      </div>
      <div className='flex w-full items-center justify-between'>
        <AdjBtn icon={faMinus} onClick={onDecrease} visible={adjustable} />
        <div className='text-center tabular-nums'>
          <span className='text-base-content text-sm font-bold'>{current}</span>
          {target != null && (
            <>
              <span className='text-base-content/30 mx-0.5 text-xs'>/</span>
              <span className='text-success text-xs font-semibold'>{target}{unit}</span>
            </>
          )}
        </div>
        <AdjBtn icon={faPlus} onClick={onIncrease} visible={adjustable} />
      </div>
    </div>
  );
}

export function MetricsGrid({
  currentPressure, targetPressure,
  currentFlow, targetFlow,
  currentTemperature, targetTemperature,
  currentWeight, targetWeight,
  volumetricAvailable, brewTarget,
  raiseTemp, lowerTemp,
  raiseTarget, lowerTarget,
  inCard = false,
}) {
  const weightCurrent = volumetricAvailable
    ? `${(currentWeight ?? 0).toFixed(1)}g`
    : '—';
  const weightTarget = (volumetricAvailable && brewTarget && targetWeight != null)
    ? targetWeight.toFixed(0)
    : null;
  const weightUnit = 'g';
  const weightAdjustable = volumetricAvailable;

  return (
    <div className='grid grid-cols-2 gap-2'>
      <MetricCell label='Pressure' current={`${(currentPressure ?? 0).toFixed(1)}`} target={(targetPressure ?? 0).toFixed(1)} unit=' bar' adjustable={false} inCard={inCard} />
      <MetricCell label='Flow' current={`${(currentFlow ?? 0).toFixed(1)}`} target={targetFlow > 0 ? (targetFlow ?? 0).toFixed(1) : null} unit=' ml/s' adjustable={false} inCard={inCard} />
      <MetricCell label='Temp' current={`${(currentTemperature ?? 0).toFixed(1)}°`} target={(targetTemperature ?? 0).toFixed(0)} unit='°C' adjustable={true} onDecrease={lowerTemp} onIncrease={raiseTemp} inCard={inCard} />
      <MetricCell label='Weight' current={weightCurrent} target={weightTarget} unit={weightUnit} adjustable={weightAdjustable} onDecrease={lowerTarget} onIncrease={raiseTarget} inCard={inCard} />
    </div>
  );
}

MetricsGrid.propTypes = {
  currentPressure:    PropTypes.number,
  targetPressure:     PropTypes.number,
  currentFlow:        PropTypes.number,
  targetFlow:         PropTypes.number,
  currentTemperature: PropTypes.number,
  targetTemperature:  PropTypes.number,
  currentWeight:      PropTypes.number,
  targetWeight:       PropTypes.number,
  volumetricAvailable: PropTypes.bool,
  brewTarget:         PropTypes.bool,
  raiseTemp:          PropTypes.func.isRequired,
  lowerTemp:          PropTypes.func.isRequired,
  raiseTarget:        PropTypes.func.isRequired,
  lowerTarget:        PropTypes.func.isRequired,
  inCard:             PropTypes.bool,
};
