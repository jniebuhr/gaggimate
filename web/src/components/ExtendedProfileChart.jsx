import { useEffect, useRef, useState } from 'preact/hooks';
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

function makeChartData(data, selectedPhase, isDarkMode = false, onPointClick = null, selectedPointIndex = null) {
  let duration = 0;
  for (const phase of data.phases) {
    duration += parseFloat(phase.duration);
  }
  
  // Create annotations object for visual indicators
  const annotations = [];
  
  // Add selected point indicators
  if (selectedPointIndex !== null) {
    const pressureData = prepareData(data.phases, 'pressure');
    const flowData = prepareData(data.phases, 'flow');
    
    if (selectedPointIndex < pressureData.length) {
      const selectedTime = pressureData[selectedPointIndex].x;
      const selectedPressure = pressureData[selectedPointIndex].y;
      const selectedFlow = flowData[selectedPointIndex].y;
      
      // Add vertical line at selected point
      annotations.push({
        type: 'line',
        xMin: selectedTime,
        xMax: selectedTime,
        borderColor: '#6366F1', // Indigo color
        borderWidth: 2,
        borderDash: [5, 5]
      });
      
      // Add point indicators
      annotations.push({
        type: 'point',
        xValue: selectedTime,
        yValue: selectedPressure,
        yScaleID: 'y',
        backgroundColor: 'rgb(75, 192, 192)',
        borderColor: '#FFFFFF',
        borderWidth: 2,
        radius: 4
      });
      
      annotations.push({
        type: 'point',
        xValue: selectedTime,
        yValue: selectedFlow,
        yScaleID: 'y1',
        backgroundColor: 'rgb(255, 192, 192)',
        borderColor: '#FFFFFF',
        borderWidth: 2,
        radius: 4
      });
    }
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
      responsive: true,
      maintainAspectRatio: false,
      fill: false,
      interaction: {
        intersect: false,
        mode: 'index',
      },
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
      animations: false,
      radius: 0,
      onClick: onPointClick,
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
  if (selectedPhase !== null) {
    let start = 0;
    for (let i = 0; i < selectedPhase; i++) {
      start += parseFloat(data.phases[i].duration);
    }
    let end = start + parseFloat(data.phases[selectedPhase].duration);
    chartData.options.plugins.annotation = {
      drawTime: 'afterDraw',
      annotations: [
        ...annotations,
        {
          id: 'box1',
          type: 'box',
          xMin: start + 0.1,
          xMax: end + 0.1,
          backgroundColor: 'rgba(0,105,255,0.2)',
          borderColor: 'rgba(100, 100, 100, 0)',
        },
      ],
    };
    start = 0;
    for (let i = 0; i < data.phases.length; i++) {
      chartData.options.plugins.annotation.annotations.push({
        type: 'label',
        xValue: start + data.phases[i].duration / 2,
        yValue: 11,
        content: [i + 1],
        color: isDarkMode ? 'rgb(205,208,212)' : 'rgb(57,78,106)',
        font: {
          size: 14,
          weight: 500,
        },
      });
      start += parseFloat(data.phases[i].duration);
      chartData.options.plugins.annotation.annotations.push({
        type: 'line',
        xMin: start + 0.1,
        xMax: start + 0.1,
        borderColor: 'rgb(128,128,128)',
      });
    }
  } else if (annotations.length > 0) {
    // Add annotations even if no selected phase
    chartData.options.plugins.annotation = {
      drawTime: 'afterDraw',
      annotations: annotations
    };
  }
  return chartData;
}

export function ExtendedProfileChart({
  data,
  className = 'max-h-36 w-full',
  selectedPhase = null,
}) {
  const [selectedPoint, setSelectedPoint] = useState(null);
  
  // Handle clicks outside the tooltip to dismiss it
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if the click is outside the tooltip
      const tooltip = event.target.closest('.chart-tooltip');
      const chart = event.target.closest('canvas');
      
      // If clicking outside tooltip but not on chart, dismiss
      if (!tooltip && !chart && selectedPoint) {
        setSelectedPoint(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [selectedPoint]);
  
  const handlePointClick = (event, elements, chart) => {
    if (elements.length > 0) {
      const dataIndex = elements[0].index;
      const datasets = chart.data.datasets;
      
      // Get values from all datasets at this index
      const pointData = {
        time: datasets[0].data[dataIndex].x.toFixed(1),
        pressure: datasets[0].data[dataIndex].y,
        flow: datasets[1].data[dataIndex].y,
        dataIndex // Store the index for visual indicator
      };
      
      setSelectedPoint(pointData);
    } else {
      setSelectedPoint(null);
    }
  };
  
  const isDarkMode = () =>
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const config = makeChartData(data, selectedPhase, isDarkMode(), handlePointClick, selectedPoint?.dataIndex);

  return (
    <div className="relative w-full">
      <ChartComponent
        className='w-full'
        chartClassName={className}
        data={config}
      />
      
      {selectedPoint && (
        <div 
          className="chart-tooltip absolute bg-black/90 p-1.5 rounded border border-gray-400/20 pointer-events-none"
          style={{
            fontSize: '11px',
            lineHeight: '1.2',
            left: '60px',
            top: '60px',
            minWidth: 'auto',
            maxWidth: '120px'
          }}
        >
          <div className="font-medium mb-0.5 text-white">{selectedPoint.time}s</div>
          <div style={{ color: '#81C784' }}>P: {selectedPoint.pressure.toFixed(1)} bar</div>
          <div style={{ color: '#FFB74D' }}>F: {selectedPoint.flow.toFixed(1)} g/s</div>
        </div>
      )}
    </div>
  );
}
