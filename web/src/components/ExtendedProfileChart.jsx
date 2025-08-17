import { useEffect, useRef, useState } from 'preact/hooks';
import { Chart } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';

Chart.register(annotationPlugin);

const POINT_INTERVAL = 0.1; // s

const skipped = (ctx, value) => (!ctx.p0.raw.target ? value : undefined);
const pressureDatasetDefaults = {
  label: 'Pressure',
  borderColor: 'rgb(75, 192, 192)',
  tension: 0.4,
  cubicInterpolationMode: 'monotone',
  segment: {
    borderColor: ctx => skipped(ctx, 'rgba(75, 192, 192, 0.6)'),
    borderDash: ctx => skipped(ctx, [6, 6]),
  },
  spanGaps: true,
};

const flowDatasetDefaults = {
  label: 'Flow',
  borderColor: 'rgb(255, 192, 192)',
  tension: 0.4,
  cubicInterpolationMode: 'monotone',
  segment: {
    borderColor: ctx => skipped(ctx, 'rgba(255, 192, 192, 0.6)'),
    borderDash: ctx => skipped(ctx, [6, 6]),
  },
  spanGaps: true,
  yAxisID: 'y1',
};

function easeLinear(t) {
  return t;
}
function easeIn(t) {
  return t * t;
}
function easeOut(t) {
  return 1.0 - (1.0 - t) * (1.0 - t);
}
function easeInOut(t) {
  return t < 0.5 ? 2.0 * t * t : 1.0 - 2.0 * (1.0 - t) * (1.0 - t);
}

function applyEasing(t, type) {
  if (t <= 0.0) return 0.0;
  if (t >= 1.0) return 1.0;
  switch (type) {
    case 'linear':
      return easeLinear(t);
    case 'ease-in':
      return easeIn(t);
    case 'ease-out':
      return easeOut(t);
    case 'ease-in-out':
      return easeInOut(t);
    case 'instant':
    default:
      return 1.0;
  }
}

function prepareData(phases, target) {
  const data = [];
  let time = 0;
  let phaseTime = 0;
  let phaseIndex = 0;
  let currentPhase = phases[phaseIndex];
  let currentPressure = 0;
  let currentFlow = 0;
  let phaseStartFlow = 0;
  let phaseStartPressure = 0;
  let effectiveFlow = currentPhase.pump?.flow || 0;
  let effectivePressure = currentPhase.pump?.pressure || 0;

  do {
    currentPhase = phases[phaseIndex];
    const alpha = applyEasing(
      phaseTime / (currentPhase.transition?.duration || currentPhase.duration),
      currentPhase?.transition?.type || 'linear',
    );
    currentFlow =
      currentPhase.pump.target === 'flow'
        ? phaseStartFlow + (effectiveFlow - phaseStartFlow) * alpha
        : currentPhase.pump.flow;
    currentPressure =
      currentPhase.pump.target === 'pressure'
        ? phaseStartPressure + (effectivePressure - phaseStartPressure) * alpha
        : currentPhase.pump.pressure;
    data.push({
      x: time,
      y: target === 'pressure' ? currentPressure : currentFlow,
      target: currentPhase.pump.target === target,
    });
    time += POINT_INTERVAL;
    phaseTime += POINT_INTERVAL;
    if (phaseTime >= currentPhase.duration) {
      phaseTime = 0;
      phaseIndex++;
      if (phaseIndex < phases.length) {
        phaseStartFlow = currentFlow;
        phaseStartPressure = currentPressure;
        let nextPhase = phases[phaseIndex];
        effectiveFlow = nextPhase.pump?.flow === -1 ? currentFlow : nextPhase.pump?.flow || 0;
        effectivePressure =
          nextPhase.pump?.pressure === -1 ? currentPressure : nextPhase.pump?.pressure || 0;
      }
    }
  } while (phaseIndex < phases.length);

  return data;
}

function makeChartData(data, selectedPhase) {
  let duration = 0;
  for (const phase of data.phases) {
    duration += parseFloat(phase.duration);
  }
  const chartData = {
    type: 'line',
    data: {
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
    options: {
      fill: false,
      interaction: {
        intersect: false,
      },
      plugins: {},
      animations: false,
      radius: 0,
      scales: {
        x: {
          type: 'linear',
          min: 0,
          max: duration,
          display: true,
          position: 'bottom',
          title: {},
          ticks: {
            source: 'auto',
            callback: (value, index, ticks) => {
              return `${value?.toFixed()}s`;
            },
            font: {
              size: window.innerWidth < 640 ? 10 : 12,
            },
            maxTicksLimit: window.innerWidth < 640 ? 5 : 5,
          },
        },
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
    },
  };
  if (selectedPhase !== null) {
    let start = 0;
    for (let i = 0; i < selectedPhase; i++) {
      start += parseFloat(data.phases[i].duration);
    }
    let end = start + parseFloat(data.phases[selectedPhase].duration);
    chartData.options.plugins.annotation = {
      drawTime: 'afterDraw',
      annotations: [
        {
          id: 'box1',
          type: 'box',
          xMin: start,
          xMax: end,
          backgroundColor: 'rgba(129, 207, 209, 0.2)',
          borderColor: 'rgba(100, 100, 100, 0)',
        },
      ],
    };
  }
  console.log(chartData);
  return chartData;
}

export function ExtendedProfileChart({
  data,
  className = 'max-h-36 w-full',
  selectedPhase = null,
}) {
  const ref = useRef();
  const [chart, setChart] = useState(null);
  const config = makeChartData(data, selectedPhase);

  useEffect(() => {
    const ct = new Chart(ref.current, config);
    setChart(ct);

    return () => {
      if (ct) {
        ct.destroy();
      }
    };
  }, [ref]);

  useEffect(() => {
    if (!chart) {
      return;
    }
    const config = makeChartData(data, selectedPhase);
    chart.data = config.data;
    chart.options = config.options;
    chart.update();
  }, [data, chart, selectedPhase]);
  return (
    <div className={`flex-grow`}>
      <canvas className={className} ref={ref} />
    </div>
  );
}
