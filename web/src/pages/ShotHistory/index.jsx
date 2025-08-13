import {
  Chart,
  LineController,
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  Legend,
  Filler,
  CategoryScale,
} from 'chart.js';
import 'chartjs-adapter-dayjs-4/dist/chartjs-adapter-dayjs-4.esm';
Chart.register(LineController);
Chart.register(TimeScale);
Chart.register(LinearScale);
Chart.register(CategoryScale);
Chart.register(PointElement);
Chart.register(LineElement);
Chart.register(Filler);
Chart.register(Legend);

import { ApiServiceContext, machine } from '../../services/ApiService.js';
import { useCallback, useEffect, useState, useContext } from 'preact/hooks';
import { computed } from '@preact/signals';
import { Spinner } from '../../components/Spinner.jsx';
import { parseHistoryData } from './utils.js';
import HistoryCard from './HistoryCard.jsx';

const connected = computed(() => machine.value.connected);

export function ShotHistory() {
  const apiService = useContext(ApiServiceContext);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const loadHistory = async () => {
    const response = await apiService.request({ tp: 'req:history:list' });
    const history = response.history.map(parseHistoryData).reverse();
    setHistory(history);
    setLoading(false);
  };
  useEffect(() => {
    if (connected.value) {
      loadHistory();
    }
  }, [connected.value]);

  const onDelete = useCallback(
    async id => {
      setLoading(true);
      await apiService.request({ tp: 'req:history:delete', id });
      await loadHistory();
    },
    [apiService, setLoading],
  );

  if (loading) {
    return (
      <div className='flex w-full flex-row items-center justify-center py-16'>
        <Spinner size={8} />
      </div>
    );
  }

  return (
    <>
      <div className='mb-4 flex flex-row items-center gap-2'>
        <h2 className='flex-grow text-2xl font-bold sm:text-3xl'>Shot History</h2>
      </div>

      <div className='grid grid-cols-1 gap-4 lg:grid-cols-12'>
        {history.map((item, idx) => (
          <HistoryCard shot={item} key={idx} onDelete={id => onDelete(id)} />
        ))}
        {history.length === 0 && (
          <div className='flex flex-row items-center justify-center py-20 lg:col-span-12'>
            <span>No shots available</span>
          </div>
        )}
      </div>
    </>
  );
}
