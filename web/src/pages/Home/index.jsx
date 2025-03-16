import './style.css';
import { useContext } from 'react';
import { ApiServiceContext } from '../../services/ApiService.js';
import { useEffect, useRef, useState } from 'preact/hooks';
import {signal, effect} from '@preact/signals';
import { Chart, LineController, TimeScale, LinearScale, PointElement, LineElement, Legend } from 'chart.js';
import 'chartjs-adapter-dayjs-4/dist/chartjs-adapter-dayjs-4.esm';
import dayjs from 'dayjs';
Chart.register(LineController);
Chart.register(TimeScale);
Chart.register(LinearScale);
Chart.register(PointElement);
Chart.register(LineElement);
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
      <div className="flex flex-row justify-center mt-2 mb-2 gap-4">
        <div className="flex flex-row items-center gap-2">
          <span className="font-bold">Mode: </span>
          {modeMap[status?.m]}
        </div>
        <div className="flex flex-row items-center gap-2">
          <span className="font-bold">Temperature: </span>
          {status?.ct}°C/{status?.tt}°C
        </div>
      </div>
      <div className="flex max-w-xl w-full">
        <canvas className="w-full" ref={ref}>
        </canvas>
      </div>
      <div className="flex flex-col justify-center mt-2 mb-2">
        Welcome to the GaggiMate Web UI. Please choose one of the options below.
      </div>
      <div className="flex flex-col justify-center mt-2 mb-2 gap-2 w-full max-w-md border-b border-[#CCCCCC] pb-4">
        <a href="#" className="menu-button">
          Profiles (coming soon)
        </a>
        <a href="#" className="menu-button">
          PID Autotune (coming soon)
        </a>
        <a href="/scales" className="menu-button">
          Bluetooth Scales
        </a>
        <a href="/settings" className="menu-button">
          Settings
        </a>
        <a href="/ota" className="menu-button">
          Updates
        </a>
      </div>
    </>
  );
}
