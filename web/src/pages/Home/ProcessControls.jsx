import { computed } from '@preact/signals';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
import { useCallback, useContext } from 'preact/hooks';

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
    <div className="flex flex-col justify-center items-center w-full">
      {active && (
        <>
          <span className="text-base-content/70 font-light text-xl">{processInfo.s === 'brew' ? 'BREW' : 'PREINFUSION'}</span>
          <span className="text-xl">{processInfo.l}</span>
          <div className="w-9/12 my-2">
            <progress className="progress progress-primary w-full" value={progress.toFixed(0)} max="100" />
          </div>
        </>
      )}
      {processInfo.tt === 'volumetric' ||
        (active && (
          <span className="text-sm text-base-content/60">
            {processInfo.tt === 'time' && `${(processInfo.pt / 1000).toFixed(1)}s`}
            {processInfo.tt === 'volumetric' && `${processInfo.pt.toFixed(1)}g`}
          </span>
        ))}
      {!active && <span className="text-lg">Finished</span>}
      <span className={active ? 'text-lg' : 'text-2xl my-2'}>{formatDuration(elapsed)}</span>
    </div>
  );
};

const ProcessControls = (props) => {
  const { brew } = props;
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
  return (
    <>
      {(active || finished) && brew && <BrewProgress processInfo={processInfo} />}
      <div className="flex flex-row gap-2 items-center justify-center">
        <button
          className="btn btn-circle btn-lg btn-primary"
          onClick={() => (active ? deactivate() : finished ? clear() : activate())}
        >
          <i className={active ? 'fa fa-pause' : finished ? 'fa fa-check' : 'fa fa-play'} />
        </button>
      </div>
      {brew && !active && !finished && (
        <div className="flex flex-row gap-2 items-center justify-center">
          <div className="join">
            <button 
              className={`join-item btn ${brewTarget === 0 ? 'btn-primary' : 'btn-outline'}`} 
              onClick={() => changeTarget(0)}
            >
              <i className="fa-solid fa-clock" />
            </button>
            <button 
              className={`join-item btn ${brewTarget === 1 ? 'btn-primary' : 'btn-outline'}`} 
              onClick={() => changeTarget(1)}
            >
              <i className="fa-solid fa-weight-scale" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ProcessControls;
