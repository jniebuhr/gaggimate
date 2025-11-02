import { Chart } from 'chart.js';
import { ChartComponent } from '../../components/Chart.jsx';

function getChartData(data) {
  // Build sample point arrays once (numeric x for linear scale)
  const ct = [];
  const tt = [];
  const cp = [];
  const tp = [];
  const fl = [];
  const pf = [];
  const tf = [];
  for (let i = 0; i < data.length; i++) {
    const s = data[i];
    const x = s.t / 1000.0; // seconds (number)
    ct.push({ x, y: s.ct });
    tt.push({ x, y: s.tt });
    cp.push({ x, y: s.cp });
    tp.push({ x, y: s.tp });
    fl.push({ x, y: s.fl });
    pf.push({ x, y: s.pf });
    tf.push({ x, y: s.tf });
  }
  const tempValues = ct.map(i => i.y).concat(tt.map(i => i.y));
  const timeValues = ct.map(i => i.x);
  const minTemp = Math.floor(Math.min(...tempValues));
  const maxTemp = Math.ceil(Math.max(...tempValues));
  const minX = Math.min(...timeValues);
  const maxX = Math.max(...timeValues);
  const padding = maxTemp - minTemp > 10 ? 2 : 5;
  return {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'Current Temperature',
          borderColor: '#F0561D',
          pointStyle: false,
          data: ct,
        },
        {
          label: 'Target Temperature',
          fill: true,
          borderColor: '#731F00',
          borderDash: [6, 6],
          pointStyle: false,
          data: tt,
        },
        {
          label: 'Current Pressure',
          borderColor: '#0066CC',
          pointStyle: false,
          yAxisID: 'y1',
          data: cp,
        },
        {
          label: 'Target Pressure',
          fill: true,
          borderColor: '#0066CC',
          borderDash: [6, 6],
          pointStyle: false,
          yAxisID: 'y1',
          data: tp,
        },
        {
          label: 'Current Pump Flow',
          borderColor: '#63993D',
          pointStyle: false,
          yAxisID: 'y1',
          data: fl,
        },
        {
          label: 'Current Puck Flow',
          borderColor: '#204D00',
          pointStyle: false,
          yAxisID: 'y1',
          data: pf,
        },
        {
          label: 'Target Pump Flow',
          borderColor: '#63993D',
          borderDash: [6, 6],
          pointStyle: false,
          yAxisID: 'y1',
          data: tf,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      parsing: false, // We already provide x/y objects
      spanGaps: true,
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
            generateLabels: function (chart) {
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
          display: false,
        },
      },
      animation: false,
      scales: {
        x: {
          min: minX,
          max: maxX,
          type: 'linear',
          title: { display: true, text: 'Time (s)' },
          ticks: { font: { size: window.innerWidth < 640 ? 10 : 12 } },
        },
        y: {
          type: 'linear',
          ticks: {
            callback: value => `${value.toFixed()} °C`,
            font: {
              size: window.innerWidth < 640 ? 10 : 12,
            },
          },
          min: Math.max(minTemp - padding, 0),
          max: maxTemp + padding,
        },
        y1: {
          type: 'linear',
          min: 0,
          max: 16,
          position: 'right',
          ticks: {
            callback: value => `${value.toFixed()} bar / g/s`,
            font: {
              size: window.innerWidth < 640 ? 10 : 12,
            },
          },
          grid: { drawOnChartArea: false },
        },
      },
    },
  };
}

export function HistoryChart({ shot }) {
  const chartData = getChartData(shot.samples);

  return (
    <ChartComponent
      className='min-h-[350px] flex-1'
      chartClassName='w-full min-h-[350px]'
      data={chartData}
    />
  );
}
