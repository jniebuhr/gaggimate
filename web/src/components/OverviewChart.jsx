import { machine } from '../services/ApiService.js';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Chart } from 'chart.js';
import { ChartComponent } from './Chart.jsx';

// Global state to track phase transitions during brewing
let phaseTransitions = [];
let lastKnownPhase = null;
let brewStartTime = null;
let lastProcessState = null;
let initialPhaseName = null; // Store the first phase name

// Function to clear phase transitions (can be called from outside)
export const clearPhaseTransitions = () => {
  phaseTransitions = [];
  lastKnownPhase = null;
  brewStartTime = null;
  lastProcessState = null;
  initialPhaseName = null;
};

function getChartData(data) {
  let end = new Date();
  
  // Track phase transitions for brew process
  const currentProcess = machine.value.status.process;
  const isBrewActive = currentProcess && currentProcess.s && 
    (currentProcess.s === 'brew' || currentProcess.s === 'infusion') && currentProcess.a;
  
  // Determine time window based on brewing state
  let timeWindowMs;
  let timeUnit = 'second';
  let maxTicksLimit = 5;
  
  if (isBrewActive) {
    // During brewing: start with 10s window, grow to 60s as brew progresses
    const brewElapsedMs = currentProcess.e || 0;
    const brewElapsedSeconds = brewElapsedMs / 1000;
    
    if (brewElapsedSeconds < 10) {
      // First 10 seconds: show 10s window
      timeWindowMs = 10000;
    } else if (brewElapsedSeconds < 30) {
      // 10-30 seconds: grow from 10s to 30s
      timeWindowMs = Math.min(30000, brewElapsedMs + 5000);
    } else {
      // After 30 seconds: grow from 30s to 60s
      timeWindowMs = Math.min(60000, brewElapsedMs + 10000);
    }
    
    maxTicksLimit = 8; // More ticks for better resolution
  } else if (phaseTransitions.length > 0) {
    // Recently finished brewing: show a bit more context
    timeWindowMs = 60000; // 1 minute
    maxTicksLimit = 6;
  } else {
    // Normal mode: show 1 minute
    timeWindowMs = 60000;
    maxTicksLimit = 5;
  }
  
  let start = new Date(end.getTime() - timeWindowMs);
  
  // Filter data to the current time window for auto-scaling
  const filteredData = data.filter(item => 
    item.timestamp >= start && item.timestamp <= end
  );
  
  // Calculate auto-scale ranges from visible data
  let tempValues = filteredData.map(i => i.currentTemperature);
  tempValues = tempValues.concat(filteredData.map(i => i.targetTemperature));
  
  let pressureFlowValues = filteredData.map(i => i.currentPressure);
  pressureFlowValues = pressureFlowValues.concat(filteredData.map(i => i.targetPressure));
  pressureFlowValues = pressureFlowValues.concat(filteredData.map(i => i.currentFlow));
  
  // Calculate ranges with some padding
  const tempMin = tempValues.length > 0 ? Math.max(0, Math.min(...tempValues) - 5) : 0;
  const tempMax = tempValues.length > 0 ? Math.max(...tempValues) + 10 : 160;
  
  const pressureFlowMin = 0; // Always start at 0 for pressure/flow
  const pressureFlowMax = pressureFlowValues.length > 0 ? Math.max(...pressureFlowValues) + 2 : 16;
  
  // Create a state key to detect when a new brew starts
  const processState = currentProcess ? `${currentProcess.s}_${currentProcess.a}_${currentProcess.e || 0}` : null;
  
  // Detect brew start/restart - check if we transitioned to active or if process restarted
  if (isBrewActive && (!brewStartTime || processState !== lastProcessState)) {
    // If elapsed time is very small (< 2 seconds), this is likely a new brew
    if (!currentProcess.e || currentProcess.e < 2000) {
      brewStartTime = new Date();
      phaseTransitions = [];
      lastKnownPhase = null;
      initialPhaseName = currentProcess.l; // Capture the initial phase name
    }
  }
  
  // Detect brew end - process stopped being active
  if (!isBrewActive && brewStartTime) {
    // Don't immediately clear - let the user see the phase markers for a while
    // They will be cleared when a new brew starts
  }
  
  // Track phase changes during brewing
  if (isBrewActive && currentProcess.l && brewStartTime) {
    const currentPhase = currentProcess.l;
    const currentPhaseType = currentProcess.s;
    
    // Only add transition if phase name actually changed and we're not on the first phase
    if (lastKnownPhase !== null && lastKnownPhase !== currentPhase) {
      // Check if we already have this transition (avoid duplicates)
      const existingTransition = phaseTransitions.find(t => t.phaseName === currentPhase);
      if (!existingTransition) {
        phaseTransitions.push({
          timestamp: new Date(),
          phaseName: currentPhase,
          phaseType: currentPhaseType
        });
      }
    }
    lastKnownPhase = currentPhase;
  }
  
  lastProcessState = processState;
  
  // Create phase annotations for Chart.js
  const phaseAnnotations = {};
  const isSmall = window.innerWidth < 640;
  // Add phase transition lines
  phaseTransitions.forEach((transition, index) => {
    const transitionTime = transition.timestamp.getTime();
    const chartStart = start.getTime();
    const chartEnd = end.getTime();
    
    // Only show transitions within chart timeframe
    if (transitionTime >= chartStart && transitionTime <= chartEnd) {
      phaseAnnotations[`phase_line_${index}`] = {
        type: 'line',
        xMin: transition.timestamp.toISOString(),
        xMax: transition.timestamp.toISOString(),
        borderColor: '#22C55E', // Light green for all phase transitions
        borderWidth: 1, // Thinner line
        label: {
          display: true,
          content: transition.phaseName,
          rotation: -90,
          position: 'end', // anchor at top of line
          xAdjust: -10, // tweak first label inward to compensate for y-axis padding
          yAdjust: 0,
          padding: 0,
          color: 'rgb(255,255,255)',
          backgroundColor: 'rgba(22,33,50,0.65)',
          textAlign: 'start',
          font: {
            size: isSmall ? 9 : 11,
            weight: 500,
          },
          clip: false,
        }
      };
    }
  });
  
  // Add brew start line if within timeframe
  if (brewStartTime) {
    const brewStartMs = brewStartTime.getTime();
    const chartStart = start.getTime();
    const chartEnd = end.getTime();
    
    if (brewStartMs >= chartStart && brewStartMs <= chartEnd) {
      phaseAnnotations['brew_start'] = {
        type: 'line',
        xMin: brewStartTime.toISOString(),
        xMax: brewStartTime.toISOString(),
        borderColor: '#10B981', // Keep the darker green for brew start
        borderWidth: 2, // Slightly thicker for brew start
        label: {
          display: true,
          content: initialPhaseName || 'Start',
          rotation: -90,
          position: 'end', // anchor at top of line
          xAdjust: -10, // tweak first label inward to compensate for y-axis padding
          yAdjust: 0,
          padding: 0,
          color: 'rgb(255,255,255)',
          backgroundColor: 'rgba(22,33,50,0.65)',
          textAlign: 'start',
          font: {
            size: isSmall ? 9 : 11,
            weight: 500,
          },
          clip: false,
        }
      };
    }
  }

  
  return {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'Current Temperature',
          borderColor: '#F0561D',
          pointStyle: false,
          data: data.map(i => ({ x: i.timestamp.toISOString(), y: i.currentTemperature })),
        },
        {
          label: 'Target Temperature',
          fill: true,
          borderColor: '#731F00',
          borderDash: [6, 6],
          pointStyle: false,
          data: data.map(i => ({ x: i.timestamp.toISOString(), y: i.targetTemperature })),
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
          display: true,
          text: isBrewActive ? 
            `Brew Progress - ${Math.round(timeWindowMs/1000)}s View` :
            (phaseTransitions.length > 0 ? 
              'Temperature History - Recent Brew' : 
              'Temperature History'),
          font: {
            size: window.innerWidth < 640 ? 14 : 16,
          },
        },
        annotation: {
          annotations: annotations
        }
      },
      animation: false,
      scales: {
        y: {
          type: 'linear',
          min: tempMin,
          max: tempMax,
          ticks: {
            font: {
              size: window.innerWidth < 640 ? 10 : 12,
            },
            callback: value => {
              return `${value} °C`;
            },
          },
        },
        y1: {
          type: 'linear',
          min: pressureFlowMin,
          max: pressureFlowMax,
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
            unit: timeUnit,
            displayFormats: {
              second: isBrewActive ? 'mm:ss' : 'HH:mm:ss',
            },
          },
          ticks: {
            source: 'auto',
            callback: (value, index, ticks) => {
              if (isBrewActive) {
                // For brewing: show relative time from now in a clean format
                const now = new Date().getTime();
                const diffSeconds = Math.ceil((now - value) / 1000);
                if (diffSeconds < 60) {
                  return `${diffSeconds}s`;
                } else {
                  const minutes = Math.floor(diffSeconds / 60);
                  const seconds = diffSeconds % 60;
                  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
                }
              } else {
                // For normal view: show time ago
                const now = new Date().getTime();
                const diff = Math.ceil((now - value) / 1000);
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
  const chartData = getChartData(machine.value.history);

  return (
    <ChartComponent
      className='h-full min-h-[200px] w-full flex-1 lg:min-h-[350px]'
      chartClassName='h-full w-full'
      data={chartData}
    />
  );
}
