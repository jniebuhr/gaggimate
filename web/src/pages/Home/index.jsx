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
import { StatusMetricsRow } from '../../components/StatusMetricsRow.jsx';

Chart.register(LineController, TimeScale, LinearScale, PointElement, LineElement, Filler, Legend);

export function Home() {
  const mode = machine.value.status.mode;

  return (
    <div className='flex flex-col gap-5'>
      {/* Row 1: Two cards side by side */}
      <div className='grid grid-cols-1 gap-5 lg:grid-cols-2'>
        <Card title='Process Controls'>
          <ProcessControls brew={mode === 1} mode={mode} />
        </Card>
        <Card title='Status'>
          <StatusMetricsRow mode={mode} />
        </Card>
      </div>

      {/* Row 2: Chart spans full width */}
      <Card title='Temperature & Pressure Chart' fullHeight={true}>
        <OverviewChart />
      </Card>
    </div>
  );
}
