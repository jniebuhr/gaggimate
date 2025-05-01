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

import mockData from '../../mocks/profiles.json';
import { ExtendedContent } from './ExtendedContent.jsx';
import { ProfileAddCard } from './ProfileAddCard.jsx';

const PhaseLabels = {
  preinfusion: 'Pre-Infusion',
  brew: 'Brew',
}

function ProfileCard({ data }) {
  const bookmarkClass = data.favorite ? 'text-yellow-400' : '';
  const typeText = data.type === 'pro' ? 'Pro' : 'Simple';
  const typeClass = data.type === 'pro' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800';
  return (
    <div
      key="profile-list"
      className="rounded-lg border flex flex-row items-center border-slate-200 bg-white p-4 sm:col-span-12 cursor-pointer dark:bg-gray-800 dark:border-gray-600"
    >
      <div className="flex flex-row justify-center items-center p-4">
        <label className="flex items-center relative cursor-pointer">
          <input checked={data.selected} type="checkbox"
                 className="peer h-6 w-6 cursor-pointer transition-all appearance-none rounded-full bg-slate-100 dark:bg-slate-700 shadow hover:shadow-md border border-slate-300 checked:bg-green-600 checked:border-green-600"
                 id="check-custom-style" />
          <span className="absolute text-white opacity-0 peer-checked:opacity-100 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <i className="fa fa-check text-white" />
          </span>
        </label>
      </div>
      <div className="flex flex-col flex-grow">
        <div className="flex flex-row">
          <div className="flex-grow flex flex-row items-center gap-4">
            <span className="font-bold text-xl leading-tight">
              {data.label}
            </span>
            <span className={`${typeClass} text-xs font-medium me-2 px-4 py-0.5 rounded-sm dark:bg-blue-900 dark:text-blue-300`}>{typeText}</span>
          </div>
          <div className="flex flex-row gap-2">
            <a
              href="javascript:void(0)"
              className="group flex items-center justify-between gap-2 rounded-md border border-transparent px-2.5 py-2 text-sm font-semibold text-slate-900 hover:bg-yellow-100 hover:text-yellow-400 active:border-yellow-200"
            >
              <span className={`fa fa-star ${bookmarkClass}`} />
            </a>
            <a
              href="javascript:void(0)"
              className="group flex items-center justify-between gap-2 rounded-md border border-transparent px-2.5 py-2 text-sm font-semibold text-slate-900 dark:text-indigo-100 hover:bg-indigo-100 hover:text-indigo-600 active:border-indigo-200"
            >
              <span className="fa fa-pen" />
            </a>
            <a
              href="javascript:void(0)"
              className="group flex items-center justify-between gap-2 rounded-md border border-transparent px-2.5 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 active:border-red-200"
            >
              <span className="fa fa-trash" />
            </a>
          </div>
        </div>
        <div className="flex flex-row gap-2 py-4 items-center">
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
  return (
    <>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-12 md:gap-2">
        <div className="sm:col-span-12">
          <h2 className="text-2xl font-bold">Profiles</h2>
        </div>

        {mockData.map((data) => (
          <ProfileCard data={data} key={data.id} />
        ))}

        <ProfileAddCard />
      </div>
    </>
  );
}
