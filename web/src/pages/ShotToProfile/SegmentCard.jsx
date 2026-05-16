import { useCallback } from 'preact/hooks';

function avg(samples, field) {
  if (!samples.length) return 0;
  return samples.reduce((s, x) => s + (x[field] ?? 0), 0) / samples.length;
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * @param {{
 *   segment: import('./index.jsx').Segment,
 *   samples: object[],
 *   onChange: (patch: Partial<import('./index.jsx').Segment>) => void,
 * }} props
 */
export function SegmentCard({ segment, samples, onChange }) {
  const sliceSamples = samples.slice(segment.startIdx, segment.endIdx);
  const avgPressure = avg(sliceSamples, 'cp').toFixed(1);
  const avgFlow = avg(sliceSamples, 'fl').toFixed(2);
  const avgTemp = avg(sliceSamples, 'tt').toFixed(0);

  const handleTargetTypeChange = useCallback(
    e => {
      const t = e.target.value;
      const newVal =
        t === 'pressure'
          ? clamp(parseFloat(avgPressure) || 9, 0, 12)
          : clamp(parseFloat(avgFlow) || 2, 0, 6);
      onChange({ targetType: t, targetValue: newVal });
    },
    [avgPressure, avgFlow, onChange],
  );

  const handleTargetValueChange = useCallback(
    e => {
      const max = segment.targetType === 'pressure' ? 12 : 6;
      onChange({ targetValue: clamp(parseFloat(e.target.value) || 0, 0, max) });
    },
    [segment.targetType, onChange],
  );

  const handleTemperatureChange = useCallback(
    e => onChange({ temperature: clamp(parseInt(e.target.value, 10) || 93, 80, 105) }),
    [onChange],
  );

  const handleNameChange = useCallback(e => onChange({ name: e.target.value }), [onChange]);

  return (
    <div className='flex flex-col gap-3 rounded border border-[var(--home-border,#222)] bg-[var(--dm-bg-1,#111)] p-4 min-w-[200px]'>
      <input
        type='text'
        value={segment.name}
        onInput={handleNameChange}
        className='font-nd-mono bg-transparent text-[13px] font-bold text-[var(--text-primary,#e8e8e8)] outline-none border-b border-[var(--home-border,#333)] pb-1'
      />

      <div className='font-nd-mono text-[11px] text-[var(--text-disabled,#666)] flex flex-col gap-1'>
        <span>{segment.durationSeconds.toFixed(1)}s</span>
        <span>~{avgPressure} bar avg</span>
        <span>~{avgFlow} ml/s avg</span>
        <span>~{avgTemp}°C avg</span>
      </div>

      <div className='flex flex-col gap-2'>
        <label className='font-nd-mono text-[11px] text-[var(--text-secondary,#999)] uppercase tracking-wider'>
          Target
        </label>
        <select
          value={segment.targetType}
          onChange={handleTargetTypeChange}
          className='font-nd-mono text-[12px] bg-[var(--dm-bg-0,#0a0a0a)] text-[var(--text-primary,#e8e8e8)] border border-[var(--home-border,#333)] rounded px-2 py-1'
        >
          <option value='pressure'>Pressure (bar)</option>
          <option value='flow'>Flow (ml/s)</option>
        </select>
        <input
          type='number'
          step={segment.targetType === 'pressure' ? 0.5 : 0.1}
          min={0}
          max={segment.targetType === 'pressure' ? 12 : 6}
          value={segment.targetValue}
          onInput={handleTargetValueChange}
          className='font-nd-mono text-[12px] bg-[var(--dm-bg-0,#0a0a0a)] text-[var(--text-primary,#e8e8e8)] border border-[var(--home-border,#333)] rounded px-2 py-1 w-full'
        />
      </div>

      <div className='flex flex-col gap-2'>
        <label className='font-nd-mono text-[11px] text-[var(--text-secondary,#999)] uppercase tracking-wider'>
          Temperature (°C)
        </label>
        <input
          type='number'
          step={1}
          min={80}
          max={105}
          value={segment.temperature}
          onInput={handleTemperatureChange}
          className='font-nd-mono text-[12px] bg-[var(--dm-bg-0,#0a0a0a)] text-[var(--text-primary,#e8e8e8)] border border-[var(--home-border,#333)] rounded px-2 py-1 w-full'
        />
      </div>
    </div>
  );
}
