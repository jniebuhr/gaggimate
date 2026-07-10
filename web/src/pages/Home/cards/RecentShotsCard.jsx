import { useContext, useEffect, useRef, useState } from 'preact/hooks';
import { useSignalEffect } from '@preact/signals';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlassChart } from '@fortawesome/free-solid-svg-icons/faMagnifyingGlassChart';
import { parseBinaryIndex, indexToShotList } from '../../ShotHistory/parseBinaryIndex.js';
import { ApiServiceContext } from '../../../services/ApiService.js';
import { cleanName } from '../../ShotAnalyzer/utils/analyzerUtils.js';
import {
  shotMetricSlotsSignal,
  clock24hSignal,
  recentShotCountSignal,
} from '../../../utils/dashboardManager.js';
import PropTypes from 'prop-types';
import { SkeletonBlock } from '../../../components/SkeletonBlock.jsx';

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

async function loadRecentShots(recentShotCount) {
  // Same binary format as index.bin, truncated server-side to the newest entries.
  const resp = await fetch(`/api/history/recent.bin?limit=${recentShotCount}`);
  if (!resp.ok) return [];
  const buf = await resp.arrayBuffer();
  return indexToShotList(parseBinaryIndex(buf)).slice(0, recentShotCount);
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
    <div className='app-card-surface bg-base-200 flex min-w-0 flex-row items-center gap-3 rounded-xl p-3 sm:flex-col sm:items-stretch lg:p-2.5 xl:p-3'>
      {/* Identity — left on mobile, top on sm+ */}
      <div className='flex min-w-0 flex-1 items-start gap-2'>
        <div className='min-w-0 flex-1'>
          <div className='text-base-content truncate text-sm font-semibold'>
            shot-{shot.id}
            <span className='text-base-content/45 ml-1.5 text-xs font-normal'>
              · {getRelativeDayLabel(shot.timestamp)}
            </span>
          </div>
          <div className='text-base-content/60 truncate text-xs'>{profileLabel}</div>
          {/* Date shown below profile on mobile only */}
          <div className='mt-0.5 sm:hidden'>
            <span className='text-base-content/45 text-xs italic'>{dateLabel}</span>
          </div>
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

      {/* Metrics — right on mobile, below identity on sm+ */}
      <div className='flex shrink-0 gap-2 sm:mt-1.5 lg:gap-1.5 xl:gap-2'>
        {slots.map(slotId => {
          const def = METRIC_DEFS[slotId];
          const value = def ? def.getValue(shot) : null;
          return (
            <div key={slotId} className='min-w-0 flex-1 text-center'>
              <div className='flex items-baseline justify-center gap-1.5 lg:gap-1 xl:gap-1.5'>
                <span className='text-base-content text-sm font-bold'>{value ?? '—'}</span>
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

      {/* Date shown below metrics on sm+ only */}
      <div className='mt-1 hidden sm:block'>
        <span className='text-base-content/45 text-xs italic'>{dateLabel}</span>
      </div>
    </div>
  );
}

ShotMiniCard.propTypes = {
  shot: PropTypes.object.isRequired,
  slots: PropTypes.arrayOf(PropTypes.string).isRequired,
};

function ShotMiniCardSkeleton({ slots }) {
  return (
    <div className='bg-base-200 flex min-w-0 flex-col gap-2 rounded-xl p-3'>
      <SkeletonBlock className='h-2.5 w-3/4' />
      <SkeletonBlock className='h-2 w-1/2' />
      <div className='mt-1 flex gap-2'>
        {slots.map((_, i) => (
          <div key={i} className='flex flex-1 flex-col items-center gap-1'>
            <SkeletonBlock className='h-3.5 w-7' />
            <SkeletonBlock className='h-2 w-6' />
          </div>
        ))}
      </div>
      <SkeletonBlock className='h-2 w-3/5' />
    </div>
  );
}

ShotMiniCardSkeleton.propTypes = {
  slots: PropTypes.arrayOf(PropTypes.string).isRequired,
};

export function RecentShotsCard() {
  const apiService = useContext(ApiServiceContext);
  const [shots, setShots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const countMountedRef = useRef(false);
  const slots = shotMetricSlotsSignal.value;

  // Trigger a refresh once the firmware confirms a shot was actually
  // persisted to history. Brew-process state (isActive/isFinished) can go
  // inactive well before extended recording (BLE scale weight settling)
  // finishes writing the entry, so we listen for the explicit save event
  // instead of inferring timing from process state.
  useEffect(() => {
    if (!apiService) return;
    const listenerId = apiService.on('evt:history-shot-saved', () => {
      setRefreshKey(k => k + 1);
    });
    return () => apiService.off('evt:history-shot-saved', listenerId);
  }, [apiService]);

  // Trigger a refresh when the count setting changes.
  // Guarded so the initial mount-time subscribe call doesn't itself count as
  // a "change" and trigger a redundant fetch alongside the mount-time fetch
  // already performed by the useEffect below.
  useSignalEffect(() => {
    void recentShotCountSignal.value;
    if (countMountedRef.current) {
      setRefreshKey(k => k + 1);
    } else {
      countMountedRef.current = true;
    }
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const list = await loadRecentShots(recentShotCountSignal.value);
        if (cancelled) return;
        setShots(list);
        setLoading(false);
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (loading) {
    return (
      <div className='card bg-base-100 flex flex-col gap-2 rounded-xl p-3'>
        <SkeletonBlock className='h-2 w-20' />
        <div className='grid grid-cols-1 gap-3 sm:[grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]'>
          {Array.from({ length: recentShotCountSignal.value }).map((_, i) => (
            <ShotMiniCardSkeleton key={i} slots={slots} />
          ))}
        </div>
      </div>
    );
  }
  if (shots.length === 0) return null;

  return (
    <div className='card bg-base-100 flex flex-col gap-2 rounded-xl p-3'>
      <div className='text-base-content/50 text-[0.6rem] tracking-wider uppercase'>
        Recent Shots
      </div>
      <div className='grid grid-cols-1 gap-3 sm:[grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]'>
        {shots.map(shot => (
          <ShotMiniCard key={shot.id} shot={shot} slots={slots} />
        ))}
      </div>
    </div>
  );
}
