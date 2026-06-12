import { useEffect, useState } from 'preact/hooks';
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
import CompactProcessControls from './CompactProcessControls.jsx';
import { DashboardSidebar } from './DashboardSidebar.jsx';
import { getDashboardLayout, DASHBOARD_LAYOUTS } from '../../utils/dashboardManager.js';

Chart.register(LineController, TimeScale, LinearScale, PointElement, LineElement, Filler, Legend);

export function Home() {
  const [dashboardLayout, setDashboardLayout] = useState(DASHBOARD_LAYOUTS.ORDER_FIRST);

  useEffect(() => {
    setDashboardLayout(getDashboardLayout());
    const handleStorageChange = e => {
      if (e.key === 'dashboardLayout') {
        setDashboardLayout(e.newValue || DASHBOARD_LAYOUTS.ORDER_FIRST);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const isOrderFirst = dashboardLayout === DASHBOARD_LAYOUTS.ORDER_FIRST;

  return (
    <div className='landscape:max-lg:flex landscape:max-lg:h-full landscape:max-lg:flex-col'>
      <div className='mb-4 flex flex-row items-center gap-2 landscape:hidden landscape:lg:block'>
        <h1 className='flex-grow text-2xl font-bold sm:text-3xl'>Dashboard</h1>
      </div>

      <div className='grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-stretch landscape:max-lg:min-h-0 landscape:max-lg:flex-1 landscape:max-lg:grid-cols-10'>
        <div
          className={`flex min-h-0 min-w-0 flex-col gap-2 sm:col-span-10 lg:col-span-1 landscape:max-lg:col-span-5 landscape:max-lg:min-h-0 ${isOrderFirst ? 'order-first' : 'order-last'}`}
        >
          <div className='landscape:hmd:hidden contents portrait:md:hidden'>
            <CompactProcessControls />
          </div>
          <div className='landscape:hmd:contents hidden portrait:md:contents'>
            <DashboardSidebar />
          </div>
        </div>

        <Card
          sm={10}
          lg={2}
          className={`landscape:max-lg:min-h-0 landscape:max-lg:col-span-5 ${isOrderFirst ? 'order-last' : 'order-first'}`}
          title='Temperature & Pressure Chart'
          fullHeight={true}
        >
          <OverviewChart />
        </Card>
      </div>
    </div>
  );
}
