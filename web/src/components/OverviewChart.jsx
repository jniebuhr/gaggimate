import { machine } from '../services/ApiService.js';
import { ChartComponent } from './Chart.jsx';

// Brew time window constants (in milliseconds)
const BREW_WINDOW_INITIAL = 30000; // First 30 seconds: 30s window
const BREW_WINDOW_GROWING = 45000; // 30-45 seconds: 45s window
const BREW_WINDOW_MAX = 60000; // After 45 seconds: 60s window
const BREW_WINDOW_RECENT = 60000; // Recently finished brewing: 1 minute
const NORMAL_WINDOW = 60000; // Normal mode: 1 minute

// Brew phase tracking state - stored in refs to persist across renders
const brewStateRef = {
  phaseTransitions: [],
  lastKnownPhase: null,
  brewStartTime: null,
  lastProcessState: null,
  initialPhaseName: null,
};

// Function to clear phase transitions (can be called from outside)
export const clearPhaseTransitions = () => {
  brewStateRef.phaseTransitions = [];
  brewStateRef.lastKnownPhase = null;
  brewStateRef.brewStartTime = null;
  brewStateRef.lastProcessState = null;
  brewStateRef.initialPhaseName = null;
};

function getChartData(data, brewState) {
  // Guard against null/undefined/missing data array
  if (!data || !Array.isArray(data) || data.length === 0) {
    return {
      type: 'line',
      data: { datasets: [] },
      options: { responsive: true, maintainAspectRatio: false },
    };
  }

  // Stabilize the end time by clearing milliseconds to prevent jiggling
  let end = new Date();
  end.setMilliseconds(0); // Clear milliseconds for stability

  // Track phase transitions for brew process
  const currentProcess = machine.value.status.process;
  const isBrewActive =
    currentProcess &&
    currentProcess.s &&
    (currentProcess.s === 'brew' || currentProcess.s === 'infusion') &&
    currentProcess.a;

  // Determine time window based on brewing state
  let timeWindowMs;
  let timeUnit = 'second';
  let maxTicksLimit = 5;

  if (isBrewActive) {
    // During brewing: start with 30s window, grow to 45s and 60s for longer shots
    const brewElapsedMs = currentProcess.e || 0;
    const brewElapsedSeconds = brewElapsedMs / 1000;

    if (brewElapsedSeconds < 30) {
      // First 30 seconds: show 30s window
      timeWindowMs = BREW_WINDOW_INITIAL;
    } else if (brewElapsedSeconds < 45) {
      // 30-45 seconds: show 45s window
      timeWindowMs = BREW_WINDOW_GROWING;
    } else {
      // After 45 seconds: show 60s window
      timeWindowMs = BREW_WINDOW_MAX;
    }

    maxTicksLimit = 8; // More ticks for better resolution
  } else if (brewState.phaseTransitions.length > 0) {
    // Recently finished brewing: show a bit more context
    timeWindowMs = BREW_WINDOW_RECENT;
    maxTicksLimit = 6;
  } else {
    // Normal mode: show 1 minute
    timeWindowMs = NORMAL_WINDOW;
    maxTicksLimit = 5;
  }

  let start = new Date(end.getTime() - timeWindowMs);
  // Stabilize start time by rounding to nearest second for consistency
  start.setMilliseconds(0);

  // Filter data to the current time window for auto-scaling
  const filteredData = data.filter(item => item.timestamp >= start && item.timestamp <= end);

  // Calculate auto-scale ranges from visible data
  let tempValues = filteredData.map(i => i.currentTemperature);
  tempValues = tempValues.concat(filteredData.map(i => i.targetTemperature));

  let pressureFlowValues = filteredData.map(i => i.currentPressure);
  pressureFlowValues = pressureFlowValues.concat(filteredData.map(i => i.targetPressure));
  pressureFlowValues = pressureFlowValues.concat(filteredData.map(i => i.currentFlow));

  // Calculate ranges with some padding and round to integers for clean scales
  const tempMin = tempValues.length > 0 ? Math.max(0, Math.floor(Math.min(...tempValues) - 5)) : 0;
  const tempMax = tempValues.length > 0 ? Math.ceil(Math.max(...tempValues) + 10) : 160;

  const pressureFlowMin = 0; // Always start at 0 for pressure/flow
  const pressureFlowMax =
    pressureFlowValues.length > 0 ? Math.ceil(Math.max(...pressureFlowValues) + 2) : 16;

  // Create a state key to detect when a new brew starts
  const processState = currentProcess
    ? `${currentProcess.s}_${currentProcess.a}_${currentProcess.e || 0}`
    : null;

  // Detect brew start/restart - check if we transitioned to active or if process restarted
  if (isBrewActive && (!brewState.brewStartTime || processState !== brewState.lastProcessState)) {
    // If elapsed time is very small (< 2 seconds), this is likely a new brew
    if (!currentProcess.e || currentProcess.e < 2000) {
      brewState.brewStartTime = new Date();
      brewState.phaseTransitions = [];
      brewState.lastKnownPhase = null;
      brewState.initialPhaseName = currentProcess.l; // Capture the initial phase name
    }
  }

  // Detect brew end - process stopped being active
  if (!isBrewActive && brewState.brewStartTime) {
    // Don't immediately clear - let the user see the phase markers for a while
    // They will be cleared when a new brew starts
  }

  // Track phase changes during brewing
  if (isBrewActive && currentProcess.l && brewState.brewStartTime) {
    const currentPhase = currentProcess.l;
    const currentPhaseType = currentProcess.s;

    // Only add transition if phase name actually changed and we're not on the first phase
    if (brewState.lastKnownPhase !== null && brewState.lastKnownPhase !== currentPhase) {
      // Check if we already have this transition (avoid duplicates)
      const existingTransition = brewState.phaseTransitions.find(t => t.phaseName === currentPhase);
      if (!existingTransition) {
        brewState.phaseTransitions.push({
          timestamp: new Date(),
          phaseName: currentPhase,
          phaseType: currentPhaseType,
        });
      }
    }
    brewState.lastKnownPhase = currentPhase;
  }

  brewState.lastProcessState = processState;

  // Create phase annotations for Chart.js
  const phaseAnnotations = {};
  const isSmall = window.innerWidth < 640;
  // Add phase transition lines
  brewState.phaseTransitions.forEach((transition, index) => {
    const transitionTime = transition.timestamp.getTime();
    const chartStart = start.getTime();
    const chartEnd = end.getTime();

    // Only show transitions within chart timeframe
    if (transitionTime >= chartStart && transitionTime <= chartEnd) {
      phaseAnnotations[`phase_line_${index}`] = {
        type: 'line',
        xMin: transition.timestamp.toISOString(),
        xMax: transition.timestamp.toISOString(),
        borderColor: '#06B6D4', // Cyan accent for phase transitions
        borderWidth: 2,
        label: {
          display: true,
          content: transition.phaseName,
          rotation: -90,
          position: 'end',
          xAdjust: -10,
          yAdjust: 0,
          padding: { x: 8, y: 4 },
          color: 'rgb(255,255,255)',
          backgroundColor: 'rgba(22,33,50,0.85)',
          textAlign: 'start',
          font: {
            size: isSmall ? 10 : 12,
            weight: 600,
          },
          clip: false,
        },
      };
    }
  });

  // Add brew start line if within timeframe
  if (brewState.brewStartTime) {
    const brewStartMs = brewState.brewStartTime.getTime();
    const chartStart = start.getTime();
    const chartEnd = end.getTime();

    if (brewStartMs >= chartStart && brewStartMs <= chartEnd) {
      phaseAnnotations['brew_start'] = {
        type: 'line',
        xMin: brewState.brewStartTime.toISOString(),
        xMax: brewState.brewStartTime.toISOString(),
        borderColor: '#06B6D4', // Cyan accent for brew start
        borderWidth: 2,
        label: {
          display: true,
          content: brewState.initialPhaseName || 'Start',
          rotation: -90,
          position: 'end',
          xAdjust: -10,
          yAdjust: 0,
          padding: { x: 8, y: 4 },
          color: 'rgb(255,255,255)',
          backgroundColor: 'rgba(22,33,50,0.85)',
          textAlign: 'start',
          font: {
            size: isSmall ? 10 : 12,
            weight: 600,
          },
          clip: false,
        },
      };
    }
  }

  const latestData = data[data.length - 1];
  const showWeights = latestData && latestData.volumetricAvailable && latestData.brewTarget;
  const datasets = [
    {
      label: 'Current Temperature',
      borderColor: '#F0561D',
      borderWidth: 3,
      tension: 0.3,
      pointStyle: false,
      data: data.map(i => ({ x: i.timestamp.toISOString(), y: i.currentTemperature })),
    },
    {
      label: 'Target Temperature',
      fill: true,
      borderColor: '#731F00',
      borderDash: [6, 6],
      borderWidth: 3,
      tension: 0.3,
      pointStyle: false,
      data: data.map(i => ({ x: i.timestamp.toISOString(), y: i.targetTemperature })),
    },
    {
      label: 'Current Pressure',
      borderColor: '#0066CC',
      borderWidth: 3,
      tension: 0.3,
      pointStyle: false,
      yAxisID: 'y1',
      data: data.map(i => ({ x: i.timestamp.toISOString(), y: i.currentPressure })),
    },
    {
      label: 'Target Pressure',
      fill: true,
      borderColor: '#003366',
      borderDash: [6, 6],
      borderWidth: 3,
      tension: 0.3,
      pointStyle: false,
      yAxisID: 'y1',
      data: data.map(i => ({ x: i.timestamp.toISOString(), y: i.targetPressure })),
    },
    {
      label: 'Current Flow',
      borderColor: '#63993D',
      borderWidth: 3,
      tension: 0.3,
      pointStyle: false,
      yAxisID: 'y1',
      data: data.map(i => ({ x: i.timestamp.toISOString(), y: i.currentFlow })),
    },
  ];
  if (showWeights) {
    datasets.push({
      label: 'Current Weight',
      borderColor: '#8B5CF6',
      borderWidth: 3,
      tension: 0.3,
      pointStyle: false,
      yAxisID: 'y2',
      data: data.map(i => ({ x: i.timestamp.toISOString(), y: i.currentWeight || 0 })),
    });
    datasets.push({
      label: 'Target Weight',
      fill: true,
      borderColor: '#4C1D95',
      borderDash: [6, 6],
      borderWidth: 3,
      tension: 0.3,
      pointStyle: false,
      yAxisID: 'y2',
      data: data.map(i => ({ x: i.timestamp.toISOString(), y: i.activeTargetWeight || 0 })),
    });
  }

  return {
    type: 'line',
    data: {
      datasets: datasets,
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
            pointStyleWidth: 24,
            padding: 12,
            font: {
              size: window.innerWidth < 640 ? 11 : 13,
              weight: 500,
            },
          },
        },
        title: {
          display: true,
          text: isBrewActive
            ? `Brew Progress - ${Math.round(timeWindowMs / 1000)}s View`
            : brewState.phaseTransitions.length > 0
              ? 'Temperature History - Recent Brew'
              : 'Temperature History',
          font: {
            size: window.innerWidth < 640 ? 14 : 16,
            weight: 600,
          },
          padding: {
            top: 8,
            bottom: 12,
          },
        },
        annotation: {
          annotations: phaseAnnotations,
        },
      },
      animation: {
        duration: 150,
        easing: 'easeOutQuart',
      },
      scales: {
        y: {
          type: 'linear',
          min: tempMin,
          max: tempMax,
          ticks: {
            stepSize: 5,
            font: {
              size: window.innerWidth < 640 ? 11 : 13,
              weight: 500,
            },
            callback: value => {
              return `${Math.round(value)}°C`;
            },
            maxRotation: 0,
            minRotation: 0,
          },
          grid: {
            color: 'rgba(128, 128, 128, 0.15)',
          },
        },
        y1: {
          type: 'linear',
          min: pressureFlowMin,
          max: pressureFlowMax,
          position: 'right',
          ticks: {
            stepSize: pressureFlowMax <= 10 ? 1 : 2, // Use smaller steps for smaller ranges
            font: {
              size: window.innerWidth < 640 ? 10 : 12,
            },
            callback: value => {
              return `${Math.round(value * 10) / 10} bar / g/s`; // Round to 1 decimal place
            },
          },
        },
        ...(showWeights && {
          y2: {
            type: 'linear',
            min: 0,
            max: 100,
            position: 'right',
            grid: {
              drawOnChartArea: false,
            },
            ticks: {
              font: {
                size: window.innerWidth < 640 ? 10 : 12,
              },
              callback: value => {
                return `${value}g`;
              },
            },
          },
        }),
        x: {
          type: 'time',
          min: start,
          max: end,
          time: {
            unit: timeUnit,
            stepSize: 1, // Force consistent step size
            displayFormats: {
              second: isBrewActive ? 'mm:ss' : 'HH:mm:ss',
            },
          },
          ticks: {
            source: 'auto',
            autoSkip: true,
            autoSkipPadding: 0,
            callback: (value) => {
              if (isBrewActive) {
                // For brewing: show relative time from chart end in a clean format
                const chartEnd = end.getTime();
                const diffSeconds = Math.ceil((chartEnd - value) / 1000);
                if (diffSeconds < 60) {
                  return `${diffSeconds}s`;
                } else {
                  const minutes = Math.floor(diffSeconds / 60);
                  const seconds = diffSeconds % 60;
                  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
                }
              } else {
                // For normal view: show time ago from chart end
                const chartEnd = end.getTime();
                const diff = Math.ceil((chartEnd - value) / 1000);
                return `-${diff}s`;
              }
            },
            font: {
              size: window.innerWidth < 640 ? 10 : 12,
            },
            maxTicksLimit: maxTicksLimit,
          },
        },
      },
    },
  };
}

export function OverviewChart() {
  // Pass brewStateRef to getChartData for phase tracking
  const chartData = getChartData(machine.value.history, brewStateRef);

  return (
    <ChartComponent
      className='h-full min-h-[200px] w-full flex-1 lg:min-h-[350px]'
      chartClassName='h-full w-full'
      data={chartData}
    />
  );
}
