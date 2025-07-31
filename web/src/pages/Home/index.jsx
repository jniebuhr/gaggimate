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
    <div key="home" className="grid grid-cols-1 gap-6 sm:grid-cols-12 md:gap-6">
      <div className="col-span-12">
        <h2 className="text-2xl font-bold">Dashboard</h2>
      </div>
      
      {/* Overview Chart */}
      <div className="card bg-base-100 shadow-xl col-span-12">
        <div className="card-body p-6 h-full">
          <OverviewChart />
        </div>
      </div>
      
      {/* Process Controls - Full Width */}
      <div className="col-span-12">
        <ProcessControls brew={mode === 1} mode={mode} changeMode={changeMode} />
      </div>
    </div>
  );
}
