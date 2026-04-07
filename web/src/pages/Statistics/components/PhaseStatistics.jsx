import { useState } from 'preact/hooks';
import { fmt } from '../utils/format';
import { STATISTICS_SECTION_TITLE_CLASS } from './statisticsUi';

const DELTA_COLOR = 'var(--analyzer-pred-info-blue)';
const EXIT_REASON_UNKNOWN_STYLE = {
  color: 'color-mix(in srgb, var(--color-base-content) 72%, transparent)',
  borderColor: 'var(--statistics-summary-border)',
  background: 'var(--statistics-summary-surface-muted)',
};

function getExitReasonAccent(reason) {
  const normalized = String(reason || '')
    .trim()
    .toLowerCase();
  if (!normalized) return null;
  if (normalized.includes('weight')) return 'var(--analyzer-weight-text)';
  if (normalized.includes('flow')) return 'var(--analyzer-flow-text)';
  if (normalized.includes('pressure')) return 'var(--analyzer-pressure-text)';
  if (normalized.includes('time')) return 'var(--statistics-summary-duration)';
  if (normalized.includes('water') || normalized.includes('pumped')) {
    return 'var(--statistics-summary-water)';
  }
  return null;
}

function getExitReasonBadgeStyle(reason) {
  const accentColor = getExitReasonAccent(reason);
  if (!accentColor) return EXIT_REASON_UNKNOWN_STYLE;

  return {
    color: accentColor,
    borderColor: `color-mix(in srgb, ${accentColor} 30%, var(--statistics-summary-border))`,
    background: `color-mix(in srgb, ${accentColor} 12%, var(--statistics-summary-surface-muted))`,
  };
}

function fmtDelta(val) {
  if (!Number.isFinite(val)) return null;
  const sign = val >= 0 ? '+' : '';
  return `${sign}${val.toFixed(1)}`;
}

function TargetDeltaCell({ entry, unit }) {
  if (!entry) return <td className='text-right font-mono'>-</td>;
  return (
    <td className='text-right font-mono' style={{ color: DELTA_COLOR }}>
      {fmt(entry.target)}
      {unit} ({fmtDelta(entry.delta)})
    </td>
  );
}

function PhaseSection({ phase }) {
  const [open, setOpen] = useState(phase.isTotal || false);
  const td = phase.targetDeltas || {};

  return (
    <div
      className={`border-base-content/5 rounded-lg border ${phase.isTotal ? 'bg-base-300/40 border-base-content/10' : 'bg-base-200/30'}`}
    >
      <button
        type='button'
        className='flex w-full items-center justify-between px-3 py-2 text-left'
        onClick={() => setOpen(o => !o)}
      >
        <span className={`text-sm ${phase.isTotal ? 'font-bold' : 'font-semibold'}`}>
          {phase.phaseName}
          <span className='ml-2 text-xs opacity-50'>({phase.shotCount} entries)</span>
        </span>
        <span className='text-xs opacity-40'>{open ? '\u25B2' : '\u25BC'}</span>
      </button>

      {open && (
        <div className='space-y-3 px-3 pb-3'>
          <div className='flex flex-wrap items-center gap-4'>
            <div className='flex items-center gap-1.5'>
              <span className='text-xs opacity-50'>Avg Duration:</span>
              <span className='font-mono text-xs font-semibold'>{fmt(phase.avgDuration)}s</span>
              {td.duration && (
                <span className='font-mono text-xs' style={{ color: DELTA_COLOR }}>
                  (target {fmt(td.duration.target)}s, {fmtDelta(td.duration.delta)}s)
                </span>
              )}
            </div>
            <div className='flex items-center gap-1.5'>
              <span className='text-xs opacity-50'>Avg Water Drawn:</span>
              <span className='font-mono text-xs font-semibold'>
                {fmt(td.water ? td.water.actual : phase.avgWater)}ml
              </span>
              {td.water && (
                <span className='font-mono text-xs' style={{ color: DELTA_COLOR }}>
                  (target {fmt(td.water.target)}ml, {fmtDelta(td.water.delta)}ml)
                </span>
              )}
            </div>
          </div>

          <div className='overflow-x-auto'>
            <table className='table-xs table w-full'>
              <thead>
                <tr className='text-xs opacity-60'>
                  <th>Metric</th>
                  <th className='text-right' title='Time-Weighted Average'>
                    Avg (TW)
                  </th>
                  <th className='text-right'>Min</th>
                  <th className='text-right'>Max</th>
                  <th className='text-right' title='Average target value and deviation'>
                    Target (Delta)
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  { key: 'p', label: 'Pressure', unit: 'bar' },
                  { key: 'f', label: 'Flow', unit: 'ml/s' },
                  { key: 'pf', label: 'Puck Flow', unit: 'ml/s' },
                  { key: 't', label: 'Temp', unit: '\u2103' },
                  { key: 'w', label: 'Weight', unit: 'g' },
                ].map(row => {
                  const m = phase.metrics[row.key];
                  if (!m) return null;
                  return (
                    <tr key={row.key}>
                      <td className='font-semibold'>
                        {row.label} <span className='opacity-50'>({row.unit})</span>
                      </td>
                      <td className='text-right font-mono'>{fmt(m.avg)}</td>
                      <td className='text-right font-mono'>{fmt(m.min)}</td>
                      <td className='text-right font-mono'>{fmt(m.max)}</td>
                      <TargetDeltaCell entry={td[row.key]} unit={row.unit} />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div>
            <div className='mb-1 text-[10px] font-semibold uppercase opacity-50'>Exit Reasons</div>
            <div className='flex flex-wrap gap-1'>
              {Object.entries(phase.exitReasonDistribution)
                .sort((a, b) => b[1] - a[1])
                .map(([reason, count]) => (
                  <span
                    key={reason}
                    className='badge badge-sm border font-medium'
                    style={getExitReasonBadgeStyle(reason)}
                  >
                    {reason}: {count}
                  </span>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function PhaseStatistics({ phaseStats, showTitle = true }) {
  if (!phaseStats || phaseStats.length === 0) return null;

  // Separate regular phases from total row
  const phases = phaseStats.filter(p => !p.isTotal);
  const totalRow = phaseStats.find(p => p.isTotal);

  return (
    <div>
      {showTitle && (
        <h3 className={`mb-2 ${STATISTICS_SECTION_TITLE_CLASS}`}>Per-phase statistics</h3>
      )}
      <div className='space-y-2'>
        {phases.map(phase => (
          <PhaseSection key={phase.phaseName} phase={phase} />
        ))}
        {totalRow && <PhaseSection key='total' phase={totalRow} />}
      </div>
    </div>
  );
}
