import './style.css';
import { useContext } from 'react';
import { ApiServiceContext } from '../../services/ApiService.js';
import { useEffect, useRef, useState } from 'preact/hooks';
import {signal, effect} from '@preact/signals';
import { Chart, LineController, TimeScale, LinearScale, PointElement, LineElement, Legend, Filler } from 'chart.js';
import 'chartjs-adapter-dayjs-4/dist/chartjs-adapter-dayjs-4.esm';
Chart.register(LineController);
Chart.register(TimeScale);
Chart.register(LinearScale);
Chart.register(PointElement);
Chart.register(LineElement);
Chart.register(Filler);
Chart.register(Legend);

const modeMap = {
  0: 'Standby',
  1: 'Brew',
  2: 'Steam',
  3: 'Water',
};

function getChartData(data) {
  let end = new Date();
  let start = new Date(end.getTime() - 300000);
  return {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'Current Temperature',
          borderColor: '#F44336',
          pointStyle: false,
          data: data.map((i, idx) => ({x: i.ts.toISOString(), y: i.ct}))
        },
        {
          label: 'Target Temperature',
          fill: true,
          borderColor: '#03A9F4',
          pointStyle: false,
          data: data.map(((i, idx) => ({x: i.ts.toISOString(), y: i.tt})))
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
          display: true,
        },
        title: {
          display: true,
          text: 'Temperature History'
        }
      },
      animation: false,
      scales: {
        y: {
          type: 'linear',
          min: 0,
          max: 160,
          ticks: {
            callback: value => { return `${value} °C` }
          }
        },
        x: {
          type: 'time',
          min: start,
          max: end,
          time: {
            unit: 'second',
            displayFormats: {
              second: 'HH:mm:ss'
            }
          },
          ticks: {
            source: 'auto'
          }
        }
      }
    },
  };
}

const data = signal([]);

export function Home() {
  const apiService = useContext(ApiServiceContext);
  const [status, setStatus] = useState({});
  const [chart, setChart] = useState(null);
  const ref = useRef();
  useEffect(() => {
    const listenerId = apiService.on("evt:status", (msg) => {
      setStatus(msg);
      const newData = [...data.value, {ct: msg.ct, tt: msg.tt, ts: new Date()}];
      data.value = newData.slice(-600);
    });
    return () => { apiService.off("evt:status", listenerId); };
  }, []);
  const chartData = getChartData(data.value);
  useEffect(() => {
    const ct = new Chart(ref.current, chartData);
    setChart(ct);
  }, [ref]);
  useEffect(() => {
    const cd = getChartData(data.value);
    console.log(cd);
    chart.data = cd.data;
    chart.options = cd.options;
    chart.update();
  }, [data.value, chart]);
  return (
    <>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-12 md:gap-2">
        <div className="sm:col-span-12">
          <h2 className="text-2xl font-bold">Dashboard</h2>
        </div>
        <div
          className="rounded-lg border border-slate-200 bg-white p-6 sm:col-span-4 xl:col-span-4"
        >
          <dl>
            <dt className="text-2xl font-bold">{modeMap[status?.m] || 'Standby'}</dt>
            <dd className="text-sm font-medium text-slate-500">
              Mode
            </dd>
          </dl>
        </div>
        <div
          className="rounded-lg border border-slate-200 bg-white p-6 sm:col-span-4 xl:col-span-4"
        >
          <dl>
            <dt className="text-2xl font-bold">{status?.ct || 0} °C</dt>
            <dd className="text-sm font-medium text-slate-500">
              Current Temperature
            </dd>
          </dl>
        </div>
        <div
          className="rounded-lg border border-slate-200 bg-white p-6 sm:col-span-4 xl:col-span-4"
        >
          <dl>
            <dt className="text-2xl font-bold">{status?.tt || 0} °C</dt>
            <dd className="text-sm font-medium text-slate-500">
              Target Temperature
            </dd>
          </dl>
        </div>
        {/*
        <div
          className="rounded-lg border border-slate-200 bg-white p-6 sm:col-span-6 xl:col-span-3"
        >
          <dl>
            <dt className="text-2xl font-bold">{status?.profile || 'LM Leva 2'}</dt>
            <dd className="text-sm font-medium text-slate-500">
              Current Profile
            </dd>
          </dl>
        </div>
        */ }
        <div
          className="overflow-hidden rounded-xl border border-slate-200 bg-white sm:col-span-12"
        >
          <div className="px-6 pt-6">
            <h2 className="text-2xl font-bold">Overview</h2>
          </div>

          <div className="p-6">
              <canvas className="w-full" ref={ref}>
              </canvas>
          </div>
        </div>
      </div>
    </>
  );
}
