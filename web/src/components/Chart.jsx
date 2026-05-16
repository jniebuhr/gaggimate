import { useEffect, useRef, useState } from 'preact/hooks';
import { Chart } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';

Chart.register(annotationPlugin);

export function ChartComponent({ data, className, chartClassName, onChartReady }) {
  const [chart, setChart] = useState(null);
  const ref = useRef();
  const dataRef = useRef(data);
  dataRef.current = data;

  // Create chart on mount
  useEffect(() => {
    if (!ref.current) return;

    const newChart = new Chart(ref.current, dataRef.current);
    setChart(newChart);
    onChartReady?.(newChart);

    // Cleanup function to destroy chart on unmount
    return () => {
      if (newChart) {
        onChartReady?.(null);
        newChart.destroy();
      }
    };
  }, [onChartReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update chart data when data changes (reference comparison)
  useEffect(() => {
    if (!chart) return;

    // Preserve dataset visibility state when updating data
    const hiddenDatasets = chart.data.datasets.map((dataset, index) => {
      return chart.getDatasetMeta(index).hidden;
    });

    chart.data = data.data;
    chart.options = data.options;

    // Restore dataset visibility state
    chart.data.datasets.forEach((dataset, index) => {
      if (hiddenDatasets[index] !== undefined) {
        chart.getDatasetMeta(index).hidden = hiddenDatasets[index];
      }
    });

    // Use 'none' mode for better performance (no animations)
    chart.update('none');
  }, [data, chart]);

  // Add resize event listener to update chart options dynamically
  useEffect(() => {
    if (!chart) return;

    // Generic "get or create" helper for nested option objects.
    const ensure = (obj, key, def) => {
      if (!obj[key]) obj[key] = def;
      return obj[key];
    };

    // Walk a path (array of keys) under chart.options creating objects.
    // Guarantees a font object exists so we can safely assign size.
    const ensureFont = path => {
      const target = path.reduce((acc, key) => ensure(acc, key, {}), chart.options);
      if (!target.font) target.font = {}; // for scale tick objects that may embed font deeper
      return target;
    };

    let resizeTimer = null;
    const handleResize = () => {
      // Debounce resize to avoid redundant chart updates
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const isSmallScreen = window.innerWidth < 640;

        // Update font size while preserving weight (use explicit check to preserve falsy values like 0)
        const legendFont = ensureFont(['plugins', 'legend', 'labels']);
        const originalWeight = legendFont.font.weight;
        legendFont.font.size = isSmallScreen ? 10 : 12;
        if (originalWeight !== undefined && originalWeight !== null) {
          legendFont.font.weight = originalWeight;
        }

        // Update title font size
        ensureFont(['plugins', 'title']).font.size = isSmallScreen ? 14 : 16;

        // Update axis font sizes
        ensureFont(['scales', 'y', 'ticks']).font.size = isSmallScreen ? 10 : 12;
        ensureFont(['scales', 'y1', 'ticks']).font.size = isSmallScreen ? 10 : 12;
        ensureFont(['scales', 'x', 'ticks']).font.size = isSmallScreen ? 10 : 12;

        // Update maxTicksLimit for x-axis
        const xTicks = ensureFont(['scales', 'x', 'ticks']);
        xTicks.maxTicksLimit = isSmallScreen ? 5 : 10;

        // Force chart to resize and recalculate dimensions
        chart.resize();

        // Update the chart to apply changes
        chart.update('none');
      }, 150);
    };

    // Add event listeners for different orientation change scenarios
    window.addEventListener('resize', handleResize);

    // iOS PWA specific: orientationchange event
    const handleOrientationChange = () => {
      // Use a small delay to ensure the orientation change is complete
      setTimeout(handleResize, 100);
    };
    window.addEventListener('orientationchange', handleOrientationChange);

    // iOS PWA specific: visualViewport change (for newer iOS versions)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    }

    // Initial call to ensure correct sizing
    handleResize();

    // Cleanup
    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
    };
  }, [chart]);

  return (
    <div className={className}>
      <canvas className={chartClassName} ref={ref} />
    </div>
  );
}
