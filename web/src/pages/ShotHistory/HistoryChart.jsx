import { useEffect, useRef, useState } from 'preact/hooks';
import { Chart } from 'chart.js';

function getChartData(data) {
  let start = 0;
  return {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'Current Temperature',
          borderColor: '#F0561D',
          pointStyle: false,
          data: data.map((i, idx) => ({ x: (i.t / 1000).toFixed(1), y: i.ct })),
        },
        {
          label: 'Target Temperature',
          fill: true,
          borderColor: '#731F00',
          borderDash: [6, 6],
          pointStyle: false,
          data: data.map((i, idx) => ({ x: (i.t / 1000).toFixed(1), y: i.tt })),
        },
        {
          label: 'Current Pressure',
          borderColor: '#0066CC',
          pointStyle: false,
          yAxisID: 'y1',
          data: data.map((i, idx) => ({ x: (i.t / 1000).toFixed(1), y: i.cp })),
        },
        {
          label: 'Target Pressure',
          fill: true,
          borderColor: '#0066CC',
          borderDash: [6, 6],
          pointStyle: false,
          yAxisID: 'y1',
          data: data.map((i, idx) => ({ x: (i.t / 1000).toFixed(1), y: i.tp })),
        },
        {
          label: 'Current Pump Flow',
          borderColor: '#63993D',
          pointStyle: false,
          yAxisID: 'y1',
          data: data.map((i, idx) => ({ x: (i.t / 1000).toFixed(1), y: i.fl })),
        },
        {
          label: 'Current Puck Flow',
          borderColor: '#204D00',
          pointStyle: false,
          yAxisID: 'y1',
          data: data.map((i, idx) => ({ x: (i.t / 1000).toFixed(1), y: i.pf })),
        },
        {
          label: 'Target Pump Flow',
          borderColor: '#63993D',
          borderDash: [6, 6],
          pointStyle: false,
          yAxisID: 'y1',
          data: data.map((i, idx) => ({ x: (i.t / 1000).toFixed(1), y: i.tf })),
        },
      ],
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
          text: 'Temperature History',
        },
      },
      animation: false,
      scales: {
        y: {
          type: 'linear',
          min: 0,
          max: 160,
          ticks: {
            callback: value => {
              return `${value} °C`;
            },
          },
        },
        y1: {
          type: 'linear',
          min: 0,
          max: 16,
          position: 'right',
          ticks: {
            callback: value => {
              return `${value} bar / g/s`;
            },
          },
        },
        x: {
          ticks: {
            source: 'auto',
          },
        },
      },
    },
  };
}

export function HistoryChart({ shot }) {
  const [chart, setChart] = useState(null);
  const ref = useRef();
  const chartData = getChartData(shot.samples);
  useEffect(() => {
    const ct = new Chart(ref.current, chartData);
    setChart(ct);
  }, [ref]);
  useEffect(() => {
    if (!chart) {
      return;
    }
    const cd = getChartData(shot.samples);
    chart.data = cd.data;
    chart.options = cd.options;
    chart.update();
  }, [shot, chart]);

  return <canvas className='w-full' ref={ref} />;
}
