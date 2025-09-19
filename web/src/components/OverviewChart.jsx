import { machine } from '../services/ApiService.js';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Chart } from 'chart.js';
import { ChartComponent } from './Chart.jsx';
import { 
  formatTemperatureValue, 
  getTemperatureUnit 
} from '../utils/temperatureConverter.js';

function getChartData(data) {
  let end = new Date();
  let start = new Date(end.getTime() - 300000);
  const useFahrenheit = machine.value.status.temperatureUnitFahrenheit;
  
  return {
    type: 'line',
    data: {
      datasets: [
        {
          label: `Current Temperature (${getTemperatureUnit(useFahrenheit)})`,
          borderColor: '#F0561D',
          pointStyle: false,
          data: data.map(i => ({ 
            x: i.timestamp.toISOString(), 
            y: formatTemperatureValue(i.currentTemperature, useFahrenheit, 1)
          })),
        },
        {
          label: `Target Temperature (${getTemperatureUnit(useFahrenheit)})`,
          fill: true,
          borderColor: '#731F00',
          borderDash: [6, 6],
          pointStyle: false,
          data: data.map(i => ({ 
            x: i.timestamp.toISOString(), 
            y: formatTemperatureValue(i.targetTemperature, useFahrenheit, 1)
          })),
        },
        {
          label: 'Current Pressure',
          borderColor: '#0066CC',
          pointStyle: false,
          yAxisID: 'y1',
          data: data.map(i => ({ x: i.timestamp.toISOString(), y: i.currentPressure })),
        },
        {
          label: 'Target Pressure',
          fill: true,
          borderColor: '#003366',
          borderDash: [6, 6],
          pointStyle: false,
          yAxisID: 'y1',
          data: data.map(i => ({ x: i.timestamp.toISOString(), y: i.targetPressure })),
        },
        {
          label: 'Current Flow',
          borderColor: '#63993D',
          pointStyle: false,
          yAxisID: 'y1',
          data: data.map(i => ({ x: i.timestamp.toISOString(), y: i.currentFlow })),
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          display: true,
          labels: {
            usePointStyle: true,
            pointStyle: 'line',
            pointStyleWidth: 20,
            padding: 8,
            font: {
              size: window.innerWidth < 640 ? 10 : 12,
            },
            generateLabels: function(chart) {
              const original = Chart.defaults.plugins.legend.labels.generateLabels;
              const labels = original.call(this, chart);
              
              labels.forEach((label, index) => {
                const dataset = chart.data.datasets[index];
                label.lineWidth = 3; 
                if (dataset.borderDash && dataset.borderDash.length > 0) {
                  label.lineDash = dataset.borderDash; 
                }
              });
              
              return labels;
            },
          },
        },
        title: {
          display: true,
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
          min: useFahrenheit ? 32 : 0,
          max: useFahrenheit ? 320 : 160,
          ticks: {
            font: {
              size: window.innerWidth < 640 ? 10 : 12,
            },
            callback: value => {
              return `${value} ${getTemperatureUnit(useFahrenheit)}`;
            },
          },
        },
        y1: {
          type: 'linear',
          min: 0,
          max: 16,
          position: 'right',
          ticks: {
            font: {
              size: window.innerWidth < 640 ? 10 : 12,
            },
            callback: value => {
              return `${value} bar / g/s`;
            },
          },
        },
        x: {
          type: 'time',
          min: start,
          max: end,
          time: {
            unit: 'second',
            displayFormats: {
              second: 'HH:mm:ss',
            },
          },
          ticks: {
            source: 'auto',
            callback: (value, index, ticks) => {
              const now = new Date().getTime();
              const diff = Math.ceil((now - value) / 1000);
              return `-${diff}s`;
            },
            font: {
              size: window.innerWidth < 640 ? 10 : 12,
            },
            maxTicksLimit: 5,
          },
        },
      },
    },
  };
}

export function OverviewChart() {
  const chartData = getChartData(machine.value.history);

  return (
    <ChartComponent
      className='h-full min-h-[200px] w-full flex-1 lg:min-h-[350px]'
      chartClassName='h-full w-full'
      data={chartData}
    />
  );
}
