import { faDroplet } from '@fortawesome/free-solid-svg-icons/faDroplet';
import { faMugHot } from '@fortawesome/free-solid-svg-icons/faMugHot';
import { faScaleBalanced } from '@fortawesome/free-solid-svg-icons/faScaleBalanced';
import { faStopwatch } from '@fortawesome/free-solid-svg-icons/faStopwatch';
import { StatisticsMetricHeader } from './StatisticsMetricHeader';

// Presentational only: renders a high-signal summary layer from StatisticsService.summary.
function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0 s';
  const totalSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;
  const parts = [];

  if (hours > 0) parts.push(`${hours} h`);
  if (hours > 0 || minutes > 0) parts.push(`${minutes} m`);
  parts.push(`${remainingSeconds} s`);

  return parts.join(' ');
}

function fmtNumber(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : '-';
}

function formatWeight(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return '-';
  if (Math.abs(numericValue) >= 1000) return `${(numericValue / 1000).toFixed(3)} kg`;
  return `${fmtNumber(numericValue)} g`;
}

function formatWater(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return '-';
  if (Math.abs(numericValue) >= 1000) return `${(numericValue / 1000).toFixed(3)} l`;
  return `${fmtNumber(numericValue)} ml`;
}

function SummaryStatCard({ icon, label, value, accentColorVar }) {
  const accent = `var(${accentColorVar})`;

  return (
    <div className='app-card-surface rounded-xl p-3 transition-shadow'>
      <StatisticsMetricHeader
        accentColor={accent}
        icon={icon}
        label={label}
        value={value}
        valueClassName='text-lg leading-tight sm:text-xl'
      />
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
    },
    {
      key: 'totalWeight',
      label: 'Total Weight',
      value: formatWeight(summary.totalWeight),
      icon: faScaleBalanced,
      accentColorVar: '--analyzer-weight-text',
    },
    {
      key: 'totalWater',
      label: 'Total Pumped Water',
      value: formatWater(summary.totalWater),
      icon: faDroplet,
      accentColorVar: '--statistics-summary-water',
    },
    {
      key: 'totalDuration',
      label: 'Total Duration',
      value: formatDuration(summary.totalDuration),
      icon: faStopwatch,
      accentColorVar: '--statistics-summary-duration',
    },
  ];

  return (
    <div className='space-y-2'>
      <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
        {totalCards.map(card => (
          <SummaryStatCard key={card.key} {...card} />
        ))}
      </div>
    </div>
  );
}
