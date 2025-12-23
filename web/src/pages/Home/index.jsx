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
import {
  getDashboardLayout,
  DASHBOARD_LAYOUTS,
  setDashboardUpDownLayout,
  getDashboardUpDownLayout,
} from '../../utils/dashboardManager.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowsLeftRight } from '@fortawesome/free-solid-svg-icons/faArrowsLeftRight';
import { faArrowsUpDown } from '@fortawesome/free-solid-svg-icons/faArrowsUpDown';

Chart.register(LineController, TimeScale, LinearScale, PointElement, LineElement, Filler, Legend);

export function Home() {
  const [dashboardLayout, setDashboardLayout] = useState(DASHBOARD_LAYOUTS.ORDER_FIRST);
  const apiService = useContext(ApiServiceContext);
  const [upDownLayout, setUpDownLayout] = useState(getDashboardUpDownLayout());
  const gridUpDownClass = upDownLayout ? 'grid-cols-1' : 'grid-cols-10';

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
      <div className='relative'>
        <div className='mb-4 flex flex-row items-center gap-2 landscape:hidden landscape:lg:block'>
          <h1 className='flex-grow text-2xl font-bold sm:text-3xl'>Dashboard</h1>
        </div>

        <div className='absolute top-3 right-0 z-50 sm:top-[-1rem] md:top-9'>
          <button
          aria-label={upDownLayout ? 'Switch to horizontal layout' : 'Switch to vertical layout'}
          className='btn-lg btn-circle bg-base-content/10 text-base-content/60 sm:border-base-content/20 hover:text-base-content sm:hover:bg-base-content/10 hover:border-base-content/40 text-md cursor-pointer transition-all duration-200'
            onClick={() => {
              const newLayout = !upDownLayout;
              setUpDownLayout(newLayout);
              setDashboardUpDownLayout(newLayout);
            }}
          >
            <FontAwesomeIcon
              icon={upDownLayout ? faArrowsLeftRight : faArrowsUpDown}
              className='h-3 w-3'
            />
          </button>
        </div>

        <div className={`grid ${gridUpDownClass} gap-4`}>
          <Card
            className={`${upDownLayout ? '' : 'col-span-4'} ${dashboardLayout === DASHBOARD_LAYOUTS.ORDER_FIRST ? 'order-first' : 'order-last'}`}
            title='Process Controls'
          >
            <ProcessControls brew={mode === 1} mode={mode} changeMode={changeMode} />
          </Card>

          <Card
            className={`${upDownLayout ? '' : 'col-span-6'} ${dashboardLayout === DASHBOARD_LAYOUTS.ORDER_FIRST ? 'order-last' : 'order-first'}`}
            title='Temperature & Pressure Chart'
            fullHeight={true}
          >
            <OverviewChart />
          </Card>
        </div>
      </div>
    </>
  );
}
