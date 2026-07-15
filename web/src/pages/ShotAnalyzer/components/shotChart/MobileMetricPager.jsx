import { useRef, useState } from 'preact/hooks';
import { formatMetricValue } from '../../utils/analyzerUtils';

function getNextMetricPageKey(pages, activePageKey, direction) {
  if (!Array.isArray(pages) || pages.length === 0) return activePageKey;
  const activeIndex = Math.max(
    0,
    pages.findIndex(page => page.key === activePageKey),
  );
  const nextIndex = Math.min(pages.length - 1, Math.max(0, activeIndex + direction));
  return pages[nextIndex]?.key || activePageKey;
}

export function ChartMetricValue({ className = '', row }) {
  return (
    <div className={['shot-chart-value-metric', className].filter(Boolean).join(' ')}>
      <div className='shot-chart-value-metric__value-row'>
        <span className='shot-chart-value-metric__value'>
          {formatMetricValue(row.value, row.digits)}
        </span>
        <span className='shot-chart-value-metric__unit'>{row.unit}</span>
      </div>
      <div className='shot-chart-value-metric__label'>{row.label}</div>
    </div>
  );
}

export function MobileMetricValue({ row }) {
  return <ChartMetricValue className='shot-chart-compare-mobile-metric' row={row} />;
}

export function MobileMetricGrid({
  ariaLabel = 'Shot metrics',
  className = '',
  entryClassName = '',
  entries,
  footer = null,
}) {
  const hasMetrics = entries.some(entry => entry.rows.length > 0);

  if (!hasMetrics) return null;

  return (
    <div className='shot-chart-tooltip__compact-content shot-chart-tooltip__compact-content--compare-preview'>
      <div
        className={['shot-chart-compare-mobile-metrics', className].filter(Boolean).join(' ')}
        aria-label={ariaLabel}
      >
        {entries.map(({ key, rows }, index) => (
          <div
            key={key || index}
            className={['shot-chart-compare-mobile-metrics__shot', entryClassName]
              .filter(Boolean)
              .join(' ')}
          >
            {rows.map(row => (
              <MobileMetricValue key={row.key} row={row} />
            ))}
          </div>
        ))}
      </div>
      {footer}
    </div>
  );
}

export function MobileMetricPager({
  activePageKey,
  className = '',
  onPageChange,
  pages,
  renderPage,
}) {
  const pointerStartXRef = useRef(null);
  const pointerStartYRef = useRef(null);
  const [dragOffset, setDragOffset] = useState(0);
  const activeIndex = Math.max(
    0,
    pages.findIndex(page => page.key === activePageKey),
  );
  const isDragging = Math.abs(dragOffset) > 0;

  const resetDrag = () => {
    pointerStartXRef.current = null;
    pointerStartYRef.current = null;
    setDragOffset(0);
  };

  const handlePointerMove = event => {
    if (pointerStartXRef.current === null) return;
    if (event.pointerType === 'mouse' && event.buttons !== 1) return;

    const width = event.currentTarget.getBoundingClientRect().width;
    const deltaX = event.clientX - pointerStartXRef.current;
    const deltaY = event.clientY - pointerStartYRef.current;
    // Let vertical page scrolling win once the gesture is clearly not a horizontal page swipe.
    if (Math.abs(deltaY) > Math.abs(deltaX) * 1.15) {
      setDragOffset(0);
      return;
    }

    const fullPageOffset = Number.isFinite(width) && width > 0 ? width : 320;
    const edgeResistanceOffset = fullPageOffset * 0.32;
    // Edge resistance keeps the pager responsive without implying that another page exists.
    const minOffset = activeIndex < pages.length - 1 ? -fullPageOffset : -edgeResistanceOffset;
    const maxOffset = activeIndex > 0 ? fullPageOffset : edgeResistanceOffset;
    setDragOffset(Math.max(minOffset, Math.min(maxOffset, deltaX)));
  };

  const handlePointerEnd = event => {
    if (pointerStartXRef.current === null) return;
    const deltaX = event.clientX - pointerStartXRef.current;
    const deltaY = event.clientY - pointerStartYRef.current;
    resetDrag();
    if (Math.abs(deltaX) < 32 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) return;

    const nextPageKey = getNextMetricPageKey(pages, activePageKey, deltaX < 0 ? 1 : -1);
    if (nextPageKey !== activePageKey) onPageChange(nextPageKey);
  };

  return (
    <div
      className={['shot-chart-mobile-metric-pager', className].filter(Boolean).join(' ')}
      onPointerDown={event => {
        pointerStartXRef.current = event.clientX;
        pointerStartYRef.current = event.clientY;
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={resetDrag}
      onLostPointerCapture={resetDrag}
    >
      <div className='shot-chart-mobile-metric-pager__viewport'>
        <div
          className={[
            'shot-chart-mobile-metric-pager__track',
            isDragging ? 'shot-chart-mobile-metric-pager__track--dragging' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{
            transform: `translate3d(calc(${-activeIndex * 100}% + ${dragOffset}px), 0, 0)`,
          }}
        >
          {pages.map(page => (
            <div key={page.key} className='shot-chart-mobile-metric-pager__page'>
              {renderPage(page)}
            </div>
          ))}
        </div>
      </div>
      <div className='shot-chart-mobile-metric-pager__dots' aria-label='Metric pages'>
        {pages.map((page, index) => (
          <button
            type='button'
            key={page.key}
            className={[
              'shot-chart-mobile-metric-pager__dot',
              index === activeIndex ? 'shot-chart-mobile-metric-pager__dot--active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => {
              if (page.key !== activePageKey) onPageChange(page.key);
            }}
            onPointerDown={event => {
              event.stopPropagation();
            }}
            aria-label={`Show metric page ${index + 1}`}
            aria-current={index === activeIndex ? 'page' : undefined}
          />
        ))}
      </div>
    </div>
  );
}
