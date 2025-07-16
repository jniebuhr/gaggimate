import './style.css';
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

import { useContext } from 'react';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
import { useCallback, useEffect, useState } from 'preact/hooks';
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
    const history = response.history.map(parseHistoryData);
    setHistory(history);
    console.log(history);
    setLoading(false);
  };
  useEffect(async () => {
    if (connected.value) {
      await loadHistory();
    }
  }, [connected.value]);

  const onDelete = useCallback(
    async (id) => {
      setLoading(true);
      await apiService.request({ tp: 'req:history:delete', id });
      await loadHistory();
    },
    [apiService, setLoading]
  );

  if (loading) {
    return (
      <div class="flex flex-row py-16 items-center justify-center w-full">
        <Spinner size={8} />
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-12 md:gap-2">
        <div className="sm:col-span-12 flex flex-row">
          <h2 className="text-2xl font-bold flex-grow">Shot History</h2>
        </div>
        {history.map((item, idx) => (
          <HistoryCard shot={item} key={idx} onDelete={(id) => onDelete(id)} />
        ))}
        {history.length === 0 && (
          <div className="sm:col-span-12 flex flex-row items-center justify-center py-20">
            <span>No shots available</span>
          </div>
        )}
      </div>
    </>
  );
}
