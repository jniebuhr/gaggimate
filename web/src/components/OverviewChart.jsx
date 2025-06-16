import { computed } from '@preact/signals';
import { machine } from '../services/ApiService.js';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Chart } from 'chart.js';

const history = computed(() => machine.value.history);

function getChartData(data) {
  let end = new Date();
  let start = new Date(end.getTime() - 300000);
  return {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'Current Temperature',
          borderColor: '#F0561D',
          pointStyle: false,
          data: data.map((i, idx) => ({x: i.timestamp.toISOString(), y: i.currentTemperature}))
        },
        {
          label: 'Target Temperature',
          fill: true,
          borderColor: '#731F00',
          borderDash: [6, 6],
          pointStyle: false,
          data: data.map(((i, idx) => ({x: i.timestamp.toISOString(), y: i.targetTemperature})))
        },
        {
          label: 'Current Pressure',
          borderColor: '#0066CC',
          pointStyle: false,
          yAxisID: 'y1',
          data: data.map((i, idx) => ({x: i.timestamp.toISOString(), y: i.currentPressure}))
        },
        {
          label: 'Target Pressure',
          fill: true,
          borderColor: '#003366',
          borderDash: [6, 6],
          pointStyle: false,
          yAxisID: 'y1',
          data: data.map(((i, idx) => ({x: i.timestamp.toISOString(), y: i.targetPressure})))
        },
        {
          label: 'Current Flow',
          borderColor: '#63993D',
          pointStyle: false,
          yAxisID: 'y1',
          data: data.map((i, idx) => ({x: i.timestamp.toISOString(), y: i.currentFlow}))
        },
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
        y1: {
          type: 'linear',
          min: 0,
          max: 16,
          position: 'right',
          ticks: {
            callback: value => { return `${value} bar / g/s` }
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

export function OverviewChart() {
  const [chart, setChart] = useState(null);
  const ref = useRef();
  const chartData = getChartData(machine.value.history);
  useEffect(() => {
    const ct = new Chart(ref.current, chartData);
    setChart(ct);
  }, [ref]);
  useEffect(() => {
    const cd = getChartData(machine.value.history);
    chart.data = cd.data;
    chart.options = cd.options;
    chart.update();
  }, [machine.value.history, chart]);

  return (
    <canvas className="w-full" ref={ref} />
  );
}
