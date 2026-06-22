import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleNotch } from '@fortawesome/free-solid-svg-icons/faCircleNotch';
import { faBullseye } from '@fortawesome/free-solid-svg-icons/faBullseye';
import { faClock } from '@fortawesome/free-solid-svg-icons/faClock';
import { faDroplet } from '@fortawesome/free-solid-svg-icons/faDroplet';
import { faEye } from '@fortawesome/free-solid-svg-icons/faEye';
import { faFaucet } from '@fortawesome/free-solid-svg-icons/faFaucet';
import { faGears } from '@fortawesome/free-solid-svg-icons/faGears';
import { faGaugeHigh } from '@fortawesome/free-solid-svg-icons/faGaugeHigh';
import { faTag } from '@fortawesome/free-solid-svg-icons/faTag';
import { faTemperatureHalf } from '@fortawesome/free-solid-svg-icons/faTemperatureHalf';
import { faPenToSquare } from '@fortawesome/free-solid-svg-icons/faPenToSquare';
import { faYinYang } from '@fortawesome/free-solid-svg-icons/faYinYang';
import { faWeightScale } from '@fortawesome/free-solid-svg-icons/faWeightScale';
import { CardTitle } from '../../../components/CardTitle';
import { cleanName, formatMetricValue, getNotesTasteStyle } from '../utils/analyzerUtils';
import { SourceMarker } from './SourceMarker';
import { BREW_BY_TIME_TEXT, BREW_BY_WEIGHT_TEXT } from './shotChart/constants';
import {
  getAnalyzerShotDisplayName,
  getShotDateTimeLabel,
  useShotNotesState,
} from './useShotNotesState';

const tasteOptions = [
  { value: 'bitter', label: 'Bitter' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'sour', label: 'Sour' },
];

const fieldLabelClass =
  'text-base-content/55 mb-0.5 flex items-center gap-1.5 text-xs leading-tight font-medium';
const inputClass =
  'border-base-content/10 bg-base-100/80 text-base-content input input-xs min-h-8 w-full rounded-md text-xs lg:min-h-7 xl:min-h-8';
const textareaClass =
  'border-base-content/10 bg-base-100/80 text-base-content textarea textarea-bordered textarea-xs min-h-[5rem] w-full rounded-md !text-xs leading-relaxed lg:min-h-[4rem] xl:min-h-[5rem]';
const DEFAULT_RATIO = 2;
const RATIO_SLIDER_MIN = 1;
const RATIO_SLIDER_MAX = 4;
const RATIO_SLIDER_STEP = 0.1;

const metricRows = [
  {
    key: 'duration',
    label: 'Duration',
    unit: 's',
    color: 'var(--statistics-summary-duration)',
    icon: faClock,
    getValue: total => total?.duration,
  },
  {
    key: 'w',
    label: 'Weight',
    unit: 'g',
    color: 'var(--analyzer-weight-text)',
    icon: faWeightScale,
    getValue: total => total?.weight,
  },
  {
    key: 'tt',
    label: 'Target Temperature',
    unit: '\u2103',
    color: 'var(--analyzer-target-temp-text)',
    icon: faBullseye,
    getValue: total => total?.tt?.avg,
  },
  {
    key: 't',
    label: 'Avg. Temperature',
    unit: '\u2103',
    color: 'var(--analyzer-temp-text)',
    icon: faTemperatureHalf,
    getValue: total => total?.t?.avg,
  },
  {
    key: 'pPeak',
    label: 'Peak Pressure',
    unit: 'bar',
    color: 'var(--analyzer-pressure-text)',
    icon: faGaugeHigh,
    getValue: total => total?.p?.max,
  },
  {
    key: 'f',
    label: 'Avg. Pump Flow',
    unit: 'ml/s',
    color: 'var(--analyzer-flow-text)',
    icon: faFaucet,
    getValue: total => total?.f?.avg,
  },
  {
    key: 'water',
    label: 'Pumped Water',
    unit: 'ml',
    color: 'var(--statistics-summary-water)',
    icon: faDroplet,
    getValue: total => total?.water,
  },
];

function clampRatioValue(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return RATIO_SLIDER_MIN;
  return Math.min(RATIO_SLIDER_MAX, Math.max(RATIO_SLIDER_MIN, numericValue));
}

function getRatioValueFromPointer(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  const pointerX = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
  const progress = rect.width > 0 ? pointerX / rect.width : 0;
  const rawValue = RATIO_SLIDER_MIN + progress * (RATIO_SLIDER_MAX - RATIO_SLIDER_MIN);
  const steppedValue = Math.round(rawValue / RATIO_SLIDER_STEP) * RATIO_SLIDER_STEP;

  return clampRatioValue(steppedValue).toFixed(1);
}

function formatDosePreviewValue(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue.toFixed(1) : '-';
}

function getRatioDosePreview(notes, ratio) {
  const numericRatio = Number(ratio);
  const doseIn = Number(notes?.doseIn);
  const doseOut = Number(notes?.doseOut);

  if (!Number.isFinite(numericRatio) || numericRatio <= 0) {
    return { doseIn: null, doseOut: null };
  }

  if (Number.isFinite(doseOut) && doseOut > 0) {
    return {
      doseIn: doseOut / numericRatio,
      doseOut,
    };
  }

  if (Number.isFinite(doseIn) && doseIn > 0) {
    return {
      doseIn,
      doseOut: doseIn * numericRatio,
    };
  }

  return { doseIn: null, doseOut: null };
}

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

function getSelectedTasteButtonStyle(taste) {
  const tasteStyle = getNotesTasteStyle(taste);
  if (!tasteStyle) return undefined;
  return {
    '--shot-details-taste-selected-bg': tasteStyle.selectedBackground,
  };
}

function DetailField({ icon, label, children, className = '', action = null }) {
  return (
    <div className={className}>
      <div className={`${fieldLabelClass} justify-between`}>
        <span className='flex min-w-0 items-center gap-1.5'>
          {icon ? <FontAwesomeIcon icon={icon} className='text-[0.7rem]' /> : null}
          {label}
        </span>
        {action}
      </div>
      {children}
    </div>
  );
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

function SummaryMetric({ label, unit, value }) {
  return (
    <div className='min-w-0 flex-1 text-center'>
      <div className='flex items-baseline justify-center gap-1.5 lg:gap-1 xl:gap-1.5'>
        <span className='truncate text-base leading-none font-normal tabular-nums lg:text-sm xl:text-base'>
          {formatMetricValue(value)}
        </span>
        <span className='text-base-content/55 text-xs lg:text-[0.68rem] xl:text-xs'>{unit}</span>
      </div>
      <div className='text-base-content/55 mt-0.5 truncate text-center text-xs leading-tight font-medium'>
        {label}
      </div>
    </div>
  );
}

function ShotSummaryMetricsRow({ total, className = '' }) {
  return (
    <div className={className || 'mt-4 flex gap-2 lg:mt-3.5 lg:gap-1.5 xl:mt-4 xl:gap-2'}>
      <SummaryMetric label='Duration' unit='s' value={total?.duration} />
      <SummaryMetric label='Weight' unit='g' value={total?.weight} />
      <SummaryMetric label='Temperature' unit='°C' value={total?.tt?.avg} />
    </div>
  );
}

export function MetricValueGrid({ total, excludeKeys = [], flat }) {
  const items = metricRows
    .filter(row => !excludeKeys.includes(row.key))
    .map(row => ({
      ...row,
      value: row.getValue(total),
    }))
    .filter(row => Number.isFinite(Number(row.value)));

  if (items.length === 0) return null;

  const itemClass = flat
    ? 'flex min-w-0 flex-col items-center justify-center text-center'
    : 'app-card-surface flex min-h-[3.4rem] min-w-0 flex-col items-center justify-center rounded-xl p-2 text-center lg:min-h-[3rem] lg:p-1.5 xl:min-h-[3.4rem] xl:p-2';

  return (
    <div className='grid grid-cols-2 gap-3'>
      {items.map(row => (
        <div key={row.key} className={itemClass}>
          <div className='analyzer-icon-metric analyzer-icon-metric--without-icon'>
            <div className='analyzer-icon-metric__content'>
              <div className='flex max-w-full items-baseline justify-center gap-1.5 lg:gap-1 xl:gap-1.5'>
                <span className='analyzer-icon-metric__value truncate text-base leading-none font-normal tabular-nums lg:text-sm xl:text-base'>
                  {formatMetricValue(row.value, row.digits)}
                </span>
                <span className='text-base-content/55 text-xs lg:text-[0.68rem] xl:text-xs'>
                  {row.unit}
                </span>
              </div>
              <div className='text-base-content/55 mt-0.5 max-w-full truncate text-center text-xs leading-tight font-medium'>
                {row.label}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ShotMainInfoCard({
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
          {entry?.results?.isBrewByWeight ? BREW_BY_WEIGHT_TEXT : BREW_BY_TIME_TEXT}
        </span>
      </div>
    </div>
  );
}

function getCoffeeType(r) {
  if (!r) return null;
  const v = Number(r);
  if (v <= 1.5) return 'Ristretto';
  if (v <= 2.5) return 'Espresso';
  return 'Lungo';
}

function useRatioCardState({ currentShot, entryKey }) {
  const { notes, loading, handleInputChange, saveNotes, updateAndSave } = useShotNotesState({
    currentShot,
  });
  const saveTimerRef = useRef(null);
  const [sliderRatio, setSliderRatio] = useState(DEFAULT_RATIO);
  const [sliderTouched, setSliderTouched] = useState(false);
  const [isEditingRatio, setIsEditingRatio] = useState(false);

  useEffect(() => {
    if (!notes.ratio) setSliderTouched(false);
  }, [notes.ratio]);

  useEffect(() => {
    const numericRatio = Number(notes.ratio);
    if (Number.isFinite(numericRatio)) setSliderRatio(numericRatio.toFixed(1));
  }, [notes.ratio]);

  const clearSaveTimer = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, []);

  const flushSave = useCallback(() => {
    clearSaveTimer();
    saveNotes();
  }, [clearSaveTimer, saveNotes]);

  const scheduleSave = useCallback(() => {
    clearSaveTimer();
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      saveNotes();
    }, 650);
  }, [clearSaveTimer, saveNotes]);

  const handleFieldChange = useCallback(
    (field, value) => {
      handleInputChange(field, value);
      scheduleSave();
    },
    [handleInputChange, scheduleSave],
  );

  const handleRatioCommit = useCallback(
    value => {
      clearSaveTimer();
      setIsEditingRatio(false);
      void updateAndSave('ratio', value);
    },
    [clearSaveTimer, updateAndSave],
  );

  useEffect(() => clearSaveTimer, [clearSaveTimer, entryKey]);

  return {
    flushSave,
    handleFieldChange,
    handleRatioCommit,
    loading,
    notes,
    isEditingRatio,
    sliderRatio,
    sliderTouched,
    updateAndSave,
    setIsEditingRatio,
    setSliderRatio,
    setSliderTouched,
  };
}

function ShotRatioCard({
  notes,
  isEditingRatio = false,
  sliderRatio,
  sliderTouched,
  onSliderInput,
  onSliderActivate,
  onRatioCommit,
  onEditRatio,
  className = '',
}) {
  const showRatioDisplay = notes.ratio && !isEditingRatio;
  const dosePreview = getRatioDosePreview(notes, sliderRatio);
  const sliderCardClass = showRatioDisplay ? '' : 'cursor-ew-resize touch-none select-none';

  const updateRatioFromPointer = event => {
    if (showRatioDisplay) return null;

    const nextRatio = getRatioValueFromPointer(event);
    onSliderActivate();
    onSliderInput(nextRatio);

    return nextRatio;
  };

  return (
    <div
      className={`app-card-surface flex h-[68px] min-w-0 flex-col rounded-xl p-3 lg:h-[60px] lg:p-2.5 xl:h-[68px] xl:p-3 ${sliderCardClass} ${className}`}
      onPointerDown={event => {
        if (showRatioDisplay) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        updateRatioFromPointer(event);
      }}
      onPointerMove={event => {
        if (showRatioDisplay) return;
        if (event.pointerType !== 'touch' && event.buttons !== 1) return;
        updateRatioFromPointer(event);
      }}
      onPointerUp={event => {
        if (showRatioDisplay) return;
        const nextRatio = updateRatioFromPointer(event);
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        if (nextRatio) onRatioCommit(nextRatio);
      }}
      onPointerCancel={event => {
        if (showRatioDisplay) return;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        onRatioCommit(clampRatioValue(sliderRatio).toFixed(1));
      }}
    >
      {showRatioDisplay ? (
        <div className='flex min-h-0 flex-1 flex-col justify-center'>
          <div className='grid grid-cols-2 gap-1.5 lg:gap-1 xl:gap-1.5'>
            <div className='flex flex-col items-center'>
              <button
                type='button'
                className='hover:text-primary cursor-pointer truncate rounded-sm px-1 text-base leading-none font-normal tabular-nums transition-colors lg:text-sm xl:text-base'
                onClick={onEditRatio}
                aria-label='Edit ratio'
                title='Edit ratio'
              >
                1:{formatMetricValue(notes.ratio, 1)}
              </button>
              <span className='text-base-content/55 mt-0.5 truncate text-xs leading-tight font-medium'>
                Ratio
              </span>
            </div>
            <div className='flex flex-col items-center'>
              <span className='text-base leading-none font-normal lg:text-sm xl:text-base'>
                {getCoffeeType(notes.ratio)}
              </span>
              <span className='text-base-content/55 mt-0.5 truncate text-xs leading-tight font-medium'>
                Type
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className='flex min-h-0 flex-1 flex-col justify-center'>
          <div className='grid min-w-0 grid-cols-3 items-center gap-2'>
            <span
              className={`min-w-0 truncate text-left text-xs font-medium tabular-nums ${
                sliderTouched ? 'text-base-content/35' : 'text-base-content/55'
              }`}
            >
              {sliderTouched ? `${formatDosePreviewValue(dosePreview.doseIn)} g in` : 'Ratio'}
            </span>
            <span className='min-w-0 truncate text-center text-xs font-medium tabular-nums'>
              {sliderTouched ? `1:${formatMetricValue(sliderRatio, 1)}` : ''}
            </span>
            <span className='text-base-content/35 min-w-0 truncate text-right text-xs font-medium tabular-nums'>
              {sliderTouched ? `${formatDosePreviewValue(dosePreview.doseOut)} g out` : '–'}
            </span>
          </div>
          <div className='relative mt-1.5 h-3'>
            <input
              type='range'
              min={RATIO_SLIDER_MIN}
              max={RATIO_SLIDER_MAX}
              step={RATIO_SLIDER_STEP}
              value={sliderRatio}
              onInput={event => onSliderInput(event.currentTarget.value)}
              onFocus={onSliderActivate}
              onKeyUp={event => {
                if (event.key === 'Enter') onRatioCommit(event.currentTarget.value);
              }}
              className={`ratio-slider absolute inset-x-0 top-1/2 w-full -translate-y-1/2 cursor-pointer ${sliderTouched ? 'ratio-slider--touched' : ''}`}
            />
          </div>
          <div className='text-base-content/40 mt-1 flex justify-between px-0.5 text-[0.6rem] leading-none'>
            <span>1:1</span>
            <span>1:2</span>
            <span>1:3</span>
            <span>1:4</span>
          </div>
          <style>{`
            .ratio-slider {
              -webkit-appearance: none;
              appearance: none;
              height: 46px;
              background: transparent;
              outline: none;
              pointer-events: none;
              touch-action: none;
            }
            .ratio-slider::-webkit-slider-runnable-track {
              height: 4px;
              background: color-mix(in srgb, var(--color-base-content) 28%, transparent);
              border-radius: 2px;
            }
            .ratio-slider::-webkit-slider-thumb {
              -webkit-appearance: none;
              appearance: none;
              width: 2px;
              height: 14px;
              margin-top: -5px;
              background: color-mix(in srgb, var(--color-base-content) 32%, transparent);
              border-radius: 1px;
              cursor: pointer;
            }
            .ratio-slider--touched::-webkit-slider-thumb {
              background: var(--color-base-content);
            }
            .ratio-slider::-moz-range-track {
              height: 4px;
              background: color-mix(in srgb, var(--color-base-content) 28%, transparent);
              border-radius: 2px;
            }
            .ratio-slider::-moz-range-thumb {
              width: 2px;
              height: 14px;
              background: color-mix(in srgb, var(--color-base-content) 32%, transparent);
              border-radius: 1px;
              border: none;
              cursor: pointer;
            }
            .ratio-slider--touched::-moz-range-thumb {
              background: var(--color-base-content);
            }
          `}</style>
        </div>
      )}
    </div>
  );
}

export function ShotMobilePrimaryCards({ entry, index = 0 }) {
  const {
    loading,
    notes,
    isEditingRatio,
    sliderRatio,
    sliderTouched,
    updateAndSave,
    handleRatioCommit,
    setIsEditingRatio,
    setSliderRatio,
    setSliderTouched,
  } = useRatioCardState({
    currentShot: entry?.shot,
    entryKey: entry?.key || entry?.shot?.id || entry?.shotName || index,
  });

  return (
    <div className='shot-mobile-primary-cards flex flex-col lg:hidden'>
      <ShotMainInfoCard
        entry={entry}
        notes={notes}
        loading={loading}
        onRatingChange={value => updateAndSave('rating', value)}
      />
      <ShotRatioCard
        notes={notes}
        isEditingRatio={isEditingRatio}
        sliderRatio={sliderRatio}
        sliderTouched={sliderTouched}
        onSliderInput={value => {
          setSliderRatio(value);
          if (!sliderTouched) setSliderTouched(true);
        }}
        onSliderActivate={() => {
          if (!sliderTouched) setSliderTouched(true);
        }}
        onRatioCommit={handleRatioCommit}
        onEditRatio={() => {
          setSliderTouched(true);
          setIsEditingRatio(true);
        }}
        className='sm:hidden'
      />
    </div>
  );
}

function ShotDetailsCard({ entry, isCompare }) {
  const {
    flushSave,
    handleFieldChange,
    handleRatioCommit,
    loading,
    notes,
    isEditingRatio,
    sliderRatio,
    sliderTouched,
    updateAndSave,
    setIsEditingRatio,
    setSliderRatio,
    setSliderTouched,
  } = useRatioCardState({
    currentShot: entry.shot,
    entryKey: entry.key,
  });
  const duplicateMobileSummaryClass = isCompare ? '' : 'hidden lg:flex';
  const duplicateMobileRatioClass = isCompare ? '' : 'hidden sm:flex';
  const duplicateMobileMetricsClass = isCompare ? 'hidden lg:block' : 'hidden sm:block';

  return (
    <section className='relative flex h-full flex-col gap-3'>
      <ShotMainInfoCard
        entry={entry}
        isCompare={isCompare}
        notes={notes}
        loading={loading}
        onRatingChange={value => updateAndSave('rating', value)}
        className={duplicateMobileSummaryClass || 'flex'}
      />

      <ShotRatioCard
        notes={notes}
        isEditingRatio={isEditingRatio}
        sliderRatio={sliderRatio}
        sliderTouched={sliderTouched}
        onSliderInput={value => {
          setSliderRatio(value);
          if (!sliderTouched) setSliderTouched(true);
        }}
        onSliderActivate={() => {
          if (!sliderTouched) setSliderTouched(true);
        }}
        onRatioCommit={handleRatioCommit}
        onEditRatio={() => {
          setSliderTouched(true);
          setIsEditingRatio(true);
        }}
        className={duplicateMobileRatioClass}
      />

      <div className={duplicateMobileMetricsClass}>
        <div className='app-card-surface min-w-0 flex-col rounded-xl p-3 lg:p-2.5 xl:p-3'>
          <CardTitle className='mb-3'>Shot Metrics</CardTitle>
          <MetricValueGrid
            total={entry.results?.total}
            excludeKeys={['duration', 'w', 'tt']}
            flat
          />
        </div>
      </div>

      <div className='app-card-surface flex flex-1 flex-col gap-3 rounded-xl p-3 lg:p-2.5 xl:p-3'>
        <CardTitle>Shot Notes</CardTitle>
        <div className='grid grid-cols-2 gap-3'>
          <DetailField icon={faWeightScale} label='Dose In'>
            <input
              type='number'
              step='0.1'
              className={inputClass}
              value={notes.doseIn || ''}
              onInput={event => handleFieldChange('doseIn', event.target.value)}
              onBlur={flushSave}
              placeholder='18.0'
            />
          </DetailField>
          <DetailField icon={faWeightScale} label='Dose Out'>
            <input
              type='number'
              step='0.1'
              className={inputClass}
              value={notes.doseOut || ''}
              onInput={event => handleFieldChange('doseOut', event.target.value)}
              onBlur={flushSave}
              placeholder='36.0'
            />
          </DetailField>
          <DetailField icon={faGears} label='Grind' className='col-span-2'>
            <input
              type='text'
              className={inputClass}
              value={notes.grindSetting || ''}
              onInput={event => handleFieldChange('grindSetting', event.target.value)}
              onBlur={flushSave}
              placeholder='2.5'
            />
          </DetailField>
          <DetailField icon={faTag} label='Beans' className='col-span-2'>
            <input
              type='text'
              className={inputClass}
              value={notes.beanType || ''}
              onInput={event => handleFieldChange('beanType', event.target.value)}
              onBlur={flushSave}
              placeholder='Single Origin, Blend...'
            />
          </DetailField>
          <DetailField icon={faYinYang} label='Balance / Taste' className='col-span-2'>
            <div className='bg-base-200/70 flex w-full min-w-0 rounded-full p-0.5'>
              {tasteOptions.map(option => (
                <button
                  key={option.value}
                  type='button'
                  className={`flex min-w-0 flex-1 cursor-pointer items-center justify-center rounded-full px-2 py-1 text-xs transition-all duration-200 ${
                    notes.balanceTaste === option.value
                      ? 'text-base-content bg-[var(--shot-details-taste-selected-bg)] font-medium'
                      : 'text-base-content/60 hover:text-base-content'
                  }`}
                  style={getSelectedTasteButtonStyle(option.value)}
                  onClick={() => updateAndSave('balanceTaste', option.value)}
                >
                  <span className='truncate'>{option.label}</span>
                </button>
              ))}
            </div>
          </DetailField>
        </div>
        <DetailField
          icon={faPenToSquare}
          label='Notes'
          className='flex min-h-0 flex-1 flex-col'
          action={
            <span className='text-base-content/45 text-xs'>{(notes.notes || '').length}/200</span>
          }
        >
          <textarea
            className={`${textareaClass} flex-1`}
            value={notes.notes || ''}
            maxLength={200}
            onInput={event => handleFieldChange('notes', event.target.value)}
            onBlur={flushSave}
            placeholder='Tasting notes, brewing observations...'
          />
        </DetailField>
      </div>
    </section>
  );
}

function getCompareDetailTabKey(entry, index) {
  return entry?.key || entry?.shot?.id || entry?.shotName || index;
}

function CompareShotTabs({ entries = [], activeIndex = 0, onChange = () => {} }) {
  const tabs = entries.map((entry, index) => ({
    id: getCompareDetailTabKey(entry, index),
    index,
    label: `Shot ${index + 1}`,
  }));

  if (tabs.length <= 1) return null;

  return (
    <div role='tablist' className='tabs tabs-border'>
      {tabs.map(tab => (
        <button
          key={tab.id}
          type='button'
          role='tab'
          className={`tab ${activeIndex === tab.index ? 'tab-active' : ''}`}
          aria-selected={activeIndex === tab.index}
          onClick={() => onChange(tab.index)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function ShotDetailsPanel({
  entries = [],
  isCompareActive = false,
  activeCompareIndex = 0,
  onActiveCompareIndexChange = () => {},
}) {
  const validEntries = entries.filter(entry => entry?.shot);
  if (validEntries.length === 0) return null;

  if (isCompareActive) {
    const resolvedActiveIndex =
      activeCompareIndex >= 0 && activeCompareIndex < validEntries.length ? activeCompareIndex : 0;
    const activeEntry = validEntries[resolvedActiveIndex];

    return (
      <div className='flex h-full flex-col gap-3 lg:gap-6'>
        <CompareShotTabs
          entries={validEntries}
          activeIndex={resolvedActiveIndex}
          onChange={onActiveCompareIndexChange}
        />
        <div key={getCompareDetailTabKey(activeEntry, resolvedActiveIndex)} className='flex-1'>
          <ShotDetailsCard entry={activeEntry} isCompare={isCompareActive} />
        </div>
      </div>
    );
  }

  return (
    <div className='flex h-full flex-col gap-3'>
      {validEntries.map((entry, index) => (
        <div key={getCompareDetailTabKey(entry, index)} className='flex-1'>
          <ShotDetailsCard entry={entry} isCompare={false} />
        </div>
      ))}
    </div>
  );
}
