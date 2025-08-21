import { useEffect, useRef, useState } from 'preact/hooks';
import { Chart } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';

Chart.register(annotationPlugin);

export function ChartComponent({ data, className, chartClassName }) {
  const [chart, setChart] = useState(null);
  const ref = useRef();

  // Create chart on mount
  useEffect(() => {
    if (!ref.current) return;

    const newChart = new Chart(ref.current, data);
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

    chart.data = data.data;
    chart.options = data.options;
    chart.update();
  }, [data, chart]);

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
    <div className={className}>
      <canvas className={chartClassName} ref={ref} />
    </div>
  );
}
