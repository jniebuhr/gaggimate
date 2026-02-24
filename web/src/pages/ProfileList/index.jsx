import { faAnglesDown } from '@fortawesome/free-solid-svg-icons/faAnglesDown';
import { faAnglesUp } from '@fortawesome/free-solid-svg-icons/faAnglesUp';
import { faArrowDown } from '@fortawesome/free-solid-svg-icons/faArrowDown';
import { faArrowUp } from '@fortawesome/free-solid-svg-icons/faArrowUp';
import { faChevronRight } from '@fortawesome/free-solid-svg-icons/faChevronRight';
import { faClock } from '@fortawesome/free-solid-svg-icons/faClock';
import { faCopy } from '@fortawesome/free-solid-svg-icons/faCopy';
import { faEllipsisVertical } from '@fortawesome/free-solid-svg-icons/faEllipsisVertical';
import { faFileExport } from '@fortawesome/free-solid-svg-icons/faFileExport';
import { faFileImport } from '@fortawesome/free-solid-svg-icons/faFileImport';
import { faPen } from '@fortawesome/free-solid-svg-icons/faPen';
import { faScaleBalanced } from '@fortawesome/free-solid-svg-icons/faScaleBalanced';
import { faSearch } from '@fortawesome/free-solid-svg-icons/faSearch';
import { faStar } from '@fortawesome/free-solid-svg-icons/faStar';
import { faTemperatureFull } from '@fortawesome/free-solid-svg-icons/faTemperatureFull';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons/faTrashCan';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { computed } from '@preact/signals';
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
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import Card from '../../components/Card.jsx';
import { ConfirmButton } from '../../components/ConfirmButton.jsx';
import { ExtendedProfileChart } from '../../components/ExtendedProfileChart.jsx';
import { Spinner } from '../../components/Spinner.jsx';
import { Tooltip } from '../../components/Tooltip.jsx';
import { useConfirmAction } from '../../hooks/useConfirmAction.js';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
import { downloadJson } from '../../utils/download.js';
import { ProfileAddCard } from './ProfileAddCard.jsx';
import { parseProfile } from './utils.js';

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
  onMoveUp,
  onMoveToTop,
  onMoveDown,
  onMoveToBottom,
  isFirst,
  isLast,
}) {
  const { armed: confirmDelete, armOrRun: confirmOrDelete } = useConfirmAction(4000);
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

  // Toggle profile details
  const [detailsCollapsed, setDetailsCollapsed] = useState(true);
  const onToggleDetails = useCallback(() => setDetailsCollapsed(v => !v), []);
  const chevronRotation = detailsCollapsed ? '' : 'rotate-90';
  const detailsSectionId = `profile-${data.id}-summary`;

  // Sum total duration from phases (in seconds)
  const totalDurationSeconds = Array.isArray(data?.phases)
    ? data.phases.reduce((sum, p) => sum + (Number.isFinite(p?.duration) ? p.duration : 0), 0)
    : 0;

  // Popover (mobile actions) state and positioning
  const kebabRef = useRef(null);
  const popoverRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const positionPopover = useCallback(() => {
    const btn = kebabRef.current;
    const pop = popoverRef.current;
    if (!btn || !pop) return;
    const rect = btn.getBoundingClientRect();
    // Ensure width is measured: temporarily show if needed
    if (!pop.matches(':popover-open')) {
      try {
        pop.showPopover();
      } catch (_) {}
    }
    // Measure size
    const w = pop.offsetWidth || 224; // ~w-56
    const h = pop.offsetHeight || 0;
    // Preferred to the right-end of button, below it
    const gap = 6;
    let top = rect.bottom + gap;
    let left = rect.right - w; // right align
    // Clamp within viewport with small margin
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

  const closeMenu = useCallback(() => {
    const pop = popoverRef.current;
    if (pop && pop.matches(':popover-open')) {
      try {
        pop.hidePopover();
      } catch (_) {}
    }
    setMenuOpen(false);
  }, []);

  const toggleMenu = useCallback(
    e => {
      e?.preventDefault?.();
      const pop = popoverRef.current;
      if (!pop) return;
      if (pop.matches(':popover-open')) {
        closeMenu();
      } else {
        positionPopover();
        try {
          pop.showPopover();
          setMenuOpen(true);
        } catch (_) {}
      }
    },
    [closeMenu, positionPopover],
  );

  useEffect(() => {
    const pop = popoverRef.current;
    if (!pop) return;

    const onToggle = () => {
      const isOpen = pop.matches(':popover-open');
      setMenuOpen(isOpen);
      if (isOpen) positionPopover();
    };

    const onResize = () => {
      if (pop.matches(':popover-open')) positionPopover();
    };

    pop.addEventListener('toggle', onToggle);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);

    return () => {
      pop.removeEventListener('toggle', onToggle);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [positionPopover]);

  return (
    <Card sm={12} role='listitem'>
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
                  <div
                    id={`profile-${data.id}-menu`}
                    ref={popoverRef}
                    popover='auto'
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
                  data.phases.at(-1)?.targets?.some(target => target.type === 'volumetric') && (
                    <span className='text-base-content/60 badge badge-xs md:badge-sm badge-outline'>
                      <FontAwesomeIcon icon={faScaleBalanced} />
                      {`${data.phases.at(-1).targets.find(target => target.type === 'volumetric').value}g`}
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
            <div className='flex flex-col justify-evenly'>
              <Tooltip content='Move to top'>
                <button
                  onClick={() => onMoveToTop(data.id)}
                  disabled={isFirst}
                  className='btn btn-xs btn-ghost'
                  aria-label={`Move ${data.label} to top`}
                  aria-disabled={isFirst}
                >
                  <FontAwesomeIcon icon={faAnglesUp} />
                </button>
              </Tooltip>
              <Tooltip content='Move up'>
                <button
                  onClick={() => onMoveUp(data.id)}
                  disabled={isFirst}
                  className='btn btn-xs btn-ghost'
                  aria-label={`Move ${data.label} up`}
                  aria-disabled={isFirst}
                >
                  <FontAwesomeIcon icon={faArrowUp} />
                </button>
              </Tooltip>
              <Tooltip content='Move down'>
                <button
                  onClick={() => onMoveDown(data.id)}
                  disabled={isLast}
                  className='btn btn-xs btn-ghost'
                  aria-label={`Move ${data.label} down`}
                  aria-disabled={isLast}
                >
                  <FontAwesomeIcon icon={faArrowDown} />
                </button>
              </Tooltip>
              <Tooltip content='Move to bottom'>
                <button
                  onClick={() => onMoveToBottom(data.id)}
                  disabled={isLast}
                  className='btn btn-xs btn-ghost'
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

  const moveProfileUp = useCallback(
    id => {
      setProfiles(prev => {
        const idx = prev.findIndex(p => p.id === id);
        if (idx > 0) {
          const next = [...prev];
          [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
          persistProfileOrder(next);
          return next;
        }
        return prev;
      });
    },
    [persistProfileOrder],
  );

  const moveProfileToTop = useCallback(
    id => {
      setProfiles(prev => {
        const idx = prev.findIndex(p => p.id === id);
        if (idx > 0) {
          const next = [...prev];
          const [movedItem] = next.splice(idx, 1);
          next.unshift(movedItem);
          persistProfileOrder(next);
          return next;
        }
        return prev;
      });
    },
    [persistProfileOrder],
  );

  const moveProfileDown = useCallback(
    id => {
      setProfiles(prev => {
        const idx = prev.findIndex(p => p.id === id);
        if (idx !== -1 && idx < prev.length - 1) {
          const next = [...prev];
          [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
          persistProfileOrder(next);
          return next;
        }
        return prev;
      });
    },
    [persistProfileOrder],
  );

  const moveProfileToBottom = useCallback(
    id => {
      setProfiles(prev => {
        const idx = prev.findIndex(p => p.id === id);
        if (idx !== -1 && idx < prev.length - 1) {
          const next = [...prev];
          const [movedItem] = next.splice(idx, 1);
          next.push(movedItem);
          persistProfileOrder(next);
          return next;
        }
        return prev;
      });
    },
    [persistProfileOrder],
  );

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
          const profiles = parseProfile(result);
          for (const p of profiles) {
            await apiService.request({ tp: 'req:profiles:save', profile: p });
          }
          await loadProfiles();
        }
      };
      reader.readAsText(file);
    }
  };

  const onClear = useCallback(async () => {
    for (const p of profiles) {
      if (!p.selected) {
        await apiService.request({ tp: 'req:profiles:delete', id: p.id });
      }
      await loadProfiles();
    }
  }, [profiles, apiService]);

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
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-12' role='list' aria-label='Profile list'>
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
              onMoveUp={moveProfileUp}
              onMoveDown={moveProfileDown}
              onMoveToTop={moveProfileToTop}
              onMoveToBottom={moveProfileToBottom}
              isFirst={idx === 0}
              isLast={idx === filtered.length - 1}
            />
          ))}
      </div>
    </>
  );
}
