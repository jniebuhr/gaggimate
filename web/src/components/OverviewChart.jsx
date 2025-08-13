import { machine } from '../services/ApiService.js';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Chart } from 'chart.js';

function getChartData(data) {
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
      },
      animation: false,
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
            maxTicksLimit: window.innerWidth < 640 ? 5 : 5,
          },
        },
      },
    },
  };
}

export function OverviewChart() {
  const [chart, setChart] = useState(null);
  const ref = useRef();

  // Create chart on mount
  useEffect(() => {
    if (!ref.current) return;

    const chartData = getChartData(machine.value.history);
    const newChart = new Chart(ref.current, chartData);
    setChart(newChart);

    // Cleanup function to destroy chart on unmount
    return () => {
      if (newChart) {
        newChart.destroy();
      }
    };
  }, []); // Empty dependency array - only run on mount

  // Update chart data when history changes
  useEffect(() => {
    if (!chart) return;

    const chartData = getChartData(machine.value.history);
    chart.data = chartData.data;
    chart.options = chartData.options;
    chart.update();
  }, [machine.value.history, chart]);

  // Add resize event listener to update chart options dynamically
  useEffect(() => {
    if (!chart) return;

    const handleResize = () => {
      const isSmallScreen = window.innerWidth < 640;

      // Update legend font size
      chart.options.plugins.legend.labels.font.size = isSmallScreen ? 10 : 12;

      // Update title font size
      chart.options.plugins.title.font.size = isSmallScreen ? 14 : 16;

      // Update axis font sizes
      chart.options.scales.y.ticks.font.size = isSmallScreen ? 10 : 12;
      chart.options.scales.y1.ticks.font.size = isSmallScreen ? 10 : 12;
      chart.options.scales.x.ticks.font.size = isSmallScreen ? 10 : 12;

      // Update maxTicksLimit for x-axis
      chart.options.scales.x.ticks.maxTicksLimit = isSmallScreen ? 5 : 10;

      // Update the chart to apply changes
      chart.update('none'); // Use 'none' mode for better performance
    };

    // Add event listener
    window.addEventListener('resize', handleResize);

    // Initial call to ensure correct sizing
    handleResize();

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [chart]);

  return (
    <div className='h-full min-h-[200px] w-full flex-1 lg:min-h-[350px]'>
      <canvas className='h-full w-full' ref={ref} />
    </div>
  );
}
