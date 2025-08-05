import { useCallback, useContext } from 'preact/hooks';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
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

Chart.register(LineController, TimeScale, LinearScale, PointElement, LineElement, Filler, Legend);

export function Home() {
  const apiService = useContext(ApiServiceContext);
  const changeMode = useCallback(
    mode => {
      apiService.send({
        tp: 'req:change-mode',
        mode,
      });
    },
    [apiService],
  );
  const mode = machine.value.status.mode;

  return (
    <>
      <div className='mb-4 flex flex-row items-center gap-2 landscape:hidden'>
        <h2 className='flex-grow text-2xl font-bold sm:text-3xl'>Dashboard</h2>
      </div>

      <div className='grid grid-cols-1 gap-4 lg:grid-cols-12'>
        <Card sm={12} title='Temperature & Pressure Chart'>
          <OverviewChart />
        </Card>

        <Card sm={12} title='Process Controls'>
          <ProcessControls brew={mode === 1} mode={mode} changeMode={changeMode} />
        </Card>
      </div>
    </>
  );
}
