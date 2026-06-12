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

export function MetricsGrid({ metrics = [], inCard = false }) {
  return (
    <div className='grid grid-cols-2 gap-2'>
      {metrics.map((m, i) => {
        const isLastOdd = metrics.length % 2 !== 0 && i === metrics.length - 1;
        return (
          <div key={m.id} className={isLastOdd ? 'col-span-2' : undefined}>
            <MetricCell
              label={m.label}
              current={m.current}
              target={m.target}
              unit={m.unit}
              adjustable={m.adjustable}
              onDecrease={m.onDecrease}
              onIncrease={m.onIncrease}
              inCard={inCard}
            />
          </div>
        );
      })}
    </div>
  );
}

MetricsGrid.propTypes = {
  metrics: PropTypes.arrayOf(
    PropTypes.shape({
      id:         PropTypes.string.isRequired,
      label:      PropTypes.string.isRequired,
      current:    PropTypes.string,
      target:     PropTypes.string,
      unit:       PropTypes.string,
      adjustable: PropTypes.bool,
      onDecrease: PropTypes.func,
      onIncrease: PropTypes.func,
    })
  ).isRequired,
  inCard: PropTypes.bool,
};
