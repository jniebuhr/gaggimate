import { fmt } from '../utils/format';

// Global metric averages visualization built from avg/min/max/stdDev (not quartiles/boxplots).
const METRIC_ROWS = [
  {
    key: 'p',
    label: 'Pressure',
    unit: 'bar',
    colorClass: 'text-[var(--analyzer-pressure-text)]',
    accentColor: 'var(--analyzer-pressure-text)',
  },
  {
    key: 'f',
    label: 'Flow',
    unit: 'ml/s',
    colorClass: 'text-[var(--analyzer-flow-text)]',
    accentColor: 'var(--analyzer-flow-text)',
  },
  {
    key: 'pf',
    label: 'Puck Flow',
    unit: 'ml/s',
    colorClass: 'text-[var(--analyzer-puckflow-text)]',
    accentColor: 'var(--analyzer-puckflow-text)',
  },
  {
    key: 't',
    label: 'Temperature',
    unit: '\u2103',
    colorClass: 'text-[var(--analyzer-temp-text)]',
    accentColor: 'var(--analyzer-temp-text)',
  },
  {
    key: 'w',
    label: 'Weight',
    unit: 'g',
    colorClass: 'text-[var(--analyzer-weight-text)]',
    accentColor: 'var(--analyzer-weight-text)',
  },
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Returns 0..1 indicating how spread out the metric is, used to scale visual intensity.
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
  const avgBgPct = Math.round(10 + spreadRatio * 28);
  const avgBorderPct = Math.round(18 + spreadRatio * 30);
  const stdBandPct = Math.round(14 + spreadRatio * 26);

  // Std-dev intensity is normalized per metric so colors stay meaningful across units.
  return (
    <div className='rounded-xl border border-base-content/10 bg-base-100/40 p-3 shadow-sm'>
      <div className='flex items-start justify-between gap-2'>
        <div className='min-w-0'>
          <div className={`truncate text-xs font-semibold uppercase tracking-wide ${row.colorClass}`}>
            {row.label}
          </div>
          <div className='text-[10px] opacity-60'>{row.unit}</div>
        </div>
        <div className='text-right'>
          <div className='text-[10px] opacity-55'>Std Dev</div>
          <div className='font-mono text-xs'>{fmt(metric.stdDev)}</div>
        </div>
      </div>

      <div
        className='mt-2 w-full rounded-lg border px-2 py-1 text-center shadow-sm'
        style={{
          borderColor: `color-mix(in srgb, ${row.accentColor} ${avgBorderPct}%, var(--color-base-content) 12%)`,
          background: `color-mix(in srgb, ${row.accentColor} ${avgBgPct}%, transparent)`,
        }}
      >
        <span className='font-mono text-base font-semibold'>{fmt(metric.avg)}</span>
        <span className='ml-1 text-xs opacity-70'>{row.unit}</span>
      </div>

      <div className='mt-2 flex items-center gap-2'>
        <div className='shrink-0 text-[11px] font-mono opacity-65'>{fmt(metric.min)}</div>
        <div className='relative h-5 min-w-0 flex-1'>
          <div className='absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-base-content/20' />
          <div className='absolute left-0 top-1/2 h-2 w-px -translate-y-1/2 bg-base-content/30' />
          <div className='absolute right-0 top-1/2 h-2 w-px -translate-y-1/2 bg-base-content/30' />
          {positions.hasRange && positions.stdWidth > 0 && (
            <div
              className='absolute top-1/2 h-2 -translate-y-1/2 rounded-full'
              style={{
                left: `${positions.stdStart}%`,
                width: `${positions.stdWidth}%`,
                background: `color-mix(in srgb, ${row.accentColor} ${stdBandPct}%, transparent)`,
                border: `1px solid color-mix(in srgb, ${row.accentColor} ${Math.min(
                  42,
                  stdBandPct + 10
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
        <div className='shrink-0 text-[11px] font-mono opacity-65'>{fmt(metric.max)}</div>
      </div>
    </div>
  );
}

export function MetricsTable({ metrics }) {
  if (!metrics || Object.keys(metrics).length === 0) return null;

  return (
    <div>
      <h3 className='mb-2 text-sm font-bold uppercase opacity-70'>Global Metric Averages</h3>
      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
        {METRIC_ROWS.map(row => {
          const m = metrics[row.key];
          if (!m) return null;
          return <MetricRangeViz key={row.key} row={row} metric={m} />;
        })}
      </div>

      {/* Keep the numeric table available for precision checks without dominating the page. */}
      <details className='mt-3 rounded-xl border border-base-content/10 bg-base-100/30'>
        <summary className='cursor-pointer list-none px-3 py-2 text-xs font-semibold uppercase tracking-wide opacity-70'>
          Detailed Table
        </summary>
        <div className='border-t border-base-content/10 px-2 py-2'>
          <div className='overflow-x-auto'>
            <table className='table-xs table w-full'>
              <thead>
                <tr className='text-xs opacity-60'>
                  <th>Metric</th>
                  <th className='text-right' title='Time-Weighted Average'>Avg (TW)</th>
                  <th className='text-right'>Min</th>
                  <th className='text-right'>Max</th>
                  <th className='text-right'>Std Dev</th>
                </tr>
              </thead>
              <tbody>
                {METRIC_ROWS.map(row => {
                  const m = metrics[row.key];
                  if (!m) return null;
                  return (
                    <tr key={row.key}>
                      <td className={`font-semibold ${row.colorClass}`}>
                        {row.label} <span className='opacity-50'>({row.unit})</span>
                      </td>
                      <td className='text-right font-mono'>{fmt(m.avg)}</td>
                      <td className='text-right font-mono'>{fmt(m.min)}</td>
                      <td className='text-right font-mono'>{fmt(m.max)}</td>
                      <td className='text-right font-mono'>{fmt(m.stdDev)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    </div>
  );
}
