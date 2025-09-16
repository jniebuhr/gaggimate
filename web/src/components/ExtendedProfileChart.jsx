import { useEffect, useRef, useState } from 'preact/hooks';
import { Chart } from 'chart.js';
import { ChartComponent } from './Chart';
import { Chart } from 'chart.js';

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

function makeChartData(data, selectedPhase, isDarkMode = false, _, selectedPointIndex = null) {
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
            usePointStyle: true,
            pointStyle: 'line',
            pointStyleWidth: 20,
            padding: 8,
            font: {
              size: window.innerWidth < 640 ? 10 : 12,
            },
            generateLabels: function(chart) {
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
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const chartRef = useRef(null);
  
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

  // Handle mouse/touch move events for dragging
  useEffect(() => {
    if (!isDragging || !chartRef.current) return;

    let lastUpdateTime = 0;
    const throttleMs = 33; // ~30fps

    const handleMove = (event) => {
      event.preventDefault();
      
      // Throttle mouse events but allow touch events to run unthrottled
      const now = Date.now();
      if (!event.type.includes('touch') && now - lastUpdateTime < throttleMs) {
        return;
      }
      lastUpdateTime = now;
      
      const rect = chartRef.current.getBoundingClientRect();
      let clientX, clientY;
      
      if (event.type.includes('touch')) {
        if (!event.touches || event.touches.length === 0) return;
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
      } else {
        clientX = event.clientX;
        clientY = event.clientY;
      }
      
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      
      // Find closest data point and update selected point
      const chart = chartRef.current.chart;
      if (chart && chart.scales && chart.scales.x && chart.chartArea) {
        // Constrain x and y to chart area bounds
        const chartArea = chart.chartArea;
        const constrainedX = Math.max(chartArea.left, Math.min(chartArea.right, x));
        const constrainedY = Math.max(chartArea.top, Math.min(chartArea.bottom, y));
        
        // Convert constrained position to data value
        const dataX = chart.scales.x.getValueForPixel(constrainedX);
        
        // Update tooltip position to the constrained mouse position
        setTooltipPosition({ x: constrainedX, y: constrainedY });
        
        // Find closest data point
        const datasets = chart.data.datasets;
        if (datasets.length > 0 && datasets[0].data) {
          let closestIndex = 0;
          let minDistance = Infinity;
          
          datasets[0].data.forEach((point, index) => {
            const distance = Math.abs(point.x - dataX);
            if (distance < minDistance) {
              minDistance = distance;
              closestIndex = index;
            }
          });
          
          // Update selected point
          const pointData = {
            time: datasets[0].data[closestIndex].x.toFixed(1),
            pressure: datasets[0].data[closestIndex].y,
            flow: datasets[1] && datasets[1].data[closestIndex] ? datasets[1].data[closestIndex].y : 0,
            dataIndex: closestIndex
          };
          
          setSelectedPoint(pointData);
        }
      }
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    // Add event listeners
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);

    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging]);
  
  const isDarkMode = () =>
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const config = makeChartData(data, selectedPhase, isDarkMode(), null, selectedPoint?.dataIndex);

  // Calculate tooltip position with left/right logic
  const getTooltipStyle = () => {
    if (!selectedPoint || !chartRef.current?.chart) return {};
    
    const chart = chartRef.current.chart;
    const tooltipWidth = 120;
    const padding = 15; // Position tooltip 15px away from the data line
    
    // Get the pixel position of the selected data point on the chart
    const selectedTime = parseFloat(selectedPoint.time);
    const dataPointX = chart.scales.x.getPixelForValue(selectedTime);
    
    // Fallback if dataPointX is invalid
    if (!dataPointX || isNaN(dataPointX)) {
      return {
        fontSize: '11px',
        lineHeight: '1.2',
        left: '100px', // Fallback position
        top: `${tooltipPosition.y - 50}px`, // Use mouse Y position even for fallback
        minWidth: 'auto',
        maxWidth: '120px'
      };
    }
    
    // Determine if tooltip should be to the left or right of the data point
    // Show to the left if there's enough space, otherwise show to the right
    const chartArea = chart.chartArea;
    const distanceFromLeft = dataPointX - chartArea.left;
    
    const showLeft = distanceFromLeft > (tooltipWidth + padding);
    
    // Position tooltip just beside the vertical line (data point)
    const containerWidth = chartRef.current.getBoundingClientRect().width;
    const positioning = showLeft ? 
      { right: `${containerWidth - dataPointX + padding}px` } :
      { left: `${dataPointX + padding}px` };
    
    return {
      fontSize: '11px',
      lineHeight: '1.2',
      ...positioning,
      top: `${tooltipPosition.y - 50}px`, // Follow mouse Y position, offset upward to center tooltip
      minWidth: 'auto',
      maxWidth: '120px'
    };
  };

  return (
    <div className="relative w-full">
      <ChartComponent
        className='w-full'
        chartClassName={className}
        data={config}
        onMouseDown={(e) => {
          const rect = e.target.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          
          // Store chart reference
          chartRef.current = { chart: e.target.chart, getBoundingClientRect: () => rect };
          
          // Find data point at click position
          if (e.target.chart && e.target.chart.scales && e.target.chart.scales.x) {
            // Manual relative position calculation
            const canvasX = x;
            const dataX = e.target.chart.scales.x.getValueForPixel(canvasX);
            
            const datasets = e.target.chart.data.datasets;
            if (datasets.length > 0 && datasets[0].data) {
              let closestIndex = 0;
              let minDistance = Infinity;
              
              datasets[0].data.forEach((point, index) => {
                const distance = Math.abs(point.x - dataX);
                if (distance < minDistance) {
                  minDistance = distance;
                  closestIndex = index;
                }
              });
              
              // Update selected point and start dragging
              const pointData = {
                time: datasets[0].data[closestIndex].x.toFixed(1),
                pressure: datasets[0].data[closestIndex].y,
                flow: datasets[1] && datasets[1].data[closestIndex] ? datasets[1].data[closestIndex].y : 0,
                dataIndex: closestIndex
              };
              
              // Calculate constrained tooltip position relative to data point
              const dataPointX = e.target.chart.scales.x.getPixelForValue(datasets[0].data[closestIndex].x);
              const constrainedX = Math.max(e.target.chart.chartArea.left, Math.min(dataPointX, e.target.chart.chartArea.right));
              const constrainedY = Math.max(e.target.chart.chartArea.top, Math.min(y, e.target.chart.chartArea.bottom));
              
              setSelectedPoint(pointData);
              setTooltipPosition({ x: constrainedX, y: constrainedY });
              setIsDragging(true);
            }
          }
        }}
        onTouchStart={(e) => {
          if (e.touches.length === 1) {
            const rect = e.target.getBoundingClientRect();
            const x = e.touches[0].clientX - rect.left;
            const y = e.touches[0].clientY - rect.top;
            
            // Store chart reference
            chartRef.current = { chart: e.target.chart, getBoundingClientRect: () => rect };
            
            // Find data point at touch position
            if (e.target.chart && e.target.chart.scales && e.target.chart.scales.x) {
              // Manual relative position calculation
              const canvasX = x;
              const dataX = e.target.chart.scales.x.getValueForPixel(canvasX);
              
              const datasets = e.target.chart.data.datasets;
              if (datasets.length > 0 && datasets[0].data) {
                let closestIndex = 0;
                let minDistance = Infinity;
                
                datasets[0].data.forEach((point, index) => {
                  const distance = Math.abs(point.x - dataX);
                  if (distance < minDistance) {
                    minDistance = distance;
                    closestIndex = index;
                  }
                });
                
                // Update selected point and start dragging
                const pointData = {
                  time: datasets[0].data[closestIndex].x.toFixed(1),
                  pressure: datasets[0].data[closestIndex].y,
                  flow: datasets[1] && datasets[1].data[closestIndex] ? datasets[1].data[closestIndex].y : 0,
                  dataIndex: closestIndex
                };
                
                // Calculate constrained tooltip position relative to data point
                const dataPointX = e.target.chart.scales.x.getPixelForValue(datasets[0].data[closestIndex].x);
                const constrainedX = Math.max(e.target.chart.chartArea.left, Math.min(dataPointX, e.target.chart.chartArea.right));
                const constrainedY = Math.max(e.target.chart.chartArea.top, Math.min(y, e.target.chart.chartArea.bottom));
                
                setSelectedPoint(pointData);
                setTooltipPosition({ x: constrainedX, y: constrainedY });
                setIsDragging(true);
              }
            }
          }
        }}
      />
      
      {selectedPoint && (
        <div 
          className="chart-tooltip absolute bg-black/90 p-1.5 rounded border border-gray-400/20 pointer-events-none z-10"
          style={getTooltipStyle()}
        >
          <div className="font-medium mb-0.5 text-white">{selectedPoint.time}s</div>
          <div style={{ color: '#81C784' }}>P: {selectedPoint.pressure.toFixed(1)} bar</div>
          <div style={{ color: '#FFB74D' }}>F: {selectedPoint.flow.toFixed(1)} ml/s</div>
        </div>
      )}
    </div>
  );
}
