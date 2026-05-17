import { useCallback, useEffect, useState } from 'preact/hooks';
import { useLocation, useRoute } from 'preact-iso';
import { detectPhases } from './detectPhases.js';
import { buildProfile } from './buildProfile.js';
import { setPendingProfile } from '../../state/pendingProfile.js';
import { BoundaryChart } from './BoundaryChart.jsx';
import { SegmentCard } from './SegmentCard.jsx';
import { Spinner } from '../../components/Spinner.jsx';
import { parseBinaryShot } from '../ShotHistory/parseBinaryShot.js';
import { avg } from '../../utils/shotMath.js';

/** @typedef {{ name: string, startIdx: number, endIdx: number, durationSeconds: number, targetType: 'pressure'|'flow', targetValue: number, temperature: number }} Segment */

// Minimum setpoint to treat as intentional — guards against near-zero sensor noise
// causing division blow-up in the normalised tracking error.
const MIN_SETPOINT = 0.05;

function isFlowTargetedShot(samples) {
  if (!samples.length) return false;
  const meanTf = avg(samples, 'tf');
  if (meanTf < MIN_SETPOINT) return false;
  const meanTp = avg(samples, 'tp');
  if (meanTp < MIN_SETPOINT) return true;
  // Compare normalised tracking error: the controlled variable's average reading
  // stays proportionally closer to its setpoint than the free variable does.
  // Scale-independent (bar vs ml/s). Variance-only checks fail when fl is
  // unusually flat on a pressure shot; explicit mode storage in the shot binary
  // would be the definitive fix for genuinely ambiguous cases.
  const relErrFl = Math.abs(avg(samples, 'fl') / meanTf - 1);
  const relErrCp = Math.abs(avg(samples, 'cp') / meanTp - 1);
  return relErrFl < relErrCp;
}

function boundariesToSegments(boundaries, samples, isFlowTargeted) {
  const breakpoints = [0, ...boundaries, samples.length];
  return breakpoints.slice(0, -1).map((start, i) => {
    const end = breakpoints[i + 1];
    const slice = samples.slice(start, end);
    const durationSeconds =
      slice.length > 0 && end <= samples.length && start < samples.length
        ? (samples[end - 1].t - samples[start].t) / 1000
        : 0;
    const targetType = isFlowTargeted ? 'flow' : 'pressure';
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
  const [isFlowTargeted, setIsFlowTargeted] = useState(false);

  // Fetch and parse the shot binary
  useEffect(() => {
    if (!Number.isInteger(shotId) || shotId <= 0) {
      setError('Invalid shot ID');
      return;
    }
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

        // Manual shots on Gaggia are always pressure-controlled; skip the heuristic.
        // For profiled shots, infer mode from the sample data.
        const isFlow =
          parsed.profileId !== 'manual' &&
          parsed.samples.length > 0 &&
          isFlowTargetedShot(parsed.samples);
        setIsFlowTargeted(isFlow);
        const detected = detectPhases(parsed.samples, isFlow);
        setBoundaries(detected);
        setSegments(boundariesToSegments(detected, parsed.samples, isFlow));
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
      if (shot) setSegments(boundariesToSegments(next, shot.samples, isFlowTargeted));
    },
    [shot, isFlowTargeted],
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
            key={seg.startIdx}
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
