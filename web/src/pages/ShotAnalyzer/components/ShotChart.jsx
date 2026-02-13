/**
 * ShotChart.jsx
 * Chart.js visualization component for shot data.
 * Displays pressure, flow, puck flow, temperature, and weight over time.
 */

import { useEffect, useRef } from 'preact/hooks';
import Chart from 'chart.js/auto';
import annotationPlugin from 'chartjs-plugin-annotation';

// Register the annotation plugin for Phase Lines
Chart.register(annotationPlugin);

// --- Helper Functions ---

/**
 * Retrieves the phase name for a specific phase number.
 * @param {Object} shot - The shot data object.
 * @param {number} phaseNumber - The index of the phase.
 * @returns {string} The name of the phase or a fallback name.
 */
function getPhaseName(shot, phaseNumber) {
  // 1. Try to find the name in the logged phase transitions
  if (shot.phaseTransitions && shot.phaseTransitions.length > 0) {
    const transition = shot.phaseTransitions.find(t => t.phaseNumber === phaseNumber);
    if (transition && transition.phaseName) {
      return transition.phaseName;
    }
  }
  
  // 2. Fallback: Try to get it from the original profile definition if embedded
  if (shot.profile && shot.profile.phases && shot.profile.phases[phaseNumber]) {
    return shot.profile.phases[phaseNumber].name;
  }
  
  // 3. Fallback to guarantee a label is rendered
  return phaseNumber === 0 ? 'Start' : `P${phaseNumber + 1}`;
}

/**
 * ShotChart Component
 * Renders a line chart using Chart.js.
 */
export function ShotChart({ shotData }) {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    // Validation: Ensure data exists before rendering
    if (!shotData || !shotData.samples || shotData.samples.length === 0) {
      return;
    }

    // Cleanup: Destroy existing chart instance to prevent memory leaks/visual glitches
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    // Responsive check for font sizing
    const isSmall = window.innerWidth < 640;

    // GaggiMate Color Scheme Definition
    const COLORS = {
      // Reverted to solid GaggiMate Red
      temp: '#F0561D',
      tempTarget: '#731F00',
      pressure: '#0066CC',
      flow: '#63993D',
      puckFlow: '#059669',
      weight: '#8B5CF6',
    };

    const samples = shotData.samples;

    // Calculate the exact end time of the shot to prevent empty chart space
    const maxTime = samples.length > 0 ? (samples[samples.length - 1].t || 0) / 1000 : 0;

    // Helper to safely extract values from sample objects
    const getVal = (item, keys) => {
      for (let k of keys) {
        if (item[k] !== undefined) return item[k];
      }
      return null;
    };

    // Initialize data series arrays
    const series = {
      pressure: [],
      flow: [],
      puckFlow: [],
      temp: [],
      weight: [],
      targetPressure: [],
      targetFlow: [],
      targetTemp: [],
    };

    // Parse samples into series
    samples.forEach(d => {
      const t = (d.t || 0) / 1000;

      // Extract raw values
      const press = getVal(d, ['cp', 'p', 'pressure']);
      const flow = getVal(d, ['fl', 'f', 'flow']);
      const pFlow = getVal(d, ['pf', 'puck_flow']);
      const temp = getVal(d, ['ct', 't', 'temperature']);
      const weight = getVal(d, ['v', 'w', 'weight', 'm']);

      // Extract target values
      const tPress = getVal(d, ['tp', 'target_pressure']);
      const tFlow = getVal(d, ['tf', 'target_flow']);
      const tTemp = getVal(d, ['tt', 'tr', 'target_temperature']);

      // Populate series
      if (press !== null) series.pressure.push({ x: t, y: press });
      if (flow !== null) series.flow.push({ x: t, y: flow });
      if (pFlow !== null) series.puckFlow.push({ x: t, y: pFlow });
      if (temp !== null) series.temp.push({ x: t, y: temp });
      if (weight !== null) series.weight.push({ x: t, y: weight });

      if (tPress !== null) series.targetPressure.push({ x: t, y: tPress });
      if (tFlow !== null) series.targetFlow.push({ x: t, y: tFlow });
      if (tTemp !== null) series.targetTemp.push({ x: t, y: tTemp });
    });

    // Check if weight data exists to determine if secondary axis is needed
    const hasWeight = series.weight.some(pt => pt.y > 0);

    // --- Phase Annotation Logic ---
    const phaseAnnotations = {};
    if (shotData.phaseTransitions && shotData.phaseTransitions.length > 0) {
      // 1. Mark the absolute start of the shot
      if (samples.length > 0) {
        const shotStartTime = (samples[0].t || 0) / 1000;
        phaseAnnotations['shot_start'] = {
          type: 'line',
          scaleID: 'x',
          value: shotStartTime,
          borderColor: 'rgba(107, 114, 128, 0.5)', // Gray-500 with opacity
          borderWidth: 1,
          label: {
            display: true,
            content: getPhaseName(shotData, 0),
            rotation: -90,
            position: 'start', // Start = Top of the chart
            yAdjust: 15,       // Stick near the top uniformly
            xAdjust: 10,       // Shift to the right side of the line
            color: 'rgba(255, 255, 255, 0.95)',
            backgroundColor: 'rgba(0, 0, 0, 0.6)', // Theme-agnostic contrast box
            borderRadius: 3,
            padding: 4,
            font: { size: 9 },
          },
        };
      }

      // 2. Mark subsequent phase transitions
      shotData.phaseTransitions.forEach((transition, index) => {
        let timeInSeconds = 0;
        if (transition.sampleIndex !== undefined && samples[transition.sampleIndex]) {
          timeInSeconds = (samples[transition.sampleIndex].t || 0) / 1000;
        } else if (transition.sampleIndex !== undefined) {
          timeInSeconds = (transition.sampleIndex * (shotData.sampleInterval || 250)) / 1000;
        }

        if (timeInSeconds <= 0.1 && index === 0) return;

        phaseAnnotations[`phase_line_${index}`] = {
          type: 'line',
          scaleID: 'x',
          value: timeInSeconds,
          borderColor: 'rgba(107, 114, 128, 0.5)',
          borderWidth: 1,
          label: {
            display: true,
            content: transition.phaseName || `P${transition.phaseNumber + 1}`,
            rotation: -90,
            position: 'start', // Start = Top of the chart
            yAdjust: 15,       // Keep uniformly at the same height
            xAdjust: 10,       // Shift to the right side of the line
            color: 'rgba(255, 255, 255, 0.95)',
            backgroundColor: 'rgba(0, 0, 0, 0.6)', // Theme-agnostic contrast box
            borderRadius: 3,
            padding: 4,
            font: { size: 9 },
          },
        };
      });
    }

    // --- Dataset Configuration ---
    const datasets = [
      {
        label: 'Temp (°C)',
        data: series.temp,
        borderColor: COLORS.temp,
        backgroundColor: COLORS.temp,
        yAxisID: 'y',
        pointRadius: 0,
        borderWidth: 1, // Reduced to 1
        tension: 0.2,
      },
      {
        label: 'Pressure (bar)',
        data: series.pressure,
        borderColor: COLORS.pressure,
        backgroundColor: COLORS.pressure,
        yAxisID: 'y1',
        pointRadius: 0,
        borderWidth: 2,
        tension: 0.2,
      },
      {
        label: 'Flow (ml/s)',
        data: series.flow,
        borderColor: COLORS.flow,
        backgroundColor: COLORS.flow,
        yAxisID: 'y1',
        pointRadius: 0,
        borderWidth: 2,
        tension: 0.2,
      },
      {
        label: 'Puck Flow',
        data: series.puckFlow,
        borderColor: COLORS.puckFlow,
        backgroundColor: COLORS.puckFlow,
        yAxisID: 'y1',
        pointRadius: 0,
        borderWidth: 1.5,
        tension: 0.2,
      },
      {
        label: 'Weight (g)',
        data: series.weight,
        borderColor: COLORS.weight,
        backgroundColor: COLORS.weight,
        yAxisID: 'y2',
        pointRadius: 0,
        borderWidth: 1, // Reduced to 1
        tension: 0.2,
        hidden: !hasWeight,
      },
      // Dashed Target Lines
      {
        label: 'Target P',
        data: series.targetPressure,
        borderColor: COLORS.pressure,
        borderDash: [4, 4],
        yAxisID: 'y1',
        pointRadius: 0,
        borderWidth: 1,
        tension: 0,
      },
      {
        label: 'Target F',
        data: series.targetFlow,
        borderColor: COLORS.flow,
        borderDash: [4, 4],
        yAxisID: 'y1',
        pointRadius: 0,
        borderWidth: 1,
        tension: 0,
      },
      {
        label: 'Target T',
        data: series.targetTemp,
        borderColor: COLORS.tempTarget,
        borderDash: [4, 4],
        yAxisID: 'y',
        pointRadius: 0,
        borderWidth: 1,
        tension: 0,
      },
    ];

    // --- Chart Configuration ---
    chartInstance.current = new Chart(chartRef.current, {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              usePointStyle: true,
              pointStyle: 'line',
              pointStyleWidth: 20,
              padding: 8,
              font: { size: 10 },
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
          tooltip: {
            enabled: true,
            backgroundColor: 'rgba(20, 20, 20, 0.9)',
            titleFont: { size: 11 },
            bodyFont: { size: 10 },
            padding: 8,
            cornerRadius: 4,
            callbacks: {
              label: function (context) {
                let label = context.dataset.label || '';
                if (label) label += ': ';
                if (context.parsed.y !== null) {
                  label += context.parsed.y.toFixed(1);
                }
                return label;
              },
            },
          },
          annotation: {
            annotations: phaseAnnotations,
          },
        },
        // --- Scale Configuration ---
        scales: {
          x: {
            type: 'linear',
            position: 'bottom',
            max: maxTime, // Forces the axis to stop exactly at the last sample
            ticks: {
              font: { size: 10 },
              color: '#888',
            },
            grid: {
              color: 'rgba(200, 200, 200, 0.1)',
            },
          },
          // Left Axis: Temperature
          y: {
            type: 'linear',
            position: 'left',
            ticks: {
              font: { size: 10 },
              color: COLORS.temp,
            },
            grid: {
              color: 'rgba(200, 200, 200, 0.1)',
            },
          },
          // Right Axis 1: Pressure & Flow & Puck Flow
          y1: {
            type: 'linear',
            position: 'right',
            min: 0,
            max: 14,
            ticks: {
              font: { size: 10 },
              color: COLORS.pressure,
            },
            grid: { display: false },
          },
          // Right Axis 2: Weight
          y2: {
            type: 'linear',
            display: hasWeight ? 'auto' : false,
            position: 'right',
            grid: { display: false },
            min: 0,
            ticks: {
              font: { size: 10 },
              color: COLORS.weight,
            },
          },
        },
      },
    });

    // Cleanup function on unmount
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [shotData]);

  // Render nothing if no data
  if (!shotData || !shotData.samples || shotData.samples.length === 0) {
    return null;
  }

  // Container: 320px height, 100% width
  return (
    <div className='relative h-[320px] w-full select-none'>
      <canvas ref={chartRef} />
    </div>
  );
}
