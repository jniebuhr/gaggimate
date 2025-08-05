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
const hwScale = computed(() => machine.value.capabilities.hardwareScale);

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
  const tareScale = useCallback(() => {
    apiService.send({
      tp: 'req:scale:tare',
    });
  }, [apiService]);

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
      <Card xs={12}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
          <div className="col-span-12">
            <div className="flex flex-row gap-4 items-center justify-center">
              <div className="inline-flex rounded-md">
                <span className={`mode-selector mode-selector-xl ${mode === 0 && 'selected'}`} onClick={() => changeMode(0)}>
                  Standby
                </span>
                <span className={`mode-selector mode-selector-xl ${mode === 1 && 'selected'}`} onClick={() => changeMode(1)}>
                  Brew
                </span>
                <span className={`mode-selector mode-selector-xl ${mode === 2 && 'selected'}`} onClick={() => changeMode(2)}>
                  Steam
                </span>
                <span className={`mode-selector mode-selector-xl ${mode === 3 && 'selected'}`} onClick={() => changeMode(3)}>
                  Water
                </span>
              </div>
            </div>
          </div>
          <div className="col-span-12 sm:col-span-6 md:col-span-12 grid grid-cols-1 gap-2 sm:grid-cols-12">
            <div className="p-6 sm:col-span-12 md:col-span-4">
              <dl>
                <dt className="text-xl md:text-2xl font-bold">
                  {status.value.currentTemperature || 0} / {status.value.targetTemperature || 0} °C
                </dt>
                <dd className="text-sm font-medium text-slate-500">Temperature</dd>
              </dl>
            </div>
            <div className="p-6 sm:col-span-12 md:col-span-4">
              <dl>
                <dt className="text-xl md:text-2xl font-bold">
                  {status.value.currentPressure?.toFixed(1) || 0} / {status.value.targetPressure?.toFixed(1) || 0} bar
                </dt>
                <dd className="text-sm font-medium text-slate-500">Pressure</dd>
              </dl>
            </div>
            {hwScale.value && (
              <div className="p-6 sm:col-span-12 md:col-span-4">
                <dl>
                  <dt className="text-xl md:text-2xl font-bold">
                    {status.value.currentWeight?.toFixed(1) || 0}g <a class="btn" href="" onClick={() => tareScale()}><i className="fa-solid fa-scale-unbalanced ml-2"></i></a>
                  </dt>
                  <dd className="text-sm font-medium text-slate-500">Weight</dd>
                </dl>
              </div>
            )}
            <div className="p-6 sm:col-span-12 md:col-span-4">
              <dl>
                <dt className="text-xl md:text-2xl font-bold">
                  <a href="/profiles">
                    {status.value.selectedProfile || '-'} <i className="fa-solid fa-rectangle-list ml-2"></i>
                  </a>
                </dt>
                <dd className="text-sm font-medium text-slate-500">Current Profile</dd>
              </dl>
            </div>
          </div>
          <div className="col-span-12 sm:col-span-6 md:col-span-12 p-2 flex flex-col gap-2 items-center justify-center">
            {(mode === 1 || mode === 3) && <ProcessControls brew={mode === 1} />}
          </div>
        </div>
      </Card>
    </div>
  );
}
