import { useEffect, useState } from 'preact/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRightLong } from '@fortawesome/free-solid-svg-icons/faArrowRightLong';
import { faCalendarDays } from '@fortawesome/free-solid-svg-icons/faCalendarDays';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons/faChevronDown';
import { faPlay } from '@fortawesome/free-solid-svg-icons/faPlay';
import { faUndo } from '@fortawesome/free-solid-svg-icons/faUndo';
import { StatisticsSearchHelp } from './StatisticsSearchHelp';
import { StatisticsMultiSelectDropdown } from './StatisticsMultiSelectDropdown';
import './StatisticsToolbar.css';

// Dense, stateful toolbar UI for Statistics filters. The component stays presentational:
// selection/query/date logic is owned by StatisticsView and passed in via props.
const SOURCE_OPTIONS = [
  { value: 'gaggimate', label: 'GM' },
  { value: 'browser', label: 'WEB' },
  { value: 'both', label: 'ALL' },
];

const MODE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'profile', label: 'By Profile' },
  { value: 'shots', label: 'By Shots' },
];

const DATE_BASIS_OPTIONS = [
  { value: 'shot', label: 'Shot' },
  { value: 'auto', label: 'Auto' },
  { value: 'upload', label: 'Upload' },
];

const SEGMENT_GROUP_CLASS =
  'inline-flex overflow-hidden rounded-lg border border-base-content/10 bg-base-100/50 shadow-sm';
const SEGMENT_BUTTON_BASE_CLASS =
  'flex h-12 min-h-0 items-center justify-center border-0 border-r border-base-content/10 px-2.5 text-xs font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-40 sm:px-3';
const COMPACT_SEGMENT_BUTTON_BASE_CLASS =
  'flex h-10 min-h-0 items-center justify-center border-0 border-r border-base-content/10 px-2 text-[11px] font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-40';
const CALC_ACTIVE_SEGMENT_STYLE = {
  color: 'var(--analyzer-pred-info-blue)',
  backgroundColor: 'color-mix(in srgb, var(--analyzer-pred-info-blue) 12%, transparent)',
};
const WARNING_ORANGE_TEXT_STYLE = { color: 'var(--analyzer-warning-orange)' };
const WARNING_ORANGE_TEXT_MUTED_STYLE = {
  color: 'color-mix(in srgb, var(--analyzer-warning-orange) 70%, var(--color-base-content) 30%)',
};

function getSourceButtonClasses(value, isActive, isLast) {
  const base = `${SEGMENT_BUTTON_BASE_CLASS} ${isLast ? 'border-r-0' : ''} font-bold tracking-wide uppercase`;

  if (!isActive) {
    return `${base} bg-base-100/50 text-base-content/65 hover:bg-base-200/70`;
  }

  if (value === 'gaggimate') {
    return `${base} bg-blue-500/10 text-blue-500 hover:bg-blue-500/15`;
  }

  if (value === 'browser') {
    return `${base} bg-purple-500/10 text-purple-500 hover:bg-purple-500/15`;
  }

  return `${base} bg-base-content/8 text-base-content/85 hover:bg-base-content/12`;
}

function getSegmentButtonClasses({
  isActive,
  isLast,
  disabled = false,
  activeTone = 'primary',
  compact = false,
}) {
  const baseClass = compact ? COMPACT_SEGMENT_BUTTON_BASE_CLASS : SEGMENT_BUTTON_BASE_CLASS;
  const base = `${baseClass} ${isLast ? 'border-r-0' : ''}`;
  let activeClass = 'bg-primary text-primary-content';
  if (activeTone === 'secondary') {
    activeClass = 'bg-secondary text-secondary-content';
  } else if (activeTone === 'calc') {
    activeClass = 'bg-base-100/70 text-base-content';
  } else if (activeTone === 'neutral') {
    activeClass = 'bg-base-content/10 text-base-content';
  }
  const resolvedClass = isActive
    ? activeClass
    : 'bg-base-100/50 text-base-content/75 hover:bg-base-200/70';
  const disabledClass = disabled ? 'pointer-events-none opacity-40' : '';
  return `${base} ${resolvedClass} ${disabledClass}`;
}

function formatToolbarDateTimeDisplay(value) {
  if (!value) return '';
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (match) {
    const [, year, month, day, hour, minute] = match;
    return `${day}.${month}.${year}, ${hour}:${minute}`;
  }
  const parsed = new Date(value);
  const time = parsed.getTime();
  if (!Number.isFinite(time)) return value;
  try {
    return parsed.toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return value;
  }
}

function getDateRangeDisplay({
  dateFromLocal,
  dateToLocal,
  dateFromPreviewLocal,
  dateToPreviewLocal,
}) {
  const hasManualDateFilter = Boolean(dateFromLocal || dateToLocal);
  const fromValue = hasManualDateFilter ? dateFromLocal : dateFromPreviewLocal;
  const toValue = hasManualDateFilter ? dateToLocal : dateToPreviewLocal;
  const fromText = formatToolbarDateTimeDisplay(fromValue);
  const toText = formatToolbarDateTimeDisplay(toValue);

  if (hasManualDateFilter) {
    if (fromText && toText) {
      return { label: 'Date Range', fromText, toText, isAuto: false };
    }
    if (fromText) {
      return { label: 'From', fromText, toText: '', isAuto: false };
    }
    if (toText) {
      return { label: 'To', fromText: '', toText, isAuto: false };
    }
    return { label: 'Date Range', fromText: 'No dates', toText: '', isAuto: false };
  }

  if (fromText || toText) {
    return { label: 'Auto Range', fromText: fromText || 'No date', toText, isAuto: true };
  }

  return { label: 'Auto Range', fromText: 'No dates', toText: '', isAuto: true };
}

export function StatisticsToolbar({
  source,
  onSourceChange,
  mode,
  onModeChange,
  onGo,
  calcMode,
  onCalcModeChange,
  loading,
  metadataLoading = false,
  canGo = true,
  profileSelectionItems,
  selectedProfileNames,
  onSelectedProfileNamesChange,
  shotSelectionItems,
  selectedShotKeys,
  onSelectedShotKeysChange,
  query,
  onQueryChange,
  dateFromLocal,
  dateFromPreviewLocal = '',
  onDateFromChange,
  dateToLocal,
  dateToPreviewLocal = '',
  onDateToChange,
  dateBasisMode,
  onDateBasisModeChange,
  showDateBasisWarning = false,
  dateBasisWarningMessage = null,
  candidateCount,
  parseErrors = [],
  parseWarnings = [],
  onClearFilters,
  metadataError = null,
  selectionHint = null,
}) {
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(() => !!query);
  const isBusy = loading || metadataLoading;
  const canExecute = canGo && !isBusy;
  const topError = parseErrors[0]?.message || null;
  const topWarning = !topError ? parseWarnings[0]?.message : null;
  const hasDateFilter = Boolean(dateFromLocal || dateToLocal);
  const dateRangeDisplay = getDateRangeDisplay({
    dateFromLocal,
    dateToLocal,
    dateFromPreviewLocal,
    dateToPreviewLocal,
  });
  const showDateRangeLabelInTrigger = !dateRangeDisplay.isAuto;
  const candidateLabel = metadataLoading ? '...' : Number.isFinite(candidateCount) ? String(candidateCount) : '-';
  const resetAriaCount = metadataLoading
    ? 'loading candidates'
    : Number.isFinite(candidateCount)
      ? `${candidateCount} candidates`
      : 'unknown candidates';

  useEffect(() => {
    if (query || parseErrors.length > 0 || parseWarnings.length > 0) {
      setShowAdvancedSearch(true);
    }
  }, [query, parseErrors.length, parseWarnings.length]);

  return (
    <div className='flex w-full min-w-0 flex-col gap-3'>
      <div className='flex w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5'>
        <div className={SEGMENT_GROUP_CLASS}>
          {SOURCE_OPTIONS.map((opt, index) => (
            <button
              key={opt.value}
              type='button'
              className={getSourceButtonClasses(
                opt.value,
                source === opt.value,
                index === SOURCE_OPTIONS.length - 1,
              )}
              onClick={() => onSourceChange(opt.value)}
              disabled={isBusy}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className={SEGMENT_GROUP_CLASS}>
          {MODE_OPTIONS.map((opt, index) => (
            <button
              key={opt.value}
              type='button'
              className={getSegmentButtonClasses({
                isActive: mode === opt.value,
                isLast: index === MODE_OPTIONS.length - 1,
                disabled: !!opt.disabled,
                activeTone: opt.value === 'profile' ? 'secondary' : 'primary',
              })}
              onClick={() => !opt.disabled && onModeChange(opt.value)}
              disabled={isBusy || opt.disabled}
              title={opt.disabled ? 'Coming Soon' : ''}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {mode === 'profile' && (
          <>
            <StatisticsMultiSelectDropdown
              label='Profiles'
              items={profileSelectionItems}
              selectedIds={selectedProfileNames}
              onChange={onSelectedProfileNamesChange}
              disabled={isBusy}
              accentTone='secondary'
              emptyText='Select Profiles...'
            />
            <StatisticsMultiSelectDropdown
              label='Shots'
              items={shotSelectionItems}
              selectedIds={selectedShotKeys}
              onChange={onSelectedShotKeysChange}
              disabled={isBusy}
              accentTone='primary'
              emptyText='Select Shots...'
            />
          </>
        )}

        {mode === 'shots' && (
          <>
            <StatisticsMultiSelectDropdown
              label='Shots'
              items={shotSelectionItems}
              selectedIds={selectedShotKeys}
              onChange={onSelectedShotKeysChange}
              disabled={isBusy}
              accentTone='primary'
              emptyText='Select Shots...'
            />
            <StatisticsMultiSelectDropdown
              label='Profiles'
              items={profileSelectionItems}
              selectedIds={selectedProfileNames}
              onChange={onSelectedProfileNamesChange}
              disabled={isBusy}
              accentTone='secondary'
              emptyText='Select Profiles...'
            />
          </>
        )}

        <div className='ml-auto flex items-center gap-2'>
          <button
            type='button'
            onClick={onClearFilters}
            className='inline-flex h-12 min-h-0 w-12 flex-col items-center justify-center gap-0.5 rounded-lg border border-base-content/10 bg-base-100/45 px-0 text-base-content/70 shadow-sm transition-colors hover:bg-base-200/70 hover:text-base-content disabled:cursor-not-allowed disabled:opacity-40'
            disabled={isBusy}
            aria-label={`Clear filters and selections (${resetAriaCount})`}
            title={`Clear filters and selections (${resetAriaCount})`}
          >
            <FontAwesomeIcon icon={faUndo} className='text-lg leading-none' />
            <span className='text-[10px] leading-none font-semibold tabular-nums'>{candidateLabel}</span>
          </button>

          <button
            type='button'
            onClick={onGo}
            disabled={!canExecute}
            className='border-success/50 text-success hover:bg-success hover:border-success inline-flex h-12 min-h-0 w-24 items-center justify-center rounded-lg border-2 bg-base-100/50 shadow-sm transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40'
            aria-label='Run statistics'
            title='Run statistics'
          >
            <FontAwesomeIcon icon={faPlay} className='text-xl' />
          </button>
        </div>
      </div>

      <div className='flex w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5'>
        <details className='dropdown'>
          <summary
            className={`flex h-9 min-h-0 w-[13.25rem] list-none items-center gap-1.5 rounded-lg border px-2 text-left text-[10px] shadow-sm transition-colors sm:w-[15rem] md:w-[17.5rem] [&::-webkit-details-marker]:hidden ${
              hasDateFilter
                ? 'border-base-content/14 bg-base-100/55 text-base-content'
                : 'border-base-content/8 bg-base-100/30 text-base-content/70 hover:bg-base-100/40'
            }`}
            aria-label='Edit date range filter'
            title='Edit date range filter'
          >
            <FontAwesomeIcon
              icon={faCalendarDays}
              className={`shrink-0 ${hasDateFilter ? 'text-base-content/70' : 'text-base-content/45'}`}
            />
            {showDateRangeLabelInTrigger && (
              <>
                <span className='shrink-0 font-semibold tracking-wide'>{dateRangeDisplay.label}</span>
                <span className='text-base-content/35 shrink-0'>·</span>
              </>
            )}
            <span className='min-w-0 flex-1 truncate'>
              {dateRangeDisplay.fromText || 'No dates'}
              {dateRangeDisplay.toText && (
                <>
                  <span className='mx-1.5 inline-block align-middle text-base-content/35'>
                    <FontAwesomeIcon icon={faArrowRightLong} className='text-[9px]' />
                  </span>
                  {dateRangeDisplay.toText}
                </>
              )}
            </span>
            <FontAwesomeIcon icon={faChevronDown} className='shrink-0 text-[9px] opacity-50' />
          </summary>

          <div className='dropdown-content bg-base-100/95 border-base-content/10 z-[65] mt-2 w-[min(92vw,26rem)] rounded-xl border p-3 shadow-xl backdrop-blur-md'>
            <div className='grid gap-2'>
              <label className='flex items-center gap-2 text-[11px] font-semibold text-base-content/75'>
                <span className='w-10 shrink-0'>From</span>
                <input
                  type='datetime-local'
                  value={dateFromLocal}
                  onInput={e => onDateFromChange(e.target.value)}
                  step='60'
                  className='analyzer-statistics-datetime input input-bordered h-9 min-h-0 w-full border-base-content/10 bg-base-100/50 text-xs'
                  disabled={isBusy}
                  aria-label='Start date/time'
                  title='Start date/time'
                />
              </label>

              <label className='flex items-center gap-2 text-[11px] font-semibold text-base-content/75'>
                <span className='w-10 shrink-0'>To</span>
                <input
                  type='datetime-local'
                  value={dateToLocal}
                  onInput={e => onDateToChange(e.target.value)}
                  step='60'
                  className='analyzer-statistics-datetime input input-bordered h-9 min-h-0 w-full border-base-content/10 bg-base-100/50 text-xs'
                  disabled={isBusy}
                  aria-label='End date/time'
                  title='End date/time'
                />
              </label>
            </div>

            <div className='mt-3 flex items-center justify-between gap-2'>
              <div className='text-[10px] text-base-content/55'>
                {dateRangeDisplay.isAuto
                  ? 'Using auto range from current shot selection.'
                  : 'Manual date filter is active.'}
              </div>
              <button
                type='button'
                onClick={() => {
                  onDateFromChange('');
                  onDateToChange('');
                }}
                disabled={isBusy || (!dateFromLocal && !dateToLocal)}
                className='btn btn-ghost btn-xs h-7 min-h-0 rounded-md border border-base-content/10 px-2 text-[10px] font-semibold'
                title='Clear date filter'
              >
                Clear Date Filter
              </button>
            </div>
          </div>
        </details>

        <div className='ml-auto flex min-w-0 flex-1 items-center justify-end gap-2'>
          {showAdvancedSearch && (
            <div className='min-w-[16rem] max-w-[38rem] flex-1'>
              <input
                type='text'
                value={query}
                onInput={e => onQueryChange(e.target.value)}
                placeholder='name:"325"; profile:3_0_25; date:>h-7d;'
                className='input input-bordered h-9 min-h-0 w-full border-base-content/10 bg-base-100/50 text-xs shadow-sm'
                disabled={isBusy}
              />
            </div>
          )}

          {showAdvancedSearch && (
            <button
              type='button'
              className={`inline-flex h-9 min-h-0 w-12 items-center justify-center rounded-lg border border-base-content/10 px-2 text-[10px] font-medium tracking-wide shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                calcMode
                  ? 'text-base-content/80 hover:bg-base-200/50 hover:text-base-content'
                  : 'bg-base-content/6 text-base-content/90 hover:bg-base-content/8'
              }`}
              style={calcMode ? CALC_ACTIVE_SEGMENT_STYLE : undefined}
              onClick={() => onCalcModeChange(!calcMode)}
              disabled={isBusy}
              aria-label={`Toggle calculation mode (currently ${calcMode ? 'Calc' : 'Raw'})`}
              title={`Current: ${calcMode ? 'Calc' : 'Raw'} (click to switch)`}
            >
              {calcMode ? 'Calc' : 'Raw'}
            </button>
          )}

          {showAdvancedSearch && <StatisticsSearchHelp />}

          <button
            type='button'
            onClick={() => setShowAdvancedSearch(prev => !prev)}
            disabled={isBusy}
            aria-pressed={showAdvancedSearch}
            aria-label='Toggle advanced search'
            title='Toggle advanced search'
            className={`inline-flex h-9 min-h-0 w-24 items-center justify-center rounded-lg border px-2 text-[10px] font-semibold whitespace-nowrap shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              showAdvancedSearch
                ? 'border-base-content/20 bg-base-content/8 text-base-content hover:bg-base-content/12'
                : 'border-base-content/10 bg-base-100/45 text-base-content/70 hover:bg-base-200/60 hover:text-base-content'
            }`}
          >
            Advanced
          </button>
        </div>
      </div>

      {showDateBasisWarning && (
        <div
          className='flex w-full min-w-0 flex-wrap items-center gap-2 rounded-lg border px-2 py-2'
          style={{
            borderColor: 'color-mix(in srgb, var(--analyzer-warning-orange) 28%, transparent)',
            background: 'color-mix(in srgb, var(--analyzer-warning-orange) 9%, transparent)',
          }}
        >
          <div className='min-w-[14rem] flex-1 text-[11px] leading-relaxed' style={WARNING_ORANGE_TEXT_MUTED_STYLE}>
            <span className='font-semibold' style={WARNING_ORANGE_TEXT_STYLE}>Date Basis:</span>{' '}
            <span className='text-base-content/80'>
              {dateBasisWarningMessage ||
                'Some shots have no shot timestamp. Choose how date handling should treat them.'}
            </span>
          </div>
          <div className={SEGMENT_GROUP_CLASS}>
            {DATE_BASIS_OPTIONS.map((opt, index) => (
              <button
                key={opt.value}
                type='button'
                className={getSegmentButtonClasses({
                  isActive: dateBasisMode === opt.value,
                  isLast: index === DATE_BASIS_OPTIONS.length - 1,
                  activeTone: opt.value === 'auto' ? 'secondary' : 'neutral',
                  compact: true,
                })}
                onClick={() => onDateBasisModeChange(opt.value)}
                disabled={isBusy}
                title={
                  opt.value === 'shot'
                    ? 'Use shot timestamp only'
                    : opt.value === 'auto'
                      ? 'Use shot timestamp, fallback to upload time'
                      : 'Use upload time only'
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {(topError || topWarning || metadataError) && (
        <div className='flex min-h-5 items-center gap-2 px-1 text-[11px]'>
          {topError ? (
            <span className='text-error font-semibold'>{topError}</span>
          ) : metadataError ? (
            <span className='font-semibold' style={WARNING_ORANGE_TEXT_STYLE}>{metadataError}</span>
          ) : (
            <span className='font-semibold' style={WARNING_ORANGE_TEXT_STYLE}>{topWarning}</span>
          )}
          {parseErrors.length > 1 && (
            <span className='text-error/70'>+{parseErrors.length - 1} more</span>
          )}
          {!topError && parseWarnings.length > 1 && (
            <span style={WARNING_ORANGE_TEXT_MUTED_STYLE}>+{parseWarnings.length - 1} more</span>
          )}
        </div>
      )}

      {!topError && !metadataError && selectionHint && (
        <div
          className='px-1 text-[11px] font-semibold'
          style={{ color: 'var(--analyzer-warning-orange)' }}
        >
          {selectionHint}
        </div>
      )}
    </div>
  );
}
