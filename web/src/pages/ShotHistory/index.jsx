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
import { useCallback, useEffect, useState, useContext, useMemo } from 'preact/hooks';
import { computed } from '@preact/signals';
import { Spinner } from '../../components/Spinner.jsx';
import HistoryCard from './HistoryCard.jsx';
import { parseBinaryShot } from './parseBinaryShot.js';
import { parseBinaryIndex, indexToShotList } from './parseBinaryIndex.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch } from '@fortawesome/free-solid-svg-icons/faSearch';
import { faSort } from '@fortawesome/free-solid-svg-icons/faSort';
import { faFilter } from '@fortawesome/free-solid-svg-icons/faFilter';

const connected = computed(() => machine.value.connected);

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

  // Filtered and sorted history with pagination
  const { paginatedHistory, totalPages, totalFilteredItems } = useMemo(() => {
    let filtered = history;

    // Apply search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(shot => 
        shot.profile?.toLowerCase().includes(search) ||
        shot.id.toString().includes(search)
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
        case 'date':
          comparison = a.timestamp - b.timestamp;
          break;
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
        default:
          comparison = a.timestamp - b.timestamp;
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
          <span className='text-sm text-base-content/70'>
            {totalFilteredItems} of {history.length} shots {totalPages > 1 && `(Page ${currentPage} of ${totalPages})`}
          </span>
        </div>

        {/* Controls Row */}
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
          {/* Search */}
          <div className='relative flex-grow max-w-md'>
            <FontAwesomeIcon 
              icon={faSearch} 
              className='absolute left-3 top-1/2 transform -translate-y-1/2 text-base-content/50 text-sm'
            />
            <input
              type='text'
              placeholder='Search...'
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1); // Reset to page 1 when searching
              }}
              className='input input-bordered w-full pl-10 pr-4 text-sm'
            />
          </div>

          {/* Sort */}
          <div className='flex items-center gap-2'>
            <FontAwesomeIcon icon={faSort} className='text-base-content/50' />
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
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
            </select>
          </div>

          {/* Filter */}
          <div className='flex items-center gap-2'>
            <FontAwesomeIcon icon={faFilter} className='text-base-content/50' />
            <select
              value={filterBy}
              onChange={(e) => {
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
        {paginatedHistory.map((item, idx) => (
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
        <div className='mt-6 flex justify-center items-center gap-2'>
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
