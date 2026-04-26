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
import HomeStatusStrip from './HomeStatusStrip.jsx';

Chart.register(LineController, TimeScale, LinearScale, PointElement, LineElement, Filler, Legend);

export function Home() {
  const mode = machine.value.status.mode;

  return (
    <div className='home-dashboard flex flex-col gap-5 lg:gap-6'>
      <HomeStatusStrip />

      <div className='grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.02fr)_minmax(22rem,0.98fr)] xl:items-stretch'>
        <Card title='Process Controls' className='home-dashboard-card home-dashboard-card-process'>
          <ProcessControls brew={mode === 1} mode={mode} />
        </Card>
        <Card title='Quick Toggles' className='home-dashboard-card home-dashboard-card-options'>
          <HomeModeCard mode={mode} />
        </Card>
      </div>

      <Card title='Temperature & Pressure Chart' fullHeight={true} className='home-dashboard-card home-dashboard-card-chart'>
        <OverviewChart />
      </Card>
    </div>
  );
}
