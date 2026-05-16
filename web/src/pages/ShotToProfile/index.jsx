import { useCallback, useEffect, useState } from 'preact/hooks';
import { useLocation, useRoute } from 'preact-iso';
import { detectPhases } from './detectPhases.js';
import { buildProfile } from './buildProfile.js';
import { setPendingProfile } from '../../state/pendingProfile.js';
import { BoundaryChart } from './BoundaryChart.jsx';
import { SegmentCard } from './SegmentCard.jsx';
import { Spinner } from '../../components/Spinner.jsx';
import { parseBinaryShot } from '../ShotHistory/parseBinaryShot.js';

/** @typedef {{ name: string, startIdx: number, endIdx: number, durationSeconds: number, targetType: 'pressure'|'flow', targetValue: number, temperature: number }} Segment */

function avg(samples, field) {
  if (!samples.length) return 0;
  return samples.reduce((s, x) => s + (x[field] ?? 0), 0) / samples.length;
}

function sdev(samples, field) {
  if (!samples.length) return 0;
  const mean = avg(samples, field);
  return Math.sqrt(samples.reduce((s, x) => s + ((x[field] ?? 0) - mean) ** 2, 0) / samples.length);
}

function isFlowTargetedShot(samples) {
  if (!samples.length) return false;
  const meanTf = avg(samples, 'tf');
  if (meanTf <= 0) return false;
  const meanTp = avg(samples, 'tp');
  if (meanTp <= 0) return true;
  // The actively controlled variable is held tighter relative to its setpoint.
  // Normalising by the target makes the comparison scale-independent (bar vs ml/s)
  // and avoids false positives when fl happens to equal the flow limit on average.
  const relStdFl = sdev(samples, 'fl') / meanTf;
  const relStdCp = sdev(samples, 'cp') / meanTp;
  return relStdFl < relStdCp;
}

function boundariesToSegments(boundaries, samples) {
  const breakpoints = [0, ...boundaries, samples.length];
  return breakpoints.slice(0, -1).map((start, i) => {
    const end = breakpoints[i + 1];
    const slice = samples.slice(start, end);
    const durationSeconds =
      slice.length > 0 && end <= samples.length && start < samples.length
        ? (samples[end - 1].t - samples[start].t) / 1000
        : 0;
    const isFlow = isFlowTargetedShot(slice);
    const targetType = isFlow ? 'flow' : 'pressure';
    const targetValue = parseFloat(
      (targetType === 'pressure' ? avg(slice, 'tp') : avg(slice, 'tf')).toFixed(
        targetType === 'pressure' ? 1 : 2,
      ),
    );
    return {
      name: `Phase ${i + 1}`,
      startIdx: start,
      endIdx: end,
      durationSeconds,
      targetType,
      targetValue: targetValue || (targetType === 'pressure' ? 9 : 2),
      temperature: Math.round(avg(slice, 'tt')) || 93,
    };
  });
}

export function ShotToProfile() {
  const { params } = useRoute();
  const location = useLocation();
  const shotId = parseInt(params.id, 10);

  const [shot, setShot] = useState(null);
  const [error, setError] = useState(null);
  const [boundaries, setBoundaries] = useState(null); // null = not yet computed
  const [segments, setSegments] = useState([]);
  const [profileName, setProfileName] = useState('');

  // Fetch and parse the shot binary
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const paddedId = String(shotId).padStart(6, '0');
        const res = await fetch(`/api/history/${paddedId}.slog`, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        const parsed = parseBinaryShot(buf, shotId);
        setShot(parsed);

        const date = new Date((parsed.timestamp ?? 0) * 1000);
        setProfileName(
          `Manual ${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        );

        // Run phase detection
        const isFlow = parsed.samples.length > 0 && isFlowTargetedShot(parsed.samples);
        const detected = detectPhases(parsed.samples, isFlow);
        setBoundaries(detected);
        setSegments(boundariesToSegments(detected, parsed.samples));
      } catch (e) {
        if (e.name !== 'AbortError') setError(e.message);
      }
    }
    load();
    return () => controller.abort();
  }, [shotId]);

  // Recompute segments whenever boundaries change
  const handleBoundariesChange = useCallback(
    next => {
      setBoundaries(next);
      if (shot) setSegments(boundariesToSegments(next, shot.samples));
    },
    [shot],
  );

  const handleSegmentChange = useCallback((idx, patch) => {
    setSegments(prev => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }, []);

  const handleGenerate = useCallback(() => {
    const profile = buildProfile(profileName, segments);
    setPendingProfile(profile);
    location.route('/profiles/new');
  }, [profileName, segments, location]);

  if (error) {
    return (
      <div className='flex flex-col items-center justify-center gap-4 py-16'>
        <p className='font-nd-mono text-[var(--color-error,#d71921)]'>Failed to load shot: {error}</p>
        <button className='nd-action-btn' onClick={() => location.route('/history')}>
          Back to History
        </button>
      </div>
    );
  }

  if (!shot || boundaries === null) {
    return (
      <div className='flex items-center justify-center py-16'>
        <Spinner size={8} />
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-6'>
      <div className='flex flex-row items-center gap-3'>
        <button
          className='nd-action-btn'
          onClick={() => location.route('/history')}
          aria-label='Back to history'
        >
          ←
        </button>
        <h2 className='flex-grow text-2xl font-bold'>Convert Shot to Profile</h2>
      </div>

      <p className='font-nd-mono text-[13px] text-[var(--text-secondary,#999)]'>
        Drag the red markers to adjust phase boundaries. Click on the chart to add a boundary. Click × on a marker to remove it.
      </p>

      <BoundaryChart shot={shot} boundaries={boundaries} onBoundariesChange={handleBoundariesChange} />

      <div className='flex flex-row gap-3 overflow-x-auto pb-2'>
        {segments.map((seg, i) => (
          <SegmentCard
            key={i}
            segment={seg}
            samples={shot.samples}
            onChange={patch => handleSegmentChange(i, patch)}
          />
        ))}
      </div>

      <div className='flex flex-row flex-wrap items-center gap-3 border-t border-[var(--home-border,#222)] pt-4'>
        <input
          type='text'
          value={profileName}
          onInput={e => setProfileName(e.target.value)}
          placeholder='Profile name'
          aria-label='Profile name'
          className='font-nd-mono flex-grow text-[13px] bg-[var(--dm-bg-0,#0a0a0a)] text-[var(--text-primary,#e8e8e8)] border border-[var(--home-border,#333)] rounded px-3 py-2 min-w-[200px]'
        />
        <button
          className='nd-action-btn'
          onClick={() => location.route('/history')}
        >
          Cancel
        </button>
        <button
          className='nd-action-btn nd-action-btn--primary'
          onClick={handleGenerate}
          disabled={!profileName.trim() || segments.length === 0}
        >
          Generate Profile →
        </button>
      </div>
    </div>
  );
}
