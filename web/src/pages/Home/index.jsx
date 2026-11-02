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
import { BrewConfirmHost } from './BrewConfirmHost.jsx';
import {
  DASHBOARD_LAYOUTS,
  DASHBOARD_CARD_MODES,
  dashboardLayoutSignal,
  dashboardCardModeSignal,
  showRecentShotsSignal,
} from '../../utils/dashboardManager.js';

Chart.register(LineController, TimeScale, LinearScale, PointElement, LineElement, Filler, Legend);

export function Home() {
  const isOrderFirst = dashboardLayoutSignal.value === DASHBOARD_LAYOUTS.ORDER_FIRST;
  const unified = dashboardCardModeSignal.value === DASHBOARD_CARD_MODES.SINGLE;

  return (
    <div className='w-full lg:flex lg:h-full lg:flex-col landscape:max-lg:flex landscape:max-lg:h-full landscape:max-lg:flex-col'>
      <BrewConfirmHost />
      <div className='grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-3 lg:items-stretch landscape:max-lg:min-h-0 landscape:max-lg:flex-1 landscape:max-lg:grid-cols-10'>
        {isOrderFirst ? (
          <>
            <div className='flex min-h-0 min-w-0 flex-col gap-2 lg:col-span-1 landscape:max-lg:col-span-5 landscape:max-lg:min-h-0'>
              <DashboardSidebar unified={unified} />
            </div>
            <Card
              lg={2}
              className='landscape:max-lg:col-span-5 landscape:max-lg:min-h-0'
              fullHeight={true}
            >
              <OverviewChart />
            </Card>
          </>
        ) : (
          <>
            <Card
              lg={2}
              className='landscape:max-lg:col-span-5 landscape:max-lg:min-h-0'
              fullHeight={true}
            >
              <OverviewChart />
            </Card>
            <div className='flex min-h-0 min-w-0 flex-col gap-2 lg:col-span-1 landscape:max-lg:col-span-5 landscape:max-lg:min-h-0'>
              <DashboardSidebar unified={unified} />
            </div>
          </>
        )}
      </div>

      {showRecentShotsSignal.value && (
        <div className='mt-4 hidden [@media(min-height:700px)]:block'>
          <RecentShotsCard />
        </div>
      )}
    </div>
  );
}
