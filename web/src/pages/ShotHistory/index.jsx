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
import { useCallback, useEffect, useRef, useState, useContext, useMemo } from 'preact/hooks';
import { computed } from '@preact/signals';
import { Spinner } from '../../components/Spinner.jsx';
import HistoryCard from './HistoryCard.jsx';
import { parseBinaryShot } from './parseBinaryShot.js';
import { parseBinaryIndex, indexToShotList } from './parseBinaryIndex.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch } from '@fortawesome/free-solid-svg-icons/faSearch';
import { faSort } from '@fortawesome/free-solid-svg-icons/faSort';
import { faFilter } from '@fortawesome/free-solid-svg-icons/faFilter';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons/faTrashCan';
import { faFileExport } from '@fortawesome/free-solid-svg-icons/faFileExport';
import { faFilterCircleXmark } from '@fortawesome/free-solid-svg-icons/faFilterCircleXmark';
import { Tooltip } from '../../components/Tooltip.jsx';
import { downloadJson } from '../../utils/download.js';
import { toExportShot } from './exportShot.js';
import ConfirmDeleteModal from './ConfirmDeleteModal.jsx';

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
  const [deletingAll, setDeletingAll] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });
  const [deletingFiltered, setDeletingFiltered] = useState(false);
  const [deleteFilteredProgress, setDeleteFilteredProgress] = useState({ current: 0, total: 0 });
  const [showDeleteFilteredModal, setShowDeleteFilteredModal] = useState(false);
  const itemsPerPage = 10;
  const loadHistoryAbortRef = useRef(null);
  // Cooperative cancel flag for the sequential bulk loops below (export / delete
  // filtered). The ESP32 can't handle parallel requests, so both run one shot at
  // a time and check this flag between iterations.
  const bulkCancelRef = useRef(false);
  const loadHistory = async () => {
    // Abort any in-flight fetch to prevent request pileup on the ESP32.
    loadHistoryAbortRef.current?.abort();
    const controller = new AbortController();
    loadHistoryAbortRef.current = controller;

    try {
      // Fetch binary index instead of websocket request
      const response = await fetch('/api/history/index.bin', { signal: controller.signal });
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
      if (error.name === 'AbortError') return; // Intentional abort, not an error.
      console.error('Failed to load shot history:', error);
      setHistory([]);
      setLoading(false);
    }
  };
  useEffect(() => {
    if (connected.value) {
      loadHistory();
    }
    return () => loadHistoryAbortRef.current?.abort();
  }, [connected.value]);

  // Filtered and sorted history with pagination. `filteredHistory` is the full
  // sorted match list (all pages) — used by the bulk export / delete-filtered
  // actions so they respect the current search + filters.
  const { paginatedHistory, filteredHistory, totalPages, totalFilteredItems } = useMemo(() => {
    let filtered = history;

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

    const filteredHistory = filtered;
    const totalFilteredItems = filtered.length;
    const totalPages = Math.ceil(totalFilteredItems / itemsPerPage);

    // Apply pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedHistory = filtered.slice(startIndex, endIndex);

    return { paginatedHistory, filteredHistory, totalPages, totalFilteredItems };
  }, [history, searchTerm, filterBy, sortBy, sortOrder, currentPage]);

  const busy = deletingAll || deletingFiltered || exporting;

  const onDelete = useCallback(
    async id => {
      setLoading(true);
      await apiService.request({ tp: 'req:history:delete', id });
      // Reload the index after deletion
      await loadHistory();
    },
    [apiService],
  );

  const onDeleteAll = useCallback(async () => {
    setDeletingAll(true);
    try {
      const resp = await apiService.request({ tp: 'req:history:delete-all' });
      setShowDeleteAllModal(false);
      if (resp?.error) {
        alert(`Could not delete history: ${resp.error}`);
      } else {
        setSearchTerm('');
        setCurrentPage(1);
        // Reload the index after deletion
        await loadHistory();
      }
    } catch (error) {
      setShowDeleteAllModal(false);
      console.error('Failed to delete shot history:', error);
      alert('Could not delete history. Please try again.');
    } finally {
      setDeletingAll(false);
    }
  }, [apiService]);

  const onNotesChanged = useCallback(async () => {
    // Reload the index to get updated ratings
    await loadHistory();
  }, []);

  // Loads one full shot (samples + notes) for export. Reuses already-loaded
  // state to avoid refetching expanded cards. Returns null on failure so a
  // single bad file doesn't abort the whole export.
  const loadFullShotForExport = useCallback(
    async meta => {
      try {
        let full = meta.loaded && meta.samples ? { ...meta } : null;
        if (!full) {
          // Pad ID to 6 digits with zeros to match backend filename format
          const paddedId = meta.id.padStart(6, '0');
          const resp = await fetch(`/api/history/${paddedId}.slog`);
          if (!resp.ok) return null;
          const buf = await resp.arrayBuffer();
          const parsed = parseBinaryShot(buf, meta.id);
          parsed.incomplete = meta.incomplete ?? parsed.incomplete;
          full = {
            ...meta,
            ...parsed,
            // Preserve index metadata over shot file data
            volume: meta.volume ?? parsed.volume,
            rating: meta.rating ?? parsed.rating,
            incomplete: meta.incomplete ?? parsed.incomplete,
          };
        }
        let notes = full.notes ?? null;
        try {
          const notesResp = await apiService.request({ tp: 'req:history:notes:get', id: meta.id });
          if (notesResp?.notes && Object.keys(notesResp.notes).length > 0) {
            notes =
              typeof notesResp.notes === 'string' ? JSON.parse(notesResp.notes) : notesResp.notes;
          }
        } catch {
          // Notes are optional — export the shot without them.
        }
        return toExportShot(full, notes);
      } catch {
        return null;
      }
    },
    [apiService],
  );

  const cancelBulk = useCallback(() => {
    bulkCancelRef.current = true;
  }, []);

  const onExportFiltered = useCallback(async () => {
    const targets = [...filteredHistory];
    if (targets.length === 0 || exporting || deletingAll || deletingFiltered) return;
    bulkCancelRef.current = false;
    setExporting(true);
    setExportProgress({ current: 0, total: targets.length });
    const exported = [];
    let failed = 0;
    // Sequential on purpose: parallel fetches pile up requests on the ESP32
    // (see loadHistory). Progress mirrors the StatisticsView pattern.
    for (let i = 0; i < targets.length; i++) {
      if (bulkCancelRef.current) break;
      const shot = await loadFullShotForExport(targets[i]);
      if (bulkCancelRef.current) break;
      if (shot) exported.push(shot);
      else failed++;
      setExportProgress({ current: i + 1, total: targets.length });
    }
    const cancelled = bulkCancelRef.current;
    setExporting(false);
    setExportProgress({ current: 0, total: 0 });
    if (cancelled) return;
    if (exported.length === 0) {
      alert('Could not export any shots. Please try again.');
      return;
    }
    const day = new Date().toISOString().slice(0, 10);
    downloadJson(
      { exportedAt: new Date().toISOString(), count: exported.length, shots: exported },
      `shot-history-export-${day}.json`,
    );
    if (failed > 0) {
      alert(`Exported ${exported.length} of ${targets.length} shots (${failed} failed).`);
    }
  }, [filteredHistory, exporting, deletingAll, deletingFiltered, loadFullShotForExport]);

  const onDeleteFiltered = useCallback(async () => {
    const targets = [...filteredHistory];
    if (targets.length === 0 || deletingFiltered || deletingAll || exporting) return;
    bulkCancelRef.current = false;
    setDeletingFiltered(true);
    setDeleteFilteredProgress({ current: 0, total: targets.length });
    const failedIds = [];
    // Sequential req:history:delete loop — no firmware changes needed and the
    // existing per-shot endpoint already updates the index.
    for (let i = 0; i < targets.length; i++) {
      if (bulkCancelRef.current) break;
      try {
        const resp = await apiService.request({ tp: 'req:history:delete', id: targets[i].id });
        if (resp?.error) failedIds.push(targets[i].id);
      } catch {
        failedIds.push(targets[i].id);
      }
      if (bulkCancelRef.current) break;
      setDeleteFilteredProgress({ current: i + 1, total: targets.length });
    }
    const cancelled = bulkCancelRef.current;
    setShowDeleteFilteredModal(false);
    setDeletingFiltered(false);
    setDeleteFilteredProgress({ current: 0, total: 0 });
    // Keep the search term when the run was cancelled or some shots failed, so
    // the remaining matches (and any failures) stay visible.
    const completed = !cancelled && failedIds.length === 0;
    if (completed) {
      setSearchTerm('');
      setCurrentPage(1);
    }
    await loadHistory();
    if (cancelled) return;
    if (failedIds.length > 0) {
      const done = targets.length - failedIds.length;
      alert(`Deleted ${done} of ${targets.length} shots. Failed: ${failedIds.join(', ')}`);
    }
  }, [filteredHistory, deletingFiltered, deletingAll, exporting, apiService]);

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
          <Tooltip content='Export filtered shots'>
            <button
              onClick={onExportFiltered}
              disabled={totalFilteredItems === 0 || busy}
              className='text-base-content/50 hover:text-info hover:bg-info/10 cursor-pointer rounded-md p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40'
              aria-label='Export filtered shots'
            >
              <FontAwesomeIcon icon={faFileExport} className='h-4 w-4' />
            </button>
          </Tooltip>
          <Tooltip content={`Delete filtered shots (${totalFilteredItems})`}>
            <button
              onClick={() => setShowDeleteFilteredModal(true)}
              disabled={totalFilteredItems === 0 || busy}
              className='text-base-content/50 hover:text-error hover:bg-error/10 cursor-pointer rounded-md p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40'
              aria-label='Delete filtered shots'
            >
              <FontAwesomeIcon icon={faFilterCircleXmark} className='h-4 w-4' />
            </button>
          </Tooltip>
          <Tooltip content='Delete all'>
            <button
              onClick={() => setShowDeleteAllModal(true)}
              disabled={history.length === 0 || busy}
              className='text-base-content/50 hover:text-error hover:bg-error/10 cursor-pointer rounded-md p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40'
              aria-label='Delete all shots'
            >
              <FontAwesomeIcon icon={faTrashCan} className='h-4 w-4' />
            </button>
          </Tooltip>
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

      {exporting && (
        <div className='border-base-content/10 bg-base-100 mb-4 rounded-lg border p-4 text-center'>
          <div className='mb-2 text-sm font-semibold opacity-70'>
            {exportProgress.total > 0
              ? `Exporting shot ${exportProgress.current} of ${exportProgress.total}...`
              : 'Preparing export...'}
          </div>
          {exportProgress.total > 0 ? (
            <progress
              className='progress progress-primary w-full max-w-xs'
              value={exportProgress.current}
              max={exportProgress.total}
            />
          ) : (
            <progress className='progress progress-primary w-full max-w-xs' />
          )}
          <div className='mt-3'>
            <button className='btn btn-sm btn-outline' onClick={cancelBulk}>
              Cancel
            </button>
          </div>
        </div>
      )}

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

      {showDeleteAllModal && (
        <ConfirmDeleteModal
          title='Delete all shots?'
          description={`This will permanently delete all ${history.length} shots from the device. This cannot be undone.`}
          confirmLabel='Delete all'
          busyLabel='Deleting…'
          descriptionClassName='mb-6 text-sm text-gray-600 dark:text-gray-300'
          busy={deletingAll}
          onClose={() => setShowDeleteAllModal(false)}
          onConfirm={onDeleteAll}
        />
      )}

      {showDeleteFilteredModal && (
        <ConfirmDeleteModal
          title='Delete filtered shots?'
          description={`This will permanently delete the ${totalFilteredItems} shots matching your current search and filters (across all pages). This cannot be undone.`}
          confirmLabel={`Delete ${totalFilteredItems} shots`}
          busy={deletingFiltered}
          progress={deleteFilteredProgress}
          onClose={() => setShowDeleteFilteredModal(false)}
          onConfirm={onDeleteFiltered}
          onCancelBusy={cancelBulk}
        />
      )}
    </>
  );
}
