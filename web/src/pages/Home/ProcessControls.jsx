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
          <span className="text-gray-600 font-light text-xl">{processInfo.s === 'brew' ? 'BREW' : 'PREINFUSION'}</span>
          <span className="text-xl">{processInfo.l}</span>
          <div className="w-9/12 my-2 bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
            <div className="bg-blue-600 h-2.5 rounded-full" style={`width: ${progress.toFixed(0)}%`}></div>
          </div>
        </>
      )}
      {processInfo.tt === 'volumetric' ||
        (active && (
          <span className="text-sm text-gray-700 dark:text-gray-400">
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
        <span
          className="cursor-pointer group flex items-center justify-center rounded-full border border-transparent w-20 h-20 text-center p-0 text-4xl font-semibold text-slate-900 hover:bg-indigo-100 hover:text-indigo-600 active:border-indigo-200 active:bg-indigo-100 sm:gap-2 dark:text-slate-300"
          onClick={() => (active ? deactivate() : finished ? clear() : activate())}
        >
          <i className={active ? 'fa fa-pause' : finished ? 'fa fa-check' : 'fa fa-play'}></i>
        </span>
      </div>
      {brew && !active && !finished && (
        <div className="flex flex-row gap-2 items-center justify-center">
          <div className="inline-flex rounded-md">
            <span className={`mode-selector ${brewTarget === 0 && 'selected'}`} onClick={() => changeTarget(0)}>
              <i className="fa-solid fa-clock"></i>
            </span>
            <span className={`mode-selector ${brewTarget === 1 && 'selected'}`} onClick={() => changeTarget(1)}>
              <i className="fa-solid fa-weight-scale"></i>
            </span>
          </div>
        </div>
      )}
    </>
  );
};

export default ProcessControls;
