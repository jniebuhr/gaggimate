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
import { ExtendedProfileChart } from '../../components/ExtendedProfileChart.jsx';
import { ProfileAddCard } from './ProfileAddCard.jsx';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
import { useCallback, useEffect, useState, useContext, useRef } from 'preact/hooks';
import { computed } from '@preact/signals';
import { Spinner } from '../../components/Spinner.jsx';
import Card from '../../components/Card.jsx';
import { parseProfile } from './utils.js';
import { downloadJson } from '../../utils/download.js';

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

  return (
    <Card sm={12} role='listitem'>
      <div
        className='flex flex-row items-center'
        role='group'
        aria-labelledby={`profile-${data.id}-title`}
      >
        <div className='mr-4 flex flex-row items-center justify-center'>
          <label className='relative flex cursor-pointer items-center'>
            <input
              checked={data.selected}
              type='checkbox'
              onClick={() => onSelect(data.id)}
              className='checkbox checkbox-success'
              aria-label={`Select ${data.label} profile`}
            />
          </label>
          <div className='ml-2 flex flex-col gap-1'>
            <button
              onClick={() => onMoveUp(data.id)}
              disabled={isFirst}
              className='btn btn-xs btn-ghost'
              aria-label={`Move ${data.label} up`}
              aria-disabled={isFirst}
              title='Move up'
            >
              <i className='fa fa-arrow-up' aria-hidden='true' />
            </button>
            <button
              onClick={() => onMoveDown(data.id)}
              disabled={isLast}
              className='btn btn-xs btn-ghost'
              aria-label={`Move ${data.label} down`}
              aria-disabled={isLast}
              title='Move down'
            >
              <i className='fa fa-arrow-down' aria-hidden='true' />
            </button>
          </div>
        </div>
        <div className='flex flex-grow flex-col overflow-auto'>
          <div className='flex flex-row flex-wrap gap-2'>
            <div className='flex flex-grow flex-row items-center gap-4'>
              <span id={`profile-${data.id}-title`} className='text-xl leading-tight font-bold'>
                {data.label}
              </span>
              <span
                className={`${typeClass} text-xs font-medium`}
                aria-label={`Profile type: ${typeText}`}
              >
                {typeText}
              </span>
            </div>
            <div
              className='flex flex-row justify-end gap-2'
              role='group'
              aria-label={`Actions for ${data.label} profile`}
            >
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
                <i className={`fa fa-star ${bookmarkClass}`} aria-hidden='true' />
              </button>
              <a
                href={`/profiles/${data.id}`}
                className='btn btn-sm btn-ghost'
                aria-label={`Edit ${data.label} profile`}
              >
                <i className='fa fa-pen' aria-hidden='true' />
              </a>
              <button
                onClick={onDownload}
                className='btn btn-sm btn-ghost text-primary'
                aria-label={`Export ${data.label} profile`}
              >
                <i className='fa fa-file-export' aria-hidden='true' />
              </button>
              <button
                onClick={() => onDuplicate(data.id)}
                className='btn btn-sm btn-ghost text-success'
                aria-label={`Duplicate ${data.label} profile`}
              >
                <i className='fa fa-copy' aria-hidden='true' />
              </button>
              <button
                onClick={() => onDelete(data.id)}
                className='btn btn-sm btn-ghost text-error'
                aria-label={`Delete ${data.label} profile`}
              >
                <i className='fa fa-trash' aria-hidden='true' />
              </button>
            </div>
          </div>
          <div
            className='flex flex-row items-center gap-2 overflow-auto py-2'
            aria-label={`Profile details for ${data.label}`}
          >
            {data.type === 'pro' ? (
              <ExtendedProfileChart data={data} className='max-h-36' />
            ) : (
              <SimpleContent data={data} />
            )}
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
  return <i className='fa-solid fa-chevron-right text-base-content/60' aria-hidden='true' />;
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
  const favoriteCount = profiles.map(p => (p.favorite ? 1 : 0)).reduce((a, b) => a + b, 0);
  const unfavoriteDisabled = favoriteCount <= 1;
  const favoriteDisabled = favoriteCount >= 10;

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
          apiService.request({ tp: 'req:profiles:reorder', order: pendingOrderRef.current }).catch(() => {});
        }
      }
    };
  }, [apiService]);

  const moveProfileUp = useCallback(id => {
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
  }, [persistProfileOrder]);

  const moveProfileDown = useCallback(id => {
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
  }, [persistProfileOrder]);

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
        <button
          onClick={onExport}
          className='btn btn-ghost btn-sm'
          title='Export all profiles'
          aria-label='Export all profiles'
        >
          <i className='fa fa-file-export' aria-hidden='true' />
        </button>
        <label
          htmlFor='profileImport'
          className='btn btn-ghost btn-sm cursor-pointer'
          title='Import profiles'
          aria-label='Import profiles'
        >
          <i className='fa fa-file-import' aria-hidden='true' />
        </label>
        <input
          onChange={onUpload}
          className='hidden'
          id='profileImport'
          type='file'
          accept='.json,application/json,.tcl'
          aria-label='Select a JSON file containing profile data to import'
        />
      </div>

      <div className='grid grid-cols-1 gap-4 lg:grid-cols-12' role='list' aria-label='Profile list'>
    {profiles.map((data, idx) => (
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
      isLast={idx === profiles.length - 1}
          />
        ))}

        <ProfileAddCard />
      </div>
    </>
  );
}
