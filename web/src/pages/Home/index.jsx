import { useCallback, useContext, useState, useEffect } from 'preact/hooks';
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
import { getDashboardLayout, DASHBOARD_LAYOUTS } from '../../utils/dashboardManager.js';

Chart.register(LineController, TimeScale, LinearScale, PointElement, LineElement, Filler, Legend);

export function Home() {
  const [dashboardLayout, setDashboardLayout] = useState(DASHBOARD_LAYOUTS.ORDER_FIRST);
  const apiService = useContext(ApiServiceContext);

  useEffect(() => {
    setDashboardLayout(getDashboardLayout());

    const handleStorageChange = e => {
      if (e.key === 'dashboardLayout') {
        setDashboardLayout(e.newValue || DASHBOARD_LAYOUTS.ORDER_FIRST);
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

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
      <div className='mb-4 flex flex-row items-center gap-2 landscape:hidden landscape:lg:block'>
        <h1 className='flex-grow text-2xl font-bold sm:text-3xl'>Dashboard</h1>
      </div>

      <div className='grid grid-cols-1 gap-4 lg:grid-cols-10 lg:items-stretch landscape:sm:grid-cols-10'>
        <Card
          sm={10}
          lg={4}
          className={`landscape:sm:col-span-5 ${dashboardLayout === DASHBOARD_LAYOUTS.ORDER_FIRST ? 'order-first' : 'order-last'}`}
          title='Process Controls'
        >
          <ProcessControls brew={mode === 1} mode={mode} changeMode={changeMode} />
        </Card>

        <Card
          sm={10}
          lg={6}
          className={`landscape:sm:col-span-5 ${dashboardLayout === DASHBOARD_LAYOUTS.ORDER_FIRST ? 'order-last' : 'order-first'}`}
          title='Temperature & Pressure Chart'
          fullHeight={true}
        >
          <OverviewChart />
        </Card>
      </div>
    </>
  );
}
