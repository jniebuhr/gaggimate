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
import { ExtendedContent } from './ExtendedContent.jsx';
import { ProfileAddCard } from './ProfileAddCard.jsx';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
import { useCallback, useEffect, useState, useContext } from 'preact/hooks';
import { computed } from '@preact/signals';
import { Spinner } from '../../components/Spinner.jsx';
import Card from '../../components/Card.jsx';

Chart.register(LineController, TimeScale, LinearScale, CategoryScale, PointElement, LineElement, Filler, Legend);

const PhaseLabels = {
  preinfusion: 'Pre-Infusion',
  brew: 'Brew',
};

const connected = computed(() => machine.value.connected);

function ProfileCard({ data, onDelete, onSelect, onFavorite, onUnfavorite, onDuplicate, favoriteDisabled, unfavoriteDisabled }) {
  const bookmarkClass = data.favorite ? 'text-warning' : 'text-base-content/60';
  const typeText = data.type === 'pro' ? 'Pro' : 'Simple';
  const typeClass = data.type === 'pro' ? 'badge badge-primary' : 'badge badge-neutral';
  const favoriteToggleDisabled = data.favorite ? unfavoriteDisabled : favoriteDisabled;
  const favoriteToggleClass = favoriteToggleDisabled ? 'opacity-50 cursor-not-allowed' : '';
  const onFavoriteToggle = useCallback(() => {
    if (data.favorite && !unfavoriteDisabled) onUnfavorite(data.id);
    else if (!data.favorite && !favoriteDisabled) onFavorite(data.id);
  }, [data.favorite]);
  const onDownload = useCallback(() => {
    const download = {
      ...data,
    };
    delete download.id;
    delete download.selected;
    delete download.favorite;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(download, undefined, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', dataStr);
    downloadAnchorNode.setAttribute('download', data.id + '.json');
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }, [data]);

  return (
    <Card sm={12}>
      <div className="flex flex-row items-center p-4">
        <div className="flex flex-row justify-center items-center mr-4">
          <label
            className="flex items-center relative cursor-pointer"
            data-tooltip="Select profile"
            data-tooltip-position="right"
          >
            <input
              checked={data.selected}
              type="checkbox"
              onClick={() => onSelect(data.id)}
              className="checkbox checkbox-success"
              id="check-custom-style"
            />
          </label>
        </div>
        <div className="flex flex-col flex-grow overflow-auto">
          <div className="flex flex-row gap-2 flex-wrap">
            <div className="flex-grow flex flex-row items-center gap-4">
              <span className="font-bold text-xl leading-tight">{data.label}</span>
              <span className={`${typeClass} text-xs font-medium`}>{typeText}</span>
            </div>
            <div className="flex flex-row gap-2 justify-end">
              <button
                onClick={onFavoriteToggle}
                disabled={favoriteToggleDisabled}
                data-tooltip="Show/hide"
                data-tooltip-position="left"
                className={`btn btn-sm btn-ghost ${favoriteToggleClass}`}
              >
                <i className={`fa fa-star ${bookmarkClass}`} />
              </button>
              <a href={`/profiles/${data.id}`} data-tooltip="Edit" data-tooltip-position="left" className="btn btn-sm btn-ghost">
                <i className="fa fa-pen" />
              </a>
              <button
                data-tooltip="Export"
                data-tooltip-position="left"
                onClick={() => onDownload()}
                className="btn btn-sm btn-ghost text-info"
              >
                <i className="fa fa-file-export" />
              </button>
              <button
                data-tooltip="Duplicate"
                data-tooltip-position="left"
                onClick={() => onDuplicate(data.id)}
                className="btn btn-sm btn-ghost text-success"
              >
                <i className="fa fa-copy" />
              </button>
              <button
                data-tooltip="Delete"
                data-tooltip-position="left"
                onClick={() => onDelete(data.id)}
                className="btn btn-sm btn-ghost text-error"
              >
                <i className="fa fa-trash" />
              </button>
            </div>
          </div>
          <div className="flex flex-row gap-2 py-2 items-center overflow-auto">
            {data.type === 'pro' ? <ExtendedContent data={data} /> : <SimpleContent data={data} />}
          </div>
        </div>
      </div>
    </Card>
  );
}

function SimpleContent({ data }) {
  return (
    <div className="flex flex-row items-center gap-2">
      {data.phases.map((phase, i) => (
        <div key={i} className="flex flex-row items-center gap-2">
          {i > 0 && <SimpleDivider />}
          <SimpleStep phase={phase.phase} type={phase.name} duration={phase.duration} targets={phase.targets || []} />
        </div>
      ))}
    </div>
  );
}

function SimpleDivider() {
  return <i className="fa-solid fa-chevron-right text-base-content/60" />;
}

function SimpleStep(props) {
  return (
    <div className="bg-base-100 border border-base-300 p-3 rounded-lg flex flex-col gap-1">
      <div className="flex flex-row gap-2">
        <span className="text-sm font-bold text-base-content">{PhaseLabels[props.phase]}</span>
        <span className="text-sm text-base-content/70">{props.type}</span>
      </div>
      <div className="text-sm italic text-base-content/60">
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
  const favoriteCount = profiles.map((p) => (p.favorite ? 1 : 0)).reduce((a, b) => a + b, 0);
  const unfavoriteDisabled = favoriteCount <= 1;
  const favoriteDisabled = favoriteCount >= 10;
  const loadProfiles = async () => {
    const response = await apiService.request({ tp: 'req:profiles:list' });
    setProfiles(response.profiles);
    setLoading(false);
  };
  useEffect(() => {
    const loadData = async () => {
      if (connected.value) {
        await loadProfiles();
      }
    };
    loadData();
  }, [connected.value]);

  const onDelete = useCallback(
    async (id) => {
      setLoading(true);
      await apiService.request({ tp: 'req:profiles:delete', id });
      await loadProfiles();
    },
    [apiService, setLoading]
  );

  const onSelect = useCallback(
    async (id) => {
      setLoading(true);
      await apiService.request({ tp: 'req:profiles:select', id });
      await loadProfiles();
    },
    [apiService, setLoading]
  );

  const onFavorite = useCallback(
    async (id) => {
      setLoading(true);
      await apiService.request({ tp: 'req:profiles:favorite', id });
      await loadProfiles();
    },
    [apiService, setLoading]
  );

  const onUnfavorite = useCallback(
    async (id) => {
      setLoading(true);
      await apiService.request({ tp: 'req:profiles:unfavorite', id });
      await loadProfiles();
    },
    [apiService, setLoading]
  );

  const onDuplicate = useCallback(
    async (id) => {
      setLoading(true);
      const original = profiles.find((p) => p.id === id);
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
    [apiService, profiles, setLoading]
  );

  const onExport = useCallback(() => {
    const exportedProfiles = profiles.map((p) => {
      const ep = {
        ...p,
      };
      delete ep.id;
      delete ep.selected;
      delete ep.favorite;
      return ep;
    });
    var dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportedProfiles, undefined, 2));
    var downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', dataStr);
    downloadAnchorNode.setAttribute('download', 'profiles.json');
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }, [profiles]);

  const onUpload = function (evt) {
    if (evt.target.files.length) {
      const file = evt.target.files[0];
      const reader = new FileReader();
      reader.onload = async (e) => {
        const result = e.target.result;
        if (typeof result === 'string') {
          let profiles = JSON.parse(result);
          if (!Array.isArray(profiles)) {
            profiles = [profiles];
          }
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
      <div className="flex flex-row py-16 items-center justify-center w-full">
        <Spinner size={8} />
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
        <div className="sm:col-span-12 flex flex-row items-center gap-4">
          <h2 className="text-2xl font-bold text-base-content flex-grow">Profiles</h2>
          <button data-tooltip="Export" onClick={onExport} className="btn btn-sm btn-ghost text-info">
            <i className="fa fa-file-export" />
          </button>
          <div>
            <label data-tooltip="Import" htmlFor="profileImport" className="btn btn-sm btn-ghost text-info">
              <i className="fa fa-file-import" />
            </label>
          </div>
          <input onChange={onUpload} className="hidden" id="profileImport" type="file" accept=".json,application/json" />
        </div>

        {profiles.map((data) => (
          <ProfileCard
            data={data}
            key={data.id}
            onDelete={onDelete}
            onSelect={onSelect}
            favoriteDisabled={favoriteDisabled}
            unfavoriteDisabled={unfavoriteDisabled}
            onUnfavorite={onUnfavorite}
            onFavorite={onFavorite}
            onDuplicate={onDuplicate}
          />
        ))}

        <ProfileAddCard />
      </div>
    </>
  );
}
