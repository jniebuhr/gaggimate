import Sortable, { MultiDrag } from 'sortablejs';
try {
  Sortable?.mount(new MultiDrag());
} catch (error) {
  // to avoid error when vite is reloading the page in dev mode
}

import {
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  TimeScale,
} from 'chart.js';
import 'chartjs-adapter-dayjs-4/dist/chartjs-adapter-dayjs-4.esm';
import { ExtendedProfileChart } from '../../components/ExtendedProfileChart.jsx';
import { useConfirmAction } from '../../hooks/useConfirmAction.js';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { computed } from '@preact/signals';
import { Spinner } from '../../components/Spinner.jsx';
import Card from '../../components/Card.jsx';
import { parseProfile } from './utils.js';
import { downloadJson } from '../../utils/download.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar } from '@fortawesome/free-solid-svg-icons/faStar';
import { faPen } from '@fortawesome/free-solid-svg-icons/faPen';
import { faFileExport } from '@fortawesome/free-solid-svg-icons/faFileExport';
import { faCopy } from '@fortawesome/free-solid-svg-icons/faCopy';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons/faTrashCan';
import { faChevronRight } from '@fortawesome/free-solid-svg-icons/faChevronRight';
import { faFileImport } from '@fortawesome/free-solid-svg-icons/faFileImport';
import { faEllipsisVertical } from '@fortawesome/free-solid-svg-icons/faEllipsisVertical';
import { faChartSimple } from '@fortawesome/free-solid-svg-icons/faChartSimple';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { faXmark } from '@fortawesome/free-solid-svg-icons/faXmark';
import { Tooltip } from '../../components/Tooltip.jsx';
import { faTemperatureFull } from '@fortawesome/free-solid-svg-icons/faTemperatureFull';
import { faClock } from '@fortawesome/free-solid-svg-icons/faClock';
import { faScaleBalanced } from '@fortawesome/free-solid-svg-icons/faScaleBalanced';
import { faSearch } from '@fortawesome/free-solid-svg-icons/faSearch';
import { faAnglesDown, faAnglesUp, faGripVertical } from '@fortawesome/free-solid-svg-icons';
import { buildStatisticsProfileHref } from '../Statistics/utils/statisticsRoute.js';

Chart.register(
  LineController,
  TimeScale,
  LinearScale,
  CategoryScale,
  PointElement,
  LineElement,
  Filler,
  Legend,
);

const PhaseLabels = {
  preinfusion: 'Pre-Infusion',
  brew: 'Brew',
};

const connected = computed(() => machine.value.connected);

function ProfileCard({
  data,
  onDelete,
  onSelect,
  onFavorite,
  onUnfavorite,
  onDuplicate,
  favoriteDisabled,
  unfavoriteDisabled,
  disabledDrag,
  isDragging,
  onMoveTop,
  onMoveBottom,
  isFirst,
  isLast,
}) {
  const { armed: confirmDelete, armOrRun: confirmOrDelete } = useConfirmAction(4000);
  const [tooltipsDisabled, setTooltipsDisabled] = useState(false);
  const [cardDropdownOpen, setCardDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!cardDropdownOpen) return;
    const handleOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setCardDropdownOpen(false);
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [cardDropdownOpen]);

  const handleMoveTop = useCallback(() => {
    setTooltipsDisabled(true);
    onMoveTop(data.id);
    setTimeout(() => setTooltipsDisabled(false), 500);
  }, [onMoveTop, data.id]);

  const handleMoveBottom = useCallback(() => {
    setTooltipsDisabled(true);
    onMoveBottom(data.id);
    setTimeout(() => setTooltipsDisabled(false), 500);
  }, [onMoveBottom, data.id]);

  const bookmarkClass = data.favorite ? 'text-warning' : 'text-base-content/60';
  const typeText = data.type === 'pro' ? 'Pro' : 'Simple';
  const typeClass = data.type === 'pro' ? 'badge badge-primary' : 'badge badge-neutral';
  const favoriteToggleDisabled = data.favorite ? unfavoriteDisabled : favoriteDisabled;
  const favoriteToggleClass = favoriteToggleDisabled ? 'opacity-50 cursor-not-allowed' : '';

  const onFavoriteToggle = useCallback(() => {
    if (data.favorite && !unfavoriteDisabled) onUnfavorite(data.id);
    else if (!data.favorite && !favoriteDisabled) onFavorite(data.id);
  }, [data.favorite, unfavoriteDisabled, favoriteDisabled, onUnfavorite, onFavorite, data.id]);

  const onDownload = useCallback(() => {
    const download = {
      ...data,
    };
    delete download.id;
    delete download.selected;
    delete download.favorite;

    downloadJson(download, `profile-${data.id}.json`);
  }, [data]);
  const statsHref = buildStatisticsProfileHref({ source: 'gaggimate', profileName: data.label });

  // Toggle profile details
  const [detailsCollapsed, setDetailsCollapsed] = useState(true);
  const onToggleDetails = useCallback(() => setDetailsCollapsed(v => !v), []);
  const chevronRotation = detailsCollapsed ? '' : 'rotate-90';
  const detailsSectionId = `profile-${data.id}-summary`;

  // Sum total duration from phases (in seconds)
  const totalDurationSeconds = Array.isArray(data?.phases)
    ? data.phases.reduce((sum, p) => sum + (Number.isFinite(p?.duration) ? p.duration : 0), 0)
    : 0;

  // Simple handler to close dropdown on item click
  const closeDropdownMenu = useCallback(() => {
    setCardDropdownOpen(false);
  }, []);

  return (
    <Card sm={12} role='listitem' className='profile-card-container mb-2'>
      <div
        className='flex flex-row items-center'
        role='group'
        aria-labelledby={`profile-${data.id}-title`}
      >
        <div className='flex flex-grow flex-col min-w-0'>
          <div className='mx-2 flex flex-row items-center gap-2 align-middle'>
            <div className='flex min-w-0 flex-grow flex-row items-center gap-4'>
              {/* CheckBox */}
              <div>
                <label className='cursor-pointer'>
                  <input
                    checked={data.selected}
                    type='checkbox'
                    onClick={() => onSelect(data.id)}
                    className='checkbox checkbox-success checkbox-sm'
                    aria-label={`Select ${data.label} profile`}
                  />
                </label>
              </div>
              {/* Label and Type */}
              <div className='flex flex-row flex-wrap items-center gap-4'>
                <span
                  id={`profile-${data.id}-title`}
                  className='min-w-0 flex-1 truncate text-sm leading-tight font-bold lg:text-xl'
                >
                  {data.label}
                </span>
                <span
                  className={`${typeClass} badge-sm lg:badge-md font-medium`}
                  aria-label={`Profile type: ${typeText}`}
                >
                  {typeText}
                </span>
                <button
                  onClick={onToggleDetails}
                  className='btn btn-xs btn-ghost self-start'
                  aria-label={`${detailsCollapsed ? 'Show' : 'Hide'} details for ${data.label}`}
                  aria-expanded={!detailsCollapsed}
                  aria-controls={detailsSectionId}
                  title={detailsCollapsed ? 'Show details' : 'Hide details'}
                >
                  <FontAwesomeIcon
                    icon={faChevronRight}
                    className={`transition-transform ${chevronRotation}`}
                  />
                </button>
              </div>
              {/*- Actions -*/}
              <div
                className='flex flex-1 flex-row justify-end gap-2'
                role='group'
                aria-label={`Actions for ${data.label} profile`}
              >
                {/* Mobile: DaisyUI dropdown actions menu */}
                <div className={`action-dropdown sm:hidden relative ${cardDropdownOpen ? 'action-dropdown-open' : ''}`} ref={dropdownRef}>
                  <button
                    onClick={() => setCardDropdownOpen(open => !open)}
                    className='btn btn-sm btn-ghost btn-circle'
                    aria-label={`Open actions menu for ${data.label} profile`}
                    aria-expanded={cardDropdownOpen}
                  >
                    <FontAwesomeIcon icon={faEllipsisVertical} />
                  </button>
                  <ul className="menu action-dropdown-menu bg-base-100 rounded-box z-50 w-52 p-2 shadow-xl border border-base-content/10 mt-1 right-0">
                    <li>
                      <button
                        onClick={() => {
                          onFavoriteToggle();
                          closeDropdownMenu();
                        }}
                        disabled={favoriteToggleDisabled}
                        className={`justify-start ${favoriteToggleClass}`}
                        aria-label={
                          data.favorite
                            ? `Remove ${data.label} from favorites`
                            : `Add ${data.label} to favorites`
                        }
                        aria-pressed={data.favorite}
                      >
                        <FontAwesomeIcon icon={faStar} className={bookmarkClass} />
                        <span>{data.favorite ? 'Unfavorite' : 'Favorite'}</span>
                      </button>
                    </li>
                    <li>
                      <a
                        href={`/profiles/${data.id}`}
                        onClick={closeDropdownMenu}
                        aria-label={`Edit ${data.label} profile`}
                      >
                        <FontAwesomeIcon icon={faPen} />
                        <span>Edit</span>
                      </a>
                    </li>
                    <li>
                      <a
                        href={statsHref}
                        onClick={closeDropdownMenu}
                        className='text-success justify-start'
                        aria-label={`View statistics for ${data.label} profile`}
                      >
                        <FontAwesomeIcon icon={faChartSimple} />
                        <span>Statistics</span>
                      </a>
                    </li>
                    <li>
                      <button
                        onClick={() => {
                          onDownload();
                          closeDropdownMenu();
                        }}
                        className='text-primary justify-start'
                        aria-label={`Export ${data.label} profile`}
                      >
                        <FontAwesomeIcon icon={faFileExport} />
                        <span>Export</span>
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => {
                          onDuplicate(data.id);
                          closeDropdownMenu();
                        }}
                        className='text-success justify-start'
                        aria-label={`Duplicate ${data.label} profile`}
                      >
                        <FontAwesomeIcon icon={faCopy} />
                        <span>Duplicate</span>
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => {
                          confirmOrDelete(() => {
                            onDelete(data.id);
                            closeDropdownMenu();
                          });
                        }}
                        className={`justify-start ${confirmDelete ? 'bg-error text-error-content rounded font-semibold' : 'text-error'}`}
                        aria-label={
                          confirmDelete
                            ? `Confirm deletion of ${data.label} profile`
                            : `Delete ${data.label} profile`
                        }
                        title={confirmDelete ? 'Click to confirm delete' : 'Delete profile'}
                      >
                        <FontAwesomeIcon icon={faTrashCan} />
                        <span>{confirmDelete ? 'Confirm' : 'Delete'}</span>
                      </button>
                    </li>
                  </ul>
                </div>

                {/* Desktop: inline actions */}
                <div
                  className='hidden flex-row justify-end gap-2 sm:flex'
                  role='group'
                  aria-label={`Actions for ${data.label} profile`}
                >
                  <Tooltip content={data.favorite ? 'Remove from favorites' : 'Add to favorites'}>
                    <button
                      onClick={onFavoriteToggle}
                      disabled={favoriteToggleDisabled}
                      className={`btn btn-sm btn-ghost ${favoriteToggleClass}`}
                      aria-label={
                        data.favorite
                          ? `Remove ${data.label} from favorites`
                          : `Add ${data.label} to favorites`
                      }
                      aria-pressed={data.favorite}
                    >
                      <FontAwesomeIcon icon={faStar} className={bookmarkClass} />
                    </button>
                  </Tooltip>
                  <Tooltip content='Edit profile'>
                    <a
                      href={`/profiles/${data.id}`}
                      className='btn btn-sm btn-ghost'
                      aria-label={`Edit ${data.label} profile`}
                    >
                      <FontAwesomeIcon icon={faPen} />
                    </a>
                  </Tooltip>
                  <Tooltip content='View statistics for this profile'>
                    <a
                      href={statsHref}
                      className='btn btn-sm btn-ghost text-success'
                      aria-label={`View statistics for ${data.label} profile`}
                    >
                      <FontAwesomeIcon icon={faChartSimple} />
                    </a>
                  </Tooltip>
                  <Tooltip content='Export profile'>
                    <button
                      onClick={onDownload}
                      className='btn btn-sm btn-ghost text-primary'
                      aria-label={`Export ${data.label} profile`}
                    >
                      <FontAwesomeIcon icon={faFileExport} />
                    </button>
                  </Tooltip>
                  <Tooltip content='Duplicate profile'>
                    <button
                      onClick={() => onDuplicate(data.id)}
                      className='btn btn-sm btn-ghost text-success'
                      aria-label={`Duplicate ${data.label} profile`}
                    >
                      <FontAwesomeIcon icon={faCopy} />
                    </button>
                  </Tooltip>
                  <Tooltip content={confirmDelete ? 'Click to confirm' : 'Delete profile'}>
                    <button
                      onClick={() => {
                        confirmOrDelete(() => onDelete(data.id));
                      }}
                      className={`btn btn-sm btn-ghost ${confirmDelete ? 'bg-error text-error-content' : 'text-error'}`}
                      aria-label={
                        confirmDelete
                          ? `Confirm deletion of ${data.label} profile`
                          : `Delete ${data.label} profile`
                      }
                    >
                      <FontAwesomeIcon icon={faTrashCan} />
                      {confirmDelete && <span className='ml-2 font-semibold'>Confirm</span>}
                    </button>
                  </Tooltip>
                </div>
              </div>
            </div>
          </div>
          <div className={`${isDragging ? 'hidden' : ''}`}>
            {!detailsCollapsed && (
              <div id={detailsSectionId} className='mx-2 mt-2 flex flex-col items-start gap-2'>
                <span className='text-base-content/60 text-xs md:text-sm'>{data.description}</span>
                <div className='flex flex-row gap-2'>
                  <span className='text-base-content/60 badge badge-xs md:badge-sm badge-outline'>
                    <FontAwesomeIcon icon={faTemperatureFull} />
                    {data.temperature}°C
                  </span>
                  <span className='text-base-content/60 badge badge-xs md:badge-sm badge-outline'>
                    <FontAwesomeIcon icon={faClock} />
                    {totalDurationSeconds}s
                  </span>
                  {data.phases.length > 0 &&
                    data.phases[data.phases.length - 1]?.targets?.some(
                      t => t.type === 'volumetric',
                    ) && (
                      <span className='text-base-content/60 badge badge-xs md:badge-sm badge-outline'>
                        <FontAwesomeIcon icon={faScaleBalanced} />
                        {`${data.phases[data.phases.length - 1].targets.find(t => t.type === 'volumetric').value}g`}
                      </span>
                    )}
                  {data.phases.length > 0 && (
                    <span className='text-base-content/60 badge badge-xs md:badge-sm badge-outline'>
                      {data.phases.length} phase{data.phases.length === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
              </div>
            )}
            <div
              className='flex flex-row gap-2 py-2'
              aria-label={`Profile details for ${data.label}`}
            >
              <div className='flex flex-col justify-evenly pr-1'>
                <Tooltip content='Move to top' disabled={isDragging || tooltipsDisabled}>
                  <button
                    onClick={handleMoveTop}
                    disabled={isFirst}
                    className='drag-to-top btn btn-sm btn-ghost'
                    aria-label={`Move ${data.label} to top`}
                    aria-disabled={isFirst}
                  >
                    <FontAwesomeIcon icon={faAnglesUp} />
                  </button>
                </Tooltip>
                <Tooltip
                  content={`${disabledDrag ? 'Drag disabled on search result' : 'Drag to reorder'}`}
                  disabled={isDragging}
                >
                  <div
                    className={`drag-handle btn btn-sm btn-ghost ${disabledDrag ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}
                  >
                    <FontAwesomeIcon icon={faGripVertical} />
                  </div>
                </Tooltip>
                <Tooltip content='Move to bottom' disabled={isDragging || tooltipsDisabled}>
                  <button
                    onClick={handleMoveBottom}
                    disabled={isLast}
                    className='drag-to-bottom btn btn-sm btn-ghost'
                    aria-label={`Move ${data.label} to bottom`}
                    aria-disabled={isLast}
                  >
                    <FontAwesomeIcon icon={faAnglesDown} />
                  </button>
                </Tooltip>
              </div>
              <div className='flex-grow overflow-x-auto'>
                {data.type === 'pro' ? (
                  <ExtendedProfileChart data={data} className='max-h-36' />
                ) : (
                  <SimpleContent data={data} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function SimpleContent({ data }) {
  return (
    <div className='flex flex-row items-center gap-2' role='list' aria-label='Brew phases'>
      {data.phases.map((phase, i) => (
        <div key={i} className='flex flex-row items-center gap-2' role='listitem'>
          {i > 0 && <SimpleDivider />}
          <SimpleStep
            phase={phase.phase}
            type={phase.name}
            duration={phase.duration}
            targets={phase.targets || []}
          />
        </div>
      ))}
    </div>
  );
}

function SimpleDivider() {
  return (
    <FontAwesomeIcon icon={faChevronRight} className='text-base-content/60' aria-hidden='true' />
  );
}

function SimpleStep(props) {
  return (
    <div className='bg-base-100 border-base-300 flex flex-col gap-1 rounded-lg border p-3'>
      <div className='flex flex-row gap-2'>
        <span className='text-base-content text-sm font-bold'>{PhaseLabels[props.phase]}</span>
        <span className='text-base-content/70 text-sm'>{props.type}</span>
      </div>
      <div className='text-base-content/60 text-sm italic'>
        {props.targets.length === 0 && <span>Duration: {props.duration}s</span>}
        {props.targets.map((t, i) => (
          <span key={i}>
            Exit on: {t.value}
            {t.type === 'volumetric' && 'g'}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ProfileList() {
  const apiService = useContext(ApiServiceContext);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('extraction');
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);
  const { armed: confirmDeleteAll, armOrRun: confirmOrDeleteAll } = useConfirmAction(4000);
  const [isMobileSearchActive, setIsMobileSearchActive] = useState(false);
  const mobileSearchInputRef = useRef(null);
  const [mobileHeaderDropdownOpen, setMobileHeaderDropdownOpen] = useState(false);
  const [desktopHeaderDropdownOpen, setDesktopHeaderDropdownOpen] = useState(false);
  const mobileHeaderDropdownRef = useRef(null);
  const desktopHeaderDropdownRef = useRef(null);

  // Manage immediate blur when mobile search is dismissed, and handle reduced-motion focus
  useEffect(() => {
    if (!isMobileSearchActive) {
      // Only blur if it's actually the active element to prevent unnecessary layout recalculations
      if (
        mobileSearchInputRef.current &&
        document.activeElement === mobileSearchInputRef.current
      ) {
        mobileSearchInputRef.current.blur();
      }
    } else {
      // If motion is reduced, bypass the transition delay and focus instantly for 0ms accessibility
      if (
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
        mobileSearchInputRef.current
      ) {
        mobileSearchInputRef.current.focus({ preventScroll: true });
      }
    }
  }, [isMobileSearchActive]);

  const handleSearchTransitionEnd = (e) => {
    // Ensure we are triggering off the main transform transition and search is active
    if (isMobileSearchActive && e.propertyName === 'transform' && mobileSearchInputRef.current) {
      mobileSearchInputRef.current.focus({ preventScroll: true });
    }
  };

  // Close header dropdown menus when clicking anywhere outside
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (mobileHeaderDropdownOpen && mobileHeaderDropdownRef.current && !mobileHeaderDropdownRef.current.contains(event.target)) {
        setMobileHeaderDropdownOpen(false);
      }
      if (desktopHeaderDropdownOpen && desktopHeaderDropdownRef.current && !desktopHeaderDropdownRef.current.contains(event.target)) {
        setDesktopHeaderDropdownOpen(false);
      }
    };

    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [mobileHeaderDropdownOpen, desktopHeaderDropdownOpen]);



  const favoriteCount = profiles.map(p => (p.favorite ? 1 : 0)).reduce((a, b) => a + b, 0);
  const unfavoriteDisabled = favoriteCount <= 1;
  const favoriteDisabled = favoriteCount >= 10;
  const hasUtilityProfiles = useMemo(() => profiles.some(p => p.utility), [profiles]);

  useEffect(() => {
    if (!hasUtilityProfiles) {
      setActiveTab('extraction');
    }
  }, [hasUtilityProfiles]);

  const loadProfiles = async () => {
    const response = await apiService.request({ tp: 'req:profiles:list' });
    setProfiles(response.profiles);
    setLoading(false);
  };

  // Placeholder for future persistence of order (intentionally empty)
  // Debounced persistence of profile order (300ms)
  const orderDebounceRef = useRef(null);
  const pendingOrderRef = useRef(null);
  const persistProfileOrder = useCallback(
    orderedProfiles => {
      pendingOrderRef.current = orderedProfiles.map(p => p.id);
      if (orderDebounceRef.current) {
        clearTimeout(orderDebounceRef.current);
      }
      orderDebounceRef.current = setTimeout(async () => {
        const orderedIds = pendingOrderRef.current;
        if (!orderedIds) return;
        try {
          await apiService.request({ tp: 'req:profiles:reorder', order: orderedIds });
        } catch (e) {
          // optional: log or surface error
        }
      }, 300);
    },
    [apiService],
  );

  // Cleanup: flush pending order on unmount
  useEffect(() => {
    return () => {
      if (orderDebounceRef.current) {
        clearTimeout(orderDebounceRef.current);
        if (pendingOrderRef.current) {
          // fire and forget; no await during unmount
          apiService
            .request({ tp: 'req:profiles:reorder', order: pendingOrderRef.current })
            .catch(() => {});
        }
      }
    };
  }, [apiService]);

  // Filtered profiles
  const profilesToShow = useMemo(() => {
    // Apply search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase().trim();
      return profiles.filter(
        profile =>
          profile.label?.toLowerCase().includes(search) ||
          profile.description?.toLowerCase().includes(search),
      );
    }
    return profiles;
  }, [profiles, searchTerm]);

  const clearDropHighlights = useCallback(() => {
    if (!containerRef.current) return;
    const highlighted = containerRef.current.querySelectorAll('.drop-highlight');
    highlighted.forEach(el => {
      el.classList.remove('drop-highlight');
    });
  }, []);

  const moveProfileTop = useCallback(
    id => {
      setProfiles(prev => {
        const idx = prev.findIndex(p => p.id === id);
        if (idx <= 0) return prev;

        const item = prev[idx];
        const reordered = [item, ...prev.slice(0, idx), ...prev.slice(idx + 1)];

        const normalized = [
          ...reordered.filter(p => !p.utility),
          ...reordered.filter(p => p.utility),
        ];

        persistProfileOrder(normalized);
        return normalized;
      });
    },
    [persistProfileOrder],
  );

  const moveProfileBottom = useCallback(
    id => {
      setProfiles(prev => {
        const idx = prev.findIndex(p => p.id === id);
        if (idx === -1 || idx === prev.length - 1) {
          return prev;
        }

        const item = prev[idx];
        const reordered = [...prev.slice(0, idx), ...prev.slice(idx + 1), item];

        const normalized = [
          ...reordered.filter(p => !p.utility),
          ...reordered.filter(p => p.utility),
        ];

        persistProfileOrder(normalized);
        return normalized;
      });
    },
    [persistProfileOrder],
  );

  const onDragStart = useCallback(() => {
    setIsDragging(true);
    if (!containerRef.current) return;

    // Clear any previous drop highlights
    clearDropHighlights();
  }, [clearDropHighlights]);

  const onDragChange = useCallback(
    evt => {
      const { newIndex, oldIndex } = evt;
      if (newIndex == null || oldIndex == null) return;
      const container = containerRef.current;
      if (!container) return;

      // Clear previous highlights
      clearDropHighlights();

      // Resolve the card element at newIndex among visible items
      const cards = container.querySelectorAll('.profile-card-container');
      const targetElement = cards && cards[newIndex];
      if (!targetElement) return;
      // highlight the element's new position in the list
      targetElement.classList.add('drop-highlight');
    },
    [clearDropHighlights],
  );

  const onDragEnd = useCallback(
    evt => {
      setIsDragging(false);

      // Clear any drop highlights
      clearDropHighlights();

      const { oldIndex, newIndex, oldIndicies } = evt;
      if (oldIndex === newIndex) return;

      setProfiles(prev => {
        const displayedProfiles = prev.filter(p =>
          activeTab === 'utility' ? p.utility : !p.utility,
        );

        const movedItems = (
          oldIndicies && oldIndicies.length > 0 ? oldIndicies : [{ index: oldIndex }]
        )
          .map(({ index }) => displayedProfiles[index])
          .filter(Boolean); // filter all falsey

        if (movedItems.length === 0) return prev;

        const movedIds = new Set(movedItems.map(p => p.id));
        const remainingVisible = displayedProfiles.filter(p => !movedIds.has(p.id));

        const insertAt = Math.min(newIndex, remainingVisible.length);
        const reorderedVisible = [
          ...remainingVisible.slice(0, insertAt),
          ...movedItems,
          ...remainingVisible.slice(insertAt),
        ];

        const next =
          activeTab === 'utility'
            ? [...prev.filter(p => !p.utility), ...reorderedVisible]
            : [...reorderedVisible, ...prev.filter(p => p.utility)];

        persistProfileOrder(next);
        return next;
      });
    },
    [activeTab, clearDropHighlights, persistProfileOrder],
  );

  // Sorting via SortableJS
  useEffect(() => {
    if (loading || !containerRef.current) return;

    const isFiltered = !!searchTerm.trim();

    const sortable = Sortable.create(containerRef.current, {
      multiDrag: true,
      selectedClass: 'profile-list-drag-selected-item',
      animation: 150,
      handle: '.drag-handle',
      disabled: isFiltered,
      onStart: onDragStart,
      onChange: onDragChange,
      onEnd: onDragEnd,
    });

    return () => {
      sortable.destroy();
    };
  }, [loading, searchTerm, onDragStart, onDragChange, onDragEnd]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const loadData = async () => {
      if (connected.value) {
        await loadProfiles();
      }
    };
    loadData();
  }, [connected.value]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onDelete = useCallback(
    async id => {
      setLoading(true);
      await apiService.request({ tp: 'req:profiles:delete', id });
      await loadProfiles();
    },
    [apiService, setLoading],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onSelect = useCallback(
    async id => {
      setLoading(true);
      await apiService.request({ tp: 'req:profiles:select', id });
      await loadProfiles();
    },
    [apiService, setLoading],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onFavorite = useCallback(
    async id => {
      setLoading(true);
      await apiService.request({ tp: 'req:profiles:favorite', id });
      await loadProfiles();
    },
    [apiService, setLoading],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onUnfavorite = useCallback(
    async id => {
      setLoading(true);
      await apiService.request({ tp: 'req:profiles:unfavorite', id });
      await loadProfiles();
    },
    [apiService, setLoading],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onDuplicate = useCallback(
    async id => {
      setLoading(true);
      const original = profiles.find(p => p.id === id);
      if (original) {
        const copy = { ...original };
        delete copy.id;
        delete copy.selected;
        delete copy.favorite;
        copy.label = `${original.label} Copy`;
        await apiService.request({ tp: 'req:profiles:save', profile: copy });
      }
      await loadProfiles();
    },
    [apiService, profiles, setLoading],
  );

  const onExport = useCallback(() => {
    const exportedProfiles = profiles.map(p => {
      const ep = {
        ...p,
      };
      delete ep.id;
      delete ep.selected;
      delete ep.favorite;
      return ep;
    });

    downloadJson(exportedProfiles, 'profiles.json');
  }, [profiles]);

  const onUpload = function (evt) {
    if (evt.target.files.length) {
      const file = evt.target.files[0];
      const reader = new FileReader();
      reader.onload = async e => {
        const result = e.target.result;
        if (typeof result === 'string') {
          setLoading(true);
          try {
            const profiles = parseProfile(result);
            for (const p of profiles) {
              await apiService.request({ tp: 'req:profiles:save', profile: p });
            }
          } catch {
            // Individual save errors are surfaced by WS timeout; continue to reload list.
          }
          await loadProfiles();
        }
      };
      reader.readAsText(file);
    }
  };

  const onClear = useCallback(async () => {
    setLoading(true);
    for (const p of profiles) {
      if (!p.selected) {
        await apiService.request({ tp: 'req:profiles:delete', id: p.id });
      }
    }
    await loadProfiles();
  }, [profiles, apiService]);

  const dropdownMenuItems = (
    <>
      <li>
        <button
          onClick={onExport}
          className='justify-start text-primary hover:bg-primary/10'
          aria-label='Export all profiles'
        >
          <FontAwesomeIcon icon={faFileExport} />
          <span>Export All</span>
        </button>
      </li>
      <li>
        <label
          htmlFor='profileImport'
          className='justify-start text-success hover:bg-success/10 cursor-pointer flex items-center gap-2'
          aria-label='Import profiles'
        >
          <FontAwesomeIcon icon={faFileImport} />
          <span>Import Profiles</span>
        </label>
      </li>
      <li>
        <button
          onClick={() => {
            confirmOrDeleteAll(onClear);
          }}
          className={`justify-start ${confirmDeleteAll ? 'bg-error text-error-content font-semibold rounded' : 'text-error hover:bg-error/10'}`}
          aria-label={confirmDeleteAll ? 'Confirm deletion of all profiles' : 'Delete all profiles'}
        >
          <FontAwesomeIcon icon={faTrashCan} />
          <span>{confirmDeleteAll ? 'Confirm Delete All' : 'Delete All Profiles'}</span>
        </button>
      </li>
    </>
  );

  if (loading) {
    return (
      <div
        className='flex w-full flex-row items-center justify-center py-16'
        role='status'
        aria-live='polite'
        aria-label='Loading profiles'
      >
        <Spinner size={8} />
      </div>
    );
  }

  return (
    <div className="w-full relative">
      <div className="profile-list-header h-12 relative z-20 flex flex-row items-center justify-between overflow-visible">
        {/* Left Side: Title */}
        <h1 className='text-2xl font-bold sm:text-3xl'>Profiles</h1>

        {/* Right Side: Action Icons on Mobile, Standard controls on Desktop/Tablet */}
        <div className="flex flex-row items-center gap-3">
          {/* Mobile-only Action Buttons */}
          <div className='flex flex-row items-center gap-1 sm:hidden'>
            <button
              onClick={() => setIsMobileSearchActive(active => !active)}
              className={`btn btn-ghost btn-circle text-base-content/80 transition-colors ${isMobileSearchActive ? 'text-primary bg-primary/10' : ''}`}
              aria-label='Toggle search bar'
              aria-expanded={isMobileSearchActive}
            >
              <FontAwesomeIcon icon={faSearch} size="lg" />
            </button>
            <a
              href='/profiles/new'
              className='btn btn-ghost btn-circle text-primary'
              aria-label='Create new profile'
            >
              <FontAwesomeIcon icon={faPlus} size="lg" />
            </a>
            <div 
              className={`action-dropdown relative ${mobileHeaderDropdownOpen ? 'action-dropdown-open' : ''}`}
              ref={mobileHeaderDropdownRef}
            >
              <button
                onClick={() => setMobileHeaderDropdownOpen(open => !open)}
                className='btn btn-ghost btn-circle text-base-content/80'
                aria-label='More options'
                aria-expanded={mobileHeaderDropdownOpen}
              >
                <FontAwesomeIcon icon={faEllipsisVertical} size="lg" />
              </button>
              <ul className="menu action-dropdown-menu bg-base-100 rounded-box z-50 w-52 p-2 shadow-xl border border-base-content/10 mt-1 right-0">
                {dropdownMenuItems}
              </ul>
            </div>
          </div>

          {/* Desktop/Tablet Action Buttons (hidden on mobile) */}
          <div className='hidden sm:flex flex-row items-center gap-3'>
            {/* Search bar */}
            <label className='input w-40 md:w-48 lg:w-56'>
              <FontAwesomeIcon icon={faSearch} />
              <input
                type='text'
                placeholder='Search profiles...'
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className='grow'
              />
            </label>

            {/* Create Profile Button */}
            <a
              href='/profiles/new'
              className='btn btn-primary gap-2'
              aria-label='Create new profile'
            >
              <FontAwesomeIcon icon={faPlus} />
              <span>Create Profile</span>
            </a>

            {/* More Actions Dropdown */}
            <div 
              className={`action-dropdown relative ${desktopHeaderDropdownOpen ? 'action-dropdown-open' : ''}`}
              ref={desktopHeaderDropdownRef}
            >
              <button 
                onClick={() => setDesktopHeaderDropdownOpen(open => !open)}
                className='btn btn-square btn-outline' 
                aria-label='More options'
                aria-expanded={desktopHeaderDropdownOpen}
              >
                <FontAwesomeIcon icon={faEllipsisVertical} />
              </button>
              <ul className="menu action-dropdown-menu bg-base-100 rounded-box z-50 w-52 p-2 shadow-xl border border-base-content/10 mt-1 right-0">
                {dropdownMenuItems}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile-only Slide-Down Search Bar (using nested sticky structure to bypass WebKit transform bugs) */}
      <div className={`search-slide-sticky sm:hidden ${isMobileSearchActive ? 'search-slide-sticky-active' : ''}`}>
        <div className="search-slide-container" onTransitionEnd={handleSearchTransitionEnd}>
          <div className="bg-base-300 shadow-sm py-2 px-4 mx-[-16px]">
            <label className="input flex items-center w-full bg-base-100 border border-base-content/10">
              <FontAwesomeIcon icon={faSearch} className="text-base-content/60 mr-2" />
              <input
                type="text"
                placeholder="Search profiles..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="grow"
                ref={mobileSearchInputRef}
              />
            </label>
          </div>
        </div>
      </div>

      <input
        onChange={onUpload}
        className='hidden'
        id='profileImport'
        type='file'
        accept='.json,application/json,.tcl'
        aria-label='Select a JSON file containing profile data to import'
      />
      <div className={`profiles-list-content mt-4 ${isMobileSearchActive ? 'search-active' : ''}`}>
        {hasUtilityProfiles && (
          <div role='tablist' className='tabs tabs-border mb-4'>
            <button
              role='tab'
              className={`tab ${activeTab === 'extraction' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('extraction')}
              aria-label='Switch to extraction tab'
            >
              Extraction
            </button>
            <button
              role='tab'
              className={`tab ${activeTab === 'utility' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('utility')}
              aria-label='Switch to utility tab'
            >
              Utility
            </button>
          </div>
        )}
        <div
          className='grid grid-cols-1 gap-4 lg:grid-cols-12'
          role='list'
          aria-label='Profile list'
          ref={containerRef}
        >
          {profilesToShow
            .filter(p => (activeTab === 'utility' ? p.utility : !p.utility))
            .map((data, idx, filtered) => (
              <ProfileCard
                key={data.id}
                data={data}
                onDelete={onDelete}
                onSelect={onSelect}
                favoriteDisabled={favoriteDisabled}
                unfavoriteDisabled={unfavoriteDisabled}
                onUnfavorite={onUnfavorite}
                onFavorite={onFavorite}
                onDuplicate={onDuplicate}
                disabledDrag={!!searchTerm.trim()}
                isDragging={isDragging}
                onMoveTop={moveProfileTop}
                onMoveBottom={moveProfileBottom}
                isFirst={idx === 0}
                isLast={idx === filtered.length - 1}
              />
            ))}
        </div>
      </div>
    </div>
  );
}
