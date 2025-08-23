import { computed } from '@preact/signals';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
import { useCallback, useContext, useState } from 'preact/hooks';
import PropTypes from 'prop-types';
import { faPause } from '@fortawesome/free-solid-svg-icons/faPause';
import { faCheck } from '@fortawesome/free-solid-svg-icons/faCheck';
import { faPlay } from '@fortawesome/free-solid-svg-icons/faPlay';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faThermometerHalf } from '@fortawesome/free-solid-svg-icons/faThermometerHalf';
import { faGauge } from '@fortawesome/free-solid-svg-icons/faGauge';
import { faRectangleList } from '@fortawesome/free-solid-svg-icons/faRectangleList';
import { faTint } from '@fortawesome/free-solid-svg-icons/faTint';
import { faClock } from '@fortawesome/free-solid-svg-icons/faClock';
import { faWeightScale } from '@fortawesome/free-solid-svg-icons/faWeightScale';

const status = computed(() => machine.value.status);

const zeroPad = (num, places) => String(num).padStart(places, '0');

function formatDuration(duration) {
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  return `${zeroPad(minutes, 1)}:${zeroPad(seconds, 2)}`;
}

const BrewProgress = props => {
  const { processInfo } = props;
  const active = !!processInfo.a;
  const progress = (processInfo.pp / processInfo.pt) * 100.0;
  const elapsed = Math.floor(processInfo.e / 1000);

  return (
    <div className='flex w-full flex-col items-center justify-center space-y-4 px-4'>
      {active && (
        <>
          <div className='space-y-2 text-center'>
            <div className='text-base-content/60 text-xs font-light tracking-wider sm:text-sm'>
              {processInfo.s === 'brew' ? 'INFUSION' : 'PREINFUSION'}
            </div>
            <div className='text-base-content text-2xl font-bold sm:text-4xl'>{processInfo.l}</div>
          </div>

          <div className='w-full max-w-md'>
            <div className='bg-base-content/20 h-2 w-full rounded-full'>
              <div
                className='bg-primary h-2 rounded-full transition-all duration-300 ease-out'
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className='space-y-2 text-center'>
            <div className='text-base-content/60 text-xs sm:text-sm'>
              {processInfo.tt === 'time' && `${(processInfo.pt / 1000).toFixed(0)}s`}
              {processInfo.tt === 'volumetric' && `${processInfo.pt.toFixed(0)}g`}
            </div>
            <div className='text-base-content text-2xl font-bold sm:text-3xl'>
              {formatDuration(elapsed)}
            </div>
          </div>
        </>
      )}
      {!active && (
        <div className='space-y-2 text-center'>
          <div className='text-base-content text-xl font-bold sm:text-2xl'>Finished</div>
          <div className='text-base-content text-2xl font-bold sm:text-3xl'>
            {formatDuration(elapsed)}
          </div>
        </div>
      )}
    </div>
  );
};

const ProcessControls = props => {
  // brew is true when mode equals 1 (Brew mode), false otherwise
  const { brew, mode, changeMode } = props;
  const brewTarget = status.value.brewTarget;
  const processInfo = status.value.process;
  const active = !!processInfo?.a;
  const finished = !!processInfo && !active;
  const apiService = useContext(ApiServiceContext);
  const [isFlushing, setIsFlushing] = useState(false);

  // Determine if we should show expanded view
  const shouldExpand = brew && (active || finished || (brew && !active && !finished));

  const changeTarget = useCallback(
    target => {
      apiService.send({
        tp: 'req:change-brew-target',
        target,
      });
    },
    [apiService],
  );

  const activate = useCallback(() => {
    apiService.send({
      tp: 'req:process:activate',
    });
  }, [apiService]);

  const deactivate = useCallback(() => {
    apiService.send({
      tp: 'req:process:deactivate',
    });
  }, [apiService]);

  const clear = useCallback(() => {
    apiService.send({
      tp: 'req:process:clear',
    });
  }, [apiService]);

  const startFlush = useCallback(() => {
    setIsFlushing(true);
    apiService
      .request({
        tp: 'req:flush:start',
      })
      .catch(error => {
        console.error('Flush start failed:', error);
        setIsFlushing(false);
      });
  }, [apiService]);

  const handleButtonClick = () => {
    if (active) {
      deactivate();

      if (isFlushing) {
        clear();
        setIsFlushing(false);
      }
    } else if (finished) {
      clear();
    } else {
      activate();
    }
  };

  const getButtonIcon = () => {
    if (active) {
      return faPause;
    } else if (finished) {
      return faCheck;
    }
    return faPlay;
  };

  return (
    <div className={`flex min-h-[250px] flex-col justify-between lg:min-h-[350px]`}>
      <div className='mb-2 flex justify-center'>
        <div className='bg-base-300 flex w-full max-w-md rounded-full p-1'>
          {[
            { id: 0, label: 'Standby' },
            { id: 1, label: 'Brew' },
            { id: 2, label: 'Steam' },
            { id: 3, label: 'Water' },
          ].map(tab => (
            <button
              key={tab.id}
              className={`flex-1 rounded-full px-1 py-1 text-sm transition-all duration-200 sm:px-4 lg:px-2 lg:py-2 ${
                mode === tab.id
                  ? 'bg-primary text-primary-content font-medium'
                  : 'text-base-content/60 hover:text-base-content'
              }`}
              onClick={() => changeMode(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className='mt-1 mb-2 flex flex-col items-center justify-between space-y-2 sm:flex-row sm:space-y-0'>
        <div className='flex flex-row items-center gap-2 text-center text-base sm:text-left sm:text-lg'>
          <FontAwesomeIcon icon={faThermometerHalf} className='text-base-content/60' />
          <span className='text-base-content'>
            {status.value.currentTemperature.toFixed(1) || 0}
          </span>
          <span className='text-success font-semibold'>
            {' '}
            / {status.value.targetTemperature || 0}°C
          </span>
        </div>
        <div className='flex flex-row items-center gap-2 text-center text-base sm:text-right sm:text-lg'>
          <FontAwesomeIcon icon={faGauge} className='text-base-content/60' />
          <span className='text-base-content'>
            {status.value.currentPressure?.toFixed(1) || 0} /{' '}
            {status.value.targetPressure?.toFixed(1) || 0} bar
          </span>
        </div>
      </div>
      {brew && (
        <div className='mb-2 text-center'>
          <div className='text-base-content/60 text-sm'>Current Profile</div>
          <a href='/profiles' className='mb-2 flex items-center justify-center gap-2'>
            <span className='text-base-content text-xl font-semibold sm:text-2xl'>
              {status.value.selectedProfile || 'Default'}
            </span>
            <FontAwesomeIcon icon={faRectangleList} className='text-base-content/60 text-xl' />
          </a>
        </div>
      )}

      {shouldExpand && (
        <>
          <div className='flex flex-1 items-center justify-center'>
            {(active || finished) && brew && <BrewProgress processInfo={processInfo} />}
            {!brew && (
              <div className='space-y-2 text-center'>
                <div className='text-xl font-bold sm:text-2xl'>
                  {mode === 0 && 'Standby Mode'}
                  {mode === 2 && 'Steam Mode'}
                  {mode === 3 && 'Water Mode'}
                </div>
                <div className='text-base-content/60 text-sm'>
                  {mode === 0 && 'Machine is ready'}
                  {mode === 3 && 'Start and open steam valve to pull water'}
                  {mode === 2 &&
                    (Math.abs(status.value.targetTemperature - status.value.currentTemperature) < 5
                      ? 'Steam is ready'
                      : 'Preheating')}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {!shouldExpand && (
        <div className='flex flex-1 items-center justify-center'>
          <div className='space-y-2 text-center'>
            <div className='text-lg font-semibold sm:text-xl'>
              {mode === 0 && 'Standby'}
              {mode === 1 && 'Brew Mode'}
              {mode === 2 && 'Steam'}
              {mode === 3 && 'Water'}
            </div>
            <div className='text-base-content/60 text-sm'>
              {mode === 0 && 'Machine is ready'}
              {mode === 1 && 'Select brew target to start'}
              {mode === 2 &&
                (Math.abs(status.value.targetTemperature - status.value.currentTemperature) < 5
                  ? 'Steam is ready'
                  : 'Preheating')}
              {mode === 3 && 'Start and open steam valve to pull water'}
            </div>
          </div>
        </div>
      )}

      <div className='mt-4 flex flex-col items-center gap-4 space-y-4'>
        {brew && !active && !finished && status.value.volumetricAvailable && (
          <div className='bg-base-300 flex w-full max-w-xs rounded-full p-1'>
            <button
              className={`flex-1 cursor-pointer rounded-full px-3 py-1 text-sm transition-all duration-200 lg:py-2 ${brewTarget === 0 ? 'bg-primary text-primary-content font-medium' : 'text-base-content/60 hover:text-base-content'}`}
              onClick={() => changeTarget(0)}
            >
              <FontAwesomeIcon icon={faClock} />
              <span className='ml-1'>Time</span>
            </button>
            <button
              className={`flex-1 cursor-pointer rounded-full px-3 py-1 text-sm transition-all duration-200 lg:py-2 ${brewTarget === 1 ? 'bg-primary text-primary-content font-medium' : 'text-base-content/60 hover:text-base-content'}`}
              onClick={() => changeTarget(1)}
            >
              <FontAwesomeIcon icon={faWeightScale} />
              <span className='ml-1'>Weight</span>
            </button>
          </div>
        )}
        {(mode === 1 || mode === 3) && (
          <div className='flex flex-col items-center gap-4 space-y-4'>
            <button className='btn btn-circle btn-lg btn-primary' onClick={handleButtonClick}>
              <FontAwesomeIcon icon={getButtonIcon()} className='text-2xl' />
            </button>

            {brew && !active && !finished && (
              <button
                className='btn text-base-content/60 hover:text-base-content rounded-full text-sm transition-colors duration-200'
                onClick={startFlush}
                title='Click to flush water'
              >
                <FontAwesomeIcon icon={faTint} />
                Flush
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

ProcessControls.propTypes = {
  brew: PropTypes.bool.isRequired,
  mode: PropTypes.oneOf([0, 1, 2, 3]).isRequired,
  changeMode: PropTypes.func.isRequired,
};

export default ProcessControls;
