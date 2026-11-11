import { useEffect, useRef, useState } from 'preact/hooks';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMinus } from '@fortawesome/free-solid-svg-icons/faMinus';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import {
  metricsColumnsSignal,
  metricsLastRowFillSignal,
  METRICS_LAST_ROW_FILLS,
} from '../../../utils/dashboardManager.js';

function AdjBtn({ icon, onClick, visible, disabled }) {
  if (!visible) return <span className='h-6 w-6 shrink-0' />;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className='btn btn-ghost btn-xs flex h-6 w-6 items-center justify-center rounded-full p-0'
    >
      <FontAwesomeIcon icon={icon} className='h-2.5 w-2.5' />
    </button>
  );
}

function MetricCell({
  label,
  current,
  target,
  unit,
  onDecrease,
  onIncrease,
  adjustable,
  onClick,
  active = false,
  hint = null,
  ariaLabel,
  disabled = false,
  inCard = false,
  compact = false,
}) {
  const showAdj = adjustable && !compact;
  const Wrapper = onClick ? 'button' : 'div';
  const wrapperProps = onClick
    ? {
        type: 'button',
        onClick,
        disabled,
        'aria-label': ariaLabel || label,
        'aria-pressed': active,
      }
    : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={`flex w-full flex-col items-center justify-between rounded-xl text-center ${compact ? 'gap-0.5 p-1' : 'gap-1 p-2'} ${active ? 'border-error/30 bg-error/10 border' : inCard ? 'bg-base-200/60' : 'card bg-base-100'} ${onClick ? 'enabled:hover:bg-base-200/90 focus-visible:outline-primary transition-colors focus-visible:outline-2 enabled:cursor-pointer' : ''}`}
    >
      <div
        className={`${active ? 'text-error' : 'text-base-content/50'} text-[0.6rem] font-semibold tracking-wider uppercase`}
      >
        {label}
      </div>
      <div className='flex w-full items-center justify-between'>
        {!compact && (
          <AdjBtn icon={faMinus} onClick={onDecrease} visible={showAdj} disabled={disabled} />
        )}
        <div className='flex-1 text-center tabular-nums'>
          <span className={`${active ? 'text-error' : 'text-base-content'} text-sm font-bold`}>
            {current}
          </span>
          {target != null && (
            <>
              <span className='text-base-content/30 mx-0.5 text-xs'>/</span>
              <span className='text-success text-xs font-semibold'>
                {target}
                {unit}
              </span>
            </>
          )}
        </div>
        {!compact && (
          <AdjBtn icon={faPlus} onClick={onIncrease} visible={showAdj} disabled={disabled} />
        )}
      </div>
      {hint && (
        <div className={`${active ? 'text-error/80' : 'text-base-content/45'} text-[0.62rem]`}>
          {hint}
        </div>
      )}
    </Wrapper>
  );
}

function MetricCellItem({ m, inCard, compact }) {
  return (
    <MetricCell
      label={m.label}
      current={m.current}
      target={m.target}
      unit={m.unit}
      adjustable={m.adjustable}
      disabled={m.disabled}
      onDecrease={m.onDecrease}
      onIncrease={m.onIncrease}
      onClick={m.onClick}
      active={m.active}
      hint={m.hint}
      ariaLabel={m.ariaLabel}
      inCard={inCard}
      compact={compact}
    />
  );
}

export function MetricsGrid({ metrics = [], inCard = false, compact = false }) {
  const containerRef = useRef(null);
  const userCols = metricsColumnsSignal.value;
  const lastRowFill = metricsLastRowFillSignal.value;
  const [effectiveCols, setEffectiveCols] = useState(userCols);
  const minCellWidth = compact ? 90 : 125;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const initialWidth = el.getBoundingClientRect().width;
    setEffectiveCols(Math.max(1, Math.min(userCols, Math.floor(initialWidth / minCellWidth))));
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      setEffectiveCols(Math.max(1, Math.min(userCols, Math.floor(width / minCellWidth))));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [userCols, minCellWidth]);

  const gap = compact ? 'gap-1' : 'gap-2';
  const remainder = metrics.length % effectiveCols;
  const fullRows = remainder === 0 ? metrics : metrics.slice(0, -remainder);
  const lastRow = remainder === 0 ? [] : metrics.slice(-remainder);

  return (
    <div ref={containerRef}>
      <div
        className={`grid ${gap}`}
        style={{ gridTemplateColumns: `repeat(${effectiveCols}, 1fr)` }}
      >
        {fullRows.map(m => (
          <MetricCellItem key={m.id} m={m} inCard={inCard} compact={compact} />
        ))}
      </div>
      {lastRow.length > 0 &&
        (lastRowFill === METRICS_LAST_ROW_FILLS.EVEN ? (
          <div className={`flex ${gap} ${compact ? 'mt-1' : 'mt-2'}`}>
            {lastRow.map(m => (
              <div key={m.id} style={{ flex: 1 }}>
                <MetricCellItem m={m} inCard={inCard} compact={compact} />
              </div>
            ))}
          </div>
        ) : (
          <div
            className={`grid ${gap} ${compact ? 'mt-1' : 'mt-2'}`}
            style={{ gridTemplateColumns: `repeat(${effectiveCols}, 1fr)` }}
          >
            {lastRow.map(m => (
              <MetricCellItem key={m.id} m={m} inCard={inCard} compact={compact} />
            ))}
          </div>
        ))}
    </div>
  );
}

MetricsGrid.propTypes = {
  metrics: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      current: PropTypes.string,
      target: PropTypes.string,
      unit: PropTypes.string,
      adjustable: PropTypes.bool,
      disabled: PropTypes.bool,
      onDecrease: PropTypes.func,
      onIncrease: PropTypes.func,
      onClick: PropTypes.func,
      active: PropTypes.bool,
      hint: PropTypes.string,
      ariaLabel: PropTypes.string,
    }),
  ).isRequired,
  inCard: PropTypes.bool,
  compact: PropTypes.bool,
};
