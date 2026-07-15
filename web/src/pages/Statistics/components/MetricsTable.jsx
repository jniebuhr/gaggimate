import { faBullseye } from '@fortawesome/free-solid-svg-icons/faBullseye';
import { faClock } from '@fortawesome/free-solid-svg-icons/faClock';
import { faDroplet } from '@fortawesome/free-solid-svg-icons/faDroplet';
import { faFaucet } from '@fortawesome/free-solid-svg-icons/faFaucet';
import { faFilter } from '@fortawesome/free-solid-svg-icons/faFilter';
import { faGauge } from '@fortawesome/free-solid-svg-icons/faGauge';
import { faGaugeHigh } from '@fortawesome/free-solid-svg-icons/faGaugeHigh';
import { faScaleBalanced } from '@fortawesome/free-solid-svg-icons/faScaleBalanced';
import { faTemperatureHalf } from '@fortawesome/free-solid-svg-icons/faTemperatureHalf';
import { fmt } from '../utils/format';
import { StatisticsMetricHeader } from './StatisticsMetricHeader';
import { STATISTICS_DENSE_VALUE_CLASS, STATISTICS_SMALL_LABEL_CLASS } from './statisticsUi';

const METRIC_ROWS = [
  {
    key: 'w',
    label: 'Weight',
    unit: 'g',
    colorClass: 'text-[var(--analyzer-weight-text)]',
    accentColor: 'var(--analyzer-weight-text)',
    icon: faScaleBalanced,
    averageDescription: 'Final shot weight average',
  },
  {
    key: 'duration',
    label: 'Duration',
    unit: 's',
    colorClass: 'text-[var(--statistics-summary-duration)]',
    accentColor: 'var(--statistics-summary-duration)',
    icon: faClock,
    averageDescription: 'Per-shot duration average',
  },
  {
    key: 'tt',
    label: 'Avg. Target Temperature',
    unit: '\u2103',
    colorClass: 'text-[var(--analyzer-target-temp-text)]',
    accentColor: 'var(--analyzer-target-temp-text)',
    icon: faBullseye,
    averageDescription: 'Time-weighted average target temperature',
  },
  {
    key: 't',
    label: 'Temperature',
    unit: '\u2103',
    colorClass: 'text-[var(--analyzer-temp-text)]',
    accentColor: 'var(--analyzer-temp-text)',
    icon: faTemperatureHalf,
    averageDescription: 'Time-weighted average temperature',
  },
  {
    key: 'ttDelta',
    label: 'Target Temp \u0394',
    unit: '\u2103',
    colorClass: 'text-[var(--analyzer-target-temp-text)]',
    accentColor: 'var(--analyzer-target-temp-text)',
    icon: faBullseye,
    digits: 2,
    averageDescription: 'Per-shot absolute delta between measured and target average temperature',
  },
  {
    key: 'p',
    label: 'Pressure',
    unit: 'bar',
    colorClass: 'text-[var(--analyzer-pressure-text)]',
    accentColor: 'var(--analyzer-pressure-text)',
    icon: faGauge,
    averageDescription: 'Time-weighted average pressure',
  },
  {
    key: 'pPeak',
    label: 'Avg. Peak Pressure',
    unit: 'bar',
    colorClass: 'text-[var(--analyzer-pressure-text)]',
    accentColor: 'var(--analyzer-pressure-text)',
    icon: faGaugeHigh,
    averageDescription: 'Average of each shot peak pressure',
  },
  {
    key: 'f',
    label: 'Pump Flow',
    unit: 'ml/s',
    colorClass: 'text-[var(--analyzer-flow-text)]',
    accentColor: 'var(--analyzer-flow-text)',
    icon: faFaucet,
    averageDescription: 'Time-weighted average flow',
  },
  {
    key: 'water',
    label: 'Pumped Water',
    unit: 'ml',
    colorClass: 'text-[var(--statistics-summary-water)]',
    accentColor: 'var(--statistics-summary-water)',
    icon: faDroplet,
    averageDescription: 'Per-shot water drawn average',
  },
  {
    key: 'pf',
    label: 'Puck Flow',
    unit: 'ml/s',
    colorClass: 'text-[var(--analyzer-puckflow-text)]',
    accentColor: 'var(--analyzer-puckflow-text)',
    icon: faFilter,
    averageDescription: 'Time-weighted average puck flow',
  },
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatMetricValue(value, row) {
  const formatted = fmt(value, row.digits);
  if (formatted === '-') return formatted;
  return `${row.avgPrefix || ''}${formatted}`;
}

function getSpreadRatio(metric) {
  if (!metric) return 0;
  const stdDev = Number(metric.stdDev);
  const min = Number(metric.min);
  const max = Number(metric.max);
  if (!Number.isFinite(stdDev) || stdDev <= 0) return 0;

  const range = max - min;
  if (Number.isFinite(range) && range > 0) {
    return clamp(stdDev / range, 0, 1);
  }

  const avg = Math.abs(Number(metric.avg));
  if (Number.isFinite(avg) && avg > 0) {
    return clamp(stdDev / avg, 0, 1);
  }

  return 0;
}

function getMetricPositions(metric) {
  const min = Number(metric?.min);
  const max = Number(metric?.max);
  const avg = Number(metric?.avg);
  const stdDev = Math.max(0, Number(metric?.stdDev) || 0);
  const range = max - min;

  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(avg) || range <= 0) {
    return {
      avgPos: 50,
      stdStart: 50,
      stdWidth: 0,
      hasRange: false,
    };
  }

  const avgPos = clamp(((avg - min) / range) * 100, 0, 100);
  const low = clamp(((avg - stdDev - min) / range) * 100, 0, 100);
  const high = clamp(((avg + stdDev - min) / range) * 100, 0, 100);

  return {
    avgPos,
    stdStart: low,
    stdWidth: Math.max(0, high - low),
    hasRange: true,
  };
}

function MetricRangeViz({ row, metric }) {
  const spreadRatio = getSpreadRatio(metric);
  const positions = getMetricPositions(metric);
  const stdBandPct = Math.round(14 + spreadRatio * 26);

  return (
    <div className='app-card-surface flex h-full min-h-[11rem] flex-col rounded-xl p-3 transition-shadow'>
      <StatisticsMetricHeader
        accentColor={row.accentColor}
        icon={row.icon}
        label={row.label}
        unit={row.unit}
        value={formatMetricValue(metric.avg, row)}
      />

      <div
        className='mt-3 rounded-lg px-3 py-2 shadow-sm'
        style={{
          background: 'var(--statistics-summary-surface-strong)',
        }}
      >
        <div className='flex items-center justify-between gap-2'>
          <div className={STATISTICS_SMALL_LABEL_CLASS}>Range</div>
          <div className='text-right'>
            <div className='text-base-content/60 text-[10px]'>Std Dev</div>
            <div className={`text-xs ${STATISTICS_DENSE_VALUE_CLASS}`}>
              {fmt(metric.stdDev, row.digits)}
            </div>
          </div>
        </div>

        <div className='mt-2 flex items-center gap-2'>
          <div className={`shrink-0 text-[11px] opacity-65 ${STATISTICS_DENSE_VALUE_CLASS}`}>
            {fmt(metric.min, row.digits)}
          </div>
          <div className='relative h-5 min-w-0 flex-1'>
            <div className='bg-base-content/20 absolute top-1/2 right-0 left-0 h-px -translate-y-1/2' />
            <div className='bg-base-content/30 absolute top-1/2 left-0 h-2 w-px -translate-y-1/2' />
            <div className='bg-base-content/30 absolute top-1/2 right-0 h-2 w-px -translate-y-1/2' />
            {positions.hasRange && positions.stdWidth > 0 && (
              <div
                className='absolute top-1/2 h-2 -translate-y-1/2 rounded-full'
                style={{
                  left: `${positions.stdStart}%`,
                  width: `${positions.stdWidth}%`,
                  background: `color-mix(in srgb, ${row.accentColor} ${stdBandPct}%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${row.accentColor} ${Math.min(
                    42,
                    stdBandPct + 10,
                  )}%, transparent)`,
                }}
              />
            )}
            <div
              className='absolute top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full'
              style={{
                left: `calc(${positions.avgPos}% - 1px)`,
                backgroundColor: row.accentColor,
                boxShadow: `0 0 0 2px color-mix(in srgb, ${row.accentColor} 18%, transparent)`,
              }}
            />
          </div>
          <div className={`shrink-0 text-[11px] opacity-65 ${STATISTICS_DENSE_VALUE_CLASS}`}>
            {fmt(metric.max, row.digits)}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MetricsTable({ metrics }) {
  if (!metrics || Object.keys(metrics).length === 0) return null;

  return (
    <div>
      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'>
        {METRIC_ROWS.map(row => {
          const metric = metrics[row.key];
          if (!metric) return null;
          return <MetricRangeViz key={row.key} row={row} metric={metric} />;
        })}
      </div>
    </div>
  );
}
