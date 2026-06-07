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
const DEFAULT_SOURCE = 'gaggimate';
const PAGE_BUTTON_LIMIT = 5;

function getShotStorageId(shot) {
  return String(shot?.storageKey || shot?.name || shot?.id || '');
}

function getShotScopedKey(shot, storageId = getShotStorageId(shot)) {
  return `${shot?.source || DEFAULT_SOURCE}:${storageId}`;
}

function normalizeHistoryShot(shot) {
  const id = String(shot?.id || shot?.storageKey || shot?.name || '');
  const hasSamples = Array.isArray(shot?.samples) && shot.samples.length > 0;
  const normalized = {
    ...shot,
    id,
    source: shot?.source || DEFAULT_SOURCE,
    timestamp: shot?.timestamp || 0,
    duration: shot?.duration || 0,
    volume: shot?.volume ?? null,
    rating: shot?.rating ?? 0,
    loaded: hasSamples,
  };

  if (hasSamples) {
    normalized.samples = shot.samples;
  } else {
    delete normalized.samples;
  }

  return normalized;
}

function mergeExistingLoadedShot(existing, normalized) {
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

function mergeShotListWithExisting(prev, shotList) {
  const existingMap = new Map(prev.map(shot => [getShotScopedKey(shot), shot]));

  return shotList.map(newShot => {
    const normalized = normalizeHistoryShot(newShot);
    const existing = existingMap.get(getShotScopedKey(normalized));

    if (existing?.loaded) {
      return mergeExistingLoadedShot(existing, normalized);
    }

    return normalized;
  });
}

function mergeLoadedShot(previousShot, parsedShot) {
  return normalizeHistoryShot({
    ...previousShot,
    ...parsedShot,
    id: previousShot.id,
    storageKey: previousShot.storageKey,
    source: previousShot.source || parsedShot.source,
    volume: previousShot.volume ?? parsedShot.volume,
    rating: previousShot.rating ?? parsedShot.rating,
    incomplete: previousShot.incomplete ?? parsedShot.incomplete,
    notes: previousShot.notes ?? parsedShot.notes,
    loaded: true,
  });
}

function updateLoadedShotInHistory(prev, item, storageId, parsedShot) {
  const targetKey = getShotScopedKey(item, storageId);

  return prev.map(historyShot => {
    if (getShotScopedKey(historyShot) !== targetKey) return historyShot;
    return mergeLoadedShot(historyShot, parsedShot);
  });
}

function compareHistoryShotByDate(a, b) {
  if (a.timestamp >= 10000 && b.timestamp >= 10000) {
    return a.timestamp - b.timestamp;
  }

  if (a.timestamp >= 10000) {
    return 1;
  }

  if (b.timestamp >= 10000) {
    return -1;
  }

  return parseInt(a.id) - parseInt(b.id);
}

function compareHistoryShots(a, b, sortBy) {
  switch (sortBy) {
    case 'rating':
      return (a.rating || 0) - (b.rating || 0);
    case 'profile':
      return (a.profile || '').localeCompare(b.profile || '');
    case 'duration':
      return a.duration - b.duration;
    case 'volume':
      return (a.volume || 0) - (b.volume || 0);
    case 'id':
      return parseInt(a.id) - parseInt(b.id);
    case 'date':
    default:
      return compareHistoryShotByDate(a, b);
  }
}

function getPageNumbers(currentPage, totalPages) {
  const visiblePageCount = Math.min(PAGE_BUTTON_LIMIT, totalPages);

  if (totalPages <= PAGE_BUTTON_LIMIT || currentPage <= 3) {
    return Array.from({ length: visiblePageCount }, (_, index) => index + 1);
  }

  if (currentPage >= totalPages - 2) {
    return Array.from({ length: visiblePageCount }, (_, index) => totalPages - PAGE_BUTTON_LIMIT + 1 + index);
  }

  return Array.from({ length: visiblePageCount }, (_, index) => currentPage - 2 + index);
}

function getEmptyHistoryTitle(isConnected) {
  return isConnected ? 'No shots found' : 'No cached shots available';
}

function getEmptyHistoryDescription(isConnected) {
  if (isConnected) {
    return 'Shot history will appear here after GaggiMate has recorded shots and the local mirror has hydrated.';
  }

  return 'Connect to GaggiMate once to hydrate the local mirror. After that, shot history remains available offline.';
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
      if (connected.value) {
        await libraryService.hydrateGaggiMateShotIndex();
      }
      const shotList = await libraryService.getAllShots('both');
      if (loadHistoryRequestRef.current !== requestId) return;

      setHistory(prev => mergeShotListWithExisting(prev, shotList));
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
      if (connected.value) {
        await libraryService.hydrateGaggiMateShotIndex();
      }
      await libraryService.deleteShot(getShotStorageId(shot), shot.source || DEFAULT_SOURCE);
      await loadHistory();
    },
    [apiService, loadHistory],
  );

  const onNotesChanged = useCallback(async () => {
    await loadHistory();
  }, [loadHistory]);

  const onLoadShot = useCallback(async item => {
    if (item.loaded) return;

    try {
      const storageId = getShotStorageId(item);
      const parsed = await libraryService.loadShot(storageId, item.source || DEFAULT_SOURCE);
      setHistory(prev => updateLoadedShotInHistory(prev, item, storageId, parsed));
    } catch (error) {
      console.error('Failed loading shot', error);
    }
  }, []);

  // Filtered and sorted history with pagination
  const { paginatedHistory, totalPages, totalFilteredItems } = useMemo(() => {
    let filtered = [...history];

    // Apply search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(
        shot => shot.profile?.toLowerCase().includes(search) || shot.id.toString().includes(search),
      );
    }

    // Apply status filter
    switch (filterBy) {
      case 'rated':
        filtered = filtered.filter(shot => shot.rating && shot.rating > 0);
        break;
      case 'unrated':
        filtered = filtered.filter(shot => !shot.rating || shot.rating === 0);
        break;
      default: // 'all'
        break;
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const comparison = compareHistoryShots(a, b, sortBy);
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    const totalFilteredItems = filtered.length;
    const totalPages = Math.ceil(totalFilteredItems / itemsPerPage);

    // Apply pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedHistory = filtered.slice(startIndex, endIndex);

    return { paginatedHistory, totalPages, totalFilteredItems };
  }, [history, searchTerm, filterBy, sortBy, sortOrder, currentPage]);

  const pageNumbers = getPageNumbers(currentPage, totalPages);

  if (loading) {
    return (
      <div className='flex w-full flex-row items-center justify-center py-16'>
        <Spinner size={8} />
      </div>
    );
  }

  return (
    <>
      <div className='mb-6'>
        <div className='mb-4 flex flex-row items-center gap-2'>
          <h2 className='flex-grow text-2xl font-bold sm:text-3xl'>Shot History</h2>
          <span className='text-base-content/70 text-sm'>
            {totalFilteredItems} of {history.length} shots{' '}
            {totalPages > 1 && `(Page ${currentPage} of ${totalPages})`}
          </span>
        </div>

        {/* Controls Row */}
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
          {/* Search */}
          <div className='relative max-w-md flex-grow'>
            <FontAwesomeIcon
              icon={faSearch}
              className='text-base-content/50 absolute top-1/2 left-3 -translate-y-1/2 transform text-sm'
            />
            <input
              type='text'
              placeholder='Search...'
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1); // Reset to page 1 when searching
              }}
              className='input input-bordered w-full pr-4 pl-10 text-sm'
            />
          </div>

          {/* Sort */}
          <div className='flex items-center gap-2'>
            <FontAwesomeIcon icon={faSort} className='text-base-content/50' />
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={e => {
                const [newSortBy, newSortOrder] = e.target.value.split('-');
                setSortBy(newSortBy);
                setSortOrder(newSortOrder);
                setCurrentPage(1); // Reset to page 1 when sorting
              }}
              className='select select-bordered text-sm'
            >
              <option value='date-desc'>Newest First</option>
              <option value='date-asc'>Oldest First</option>
              <option value='rating-desc'>Highest Rated</option>
              <option value='rating-asc'>Lowest Rated</option>
              <option value='profile-asc'>Profile A-Z</option>
              <option value='profile-desc'>Profile Z-A</option>
              <option value='duration-desc'>Longest Duration</option>
              <option value='duration-asc'>Shortest Duration</option>
              <option value='volume-desc'>Highest Volume</option>
              <option value='volume-asc'>Lowest Volume</option>
              <option value='id-desc'>Highest ID First</option>
              <option value='id-asc'>Lowest ID first</option>
            </select>
          </div>

          {/* Filter */}
          <div className='flex items-center gap-2'>
            <FontAwesomeIcon icon={faFilter} className='text-base-content/50' />
            <select
              value={filterBy}
              onChange={e => {
                setFilterBy(e.target.value);
                setCurrentPage(1); // Reset to page 1 when filtering
              }}
              className='select select-bordered text-sm'
            >
              <option value='all'>All Shots</option>
              <option value='rated'>Rated Only</option>
              <option value='unrated'>Unrated Only</option>
            </select>
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 gap-3 lg:grid-cols-12'>
        {paginatedHistory.map(item => (
          <HistoryCard
            key={`${item.source || DEFAULT_SOURCE}-${getShotStorageId(item)}`}
            shot={item}
            onDelete={() => onDelete(item)}
            onNotesChanged={onNotesChanged}
            onLoad={() => onLoadShot(item)}
          />
        ))}
        {totalFilteredItems === 0 && !loading && (
          <div className='flex flex-row items-center justify-center py-20 lg:col-span-12'>
            {history.length === 0 ? (
              <div className='text-center'>
                <h2 className='text-lg font-semibold'>{getEmptyHistoryTitle(connected.value)}</h2>
                <p className='text-base-content/70 mt-2 max-w-xl text-sm'>
                  {getEmptyHistoryDescription(connected.value)}
                </p>
              </div>
            ) : (
              <span>No shots match your search and filter criteria</span>
            )}
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className='mt-6 flex items-center justify-center gap-2'>
          <button
            className='btn btn-sm btn-outline'
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            Previous
          </button>

          <div className='flex items-center gap-1'>
            {pageNumbers.map(pageNum => (
              <button
                key={pageNum}
                className={`btn btn-sm ${currentPage === pageNum ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setCurrentPage(pageNum)}
              >
                {pageNum}
              </button>
            ))}
          </div>

          <button
            className='btn btn-sm btn-outline'
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}
