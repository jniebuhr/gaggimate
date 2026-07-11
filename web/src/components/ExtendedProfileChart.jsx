import { useEffect, useRef, useState } from 'preact/hooks';
import { Chart } from 'chart.js';
import { ChartComponent } from './Chart';

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
  if (!Array.isArray(phases) || phases.length === 0) {
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

function makeChartData(
  data,
  selectedPhase,
  phaseRanges,
  onPhaseClick,
  isDarkMode = false,
  showPhaseLabels = true,
) {
  const phases = Array.isArray(data?.phases) ? data.phases : [];
  let duration = 0;
  for (const phase of phases) {
    duration += Number.parseFloat(phase.duration);
  }
  const chartData = {
    type: 'line',
    data: {
      datasets: [
        {
          ...pressureDatasetDefaults,
          data: prepareData(phases, 'pressure'),
        },
        {
          ...flowDatasetDefaults,
          data: prepareData(phases, 'flow'),
        },
      ],
    },
    options: {
      fill: false,
      responsive: true,
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
            callback: (value, index, ticks) => {
              return `${value?.toFixed()}s`;
            },
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
  if (selectedPhase !== null && phaseRanges[selectedPhase]) {
    const start = phaseRanges[selectedPhase].start;
    const end = phaseRanges[selectedPhase].end;

    chartData.options.plugins.annotation.annotations.push({
      id: 'box1',
      type: 'box',
      xMin: start + 0.1,
      xMax: end - 0.1,
      backgroundColor: 'rgba(0,105,255,0.2)',
      borderColor: 'rgba(100, 100, 100, 0)',
    });
  }

  const chartWidth = window.innerWidth;
  const showLabels = showPhaseLabels && chartWidth >= 520;
  const isSmall = window.innerWidth < 640;
  // const yMax = chartData.options.scales.y.max ?? 12;

  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    const phaseName = phase.name || `Phase ${i + 1}`;

    chartData.options.plugins.annotation.annotations.push({
      type: 'line',
      xMin: phaseRanges[i].start,
      xMax: phaseRanges[i].start,
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
  }

  // If we are in the edit profile page (we have phases and a phase is selected) set the hover effect and onPhaseClick()
  if (selectedPhase !== null && phases.length > 0) {
    chartData.options.plugins.annotation.interaction = {
      intersect: false,
      mode: 'x',
      axis: 'x',
    };

    const hoverEnterColor = 'rgb(0 105 255 / 0.07)';
    const hoverLeaveColor = 'rgb(0 0 0 / 0)';

    for (let i = 0; i < phaseRanges.length; i++) {
      const start = phaseRanges[i].start;
      const end = phaseRanges[i].end;
      chartData.options.plugins.annotation.annotations.push({
        id: `phase${i}`,
        type: 'box',
        xMin: start + 0.1,
        xMax: end - 0.1,
        backgroundColor: hoverLeaveColor,
        borderColor: 'rgba(100, 100, 100, 0)',
        clip: true,
        enter({ element }) {
          element.options.backgroundColor = hoverEnterColor;
          return true;
        },
        leave({ element }) {
          element.options.backgroundColor = hoverLeaveColor;
          return true;
        },
        click() {
          if (onPhaseClick) onPhaseClick(i);
          return true;
        },
      });
    }
  }

  return chartData;
}

function buildPhaseRanges(phases) {
  const ranges = [];
  let start = 0;
  for (const phase of phases) {
    const duration = Number.parseFloat(phase.duration);
    ranges.push({ start, end: start + duration });
    start += duration;
  }
  return ranges;
}

function getPhaseIndexForX(phaseRanges, xValue) {
  for (let i = 0; i < phaseRanges.length; i++) {
    if (xValue <= phaseRanges[i].end) return i;
  }
  return -1;
}

export function ExtendedProfileChart({
  data,
  className = 'max-h-36 w-full',
  selectedPhase = null,
  onPhaseClick = null,
  showPhaseLabels = true,
  style,
}) {
  const isDarkMode = () =>
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const phases = Array.isArray(data?.phases) ? data.phases : [];
  const phaseRanges = buildPhaseRanges(phases);
  const phaseRangesRef = useRef(phaseRanges);
  phaseRangesRef.current = phaseRanges;
  const config = makeChartData(
    data,
    selectedPhase,
    phaseRanges,
    onPhaseClick,
    isDarkMode(),
    showPhaseLabels,
  );

  return (
    <ChartComponent
      className='min-h-0 max-w-full flex-shrink flex-grow'
      chartClassName={`${className}${onPhaseClick ? ' cursor-pointer' : ''}`}
      data={config}
      style={style}
    />
  );
}
