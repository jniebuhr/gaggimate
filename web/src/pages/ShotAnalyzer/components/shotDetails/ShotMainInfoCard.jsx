import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleNotch } from '@fortawesome/free-solid-svg-icons/faCircleNotch';
import { faEye } from '@fortawesome/free-solid-svg-icons/faEye';
import { cleanName } from '../../utils/analyzerUtils';
import { SourceMarker } from '../SourceMarker';
import { getAnalyzerShotDisplayName, getShotDateTimeLabel } from '../useShotNotesState';
import { ShotSummaryMetricsRow } from './ShotMetricCards';

const WEEKDAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function getRelativeDayLabel(timestamp) {
  if (!timestamp) return '';
  const now = new Date();
  const shotDate = new Date(timestamp * 1000);

  // Check if same calendar date
  const isSameDate =
    now.getFullYear() === shotDate.getFullYear() &&
    now.getMonth() === shotDate.getMonth() &&
    now.getDate() === shotDate.getDate();
  if (isSameDate) {
    return shotDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Check if yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    yesterday.getFullYear() === shotDate.getFullYear() &&
    yesterday.getMonth() === shotDate.getMonth() &&
    yesterday.getDate() === shotDate.getDate();
  if (isYesterday) return 'Yesterday';

  // Approximate day diff for remaining cases
  const diffDays = Math.floor((now - shotDate) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return '';

  if (diffDays <= 6) return WEEKDAY_LABELS[shotDate.getDay()];

  if (diffDays <= 13) return 'Last week';

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks <= 4) return `${diffWeeks} weeks ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;

  const diffYears = Math.floor(diffDays / 365);
  if (diffYears < 2) return '1 year ago';
  return `${diffYears} years ago`;
}

function RatingControl({ rating, onChange }) {
  return (
    <div className='flex min-h-8 items-center gap-0.5 lg:min-h-7 xl:min-h-8'>
      {[1, 2, 3, 4, 5].map(value => (
        <button
          key={value}
          type='button'
          className={`rounded-sm px-0.5 text-lg leading-none transition-colors ${
            value <= Number(rating || 0)
              ? 'text-yellow-400 hover:text-yellow-300'
              : 'text-base-content/25 hover:text-yellow-300'
          }`}
          onClick={() => onChange(value)}
          title={`${value}/5`}
          aria-label={`Set rating to ${value} of 5`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function ShotMainInfoCard({
  entry,
  isCompare = false,
  notes,
  loading = false,
  onRatingChange = () => {},
  showSummaryMetrics = true,
  className = '',
}) {
  const shotLabel = getAnalyzerShotDisplayName(entry?.shot, entry?.shotName || entry?.label);
  const shotProfileLabel = cleanName(entry?.shot?.profile || '');
  const profileLabel = cleanName(
    shotProfileLabel || entry?.profileName || entry?.profile?.label || '-',
  );
  const dateLabel = getShotDateTimeLabel(entry?.shot?.timestamp);
  const compareAccentColor = entry?.accentColor || 'var(--color-primary)';
  const compareAccentStrength = Number.isFinite(Number(entry?.accentStrength))
    ? Number(entry.accentStrength)
    : 1;
  const compareSolidAccent =
    compareAccentStrength >= 1
      ? compareAccentColor
      : `color-mix(in srgb, ${compareAccentColor} ${Math.round(compareAccentStrength * 100)}%, transparent)`;
  const compareCardStyle = isCompare
    ? {
        '--shot-details-accent-color': compareAccentColor,
        '--shot-details-statusbar-surface': compareSolidAccent,
      }
    : undefined;
  const displayClass = className || 'flex';

  return (
    <div
      className={`app-card-surface min-w-0 flex-col rounded-xl p-3 lg:p-2.5 xl:p-3 ${displayClass}`}
      style={compareCardStyle}
    >
      <div className='flex min-w-0 items-start gap-2'>
        <div className='min-w-0 flex-1'>
          <div className='text-base-content truncate text-sm font-semibold'>
            {shotLabel}
            <span className='text-base-content/45 ml-1.5 text-xs font-normal'>
              · {getRelativeDayLabel(entry?.shot?.timestamp)}
            </span>
          </div>
          <div className='text-base-content/60 truncate text-xs'>{profileLabel}</div>
        </div>
        <div className='flex shrink-0 items-center gap-2'>
          {loading ? (
            <FontAwesomeIcon icon={faCircleNotch} spin className='text-base-content/35 text-xs' />
          ) : null}
          {entry?.shot?.source === 'temp' ? (
            <FontAwesomeIcon icon={faEye} className='text-base-content/45 text-xs' />
          ) : (
            <SourceMarker source={entry?.shot?.source} variant='library' />
          )}
        </div>
      </div>

      {showSummaryMetrics ? <ShotSummaryMetricsRow total={entry?.results?.total} /> : null}

      <div className='mt-3 flex justify-center'>
        <RatingControl rating={notes?.rating} onChange={onRatingChange} />
      </div>

      <div className='mt-3 flex items-center justify-between'>
        <span className='text-base-content/45 text-xs italic'>{dateLabel}</span>
        <span className='text-base-content/45 text-xs italic'>
          <span
            style={
              entry?.results?.completionTone === 'warning'
                ? { color: 'var(--analyzer-warning-orange)' }
                : undefined
            }
          >
            {entry?.results?.completionLabel || entry?.results?.brewModeLabel}
          </span>
        </span>
      </div>
    </div>
  );
}
