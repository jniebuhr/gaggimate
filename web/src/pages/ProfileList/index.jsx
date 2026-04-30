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
import { downloadJson, prepareDownload } from '../../utils/download.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowUp } from '@fortawesome/free-solid-svg-icons/faArrowUp';
import { faArrowDown } from '@fortawesome/free-solid-svg-icons/faArrowDown';
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
import { buildStatisticsProfileHref } from '../Statistics/utils/statisticsRoute.js';
import { BeanSelectionModal } from './BeanSelectionModal.jsx';
import {
  clearCurrentBeanSelection,
  getLastBeanSelectionForProfile,
  listBeans,
  migrateLegacyBeansToDevice,
  recordBeanSelection,
} from '../../utils/beanManager.js';

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
  onMoveDown,
  isFirst,
  isLast,
}) {
  const { armed: confirmDelete, armOrRun: confirmOrDelete } = useConfirmAction(4000);
  const bookmarkClass = data.favorite ? 'text-[var(--color-warning,#d4a843)]' : 'text-[var(--text-disabled,#666)]';
  const typeText = data.type === 'pro' ? 'Pro' : 'Simple';
  const favoriteToggleDisabled = data.favorite ? unfavoriteDisabled : favoriteDisabled;
  const favoriteToggleClass = favoriteToggleDisabled ? 'opacity-40 cursor-not-allowed' : '';

  const onFavoriteToggle = useCallback(() => {
    if (data.favorite && !unfavoriteDisabled) onUnfavorite(data.id);
    else if (!data.favorite && !favoriteDisabled) onFavorite(data.id);
  }, [data.favorite, unfavoriteDisabled, favoriteDisabled, onUnfavorite, onFavorite, data.id]);

  const onDownload = useCallback(() => {
    const { id, selected, favorite, ...profileData } = data;
    const filename = `profile-${data.id}.json`;
    const prepared = prepareDownload(filename);

    if (!prepared.targetWindow) {
      console.error('Failed to create download window - popup blocker may be active');
      alert('Download failed: Please allow popups for this site and try again.');
      return;
    }

    downloadJson(profileData, filename, prepared);
  }, [data]);
  const statsHref = buildStatisticsProfileHref({ source: 'gaggimate', profileName: data.label });

  const [detailsCollapsed, setDetailsCollapsed] = useState(true);
  const onToggleDetails = useCallback(() => setDetailsCollapsed(v => !v), []);
  const chevronRotation = detailsCollapsed ? '' : 'rotate-90';
  const detailsSectionId = `profile-${data.id}-summary`;

  const totalDurationSeconds = Array.isArray(data?.phases)
    ? data.phases.reduce((sum, p) => sum + (Number.isFinite(p?.duration) ? p.duration : 0), 0)
    : 0;

  const kebabRef = useRef(null);
  const popoverRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const positionPopover = useCallback(() => {
    const btn = kebabRef.current;
    const pop = popoverRef.current;
    if (!btn || !pop) return;
    const rect = btn.getBoundingClientRect();
    if (!pop.matches(':popover-open')) {
      try { pop.showPopover(); } catch (_) {}
    }
    const w = pop.offsetWidth || 224;
    const h = pop.offsetHeight || 0;
    const gap = 6;
    let top = rect.bottom + gap;
    let left = rect.right - w;
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
      try { pop.hidePopover(); } catch (_) {}
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
        try { pop.showPopover(); setMenuOpen(true); } catch (_) {}
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
      <div className='flex flex-row items-center' role='group' aria-labelledby={`profile-${data.id}-title`}>
        <div className='flex flex-grow flex-col overflow-hidden'>
          <div className='flex flex-row items-center gap-4'>
            {/* Checkbox */}
            <label className='cursor-pointer'>
              <input
                checked={data.selected}
                type='checkbox'
                onClick={() => onSelect(data.id)}
                className='nd-checkbox'
                aria-label={`Select ${data.label} profile`}
              />
            </label>

            {/* Label */}
            <div className='flex-1 min-w-0'>
              <span
                id={`profile-${data.id}-title`}
                className='font-nd-mono text-[16px] text-[var(--text-primary,#e8e8e8)] truncate block'
              >
                {data.label}
              </span>
              <div className='flex items-center gap-2 mt-1'>
                <span
                  className='font-nd-mono text-[11px] text-[var(--text-secondary,#999)] uppercase tracking-[0.08em]'
                  aria-label={`Profile type: ${typeText}`}
                >
                  {typeText}
                </span>
                <button
                  onClick={onToggleDetails}
                  className='nd-action-btn'
                  style={{ width: '24px', height: '24px' }}
                  aria-label={`${detailsCollapsed ? 'Show' : 'Hide'} details for ${data.label}`}
                  aria-expanded={!detailsCollapsed}
                  aria-controls={detailsSectionId}
                >
                  <FontAwesomeIcon icon={faChevronRight} className={`text-[10px] transition-transform ${chevronRotation}`} />
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className='flex items-center gap-2'>
              {/* Mobile: Popover */}
              <div className='sm:hidden'>
                <button
                  ref={kebabRef}
                  onClick={toggleMenu}
                  className='nd-action-btn'
                  style={{ width: '36px', height: '36px' }}
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
                  className='bg-[var(--home-surface,#111)] rounded-lg z-50 w-56 p-2 border border-[var(--home-border,#222)]'
                  onKeyDown={e => { if (e.key === 'Escape') closeMenu(); }}
                >
                  <ul className='space-y-1'>
                    <li>
                      <button
                        onClick={() => { onFavoriteToggle(); closeMenu(); }}
                        disabled={favoriteToggleDisabled}
                        className={`w-full text-left font-nd-mono text-[13px] px-3 py-2 rounded flex items-center gap-2 ${favoriteToggleDisabled ? 'opacity-40' : 'hover:bg-[rgba(255,255,255,0.04)]'}`}
                        aria-pressed={data.favorite}
                      >
                        <FontAwesomeIcon icon={faStar} className={bookmarkClass} />
                        {data.favorite ? 'Unfavorite' : 'Favorite'}
                      </button>
                    </li>
                    <li>
                      <a
                        href={`/profiles/${data.id}`}
                        onClick={closeMenu}
                        className='block font-nd-mono text-[13px] px-3 py-2 rounded hover:bg-[rgba(255,255,255,0.04)]'
                      >
                        <FontAwesomeIcon icon={faPen} className='mr-2' />
                        Edit
                      </a>
                    </li>
                    <li>
                      <a
                        href={statsHref}
                        onClick={closeMenu}
                        className='block font-nd-mono text-[13px] px-3 py-2 rounded hover:bg-[rgba(255,255,255,0.04)]'
                      >
                        <FontAwesomeIcon icon={faChartSimple} className='mr-2' />
                        Statistics
                      </a>
                    </li>
                    <li>
                      <button
                        onClick={() => { onDownload(); closeMenu(); }}
                        className='w-full text-left font-nd-mono text-[13px] px-3 py-2 rounded hover:bg-[rgba(255,255,255,0.04)]'
                      >
                        <FontAwesomeIcon icon={faFileExport} className='mr-2' />
                        Export
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => { onDuplicate(data.id); closeMenu(); }}
                        className='w-full text-left font-nd-mono text-[13px] px-3 py-2 rounded hover:bg-[rgba(255,255,255,0.04)]'
                      >
                        <FontAwesomeIcon icon={faCopy} className='mr-2' />
                        Duplicate
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => { confirmOrDelete(() => { onDelete(data.id); closeMenu(); }); }}
                        className={`w-full text-left font-nd-mono text-[13px] px-3 py-2 rounded ${confirmDelete ? 'bg-[var(--color-error,#d71921)] text-white' : 'hover:bg-[rgba(255,255,255,0.04)]'}`}
                      >
                        <FontAwesomeIcon icon={faTrashCan} className='mr-2' />
                        {confirmDelete ? 'Confirm' : 'Delete'}
                      </button>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Desktop: inline actions */}
              <div className='hidden sm:flex items-center gap-2'>
                <button
                  onClick={onFavoriteToggle}
                  disabled={favoriteToggleDisabled}
                  className='nd-action-btn'
                  style={{ width: '36px', height: '36px' }}
                  aria-label={data.favorite ? 'Remove from favorites' : 'Add to favorites'}
                  aria-pressed={data.favorite}
                >
                  <FontAwesomeIcon icon={faStar} className={bookmarkClass} />
                </button>
                <a
                  href={`/profiles/${data.id}`}
                  className='nd-action-btn'
                  style={{ width: '36px', height: '36px' }}
                  aria-label='Edit profile'
                >
                  <FontAwesomeIcon icon={faPen} />
                </a>
                <a
                  href={statsHref}
                  className='nd-action-btn'
                  style={{ width: '36px', height: '36px' }}
                  aria-label='View statistics'
                >
                  <FontAwesomeIcon icon={faChartSimple} />
                </a>
                <button
                  onClick={onDownload}
                  className='nd-action-btn'
                  style={{ width: '36px', height: '36px' }}
                  aria-label='Export profile'
                >
                  <FontAwesomeIcon icon={faFileExport} />
                </button>
                <button
                  onClick={() => onDuplicate(data.id)}
                  className='nd-action-btn'
                  style={{ width: '36px', height: '36px' }}
                  aria-label='Duplicate profile'
                >
                  <FontAwesomeIcon icon={faCopy} />
                </button>
                <button
                  onClick={() => { confirmOrDelete(() => onDelete(data.id)); }}
                  className='nd-action-btn'
                  style={{ width: '36px', height: '36px' }}
                  aria-label={confirmDelete ? 'Confirm delete' : 'Delete profile'}
                >
                  <FontAwesomeIcon icon={faTrashCan} className={confirmDelete ? 'text-[var(--color-error,#d71921)]' : ''} />
                </button>
              </div>
            </div>
          </div>

          {/* Details section */}
          {!detailsCollapsed && (
            <div id={detailsSectionId} className='mt-3 pt-3 border-t border-[var(--home-border,#222)]'>
              <div className='font-nd-mono text-[13px] text-[var(--text-disabled,#666)] mb-2'>
                {data.description}
              </div>
              <div className='flex flex-wrap gap-3'>
                <span className='font-nd-mono text-[11px] text-[var(--text-secondary,#999)] flex items-center gap-1'>
                  <FontAwesomeIcon icon={faTemperatureFull} className='text-[10px]' />
                  {data.temperature}°C
                </span>
                <span className='font-nd-mono text-[11px] text-[var(--text-secondary,#999)] flex items-center gap-1'>
                  <FontAwesomeIcon icon={faClock} className='text-[10px]' />
                  {totalDurationSeconds}s
                </span>
                {data.phases.length > 0 &&
                  data.phases.at(-1)?.targets?.some(target => target.type === 'volumetric') && (
                    <span className='font-nd-mono text-[11px] text-[var(--text-secondary,#999)] flex items-center gap-1'>
                      <FontAwesomeIcon icon={faScaleBalanced} className='text-[10px]' />
                      {`${data.phases.at(-1).targets.find(target => target.type === 'volumetric').value}g`}
                    </span>
                  )}
                {data.phases.length > 0 && (
                  <span className='font-nd-mono text-[11px] text-[var(--text-secondary,#999)]'>
                    {data.phases.length} phase{data.phases.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Chart row */}
          <div className='flex items-center gap-2 mt-3 pt-3 border-t border-[var(--home-border,#222)]'>
            <div className='flex flex-col gap-1'>
              <button
                onClick={() => onMoveUp(data.id)}
                disabled={isFirst}
                className='nd-action-btn'
                style={{ width: '28px', height: '28px' }}
                aria-label={`Move ${data.label} up`}
              >
                <FontAwesomeIcon icon={faArrowUp} className='text-[10px]' />
              </button>
              <button
                onClick={() => onMoveDown(data.id)}
                disabled={isLast}
                className='nd-action-btn'
                style={{ width: '28px', height: '28px' }}
                aria-label={`Move ${data.label} down`}
              >
                <FontAwesomeIcon icon={faArrowDown} className='text-[10px]' />
              </button>
            </div>
            <div className='flex-1 min-w-0'>
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
    <div className='flex flex-row items-center gap-2 overflow-x-auto' role='list' aria-label='Brew phases'>
      {data.phases.map((phase, i) => (
        <div key={i} className='flex flex-row items-center gap-2' role='listitem'>
          {i > 0 && <FontAwesomeIcon icon={faChevronRight} className='text-[var(--text-disabled,#666)] text-[10px]' />}
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

function SimpleStep({ phase, type, duration, targets }) {
  return (
    <div className='nd-card p-3 min-w-[80px]'>
      <div className='font-nd-mono text-[11px] text-[var(--text-primary,#e8e8e8)] uppercase tracking-[0.06em]'>
        {PhaseLabels[phase] || phase}
      </div>
      <div className='font-nd-mono text-[10px] text-[var(--text-disabled,#666)] mt-0.5'>
        {type}
      </div>
      <div className='font-nd-mono text-[10px] text-[var(--text-secondary,#999)] mt-1'>
        {targets.length === 0 && <span>{duration}s</span>}
        {targets.map((t, i) => (
          <span key={i}>Exit {t.value}{t.type === 'volumetric' ? 'g' : ''}</span>
        ))}
      </div>
    </div>
  );
}

export function ProfileList() {
  const apiService = useContext(ApiServiceContext);
  const [profiles, setProfiles] = useState([]);
  const [beans, setBeans] = useState([]);
  const [beanSelectionProfile, setBeanSelectionProfile] = useState(null);
  const [selectedBeanId, setSelectedBeanId] = useState('');
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

  useEffect(() => {
    let cancelled = false;

    const loadBeans = async () => {
      try {
        await migrateLegacyBeansToDevice(apiService);
        const loadedBeans = await listBeans(apiService);
        if (!cancelled) {
          setBeans(loadedBeans.filter(bean => !bean.archived));
        }
      } catch (error) {
        console.error('Failed to load beans:', error);
      }
    };

    loadBeans();

    const handleBeansChanged = () => {
      loadBeans();
    };

    window.addEventListener('beans-library-changed', handleBeansChanged);
    return () => {
      cancelled = true;
      window.removeEventListener('beans-library-changed', handleBeansChanged);
    };
  }, [apiService]);

  const loadProfiles = async () => {
    const response = await apiService.request({ tp: 'req:profiles:list' });
    setProfiles(response.profiles);
    setLoading(false);
  };

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
        } catch (e) {}
      }, 300);
    },
    [apiService],
  );

  useEffect(() => {
    return () => {
      if (orderDebounceRef.current) {
        clearTimeout(orderDebounceRef.current);
        if (pendingOrderRef.current) {
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

  useEffect(() => {
    const loadData = async () => {
      if (connected.value) {
        await loadProfiles();
      }
    };
    loadData();
  }, []);

  const onDelete = useCallback(
    async id => {
      setLoading(true);
      await apiService.request({ tp: 'req:profiles:delete', id });
      await loadProfiles();
    },
    [apiService],
  );

  const onFavorite = useCallback(
    async id => {
      setLoading(true);
      await apiService.request({ tp: 'req:profiles:favorite', id });
      await loadProfiles();
    },
    [apiService],
  );

  const onUnfavorite = useCallback(
    async id => {
      setLoading(true);
      await apiService.request({ tp: 'req:profiles:unfavorite', id });
      await loadProfiles();
    },
    [apiService],
  );

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
    [apiService, profiles],
  );

  const onExport = useCallback(() => {
    const exportedProfiles = profiles.map(p => {
      const ep = { ...p };
      delete ep.id;
      delete ep.selected;
      delete ep.favorite;
      return ep;
    });

    const download = prepareDownload('profiles.json');
    try {
      downloadJson(exportedProfiles, 'profiles.json', download);
    } catch (error) {
      download.fail(error);
      console.error('Failed to export profiles:', error);
      alert(`Profile export failed: ${error.message}`);
    }
  }, [profiles]);

  const completeProfileSelect = useCallback(
    async (profile, beanId = '') => {
      if (!profile) return;

      setLoading(true);
      await apiService.request({ tp: 'req:profiles:select', id: profile.id });

      let selectedBeanName = '';
      if (beanId) {
        const selectedBean = (await listBeans(apiService)).find(bean => bean.id === beanId);
        if (selectedBean) {
          selectedBeanName = selectedBean.name;
          recordBeanSelection({
            profileId: profile.id,
            profileLabel: profile.label,
            bean: selectedBean,
          });
        }
      } else {
        clearCurrentBeanSelection();
      }

      apiService.send({ tp: 'req:beans:select', name: selectedBeanName });

      await loadProfiles();
      setBeanSelectionProfile(null);
      setSelectedBeanId('');
    },
    [apiService],
  );

  const onSelect = useCallback(
    async id => {
      const profile = profiles.find(entry => entry.id === id);
      if (!profile) return;

      const availableBeans = (await listBeans(apiService)).filter(bean => !bean.archived);
      setBeans(availableBeans);

      if (availableBeans.length === 0) {
        await completeProfileSelect(profile);
        return;
      }

      const lastBeanSelection = getLastBeanSelectionForProfile(profile);
      setSelectedBeanId(lastBeanSelection?.beanId || availableBeans[0]?.id || '');
      setBeanSelectionProfile(profile);
    },
    [apiService, profiles, completeProfileSelect],
  );

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
          } catch {}
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

  const profilesToShow = useMemo(() => {
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
      <div className='flex w-full flex-row items-center justify-center py-16'>
        <Spinner size={8} />
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-6'>
      {/* Header */}
      <div className='flex items-center justify-between gap-4'>
        <h1 className='font-nd-mono text-[20px] uppercase tracking-[0.08em] text-[var(--text-secondary,#999)]'>
          Profiles
        </h1>
        <div className='flex items-center gap-2'>
          <button
            onClick={onExport}
            className='nd-action-btn'
            disabled={profiles.length === 0}
            title='Export Profiles'
          >
            <FontAwesomeIcon icon={faFileExport} />
          </button>
          <label className='nd-action-btn cursor-pointer' title='Import Profiles'>
            <FontAwesomeIcon icon={faFileImport} />
          </label>
          <input
            onChange={onUpload}
            className='hidden'
            id='profileImport'
            type='file'
            accept='.json,application/json'
          />
          <ConfirmButton
            onAction={onClear}
            icon={faTrashCan}
            tooltip='Delete all profiles'
            confirmTooltip='Confirm deletion'
          />
        </div>
      </div>

      {/* Search + tabs */}
      <Card sm={12} title='Profiles'>
        <div className='flex flex-col gap-4 mb-5'>
          {/* Search */}
          <div className='flex'>
            <input
              type='text'
              placeholder='Search profiles...'
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className='nd-input flex-1 rounded-r-none border-r-0'
            />
            <span className='nd-input-unit'>
              <FontAwesomeIcon icon={faSearch} className='text-[var(--text-disabled,#666)]' />
            </span>
          </div>

          {/* Tabs */}
          {hasUtilityProfiles && (
            <div className='nd-segmented'>
              <button
                className={`nd-segmented-btn ${activeTab === 'extraction' ? 'nd-segmented-btn--active' : ''}`}
                onClick={() => setActiveTab('extraction')}
              >
                Extraction
              </button>
              <button
                className={`nd-segmented-btn ${activeTab === 'utility' ? 'nd-segmented-btn--active' : ''}`}
                onClick={() => setActiveTab('utility')}
              >
                Utility
              </button>
            </div>
          )}
        </div>

        {/* Add profile */}
        <div className='mb-4'>
          <ProfileAddCard />
        </div>

        {/* Profile list */}
        <div className='flex flex-col gap-3' role='list' aria-label='Profile list'>
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
                isFirst={idx === 0}
                isLast={idx === filtered.length - 1}
              />
            ))}
        </div>
      </Card>

      <BeanSelectionModal
        open={!!beanSelectionProfile}
        profile={beanSelectionProfile}
        beans={beans}
        selectedBeanId={selectedBeanId}
        onBeanChange={setSelectedBeanId}
        onClose={() => {
          setBeanSelectionProfile(null);
          setSelectedBeanId('');
        }}
        onSkip={() => completeProfileSelect(beanSelectionProfile)}
        onConfirm={() => completeProfileSelect(beanSelectionProfile, selectedBeanId)}
      />
    </div>
  );
}
