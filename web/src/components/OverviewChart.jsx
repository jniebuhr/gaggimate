import { machine } from '../services/ApiService.js';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Chart } from 'chart.js';
import { ChartComponent } from './Chart.jsx';

function getChartData(data, onPointClick, selectedPointIndex = null) {
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
      onClick: onPointClick,
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

  const chartData = getChartData(machine.value.history, handlePointClick, selectedPoint?.dataIndex);

  return (
    <div className="relative h-full w-full">
      <ChartComponent
        className='h-full min-h-[200px] w-full flex-1 lg:min-h-[350px]'
        chartClassName='h-full w-full'
        data={chartData}
      />
      
      {selectedPoint && (
        <div 
          className="chart-tooltip absolute bg-black/90 p-1.5 rounded border border-gray-400/20 pointer-events-none"
          style={{
            fontSize: '11px',
            lineHeight: '1.2',
            left: '60px',
            top: '80px',
            minWidth: 'auto',
            maxWidth: '150px'
          }}
        >
          <div className="font-medium mb-0.5 text-white">{selectedPoint.timestamp.toLocaleTimeString()}</div>
          <div style={{ color: '#4FC3F7' }}>P: {selectedPoint.currentPressure.toFixed(1)}/{selectedPoint.targetPressure.toFixed(1)} bar</div>
          <div style={{ color: '#FFB74D' }}>T: {selectedPoint.currentTemperature.toFixed(1)}/{selectedPoint.targetTemperature.toFixed(1)}°C</div>
          <div style={{ color: '#81C784' }}>F: {selectedPoint.currentFlow.toFixed(1)} g/s</div>
        </div>
      )}
    </div>
  );
}
