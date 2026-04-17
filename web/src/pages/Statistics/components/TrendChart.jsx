import { useEffect, useRef, useState } from 'preact/hooks';
import Chart from 'chart.js/auto';
import {
  aggregateTrendsByGranularity,
  formatTrendBucketTickLabel,
  formatTrendBucketTooltipTitle,
} from '../utils/trendBuckets';

// Chart-level trend aggregation stays local to this component so users can switch
// metric and bucket size without rerunning StatisticsService.
const TREND_METRICS = [
  {
    key: 'duration',
    label: 'Duration (s)',
    colorVar: '--statistics-trend-duration',
    color: '#64748b',
  },
  { key: 'weight', label: 'Weight (g)', colorVar: '--analyzer-weight-text', color: '#8B5CF6' },
  { key: 'water', label: 'Water (ml)', colorVar: '--statistics-trend-water', color: '#0EA5E9' },
  {
    key: 'shotCount',
    label: 'Shots',
    colorVar: '--statistics-trend-shots-brown',
    color: '#8B5E3C',
  },
  {
    key: 'avgPressure',
    label: 'Avg Pressure (bar)',
    colorVar: '--analyzer-pressure-text',
    color: '#0066CC',
  },
  { key: 'avgFlow', label: 'Avg Flow (ml/s)', colorVar: '--analyzer-flow-text', color: '#63993D' },
  {
    key: 'avgTemp',
    label: 'Avg Temp (\u2103)',
    colorVar: '--analyzer-temp-text',
    color: '#F0561D',
  },
  {
    key: 'avgPuckFlow',
    label: 'Avg Puck Flow (ml/s)',
    colorVar: '--analyzer-puckflow-text',
    color: '#059669',
  },
];

const GRANULARITY_OPTIONS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];

function getGranularityLabel(granularity) {
  return GRANULARITY_OPTIONS.find(option => option.value === granularity)?.label || 'Month';
}

function getAdaptiveMaxTicks(containerWidth) {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) return 8;
  if (containerWidth < 360) return 4;
  if (containerWidth < 520) return 6;
  if (containerWidth < 760) return 8;
  return 10;
}

function resolveCssColorVar(colorVar, fallback) {
  if (!colorVar || typeof window === 'undefined') return fallback;
  try {
    const value = getComputedStyle(document.documentElement).getPropertyValue(colorVar).trim();
    return value || fallback;
  } catch {
    return fallback;
  }
}

function resolveMetricColor(metricDef) {
  return resolveCssColorVar(metricDef?.colorVar, metricDef?.color || '#64748b');
}

function withAlpha(color, alphaHex) {
  if (typeof color !== 'string') return color;
  const trimmed = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return `${trimmed}${alphaHex}`;
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}${alphaHex}`;
  }
  return trimmed;
}

function formatTrendMetricValue(value, metricKey) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return '';
  return metricKey === 'shotCount' ? String(Math.round(numericValue)) : numericValue.toFixed(1);
}

export function TrendChart({ trends }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const chartInstance = useRef(null);
  const [selectedMetric, setSelectedMetric] = useState('shotCount');
  const [selectedGranularity, setSelectedGranularity] = useState('day');
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateWidth = () => {
      const nextWidth = element.getBoundingClientRect().width;
      setContainerWidth(prev => (Math.abs(prev - nextWidth) < 1 ? prev : nextWidth));
    };

    updateWidth();

    // Only the tick density adapts to width; the selected bucket size remains user-controlled.
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }

    if (!trends || trends.length === 0 || !canvasRef.current) return;

    const metricDef = TREND_METRICS.find(m => m.key === selectedMetric) || TREND_METRICS[0];
    const metricColor = resolveMetricColor(metricDef);
    const tickColor = resolveCssColorVar('--statistics-trend-axis-tick', '#888');
    const gridColor = resolveCssColorVar('--statistics-trend-grid', 'rgba(200, 200, 200, 0.1)');
    const tooltipBg = resolveCssColorVar('--statistics-trend-tooltip-bg', 'rgba(20, 20, 20, 0.9)');
    const metricLabel =
      metricDef.key === 'shotCount'
        ? `Shots / ${getGranularityLabel(selectedGranularity)}`
        : metricDef.label;
    const data = aggregateTrendsByGranularity(trends, metricDef.key, selectedGranularity);
    const maxTicksLimit = getAdaptiveMaxTicks(containerWidth);

    try {
      chartInstance.current = new Chart(canvasRef.current, {
        type: 'line',
        data: {
          datasets: [
            {
              label: metricLabel,
              data,
              borderColor: metricColor,
              backgroundColor: withAlpha(metricColor, '20'),
              fill: true,
              pointRadius: 3,
              pointHoverRadius: 5,
              borderWidth: 2,
              tension: 0.18,
              cubicInterpolationMode: 'monotone',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: tooltipBg,
              titleFont: { size: 11 },
              bodyFont: { size: 10 },
              callbacks: {
                title: ctx => {
                  const raw = ctx[0]?.raw;
                  return formatTrendBucketTooltipTitle(raw, selectedGranularity);
                },
                label: ctx =>
                  `${metricLabel}: ${formatTrendMetricValue(ctx.parsed.y, metricDef.key)}`,
                afterBody: ctx => {
                  if (metricDef.key === 'shotCount') return [];
                  const raw = ctx?.[0]?.raw;
                  if (!raw || !Number.isFinite(raw.shotCount)) return [];
                  return [`Shots: ${raw.shotCount}`];
                },
              },
            },
          },
          scales: {
            x: {
              type: 'linear',
              ticks: {
                font: { size: 10 },
                color: tickColor,
                callback: value =>
                  formatTrendBucketTickLabel(Number(value), selectedGranularity, {
                    containerWidth,
                  }),
                maxTicksLimit,
              },
              grid: { color: gridColor },
            },
            y: {
              ticks: {
                font: { size: 10 },
                color: metricColor,
                callback: value => formatTrendMetricValue(value, metricDef.key),
              },
              grid: { color: gridColor },
            },
          },
        },
      });
    } catch {
      // Chart creation can fail transiently during rapid metric/granularity switches.
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [trends, selectedMetric, selectedGranularity, containerWidth]);

  if (!trends || trends.length === 0) return null;

  return (
    <div>
      <div className='mb-2 flex flex-wrap items-center justify-end gap-2'>
        <div className='ml-auto flex flex-wrap items-center gap-2'>
          <select
            className='select select-xs select-bordered'
            value={selectedMetric}
            onChange={e => setSelectedMetric(e.target.value)}
          >
            {TREND_METRICS.map(m => (
              <option key={m.key} value={m.key}>
                {m.key === 'shotCount'
                  ? `Shots / ${getGranularityLabel(selectedGranularity)}`
                  : m.label}
              </option>
            ))}
          </select>
          <select
            className='select select-xs select-bordered'
            value={selectedGranularity}
            onChange={e => setSelectedGranularity(e.target.value)}
            aria-label='Trend bucket size'
            title='Trend bucket size'
          >
            {GRANULARITY_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div ref={containerRef} className='relative h-52 w-full'>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
