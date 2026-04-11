import { useCallback, useContext, useState, useEffect } from 'preact/hooks';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlugCircleBolt } from '@fortawesome/free-solid-svg-icons/faPlugCircleBolt';
import { faSliders } from '@fortawesome/free-solid-svg-icons/faSliders';
import { faBookmark } from '@fortawesome/free-solid-svg-icons/faBookmark';
import { faTemperatureHigh } from '@fortawesome/free-solid-svg-icons/faTemperatureHigh';
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

const MODE_LABELS = ['Standby', 'Brew', 'Steam', 'Water', 'Grind'];

function formatReading(value, suffix) {
  return `${Number.isFinite(value) ? value.toFixed(1) : '0.0'}${suffix}`;
}

function StatPill({ label, value, tone = 'neutral', icon }) {
  const toneClasses = {
    neutral: 'border-base-300/60 bg-base-100/90 text-base-content',
    accent: 'border-primary/25 bg-primary/12 text-primary',
    success: 'border-success/25 bg-success/12 text-success',
    secondary: 'border-secondary/25 bg-secondary/12 text-secondary',
    error: 'border-error/25 bg-error/12 text-error',
    warning: 'border-warning/25 bg-warning/12 text-warning-content',
  };

  return (
    <div
      className={`status-indicator-card w-full min-w-0 rounded-2xl border px-4 py-3 shadow-[0_10px_25px_-18px_rgba(0,0,0,0.9)] backdrop-blur ${toneClasses[tone]}`}
    >
      <div className='flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.22em] opacity-70'>
        <span className='inline-flex size-7 items-center justify-center rounded-xl border border-current/15 bg-current/10'>
          <FontAwesomeIcon icon={icon} className='text-xs' />
        </span>
        <span>{label}</span>
      </div>
      <div className='mt-1 break-words text-lg font-semibold leading-tight sm:text-[1.35rem]'>{value}</div>
    </div>
  );
}

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
  const connected = machine.value.connected;
  const currentMode = MODE_LABELS[mode] || 'Unknown';
  const profileLabel = machine.value.status.selectedProfile || 'Default';
  const temp = formatReading(machine.value.status.currentTemperature, '\u00B0C');
  const pressure = formatReading(machine.value.status.currentPressure, ' bar');

  return (
    <>
      <div className='mb-6 rounded-[1.5rem] border border-base-300/65 bg-base-100/85 p-5 shadow-[0_24px_60px_-42px_rgba(0,0,0,0.85)] backdrop-blur-xl lg:p-7'>
        <div className='flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'>
          <div className='max-w-2xl space-y-2'>
            <div className='inline-flex rounded-full border border-base-300/80 bg-base-100 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-base-content/65'>
              Live dashboard
            </div>
            <h1 className='text-3xl font-bold tracking-tight sm:text-[2.4rem]'>Dashboard</h1>
            <p className='max-w-xl text-sm leading-relaxed text-base-content/70 sm:text-base'>
              Keep an eye on the machine state, switch modes, and jump into charts without losing
              context.
            </p>
          </div>
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 xl:min-w-[46rem] xl:grid-cols-4'>
            <StatPill
              label='Connection'
              value={connected ? 'Online' : 'Offline'}
              tone={connected ? 'success' : 'warning'}
              icon={faPlugCircleBolt}
            />
            <StatPill label='Mode' value={currentMode} tone='accent' icon={faSliders} />
            <StatPill label='Profile' value={profileLabel} tone='secondary' icon={faBookmark} />
            <StatPill
              label='Temp / Pressure'
              value={`${temp} \u00B7 ${pressure}`}
              tone='error'
              icon={faTemperatureHigh}
            />
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 gap-5 lg:grid-cols-10 lg:items-stretch landscape:sm:grid-cols-10'>
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
