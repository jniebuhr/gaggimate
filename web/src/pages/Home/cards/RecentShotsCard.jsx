import { useEffect, useRef, useState } from 'preact/hooks';
import { computed, useSignalEffect } from '@preact/signals';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlassChart } from '@fortawesome/free-solid-svg-icons/faMagnifyingGlassChart';
import { parseBinaryIndex, indexToShotList } from '../../ShotHistory/parseBinaryIndex.js';
import { parseBinaryShot } from '../../ShotHistory/parseBinaryShot.js';
import { machine } from '../../../services/ApiService.js';
import { cleanName } from '../../ShotAnalyzer/utils/analyzerUtils.js';
import {
  shotMetricSlotsSignal,
  clock24hSignal,
} from '../../../utils/dashboardManager.js';
import PropTypes from 'prop-types';

const isFinished = computed(() => {
  const p = machine.value.status?.process;
  return !!p?.e && !p?.a;
});

// Compares calendar dates, not raw milliseconds, so 11:59 PM yesterday
// correctly reads as "Yesterday" even if less than 24 h ago.
function getRelativeDayLabel(timestamp) {
  if (!timestamp || timestamp < 10000) return '';
  const d = new Date(timestamp * 1000);
  const today = new Date();
  const shotDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.round((todayDay - shotDay) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long' });
}

function formatShotDateTime(timestamp, hour12) {
  if (!timestamp || timestamp < 10000) return '';
  return new Date(timestamp * 1000).toLocaleString([], {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12,
  });
}

const METRIC_DEFS = {
  duration: {
    label: 'Duration',
    unit: 's',
    getValue: shot => (shot.duration != null ? (shot.duration / 1000).toFixed(1) : null),
  },
  weight: {
    label: 'Weight',
    unit: 'g',
    getValue: shot => (shot.volume != null ? shot.volume.toFixed(1) : null),
  },
  avgTemp: {
    label: 'Temperature',
    unit: '°C',
    getValue: shot => (shot.avgTemp != null ? shot.avgTemp.toFixed(1) : null),
  },
  maxPressure: {
    label: 'Pressure',
    unit: 'bar',
    getValue: shot => (shot.maxPressure != null ? shot.maxPressure.toFixed(1) : null),
  },
  avgFlow: {
    label: 'Flow',
    unit: 'ml/s',
    getValue: shot => (shot.avgFlow != null ? shot.avgFlow.toFixed(2) : null),
  },
};

function ShotMiniCard({ shot, slots }) {
  const analyzerUrl = `/analyzer/internal/${shot.id}`;
  const profileLabel = cleanName(shot.profile || 'Unknown');
  const dateLabel = formatShotDateTime(shot.timestamp, !clock24hSignal.value);

  return (
    <div className='app-card-surface bg-base-200 flex min-w-0 flex-col rounded-xl p-3 lg:p-2.5 xl:p-3'>
      <div className='flex min-w-0 items-start gap-2'>
        <div className='min-w-0 flex-1'>
          <div className='text-base-content truncate text-sm font-semibold'>
            shot-{shot.id}
            <span className='text-base-content/45 ml-1.5 text-xs font-normal'>
              · {getRelativeDayLabel(shot.timestamp)}
            </span>
          </div>
          <div className='text-base-content/60 truncate text-xs'>{profileLabel}</div>
        </div>
        <a
          href={analyzerUrl}
          className='text-base-content/30 hover:text-primary shrink-0 text-xs transition-colors'
          aria-label='Open in Analyzer'
          title='Open in Analyzer'
        >
          <FontAwesomeIcon icon={faMagnifyingGlassChart} />
        </a>
      </div>

      <div className='mt-1.5 flex gap-2 lg:gap-1.5 xl:gap-2'>
        {slots.map(slotId => {
          const def = METRIC_DEFS[slotId];
          const value = def ? def.getValue(shot) : null;
          return (
            <div key={slotId} className='min-w-0 flex-1 text-center'>
              <div className='flex items-baseline justify-center gap-1.5 lg:gap-1 xl:gap-1.5'>
                <span className='text-base-content text-sm font-bold'>
                  {value ?? '—'}
                </span>
                {value != null && def && (
                  <span className='text-base-content/55 text-xs lg:text-[0.68rem] xl:text-xs'>
                    {def.unit}
                  </span>
                )}
              </div>
              <div className='text-base-content/50 text-[0.6rem] font-semibold tracking-wider uppercase'>
                {def?.label ?? slotId}
              </div>
            </div>
          );
        })}
      </div>

      <div className='mt-1'>
        <span className='text-base-content/45 text-xs italic'>{dateLabel}</span>
      </div>
    </div>
  );
}

ShotMiniCard.propTypes = {
  shot: PropTypes.object.isRequired,
  slots: PropTypes.arrayOf(PropTypes.string).isRequired,
};

export function RecentShotsCard() {
  const [shots, setShots] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const prevFinishedRef = useRef(false);
  const slots = shotMetricSlotsSignal.value;

  // Trigger a refresh when a shot transitions to finished
  useSignalEffect(() => {
    const finished = isFinished.value;
    if (finished && !prevFinishedRef.current) {
      setRefreshKey(k => k + 1);
    }
    prevFinishedRef.current = finished;
  });

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

        // Determine which slog-computed metrics are actually needed
        const needsAvgTemp = slots.includes('avgTemp');
        const needsMaxPressure = slots.includes('maxPressure');
        const needsAvgFlow = slots.includes('avgFlow');
        const needsSlog = needsAvgTemp || needsMaxPressure || needsAvgFlow;

        if (!needsSlog) return;

        // Load binaries sequentially to avoid overwhelming the ESP32
        for (const shot of list) {
          if (cancelled) break;
          try {
            const paddedId = shot.id.toString().padStart(6, '0');
            const slogResp = await fetch(`/api/history/${paddedId}.slog`);
            if (!slogResp.ok || cancelled) continue;
            const slogBuf = await slogResp.arrayBuffer();
            const parsed = parseBinaryShot(slogBuf, shot.id);
            const samples = parsed.samples ?? [];

            const update = {};

            if (needsMaxPressure) {
              update.maxPressure =
                samples.length > 0 ? Math.max(...samples.map(s => s.cp ?? 0)) : null;
            }
            if (needsAvgTemp) {
              const ctSamples = samples.filter(s => s.ct != null);
              update.avgTemp =
                ctSamples.length > 0
                  ? ctSamples.reduce((sum, s) => sum + s.ct, 0) / ctSamples.length
                  : null;
            }
            if (needsAvgFlow) {
              const flSamples = samples.filter(s => s.fl != null && s.fl > 0);
              update.avgFlow =
                flSamples.length > 0
                  ? flSamples.reduce((sum, s) => sum + s.fl, 0) / flSamples.length
                  : null;
            }

            if (cancelled) break;
            setShots(prev => prev.map(s => (s.id === shot.id ? { ...s, ...update } : s)));
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
  }, [refreshKey, slots]);

  if (shots.length === 0) return null;

  return (
    <div className='card bg-base-100 flex flex-col gap-2 rounded-xl p-3'>
      <div className='text-base-content/50 text-[0.6rem] uppercase tracking-wider'>Recent Shots</div>
      <div className='grid grid-cols-4 gap-3'>
        {shots.map(shot => (
          <ShotMiniCard key={shot.id} shot={shot} slots={slots} />
        ))}
      </div>
    </div>
  );
}
