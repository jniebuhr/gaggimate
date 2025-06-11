import './style.css';
import { Chart, LineController, TimeScale, LinearScale, PointElement, LineElement, Legend, Filler, CategoryScale } from 'chart.js';
import 'chartjs-adapter-dayjs-4/dist/chartjs-adapter-dayjs-4.esm';
Chart.register(LineController);
Chart.register(TimeScale);
Chart.register(LinearScale);
Chart.register(CategoryScale);
Chart.register(PointElement);
Chart.register(LineElement);
Chart.register(Filler);
Chart.register(Legend);

import { ExtendedContent } from './ExtendedContent.jsx';
import { ProfileAddCard } from './ProfileAddCard.jsx';
import { useContext } from 'react';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { computed } from '@preact/signals';
import { Spinner } from '../../components/Spinner.jsx';

const PhaseLabels = {
  preinfusion: 'Pre-Infusion',
  brew: 'Brew',
}

const connected = computed(() => machine.value.connected);

function ProfileCard({ data, onDelete, onSelect, onFavorite, onUnfavorite, favoriteDisabled, unfavoriteDisabled }) {
  const bookmarkClass = data.favorite ? 'text-yellow-400' : '';
  const typeText = data.type === 'pro' ? 'Pro' : 'Simple';
  const typeClass = data.type === 'pro' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800';
  const favoriteToggleDisabled = data.favorite ? unfavoriteDisabled : favoriteDisabled;
  const favoriteToggleClass = favoriteToggleDisabled ? 'opacity-50 cursor-not-allowed' : '';
  const onFavoriteToggle = useCallback(() => {
    if (data.favorite && !unfavoriteDisabled)
      onUnfavorite(data.id);
    else if (!data.favorite && !favoriteDisabled)
      onFavorite(data.id);
  }, [data.favorite]);
  const onDownload = useCallback(() => {
    const download = {
      ...data
    };
    delete download.id;
    delete download.selected;
    delete download.favorite;
    var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(download, undefined, 2));
    var downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", data.id + ".json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }, [data]);

  return (
    <div
      key="profile-list"
      className="rounded-lg border flex flex-row items-center border-slate-200 bg-white p-4 sm:col-span-12 dark:bg-gray-800 dark:border-gray-600"
    >
      <div className="flex flex-row justify-center items-center lg:p-4 p-2">
        <label className="flex items-center relative cursor-pointer">
          <input checked={data.selected} type="checkbox"
                 onClick={() => onSelect(data.id)}
                 className="peer h-6 w-6 cursor-pointer transition-all appearance-none rounded-full bg-slate-100 dark:bg-slate-700 shadow hover:shadow-md border border-slate-300 checked:bg-green-600 checked:border-green-600"
                 id="check-custom-style" />
          <span className="absolute text-white opacity-0 peer-checked:opacity-100 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <i className="fa fa-check text-white" />
          </span>
        </label>
      </div>
      <div className="flex flex-col flex-grow overflow-auto">
        <div className="flex flex-row gap-2 flex-wrap">
          <div className="flex-grow flex flex-row items-center gap-4">
            <span className="font-bold text-xl leading-tight">
              {data.label}
            </span>
            <span className={`${typeClass} text-xs font-medium me-2 px-4 py-0.5 rounded-sm dark:bg-blue-900 dark:text-blue-300`}>{typeText}</span>
          </div>
          <div className="flex flex-row gap-2 justify-end">
            <button
              onClick={onFavoriteToggle}
              disabled={favoriteToggleDisabled}
              title="Show this profile on the Gaggimate display"
              className={`group flex items-center justify-between gap-2 rounded-md border border-transparent px-2.5 py-2 text-sm font-semibold text-slate-900 hover:bg-yellow-100 hover:text-yellow-400 active:border-yellow-200 ${favoriteToggleClass}`}
            >
              <span className={`fa fa-star ${bookmarkClass}`} />
            </button>
            <a
              href={`/profiles/${data.id}`}
              title="Edit this profile"
              className="group flex items-center justify-between gap-2 rounded-md border border-transparent px-2.5 py-2 text-sm font-semibold text-slate-900 dark:text-indigo-100 hover:bg-indigo-100 hover:text-indigo-600 active:border-indigo-200"
            >
              <span className="fa fa-pen" />
            </a>
            <a
              href="javascript:void(0)"
              title="Export this profile (rename to .json to import it again)"
              onClick={() => onDownload()}
              className="group flex items-center justify-between gap-2 rounded-md border border-transparent px-2.5 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-100 active:border-blue-200"
            >
              <span className="fa fa-file-export" />
            </a>
            <a
              href="javascript:void(0)"
              title="Delete this profile"
              onClick={() => onDelete(data.id)}
              className="group flex items-center justify-between gap-2 rounded-md border border-transparent px-2.5 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 active:border-red-200"
            >
              <span className="fa fa-trash" />
            </a>
          </div>
        </div>
        <div className="flex flex-row gap-2 py-4 items-center overflow-auto">
          {data.type === 'pro' ? <ExtendedContent data={data} /> : <SimpleContent data={data} />}
        </div>
      </div>
    </div>
  );
}

function SimpleContent({data}) {
  return (
    <>
      {
        data.phases.map((phase, i) => (
          <>
            {i > 0 && <SimpleDivider key={`d-${i}`} />}
            <SimpleStep phase={phase.phase} key={i} type={phase.name} duration={phase.duration} targets={phase.targets || []} />
          </>
        ))
      }
    </>
  );
}

function SimpleDivider() {
  return (
    <i className="fa-solid fa-chevron-right" />
  )
}

function SimpleStep(props) {
  return (
    <div className="bg-white border border-gray-200 p-2 rounded flex flex-col dark:bg-slate-700 dark:border-slate-800">
      <div className="flex flex-row gap-2">
        <span className="text-sm font-bold">{PhaseLabels[props.phase]}</span>
        <span className="text-sm">{props.type}</span>
      </div>
      <div className="text-sm italic">
        {props.targets.length === 0 && <span>Duration: {props.duration}s</span> }
        {props.targets.map((t, i) => (
          <span>Exit on: {t.value}{t.type === 'volumetric' && 'g'}</span>
        ))}
      </div>
    </div>
  );
}

export function ProfileList() {
  const apiService = useContext(ApiServiceContext);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const favoriteCount = profiles.map(p => p.favorite ? 1 : 0).reduce((a, b) => a + b, 0);
  const unfavoriteDisabled = favoriteCount <= 1;
  const favoriteDisabled = favoriteCount >= 10;
  const loadProfiles = async () => {
    const response = await apiService.request({ tp: 'req:profiles:list' });
    setProfiles(response.profiles);
    setLoading(false);
  }
  useEffect(async () => {
    if (connected.value) {
      await loadProfiles();
    }
  }, [connected.value]);

  const onDelete = useCallback(async(id) => {
    setLoading(true);
    await apiService.request({ tp: 'req:profiles:delete', id });
    await loadProfiles();
  }, [apiService, setLoading]);

  const onSelect = useCallback(async(id) => {
    setLoading(true);
    await apiService.request({ tp: 'req:profiles:select', id });
    await loadProfiles();
  }, [apiService, setLoading]);

  const onFavorite = useCallback(async(id) => {
    setLoading(true);
    await apiService.request({ tp: 'req:profiles:favorite', id });
    await loadProfiles();
  }, [apiService, setLoading]);

  const onUnfavorite = useCallback(async(id) => {
    setLoading(true);
    await apiService.request({ tp: 'req:profiles:unfavorite', id });
    await loadProfiles();
  }, [apiService, setLoading]);

  const onUpload = function(evt) {
    if (evt.target.files.length) {
      const file = evt.target.files[0];
      const reader = new FileReader();
      reader.onload = async (e) => {
        const profile = JSON.parse(e.target.result);
        await apiService.request({ tp: 'req:profiles:save', profile });
        await loadProfiles();
      }
      reader.readAsText(file);
    }
  };

  if (loading) {
    return (
      <div class="flex flex-row py-16 items-center justify-center w-full">
        <Spinner size={8} />
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-12 md:gap-2">
        <div className="sm:col-span-12 flex flex-row">
          <h2 className="text-2xl font-bold flex-grow">Profiles</h2>
          <div>
            <label title="Import" for="profileImport" className="group flex items-center justify-between gap-2 rounded-md border border-transparent px-2.5 py-2 text-lg font-semibold text-blue-600 hover:bg-blue-100 active:border-blue-200">
              <span className="fa fa-file-import" />
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
          />
        ))}

        <ProfileAddCard />
      </div>
    </>
  );
}
