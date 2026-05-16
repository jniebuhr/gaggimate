import { useMemo } from 'preact/hooks';
import { Chart } from 'chart.js';
import { ChartComponent } from './Chart';

const POINT_INTERVAL = 0.1; // s

const skipped = (ctx, value) => (!ctx.p0.raw.target ? value : undefined);
const pressureDatasetDefaults = {
  label: 'Pressure',
  borderColor: '#0066CC',
  tension: 0.4,
  cubicInterpolationMode: 'monotone',
  segment: {
    borderColor: ctx => skipped(ctx, 'rgba(0, 102, 204, 0.6)'),
    borderDash: ctx => skipped(ctx, [6, 6]),
  },
  spanGaps: true,
};

const flowDatasetDefaults = {
  label: 'Flow',
  borderColor: '#63993D',
  tension: 0.4,
  cubicInterpolationMode: 'monotone',
  segment: {
    borderColor: ctx => skipped(ctx, 'rgba(99, 153, 61, 0.6)'),
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

export function prepareData(phases, target) {
  if (!phases || phases.length === 0) {
    return [];
  }
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
      currentPhase.pump?.target === 'flow'
        ? phaseStartFlow + (effectiveFlow - phaseStartFlow) * alpha
        : currentPhase.pump?.flow || 0;
    currentPressure =
      currentPhase.pump?.target === 'pressure'
        ? phaseStartPressure + (effectivePressure - phaseStartPressure) * alpha
        : currentPhase.pump?.pressure || 0;
    data.push({
      x: time,
      y: target === 'pressure' ? currentPressure : currentFlow,
      target: currentPhase.pump?.target === target,
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

function prepareTemperatureData(phases, profileTemperature = 93) {
  let time = 0;
  const data = [{ x: 0, y: profileTemperature }];
  for (const phase of phases || []) {
    const duration = Number.parseFloat(phase.duration) || 0;
    const temperature = Number.parseFloat(phase.temperature) || profileTemperature;
    data.push({ x: time, y: temperature });
    time += duration;
    data.push({ x: time, y: temperature });
  }
  return data;
}

const temperatureDatasetDefaults = {
  label: 'Temperature',
  borderColor: '#F0561D',
  tension: 0.25,
  cubicInterpolationMode: 'monotone',
  spanGaps: true,
  yAxisID: 'y2',
};

export function makeChartData(data, selectedPhase, isDarkMode = false) {
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
        {
          ...temperatureDatasetDefaults,
          data: prepareTemperatureData(data.phases, Number.parseFloat(data.temperature) || 93),
        },
      ],
    },
    options: {
      fill: false,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
      },
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
            generateLabels(chart) {
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
          text: 'Temperature History',
          font: {
            size: window.innerWidth < 640 ? 14 : 16,
          },
        },
      },
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
            callback: value => `${value?.toFixed()}s`,
            font: {
              size: window.innerWidth < 640 ? 10 : 12,
            },
            maxTicksLimit: 10,
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
          ticks: {
            font: {
              size: window.innerWidth < 640 ? 10 : 12,
            },
          },
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
          ticks: {
            font: {
              size: window.innerWidth < 640 ? 10 : 12,
            },
          },
        },
        y2: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: 'Temp (C)',
          },
          min: 80,
          max: 105,
          grid: {
            drawOnChartArea: false,
          },
          ticks: {
            font: {
              size: window.innerWidth < 640 ? 10 : 12,
            },
          },
        },
      },
    },
  };

  // Always show phase dividers and labels
  chartData.options.plugins.annotation = {
    drawTime: 'afterDatasetsDraw',
    clip: false,
    annotations: [],
  };

  // Add highlighting box only if a phase is selected
  if (selectedPhase !== null) {
    let start = 0;
    for (let i = 0; i < selectedPhase; i++) {
      start += parseFloat(data.phases[i].duration);
    }
    let end = start + parseFloat(data.phases[selectedPhase].duration);
    chartData.options.plugins.annotation.annotations.push({
      id: 'box1',
      type: 'box',
      xMin: start + 0.1,
      xMax: end + 0.1,
      backgroundColor: 'rgba(0,105,255,0.2)',
      borderColor: 'rgba(100, 100, 100, 0)',
    });
  }

  const chartWidth = window.innerWidth;
  const showLabels = chartWidth >= 520;
  const isSmall = window.innerWidth < 640;
  let phaseStart = 0;
  for (let i = 0; i < data.phases.length; i++) {
    const phase = data.phases[i];
    const phaseName = phase.name || `Phase ${i + 1}`;

    chartData.options.plugins.annotation.annotations.push({
      type: 'line',
      xMin: phaseStart,
      xMax: phaseStart,
      borderColor: 'rgb(128,128,128)',
      borderWidth: 1,
      label: showLabels
        ? {
            display: true,
            content: phaseName,
            rotation: -90,
            position: 'end', // anchor at top of line
            xAdjust: i === 0 ? -7 : 8, // tweak first label inward to compensate for y-axis padding
            yAdjust: 0,
            padding: { x: 4, y: 0 },
            color: isDarkMode ? 'rgb(255,255,255)' : 'rgb(0,0,0)',
            backgroundColor: isDarkMode ? 'rgba(22,33,50,0.75)' : 'rgba(255,255,255,0.75)',
            textAlign: 'start',
            font: {
              size: isSmall ? 9 : 11,
              weight: 500,
            },
            clip: false,
          }
        : undefined,
    });

    phaseStart += parseFloat(phase.duration);
  }
  return chartData;
}

export function ExtendedProfileChart({
  data,
  className = 'max-h-36 w-full',
  selectedPhase = null,
  onChartReady,
}) {
  const isDarkMode = () =>
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const hasValidPhases = Array.isArray(data?.phases);

  // Memoize chart config to prevent unnecessary recalculations
  const config = useMemo(() => {
    if (!hasValidPhases) {
      return null;
    }
    return makeChartData(data, selectedPhase, isDarkMode());
  }, [data, hasValidPhases, selectedPhase]);

  if (!config) {
    return null;
  }

  return (
    <ChartComponent
      className='max-w-full flex-shrink flex-grow'
      chartClassName={className}
      data={config}
      onChartReady={onChartReady}
    />
  );
}
