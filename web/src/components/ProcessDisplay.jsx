import PropTypes from 'prop-types';
import { useMemo, memo } from 'preact/compat';
import { ProcessProfileChart } from './ProcessProfileChart.jsx';

const zeroPad = (num, places) => String(num).padStart(places, '0');

function formatDuration(duration) {
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  return `${zeroPad(minutes, 1)}:${zeroPad(seconds, 2)}`;
}

export function ProcessDisplay({ brew, grind, active, finished, processInfo, profileData, status: statusProp }) {
  const { mode, isGrindAvailable } = statusProp;

  return (
    <div className='flex flex-1 items-center justify-center'>
      {(active || finished) && brew && <BrewProgress processInfo={processInfo} profileData={profileData} />}
      {(active || finished) && grind && <GrindProgress processInfo={processInfo} />}
      {!brew && !grind && (
        <ModeMessage mode={mode} tempReady={Math.abs(statusProp.targetTemperature - statusProp.currentTemperature) < 5} />
      )}
      {grind && !active && !finished && (
        <GrindIdleMessage isGrindAvailable={isGrindAvailable} />
      )}
    </div>
  );
}

function ModeMessage({ mode, tempReady }) {
  const messages = {
    0: { title: 'Standby Mode', subtitle: 'Machine is ready' },
    2: { title: 'Steam Mode', subtitle: tempReady ? 'Steam is ready' : 'Preheating' },
    3: { title: 'Water Mode', subtitle: 'Start and open steam valve to pull water' },
  };

  const msg = messages[mode] || { title: 'Unknown', subtitle: '' };

  return (
    <div className='space-y-2 text-center'>
      <div className='text-xl font-bold sm:text-2xl'>{msg.title}</div>
      <div className='text-base-content/60 text-sm'>{msg.subtitle}</div>
    </div>
  );
}

function GrindIdleMessage({ isGrindAvailable }) {
  return (
    <div className='space-y-2 text-center'>
      <div className='text-xl font-bold sm:text-2xl'>Grind</div>
      <div className='text-base-content/60 text-sm'>
        {isGrindAvailable ? 'Select grind target to start' : 'Grind function not available'}
      </div>
    </div>
  );
}

const ProgressBar = memo(({ progress }) => (
  <div className='w-full max-w-md'>
    <div className='bg-base-content/20 h-2 w-full rounded-full'>
      <div className='bg-primary h-2 rounded-full transition-all duration-300 ease-out' style={{ width: `${progress}%` }} />
    </div>
  </div>
));

const getTargetDisplay = (targetType, progressTotal, precision) => {
  if (targetType === 'time') return `${(progressTotal / 1000).toFixed(0)}s`;
  if (targetType === 'volumetric') return `${progressTotal.toFixed(precision)}g`;
  return '';
};

const ActiveProgress = ({ statusLabel, label, progress, targetDisplay, elapsedSeconds }) => (
  <>
    <div className='space-y-2 text-center'>
      <div className='text-base-content/60 text-xs font-light tracking-wider sm:text-sm'>{statusLabel}</div>
      <div className='text-base-content text-2xl font-bold sm:text-4xl'>{label || 'Unknown'}</div>
    </div>
    <ProgressBar progress={progress} />
    <div className='space-y-2 text-center'>
      <div className='text-base-content/60 text-xs sm:text-sm'>{targetDisplay}</div>
      <div className='text-base-content text-2xl font-bold sm:text-3xl'>{formatDuration(elapsedSeconds)}</div>
    </div>
  </>
);

const FinishedProgress = ({ elapsedSeconds }) => (
  <div className='space-y-2 text-center'>
    <div className='text-base-content text-xl font-bold sm:text-2xl'>Finished</div>
    <div className='text-base-content text-2xl font-bold sm:text-3xl'>{formatDuration(elapsedSeconds)}</div>
  </div>
);

const ProgressDisplay = ({ processInfo, type }) => {
  // Destructure processInfo for cleaner code
  const { a: isActive, pt: progressTotal, pp: progressPosition, e: elapsedMs, s: stage, l: label, tt: targetType } = processInfo;

  // Memoize calculations to prevent unnecessary recalculations
  const progress = useMemo(
    () => (progressTotal > 0 ? (progressPosition / progressTotal) * 100.0 : 0),
    [progressTotal, progressPosition]
  );

  const elapsedSeconds = useMemo(() => Math.floor(elapsedMs / 1000), [elapsedMs]);

  // Compute derived values
  const active = !!isActive;
  const statusLabel = type === 'grind' ? 'GRINDING' : stage === 'brew' ? 'INFUSION' : 'PREINFUSION';
  const targetPrecision = type === 'grind' && targetType === 'volumetric' ? 1 : 0;
  const targetDisplay = getTargetDisplay(targetType, progressTotal, targetPrecision);

  return (
    <div className='flex w-full flex-col items-center justify-center space-y-4 px-4'>
      {active ? (
        <ActiveProgress
          statusLabel={statusLabel}
          label={label}
          progress={progress}
          targetDisplay={targetDisplay}
          elapsedSeconds={elapsedSeconds}
        />
      ) : (
        <FinishedProgress elapsedSeconds={elapsedSeconds} />
      )}
    </div>
  );
};

const GrindProgress = ({ processInfo }) => <ProgressDisplay processInfo={processInfo} type='grind' />;

const BrewProgress = ({ processInfo, profileData }) => {
  // Calculate progress from processInfo
  const { a: isActive, pt: progressTotal, pp: progressPosition, e: elapsedMs, s: stage, l: label, tt: targetType } = processInfo;
  const progress = progressTotal > 0 ? (progressPosition / progressTotal) * 100.0 : 0;
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const targetPrecision = targetType === 'volumetric' ? 1 : 0;
  const targetDisplay = targetType === 'time' ? `${(progressTotal / 1000).toFixed(0)}s` : targetType === 'volumetric' ? `${progressTotal.toFixed(targetPrecision)}g` : '';

  return (
    <div className='flex w-full flex-col items-center justify-center space-y-4 px-4'>
      {profileData ? (
        <ProcessProfileChart
          data={profileData}
          processInfo={processInfo}
          className='max-h-48 w-full'
        />
      ) : (
        <div className='text-center'>
          <div className='text-base-content text-2xl font-bold sm:text-4xl'>{label || 'Unknown'}</div>
        </div>
      )}
      <ProgressBar progress={progress} />
      <div className='space-y-2 text-center'>
        <div className='text-base-content/60 text-xs sm:text-sm'>{targetDisplay}</div>
        <div className='text-base-content text-2xl font-bold sm:text-3xl'>{formatDuration(elapsedSeconds)}</div>
      </div>
    </div>
  );
};

ProcessDisplay.propTypes = {
  brew: PropTypes.bool.isRequired,
  grind: PropTypes.bool.isRequired,
  active: PropTypes.bool.isRequired,
  finished: PropTypes.bool.isRequired,
  processInfo: PropTypes.object.isRequired,
  profileData: PropTypes.object,
  status: PropTypes.object.isRequired,
};
