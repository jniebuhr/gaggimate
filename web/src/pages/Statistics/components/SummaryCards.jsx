import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBullseye } from '@fortawesome/free-solid-svg-icons/faBullseye';
import { faClock } from '@fortawesome/free-solid-svg-icons/faClock';
import { faDroplet } from '@fortawesome/free-solid-svg-icons/faDroplet';
import { faMugHot } from '@fortawesome/free-solid-svg-icons/faMugHot';
import { faStopwatch } from '@fortawesome/free-solid-svg-icons/faStopwatch';
import { faTemperatureHalf } from '@fortawesome/free-solid-svg-icons/faTemperatureHalf';
import { faWeightScale } from '@fortawesome/free-solid-svg-icons/faWeightScale';

// Presentational only: renders a high-signal summary layer from StatisticsService.summary.
function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s';
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function fmtNumber(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : '-';
}

function SummaryStatCard({ icon, label, value, accentColorVar, tone = 'muted' }) {
  const accent = `var(${accentColorVar})`;
  const isStrong = tone === 'strong';

  return (
    <div
      className='rounded-2xl border p-3 shadow-sm transition-shadow sm:p-3.5'
      style={{
        borderColor: isStrong
          ? `color-mix(in srgb, ${accent} 28%, var(--statistics-summary-border))`
          : 'var(--statistics-summary-border)',
        background: isStrong
          ? `color-mix(in srgb, ${accent} 8%, var(--statistics-summary-surface-strong))`
          : 'var(--statistics-summary-surface-muted)',
        boxShadow: '0 8px 22px var(--statistics-summary-shadow)',
      }}
    >
      <div className='flex items-center gap-3'>
        <div
          className='flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border sm:h-14 sm:w-14'
          style={{
            color: accent,
            borderColor: `color-mix(in srgb, ${accent} 32%, var(--statistics-summary-border))`,
            background: isStrong
              ? `color-mix(in srgb, ${accent} 14%, transparent)`
              : `color-mix(in srgb, ${accent} 10%, transparent)`,
          }}
        >
          <FontAwesomeIcon icon={icon} className='text-2xl sm:text-[1.65rem]' />
        </div>

        <div className='min-w-0 flex-1 text-center'>
          <div
            className='truncate text-xl font-bold leading-tight sm:text-2xl'
            style={{ color: isStrong ? accent : 'inherit' }}
          >
            {value}
          </div>
          <div className='mt-1 text-[10px] font-semibold uppercase tracking-wide opacity-60 sm:text-[11px]'>
            {label}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SummaryCards({ summary }) {
  if (!summary) return null;

  // Totals are shown first with a stronger visual treatment for quick scanning.
  const totalCards = [
    {
      key: 'totalShots',
      label: 'Total Shots',
      value: Number.isFinite(summary.totalShots) ? String(summary.totalShots) : '-',
      icon: faMugHot,
      accentColorVar: '--statistics-summary-shots-brown',
      tone: 'strong',
    },
    {
      key: 'totalWeight',
      label: 'Total Weight',
      value: `${fmtNumber(summary.totalWeight)}g`,
      icon: faWeightScale,
      accentColorVar: '--analyzer-weight-text',
      tone: 'strong',
    },
    {
      key: 'totalWater',
      label: 'Total Water',
      value: `${fmtNumber(summary.totalWater)}ml`,
      icon: faDroplet,
      accentColorVar: '--statistics-summary-water',
      tone: 'strong',
    },
    {
      key: 'totalDuration',
      label: 'Total Duration',
      value: formatDuration(summary.totalDuration),
      icon: faStopwatch,
      accentColorVar: '--statistics-summary-duration',
      tone: 'strong',
    },
  ];

  // Averages reuse the same card layout with a quieter tone to preserve hierarchy.
  const averageCards = [
    {
      key: 'avgWeight',
      label: 'Avg Weight',
      value: `${fmtNumber(summary.avgWeight)}g`,
      icon: faWeightScale,
      accentColorVar: '--analyzer-weight-text',
      tone: 'muted',
    },
    {
      key: 'avgWater',
      label: 'Avg Water',
      value: `${fmtNumber(summary.avgWater)}ml`,
      icon: faDroplet,
      accentColorVar: '--statistics-summary-water',
      tone: 'muted',
    },
    {
      key: 'avgDuration',
      label: 'Avg Duration',
      value: `${fmtNumber(summary.avgDuration)}s`,
      icon: faClock,
      accentColorVar: '--statistics-summary-duration',
      tone: 'muted',
    },
    {
      key: 'avgTemp',
      label: 'Avg Temp (TW)',
      value: `${fmtNumber(summary.avgTemp)}\u2103`,
      icon: faTemperatureHalf,
      accentColorVar: '--analyzer-temp-text',
      tone: 'muted',
    },
    {
      key: 'avgTargetTempDelta',
      label: 'Avg Target Temp \u0394',
      value: `\u00B1${fmtNumber(summary.avgTempTargetDeviation, 2)}\u2103`,
      icon: faBullseye,
      accentColorVar: '--analyzer-target-temp-text',
      tone: 'muted',
    },
  ];

  return (
    <div className='space-y-3'>
      <div className='space-y-2'>
        <div className='px-1 text-[10px] font-semibold uppercase tracking-wide opacity-50'>Totals</div>
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4'>
          {totalCards.map(card => (
            <SummaryStatCard key={card.key} {...card} />
          ))}
        </div>
      </div>

      <div className='space-y-2'>
        <div className='px-1 text-[10px] font-semibold uppercase tracking-wide opacity-50'>Averages</div>
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5'>
          {averageCards.map(card => (
            <SummaryStatCard key={card.key} {...card} />
          ))}
        </div>
      </div>
    </div>
  );
}
