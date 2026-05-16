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

function markerToValueTop(chart, marker) {
  const isFlow = marker.targetMode === 'flow';
  const scale = isFlow ? chart?.scales?.y1 : chart?.scales?.y;
  if (!scale) return null;
  return scale.getPixelForValue(isFlow ? marker.flow : marker.pressure);
}

function markerToTempTop(chart, marker) {
  const scale = chart?.scales?.y2;
  if (!scale) return null;
  return scale.getPixelForValue(marker.temperature);
}

function eventToValue(chart, event, marker) {
  const isFlow = marker.targetMode === 'flow';
  const scale = isFlow ? chart?.scales?.y1 : chart?.scales?.y;
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
            if (left === null) return null;
            const selected = Math.max(0, index - 1) === selectedSegmentIndex;
            return (
              <button
                key={`${index}-${marker.time}`}
                type='button'
                className={`absolute top-8 bottom-8 w-4 -translate-x-1/2 border-0 bg-transparent p-0 ${index === 0 ? 'cursor-default' : 'cursor-ew-resize'}`}
                style={{ left: `${left}px` }}
                onPointerDown={event => index > 0 && handleMarkerPointerDown(event, index)}
                onClick={event => {
                  event.stopPropagation();
                  onSelectSegment(Math.max(0, index - 1));
                }}
                aria-label={`Select marker ${index + 1}`}
              >
                <span
                  className={`absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 ${selected ? 'bg-primary' : 'bg-base-content/50'}`}
                />
                <span
                  className={`absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border ${selected ? 'border-primary bg-primary' : 'border-base-content/70 bg-base-100'}`}
                />
              </button>
            );
          })}
      </div>
    </div>
  );
}
