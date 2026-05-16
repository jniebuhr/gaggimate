import { Fragment } from 'preact';
import { useCallback, useMemo, useRef, useState } from 'preact/hooks';
import { ExtendedProfileChart } from '../../components/ExtendedProfileChart.jsx';
import { profileToKeyframes } from './keyframeProfileLogic.js';

function getChartArea(chart) {
  return chart?.chartArea || null;
}

function markerToLeft(chart, marker) {
  const area = getChartArea(chart);
  const xScale = chart?.scales?.x;
  if (!area || !xScale) return null;
  return xScale.getPixelForValue(marker.time);
}

function eventToTime(chart, event) {
  const area = getChartArea(chart);
  const xScale = chart?.scales?.x;
  if (!area || !xScale) return null;
  const rect = chart.canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  if (x < area.left || x > area.right) return null;
  return xScale.getValueForPixel(x);
}

function getValueScale(chart, marker) {
  return marker.targetMode === 'flow' ? chart?.scales?.y1 : chart?.scales?.y;
}

function markerToValueTop(chart, marker) {
  const scale = getValueScale(chart, marker);
  if (!scale) return null;
  return scale.getPixelForValue(marker.targetMode === 'flow' ? marker.flow : marker.pressure);
}

function markerToTempTop(chart, marker) {
  const scale = chart?.scales?.y2;
  if (!scale) return null;
  return scale.getPixelForValue(marker.temperature);
}

function eventToValue(chart, event, marker) {
  const scale = getValueScale(chart, marker);
  if (!scale) return null;
  const rect = chart.canvas.getBoundingClientRect();
  const y = event.clientY - rect.top;
  const value = scale.getValueForPixel(y);
  return Math.min(scale.max, Math.max(scale.min, value));
}

function eventToTemperature(chart, event) {
  const scale = chart?.scales?.y2;
  if (!scale) return null;
  const rect = chart.canvas.getBoundingClientRect();
  const y = event.clientY - rect.top;
  const value = scale.getValueForPixel(y);
  return Math.min(scale.max, Math.max(scale.min, value));
}

export function ProfileKeyframeChart({
  data,
  selectedSegmentIndex,
  onAddMarker,
  onMoveMarker,
  onUpdateMarkerValue,
  onSelectSegment,
  className = 'max-h-72 w-full',
}) {
  const [chart, setChart] = useState(null);
  const [dragging, setDragging] = useState(null);
  // null | { markerIndex: number, type: 'time' | 'value' | 'temperature' }
  const overlayRef = useRef(null);
  const markers = useMemo(() => profileToKeyframes(data), [data]);

  const handleOverlayPointerDown = useCallback(
    event => {
      if (event.target !== event.currentTarget) return;
      const time = eventToTime(chart, event);
      if (time === null) return;
      onAddMarker(time);
    },
    [chart, onAddMarker],
  );

  const handleMarkerPointerDown = useCallback(
    (event, markerIndex) => {
      event.preventDefault();
      event.stopPropagation();
      onSelectSegment(Math.max(0, markerIndex - 1));
      setDragging({ markerIndex, type: 'time' });
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [onSelectSegment],
  );

  const handleValuePointerDown = useCallback(
    (event, markerIndex) => {
      event.preventDefault();
      event.stopPropagation();
      onSelectSegment(Math.max(0, markerIndex - 1));
      setDragging({ markerIndex, type: 'value' });
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [onSelectSegment],
  );

  const handleTempPointerDown = useCallback(
    (event, markerIndex) => {
      event.preventDefault();
      event.stopPropagation();
      onSelectSegment(Math.max(0, markerIndex - 1));
      setDragging({ markerIndex, type: 'temperature' });
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [onSelectSegment],
  );

  const handleMarkerPointerMove = useCallback(
    event => {
      if (dragging === null) return;
      const { markerIndex, type } = dragging;
      if (type === 'time') {
        const time = eventToTime(chart, event);
        if (time === null) return;
        onMoveMarker(markerIndex, time);
      } else if (type === 'value') {
        const marker = markers[markerIndex];
        if (!marker) return;
        const value = eventToValue(chart, event, marker);
        if (value === null) return;
        const isFlow = marker.targetMode === 'flow';
        onUpdateMarkerValue(markerIndex, isFlow ? { flow: value } : { pressure: value });
      } else if (type === 'temperature') {
        if (!markers[markerIndex]) return;
        const temp = eventToTemperature(chart, event);
        if (temp === null) return;
        onUpdateMarkerValue(markerIndex, { temperature: temp });
      }
    },
    [chart, dragging, markers, onMoveMarker, onUpdateMarkerValue],
  );

  const stopDragging = useCallback(() => setDragging(null), []);

  return (
    <div ref={overlayRef} className='relative'>
      <ExtendedProfileChart
        data={data}
        selectedPhase={selectedSegmentIndex + 1}
        className={className}
        onChartReady={setChart}
      />
      <div
        className='absolute inset-0'
        onPointerDown={handleOverlayPointerDown}
        onPointerMove={handleMarkerPointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        style={{ cursor: 'crosshair', touchAction: 'none' }}
      >
        {chart &&
          markers.map((marker, index) => {
            const left = markerToLeft(chart, marker);
            const valueTop = markerToValueTop(chart, marker);
            const tempTop = markerToTempTop(chart, marker);
            if (left === null) return null;
            const selected = Math.max(0, index - 1) === selectedSegmentIndex;
            return (
              <Fragment key={`${index}-${marker.time}`}>
                <button
                  type='button'
                  className={`absolute top-8 bottom-8 w-4 -translate-x-1/2 border-0 bg-transparent p-0 ${index === 0 ? 'cursor-default' : 'cursor-ew-resize'}`}
                  style={{ left: `${left}px` }}
                  onPointerDown={event => {
                    event.stopPropagation();
                    if (index > 0) handleMarkerPointerDown(event, index);
                  }}
                  onClick={event => {
                    event.stopPropagation();
                    onSelectSegment(Math.max(0, index - 1));
                  }}
                  aria-label={`Select marker ${index + 1}`}
                >
                  <span
                    className={`absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 ${selected ? 'bg-primary' : 'bg-base-content/50'}`}
                  />
                </button>
                {valueTop !== null && (
                  <span
                    className={`absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize rounded-full border ${selected ? 'border-primary bg-primary' : 'border-base-content/70 bg-base-100'}`}
                    style={{ left: `${left}px`, top: `${valueTop}px` }}
                    onPointerDown={event => handleValuePointerDown(event, index)}
                  />
                )}
                {tempTop !== null && (
                  <span
                    className='absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize rounded-full border border-amber-500 bg-amber-400'
                    style={{ left: `${left}px`, top: `${tempTop}px` }}
                    onPointerDown={event => handleTempPointerDown(event, index)}
                  />
                )}
              </Fragment>
            );
          })}
      </div>
    </div>
  );
}
