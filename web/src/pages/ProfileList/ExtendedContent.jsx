import { useEffect, useRef } from 'preact/hooks';
import { Chart } from 'chart.js';

const skipped = (ctx, value) => (!ctx.p0.raw.target ? value : undefined);
const pressureDatasetDefaults = {
  label: 'Pressure',
  borderColor: 'rgb(75, 192, 192)',
  tension: 0.4,
  cubicInterpolationMode: 'monotone',
  segment: {
    borderColor: (ctx) => skipped(ctx, 'rgb(75, 192, 192, 0.4)'),
    borderDash: (ctx) => skipped(ctx, [6, 6]),
  },
  spanGaps: true,
};

const flowDatasetDefaults = {
  label: 'Flow',
  borderColor: 'rgb(255, 192, 192)',
  tension: 0.4,
  cubicInterpolationMode: 'monotone',
  segment: {
    borderColor: (ctx) => skipped(ctx, 'rgb(255, 192, 192, 0.4)'),
    borderDash: (ctx) => skipped(ctx, [6, 6]),
  },
  spanGaps: true,
  yAxisID: 'y1',
};

const chartOptions = {
  fill: false,
  interaction: {
    intersect: false,
  },
  radius: 0,
  scales: {
    y: {
      type: 'linear',
      display: true,
      position: 'left',
      title: {
        display: true,
        text: 'Pressure (bar)',
      },
      min: 0,
      max: 12,
    },
    y1: {
      type: 'linear',
      display: true,
      position: 'right',
      title: {
        display: true,
        text: 'Flow (ml/s)',
      },
      min: 0,
      max: 10,
    },
  },
};

function makeLabels(phases) {
  const labels = [0];
  let time = phases.map((p) => p.duration).reduce((a, b) => a + b, 0);
  return [...Array(time).keys()].map((i) => `${i}s`);
}

function prepareData(phases, target) {
  const data = [];
  let time = 0;
  for (const phase of phases) {
    for (let i = 0; i < phase.duration; i++) {
      data.push({ x: `${time}s`, y: phase.pump[target], target: phase.pump.target === target });
      time++;
    }
  }
  return data;
}

function makeChartData(data) {
  return {
    type: 'line',
    data: {
      labels: makeLabels(data.phases),
      datasets: [
        {
          ...pressureDatasetDefaults,
          data: prepareData(data.phases, 'pressure'),
        },
        {
          ...flowDatasetDefaults,
          data: prepareData(data.phases, 'flow'),
        },
      ],
    },
    options: chartOptions,
  };
}

export function ExtendedContent({ data }) {
  const ref = useRef();
  const config = makeChartData(data);

  useEffect(() => {
    const ct = new Chart(ref.current, config);
  }, [ref]);
  return (
    <div className="flex-grow">
      <canvas className="w-full max-h-36" ref={ref} />
    </div>
  );
}
