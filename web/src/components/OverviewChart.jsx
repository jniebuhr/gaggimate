import { machine } from '../services/ApiService.js';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Chart } from 'chart.js';
import { ChartComponent } from './Chart.jsx';

function getChartData(data, _, selectedPointIndex = null) {
  // Create annotations object for visual indicators
  const annotations = {};
  
  // Add selected point indicators
  if (selectedPointIndex !== null && selectedPointIndex < data.length) {
    const selectedTimestamp = data[selectedPointIndex].timestamp.toISOString();
    
    // Add vertical line at selected point
    annotations['selected_line'] = {
      type: 'line',
      xMin: selectedTimestamp,
      xMax: selectedTimestamp,
      borderColor: '#6366F1', // Indigo color
      borderWidth: 2,
      borderDash: [5, 5],
      label: {
        enabled: false
      }
    };
    
    // Add point indicators for each dataset
    const datasetColors = ['#F0561D', '#731F00', '#0066CC', '#003366', '#63993D'];
    const yAxisIds = ['y', 'y', 'y1', 'y1', 'y1'];
    const values = [
      data[selectedPointIndex].currentTemperature,
      data[selectedPointIndex].targetTemperature,
      data[selectedPointIndex].currentPressure,
      data[selectedPointIndex].targetPressure,
      data[selectedPointIndex].currentFlow
    ];
    
    values.forEach((value, index) => {
      annotations[`selected_point_${index}`] = {
        type: 'point',
        xValue: selectedTimestamp,
        yValue: value,
        yScaleID: yAxisIds[index],
        backgroundColor: datasetColors[index],
        borderColor: '#FFFFFF',
        borderWidth: 2,
        radius: 4
      };
    });
  }
  
  let end = new Date();
  let start = new Date(end.getTime() - 300000);
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
            boxWidth: 12,
            padding: 8,
            font: {
              size: window.innerWidth < 640 ? 10 : 12,
            },
          },
        },
        title: {
          display: true,
          text: 'Temperature History',
          font: {
            size: window.innerWidth < 640 ? 14 : 16,
          },
        },
        annotation: {
          annotations: annotations
        }
      },
      animation: false,
      interaction: {
        intersect: false,
        mode: 'index',
      },
      scales: {
        y: {
          type: 'linear',
          min: 0,
          max: 160,
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
          min: 0,
          max: 16,
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
            unit: 'second',
            displayFormats: {
              second: 'HH:mm:ss',
            },
          },
          ticks: {
            source: 'auto',
            callback: (value, index, ticks) => {
              const now = new Date().getTime();
              const diff = Math.ceil((now - value) / 1000);
              return `-${diff}s`;
            },
            font: {
              size: window.innerWidth < 640 ? 10 : 12,
            },
            maxTicksLimit: 5,
          },
        },
      },
    },
  };
}

export function OverviewChart() {
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
            const pointTime = new Date(point.x).getTime();
            const distance = Math.abs(pointTime - dataX);
            if (distance < minDistance) {
              minDistance = distance;
              closestIndex = index;
            }
          });
          
          // Update selected point
          const pointData = {
            timestamp: new Date(datasets[0].data[closestIndex].x),
            currentTemperature: datasets[0].data[closestIndex].y,
            targetTemperature: datasets[1] && datasets[1].data[closestIndex] ? datasets[1].data[closestIndex].y : 0,
            currentPressure: datasets[2] && datasets[2].data[closestIndex] ? datasets[2].data[closestIndex].y : 0,
            targetPressure: datasets[3] && datasets[3].data[closestIndex] ? datasets[3].data[closestIndex].y : 0,
            currentFlow: datasets[4] && datasets[4].data[closestIndex] ? datasets[4].data[closestIndex].y : 0,
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
  
  const handlePointClick = (event, elements, chart) => {
    if (elements.length > 0) {
      const dataIndex = elements[0].index;
      const datasets = chart.data.datasets;
      
      // Get values from all datasets at this index
      const pointData = {
        timestamp: new Date(datasets[0].data[dataIndex].x),
        currentTemperature: datasets[0].data[dataIndex].y,
        targetTemperature: datasets[1].data[dataIndex].y,
        currentPressure: datasets[2].data[dataIndex].y,
        targetPressure: datasets[3].data[dataIndex].y,
        currentFlow: datasets[4].data[dataIndex].y,
        dataIndex // Store the index for visual indicator
      };
      
      setSelectedPoint(pointData);
    } else {
      setSelectedPoint(null);
    }
  };

  const chartData = getChartData(machine.value.history, null, selectedPoint?.dataIndex);

  // Calculate tooltip position with left/right logic
  const getTooltipStyle = () => {
    if (!selectedPoint || !chartRef.current?.chart) return {};
    
    const chart = chartRef.current.chart;
    const tooltipWidth = 150;
    const padding = 15; // Position tooltip 15px away from the data line
    
    // Get the pixel position of the selected data point on the chart
    // Use timestamp in milliseconds instead of ISO string for Chart.js time scale
    const selectedTimestamp = selectedPoint.timestamp.getTime();
    const dataPointX = chart.scales.x.getPixelForValue(selectedTimestamp);
    
    // Fallback if dataPointX is invalid
    if (!dataPointX || isNaN(dataPointX)) {
      return {
        fontSize: '11px',
        lineHeight: '1.2',
        left: '100px', // Fallback position
        top: `${tooltipPosition.y - 50}px`, // Use mouse Y position even for fallback
        minWidth: 'auto',
        maxWidth: '150px'
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
      maxWidth: '150px'
    };
  };

  return (
    <div className="relative h-full w-full">
      <ChartComponent
        className='h-full min-h-[200px] w-full flex-1 lg:min-h-[350px]'
        chartClassName='h-full w-full'
        data={chartData}
        onMouseDown={(e) => {
          const rect = e.target.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          
          // Store chart reference
          chartRef.current = { chart: e.target.chart, getBoundingClientRect: () => rect };
          
          // Find data point at click position
          if (e.target.chart && e.target.chart.scales && e.target.chart.scales.x && e.target.chart.chartArea) {
            // Constrain click to chart area bounds
            const chartArea = e.target.chart.chartArea;
            const constrainedX = Math.max(chartArea.left, Math.min(chartArea.right, x));
            const constrainedY = Math.max(chartArea.top, Math.min(chartArea.bottom, y));
            
            // Convert constrained position to data value
            const dataX = e.target.chart.scales.x.getValueForPixel(constrainedX);
            
            // Update tooltip position immediately to constrained position
            setTooltipPosition({ x: constrainedX, y: constrainedY });
            
            const datasets = e.target.chart.data.datasets;
            if (datasets.length > 0 && datasets[0].data) {
              let closestIndex = 0;
              let minDistance = Infinity;
              
              datasets[0].data.forEach((point, index) => {
                const pointTime = new Date(point.x).getTime();
                const distance = Math.abs(pointTime - dataX);
                if (distance < minDistance) {
                  minDistance = distance;
                  closestIndex = index;
                }
              });
              
              // Update selected point and start dragging
              const pointData = {
                timestamp: new Date(datasets[0].data[closestIndex].x),
                currentTemperature: datasets[0].data[closestIndex].y,
                targetTemperature: datasets[1] && datasets[1].data[closestIndex] ? datasets[1].data[closestIndex].y : 0,
                currentPressure: datasets[2] && datasets[2].data[closestIndex] ? datasets[2].data[closestIndex].y : 0,
                targetPressure: datasets[3] && datasets[3].data[closestIndex] ? datasets[3].data[closestIndex].y : 0,
                currentFlow: datasets[4] && datasets[4].data[closestIndex] ? datasets[4].data[closestIndex].y : 0,
                dataIndex: closestIndex
              };
              
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
            if (e.target.chart && e.target.chart.scales && e.target.chart.scales.x && e.target.chart.chartArea) {
              // Constrain touch to chart area bounds
              const chartArea = e.target.chart.chartArea;
              const constrainedX = Math.max(chartArea.left, Math.min(chartArea.right, x));
              const constrainedY = Math.max(chartArea.top, Math.min(chartArea.bottom, y));
              
              // Convert constrained position to data value
              const dataX = e.target.chart.scales.x.getValueForPixel(constrainedX);
              
              // Update tooltip position immediately to constrained position
              setTooltipPosition({ x: constrainedX, y: constrainedY });
              
              const datasets = e.target.chart.data.datasets;
              if (datasets.length > 0 && datasets[0].data) {
                let closestIndex = 0;
                let minDistance = Infinity;
                
                datasets[0].data.forEach((point, index) => {
                  const pointTime = new Date(point.x).getTime();
                  const distance = Math.abs(pointTime - dataX);
                  if (distance < minDistance) {
                    minDistance = distance;
                    closestIndex = index;
                  }
                });
                
                // Update selected point and start dragging
                const pointData = {
                  timestamp: new Date(datasets[0].data[closestIndex].x),
                  currentTemperature: datasets[0].data[closestIndex].y,
                  targetTemperature: datasets[1] && datasets[1].data[closestIndex] ? datasets[1].data[closestIndex].y : 0,
                  currentPressure: datasets[2] && datasets[2].data[closestIndex] ? datasets[2].data[closestIndex].y : 0,
                  targetPressure: datasets[3] && datasets[3].data[closestIndex] ? datasets[3].data[closestIndex].y : 0,
                  currentFlow: datasets[4] && datasets[4].data[closestIndex] ? datasets[4].data[closestIndex].y : 0,
                  dataIndex: closestIndex
                };
                
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
          <div className="font-medium mb-0.5 text-white">{selectedPoint.timestamp.toLocaleTimeString()}</div>
          <div style={{ color: '#FFB74D' }}>T: {selectedPoint.currentTemperature.toFixed(1)}/{selectedPoint.targetTemperature.toFixed(1)}°C</div>
          <div style={{ color: '#4FC3F7' }}>P: {selectedPoint.currentPressure.toFixed(1)}/{selectedPoint.targetPressure.toFixed(1)} bar</div>
          <div style={{ color: '#81C784' }}>F: {selectedPoint.currentFlow.toFixed(1)} g/s</div>
        </div>
      )}
    </div>
  );
}
