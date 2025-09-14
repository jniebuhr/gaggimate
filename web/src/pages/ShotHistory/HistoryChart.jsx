import { useEffect, useRef, useState } from 'preact/hooks';
import { Chart } from 'chart.js';
import { ChartComponent } from '../../components/Chart.jsx';

function getChartData(data, _, selectedPointIndex = null) {
  // Create annotations object for visual indicators
  const annotations = {};
  
  // Add selected point indicators
  if (selectedPointIndex !== null && selectedPointIndex < data.length) {
    const selectedTime = data[selectedPointIndex].t / 1000;
    
    // Add vertical line at selected point
    annotations['selected_line'] = {
      type: 'line',
      xMin: selectedTime,
      xMax: selectedTime,
      borderColor: '#6366F1', // Indigo color
      borderWidth: 2,
      borderDash: [5, 5],
      label: {
        enabled: false
      }
    };
    
    // Add point indicators for each dataset
    const datasetColors = ['#F0561D', '#731F00', '#0066CC', '#0066CC', '#63993D', '#204D00', '#63993D'];
    const yAxisIds = ['y', 'y', 'y1', 'y1', 'y1', 'y1', 'y1'];
    const values = [
      data[selectedPointIndex].ct,
      data[selectedPointIndex].tt,
      data[selectedPointIndex].cp,
      data[selectedPointIndex].tp,
      data[selectedPointIndex].fl,
      data[selectedPointIndex].pf,
      data[selectedPointIndex].tf
    ];
    
    values.forEach((value, index) => {
      annotations[`selected_point_${index}`] = {
        type: 'point',
        xValue: selectedTime,
        yValue: value,
        yScaleID: yAxisIds[index],
        backgroundColor: datasetColors[index],
        borderColor: '#FFFFFF',
        borderWidth: 2,
        radius: 4
      };
    });
  }
  
  let start = 0;
  return {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'Current Temperature',
          borderColor: '#F0561D',
          pointStyle: false,
          data: data.map((i, idx) => ({ x: i.t / 1000, y: i.ct })),
        },
        {
          label: 'Target Temperature',
          fill: true,
          borderColor: '#731F00',
          borderDash: [6, 6],
          pointStyle: false,
          data: data.map((i, idx) => ({ x: i.t / 1000, y: i.tt })),
        },
        {
          label: 'Current Pressure',
          borderColor: '#0066CC',
          pointStyle: false,
          yAxisID: 'y1',
          data: data.map((i, idx) => ({ x: i.t / 1000, y: i.cp })),
        },
        {
          label: 'Target Pressure',
          fill: true,
          borderColor: '#0066CC',
          borderDash: [6, 6],
          pointStyle: false,
          yAxisID: 'y1',
          data: data.map((i, idx) => ({ x: i.t / 1000, y: i.tp })),
        },
        {
          label: 'Current Pump Flow',
          borderColor: '#63993D',
          pointStyle: false,
          yAxisID: 'y1',
          data: data.map((i, idx) => ({ x: i.t / 1000, y: i.fl })),
        },
        {
          label: 'Current Puck Flow',
          borderColor: '#204D00',
          pointStyle: false,
          yAxisID: 'y1',
          data: data.map((i, idx) => ({ x: i.t / 1000, y: i.pf })),
        },
        {
          label: 'Target Pump Flow',
          borderColor: '#63993D',
          borderDash: [6, 6],
          pointStyle: false,
          yAxisID: 'y1',
          data: data.map((i, idx) => ({ x: i.t / 1000, y: i.tf })),
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
          display: false,
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
          ticks: {
            callback: value => {
              return `${value} °C`;
            },
            font: {
              size: window.innerWidth < 640 ? 10 : 12,
            },
          },
        },
        y1: {
          type: 'linear',
          min: 0,
          max: 16,
          position: 'right',
          ticks: {
            callback: value => {
              return `${value} bar / g/s`;
            },
            font: {
              size: window.innerWidth < 640 ? 10 : 12,
            },
          },
        },
        x: {
          type: 'linear',
          display: true,
          position: 'bottom',
          title: {
            display: true,
            text: 'Time (s)'
          },
          ticks: {
            source: 'auto',
            callback: (value) => {
              return `${value}s`;
            },
            font: {
              size: window.innerWidth < 640 ? 10 : 12,
            },
            maxTicksLimit: 10,
          },
        },
      },
    },
  };
}

export function HistoryChart({ shot }) {
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

    const handleMove = (event) => {
      event.preventDefault();
      
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
      if (chart && chart.scales && chart.scales.x) {
        // Manual relative position calculation instead of Chart.helpers.getRelativePosition
        const canvasX = Math.max(chart.chartArea.left, Math.min(x, chart.chartArea.right));
        const dataX = chart.scales.x.getValueForPixel(canvasX);
        
        // Find closest data point
        const datasets = chart.data.datasets;
        if (datasets.length > 0 && datasets[0].data && shot.samples) {
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
          const sampleData = shot.samples[closestIndex];
          if (sampleData) {
            const pointData = {
              time: (sampleData.t / 1000).toFixed(1),
              currentTemperature: sampleData.ct,
              targetTemperature: sampleData.tt,
              currentPressure: sampleData.cp,
              targetPressure: sampleData.tp,
              currentPumpFlow: sampleData.fl,
              currentPuckFlow: sampleData.pf,
              targetPumpFlow: sampleData.tf,
              dataIndex: closestIndex
            };
            
            // Calculate constrained tooltip position relative to data point
            const dataPointX = chart.scales.x.getPixelForValue(datasets[0].data[closestIndex].x);
            const constrainedX = Math.max(chart.chartArea.left, Math.min(dataPointX, chart.chartArea.right));
            
            setSelectedPoint(pointData);
            setTooltipPosition({ x: constrainedX, y });
          }
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
  }, [isDragging, shot.samples]);
  
  const handlePointClick = (event, elements, chart) => {
    if (elements.length > 0) {
      const dataIndex = elements[0].index;
      const datasets = chart.data.datasets;
      const sampleData = shot.samples[dataIndex];
      
      // Get values from all datasets at this index
      const pointData = {
        time: (sampleData.t / 1000).toFixed(1),
        currentTemperature: sampleData.ct,
        targetTemperature: sampleData.tt,
        currentPressure: sampleData.cp,
        targetPressure: sampleData.tp,
        currentPumpFlow: sampleData.fl,
        currentPuckFlow: sampleData.pf,
        targetPumpFlow: sampleData.tf,
        dataIndex // Store the index for visual indicator
      };
      
      setSelectedPoint(pointData);
    } else {
      setSelectedPoint(null);
    }
  };

  const chartData = getChartData(shot.samples, null, selectedPoint?.dataIndex);

  // Calculate tooltip position with left/right logic
  const getTooltipStyle = () => {
    if (!selectedPoint || !chartRef.current?.chart) return {};
    
    const chart = chartRef.current.chart;
    const tooltipWidth = 160; // max width of tooltip
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
        maxWidth: '160px'
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
      maxWidth: '160px'
    };
  };  return (
    <div className="relative w-full">
      <ChartComponent 
        className='h-full min-h-[300px] w-full lg:min-h-[400px]' 
        chartClassName='h-full w-full' 
        data={chartData}
        onMouseDown={(e) => {
          const rect = e.target.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          
          // Store chart reference
          chartRef.current = { chart: e.target.chart, getBoundingClientRect: () => rect };
          
          // Find data point at click position
          if (e.target.chart && e.target.chart.scales && e.target.chart.scales.x && shot.samples) {
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
              const sampleData = shot.samples[closestIndex];
              if (sampleData) {
                const pointData = {
                  time: (sampleData.t / 1000).toFixed(1),
                  currentTemperature: sampleData.ct,
                  targetTemperature: sampleData.tt,
                  currentPressure: sampleData.cp,
                  targetPressure: sampleData.tp,
                  currentPumpFlow: sampleData.fl,
                  currentPuckFlow: sampleData.pf,
                  targetPumpFlow: sampleData.tf,
                  dataIndex: closestIndex
                };
                
                // Calculate constrained tooltip position relative to data point
                const dataPointX = e.target.chart.scales.x.getPixelForValue(datasets[0].data[closestIndex].x);
                const constrainedX = Math.max(e.target.chart.chartArea.left, Math.min(dataPointX, e.target.chart.chartArea.right));
                
                setSelectedPoint(pointData);
                setTooltipPosition({ x: constrainedX, y });
                setIsDragging(true);
              }
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
            if (e.target.chart && e.target.chart.scales && e.target.chart.scales.x && shot.samples) {
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
                const sampleData = shot.samples[closestIndex];
                if (sampleData) {
                  const pointData = {
                    time: (sampleData.t / 1000).toFixed(1),
                    currentTemperature: sampleData.ct,
                    targetTemperature: sampleData.tt,
                    currentPressure: sampleData.cp,
                    targetPressure: sampleData.tp,
                    currentPumpFlow: sampleData.fl,
                    currentPuckFlow: sampleData.pf,
                    targetPumpFlow: sampleData.tf,
                    dataIndex: closestIndex
                  };
                  
                  // Calculate constrained tooltip position relative to data point
                  const dataPointX = e.target.chart.scales.x.getPixelForValue(datasets[0].data[closestIndex].x);
                  const constrainedX = Math.max(e.target.chart.chartArea.left, Math.min(dataPointX, e.target.chart.chartArea.right));
                  
                  setSelectedPoint(pointData);
                  setTooltipPosition({ x: constrainedX, y });
                  setIsDragging(true);
                }
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
          <div style={{ color: '#FFB74D' }}>T: {selectedPoint.currentTemperature.toFixed(1)}/{selectedPoint.targetTemperature.toFixed(1)}°C</div>
          <div style={{ color: '#4FC3F7' }}>P: {selectedPoint.currentPressure.toFixed(1)}/{selectedPoint.targetPressure.toFixed(1)} bar</div>
          <div style={{ color: '#81C784' }}>F: {selectedPoint.currentPumpFlow.toFixed(1)}/{selectedPoint.targetPumpFlow.toFixed(1)} g/s</div>
          <div style={{ color: '#66BB6A' }}>PkF: {selectedPoint.currentPuckFlow.toFixed(1)} g/s</div>
        </div>
      )}
    </div>
  );
}
