import './style.css';
import { useRef, useEffect } from 'preact/hooks';
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

function ProfileCard(props) {
  const bookmarkClass = props.bookmarked ? 'text-yellow-400' : '';
  const typeText = props.extended ? 'Pro' : 'Simple';
  const typeClass = props.extended ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800';
  return (
    <div
      className="rounded-lg border flex flex-row items-center border-slate-200 bg-white p-4 sm:col-span-12 cursor-pointer"
    >
      <div className="flex flex-row justify-center items-center p-4">
        <label className="flex items-center relative cursor-pointer">
          <input checked={props.selected} type="checkbox"
                 className="peer h-6 w-6 cursor-pointer transition-all appearance-none rounded-full bg-slate-100 shadow hover:shadow-md border border-slate-300 checked:bg-green-600 checked:border-green-600"
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
              {props.name}
            </span>
            <span className={`${typeClass} text-xs font-medium me-2 px-4 py-0.5 rounded-sm dark:bg-blue-900 dark:text-blue-300`}>{typeText}</span>
          </div>
          <div className="flex flex-row gap-2">
            <a
              href="javascript:void(0)"
              className="group flex items-center justify-between gap-2 rounded-md border border-transparent px-2.5 py-2 text-sm font-semibold text-slate-900 hover:bg-indigo-100 hover:text-indigo-600 active:border-indigo-200"
            >
              <span className={`fa fa-star ${bookmarkClass}`} />
            </a>
            <a
              href="javascript:void(0)"
              className="group flex items-center justify-between gap-2 rounded-md border border-transparent px-2.5 py-2 text-sm font-semibold text-slate-900 hover:bg-indigo-100 hover:text-indigo-600 active:border-indigo-200"
            >
              <span className="fa fa-pen" />
            </a>
          </div>
        </div>
        <div className="flex flex-row gap-2 py-4 items-center">
          {props.extended ? <ExtendedContent /> : <SimpleContent />}
        </div>
      </div>
    </div>
  );
}

function SimpleContent() {
  return (
    <>
      <SimpleStep phase="Preinfusion" type="Pump" description="Duration: 3s" />
      <SimpleDivider />
      <SimpleStep phase="Preinfusion" type="Soak" description="Duration: 10s" />
      <SimpleDivider />
      <SimpleStep phase="Brew" type="Pump" description="Target: 27s" />
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
    <div className="bg-white border border-gray-200 p-2 rounded flex flex-col">
      <div className="flex flex-row gap-2">
        <span className="text-sm font-bold">{props.phase}</span>
        <span className="text-sm">{props.type}</span>
      </div>
      <span className="text-sm italic">
        {props.description}
      </span>
    </div>
  );
}

function ExtendedContent() {
  const ref = useRef();
  const skipped = (ctx, value) => ctx.p0.skip || ctx.p1.skip ? value : undefined;
  const down = (ctx, value) => ctx.p0.parsed.y > ctx.p1.parsed.y ? value : undefined;
  const config = {
    type: 'line',
    data: {
      labels: ['0s', '1s', '2s', '3s', '4s', '5s', '6s', '7s', '8s'],
      datasets: [{
        label: 'Pressure',
        data: [0, 4, 4, 6, 8, 9, 9, 6, 0],
        borderColor: 'rgb(75, 192, 192)',
        segment: {
          borderColor: ctx => skipped(ctx, 'rgb(0,0,0,0.2)'),
          borderDash: ctx => skipped(ctx, [6, 6]),
        },
        spanGaps: true
      }, {
        label: 'Flow',
        data: [0, NaN, NaN, NaN, 2, 4, 4, 5, 2, 0],
        borderColor: 'rgb(255, 192, 192)',
        segment: {
          borderColor: ctx => skipped(ctx, 'rgb(0,0,0,0.2)'),
          borderDash: ctx => skipped(ctx, [6, 6]),
        },
        spanGaps: true,
        yAxisID: 'y1'
      }]
    },
    options: {
      fill: false,
      interaction: {
        intersect: false
      },
      radius: 0,
      scales: {
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: 'Pressure (bar)'
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: 'Flow (ml/s)'
          }
        }
      }
    }
  };


  useEffect(() => {
    const ct = new Chart(ref.current, config);
  }, [ref]);
  return (
    <div className="flex-grow">
      <canvas className="w-full max-h-36" ref={ref} />
    </div>
  );
}


function ProfileAddCard(props) {
  return (
    <div
      className="rounded-lg border flex flex-col gap-2 items-center justify-center border-slate-200 bg-white p-2 sm:col-span-12 cursor-pointer text-slate-900 hover:bg-indigo-100 hover:text-indigo-600 active:border-indigo-200"
    >
      <i className="fa fa-plus text-3xl" />
      <span className="text-sm">Add new</span>
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

        <ProfileCard name="Light Roast" bookmarked />
        <ProfileCard name="LM Leva" extended bookmarked />
        <ProfileCard name="LM Leva 2" extended selected bookmarked />
        <ProfileCard name="LM Leva 3" extended />
        <ProfileAddCard />
      </div>
    </>
  );
}
