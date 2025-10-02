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
import HistoryCard from './HistoryCard.jsx';
import { parseBinaryShot } from './parseBinaryShot.js';
import { parseBinaryIndex, indexToShotList } from './parseBinaryIndex.js';

const connected = computed(() => machine.value.connected);

export function ShotHistory() {
  const apiService = useContext(ApiServiceContext);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const loadHistory = async () => {
    try {
      // Fetch binary index instead of websocket request
      const response = await fetch('/api/history/index.bin');
      if (!response.ok) {
        if (response.status === 404) {
          // Index doesn't exist, show empty list with option to rebuild
          console.log('Shot index not found. You may need to rebuild it if shots exist.');
          setHistory([]);
          setLoading(false);
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const indexData = parseBinaryIndex(arrayBuffer);
      const shotList = indexToShotList(indexData);
      
      // Preserve loaded state and data from existing shots
      setHistory(prev => {
        const existingMap = new Map(prev.map(shot => [shot.id, shot]));
        return shotList.map(newShot => {
          const existing = existingMap.get(newShot.id);
          if (existing && existing.loaded) {
            // Preserve loaded data but update metadata from index
            return {
              ...existing,
              // Update metadata that might have changed (like rating and volume)
              rating: newShot.rating,
              volume: newShot.volume,
              incomplete: newShot.incomplete,
            };
          }
          return newShot;
        });
      });
      setLoading(false);
    } catch (error) {
      console.error('Failed to load shot history:', error);
      setHistory([]);
      setLoading(false);
    }
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
      // Reload the index after deletion
      await loadHistory();
    },
    [apiService],
  );

  const onNotesChanged = useCallback(async () => {
    // Reload the index to get updated ratings
    await loadHistory();
  }, []);

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
          <HistoryCard
            key={item.id}
            shot={item}
            onDelete={id => onDelete(id)}
            onNotesChanged={onNotesChanged}
            onLoad={async id => {
              // Fetch binary only if not loaded
              const target = history.find(h => h.id === id);
              if (!target || target.loaded) return;
              try {
                // Pad ID to 6 digits with zeros to match backend filename format
                const paddedId = id.padStart(6, '0');
                const resp = await fetch(`/api/history/${paddedId}.slog`);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const buf = await resp.arrayBuffer();
                const parsed = parseBinaryShot(buf, id);
                parsed.incomplete = (target?.incomplete ?? false) || parsed.incomplete;
                if (target?.notes) parsed.notes = target.notes;
                setHistory(prev =>
                  prev.map(h =>
                    h.id === id
                      ? {
                          ...h,
                          ...parsed,
                          // Preserve index metadata over shot file data
                          volume: h.volume ?? parsed.volume, // Use index volume if available, fallback to shot volume
                          rating: h.rating ?? parsed.rating, // Use index rating if available
                          incomplete: h.incomplete ?? parsed.incomplete,
                          loaded: true,
                        }
                      : h,
                  ),
                );
              } catch (e) {
                console.error('Failed loading shot', e);
              }
            }}
          />
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
