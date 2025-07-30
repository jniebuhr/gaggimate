import { useCallback, useContext } from 'preact/hooks';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
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
      <div className="card bg-base-100 shadow-xl col-span-12">
        <div className="card-body p-6 h-full">
          <OverviewChart />
        </div>
      </div>
      <Card xs={12}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
          <div className="col-span-12">
            <div className="flex flex-row gap-4 items-center justify-center">
              <div className="join">
                <button 
                  className={`join-item btn ${mode === 0 ? 'btn-primary' : 'btn-outline'}`} 
                  onClick={() => changeMode(0)}
                >
                  Standby
                </button>
                <button 
                  className={`join-item btn ${mode === 1 ? 'btn-primary' : 'btn-outline'}`} 
                  onClick={() => changeMode(1)}
                >
                  Brew
                </button>
                <button 
                  className={`join-item btn ${mode === 2 ? 'btn-primary' : 'btn-outline'}`} 
                  onClick={() => changeMode(2)}
                >
                  Steam
                </button>
                <button 
                  className={`join-item btn ${mode === 3 ? 'btn-primary' : 'btn-outline'}`} 
                  onClick={() => changeMode(3)}
                >
                  Water
                </button>
              </div>
            </div>
          </div>
          <div className="col-span-12 sm:col-span-6 md:col-span-12 grid grid-cols-1 gap-2 sm:grid-cols-12">
            <div className="stat sm:col-span-12 md:col-span-4">
              <div className="stat-title">Temperature</div>
              <div className="stat-value text-primary">
                {status.value.currentTemperature || 0} / {status.value.targetTemperature || 0} °C
              </div>
            </div>
            <div className="stat sm:col-span-12 md:col-span-4">
              <div className="stat-title">Pressure</div>
              <div className="stat-value text-secondary">
                {status.value.currentPressure?.toFixed(1) || 0} / {status.value.targetPressure?.toFixed(1) || 0} bar
              </div>
            </div>
            <div className="stat sm:col-span-12 md:col-span-4">
              <div className="stat-title">Current Profile</div>
              <div className="stat-value">
                <a href="/profiles" className="link link-primary">
                  {status.value.selectedProfile || '-'} <i className="fa-solid fa-rectangle-list ml-2" />
                </a>
              </div>
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
