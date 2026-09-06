import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClock } from '@fortawesome/free-solid-svg-icons/faClock';
import { faGauge } from '@fortawesome/free-solid-svg-icons/faGauge';
import { faMinus } from '@fortawesome/free-solid-svg-icons/faMinus';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { faRectangleList } from '@fortawesome/free-solid-svg-icons/faRectangleList';
import { faThermometerHalf } from '@fortawesome/free-solid-svg-icons/faThermometerHalf';
import { faWeightScale } from '@fortawesome/free-solid-svg-icons/faWeightScale';
import { WarningIcon } from '../../components/WarningIcon.jsx';
import { activeWarnings, WARNING_LEVEL } from '../../utils/warnings.js';
import { FlushButton } from './FlushButton.jsx';
import { ModeTab } from './ModeTab.jsx';
import { useDashboardState } from './useDashboardState.js';
import {
  fmtElapsed,
  fmtPhaseTarget,
  getPhaseLabel,
  getPrimaryIcon,
  getPrimaryLabel,
  MODES,
} from './utils.js';

const Metric = ({ icon, current, target, unit }) => (
  <div className='flex items-center gap-1.5'>
    <FontAwesomeIcon icon={icon} className='text-base-content/60 text-xs' />
    <span className='text-base-content tabular-nums'>{current}</span>
    <span className='text-success font-semibold tabular-nums'>
      / {target}
      {unit}
    </span>
  </div>
);

const FinishedView = ({ elapsed }) => (
  <div className='space-y-1 text-center'>
    <div className='text-base-content text-lg font-bold'>Finished</div>
    <div className='text-base-content text-2xl font-bold tabular-nums'>{elapsed}</div>
  </div>
);

const ActiveView = ({ p, grind }) => {
  const progress = Math.max(0, Math.min(100, ((p?.pp ?? 0) / (p?.pt || 1)) * 100));
  const phaseTarget = fmtPhaseTarget(p, grind);
  return (
    <div className='flex w-full max-w-sm min-w-0 flex-col gap-1.5 px-2'>
      <div className='flex min-w-0 items-baseline justify-between gap-2'>
        <div className='flex min-w-0 items-baseline gap-1.5'>
          <span className='text-base-content/60 shrink-0 text-[0.6rem] font-semibold tracking-[0.16em] uppercase'>
            {getPhaseLabel(p, grind)}
          </span>
          {p?.l && (
            <span className='text-base-content min-w-0 truncate text-sm font-bold'>{p.l}</span>
          )}
        </div>
        <span className='text-base-content shrink-0 text-xl font-bold tabular-nums'>
          {fmtElapsed(p?.e)}
        </span>
      </div>
      <div className='bg-base-content/20 h-1.5 w-full overflow-hidden rounded-full'>
        <div
          className='bg-primary h-full rounded-full transition-all duration-300 ease-out'
          style={{ width: `${progress}%` }}
        />
      </div>
      {phaseTarget && (
        <div className='text-base-content/60 self-end text-[0.65rem] tabular-nums'>
          target {phaseTarget}
        </div>
      )}
    </div>
  );
};

const InfoView = ({ title, hint }) => (
  <div className='space-y-1 text-center'>
    <div className='text-lg font-semibold'>{title}</div>
    <div className='text-base-content/60 text-xs'>{hint}</div>
  </div>
);

const getSteamHint = (currentTemp, targetTemp, mode) => {
  if (mode !== 2) return 'Start and open valve to pull water';
  return Math.abs(targetTemp - currentTemp) < 5 ? 'Steam is ready' : 'Preheating';
};

export default function CompactProcessControls() {
  const ds = useDashboardState();
  const {
    mode,
    processInfo: p,
    isActive,
    isFinished,
    isBrewing,
    isGrinding,
    isGrindAvailable,
    showGrindTab,
    brewTarget,
    volumetricAvailable,
    currentTemperature,
    targetTemperature,
    currentPressure,
    targetPressure,
    currentWeight,
    targetWeight,
    grindTarget,
    grindTargetDuration,
    grindTargetVolume,
    changeMode,
    activate,
    deactivate,
    clear,
    startFlush,
    stopFlush,
    isFlushing,
    warnings,
    systemReady,
    systemMessage,
    raiseTemp,
    lowerTemp,
    raiseTarget,
    lowerTarget,
    changeTarget,
  } = ds;

  const showPrimary = mode === 1 || mode === 3 || (isGrinding && isGrindAvailable);
  const showFlush = isBrewing && (isFlushing || (!isActive && !isFinished)); // stays mounted while held
  const showWeight = volumetricAvailable && (mode === 1 || mode === 3) && brewTarget;
  const processRunning = (isActive || isFinished) && (isBrewing || isGrinding);
  const shownWarnings = mode === 0 ? [] : activeWarnings(warnings);

  const handlePrimary = () => {
    if (isActive) deactivate();
    else if (isFinished) clear();
    else activate();
  };

  const grindValue =
    grindTarget === 1 && volumetricAvailable
      ? `${grindTargetVolume}g`
      : `${Math.round(grindTargetDuration / 1000)}s`;

  const renderContent = () => {
    if (processRunning && isFinished) return <FinishedView elapsed={fmtElapsed(p?.e)} />;
    if (processRunning) return <ActiveView p={p} grind={isGrinding} />;
    if (mode === 0) return <InfoView title='Standby' hint={systemMessage || 'Machine is ready'} />;
    if (mode === 1)
      return (
        <div className='flex w-full max-w-sm min-w-0 flex-col items-stretch gap-3'>
          <a
            href='/profiles'
            className='bg-base-200/70 hover:bg-base-200 flex min-w-0 items-center gap-3 rounded-2xl px-3 py-2 transition-colors'
          >
            <span className='bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl'>
              <FontAwesomeIcon icon={faRectangleList} className='text-sm' />
            </span>
            <span className='flex min-w-0 flex-1 flex-col leading-tight'>
              <span className='text-base-content/50 text-[0.6rem] font-semibold tracking-[0.18em] uppercase'>
                Profile
              </span>
              <span className='text-base-content min-w-0 truncate text-sm font-bold'>
                {ds.selectedProfile || 'Default'}
              </span>
            </span>
          </a>
          {volumetricAvailable && (
            <TargetToggle value={brewTarget ? 1 : 0} onChange={changeTarget} />
          )}
        </div>
      );
    if (mode === 2 || mode === 3)
      return (
        <div className='flex flex-col items-center gap-3'>
          <Adjuster
            label='TEMPERATURE'
            value={`${targetTemperature}°C`}
            onDecrease={lowerTemp}
            onIncrease={raiseTemp}
          />
          <div className='text-base-content/60 text-xs'>
            {getSteamHint(currentTemperature, targetTemperature, mode)}
          </div>
        </div>
      );
    if (isGrinding && !isGrindAvailable)
      return <InfoView title='Grind' hint='Grind function not available' />;
    if (isGrinding)
      return (
        <div className='flex flex-col items-center gap-3'>
          <Adjuster
            label='GRIND TARGET'
            value={grindValue}
            onDecrease={lowerTarget}
            onIncrease={raiseTarget}
          />
          {volumetricAvailable && <TargetToggle value={grindTarget} onChange={changeTarget} />}
        </div>
      );
    return null;
  };

  return (
    <div className='flex h-full min-h-0 w-full min-w-0 flex-col gap-2 overflow-hidden'>
      <div className='bg-base-200/70 flex h-9 w-full shrink-0 gap-0.5 rounded-full p-0.5'>
        {MODES.filter(m => m.id !== 4 || showGrindTab).map(m => (
          <ModeTab
            key={m.id}
            mode={m}
            active={mode === m.id}
            onClick={() => changeMode(m.id)}
            rotation={m.iconRotation}
            disabled={!systemReady}
          />
        ))}
      </div>

      <div className='flex shrink-0 items-center justify-between gap-3 text-[0.65rem]'>
        <Metric
          icon={faThermometerHalf}
          current={(currentTemperature ?? 0).toFixed(1)}
          target={targetTemperature ?? 0}
          unit='°C'
        />
        {showWeight && (
          <Metric
            icon={faWeightScale}
            current={(currentWeight ?? 0).toFixed(1)}
            target={(targetWeight ?? 0).toFixed(0)}
            unit='g'
          />
        )}
        <Metric
          icon={faGauge}
          current={(currentPressure ?? 0).toFixed(1)}
          target={(targetPressure ?? 0).toFixed(1)}
          unit=' bar'
        />
      </div>

      <div className='flex min-h-0 w-full min-w-0 flex-1 flex-col items-center justify-center overflow-x-hidden overflow-y-auto'>
        {renderContent()}
      </div>

      {(showPrimary || showFlush || shownWarnings.length > 0) && (
        <div className='flex shrink-0 items-center gap-3'>
          <div className='flex min-w-0 flex-1 items-center gap-2' aria-label='Active warnings'>
            {shownWarnings.map(w => (
              <WarningIcon
                key={w.key}
                icon={w.icon}
                title={w.label}
                className={`text-lg ${w.level === WARNING_LEVEL.ERROR ? 'text-error' : 'text-warning'}`}
              />
            ))}
          </div>
          {showFlush && (
            <FlushButton
              className='btn btn-ghost btn-sm text-base-content/60 hover:text-base-content rounded-full text-xs'
              isFlushing={isFlushing}
              startFlush={startFlush}
              stopFlush={stopFlush}
            />
          )}
          {showPrimary && (
            <button
              type='button'
              className='btn btn-circle btn-md btn-primary'
              onClick={handlePrimary}
              aria-label={getPrimaryLabel(isActive, isFinished)}
            >
              <FontAwesomeIcon icon={getPrimaryIcon(isActive, isFinished)} className='text-lg' />
            </button>
          )}
          <div className='flex-1' aria-hidden='true' />
        </div>
      )}
    </div>
  );
}
