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
import { refreshCoordinator } from '../../services/RefreshCoordinator.js';
import { useCallback, useEffect, useRef, useState, useContext, useMemo } from 'preact/hooks';
import { computed } from '@preact/signals';
import { Spinner } from '../../components/Spinner.jsx';
import HistoryCard from './HistoryCard.jsx';
import { libraryService } from '../ShotAnalyzer/services/LibraryService.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch } from '@fortawesome/free-solid-svg-icons/faSearch';
import { faSort } from '@fortawesome/free-solid-svg-icons/faSort';
import { faFilter } from '@fortawesome/free-solid-svg-icons/faFilter';

const connected = computed(() => machine.value.connected);

function getShotStorageId(shot) {
  return String(shot?.storageKey || shot?.name || shot?.id || '');
}

function normalizeHistoryShot(shot) {
  const id = String(shot?.id || shot?.storageKey || shot?.name || '');

  return {
    ...shot,
    id,
    source: shot?.source || 'gaggimate',
    timestamp: shot?.timestamp || 0,
    duration: shot?.duration || 0,
    volume: shot?.volume ?? null,
    rating: shot?.rating ?? 0,
    loaded: Boolean(shot?.loaded || (Array.isArray(shot?.samples) && shot.samples.length > 0)),
    samples: Array.isArray(shot?.samples) ? shot.samples : [],
  };
}

export function ShotHistory() {
  const apiService = useContext(ApiServiceContext);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date'); // date, rating, profile, duration, volume
  const [sortOrder, setSortOrder] = useState('desc'); // asc, desc
  const [filterBy, setFilterBy] = useState('all'); // all, rated, unrated
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const loadHistoryRequestRef = useRef(0);

  const loadHistory = useCallback(async () => {
    const requestId = loadHistoryRequestRef.current + 1;
    loadHistoryRequestRef.current = requestId;

    try {
      libraryService.setApiService(apiService);
      const shotList = await libraryService.getAllShots('both');
      if (loadHistoryRequestRef.current !== requestId) return;

      setHistory(prev => {
        const existingMap = new Map(
          prev.map(shot => [`${shot.source || 'gaggimate'}:${getShotStorageId(shot)}`, shot]),
        );

        return shotList.map(newShot => {
          const normalized = normalizeHistoryShot(newShot);
          const existing = existingMap.get(`${normalized.source}:${getShotStorageId(normalized)}`);

          if (existing && existing.loaded) {
            return {
              ...existing,
              ...normalized,
              samples: existing.samples,
              loaded: true,
              volume: normalized.volume ?? existing.volume,
              rating: normalized.rating ?? existing.rating,
              incomplete: normalized.incomplete ?? existing.incomplete,
              notes: normalized.notes ?? existing.notes,
            };
          }

          return normalized;
        });
      });
      setLoading(false);
    } catch (error) {
      if (loadHistoryRequestRef.current !== requestId) return;
      console.error('Failed to load shot history:', error);
      setHistory([]);
      setLoading(false);
    }
  }, [apiService]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory, connected.value]);

  useEffect(() => {
    const unsubscribe = refreshCoordinator.subscribe(event => {
      if (event.domain === 'shots' && !event.error) {
        loadHistory();
      }
    });

    return unsubscribe;
  }, [loadHistory]);

  const onDelete = useCallback(
    async shot => {
      setLoading(true);
      libraryService.setApiService(apiService);
      await libraryService.deleteShot(getShotStorageId(shot), shot.source || 'gaggimate');
      await loadHistory();
    },
