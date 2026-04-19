import { computed } from '@preact/signals';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
import { useCallback, useContext, useState, useMemo } from 'preact/hooks';
import { memo } from 'preact/compat';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay } from '@fortawesome/free-solid-svg-icons/faPlay';
import { faPause } from '@fortawesome/free-solid-svg-icons/faPause';
import { faCheck } from '@fortawesome/free-solid-svg-icons/faCheck';
import { faTint } from '@fortawesome/free-solid-svg-icons/faTint';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { faMinus } from '@fortawesome/free-solid-svg-icons/faMinus';
import { Tooltip } from '../../components/Tooltip.jsx';
import { TemperatureControls } from '../../components/TemperatureControls.jsx';
import { GrindTargetBar } from '../../components/GrindTargetBar.jsx';
import { ProcessDisplay } from '../../components/ProcessDisplay.jsx';
import { ModeIdleDisplay } from '../../components/ModeIdleDisplay.jsx';
import { useProfileData } from '../../hooks/useProfileData.js';
import { useGrindSettings } from '../../hooks/useGrindSettings.js';
import { useControlsVisibility } from '../../hooks/useControlsVisibility.js';
import { useProcessActions } from '../../hooks/useProcessActions.js';

const MODE_DOT_COLORS = ['bg-base-content/30', 'bg-primary', 'bg-warning', 'bg-error', 'bg-secondary'];

const status = computed(() => machine.value.status);
const TEMP_READY_THRESHOLD = 5;

const BUTTON_CONFIGS = {
  active: { icon: faPause, label: 'Pause', action: 'pause' },
  finished: { icon: faCheck, label: 'Finish', action: 'finish' },
  idle: { icon: faPlay, label: 'Start', action: 'start' },
};

const ACTION_HANDLERS = {
  pause: (handlers, isFlushing) => {
    handlers.onDeactivate();
    if (isFlushing) handlers.onClear();
  },
  finish: (handlers) => handlers.onClear(),
  start: (handlers) => handlers.onActivate(),
};

const GrindTargetControls = ({ grindTarget, grindTargetVolume, grindTargetDuration, onLowerTarget, onRaiseTarget }) => (
  <div className='flex flex-col items-center gap-2'>
    <div className='text-base-content/60 text-xs font-light tracking-wider'>GRIND TARGET</div>
    <div className='flex items-center space-x-2'>
      <Tooltip content='Decrease target'>
        <button
          onClick={onLowerTarget}
          className='btn btn-ghost btn-sm flex h-8 w-8 items-center justify-center rounded-full p-0'
        >
          <FontAwesomeIcon icon={faMinus} className='h-3 w-3' />
        </button>
      </Tooltip>
      <div className='text-base-content min-w-[80px] text-center text-lg font-bold'>
        {grindTarget === 1 ? `${grindTargetVolume}g` : `${Math.round(grindTargetDuration / 1000)}s`}
      </div>
      <Tooltip content='Increase target'>
        <button
          onClick={onRaiseTarget}
          className='btn btn-ghost btn-sm flex h-8 w-8 items-center justify-center rounded-full p-0'
        >
          <FontAwesomeIcon icon={faPlus} className='h-3 w-3' />
        </button>
      </Tooltip>
    </div>
  </div>
);

const FlushButton = memo(({ onFlush }) => (
  <button
    className='btn text-base-content/60 hover:text-base-content rounded-full text-sm transition-colors duration-200'
    onClick={onFlush}
    aria-label='Flush water'
  >
    <FontAwesomeIcon icon={faTint} />
    Flush
  </button>
));

FlushButton.displayName = 'FlushButton';

FlushButton.propTypes = {
  onFlush: PropTypes.func.isRequired,
};

const StateIndicator = memo(({ active, finished }) => {
  const state = active ? 'Brewing' : finished ? 'Finished' : 'Idle';
  const stateClass = active
    ? 'bg-warning/20 text-warning border-warning'
    : finished
    ? 'bg-success/20 text-success border-success'
    : 'bg-base-300/50 text-base-content/60 border-base-300';

  return (
    <div className={`badge badge-lg border-2 font-semibold ${stateClass}`}>
      {state}
    </div>
  );
});

StateIndicator.displayName = 'StateIndicator';

StateIndicator.propTypes = {
  active: PropTypes.bool.isRequired,
  finished: PropTypes.bool.isRequired,
};

const MODE_LABELS = ['Standby', 'Brew', 'Steam', 'Water', 'Grind'];

const QuickStatusStrip = memo(({ mode, active, finished, targetTemperature, grindTarget, grindTargetVolume, grindTargetDuration }) => {
  const state = active ? 'Brewing' : finished ? 'Finished' : MODE_LABELS[mode];
  const stateClass = active
    ? 'bg-warning/20 text-warning border-warning'
    : finished
    ? 'bg-success/20 text-success border-success'
    : 'bg-base-300/50 text-base-content/60 border-base-300';

  const showTemp = mode === 2 || mode === 3;
  const showGrind = mode === 4;

  return (
    <div className='flex items-center justify-center gap-3 py-2 px-3 rounded-xl border border-base-300/40 bg-base-100/50'>
      {/* Mode dot */}
      <span className={`size-2.5 rounded-full ${MODE_DOT_COLORS[mode]}`} />

      {/* State badge */}
      <span className={`badge badge-sm badge-outline font-semibold ${stateClass}`}>
        {state}
      </span>

      {/* Contextual target */}
      {showTemp && (
        <span className='text-sm text-base-content/60'>
          · {targetTemperature}°C
        </span>
      )}
      {showGrind && (
        <span className='text-sm text-base-content/60'>
          · {grindTarget === 1 ? `${grindTargetVolume}g` : `${Math.round(grindTargetDuration / 1000)}s`}
        </span>
      )}
    </div>
  );
});

QuickStatusStrip.displayName = 'QuickStatusStrip';

QuickStatusStrip.propTypes = {
  mode: PropTypes.number.isRequired,
  active: PropTypes.bool.isRequired,
  finished: PropTypes.bool.isRequired,
  targetTemperature: PropTypes.number.isRequired,
  grindTarget: PropTypes.number.isRequired,
  grindTargetVolume: PropTypes.number.isRequired,
  grindTargetDuration: PropTypes.number.isRequired,
};

const ActionButtons = memo(({ brew, active, finished, isFlushing, onActivate, onDeactivate, onClear, onFlush }) => {
  const buttonConfig = useMemo(() => {
    if (active) return BUTTON_CONFIGS.active;
    if (finished) return BUTTON_CONFIGS.finished;
    return BUTTON_CONFIGS.idle;
  }, [active, finished]);

  const handleClick = useCallback(() => {
    const handler = ACTION_HANDLERS[buttonConfig.action];
    if (handler) {
      handler({ onDeactivate, onClear, onActivate }, isFlushing);
    }
  }, [buttonConfig.action, onDeactivate, onClear, onActivate, isFlushing]);

  return (
    <div className='flex flex-col items-center gap-4'>
      <Tooltip content={buttonConfig.label}>
        <button className='btn btn-circle btn-lg border-2 border-primary bg-primary/10 hover:bg-primary/20 hover:border-primary text-primary' onClick={handleClick}>
          <FontAwesomeIcon icon={buttonConfig.icon} className='text-2xl' />
        </button>
      </Tooltip>

      {brew && !active && !finished && <FlushButton onFlush={onFlush} />}
    </div>
  );
});

ActionButtons.displayName = 'ActionButtons';

ActionButtons.propTypes = {
  brew: PropTypes.bool.isRequired,
  active: PropTypes.bool.isRequired,
  finished: PropTypes.bool.isRequired,
  isFlushing: PropTypes.bool.isRequired,
  onActivate: PropTypes.func.isRequired,
  onDeactivate: PropTypes.func.isRequired,
  onClear: PropTypes.func.isRequired,
  onFlush: PropTypes.func.isRequired,
};

const ProcessControls = ({ brew, mode }) => {
  const api = useContext(ApiServiceContext);
  const processInfo = status.value.process;
  const active = !!processInfo?.a;
  const finished = !!processInfo?.e && !active;
  const grind = mode === 4;
  const [isFlushing, setIsFlushing] = useState(false);

  // Use custom hooks for settings and profile data
  const { isGrindAvailable } = useGrindSettings(mode);
  useProfileData(api, brew, status.value.selectedProfileId);

  // Extract status values once for cleaner access
  const statusValues = useMemo(
    () => ({
      grindTarget: status.value.grindTarget,
      grindTargetVolume: status.value.grindTargetVolume,
      grindTargetDuration: status.value.grindTargetDuration,
      volumetricAvailable: status.value.volumetricAvailable,
      currentTemperature: status.value.currentTemperature,
      targetTemperature: status.value.targetTemperature,
      selectedProfileId: status.value.selectedProfileId,
    }),
    [
      status.value.grindTarget,
      status.value.grindTargetVolume,
      status.value.grindTargetDuration,
      status.value.volumetricAvailable,
      status.value.currentTemperature,
      status.value.targetTemperature,
      status.value.selectedProfileId,
    ]
  );

  // Memoize derived state values
  const derivedState = useMemo(
    () => ({
      shouldExpand: brew && (active || finished),
      tempReady: Math.abs(statusValues.targetTemperature - statusValues.currentTemperature) < TEMP_READY_THRESHOLD,
    }),
    [brew, active, finished, statusValues.targetTemperature, statusValues.currentTemperature]
  );

  // Get visibility flags for control elements
  const visibility = useControlsVisibility(
    mode,
    active,
    finished,
    isGrindAvailable,
    false, // showGrindTab - no longer needed since ModeTabBar removed
    statusValues.volumetricAvailable
  );

  // Get action handlers
  const actions = useProcessActions(api, grind, setIsFlushing);

  return (
    <div className='flex min-h-[250px] flex-col justify-between lg:min-h-[350px]'>
      <div className='mb-3'>
        <QuickStatusStrip
          mode={mode}
          active={active}
          finished={finished}
          targetTemperature={statusValues.targetTemperature}
          grindTarget={statusValues.grindTarget}
          grindTargetVolume={statusValues.grindTargetVolume}
          grindTargetDuration={statusValues.grindTargetDuration}
        />
      </div>
      {derivedState.shouldExpand && (
        <ProcessDisplay
          brew={brew}
          grind={grind}
          active={active}
          finished={finished}
          processInfo={processInfo}
          status={{
            mode,
            currentTemperature: statusValues.currentTemperature,
            targetTemperature: statusValues.targetTemperature,
            isGrindAvailable,
            volumetricAvailable: statusValues.volumetricAvailable,
            grindTarget: statusValues.grindTarget,
            grindTargetVolume: statusValues.grindTargetVolume,
            grindTargetDuration: statusValues.grindTargetDuration,
          }}
        />
      )}

      {!derivedState.shouldExpand && (
        <div className='flex flex-1 items-center justify-center'>
          <ModeIdleDisplay
            mode={mode}
            tempReady={derivedState.tempReady}
            isGrindAvailable={isGrindAvailable}
          />
        </div>
      )}

      <div className='mt-4 flex flex-col items-center gap-4 space-y-4'>
        {/* Grind target time/weight selector */}
        {visibility.showGrindTargetBar && (
          <GrindTargetBar
            grindTarget={statusValues.grindTarget}
            grindTargetVolume={statusValues.grindTargetVolume}
            grindTargetDuration={statusValues.grindTargetDuration}
            volumetricAvailable={statusValues.volumetricAvailable}
            onChangeTarget={actions.changeTarget}
          />
        )}

        {/* Temperature controls for Steam / Water modes */}
        {visibility.showTemperatureControls && (
          <TemperatureControls
            targetTemperature={statusValues.targetTemperature}
            onLower={actions.lowerTemp}
            onRaise={actions.raiseTemp}
          />
        )}

        {/* Grind target adjustment */}
        {visibility.showGrindTargetControls && (
          <GrindTargetControls
            grindTarget={statusValues.grindTarget}
            grindTargetVolume={statusValues.grindTargetVolume}
            grindTargetDuration={statusValues.grindTargetDuration}
            onLowerTarget={actions.lowerTarget}
            onRaiseTarget={actions.raiseTarget}
          />
        )}

        {/* Play/Pause/Finish button */}
        {visibility.showActionButtons && (
          <div className='flex flex-col items-center gap-2'>
            <StateIndicator active={active} finished={finished} />
            <ActionButtons
            brew={brew}
            active={active}
            finished={finished}
            isFlushing={isFlushing}
            onActivate={actions.activate}
            onDeactivate={actions.deactivate}
            onClear={actions.clear}
            onFlush={actions.startFlush}
            />
          </div>
        )}
      </div>
    </div>
  );
};

ProcessControls.propTypes = {
  brew: PropTypes.bool.isRequired,
  mode: PropTypes.oneOf([0, 1, 2, 3, 4]).isRequired,
};

export default ProcessControls;
