import { machine } from '../../services/ApiService.js';
import {
  Chart,
  LineController,
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  Legend,
  Filler,
} from 'chart.js';
import 'chartjs-adapter-dayjs-4/dist/chartjs-adapter-dayjs-4.esm';
import { OverviewChart } from '../../components/OverviewChart.jsx';
import DashboardGrid from './DashboardGrid.jsx';
import ProcessControls from './ProcessControls.jsx';
import HomeModeCard from './HomeModeCard.jsx';
Chart.register(LineController, TimeScale, LinearScale, PointElement, LineElement, Filler, Legend);

export function Home() {
  return (
    <div className='flex flex-col gap-6'>
      <DashboardGrid
        process={<ProcessControls brew={machine.value.status.mode === 1} mode={machine.value.status.mode} />}
        status={<HomeModeCard mode={machine.value.status.mode} />}
        chart={<OverviewChart />}
      />
    </div>
  );
}