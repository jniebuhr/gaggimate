import { useCallback, useContext } from 'preact/hooks';
import ApiService, { ApiServiceContext, machine } from '../../services/ApiService.js';
import { computed } from '@preact/signals';
import { Chart, LineController, TimeScale, LinearScale, PointElement, LineElement, Legend, Filler } from 'chart.js';
import 'chartjs-adapter-dayjs-4/dist/chartjs-adapter-dayjs-4.esm';
import { OverviewChart } from '../../components/OverviewChart.jsx';
import Card from '../../components/Card.jsx';
import ProcessControls from './ProcessControls.jsx';
Chart.register(LineController);
Chart.register(TimeScale);
Chart.register(LinearScale);
Chart.register(PointElement);
Chart.register(LineElement);
Chart.register(Filler);
Chart.register(Legend);

const modeMap = {
  0: 'Standby',
  1: 'Brew',
  2: 'Steam',
  3: 'Water',
  4: 'Grind',
};

const status = computed(() => machine.value.status);

export function Home() {
  const apiService = useContext(ApiServiceContext);
  const changeMode = useCallback(
    (mode) => {
      apiService.send({
        tp: 'req:change-mode',
        mode,
      });
    },
    [apiService]
  );
  const mode = machine.value.status.mode;

  return (
    <div key="home" className="grid grid-cols-1 gap-2 sm:grid-cols-12 md:gap-2">
      <div className="col-span-12">
        <h2 className="text-2xl font-bold">Dashboard</h2>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:bg-gray-800 dark:border-gray-600 col-span-12">
        <div className="p-6 h-full">
          <OverviewChart />
        </div>
      </div>
      <Card xs={12}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
          <div className="col-span-12">
            <div className="flex flex-row gap-4 items-center justify-center">
              <div className="inline-flex rounded-md">
                <span className={`mode-selector mode-selector-xl ${mode === 0 && 'selected'}`} onClick={() => changeMode(0)}>
                  Standby
                </span>
                <span className={`mode-selector mode-selector-xl ${mode === 1 && 'selected'}`} onClick={() => changeMode(1)}>
                  Brew
                </span>
                <span className={`mode-selector mode-selector-xl ${mode === 2 && 'selected'}`} onClick={() => changeMode(2)}>
                  Steam
                </span>
                <span className={`mode-selector mode-selector-xl ${mode === 3 && 'selected'}`} onClick={() => changeMode(3)}>
                  Water
                </span>
              </div>
            </div>
          </div>
          <div className="col-span-12 sm:col-span-6 md:col-span-12 grid grid-cols-1 gap-2 sm:grid-cols-12">
            <div className="p-6 sm:col-span-12 md:col-span-4">
              <dl>
                <dt className="text-xl md:text-2xl font-bold">
                  {status.value.currentTemperature || 0} / {status.value.targetTemperature || 0} °C
                </dt>
                <dd className="text-sm font-medium text-slate-500">Temperature</dd>
              </dl>
            </div>
            <div className="p-6 sm:col-span-12 md:col-span-4">
              <dl>
                <dt className="text-xl md:text-2xl font-bold">
                  {status.value.currentPressure?.toFixed(1) || 0} / {status.value.targetPressure?.toFixed(1) || 0} bar
                </dt>
                <dd className="text-sm font-medium text-slate-500">Pressure</dd>
              </dl>
            </div>
            <div className="p-6 sm:col-span-12 md:col-span-4">
              <dl>
                <dt className="text-xl md:text-2xl font-bold">
                  <a href="/profiles">
                    {status.value.selectedProfile || '-'} <i className="fa-solid fa-rectangle-list ml-2"></i>
                  </a>
                </dt>
                <dd className="text-sm font-medium text-slate-500">Current Profile</dd>
              </dl>
            </div>
          </div>
          <div className="col-span-12 sm:col-span-6 md:col-span-12 p-2 flex flex-col gap-2 items-center justify-center">
            {(mode === 1 || mode === 3) && <ProcessControls brew={mode === 1} />}
          </div>
        </div>
      </Card>
    </div>
  );
}
