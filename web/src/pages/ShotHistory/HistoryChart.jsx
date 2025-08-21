import { useEffect, useRef, useState } from 'preact/hooks';
import { ChartComponent } from '../../components/Chart.jsx';

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
          labels: {
            boxWidth: 12,
            padding: 8,
            font: {
              size: window.innerWidth < 640 ? 10 : 12,
            },
          },
        },
        title: {
          display: false,
          text: 'Temperature History',
          font: {
            size: window.innerWidth < 640 ? 14 : 16,
          },
        },
      },
      animation: false,
      scales: {
        y: {
          type: 'linear',
          ticks: {
            callback: value => {
              return `${value} °C`;
            },
            font: {
              size: window.innerWidth < 640 ? 10 : 12,
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
            font: {
              size: window.innerWidth < 640 ? 10 : 12,
            },
          },
        },
        x: {
          ticks: {
            source: 'auto',
            font: {
              size: window.innerWidth < 640 ? 10 : 12,
            },
          },
        },
      },
    },
  };
}

export function HistoryChart({ shot }) {
  const chartData = getChartData(shot.samples);

  return <ChartComponent className='' chartClassName='w-full' data={chartData} />;
}
