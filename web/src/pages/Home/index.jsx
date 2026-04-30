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
import Card from '../../components/Card.jsx';
import ProcessControls from './ProcessControls.jsx';
import HomeModeCard from './HomeModeCard.jsx';
Chart.register(LineController, TimeScale, LinearScale, PointElement, LineElement, Filler, Legend);

export function Home() {
  return (
    <div className='flex flex-col gap-6'>
      {/* Top row: Process controls + status */}
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px] lg:items-start'>
        <Card title='Process' className='home-dashboard-card home-dashboard-card-process'>
          <ProcessControls brew={machine.value.status.mode === 1} mode={machine.value.status.mode} />
        </Card>
        <Card title='Status' className='home-dashboard-card home-dashboard-card-options'>
          <HomeModeCard mode={machine.value.status.mode} />
        </Card>
      </div>

      {/* Temperature / Pressure chart */}
      <Card title='Temperature & Pressure' fullHeight={true} className='home-dashboard-card home-dashboard-card-chart'>
        <OverviewChart />
      </Card>
    </div>
  );
}