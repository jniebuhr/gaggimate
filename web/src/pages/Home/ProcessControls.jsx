import { computed } from '@preact/signals';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
import { useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import PropTypes from 'prop-types';
import { GrindTargetBar } from '../../components/GrindTargetBar.jsx';
import { useProfileData } from '../../hooks/useProfileData.js';
import { useGrindSettings } from '../../hooks/useGrindSettings.js';
import { useControlsVisibility } from '../../hooks/useControlsVisibility.js';
import { useProcessActions } from '../../hooks/useProcessActions.js';
import { useAutoSteam } from '../../hooks/useAutoSteam.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faPause, faCheck, faPlus, faMinus, faTint, faWind } from '@fortawesome/free-solid-svg-icons';
import { MODE_LABELS, MODE_SUBTITLES, formatNumber, StatRow } from '../../utils/homeConstants.jsx';

const status = computed(() => machine.value.status);

function formatTarget(grindTarget, grindTargetVolume, grindTargetDuration) {
  return grindTarget === 1 ? `${formatNumber(grindTargetVolume)}g` : `${Math.round(grindTargetDuration / 1000)}s`;
}

function getProgressPercent(processInfo) {
  if (!processInfo?.a || !processInfo?.pt) return processInfo?.e ? 100 : 0;
  return Math.max(0, Math.min(100, (processInfo.pp / processInfo.pt) * 100));
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, value));
}

function getTemperatureProgress(currentTemperature, targetTemperature) {
  if (!Number.isFinite(targetTemperature) || targetTemperature <= 0) return 0;
  return clampPercent((currentTemperature / targetTemperature) * 100);
}

function getProfilePhaseSegments(profileData) {
  const phases = Array.isArray(profileData?.phases) ? profileData.phases : [];
  if (profileData?.type !== 'pro' || phases.length === 0) return [];

  const numericDurations = phases.map(phase =>
    Number.isFinite(Number(phase?.duration)) && Number(phase.duration) > 0 ? Number(phase.duration) : 0
  );
  const totalDuration = numericDurations.reduce((sum, duration) => sum + duration, 0);
  const fallbackWeight = 1 / phases.length;
  let cursor = 0;

  return phases.map((phase, index) => {
    const weight = totalDuration > 0 ? numericDurations[index] / totalDuration : fallbackWeight;
    const start = cursor;
    const end = index === phases.length - 1 ? 1 : cursor + weight;
    cursor = end;

    return {
      index,
      name: phase?.name || `Phase ${index + 1}`,
      duration: numericDurations[index],
      totalDuration,
      start,
      end,
    };
  });
}

function resolveActivePhaseIndex(processInfo, phaseSegments) {
  if (!phaseSegments.length) return -1;

  const normalizedLabel = processInfo?.l?.trim().toLowerCase();
  if (normalizedLabel) {
    const phaseLabelIndex = phaseSegments.findIndex(
      phase => phase.name.trim().toLowerCase() === normalizedLabel
    );
    if (phaseLabelIndex >= 0) return phaseLabelIndex;
  }

  const totalDuration = phaseSegments.reduce((sum, segment) => sum + (segment.duration || 0), 0);
  const approximateRatio =
    totalDuration > 0
      ? Math.max(0, Math.min(1, (Number(processInfo?.e) || 0) / totalDuration))
      : clampPercent((Number(processInfo?.pp) / Math.max(Number(processInfo?.pt) || 1, 1)) * 100) / 100;
  const ratioIndex = phaseSegments.findIndex(segment => approximateRatio <= segment.end);
  return ratioIndex >= 0 ? ratioIndex : 0;
}

function buildSolidRingBackground(progressPercent, fillColorVar) {
  const progress = clampPercent(progressPercent) * (300 / 360);
  return [
    'radial-gradient(circle at 50% 50%, transparent 58%, rgba(255,255,255,0.03) 58%, rgba(255,255,255,0.03) 59%, transparent 60%)',
    `conic-gradient(from 210deg, ${fillColorVar} 0%, ${fillColorVar} ${progress}%, var(--home-ring-track, #222) ${progress}%, var(--home-ring-track, #222) 100%)`,
  ].join(', ');
}

function buildSegmentedRingBackground(phaseSegments, activeIndex, inPhaseProgress, fillColorVar) {
  const stops = [];
  const ARC_SCALE = 300 / 360;

  phaseSegments.forEach((segment, index) => {
    const startPercent = segment.start * 100 * ARC_SCALE;
    const endPercent = segment.end * 100 * ARC_SCALE;
    const spanPercent = endPercent - startPercent;
    const segmentProgress =
      index < activeIndex ? 1 : index === activeIndex ? Math.max(0, Math.min(1, inPhaseProgress)) : 0;
    const fillEnd = startPercent + spanPercent * segmentProgress;

    stops.push(`var(--home-ring-track, #222) ${startPercent}%`);
    if (segmentProgress > 0) {
      stops.push(`${fillColorVar} ${startPercent}%`);
      stops.push(`${fillColorVar} ${fillEnd}%`);
    }
    stops.push(`var(--home-ring-track, #222) ${fillEnd}%`);
    stops.push(`var(--home-ring-track, #222) ${endPercent}%`);
  });

  if (!stops.length) {
    stops.push('var(--home-ring-track, #222) 0%', 'var(--home-ring-track, #222) 100%');
  }

  return [
    'radial-gradient(circle at 50% 50%, transparent 58%, rgba(255,255,255,0.03) 58%, rgba(255,255,255,0.03) 59%, transparent 60%)',
    `conic-gradient(from 210deg, ${stops.join(', ')})`,
  ].join(', ');
}

function getRingVisual({
  active,
  brew,
  currentTemperature,
  finished,
  mode,
  processInfo,
  profileData,
  targetTemperature,
}) {
  if (finished) {
    return {
      background: buildSolidRingBackground(100, 'var(--text-display, #fff)'),
      progress: 100,
    };
  }

  if (active && brew) {
    const phaseSegments = getProfilePhaseSegments(profileData);
    const inPhaseProgress = getProgressPercent(processInfo) / 100;
    const activeIndex = resolveActivePhaseIndex(processInfo, phaseSegments);

    if (phaseSegments.length && activeIndex >= 0) {
      const progress = clampPercent(
        phaseSegments.reduce((total, segment, index) => {
          const segmentSpan = (segment.end - segment.start) * 100;
          if (index < activeIndex) return total + segmentSpan;
          if (index === activeIndex)
            return total + segmentSpan * Math.max(0, Math.min(1, inPhaseProgress));
          return total;
        }, 0)
      );

      return {
        background: buildSegmentedRingBackground(
          phaseSegments,
          activeIndex,
          inPhaseProgress,
          'var(--text-display, #fff)'
        ),
        progress,
      };
    }

    const progress = getProgressPercent(processInfo);
    return {
      background: buildSolidRingBackground(progress, 'var(--text-display, #fff)'),
      progress,
    };
  }

  if (!active && mode === 1) {
    const progress = getTemperatureProgress(currentTemperature, targetTemperature);
    return {
      background: buildSolidRingBackground(progress, 'var(--home-ring-brew, #d71921)'),
      progress,
    };
  }

  if (!active && mode === 0) {
    const progress = getTemperatureProgress(currentTemperature, 93);
    return {
      background: buildSolidRingBackground(progress, 'var(--home-ring-standby, #333)'),
      progress,
    };
  }

  // STEAM mode — show preheat progress toward steam target (~150°C)
  if (!active && mode === 2) {
    const steamTarget = targetTemperature > 120 ? targetTemperature : 150;
    const progress = getTemperatureProgress(currentTemperature, steamTarget);
    return {
      background: buildSolidRingBackground(progress, 'var(--home-ring-steam, #d4a843)'),
      progress,
    };
  }

  // WATER mode — show progress toward water target (~80°C)
  if (!active && mode === 3) {
    const waterTarget = targetTemperature > 0 ? targetTemperature : 80;
    const progress = getTemperatureProgress(currentTemperature, waterTarget);
    return {
      background: buildSolidRingBackground(progress, 'var(--home-ring-water, #d71921)'),
      progress,
    };
  }

  // GRIND idle
  return {
    background: buildSolidRingBackground(8, 'var(--home-ring-standby, #333)'),
    progress: 8,
  };
}

function getDisplayState({ mode, active, finished, processInfo, currentTemperature, targetTemperature, isGrindAvailable }) {
  if (active) {
    return {
      title: processInfo?.l || 'Running',
      subtitle: processInfo?.s === 'brew' ? 'Extraction in progress' : 'Process in progress',
    };
  }

  if (finished) {
    return {
      title: 'Finished',
      subtitle: `${Math.floor((processInfo?.e || 0) / 1000)}s total time`,
    };
  }

  if (mode === 2) {
    return {
      title: 'STEAM',
      subtitle: Math.abs(targetTemperature - currentTemperature) < 5 ? 'Ready' : 'Preheating',
    };
  }

  if (mode === 4 && !isGrindAvailable) {
    return {
      title: 'GRIND',
      subtitle: 'Not available',
    };
  }

  return {
    title: MODE_LABELS[mode] || 'STANDBY',
    subtitle: MODE_SUBTITLES[mode] || 'Ready',
  };
}

// Mini action button component
function MiniActionButton({ icon, label, onClick, disabled, tone }) {
  const toneClass = tone === 'primary' ? 'nd-action-btn--primary' : '';
  return (
    <button
      type='button'
      disabled={disabled}
      className={`nd-action-btn ${toneClass}`}
      onClick={onClick}
      aria-label={label}
    >
      <FontAwesomeIcon icon={icon} />
    </button>
  );
}

MiniActionButton.propTypes = {
  icon: PropTypes.object.isRequired,
  label: PropTypes.string.isRequired,
  onClick: PropTypes.func,
  disabled: PropTypes.bool,
  tone: PropTypes.string,
};

export default function ProcessControls({ brew, mode }) {
  const api = useContext(ApiServiceContext);
  const processInfo = status.value.process;
  const active = !!processInfo?.a;
  const finished = !!processInfo?.e && !active;
  const grind = mode === 4;
  const [isFlushing, setIsFlushing] = useState(false);
  const { autoSteamEnabled, toggleAutoSteam } = useAutoSteam();
  // Tracks whether the last explicitly started process was 'brew' or 'flush'
  const lastStartedActionRef = useRef(null);

  // Track when active goes from true to false (user stopped/paused, not natural finish)
  const wasActiveRef = useRef(false);
  useEffect(() => {
    if (active) {
      wasActiveRef.current = true;
    }
    if (!active && wasActiveRef.current && !finished && brew && autoSteamEnabled && mode === 1 && lastStartedActionRef.current === 'brew') {
      wasActiveRef.current = false;
      try {
        api.send({ tp: 'req:change-mode', mode: 2 });
      } catch (err) {
        console.error('Failed to change to steam mode:', err);
      }
    }
    if (!active) {
      wasActiveRef.current = false;
    }
  }, [active, finished, brew, autoSteamEnabled, mode, api]);

  // Reset the ref when no process is running (natural finish)
  useEffect(() => {
    if (!finished) {
      lastStartedActionRef.current = null;
    }
  }, [finished]);

  // Auto-steam: transition to steam mode when brew (not flush) finishes naturally with auto-steam enabled
  useEffect(() => {
    if (finished && brew && autoSteamEnabled && mode === 1 && lastStartedActionRef.current === 'brew') {
      try {
        api.send({ tp: 'req:change-mode', mode: 2 });
      } catch (err) {
        console.error('Failed to change to steam mode:', err);
      }
    }
  }, [finished, brew, autoSteamEnabled, mode, api]);
  const {
    currentFlow,
    currentPressure,
    currentTemperature,
    currentWeight,
    grindTarget,
    grindTargetDuration,
    grindTargetVolume,
    selectedProfileId,
    targetTemperature,
    volumetricAvailable,
  } = status.value;

  const { isGrindAvailable } = useGrindSettings(mode);
  const { profileData } = useProfileData(api, brew, selectedProfileId);

  const visibility = useControlsVisibility(
    mode,
    active,
    finished,
    isGrindAvailable,
    volumetricAvailable
  );
  const actions = useProcessActions(api, grind, setIsFlushing, lastStartedActionRef);

  const progressPercent = getProgressPercent(processInfo);
  const ringVisual = getRingVisual({
    active,
    brew,
    currentTemperature,
    finished,
    mode,
    processInfo,
    profileData,
    targetTemperature,
  });
  const displayState = getDisplayState({
    mode,
    active,
    finished,
    processInfo,
    currentTemperature,
    targetTemperature,
    isGrindAvailable,
  });

  const infoRows = useMemo(() => {
    if (grind) {
      return [
        { label: 'Current Grind', value: `${formatNumber(currentWeight)}g`, highlight: false },
        { label: 'Target Grind', value: formatTarget(grindTarget, grindTargetVolume, grindTargetDuration), highlight: false },
      ];
    }

    return [
      { label: 'Temperature', value: `${formatNumber(currentTemperature)} °C`, highlight: true },
      { label: 'Pressure', value: `${formatNumber(currentPressure)} bar`, highlight: false },
      { label: 'Flow', value: `${formatNumber(currentFlow)} g/s`, highlight: false },
      { label: 'Weight', value: `${formatNumber(currentWeight)} g`, highlight: false },
    ];
  }, [
    grind,
    currentFlow,
    currentPressure,
    currentTemperature,
    currentWeight,
    grindTarget,
    grindTargetDuration,
    grindTargetVolume,
  ]);

  return (
    <div className='flex flex-col gap-5'>
      {/* Mode selector */}
      <div className='nd-segmented'>
        {MODE_LABELS.map((label, idx) => (
            <button
              key={label}
              type='button'
              className={`nd-segmented-btn${mode === idx ? ' nd-segmented-btn--active' : ''}`}
              onClick={() => {
                try {
                  api.send({ tp: 'req:change-mode', mode: idx });
                } catch (err) {
                  console.error('Failed to change mode:', err);
                }
              }}
              title={MODE_SUBTITLES[idx]}
            >
              {label}
            </button>
          ))}
      </div>

      {/* Main ring + data row */}
      <div className='flex flex-col gap-5 sm:flex-row sm:items-center'>
        {/* Ring gauge — hero element */}
        <div
          className='nd-ring mx-auto sm:mx-0'
          style={{
            '--ring-progress': `${ringVisual.progress}%`,
            '--ring-background': ringVisual.background,
            width: 'min(18rem, 60vw)',
          }}
        >
          <div className='nd-ring-inner'>
            {active || finished ? (
              <>
                <div className='nd-ring-temp'>
                  {Math.round(active ? ringVisual.progress : progressPercent)}%
                </div>
                <div className='nd-ring-temp-unit'>complete</div>
                <div className='mt-3 font-nd-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-secondary,#999)]'>
                  {displayState.title}
                </div>
              </>
            ) : (
              <>
                <div className='nd-ring-temp'>{formatNumber(currentTemperature)}</div>
                <div className='nd-ring-temp-unit'>°C</div>
                <div className='nd-ring-target'>
                  / {formatNumber(targetTemperature)}° target
                </div>
                <div className='mt-2 font-nd-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-disabled,#666)]'>
                  {displayState.title}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Stats panel */}
        <div className='min-w-0 flex-1'>
          <div className='nd-card p-4'>
            <div className='space-y-0'>
              {infoRows.map(row => (
                <StatRow key={row.label} label={row.label} value={row.value} valueColor={row.highlight} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons row */}
      {visibility.showActionButtons && (
        <div className='flex items-center justify-center gap-3'>
          {!active && !finished && (
            <MiniActionButton
              disabled={!visibility.showGrindTargetControls}
              icon={faMinus}
              label='Lower target'
              onClick={visibility.showGrindTargetControls ? actions.lowerTarget : undefined}
            />
          )}
          {active ? (
            <MiniActionButton
              icon={faPause}
              label='Pause process'
              onClick={actions.deactivate}
              tone='primary'
            />
          ) : finished ? (
            <MiniActionButton
              icon={faCheck}
              label='Clear process'
              onClick={actions.clear}
              tone='primary'
            />
          ) : (
            <MiniActionButton
              icon={faPlay}
              label={grind ? 'Start grind' : 'Start brew'}
              onClick={actions.activate}
              tone='primary'
            />
          )}
          {!active && !finished && (
            <MiniActionButton
              disabled={!(brew && !active && !finished) && !visibility.showGrindTargetControls}
              icon={brew && !active && !finished ? faTint : faPlus}
              label={brew && !active && !finished ? 'Flush water' : 'Raise target'}
              onClick={
                brew && !active && !finished
                  ? actions.startFlush
                  : visibility.showGrindTargetControls
                    ? actions.raiseTarget
                    : undefined
              }
            />
          )}
          {brew && !active && !finished && (
            <MiniActionButton
              icon={faWind}
              label='Toggle auto steam'
              onClick={toggleAutoSteam}
              tone={autoSteamEnabled ? 'primary' : undefined}
            />
          )}
        </div>
      )}

      {/* Grind target bar */}
      {mode === 4 && visibility.showGrindTargetBar && (
        <div className='pt-2'>
          <GrindTargetBar
            grindTarget={grindTarget}
            grindTargetVolume={grindTargetVolume}
            grindTargetDuration={grindTargetDuration}
            volumetricAvailable={volumetricAvailable}
            onChangeTarget={actions.changeTarget}
          />
        </div>
      )}
    </div>
  );
}

ProcessControls.propTypes = {
  brew: PropTypes.bool.isRequired,
  mode: PropTypes.oneOf([0, 1, 2, 3, 4]).isRequired,
};