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
import { ProfileTypeSelection } from '../ProfileEdit/ProfileTypeSelection.jsx';
import { HoldToConfirmButton } from '../../components/HoldToConfirmButton.jsx';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver.js';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { computed } from '@preact/signals';
import { Spinner } from '../../components/Spinner.jsx';
import PageLayout from '../../components/PageLayout.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import TabBar from '../../components/TabBar.jsx';
import Card from '../../components/Card.jsx';
import { parseProfile } from './utils.js';
import { ProgressiveContent } from '../../components/ProgressiveContent.jsx';
import { ProfileListSkeleton } from '../../components/Skeletons.jsx';
import { downloadJson } from '../../utils/download.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye } from '@fortawesome/free-solid-svg-icons/faEye';
import { faEyeSlash } from '@fortawesome/free-solid-svg-icons/faEyeSlash';
import { faPen } from '@fortawesome/free-solid-svg-icons/faPen';
import { faFileExport } from '@fortawesome/free-solid-svg-icons/faFileExport';
import { faCopy } from '@fortawesome/free-solid-svg-icons/faCopy';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons/faTrashCan';
import { faChevronRight } from '@fortawesome/free-solid-svg-icons/faChevronRight';
import { faFileImport } from '@fortawesome/free-solid-svg-icons/faFileImport';
import { faEllipsisVertical } from '@fortawesome/free-solid-svg-icons/faEllipsisVertical';
import { faChartSimple } from '@fortawesome/free-solid-svg-icons/faChartSimple';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';

import { Tooltip } from '../../components/Tooltip.jsx';
import { faTemperatureFull } from '@fortawesome/free-solid-svg-icons/faTemperatureFull';
import { faClock } from '@fortawesome/free-solid-svg-icons/faClock';
import { faScaleBalanced } from '@fortawesome/free-solid-svg-icons/faScaleBalanced';
import { faSearch } from '@fortawesome/free-solid-svg-icons/faSearch';
import { faAnglesDown } from '@fortawesome/free-solid-svg-icons/faAnglesDown';
import { faAnglesUp } from '@fortawesome/free-solid-svg-icons/faAnglesUp';
import { faGripVertical } from '@fortawesome/free-solid-svg-icons/faGripVertical';
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

/**
 * Renders a single profile card with its chart, stats, and action dropdown.
 *
 * @param {Object} props - The component props.
 * @param {Object} props.data - The profile data object.
 * @param {Function} props.onDelete - Callback when the profile is deleted.
 * @param {Function} props.onSelect - Callback when the profile is selected.
 * @param {Function} props.onFavorite - Callback when the profile is favorited.
 * @param {Function} props.onUnfavorite - Callback when the profile is unfavorited.
 * @param {Function} props.onDuplicate - Callback when the profile is duplicated.
 * @param {boolean} props.favoriteDisabled - Whether the favorite action is disabled.
 * @param {boolean} props.unfavoriteDisabled - Whether the unfavorite action is disabled.
 * @param {boolean} props.disabledDrag - Whether drag-and-drop is disabled.
 * @param {boolean} props.isDragging - Whether this specific card is currently being dragged.
 * @param {Function} props.onMoveTop - Callback to move the profile to the top.
 * @param {Function} props.onMoveBottom - Callback to move the profile to the bottom.
 * @param {boolean} props.isFirst - Whether this card is the first in the list.
 * @param {boolean} props.isLast - Whether this card is the last in the list.
 */
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
  // (Removed useConfirmAction for single delete)
  const [tooltipsDisabled, setTooltipsDisabled] = useState(false);
  const [cardDropdownOpen, setCardDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const chartContainerRef = useRef(null);
  const { hasIntersected } = useIntersectionObserver(chartContainerRef, {
    rootMargin: '300px 0px',
  });

  useEffect(() => {
    if (!cardDropdownOpen) return;
    const handleOutsideClick = event => {
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

  const visibilityClass = data.favorite ? 'text-success' : 'text-base-content/60';
  const visibilityIcon = data.favorite ? faEye : faEyeSlash;
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
  const [detailsCollapsed, setDetailsCollapsed] = useState(!data.selected);
  const [hasOpened, setHasOpened] = useState(!!data.selected);

  useEffect(() => {
    if (data.selected) {
      setHasOpened(true);
      setDetailsCollapsed(false);
    }
  }, [data.selected]);

  const onToggleDetails = useCallback(() => {
    setHasOpened(true);
    setDetailsCollapsed(v => !v);
  }, []);

  const handleHeaderClick = useCallback((e) => {
    if (
      e.target.closest('input[type="checkbox"]') ||
      e.target.closest('label') ||
      e.target.closest('[role="group"]') ||
      e.target.closest('.dropdown')
    ) {
      return;
    }
    onToggleDetails();
  }, [onToggleDetails]);

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
    <Card role='listitem' className='profile-card-container col-span-12 [&>.card-body]:p-0 [&>.card-body]:gap-0 overflow-hidden'>
      {/* ── Clickable header row ── */}
      <div
        className='px-5 py-4 flex flex-row items-center gap-3 cursor-pointer select-none transition-colors duration-150 hover:bg-base-content/5'
        onClick={handleHeaderClick}
        role='button'
        tabIndex={0}
        aria-expanded={!detailsCollapsed}
        aria-controls={detailsSectionId}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            if (
              e.target.closest('input[type="checkbox"]') ||
              e.target.closest('label') ||
              e.target.closest('[role="group"]') ||
              e.target.closest('.dropdown')
            ) {
              return;
            }
            e.preventDefault();
            onToggleDetails();
          }
        }}
      >
        <div className='flex items-center shrink-0'>
          <Tooltip content={data.selected ? 'Active' : 'Set active'}>
            <label className='cursor-pointer'>
              <input
                checked={data.selected}
                type='checkbox'
                onClick={() => onSelect(data.id)}
                className='checkbox checkbox-success checkbox-sm'
                aria-label={`Select ${data.label} profile`}
              />
            </label>
          </Tooltip>
        </div>

        {/* Title + Chevron grouped together */}
        <div className='flex-1 min-w-0 flex items-center gap-2'>
          <span
            id={`profile-${data.id}-title`}
            className='min-w-0 truncate text-sm leading-tight font-bold lg:text-xl'
          >
            {data.label}
          </span>
          <FontAwesomeIcon
            icon={faChevronRight}
            className={`profile-card-chevron shrink-0 text-base-content/40 ${detailsCollapsed ? '' : 'expanded'}`}
            aria-hidden='true'
          />
        </div>

        {/* Actions — stop propagation */}
        <div
          className='flex items-center gap-2 shrink-0'
          role='group'
          aria-label={`Actions for ${data.label} profile`}
        >
          {/* Desktop-only: Inline Visibility & Edit actions */}
          <div className='hidden sm:flex flex-row items-center gap-2'>
            <Tooltip content={data.favorite ? 'Hide profile' : 'Make profile visible'}>
              <button
                onClick={onFavoriteToggle}
                disabled={favoriteToggleDisabled}
                className={`btn btn-sm btn-ghost ${favoriteToggleClass}`}
                aria-label={data.favorite ? `Hide ${data.label}` : `Make ${data.label} visible`}
                aria-pressed={data.favorite}
              >
                <FontAwesomeIcon icon={visibilityIcon} className={visibilityClass} />
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
          </div>

          {/* Overflow/Actions Dropdown */}
          <div
            className={`action-dropdown relative ${cardDropdownOpen ? 'action-dropdown-open' : ''}`}
            ref={dropdownRef}
          >
            <button
              onClick={() => setCardDropdownOpen(open => !open)}
              className='btn btn-sm btn-ghost btn-circle'
              aria-label={`Open actions menu for ${data.label} profile`}
              aria-expanded={cardDropdownOpen}
            >
              <FontAwesomeIcon icon={faEllipsisVertical} />
            </button>
            <ul className='menu action-dropdown-menu bg-base-100 rounded-box border-base-content/10 right-0 z-50 mt-1 w-52 border p-2 shadow-lg'>
              {/* Mobile-only actions inside overflow */}
              <li className='sm:hidden'>
                <button
                  onClick={() => { onFavoriteToggle(); closeDropdownMenu(); }}
                  disabled={favoriteToggleDisabled}
                  className={`justify-start ${favoriteToggleClass}`}
                  aria-label={data.favorite ? `Hide ${data.label}` : `Make ${data.label} visible`}
                  aria-pressed={data.favorite}
                >
                  <FontAwesomeIcon icon={visibilityIcon} className={visibilityClass} />
                  <span>{data.favorite ? 'Visible' : 'Hidden'}</span>
                </button>
              </li>
              <li className='sm:hidden'>
                <a
                  href={`/profiles/${data.id}`}
                  onClick={closeDropdownMenu}
                  aria-label={`Edit ${data.label} profile`}
                >
                  <FontAwesomeIcon icon={faPen} />
                  <span>Edit</span>
                </a>
              </li>
              {/* Shared actions */}
              <li>
                <a href={statsHref} onClick={closeDropdownMenu} className='justify-start' aria-label={`View statistics for ${data.label} profile`}>
                  <FontAwesomeIcon icon={faChartSimple} />
                  <span>Statistics</span>
                </a>
              </li>
              <li>
                <button onClick={() => { onDownload(); closeDropdownMenu(); }} className='justify-start' aria-label={`Export ${data.label} profile`}>
                  <FontAwesomeIcon icon={faFileExport} />
                  <span>Export</span>
                </button>
              </li>
              <li>
                <button onClick={() => { onDuplicate(data.id); closeDropdownMenu(); }} className='justify-start' aria-label={`Duplicate ${data.label} profile`}>
                  <FontAwesomeIcon icon={faCopy} />
                  <span>Duplicate</span>
                </button>
              </li>
              <li>
                <HoldToConfirmButton
                  onConfirm={() => { onDelete(data.id); closeDropdownMenu(); }}
                  className='justify-start text-error hover:bg-error/10 active:!bg-transparent active:!text-error'
                  aria-label={`Hold to delete ${data.label} profile`}
                  title='Hold to delete profile'
                  holdDurationMs={2000}
                >
                  <FontAwesomeIcon icon={faTrashCan} />
                  <span>Hold to Delete</span>
                </HoldToConfirmButton>
              </li>
            </ul>
          </div>
        </div>

      </div>

      {/* ── Animated accordion body ── */}
      {!isDragging && (
        <div
          className='profile-card-accordion'
          data-expanded={!detailsCollapsed}
        >
          <div className='overflow-hidden'>
            {hasOpened && (
              <div
                id={detailsSectionId}
                className='profile-card-content px-5 pb-5 flex flex-col gap-3'
              >
                {/* Meta badges */}
                <div className='flex flex-row flex-wrap items-center gap-2'>
                  {data.description && (
                    <span className='text-base-content/60 text-xs md:text-sm w-full'>{data.description}</span>
                  )}
                  <span
                    className={`${typeClass} badge-xs md:badge-sm font-medium`}
                    aria-label={`Profile type: ${typeText}`}
                  >
                    {typeText}
                  </span>
                  <span className='text-base-content/60 badge badge-xs md:badge-sm badge-outline'>
                    <FontAwesomeIcon icon={faTemperatureFull} />
                    {data.temperature}°C
                  </span>
                  <span className='text-base-content/60 badge badge-xs md:badge-sm badge-outline'>
                    <FontAwesomeIcon icon={faClock} />
                    {totalDurationSeconds}s
                  </span>
                  {data.phases.length > 0 &&
                    data.phases[data.phases.length - 1]?.targets?.some(t => t.type === 'volumetric') && (
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

                {/* Chart + reorder controls */}
                <div className='flex flex-row gap-2'>
                  {/* Reorder controls */}
                  <div className='flex flex-col justify-evenly shrink-0'>
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
                    <Tooltip content={disabledDrag ? 'Drag disabled on search result' : 'Drag to reorder'} disabled={isDragging}>
                      <div className={`drag-handle btn btn-sm btn-ghost ${disabledDrag ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}>
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

                  {/* Chart */}
                  <div className='flex-1 min-w-0' ref={chartContainerRef}>
                    {hasIntersected ? (
                      data.type === 'pro' ? (
                        <ExtendedProfileChart data={data} className='h-36 md:h-48 w-full' />
                      ) : (
                        <SimpleContent data={data} />
                      )
                    ) : data.type === 'pro' ? (
                      <div className='skeleton h-36 md:h-48 w-full opacity-30' aria-hidden='true'></div>
                    ) : (
                      <div className='skeleton h-16 w-full opacity-30' aria-hidden='true'></div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
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

/**
 * The main Profile List page component.
 * Displays a sortable list of profiles with mobile search and header actions.
 *
 * @returns {JSX.Element} The rendered Profile List component.
 */
export function ProfileList() {
  const apiService = useContext(ApiServiceContext);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('extraction');
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);
  // (Removed useConfirmAction for delete all)
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
      if (mobileSearchInputRef.current && document.activeElement === mobileSearchInputRef.current) {
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

  const handleSearchTransitionEnd = e => {
    // Ensure we are triggering off the main transform transition and search is active
    if (isMobileSearchActive && e.propertyName === 'transform' && mobileSearchInputRef.current) {
      mobileSearchInputRef.current.focus({ preventScroll: true });
    }
  };

  // Close header dropdown menus when clicking anywhere outside
  useEffect(() => {
    if (!mobileHeaderDropdownOpen && !desktopHeaderDropdownOpen) {
      return;
    }

    const handleOutsideClick = event => {
      if (
        mobileHeaderDropdownOpen &&
        mobileHeaderDropdownRef.current &&
        !mobileHeaderDropdownRef.current.contains(event.target)
      ) {
        setMobileHeaderDropdownOpen(false);
      }
      if (
        desktopHeaderDropdownOpen &&
        desktopHeaderDropdownRef.current &&
        !desktopHeaderDropdownRef.current.contains(event.target)
      ) {
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
          className='justify-start'
          aria-label='Export all profiles'
        >
          <FontAwesomeIcon icon={faFileExport} />
          <span>Export All</span>
        </button>
      </li>
      <li>
        <label
          htmlFor='profileImport'
          className='flex cursor-pointer items-center justify-start gap-2'
          aria-label='Import profiles'
        >
          <FontAwesomeIcon icon={faFileImport} />
          <span>Import Profiles</span>
        </label>
      </li>
      <li>
        <HoldToConfirmButton
          onConfirm={onClear}
          className='justify-start text-error hover:bg-error/10 active:!bg-transparent active:!text-error'
          aria-label='Hold to delete all profiles'
          holdDurationMs={2000}
        >
          <FontAwesomeIcon icon={faTrashCan} />
          <span>Hold to Delete All</span>
        </HoldToConfirmButton>
      </li>
    </>
  );

  // Remove if(loading) spinner check here

  return (
    <>
      <dialog id="new_profile_modal" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box w-11/12 max-w-4xl p-6 sm:p-8">
          <form method="dialog">
            <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
          </form>
          <h3 className="font-bold text-2xl mb-6 text-base-content text-center">Select Profile Type</h3>
          <ProfileTypeSelection onSelect={(type) => {
            document.getElementById('new_profile_modal').close();
            window.location.href = `/profiles/new?type=${type}`;
          }} />
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

    <PageLayout variant='narrow'>
      <div>
        <PageHeader
          title='Profiles'
          noStack={true}
          tabs={hasUtilityProfiles ? (
            <TabBar
              tabs={[
                { id: 'extraction', label: 'Extraction' },
                { id: 'utility', label: 'Utility' }
              ]}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          ) : null}
          actions={
          <div className='flex flex-row items-center gap-3'>
            {/* Mobile-only Action Buttons */}
            <div className='flex flex-row items-center gap-1 sm:hidden'>
              <button
                onClick={() => setIsMobileSearchActive(active => !active)}
                className={`btn btn-ghost btn-circle text-base-content/80 transition-colors ${isMobileSearchActive ? 'text-primary bg-primary/10 duration-75' : 'duration-150'}`}
                aria-label='Toggle search bar'
                aria-expanded={isMobileSearchActive}
              >
                <FontAwesomeIcon icon={faSearch} size='lg' />
              </button>
              <button onClick={() => document.getElementById('new_profile_modal').showModal()} className='btn btn-ghost btn-circle text-primary' aria-label='Create new profile'>
                <FontAwesomeIcon icon={faPlus} size='lg' />
              </button>
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
                  <FontAwesomeIcon icon={faEllipsisVertical} size='lg' />
                </button>
                <ul className='menu action-dropdown-menu bg-base-100 rounded-box border-base-content/10 right-0 z-50 mt-1 w-52 border p-2 shadow-lg'>
                  {dropdownMenuItems}
                </ul>
              </div>
            </div>

            {/* Desktop/Tablet Action Buttons (hidden on mobile) */}
            <div className='hidden flex-row items-center gap-3 sm:flex'>
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
              <button
                onClick={() => document.getElementById('new_profile_modal').showModal()}
                className='btn btn-primary gap-2'
                aria-label='Create new profile'
              >
                <FontAwesomeIcon icon={faPlus} />
                <span>Create Profile</span>
              </button>

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
                <ul className='menu action-dropdown-menu bg-base-100 rounded-box border-base-content/10 right-0 z-50 mt-1 w-52 border p-2 shadow-lg'>
                  {dropdownMenuItems}
                </ul>
              </div>
            </div>
          </div>
        }
      />

      {/* Mobile-only Slide-Down Search Bar (using nested sticky structure to bypass WebKit transform bugs) */}
      <div
        className={`search-slide-sticky sm:hidden ${isMobileSearchActive ? 'search-slide-sticky-active' : ''}`}
      >
        <div className='search-slide-container' onTransitionEnd={handleSearchTransitionEnd}>
          <div className='bg-base-300 border-b border-base-content/8 mx-[-16px] flex flex-row items-center gap-3 px-4 py-2'>
            <label className='input bg-base-100 border-base-content/10 flex grow items-center border'>
              <FontAwesomeIcon icon={faSearch} className='text-base-content/60 mr-2' />
              <input
                type='text'
                placeholder='Search profiles...'
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className='w-full grow'
                ref={mobileSearchInputRef}
              />
            </label>
            <button
              className='text-base-content/70 hover:text-base-content font-medium whitespace-nowrap transition-colors'
              onClick={() => setIsMobileSearchActive(false)}
            >
              Cancel
            </button>
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
      </div>
      <div className={`profiles-list-content ${isMobileSearchActive ? 'search-active' : ''}`}>
        <ProgressiveContent isLoading={loading} skeleton={ProfileListSkeleton}>
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
        </ProgressiveContent>
      </div>
    </PageLayout>
    </>
  );
}
