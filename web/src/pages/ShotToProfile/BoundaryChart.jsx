import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { HistoryChart } from '../ShotHistory/HistoryChart.jsx';

const CHART_LEFT_PAD = 60;  // approximate Chart.js y-axis width
const CHART_RIGHT_PAD = 20; // approximate Chart.js right padding

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
  const [dragging, setDragging] = useState(null); // { markerIdx, startX, origBoundary }
  const [, setResizeTick] = useState(0);

  const total = shot.samples?.length ?? 1;

  useEffect(() => {
    return () => {
      if (dragListenersRef.current) {
        window.removeEventListener('mousemove', dragListenersRef.current.onMove);
        window.removeEventListener('mouseup', dragListenersRef.current.onUp);
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

  const pixelToSample = useCallback(
    clientX => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return 0;
      const w = containerRef.current?.offsetWidth ?? 400;
      const contentWidth = Math.max(1, w - CHART_LEFT_PAD - CHART_RIGHT_PAD);
      const relX = clientX - rect.left - CHART_LEFT_PAD;
      const frac = relX / contentWidth;
      return fractionToSample(frac, total);
    },
    [total],
  );

  const onOverlayMouseDown = useCallback(
    e => {
      // Clicking the overlay (not a marker) adds a new boundary
      if (e.target !== e.currentTarget) return;
      if (boundaries.length >= 5) return; // cap at MAX_BOUNDARIES
      const newIdx = pixelToSample(e.clientX);
      if (boundaries.includes(newIdx)) return;
      const next = [...boundaries, newIdx].sort((a, b) => a - b);
      onBoundariesChange(next);
    },
    [boundaries, onBoundariesChange, pixelToSample],
  );

  const onMarkerMouseDown = useCallback(
    (e, markerIdx) => {
      e.stopPropagation();
      e.preventDefault();
      setDragging({ markerIdx, origBoundary: boundaries[markerIdx] });

      function onMove(ev) {
        const newSample = pixelToSample(ev.clientX);
        const next = boundaries.map((b, i) => (i === markerIdx ? newSample : b));
        onBoundariesChange(next.sort((a, b) => a - b));
      }

      function onUp() {
        dragListenersRef.current = null;
        setDragging(null);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      }

      dragListenersRef.current = { onMove, onUp };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [boundaries, onBoundariesChange, pixelToSample],
  );

  const onMarkerRemove = useCallback(
    (e, markerIdx) => {
      e.stopPropagation();
      e.preventDefault();
      onBoundariesChange(boundaries.filter((_, i) => i !== markerIdx));
    },
    [boundaries, onBoundariesChange],
  );

  // Suppress unused variable warning — dragging is used to track drag state
  void dragging;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <HistoryChart shot={shot} />

      {/* Transparent overlay for clicks and markers */}
      <div
        onMouseDown={onOverlayMouseDown}
        style={{
          position: 'absolute',
          inset: 0,
          cursor: 'crosshair',
        }}
      >
        {containerRef.current &&
          boundaries.map((sampleIdx, i) => {
            const w = containerRef.current.offsetWidth;
            const cw = Math.max(1, w - CHART_LEFT_PAD - CHART_RIGHT_PAD);
            const frac = sampleToFraction(sampleIdx, total);
            const left = CHART_LEFT_PAD + frac * cw;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: `${left}px`,
                  width: '2px',
                  background: 'var(--color-primary, #d71921)',
                  cursor: 'ew-resize',
                  userSelect: 'none',
                }}
                onMouseDown={e => onMarkerMouseDown(e, i)}
              >
                {/* Remove button */}
                <button
                  onMouseDown={e => onMarkerRemove(e, i)}
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
                  aria-label={`Remove boundary ${i + 1}`}
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
