import { useContext, useEffect, useRef, useState } from 'preact/hooks';
import { ApiServiceContext, machine } from '../../../services/ApiService.js';
import PropTypes from 'prop-types';
import { Trans, useLingui } from '@lingui/react/macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRectangleList } from '@fortawesome/free-solid-svg-icons/faRectangleList';
import { faCheck } from '@fortawesome/free-solid-svg-icons/faCheck';
import { ProcessProfileChart } from '../../../components/ProcessProfileChart.jsx';
import { profileChartHeightSignal } from '../../../utils/dashboardManager.js';
import { SkeletonBlock } from '../../../components/SkeletonBlock.jsx';
import { fmtElapsed, getPhaseLabel } from '../utils.js';
import { parseBinaryIndex, indexToShotList } from '../../ShotHistory/parseBinaryIndex.js';

const PROCESS_CARD_CLASS = 'card h-30 rounded-xl border p-3';

// Status frames arrive every ~500 ms. Between them, the total and phase times advance on the client
// so the timers tick every frame.
const MAX_EXTRAPOLATION_MS = 1000;

function useProcessClock(p, running) {
  const [now, setNow] = useState(() => performance.now());
  const anchorRef = useRef({ p: null, at: 0 });
  // Each status frame is a fresh object, so identity marks when the firmware values were measured.
  if (anchorRef.current.p !== p) anchorRef.current = { p, at: performance.now() };

  useEffect(() => {
    if (!running) return;
    let id;
    const tick = () => {
      setNow(performance.now());
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [running]);

  if (!running) return 0;
  return Math.min(MAX_EXTRAPOLATION_MS, Math.max(0, now - anchorRef.current.at));
}

// Returns `value` held at its highest so far while `key` stays the same. A new key, null, or a
// drop of more than `maxStepBack` (a new run, not jitter) starts over from `value`.
function useNonDecreasing(key, value, maxStepBack = Infinity) {
  const ref = useRef({ key: null, value });
  const prev = ref.current;
  const hold = key !== null && prev.key === key && value >= prev.value - maxStepBack;
  const result = hold ? Math.max(value, prev.value) : value;
  ref.current = { key, value: result };
  return result;
}

function usePrevious(value) {
  const ref = useRef(value);
  const prev = ref.current;
  ref.current = value;
  return prev;
}

const fmtSeconds = ms => (Math.max(0, ms) / 1000).toFixed(1);
const fmtGrams = g => Math.max(0, g).toFixed(1);

function ProgressCard({
  processInfo,
  isBrewing,
  isGrinding,
  isFlushing = false,
  isFlushPending = false,
  profileName,
}) {
  const { t } = useLingui();
  const p = processInfo;
  const running = !!p?.a && !isFlushPending;
  const timeBased = p?.tt === 'time';
  const dt = useProcessClock(p, running);

  const isDrain = isFlushing && !isFlushPending && p?.l === 'Drain';

  let statusLabel;
  let phaseType;
  let phaseName = null;
  if (isFlushing) {
    statusLabel = t`Flushing`;
    phaseType = getPhaseLabel('brew');
    phaseName = isDrain
      ? t({ message: 'Drain', context: 'flush phase' })
      : t({ message: 'Flush', context: 'flush phase' });
  } else {
    statusLabel = isBrewing ? t`Brewing` : t`Grinding`;
    phaseType = getPhaseLabel(p?.s, isGrinding);
    if (!isGrinding) phaseName = p?.l;
  }

  const extrapolatedPhase = (p?.pp ?? 0) + (timeBased ? dt : 0);
  const cappedPhase =
    timeBased && p?.pt > 0 ? Math.min(extrapolatedPhase, p.pt) : extrapolatedPhase;
  const total = useNonDecreasing(
    isFlushPending ? null : 'run',
    isFlushPending ? 0 : (p?.e ?? 0) + dt,
    MAX_EXTRAPOLATION_MS,
  );
  const phaseValue = useNonDecreasing(
    isFlushPending ? null : `${p?.pi}|${p?.s}|${p?.l}`,
    isFlushPending ? 0 : cappedPhase,
  );

  const hasTarget = !isFlushPending && p?.pt > 0;
  const inSeconds = timeBased || isFlushPending;
  const fmtPhase = inSeconds ? fmtSeconds : fmtGrams;
  const phaseUnit = inSeconds ? 's' : 'g';

  const progress = hasTarget ? Math.max(0, Math.min(100, ((p.pp ?? 0) / p.pt) * 100)) : 0;
  const animate = progress >= usePrevious(progress);

  return (
    <div
      className={`${PROCESS_CARD_CLASS} bg-primary/10 border-primary/30 grid grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_auto_1fr_auto] gap-x-2.5 gap-y-1.5 px-3.5`}
    >
      <div className='col-span-2 row-start-1 min-w-0 truncate text-[0.82rem] leading-tight'>
        <span className='text-primary font-medium'>{statusLabel}</span>
        {!isFlushing && (
          <>
            <span className='text-base-content/40'> · </span>
            <span className='text-base-content font-semibold'>{profileName}</span>
          </>
        )}
      </div>
      <div className='border-base-content/10 col-span-2 row-start-2 border-t' aria-hidden='true' />
      {/* Phase type over phase name as one group, so the total time centres on exactly those two. */}
      <div className='col-span-2 row-start-3 flex min-w-0 items-center justify-between gap-2.5 self-end'>
        <div className='flex min-w-0 flex-col'>
          {/* Both lines always render (a non-breaking space when empty: grinding has no phase
              name) so neither moves when the other is missing. */}
          <span className='text-base-content/60 truncate text-[0.72rem] leading-tight font-semibold'>
            {phaseType || '\u00a0'}
          </span>
          <span className='text-base-content truncate text-[1.3rem] leading-[1.15] font-semibold'>
            {phaseName || '\u00a0'}
          </span>
        </div>
        <div className='text-base-content shrink-0 text-[2rem] leading-none font-bold tabular-nums'>
          <span className='sr-only'>{t`Total time`} </span>
          {fmtElapsed(total)}
        </div>
      </div>
      <div className='col-span-2 row-start-4 flex items-center gap-2'>
        <div className='bg-base-content/10 h-2 min-w-0 flex-1 overflow-hidden rounded-full'>
          <div
            className={`bg-primary h-full rounded-full ${animate ? 'transition-[width] duration-200 ease-out' : ''}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className='text-base-content/60 shrink-0 text-[0.8rem] leading-tight tabular-nums'>
          <span className='text-base-content font-semibold'>{fmtPhase(phaseValue)}</span>
          {hasTarget && ` / ${fmtPhase(p.pt)} ${phaseUnit}`}
        </span>
      </div>
    </div>
  );
}

ProgressCard.propTypes = {
  processInfo: PropTypes.object,
  isBrewing: PropTypes.bool.isRequired,
  isGrinding: PropTypes.bool.isRequired,
  isFlushing: PropTypes.bool,
  isFlushPending: PropTypes.bool,
  profileName: PropTypes.string.isRequired,
};

function FinishedProcessCard({ processInfo, isBrewing, profileName, stats, weight }) {
  const { t } = useLingui();
  const p = processInfo;
  const weightLabel = weight != null && weight > 0 ? `${weight.toFixed(1)}g` : null;
  const pressureLabel =
    isBrewing && stats?.maxPressure != null ? `${stats.maxPressure.toFixed(1)} bar` : null;
  const flowLabel = isBrewing && stats?.avgFlow != null ? `${stats.avgFlow.toFixed(2)} ml/s` : null;
  const items = [
    weightLabel && { key: 'weight', label: t`Weight`, value: weightLabel },
    pressureLabel && { key: 'pressure', label: t`Pressure`, value: pressureLabel },
    flowLabel && { key: 'flow', label: t`Flow`, value: flowLabel },
  ].filter(Boolean);

  return (
    <div
      className={`${PROCESS_CARD_CLASS} bg-success/10 border-success/30 flex flex-col justify-between`}
    >
      <div className='text-success flex items-center gap-1.5 text-[0.65rem] font-semibold tracking-wider uppercase'>
        <FontAwesomeIcon icon={faCheck} className='shrink-0' />
        <span className='min-w-0 truncate'>
          <Trans>Finished</Trans> · {profileName}
        </span>
      </div>
      <span className='text-base-content text-center text-2xl leading-none font-bold tabular-nums'>
        {fmtElapsed(p?.e)}
      </span>
      {items.length > 0 && (
        <div className='flex gap-3'>
          {items.map(item => (
            <div key={item.key} className='flex-1 text-center'>
              <div className='text-base-content text-sm font-bold tabular-nums'>{item.value}</div>
              <div className='text-base-content/50 text-[0.6rem] font-semibold tracking-wider uppercase'>
                {item.label}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

FinishedProcessCard.propTypes = {
  processInfo: PropTypes.object,
  isBrewing: PropTypes.bool.isRequired,
  profileName: PropTypes.string.isRequired,
  stats: PropTypes.shape({
    maxPressure: PropTypes.number,
    avgFlow: PropTypes.number,
  }),
  weight: PropTypes.number,
};

export function ProfileCard({
  selectedProfile,
  selectedProfileId,
  processInfo,
  isActive,
  isFinished,
  isBrewing,
  isGrinding,
  isFlushing = false,
  isFlushPending = false,
  isFlushFinished = false,
  inCard = false,
  compact = false,
}) {
  const { t } = useLingui();
  const apiService = useContext(ApiServiceContext);
  const [profileData, setProfileData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [finishedStats, setFinishedStats] = useState(null);
  const lockedProfileRef = useRef(null);
  const isUtility = !!processInfo?.u;

  // Always mounted (unlike the finished view itself), so this can't miss the
  // event if it arrives before the next status update flips isFinished true.
  useEffect(() => {
    if (!apiService) return;
    const listenerId = apiService.on('evt:shot-finished-stats', msg => {
      setFinishedStats({
        maxPressure: msg.maxPressure > 0 ? msg.maxPressure : null,
        avgFlow: msg.avgFlow > 0 ? msg.avgFlow : null,
      });
    });
    return () => apiService.off('evt:shot-finished-stats', listenerId);
  }, [apiService]);

  // Clear stale stats the moment a new shot starts.
  useEffect(() => {
    if (isActive) setFinishedStats(null);
  }, [isActive]);

  // Fallback for a page reload landing directly on an already-finished shot:
  // the live evt:shot-finished-stats event only fires once, at the moment the
  // shot stopped, so a fresh mount never receives it. The recent-shots index
  // always has the same stats for the most recently completed shot.
  useEffect(() => {
    // Safety check: the firmware clears utility runs (flush, backflush, descaling…) as they end.
    if (!isFinished || !isBrewing || isUtility || finishedStats !== null) return;
    let cancelled = false;
    fetch('/api/history/recent.bin?limit=1')
      .then(resp => (resp.ok ? resp.arrayBuffer() : null))
      .then(buf => {
        if (cancelled || !buf) return;
        const [latest] = indexToShotList(parseBinaryIndex(buf));
        if (latest) {
          setFinishedStats({ maxPressure: latest.maxPressure, avgFlow: latest.avgFlow });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isFinished, isBrewing, isUtility, finishedStats]);

  useEffect(() => {
    if (!selectedProfileId || !apiService) {
      setProfileData(null);
      return;
    }
    let cancelled = false;
    setProfileLoading(true);
    apiService
      .request({ tp: 'req:profiles:load', id: selectedProfileId })
      .then(res => {
        if (cancelled) return;
        setProfileData(res.profile);
        setProfileLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setProfileData(null);
        setProfileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProfileId, apiService]);

  // Safety check: the firmware currently clears a flush as it ends
  const showShotCard = !isFlushFinished && (isBrewing || isGrinding) && (isActive || isFinished);
  // Profile name is captured when it starts and held until it is cleared.
  // A name not yet known when the shot starts is locked once it arrives.
  if (!showShotCard) lockedProfileRef.current = null;
  else if (!lockedProfileRef.current && selectedProfile) lockedProfileRef.current = selectedProfile;
  const profileName =
    lockedProfileRef.current || selectedProfile || t({ message: 'Default', context: 'profile' });

  // A flush shows progress even while pending, when the process info may still be a finished shot's.
  if (isFlushing || (showShotCard && !isFinished)) {
    return (
      <ProgressCard
        processInfo={processInfo}
        isBrewing={isBrewing}
        isGrinding={isGrinding}
        isFlushing={isFlushing}
        isFlushPending={isFlushPending}
        profileName={profileName}
      />
    );
  }

  if (showShotCard) {
    return (
      <FinishedProcessCard
        processInfo={processInfo}
        isBrewing={isBrewing}
        profileName={profileName}
        stats={finishedStats}
        weight={machine.value.status?.currentWeight}
      />
    );
  }

  const inner = (
    <>
      <div className='text-base-content/50 text-[0.6rem] tracking-wider uppercase'>
        <Trans>Profile</Trans>
      </div>
      <div className='flex items-center justify-between gap-2'>
        <span className='text-base-content truncate text-sm font-semibold'>{profileName}</span>
        <a href='/profiles'>
          <FontAwesomeIcon
            icon={faRectangleList}
            className='text-base-content/40 shrink-0 text-sm'
          />
        </a>
      </div>
      {!compact &&
        (profileLoading || (!!selectedProfileId && !profileData) ? (
          <SkeletonBlock
            className='mt-1 w-full rounded-xl'
            style={{ height: `${profileChartHeightSignal.value}px` }}
          />
        ) : profileData ? (
          <ProcessProfileChart
            data={profileData}
            processInfo={processInfo}
            className='mt-1 w-full'
            style={{ height: `${profileChartHeightSignal.value}px` }}
          />
        ) : null)}
    </>
  );

  if (inCard) {
    return <div className='flex h-full flex-col gap-1'>{inner}</div>;
  }

  return <div className='card bg-base-100 flex h-full flex-col gap-1 rounded-xl p-3'>{inner}</div>;
}

ProfileCard.propTypes = {
  selectedProfile: PropTypes.string,
  selectedProfileId: PropTypes.string,
  processInfo: PropTypes.object,
  isActive: PropTypes.bool.isRequired,
  isFinished: PropTypes.bool.isRequired,
  isBrewing: PropTypes.bool.isRequired,
  isGrinding: PropTypes.bool.isRequired,
  isFlushing: PropTypes.bool,
  isFlushPending: PropTypes.bool,
  isFlushFinished: PropTypes.bool,
  inCard: PropTypes.bool,
  compact: PropTypes.bool,
};
