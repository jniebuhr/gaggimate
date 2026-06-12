import { useEffect, useRef, useState } from 'preact/hooks';
import { computed } from '@preact/signals';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlassChart } from '@fortawesome/free-solid-svg-icons/faMagnifyingGlassChart';
import { parseBinaryIndex, indexToShotList } from '../../ShotHistory/parseBinaryIndex.js';
import { parseBinaryShot } from '../../ShotHistory/parseBinaryShot.js';
import { machine } from '../../../services/ApiService.js';
import PropTypes from 'prop-types';

const isFinished = computed(() => machine.value.status?.process?.f === true);

function formatTime(timestamp) {
  if (!timestamp || timestamp < 10000) return null;
  return new Date(timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function StatCol({ value, unit, label }) {
  return (
    <div className='flex flex-col items-center gap-0.5'>
      <div className='text-base-content text-base font-bold tabular-nums'>
        {value != null ? (
          <>
            {value}
            <span className='text-base-content/60 ml-0.5 text-xs font-normal'>{unit}</span>
          </>
        ) : (
          <span className='text-base-content/30'>—</span>
        )}
      </div>
      <div className='text-base-content/50 text-[0.6rem] uppercase tracking-wide'>{label}</div>
    </div>
  );
}

function ShotMiniCard({ shot }) {
  const analyzerUrl = `/analyzer/internal/${shot.id}`;
  const time = formatTime(shot.timestamp);

  return (
    <div className='bg-base-200 relative flex flex-col gap-2 rounded-lg p-3'>
      <a
        href={analyzerUrl}
        className='text-base-content/30 hover:text-primary absolute top-2 right-2 transition-colors'
        aria-label='Open in Analyzer'
        title='Open in Analyzer'
      >
        <FontAwesomeIcon icon={faMagnifyingGlassChart} />
      </a>

      <div className='pr-6'>
        <div className='flex items-baseline gap-1.5'>
          <span className='text-sm font-bold'>shot-{shot.id}</span>
          {time && <span className='text-base-content/50 text-xs'>{time}</span>}
        </div>
        <div className='text-base-content/60 truncate text-xs'>{shot.profile || 'Unknown'}</div>
      </div>

      <div className='flex justify-between'>
        <StatCol
          value={shot.duration != null ? (shot.duration / 1000).toFixed(1) : null}
          unit='s'
          label='Duration'
        />
        <StatCol
          value={shot.volume != null ? shot.volume.toFixed(1) : null}
          unit='g'
          label='Weight'
        />
        <StatCol
          value={shot.maxPressure != null ? shot.maxPressure.toFixed(1) : null}
          unit='bar'
          label='Pressure'
        />
      </div>
    </div>
  );
}

ShotMiniCard.propTypes = {
  shot: PropTypes.object.isRequired,
};

export function RecentShotsCard() {
  const [shots, setShots] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const prevFinishedRef = useRef(false);

  // Trigger a refresh when a shot transitions to finished
  useEffect(() => {
    const finished = isFinished.value;
    if (finished && !prevFinishedRef.current) {
      setRefreshKey(k => k + 1);
    }
    prevFinishedRef.current = finished;
  }, [isFinished.value]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const resp = await fetch('/api/history/index.bin');
        if (!resp.ok || cancelled) return;
        const buf = await resp.arrayBuffer();
        const list = indexToShotList(parseBinaryIndex(buf)).slice(0, 4);
        if (cancelled) return;
        setShots(list);

        // Load binaries sequentially to avoid overwhelming the ESP32
        for (const shot of list) {
          if (cancelled) break;
          try {
            const paddedId = shot.id.toString().padStart(6, '0');
            const slogResp = await fetch(`/api/history/${paddedId}.slog`);
            if (!slogResp.ok || cancelled) continue;
            const slogBuf = await slogResp.arrayBuffer();
            const parsed = parseBinaryShot(slogBuf, shot.id);
            const maxPressure =
              Array.isArray(parsed.samples) && parsed.samples.length > 0
                ? Math.max(...parsed.samples.map(s => s.cp ?? 0))
                : null;
            if (cancelled) break;
            setShots(prev =>
              prev.map(s => (s.id === shot.id ? { ...s, maxPressure } : s)),
            );
          } catch {
            // Skip shot if binary load fails
          }
        }
      } catch {
        // Index unavailable
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (shots.length === 0) return null;

  return (
    <div className='card bg-base-100 flex flex-col gap-2 rounded-xl p-3'>
      <div className='text-base-content/50 text-[0.6rem] uppercase tracking-wider'>Recent Shots</div>
      <div className='grid grid-cols-4 gap-3'>
        {shots.map(shot => (
          <ShotMiniCard key={shot.id} shot={shot} />
        ))}
      </div>
    </div>
  );
}
