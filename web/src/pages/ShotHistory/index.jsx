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
  const hasSamples = Array.isArray(shot?.samples) && shot.samples.length > 0;
  const normalized = {
    ...shot,
    id,
    source: shot?.source || 'gaggimate',
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
    [apiService, loadHistory],
  );

  const onNotesChanged = useCallback(async () => {
    await loadHistory();
  }, [loadHistory]);

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
      let comparison = 0;

      switch (sortBy) {
        case 'rating':
          comparison = (a.rating || 0) - (b.rating || 0);
          break;
        case 'profile':
          comparison = (a.profile || '').localeCompare(b.profile || '');
          break;
        case 'duration':
          comparison = a.duration - b.duration;
          break;
        case 'volume':
          comparison = (a.volume || 0) - (b.volume || 0);
          break;
        case 'id':
          comparison = parseInt(a.id) - parseInt(b.id);
          break;
        case 'date':
        default:
          if (a.timestamp >= 10000 && b.timestamp >= 10000) {
            comparison = a.timestamp - b.timestamp;
          } else if (a.timestamp >= 10000) {
            comparison = 1;
          } else if (b.timestamp >= 10000) {
            comparison = -1;
          } else {
            comparison = parseInt(a.id) - parseInt(b.id);
          }
      }

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
            key={`${item.source || 'gaggimate'}-${getShotStorageId(item)}`}
            shot={item}
            onDelete={() => onDelete(item)}
            onNotesChanged={onNotesChanged}
            onLoad={async () => {
              if (item.loaded) return;

              try {
                const storageId = getShotStorageId(item);
                const parsed = await libraryService.loadShot(storageId, item.source || 'gaggimate');

                setHistory(prev =>
                  prev.map(h => {
                    const sameShot =
                      `${h.source || 'gaggimate'}:${getShotStorageId(h)}` ===
                      `${item.source || 'gaggimate'}:${storageId}`;

                    if (!sameShot) return h;

                    return normalizeHistoryShot({
                      ...h,
                      ...parsed,
                      id: h.id,
                      storageKey: h.storageKey,
                      source: h.source || parsed.source,
                      volume: h.volume ?? parsed.volume,
                      rating: h.rating ?? parsed.rating,
                      incomplete: h.incomplete ?? parsed.incomplete,
                      notes: h.notes ?? parsed.notes,
                      loaded: true,
                    });
                  }),
                );
              } catch (e) {
                console.error('Failed loading shot', e);
              }
            }}
          />
        ))}
        {totalFilteredItems === 0 && !loading && (
          <div className='flex flex-row items-center justify-center py-20 lg:col-span-12'>
            {history.length === 0 ? (
              <span>No shots available</span>
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
            {/* Show page numbers */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }

              return (
                <button
                  key={pageNum}
                  className={`btn btn-sm ${currentPage === pageNum ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}
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
