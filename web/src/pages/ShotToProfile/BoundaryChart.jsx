import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { HistoryChart } from '../ShotHistory/HistoryChart.jsx';

const CHART_LEFT_PAD = 60;  // fallback when chart instance is not yet available
const CHART_RIGHT_PAD = 20; // fallback

function sampleToFraction(idx, total) {
  return idx / Math.max(1, total - 1);
}

function fractionToSample(frac, total) {
  return Math.round(Math.max(0, Math.min(1, frac)) * (total - 1));
}

/**
 * @param {{
 *   shot: object,
 *   boundaries: number[],
 *   onBoundariesChange: (boundaries: number[]) => void,
 * }} props
 */
export function BoundaryChart({ shot, boundaries, onBoundariesChange }) {
  const containerRef = useRef(null);
  const dragListenersRef = useRef(null);
  // Tracks { currentValue: number } during a drag so onMove always sees the latest position.
  const draggingRef = useRef(null);
  // Always holds the latest boundaries array so pointer-event closures avoid stale captures.
  const boundariesRef = useRef(boundaries);
  boundariesRef.current = boundaries;
  const chartInstanceRef = useRef(null);
  const [, setResizeTick] = useState(0);

  const total = shot.samples?.length ?? 1;

  useEffect(() => {
    return () => {
      if (dragListenersRef.current) {
        window.removeEventListener('pointermove', dragListenersRef.current.onMove);
        window.removeEventListener('pointerup', dragListenersRef.current.onUp);
        dragListenersRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => setResizeTick(t => t + 1));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const handleChartReady = useCallback(chart => {
    chartInstanceRef.current = chart;
  }, []);

  // Returns the pixel bounds of the Chart.js plot area within the container.
  // Falls back to the hardcoded estimates when the chart hasn't rendered yet.
  const getChartBounds = useCallback(() => {
    const chartArea = chartInstanceRef.current?.chartArea;
    const containerWidth = containerRef.current?.offsetWidth ?? 400;
    const chartLeft = chartArea?.left ?? CHART_LEFT_PAD;
    const chartRight = chartArea?.right ?? containerWidth - CHART_RIGHT_PAD;
    return { chartLeft, chartWidth: Math.max(1, chartRight - chartLeft) };
  }, []);

  const pixelToSample = useCallback(
    clientX => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return 0;
      const { chartLeft, chartWidth } = getChartBounds();
      const frac = (clientX - rect.left - chartLeft) / chartWidth;
      return fractionToSample(frac, total);
    },
    [total, getChartBounds],
  );

  const onOverlayPointerDown = useCallback(
    e => {
      if (e.target !== e.currentTarget) return;
      if (boundariesRef.current.length >= 5) return;
      const newIdx = pixelToSample(e.clientX);
      if (boundariesRef.current.includes(newIdx)) return;
      const next = [...boundariesRef.current, newIdx].sort((a, b) => a - b);
      onBoundariesChange(next);
    },
    [onBoundariesChange, pixelToSample],
  );

  // markerValue is the sample index of the marker at drag-start.
  // We track by value (not array position) so cross-marker drags stay correct after re-sorts.
  const onMarkerPointerDown = useCallback(
    (e, markerValue) => {
      e.stopPropagation();
      e.preventDefault();
      draggingRef.current = { currentValue: markerValue };

      function onMove(ev) {
        const newSample = pixelToSample(ev.clientX);
        const { currentValue } = draggingRef.current;
        const next = boundariesRef.current.map(b => (b === currentValue ? newSample : b));
        draggingRef.current.currentValue = newSample;
        onBoundariesChange(next.sort((a, b) => a - b));
      }

      function onUp() {
        dragListenersRef.current = null;
        draggingRef.current = null;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      }

      dragListenersRef.current = { onMove, onUp };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [onBoundariesChange, pixelToSample],
  );

  const onMarkerRemove = useCallback(
    (e, markerValue) => {
      e.stopPropagation();
      e.preventDefault();
      onBoundariesChange(boundariesRef.current.filter(b => b !== markerValue));
    },
    [onBoundariesChange],
  );

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <HistoryChart shot={shot} onChartReady={handleChartReady} />

      {/* Transparent overlay for clicks and markers */}
      <div
        onPointerDown={onOverlayPointerDown}
        style={{
          position: 'absolute',
          inset: 0,
          cursor: 'crosshair',
        }}
      >
        {containerRef.current &&
          boundaries.map(sampleIdx => {
            const { chartLeft, chartWidth } = getChartBounds();
            const frac = sampleToFraction(sampleIdx, total);
            const left = chartLeft + frac * chartWidth;
            return (
              <div
                key={sampleIdx}
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: `${left}px`,
                  width: '2px',
                  background: 'var(--color-primary, #d71921)',
                  cursor: 'ew-resize',
                  userSelect: 'none',
                  touchAction: 'none',
                }}
                onPointerDown={e => onMarkerPointerDown(e, sampleIdx)}
              >
                {/* Remove button */}
                <button
                  onPointerDown={e => onMarkerRemove(e, sampleIdx)}
                  style={{
                    position: 'absolute',
                    top: '4px',
                    left: '4px',
                    width: '16px',
                    height: '16px',
                    fontSize: '10px',
                    lineHeight: '16px',
                    textAlign: 'center',
                    background: 'var(--color-primary, #d71921)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                  aria-label={`Remove boundary ${boundaries.indexOf(sampleIdx) + 1}`}
                >
                  ×
                </button>
              </div>
            );
          })}
      </div>
    </div>
  );
}
