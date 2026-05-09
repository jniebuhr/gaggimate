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
import DashboardMerged from './DashboardMerged.jsx';
Chart.register(LineController, TimeScale, LinearScale, PointElement, LineElement, Filler, Legend);

export function Home({ navOpen, onNavToggle }) {
  return <DashboardMerged navOpen={navOpen} onNavToggle={onNavToggle} />;
}
