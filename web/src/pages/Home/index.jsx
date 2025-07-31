import { useCallback, useContext } from 'preact/hooks';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
import { Chart, LineController, TimeScale, LinearScale, PointElement, LineElement, Legend, Filler } from 'chart.js';
import 'chartjs-adapter-dayjs-4/dist/chartjs-adapter-dayjs-4.esm';
import { OverviewChart } from '../../components/OverviewChart.jsx';
import Card from '../../components/Card.jsx';
import ProcessControls from './ProcessControls.jsx';

Chart.register(LineController, TimeScale, LinearScale, PointElement, LineElement, Filler, Legend);

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
    <div key="home" className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-12">
      <div className="col-span-12">
        <h2 className="text-xl sm:text-2xl font-bold text-base-content">Dashboard</h2>
      </div>

      <Card xs={12} sm={12}>
        <OverviewChart />
      </Card>

      <Card xs={12} sm={12}>
        <ProcessControls brew={mode === 1} mode={mode} changeMode={changeMode} />
      </Card>
    </div>
  );
}
