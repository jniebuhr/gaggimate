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
import { DashboardSidebar } from './DashboardSidebar.jsx';
import { RecentShotsCard } from './cards/RecentShotsCard.jsx';
import { getDashboardLayout, DASHBOARD_LAYOUTS, getDashboardCardMode, DASHBOARD_CARD_MODES, showRecentShotsSignal } from '../../utils/dashboardManager.js';

Chart.register(LineController, TimeScale, LinearScale, PointElement, LineElement, Filler, Legend);

export function Home() {
  const [dashboardLayout, setDashboardLayout] = useState(DASHBOARD_LAYOUTS.ORDER_FIRST);
  const [cardMode, setCardMode] = useState(DASHBOARD_CARD_MODES.MULTI);

  useEffect(() => {
    setDashboardLayout(getDashboardLayout());
    setCardMode(getDashboardCardMode());
    const handleStorageChange = e => {
      if (e.key === 'dashboardLayout') {
        setDashboardLayout(e.newValue || DASHBOARD_LAYOUTS.ORDER_FIRST);
      }
      if (e.key === 'dashboardCardMode') {
        setCardMode(e.newValue || DASHBOARD_CARD_MODES.MULTI);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const isOrderFirst = dashboardLayout === DASHBOARD_LAYOUTS.ORDER_FIRST;
  const unified = cardMode === DASHBOARD_CARD_MODES.SINGLE;

  return (
    <div className='w-full landscape:max-lg:flex landscape:max-lg:h-full landscape:max-lg:flex-col lg:flex lg:h-full lg:flex-col'>
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-3 lg:flex-1 lg:min-h-0 lg:items-stretch landscape:max-lg:min-h-0 landscape:max-lg:flex-1 landscape:max-lg:grid-cols-10'>
        {isOrderFirst ? (
          <>
            <div className='flex min-h-0 min-w-0 flex-col gap-2 lg:col-span-1 landscape:max-lg:col-span-5 landscape:max-lg:min-h-0'>
              <DashboardSidebar unified={unified} />
            </div>
            <Card lg={2} className='landscape:max-lg:min-h-0 landscape:max-lg:col-span-5' fullHeight={true}>
              <OverviewChart />
            </Card>
          </>
        ) : (
          <>
            <Card lg={2} className='landscape:max-lg:min-h-0 landscape:max-lg:col-span-5' fullHeight={true}>
              <OverviewChart />
            </Card>
            <div className='flex min-h-0 min-w-0 flex-col gap-2 lg:col-span-1 landscape:max-lg:col-span-5 landscape:max-lg:min-h-0'>
              <DashboardSidebar unified={unified} />
            </div>
          </>
        )}
      </div>

      {showRecentShotsSignal.value && (
        <div className='hidden [@media(min-height:700px)]:block mt-4'>
          <RecentShotsCard />
        </div>
      )}
    </div>
  );
}
