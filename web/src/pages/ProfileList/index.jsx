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
import { ProfileAddCard } from './ProfileAddCard.jsx';
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
import { ConfirmButton } from '../../components/ConfirmButton.jsx';
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

  const phases = Array.isArray(data?.phases) ? data.phases : [];

  // Sum total duration from phases (in seconds)
  const totalDurationSeconds = phases.reduce(
    (sum, p) => sum + (Number.isFinite(p?.duration) ? p.duration : 0),
    0,
  );

  // Mobile actions menu — state-driven (was using the Popover API which isn't
  // supported in Safari <17 / Firefox <125, leaving the menu broken on most
  // iPads and many phones).
  const kebabRef = useRef(null);
  const popoverRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const positionPopover = useCallback(() => {
    const btn = kebabRef.current;
    const pop = popoverRef.current;
    if (!btn || !pop) return;
    const rect = btn.getBoundingClientRect();
    const w = pop.offsetWidth || 224; // ~w-56
    const h = pop.offsetHeight || 0;
    const gap = 6;
    let top = rect.bottom + gap;
    let left = rect.right - w; // right-aligned to the button
    const margin = 8;
    if (left < margin) left = margin;
    const maxLeft = window.innerWidth - w - margin;
    if (left > maxLeft) left = maxLeft;
    const maxTop = window.innerHeight - h - margin;
    if (top > maxTop) top = Math.max(margin, rect.top - h - gap);
    pop.style.position = 'fixed';
    pop.style.inset = 'auto auto auto auto';
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  }, []);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const toggleMenu = useCallback(e => {
    e?.preventDefault?.();
    setMenuOpen(v => !v);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    // Position now (DOM is mounted because the conditional render put the div
    // in the tree this tick) and then re-position on resize/scroll.
    positionPopover();
    const onResize = () => positionPopover();
    const onDocClick = e => {
      const pop = popoverRef.current;
      const btn = kebabRef.current;
      if (!pop || !btn) return;
      if (pop.contains(e.target) || btn.contains(e.target)) return;
      setMenuOpen(false);
    };
    const onKey = e => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('touchstart', onDocClick, { passive: true });
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('touchstart', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen, positionPopover]);

  return (
    <Card sm={12} role='listitem' className='profile-card-container mb-2'>
      <div
        className='flex flex-row items-center'
        role='group'
        aria-labelledby={`profile-${data.id}-title`}
      >
        <div className='flex flex-grow flex-col overflow-hidden'>
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
                {/* Mobile: Popover actions menu */}
                <div>
                  <button
                    ref={kebabRef}
                    onClick={toggleMenu}
                    className='btn btn-sm btn-ghost sm:hidden'
                    aria-label={`Open actions menu for ${data.label} profile`}
                    aria-haspopup='menu'
                    aria-expanded={menuOpen}
                    aria-controls={`profile-${data.id}-menu`}
                  >
                    <FontAwesomeIcon icon={faEllipsisVertical} />
                  </button>
                  {menuOpen && (
                    <div
                      id={`profile-${data.id}-menu`}
                      ref={popoverRef}
                      role='menu'
                      className='bg-base-100 rounded-box z-50 w-56 p-2 shadow'
                      onKeyDown={e => {
                        if (e.key === 'Escape') closeMenu();
                      }}
                    >
                      <ul className='menu' role='none'>
                        <li role='none'>
                          <button
                            role='menuitem'
                            onClick={() => {
                              onFavoriteToggle();
                              closeMenu();
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
                        <li role='none'>
                          <a
                            role='menuitem'
                            href={`/profiles/${data.id}`}
                            onClick={closeMenu}
                            aria-label={`Edit ${data.label} profile`}
                          >
                            <FontAwesomeIcon icon={faPen} />
                            <span>Edit</span>
                          </a>
                        </li>
                        <li role='none'>
                          <a
                            role='menuitem'
                            href={statsHref}
                            onClick={closeMenu}
                            className='text-success justify-start'
                            aria-label={`View statistics for ${data.label} profile`}
                          >
                            <FontAwesomeIcon icon={faChartSimple} />
                            <span>Statistics</span>
                          </a>
                        </li>
                        <li role='none'>
                          <button
                            role='menuitem'
                            onClick={() => {
                              onDownload();
                              closeMenu();
                            }}
                            className='text-primary justify-start'
                            aria-label={`Export ${data.label} profile`}
                          >
                            <FontAwesomeIcon icon={faFileExport} />
                            <span>Export</span>
                          </button>
                        </li>
                        <li role='none'>
                          <button
                            role='menuitem'
                            onClick={() => {
                              onDuplicate(data.id);
                              closeMenu();
                            }}
                            className='text-success justify-start'
                            aria-label={`Duplicate ${data.label} profile`}
                          >
                            <FontAwesomeIcon icon={faCopy} />
                            <span>Duplicate</span>
                          </button>
                        </li>
                        <li role='none'>
                          <button
                            role='menuitem'
                            onClick={() => {
                              confirmOrDelete(() => {
                                onDelete(data.id);
                                closeMenu();
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
                  )}
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
                  {phases.length > 0 &&
                    phases[phases.length - 1]?.targets?.some(t => t.type === 'volumetric') && (
                      <span className='text-base-content/60 badge badge-xs md:badge-sm badge-outline'>
                        <FontAwesomeIcon icon={faScaleBalanced} />
                        {`${phases[phases.length - 1].targets.find(t => t.type === 'volumetric').value}g`}
                      </span>
                    )}
                  {phases.length > 0 && (
                    <span className='text-base-content/60 badge badge-xs md:badge-sm badge-outline'>
                      {phases.length} phase{phases.length === 1 ? '' : 's'}
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
                  <ExtendedProfileChart data={{ ...data, phases }} className='max-h-36' />
                ) : (
                  <SimpleContent phases={phases} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function SimpleContent({ phases }) {
  if (phases.length === 0) {
    return <div className='text-base-content/60 text-sm'>No phases</div>;
  }

  return (
    <div className='flex flex-row items-center gap-2' role='list' aria-label='Brew phases'>
      {phases.map((phase, i) => (
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
    <>
      <div className='mb-4 flex flex-row items-center gap-2'>
        <h1 className='flex-grow text-2xl font-bold sm:text-3xl'>Profiles</h1>
      </div>

      <div className='mb-4 flex flex-col items-center gap-2 sm:flex-row'>
        {/* Controls Row */}
        <div className='flex flex-col items-start gap-3 sm:flex-row sm:items-center'>
          {/* Search */}
          <label className='input w-full'>
            <FontAwesomeIcon icon={faSearch} />
            <input
              type='text'
              placeholder='Search...'
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
              }}
              className='grow'
            />
          </label>
        </div>
        <div className='flex flex-grow items-center justify-end gap-2'>
          <Tooltip content='Export all profiles'>
            <button
              id='export-profiles'
              onClick={onExport}
              className='btn btn-ghost btn-sm'
              aria-label='Export all profiles'
            >
              <FontAwesomeIcon icon={faFileExport} />
            </button>
          </Tooltip>
          <Tooltip content='Import profiles'>
            <label
              htmlFor='profileImport'
              className='btn btn-ghost btn-sm cursor-pointer'
              aria-label='Import profiles'
            >
              <FontAwesomeIcon icon={faFileImport} />
            </label>
          </Tooltip>
          <input
            onChange={onUpload}
            className='hidden'
            id='profileImport'
            type='file'
            accept='.json,application/json,.tcl'
            aria-label='Select a JSON file containing profile data to import'
          />
          <ConfirmButton
            onAction={onClear}
            icon={faTrashCan}
            tooltip='Delete all profiles'
            confirmTooltip='Confirm deletion'
          />
        </div>
      </div>
      <div className='mb-4' aria-label='Add profile'>
        <ProfileAddCard />
      </div>
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
    </>
  );
}
