import { computed } from '@preact/signals';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
import { useCallback, useContext } from 'preact/hooks';
import PropTypes from 'prop-types';
import Card from '../../components/Card.jsx';

const status = computed(() => machine.value.status);

const zeroPad = (num, places) => String(num).padStart(places, '0');

function formatDuration(duration) {
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  return `${zeroPad(minutes, 1)}:${zeroPad(seconds, 2)}`;
}

const BrewProgress = (props) => {
  const { processInfo } = props;
  const active = !!processInfo.a;
  const progress = (processInfo.pp / processInfo.pt) * 100.0;
  const elapsed = Math.floor(processInfo.e / 1000);

  return (
    <div className="flex flex-col items-center justify-center w-full space-y-6">
      {active && (
        <>
          <div className="text-center space-y-2">
            <div className="text-base-content/60 text-sm font-light tracking-wider">
              {processInfo.s === 'brew' ? 'INFUSION' : 'PREINFUSION'}
            </div>
            <div className="text-base-content text-4xl font-bold">{processInfo.l}</div>
          </div>

          <div className="w-full max-w-md">
            <div className="w-full bg-base-content/20 rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="text-center space-y-1">
            <div className="text-base-content/60 text-sm">
              {processInfo.tt === 'time' && `${(processInfo.pt / 1000).toFixed(0)}s`}
              {processInfo.tt === 'volumetric' && `${processInfo.pt.toFixed(0)}g`}
            </div>
            <div className="text-base-content text-3xl font-bold">{formatDuration(elapsed)}</div>
          </div>
        </>
      )}
      {!active && (
        <div className="text-center space-y-2">
          <div className="text-base-content text-2xl font-bold">Finished</div>
          <div className="text-base-content text-3xl font-bold">{formatDuration(elapsed)}</div>
        </div>
      )}
    </div>
  );
};

const ProcessControls = (props) => {
  // brew is true when mode equals 1 (Brew mode), false otherwise
  const { brew, mode, changeMode } = props;
  const brewTarget = status.value.brewTarget;
  const processInfo = status.value.process;
  const active = !!processInfo?.a;
  const finished = !!processInfo && !active;
  const apiService = useContext(ApiServiceContext);

  const changeTarget = useCallback(
    (target) => {
      apiService.send({
        tp: 'req:change-brew-target',
        target,
      });
    },
    [apiService]
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

  const handleButtonClick = () => {
    if (active) {
      deactivate();
    } else if (finished) {
      clear();
    } else {
      activate();
    }
  };

  const getButtonIcon = () => {
    if (active) {
      return 'fa fa-pause';
    } else if (finished) {
      return 'fa fa-check';
    }
    return 'fa fa-play';
  };

  return (
    <Card sm={12}>
      <div className="min-h-[600px] flex flex-col justify-between">
        <div className="flex justify-between items-center mb-6">
          <div className="text-lg">
            <span className="text-base-content">{status.value.currentTemperature || 0}</span>
            <span className="text-success font-semibold"> / {status.value.targetTemperature || 0}°C</span>
          </div>
          <div className="text-lg">
            <span className="text-base-content">
              {status.value.currentPressure?.toFixed(0) || 0} / {status.value.targetPressure?.toFixed(0) || 0} bar
            </span>
          </div>
        </div>

        <div className="flex justify-center mb-8">
          <div className="flex bg-base-300 rounded-full p-1">
            {[
              { id: 0, label: 'Standby' },
              { id: 1, label: 'Brew' },
              { id: 2, label: 'Steam' },
              { id: 3, label: 'Water' },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`px-6 py-2 rounded-full transition-all duration-200 ${
                  mode === tab.id ? 'bg-primary text-primary-content font-medium' : 'text-base-content/60 hover:text-base-content'
                }`}
                onClick={() => changeMode(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-2xl font-semibold text-base-content">{status.value.selectedProfile || 'Default'}</span>
            <i className="fa-solid fa-rectangle-list text-base-content/60" />
          </div>
          <div className="text-base-content/60 text-sm">Current Profile</div>
        </div>

        <div className="flex-1 flex items-center justify-center">
          {(active || finished) && brew && <BrewProgress processInfo={processInfo} />}
          {!brew && (
            <div className="text-center space-y-4">
              <div className="text-base-content text-2xl font-bold">
                {mode === 0 && 'Standby Mode'}
                {mode === 2 && 'Steam Mode'}
                {mode === 3 && 'Water Mode'}
              </div>
              <div className="text-base-content/60">
                {mode === 0 && 'Machine is ready'}
                {mode === 2 && 'Steam function active'}
                {mode === 3 && 'Hot water function active'}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center space-y-6 mt-8">
          {(mode === 1 || mode === 3) && (
            <button className="btn btn-circle btn-lg btn-primary" onClick={handleButtonClick}>
              <i className={`text-2xl ${getButtonIcon()}`} />
            </button>
          )}

          {brew && !active && !finished && (
            <div className="flex bg-base-300 rounded-full p-1">
              <button
                className={`px-4 py-2 rounded-full transition-all duration-200 flex items-center gap-2 ${
                  brewTarget === 0 ? 'bg-primary text-primary-content' : 'text-base-content/60 hover:text-base-content'
                }`}
                onClick={() => changeTarget(0)}
              >
                <i className="fa-solid fa-clock" />
                <span className="text-sm">Time</span>
              </button>
              <button
                className={`px-4 py-2 rounded-full transition-all duration-200 flex items-center gap-2 ${
                  brewTarget === 1 ? 'bg-primary text-primary-content' : 'text-base-content/60 hover:text-base-content'
                }`}
                onClick={() => changeTarget(1)}
              >
                <i className="fa-solid fa-weight-scale" />
                <span className="text-sm">Weight</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

ProcessControls.propTypes = {
  brew: PropTypes.bool.isRequired,
  mode: PropTypes.oneOf([0, 1, 2, 3]).isRequired,
  changeMode: PropTypes.func.isRequired,
};

export default ProcessControls;
