import { computed } from '@preact/signals';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
import { useContext, useMemo, useState } from 'preact/hooks';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay } from '@fortawesome/free-solid-svg-icons/faPlay';
import { faPause } from '@fortawesome/free-solid-svg-icons/faPause';
import { faCheck } from '@fortawesome/free-solid-svg-icons/faCheck';
import { faTint } from '@fortawesome/free-solid-svg-icons/faTint';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { faMinus } from '@fortawesome/free-solid-svg-icons/faMinus';
import { Tooltip } from '../../components/Tooltip.jsx';
import { GrindTargetBar } from '../../components/GrindTargetBar.jsx';
import { useProfileData } from '../../hooks/useProfileData.js';
import { useGrindSettings } from '../../hooks/useGrindSettings.js';
import { useControlsVisibility } from '../../hooks/useControlsVisibility.js';
import { useProcessActions } from '../../hooks/useProcessActions.js';

const status = computed(() => machine.value.status);

const MODE_LABELS = ['Standby', 'Brew', 'Steam', 'Water', 'Grind'];
const MODE_SUBTITLES = {
  0: 'System idle',
  1: 'Ready to extract',
  2: 'Steam staging',
  3: 'Water ready',
  4: 'Grind staging',
};

function formatNumber(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : '0.0';
}

function formatTarget(grindTarget, grindTargetVolume, grindTargetDuration) {
  return grindTarget === 1 ? `${formatNumber(grindTargetVolume)}g` : `${Math.round(grindTargetDuration / 1000)}s`;
}

function getProgressPercent(processInfo) {
  if (!processInfo?.a || !processInfo?.pt) return processInfo?.e ? 100 : 0;
  return Math.max(0, Math.min(100, (processInfo.pp / processInfo.pt) * 100));
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
      title: 'Steam',
      subtitle: Math.abs(targetTemperature - currentTemperature) < 5 ? 'Steam is ready' : 'Preheating',
    };
  }

  if (mode === 4 && !isGrindAvailable) {
    return {
      title: 'Grind',
      subtitle: 'Grind not available',
    };
  }

  return {
    title: MODE_LABELS[mode] || 'Standby',
    subtitle: MODE_SUBTITLES[mode] || 'Ready',
  };
}

function MiniActionButton({ disabled = false, icon, label, onClick, tone = 'default' }) {
  const toneClass =
    tone === 'primary'
      ? 'border-primary/45 bg-primary/14 text-primary hover:border-primary hover:bg-primary/22'
      : 'border-base-300/50 bg-base-100/70 text-base-content/72 hover:border-base-content/15 hover:bg-base-content/6';

  return (
    <Tooltip content={label}>
      <button
        type='button'
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className={`home-mini-action ${toneClass}`}
      >
        <FontAwesomeIcon icon={icon} />
      </button>
    </Tooltip>
  );
}

MiniActionButton.propTypes = {
  disabled: PropTypes.bool,
  icon: PropTypes.object.isRequired,
  label: PropTypes.string.isRequired,
  onClick: PropTypes.func,
  tone: PropTypes.oneOf(['default', 'primary']),
};

function MetricPair({ label, toneClass = 'text-base-content', value }) {
  return (
    <div className='grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-sm'>
      <span className='text-base-content/58'>{label}</span>
      <span className={`text-right font-medium ${toneClass}`}>{value}</span>
    </div>
  );
}

MetricPair.propTypes = {
  label: PropTypes.string.isRequired,
  toneClass: PropTypes.string,
  value: PropTypes.string.isRequired,
};

export default function ProcessControls({ brew, mode }) {
  const api = useContext(ApiServiceContext);
  const processInfo = status.value.process;
  const active = !!processInfo?.a;
  const finished = !!processInfo?.e && !active;
  const grind = mode === 4;
  const [, setIsFlushing] = useState(false);
  const {
    currentFlow,
    currentPressure,
    currentTemperature,
    currentWeight,
    grindTarget,
    grindTargetDuration,
    grindTargetVolume,
    selectedProfileId,
    targetPressure,
    targetTemperature,
    volumetricAvailable,
  } = status.value;

  const { isGrindAvailable } = useGrindSettings(mode);
  useProfileData(api, brew, selectedProfileId);

  const visibility = useControlsVisibility(
    mode,
    active,
    finished,
    isGrindAvailable,
    volumetricAvailable
  );
  const actions = useProcessActions(api, grind, setIsFlushing);

  const progressPercent = getProgressPercent(processInfo);
  const ringProgress = active ? progressPercent : finished ? 100 : mode === 1 ? 18 : 8;
  const displayState = getDisplayState({
    mode,
    active,
    finished,
    processInfo,
    currentTemperature,
    targetTemperature,
    isGrindAvailable,
  });

  const primaryButton = useMemo(() => {
    if (active) {
      return {
        icon: faPause,
        label: 'Pause process',
        onClick: actions.deactivate,
      };
    }

    if (finished) {
      return {
        icon: faCheck,
        label: 'Clear process',
        onClick: actions.clear,
      };
    }

    if (visibility.showActionButtons) {
      return {
        icon: faPlay,
        label: grind ? 'Start grind' : 'Start process',
        onClick: actions.activate,
      };
    }

    return {
      icon: faPlay,
      label: 'No action available',
      onClick: undefined,
    };
  }, [active, finished, actions, visibility.showActionButtons, grind]);

  const infoRows = useMemo(() => {
    if (grind) {
      return [
        {
          label: 'Current Grind',
          value: `${formatNumber(currentWeight)}g`,
          toneClass: 'text-lime-400',
        },
        {
          label: 'Target Grind',
          value: formatTarget(grindTarget, grindTargetVolume, grindTargetDuration),
          toneClass: 'text-orange-300',
        },
      ];
    }

    return [
      {
        label: 'Live Data',
        value: `${formatNumber(currentTemperature)} °C / ${formatNumber(currentFlow)} g/s`,
        toneClass: 'text-sky-400',
      },
      {
        label: 'Current Pressure',
        value: `${formatNumber(currentPressure)} bar`,
        toneClass: 'text-lime-400',
      },
      {
        label: 'Current Flow',
        value: `${formatNumber(currentFlow)} g/s`,
        toneClass: 'text-lime-400',
      },
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
    targetPressure,
    targetTemperature,
  ]);

  return (
    <div className='home-process-panel flex min-h-[27rem] flex-col gap-4'>
      <div className='flex flex-1 flex-col justify-between gap-6'>
        <div className='flex flex-1 flex-col items-center justify-center gap-5'>
          <div
            className='home-process-ring'
            style={{
              '--ring-progress': `${ringProgress}%`,
            }}
          >
            <div className='home-process-ring-inner'>
              <div className='text-3xl font-semibold tracking-tight text-base-content sm:text-4xl'>
                {displayState.title}
              </div>
              <div className='mt-2 text-sm text-base-content/48'>{displayState.subtitle}</div>
              {(active || finished) && (
                <div className='mt-4 text-xs uppercase tracking-[0.22em] text-base-content/34'>
                  {Math.round(progressPercent)}% complete
                </div>
              )}
            </div>
            <div className='home-process-ring-scale'>
              <span>0</span>
              <span>100%</span>
            </div>
          </div>

          <div className='flex items-center justify-center gap-3'>
            <MiniActionButton
              disabled={!visibility.showGrindTargetControls}
              icon={faMinus}
              label='Lower target'
              onClick={visibility.showGrindTargetControls ? actions.lowerTarget : undefined}
            />
            <MiniActionButton
              disabled={!primaryButton.onClick}
              icon={primaryButton.icon}
              label={primaryButton.label}
              onClick={primaryButton.onClick}
              tone='primary'
            />
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
          </div>
        </div>

        <div className='space-y-4 border-t border-base-300/45 pt-4'>
          {infoRows.map(row => (
            <MetricPair key={row.label} label={row.label} value={row.value} toneClass={row.toneClass} />
          ))}
        </div>

        {mode === 4 && visibility.showGrindTargetBar && (
          <div className='border-t border-base-300/45 pt-4'>
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
    </div>
  );
}

ProcessControls.propTypes = {
  brew: PropTypes.bool.isRequired,
  mode: PropTypes.oneOf([0, 1, 2, 3, 4]).isRequired,
};
