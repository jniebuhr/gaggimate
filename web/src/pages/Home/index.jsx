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
import SortableCard from './SortableCard.jsx';
import ProcessControls from './ProcessControls.jsx';
import HomeModeCard from './HomeModeCard.jsx';
Chart.register(LineController, TimeScale, LinearScale, PointElement, LineElement, Filler, Legend);

function ProcessCardContent() {
  return (
    <ProcessControls brew={machine.value.status.mode === 1} mode={machine.value.status.mode} />
  );
}

function StatusCardContent() {
  return <HomeModeCard mode={machine.value.status.mode} />;
}

function ChartCardContent() {
  return <OverviewChart />;
}

export function Home() {
  return (
    <div className='flex flex-col gap-6'>
      <DashboardGrid>
        <SortableCard id='process'>
          <ProcessCardContent />
        </SortableCard>
        <SortableCard id='status'>
          <StatusCardContent />
        </SortableCard>
        <SortableCard id='chart'>
          <ChartCardContent />
        </SortableCard>
      </DashboardGrid>
    </div>
  );
}