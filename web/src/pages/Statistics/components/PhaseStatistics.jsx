import { useState } from 'preact/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMinus } from '@fortawesome/free-solid-svg-icons/faMinus';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { fmt } from '../utils/format';
import {
  STATISTICS_CARD_HEADING_CLASS,
  STATISTICS_DENSE_VALUE_CLASS,
  STATISTICS_SECTION_TITLE_CLASS,
  STATISTICS_SMALL_LABEL_CLASS,
  STATISTICS_TABLE_NUMBER_CLASS,
} from './statisticsUi';

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
  if (!entry) return <td className={STATISTICS_TABLE_NUMBER_CLASS}>-</td>;
  return (
    <td className={STATISTICS_TABLE_NUMBER_CLASS} style={{ color: DELTA_COLOR }}>
      {fmt(entry.target)}
      {unit} ({fmtDelta(entry.delta)})
    </td>
  );
}

function PhaseSection({ phase, hideExitReasons = false }) {
  const { t } = useLingui();
  const [open, setOpen] = useState(phase.isTotal || false);
  const td = phase.targetDeltas || {};
  const phaseLabel = phase.isTotal ? t`Total` : phase.phaseName;
  const durationTarget = td.duration ? fmt(td.duration.target) : '';
  const durationDelta = td.duration ? fmtDelta(td.duration.delta) : '';
  const waterTarget = td.water ? fmt(td.water.target) : '';
  const waterDelta = td.water ? fmtDelta(td.water.delta) : '';

  return (
    <div className='app-card-surface rounded-xl transition-shadow'>
      <button
        type='button'
        className='flex w-full cursor-pointer items-center justify-between px-3 py-3 text-left'
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className={phase.isTotal ? STATISTICS_CARD_HEADING_CLASS : 'text-sm font-medium'}>
          {phaseLabel}
          <span className='ml-2 text-xs opacity-50'>
            <Plural value={phase.shotCount} one='(# entry)' other='(# entries)' />
          </span>
        </span>
        <span className='text-xs opacity-45' aria-hidden='true'>
          <FontAwesomeIcon icon={open ? faMinus : faPlus} className='h-3 w-3' />
        </span>
      </button>

      {open && (
        <div className='space-y-3 px-3 pb-3'>
          <div className='flex flex-wrap items-center gap-4'>
            <div className='flex items-center gap-1.5'>
              <span className='text-xs opacity-50'>
                <Trans>Avg Duration:</Trans>
              </span>
              <span className={`text-xs ${STATISTICS_DENSE_VALUE_CLASS}`}>
                {fmt(phase.avgDuration)}s
              </span>
              {td.duration && (
                <span
                  className={`text-xs ${STATISTICS_DENSE_VALUE_CLASS}`}
                  style={{ color: DELTA_COLOR }}
                >
                  <Trans>
                    (target {durationTarget}s, {durationDelta}s)
                  </Trans>
                </span>
              )}
            </div>
            <div className='flex items-center gap-1.5'>
              <span className='text-xs opacity-50'>
                <Trans>Avg Pumped Water:</Trans>
              </span>
              <span className={`text-xs ${STATISTICS_DENSE_VALUE_CLASS}`}>
                {fmt(td.water ? td.water.actual : phase.avgWater)}ml
              </span>
              {td.water && (
                <span
                  className={`text-xs ${STATISTICS_DENSE_VALUE_CLASS}`}
                  style={{ color: DELTA_COLOR }}
                >
                  <Trans>
                    (target {waterTarget}ml, {waterDelta}ml)
                  </Trans>
                </span>
              )}
            </div>
          </div>

          <div className='overflow-x-auto'>
            <table className='table-xs table w-full'>
              <thead>
                <tr className='text-xs opacity-60'>
                  <th>
                    <Trans>Metric</Trans>
                  </th>
                  <th className='text-right' title={t`Time-Weighted Average`}>
                    <Trans>Avg (TW)</Trans>
                  </th>
                  <th className='text-right'>
                    <Trans>Min</Trans>
                  </th>
                  <th className='text-right'>
                    <Trans>Max</Trans>
                  </th>
                  <th className='text-right' title={t`Average target value and deviation`}>
                    <Trans>Target (Delta)</Trans>
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  { key: 'p', label: t`Pressure`, unit: 'bar' },
                  { key: 'f', label: t`Pump Flow`, unit: 'ml/s' },
                  { key: 'pf', label: t`Puck Flow`, unit: 'ml/s' },
                  {
                    key: 't',
                    label: t({ message: 'Temp', context: 'temperature' }),
                    unit: '\u2103',
                  },
                  { key: 'w', label: t`Weight`, unit: 'g' },
                ].map(row => {
                  const m = phase.metrics[row.key];
                  if (!m) return null;
                  return (
                    <tr key={row.key}>
                      <td className='font-semibold'>
                        {row.label} <span className='opacity-50'>({row.unit})</span>
                      </td>
                      <td className={STATISTICS_TABLE_NUMBER_CLASS}>{fmt(m.avg)}</td>
                      <td className={STATISTICS_TABLE_NUMBER_CLASS}>{fmt(m.min)}</td>
                      <td className={STATISTICS_TABLE_NUMBER_CLASS}>{fmt(m.max)}</td>
                      <TargetDeltaCell entry={td[row.key]} unit={row.unit} />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!hideExitReasons && (
            <div>
              <div className={`mb-1 opacity-55 ${STATISTICS_SMALL_LABEL_CLASS}`}>
                <Trans>Exit Reasons</Trans>
              </div>
              <div className='flex flex-wrap gap-1'>
                {Object.entries(phase.exitReasonDistribution ?? {})
                  .sort((a, b) => b[1] - a[1])
                  .map(([reason, count]) => (
                    <span
                      key={reason}
                      className='badge badge-sm border font-medium'
                      style={getExitReasonBadgeStyle(reason)}
                    >
                      {reason === 'Unknown' ? t`Unknown` : reason}: {count}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PhaseStatistics({ phaseStats, showTitle = true, hideExitReasons = false }) {
  if (!phaseStats || phaseStats.length === 0) return null;

  // Separate regular phases from total row
  const phases = phaseStats.filter(p => !p.isTotal);
  const totalRow = phaseStats.find(p => p.isTotal);

  return (
    <div>
      {showTitle && (
        <h3 className={`mb-2 ${STATISTICS_SECTION_TITLE_CLASS}`}>
          <Trans>Per-phase statistics</Trans>
        </h3>
      )}
      <div className='space-y-3'>
        {phases.map(phase => (
          <PhaseSection key={phase.phaseName} phase={phase} hideExitReasons={hideExitReasons} />
        ))}
        {totalRow && (
          <PhaseSection key='total' phase={totalRow} hideExitReasons={hideExitReasons} />
        )}
      </div>
    </div>
  );
}
