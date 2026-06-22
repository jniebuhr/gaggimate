import { useEffect, useRef, useState } from 'preact/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRightLong } from '@fortawesome/free-solid-svg-icons/faArrowRightLong';
import { faCalendarDays } from '@fortawesome/free-solid-svg-icons/faCalendarDays';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons/faChevronDown';
import { faPlay } from '@fortawesome/free-solid-svg-icons/faPlay';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { faUndo } from '@fortawesome/free-solid-svg-icons/faUndo';
import { SourceMarker } from '../../ShotAnalyzer/components/SourceMarker';
import {
  getAnalyzerSurfaceTriggerClasses,
  getAnalyzerTextButtonClasses,
} from '../../ShotAnalyzer/components/analyzerControlStyles';
import { StatisticsSearchHelp } from './StatisticsSearchHelp';
import { StatisticsMultiSelectDropdown } from './StatisticsMultiSelectDropdown';
import {
  STATISTICS_DROPDOWN_PANEL_SURFACE_CLASS,
  STATISTICS_DROPDOWN_PANEL_SURFACE_STYLE,
} from './statisticsDropdownSurface';
import './StatisticsToolbar.css';

/* global globalThis */

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

export const STATISTICS_RUN_BUTTON_TONE_CLASS =
  'bg-success text-success-content hover:bg-success/92 hover:text-success-content';

const STATISTICS_TOP_ROW_CONTROL_HEIGHT_CLASS = 'btn btn-md h-10 min-h-10 border-none shadow-none';
const SEGMENT_GROUP_CLASS =
  'inline-flex overflow-hidden rounded-lg bg-base-content/4 divide-x divide-base-content/10';
const SEGMENT_BUTTON_BASE_CLASS =
  'flex h-11 min-h-0 items-center justify-center border-0 px-2 text-xs font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-40 sm:px-2.5';
const COMPACT_SEGMENT_BUTTON_BASE_CLASS =
  'flex h-9 min-h-0 items-center justify-center border-0 px-1.5 text-[11px] font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-40';
const WARNING_ORANGE_TEXT_STYLE = { color: 'var(--analyzer-warning-orange)' };
const WARNING_ORANGE_TEXT_MUTED_STYLE = {
  color: 'color-mix(in srgb, var(--analyzer-warning-orange) 70%, var(--color-base-content) 30%)',
};
const STATISTICS_DROPDOWN_PANEL_CLASSES = `dropdown-content mt-2 ${STATISTICS_DROPDOWN_PANEL_SURFACE_CLASS}`;
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

function getPrimaryDropdownToneClasses() {
  return 'bg-primary text-primary-content hover:bg-primary/92';
}

function getNeutralDropdownToneClasses() {
  return 'bg-transparent text-base-content/70 hover:text-base-content';
}

function getMenuItemClasses({ tone = 'neutral', isActive = false } = {}) {
  if (tone === 'primary') {
    return isActive
      ? 'bg-primary text-primary-content hover:bg-primary/92'
      : 'text-primary hover:bg-primary/12';
  }

  return isActive
    ? 'text-base-content hover:bg-base-content/5'
    : 'text-base-content/75 hover:bg-base-content/5 hover:text-base-content';
}

function renderCompactSourceSummary(option) {
  if (!option) return null;
  if (option.value === 'both') {
    return (
      <span className='inline-flex items-center gap-0.5'>
        <SourceMarker source='gaggimate' variant='compact' />
        <SourceMarker source='browser' variant='compact' />
      </span>
    );
  }

  return <SourceMarker source={option.value} variant='compact' />;
}

function renderCombinedSourceSummary({ shotOption, profileOption }) {
  return (
    <span className='inline-flex min-w-0 items-center gap-1.5'>
      <span className='inline-flex min-w-0 items-center gap-1.5'>
        <span className='shrink-0'>{renderCompactSourceSummary(shotOption)}</span>
        <span className='text-base-content/70 min-w-0 truncate text-[11px] font-semibold'>
          Shots
        </span>
      </span>
      <span className='text-base-content/35 shrink-0'>·</span>
      <span className='inline-flex min-w-0 items-center gap-1.5'>
        <span className='shrink-0'>{renderCompactSourceSummary(profileOption)}</span>
        <span className='text-base-content/70 min-w-0 truncate text-[11px] font-semibold'>
          Profiles
        </span>
      </span>
    </span>
  );
}

function renderSourceOptionContent(option) {
  if (!option) return null;
  if (option.value === 'both') {
    return <span>{option.label}</span>;
  }

  return (
    <span className='inline-flex items-center gap-2'>
      <SourceMarker source={option.value} variant='compact' />
      <span>{option.label}</span>
    </span>
  );
}

function closeParentDetails(target) {
  const details = target.closest('details');
  if (details) details.open = false;
}

function getSegmentButtonClasses({
  isActive,
  disabled = false,
  activeTone = 'primary',
  compact = false,
}) {
  const baseClass = compact ? COMPACT_SEGMENT_BUTTON_BASE_CLASS : SEGMENT_BUTTON_BASE_CLASS;
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
  return `${baseClass} ${resolvedClass} ${disabledClass}`;
}

function formatToolbarDateTimeDisplay(value) {
  if (!value) return '';
  const valueText = String(value);
  const dateOnlyMatch = DATE_ONLY_PATTERN.exec(valueText);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return `${day}.${month}.${year}`;
  }
  const match = DATE_TIME_PATTERN.exec(valueText);
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

function formatCountLabel(value, singular, plural) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return `0 ${plural}`;
  return `${numericValue} ${numericValue === 1 ? singular : plural}`;
}

function formatCollapsedDateRangeText(startValue, endValue) {
  const fromText = formatToolbarDateTimeDisplay(startValue) || 'No dates';
  const toText = formatToolbarDateTimeDisplay(endValue) || '';
  return toText ? `${fromText} - ${toText}` : fromText;
}

function getCandidateSummary({ metadataLoading, candidateCount }) {
  if (metadataLoading) {
    return {
      candidateLabel: '...',
      resetAriaCount: 'loading candidates',
    };
  }

  if (Number.isFinite(candidateCount)) {
    return {
      candidateLabel: String(candidateCount),
      resetAriaCount: `${candidateCount} candidates`,
    };
  }

  return {
    candidateLabel: '-',
    resetAriaCount: 'unknown candidates',
  };
}

function getToolbarMessages({ parseErrors, parseWarnings, metadataError }) {
  const topError = parseErrors[0]?.message || null;
  const topWarning = topError ? null : parseWarnings[0]?.message || null;
  const noticeMessage = topError || metadataError || topWarning || null;
  const noticeTone = topError ? 'error' : 'warning';

  return {
    topError,
    topWarning,
    noticeMessage,
    noticeTone,
  };
}

function getDateBasisOptionTitle(value) {
  if (value === 'shot') return 'Use shot timestamp only';
  if (value === 'auto') return 'Use shot timestamp, fallback to upload time';
  return 'Use upload time only';
}

function ToolbarBusyOverlay({ visible }) {
  if (!visible) return null;

  return (
    <div className='pointer-events-none absolute inset-0 z-30 flex items-center justify-center'>
      <span className='loading loading-spinner loading-md text-base-content/35' />
    </div>
  );
}

function CollapsedToolbarStrip({
  collapsedShotCountLabel,
  collapsedProfileCountLabel,
  collapsedDateRangeText,
  onExpand,
}) {
  return (
    <button
      type='button'
      onClick={onExpand}
      className='text-base-content/70 hover:bg-base-content/4 hover:text-base-content -mx-1.5 -my-1.5 flex h-6 min-h-0 w-[calc(100%+0.75rem)] cursor-pointer items-center rounded-lg bg-transparent px-2 text-[10px] font-semibold transition-colors duration-150 sm:-mx-2 sm:-my-2 sm:w-[calc(100%+1rem)]'
      aria-label='Expand statistics toolbar'
      title='Expand statistics toolbar'
    >
      <div className='flex h-6 w-full min-w-0 items-center gap-2 px-2'>
        <div className='flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-left'>
          <span className='shrink-0'>{collapsedShotCountLabel}</span>
          <span className='text-base-content/25 shrink-0' aria-hidden='true'>
            ·
          </span>
          <span className='shrink-0'>{collapsedProfileCountLabel}</span>
          <span className='text-base-content/25 shrink-0' aria-hidden='true'>
            ·
          </span>
          <span className='min-w-0 truncate'>{collapsedDateRangeText}</span>
        </div>
        <span className='text-base-content/55 inline-flex h-4 w-4 shrink-0 items-center justify-center text-[10px]'>
          <FontAwesomeIcon icon={faPlus} />
        </span>
      </div>
    </button>
  );
}

function ModeSelectionDropdown({
  mode,
  onModeChange,
  isBusy,
  modeTriggerClasses,
  currentModeOption,
  toolbarControlClass,
  busyDropdownClass,
}) {
  return (
    <details
      className={`dropdown max-w-full ${toolbarControlClass} ${busyDropdownClass}`.trim()}
      data-close-on-outside
    >
      <summary
        className={modeTriggerClasses}
        aria-label='Select statistics mode'
        title='Select statistics mode'
      >
        <span className='truncate'>{currentModeOption.label}</span>
        <FontAwesomeIcon icon={faChevronDown} className='-ml-0.5 text-[10px] opacity-70' />
      </summary>

      <div
        className={`${STATISTICS_DROPDOWN_PANEL_CLASSES} w-40 p-1.5`}
        style={STATISTICS_DROPDOWN_PANEL_SURFACE_STYLE}
      >
        <div className='grid gap-1'>
          {MODE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type='button'
              className={`flex h-9 min-h-0 items-center justify-between rounded-lg px-3 text-xs font-semibold transition-colors ${getMenuItemClasses({ tone: 'primary', isActive: mode === opt.value })}`}
              onClick={e => {
                onModeChange(opt.value);
                closeParentDetails(e.currentTarget);
              }}
              disabled={isBusy}
            >
              <span>{opt.label}</span>
              {mode === opt.value && <span className='text-[10px] opacity-70'>Active</span>}
            </button>
          ))}
        </div>
      </div>
    </details>
  );
}

function SelectionDropdowns({
  mode,
  profileSelectionItems,
  selectedProfileNames,
  onSelectedProfileNamesChange,
  onProfilePinToggle,
  shotSelectionItems,
  selectedShotKeys,
  onSelectedShotKeysChange,
  onShotPinToggle,
  isBusy,
  toolbarControlClass,
}) {
  const profileDropdown = (
    <StatisticsMultiSelectDropdown
      label='Profiles'
      items={profileSelectionItems}
      selectedIds={selectedProfileNames}
      onChange={onSelectedProfileNamesChange}
      onTogglePin={onProfilePinToggle}
      disabled={isBusy}
      accentTone='primary'
      emptyText='Select Profiles...'
      triggerClassName={STATISTICS_TOP_ROW_CONTROL_HEIGHT_CLASS}
      rootClassName={toolbarControlClass}
    />
  );
  const shotDropdown = (
    <StatisticsMultiSelectDropdown
      label='Shots'
      items={shotSelectionItems}
      selectedIds={selectedShotKeys}
      onChange={onSelectedShotKeysChange}
      onTogglePin={onShotPinToggle}
      disabled={isBusy}
      accentTone='primary'
      emptyText='Select Shots...'
      triggerClassName={STATISTICS_TOP_ROW_CONTROL_HEIGHT_CLASS}
      rootClassName={toolbarControlClass}
    />
  );

  if (mode === 'profile') {
    return (
      <>
        {profileDropdown}
        {shotDropdown}
      </>
    );
  }

  if (mode === 'shots') {
    return (
      <>
        {shotDropdown}
        {profileDropdown}
      </>
    );
  }

  return null;
}

function SourceSelectionDropdown({
  sourceTriggerClasses,
  currentShotSourceOption,
  currentProfileSourceOption,
  shotSource,
  onShotSourceChange,
  profileSource,
  onProfileSourceChange,
  isBusy,
  toolbarControlClass,
  busyDropdownClass,
}) {
  const sourceGroups = [
    {
      label: 'Shots',
      value: shotSource,
      onChange: onShotSourceChange,
    },
    {
      label: 'Profiles',
      value: profileSource,
      onChange: onProfileSourceChange,
    },
  ];

  return (
    <details
      className={`dropdown max-w-full ${toolbarControlClass} ${busyDropdownClass}`.trim()}
      data-close-on-outside
    >
      <summary
        className={sourceTriggerClasses}
        aria-label='Select shot and profile sources'
        title='Select shot and profile sources'
      >
        <span className='min-w-0 flex-1 truncate text-left'>
          {renderCombinedSourceSummary({
            shotOption: currentShotSourceOption,
            profileOption: currentProfileSourceOption,
          })}
        </span>
        <FontAwesomeIcon icon={faChevronDown} className='-ml-0.5 text-[10px] opacity-70' />
      </summary>

      <div
        className={`${STATISTICS_DROPDOWN_PANEL_CLASSES} w-[min(92vw,18rem)] p-2`}
        style={STATISTICS_DROPDOWN_PANEL_SURFACE_STYLE}
      >
        <div className='grid gap-2'>
          {sourceGroups.map(group => (
            <div key={group.label} className='grid gap-1.5'>
              <div className='text-base-content/55 px-1 text-xs font-medium'>{group.label}</div>
              <div className='grid grid-cols-3 gap-1'>
                {SOURCE_OPTIONS.map(opt => (
                  <button
                    key={`${group.label}-${opt.value}`}
                    type='button'
                    className={`flex h-9 min-h-0 items-center justify-center rounded-lg px-2 text-xs font-medium transition-colors ${getMenuItemClasses({ tone: 'neutral', isActive: group.value === opt.value })}`}
                    onClick={() => {
                      group.onChange(opt.value);
                    }}
                    disabled={isBusy}
                  >
                    {renderSourceOptionContent(opt)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

function DateRangeDropdown({
  dateTriggerClasses,
  hasDateFilter,
  showDateRangeLabelInTrigger,
  dateRangeDisplay,
  dateFromLocal,
  onDateFromChange,
  dateToLocal,
  onDateToChange,
  isBusy,
  compactNeutralButtonClasses,
  toolbarControlClass,
  busyDropdownClass,
}) {
  const dateModeText = dateRangeDisplay.isAuto
    ? 'Using auto range from current shot selection.'
    : 'Manual date filter is active.';

  return (
    <details
      className={`dropdown ${toolbarControlClass} ${busyDropdownClass}`.trim()}
      data-close-on-outside
    >
      <summary
        className={dateTriggerClasses}
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
              <span className='text-base-content/35 mx-1.5 inline-block align-middle'>
                <FontAwesomeIcon icon={faArrowRightLong} className='text-[9px]' />
              </span>
              {dateRangeDisplay.toText}
            </>
          )}
        </span>
        <FontAwesomeIcon icon={faChevronDown} className='-ml-0.5 shrink-0 text-[9px] opacity-50' />
      </summary>

      <div
        className={`${STATISTICS_DROPDOWN_PANEL_CLASSES} w-[min(92vw,26rem)] p-3`}
        style={STATISTICS_DROPDOWN_PANEL_SURFACE_STYLE}
      >
        <div className='grid gap-2'>
          <label className='text-base-content/75 flex items-center gap-2 text-[11px] font-semibold'>
            <span className='w-10 shrink-0'>From</span>
            <input
              type='date'
              value={dateFromLocal}
              onInput={e => onDateFromChange(e.target.value)}
              className='analyzer-statistics-datetime input input-bordered border-base-content/10 bg-base-100/50 h-9 min-h-0 w-full text-xs'
              disabled={isBusy}
              aria-label='Start date'
              title='Start date'
            />
          </label>

          <label className='text-base-content/75 flex items-center gap-2 text-[11px] font-semibold'>
            <span className='w-10 shrink-0'>To</span>
            <input
              type='date'
              value={dateToLocal}
              onInput={e => onDateToChange(e.target.value)}
              className='analyzer-statistics-datetime input input-bordered border-base-content/10 bg-base-100/50 h-9 min-h-0 w-full text-xs'
              disabled={isBusy}
              aria-label='End date'
              title='End date'
            />
          </label>
        </div>

        <div className='mt-3 flex items-center justify-between gap-2'>
          <div className='text-base-content/55 text-[10px]'>{dateModeText}</div>
          <button
            type='button'
            onClick={() => {
              onDateFromChange('');
              onDateToChange('');
            }}
            disabled={isBusy || (!dateFromLocal && !dateToLocal)}
            className={compactNeutralButtonClasses}
            title='Clear date filter'
          >
            Clear Date Filter
          </button>
        </div>
      </div>
    </details>
  );
}

function AdvancedSearchControls({
  showAdvancedSearch,
  setShowAdvancedSearch,
  setShowDslSelectionPreview,
  dslInputRef,
  query,
  onQueryChange,
  isBusy,
  compactNeutralButtonClasses,
  activeCompactNeutralButtonClasses,
  toolbarControlClass,
}) {
  const searchLayoutClass = showAdvancedSearch
    ? 'basis-full flex-wrap md:ml-auto md:flex-1 md:basis-auto md:flex-nowrap'
    : 'ml-auto';

  return (
    <div
      className={`flex min-w-0 items-center justify-end gap-2 ${searchLayoutClass} ${toolbarControlClass}`.trim()}
    >
      {showAdvancedSearch && (
        <div
          ref={dslInputRef}
          className={`min-w-0 basis-full md:max-w-[38rem] md:min-w-[16rem] md:flex-1 ${toolbarControlClass}`.trim()}
        >
          <input
            type='text'
            value={query}
            onInput={e => {
              setShowDslSelectionPreview(!!String(e.target.value || '').trim());
              onQueryChange(e.target.value);
            }}
            onFocus={() => setShowDslSelectionPreview(true)}
            onClick={() => setShowDslSelectionPreview(true)}
            placeholder='name:"325"; profile:3_0_25; date:>h-7d;'
            className='input input-bordered border-base-content/10 bg-base-100/50 h-9 min-h-0 w-full text-xs'
            disabled={isBusy}
          />
        </div>
      )}

      {showAdvancedSearch && (
        <div className={toolbarControlClass}>
          <StatisticsSearchHelp />
        </div>
      )}

      <label
        title='Toggle advanced search'
        className={`${showAdvancedSearch ? activeCompactNeutralButtonClasses : compactNeutralButtonClasses} gap-2 ${isBusy ? 'pointer-events-none opacity-40' : ''} ${toolbarControlClass}`.trim()}
      >
        <input
          type='checkbox'
          checked={showAdvancedSearch}
          disabled={isBusy}
          aria-label='Toggle advanced search'
          className='toggle toggle-primary toggle-xs'
          onChange={event => {
            const next = event.currentTarget.checked;
            setShowAdvancedSearch(next);
            if (!next) setShowDslSelectionPreview(false);
          }}
        />
        <span>Advanced</span>
      </label>
    </div>
  );
}

function ExpandedToolbarControls({
  useBlankCollapseLayer,
  toolbarPassiveLayerClass,
  toolbarControlClass,
  busyDropdownClass,
  setIsCollapsedStripExpanded,
  mode,
  onModeChange,
  isBusy,
  modeTriggerClasses,
  currentModeOption,
  profileSelectionItems,
  selectedProfileNames,
  onSelectedProfileNamesChange,
  onProfilePinToggle,
  shotSelectionItems,
  selectedShotKeys,
  onSelectedShotKeysChange,
  onShotPinToggle,
  onClearFilters,
  resetButtonClasses,
  resetAriaCount,
  candidateLabel,
  onGo,
  canExecute,
  runButtonClasses,
  setShowDslSelectionPreview,
  sourceTriggerClasses,
  currentShotSourceOption,
  currentProfileSourceOption,
  shotSource,
  onShotSourceChange,
  profileSource,
  onProfileSourceChange,
  dateTriggerClasses,
  hasDateFilter,
  showDateRangeLabelInTrigger,
  dateRangeDisplay,
  dateFromLocal,
  onDateFromChange,
  dateToLocal,
  onDateToChange,
  compactNeutralButtonClasses,
  showAdvancedSearch,
  setShowAdvancedSearch,
  dslInputRef,
  query,
  onQueryChange,
  activeCompactNeutralButtonClasses,
}) {
  return (
    <div className={`relative z-10 flex flex-col gap-1.5 ${toolbarPassiveLayerClass}`}>
      {useBlankCollapseLayer ? (
        <button
          type='button'
          className='pointer-events-auto absolute inset-0 z-0 rounded-xl bg-transparent'
          onClick={() => setIsCollapsedStripExpanded(false)}
          tabIndex={-1}
          aria-label='Collapse statistics toolbar'
          title='Collapse statistics toolbar'
        />
      ) : null}

      <div
        className={`relative z-20 flex w-full min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 ${toolbarPassiveLayerClass}`.trim()}
      >
        <ModeSelectionDropdown
          mode={mode}
          onModeChange={onModeChange}
          isBusy={isBusy}
          modeTriggerClasses={modeTriggerClasses}
          currentModeOption={currentModeOption}
          toolbarControlClass={toolbarControlClass}
          busyDropdownClass={busyDropdownClass}
        />

        <SelectionDropdowns
          mode={mode}
          profileSelectionItems={profileSelectionItems}
          selectedProfileNames={selectedProfileNames}
          onSelectedProfileNamesChange={onSelectedProfileNamesChange}
          onProfilePinToggle={onProfilePinToggle}
          shotSelectionItems={shotSelectionItems}
          selectedShotKeys={selectedShotKeys}
          onSelectedShotKeysChange={onSelectedShotKeysChange}
          onShotPinToggle={onShotPinToggle}
          isBusy={isBusy}
          toolbarControlClass={toolbarControlClass}
        />

        <div className={`ml-auto flex items-center gap-2 ${toolbarControlClass}`.trim()}>
          <button
            type='button'
            onClick={onClearFilters}
            className={`${resetButtonClasses} ${toolbarControlClass}`.trim()}
            disabled={isBusy}
            aria-label={`Clear filters and selections (${resetAriaCount})`}
            title={`Clear filters and selections (${resetAriaCount})`}
          >
            <FontAwesomeIcon icon={faUndo} className='text-lg leading-none' />
            <span className='text-[10px] leading-none font-semibold tabular-nums'>
              {candidateLabel}
            </span>
          </button>

          <button
            type='button'
            onClick={() => {
              setShowDslSelectionPreview(false);
              onGo();
            }}
            disabled={!canExecute}
            className={`${runButtonClasses} ${toolbarControlClass}`.trim()}
            aria-label='Play statistics'
            title='Play statistics'
          >
            <FontAwesomeIcon icon={faPlay} className='text-[1.35rem]' />
          </button>
        </div>
      </div>

      <div
        className={`relative z-10 flex w-full min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 pt-0.5 ${toolbarPassiveLayerClass}`.trim()}
      >
        <SourceSelectionDropdown
          sourceTriggerClasses={sourceTriggerClasses}
          currentShotSourceOption={currentShotSourceOption}
          currentProfileSourceOption={currentProfileSourceOption}
          shotSource={shotSource}
          onShotSourceChange={onShotSourceChange}
          profileSource={profileSource}
          onProfileSourceChange={onProfileSourceChange}
          isBusy={isBusy}
          toolbarControlClass={toolbarControlClass}
          busyDropdownClass={busyDropdownClass}
        />

        <DateRangeDropdown
          dateTriggerClasses={dateTriggerClasses}
          hasDateFilter={hasDateFilter}
          showDateRangeLabelInTrigger={showDateRangeLabelInTrigger}
          dateRangeDisplay={dateRangeDisplay}
          dateFromLocal={dateFromLocal}
          onDateFromChange={onDateFromChange}
          dateToLocal={dateToLocal}
          onDateToChange={onDateToChange}
          isBusy={isBusy}
          compactNeutralButtonClasses={compactNeutralButtonClasses}
          toolbarControlClass={toolbarControlClass}
          busyDropdownClass={busyDropdownClass}
        />

        <AdvancedSearchControls
          showAdvancedSearch={showAdvancedSearch}
          setShowAdvancedSearch={setShowAdvancedSearch}
          setShowDslSelectionPreview={setShowDslSelectionPreview}
          dslInputRef={dslInputRef}
          query={query}
          onQueryChange={onQueryChange}
          isBusy={isBusy}
          compactNeutralButtonClasses={compactNeutralButtonClasses}
          activeCompactNeutralButtonClasses={activeCompactNeutralButtonClasses}
          toolbarControlClass={toolbarControlClass}
        />
      </div>
    </div>
  );
}

function DateBasisWarning({
  visible,
  dateBasisWarningMessage,
  dateBasisMode,
  onDateBasisModeChange,
  isBusy,
  toolbarPassiveLayerClass,
  toolbarControlClass,
}) {
  if (!visible) return null;

  return (
    <div
      className={`flex w-full min-w-0 flex-wrap items-center gap-2 rounded-lg border px-2 py-2 ${toolbarPassiveLayerClass}`.trim()}
      style={{
        borderColor: 'color-mix(in srgb, var(--analyzer-warning-orange) 28%, transparent)',
        background: 'color-mix(in srgb, var(--analyzer-warning-orange) 9%, transparent)',
      }}
    >
      <div
        className='min-w-[14rem] flex-1 text-[11px] leading-relaxed'
        style={WARNING_ORANGE_TEXT_MUTED_STYLE}
      >
        <span className='font-semibold' style={WARNING_ORANGE_TEXT_STYLE}>
          Date Basis:
        </span>{' '}
        <span className='text-base-content/80'>
          {dateBasisWarningMessage ||
            'Some shots have no shot timestamp. Choose how date handling should treat them.'}
        </span>
      </div>
      <div className={`${SEGMENT_GROUP_CLASS} ${toolbarControlClass}`.trim()}>
        {DATE_BASIS_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type='button'
            className={getSegmentButtonClasses({
              isActive: dateBasisMode === opt.value,
              activeTone: opt.value === 'auto' ? 'secondary' : 'neutral',
              compact: true,
            })}
            onClick={() => onDateBasisModeChange(opt.value)}
            disabled={isBusy}
            title={getDateBasisOptionTitle(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ToolbarNotice({
  visible,
  noticeMessage,
  noticeTone,
  parseErrors,
  parseWarnings,
  topError,
  toolbarPassiveLayerClass,
}) {
  if (!visible || !noticeMessage) return null;

  const messageClass = noticeTone === 'error' ? 'text-error font-semibold' : 'font-semibold';
  const messageStyle = noticeTone === 'error' ? undefined : WARNING_ORANGE_TEXT_STYLE;

  return (
    <div
      className={`flex min-h-5 items-center gap-2 px-1 text-[11px] ${toolbarPassiveLayerClass}`.trim()}
    >
      <span className={messageClass} style={messageStyle}>
        {noticeMessage}
      </span>
      {parseErrors.length > 1 && (
        <span className='text-error/70'>+{parseErrors.length - 1} more</span>
      )}
      {topError ? null : (
        <>
          {parseWarnings.length > 1 && (
            <span style={WARNING_ORANGE_TEXT_MUTED_STYLE}>+{parseWarnings.length - 1} more</span>
          )}
        </>
      )}
    </div>
  );
}

function SelectionHint({ visible, selectionHint, toolbarPassiveLayerClass }) {
  if (!visible || !selectionHint) return null;

  return (
    <div
      className={`px-1 text-[11px] font-semibold ${toolbarPassiveLayerClass}`.trim()}
      style={{ color: 'var(--analyzer-warning-orange)' }}
    >
      {selectionHint}
    </div>
  );
}

function DslSelectionPreview({
  visible,
  profilePreviewItems,
  shotPreviewItems,
  toolbarPassiveLayerClass,
}) {
  if (!visible) return null;

  return (
    <div
      className={`bg-base-100/55 border-base-content/10 flex w-full min-w-0 flex-col gap-3 rounded-lg border p-3 shadow-sm ${toolbarPassiveLayerClass}`.trim()}
    >
      {profilePreviewItems.length > 0 && (
        <div className='min-w-0 space-y-2'>
          <div className='text-secondary text-xs font-medium'>
            Profiles ({profilePreviewItems.length})
          </div>
          <div className='max-h-24 overflow-auto'>
            <div className='flex flex-wrap gap-1.5'>
              {profilePreviewItems.map(item => (
                <span
                  key={item.id}
                  className='border-secondary/20 bg-secondary/12 text-secondary inline-flex min-h-6 items-center rounded-md border px-2 py-1 text-[11px] font-semibold'
                >
                  {item.primary}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {shotPreviewItems.length > 0 && (
        <div className='min-w-0 space-y-2'>
          <div className='text-primary text-xs font-medium'>Shots ({shotPreviewItems.length})</div>
          <div className='border-base-content/8 bg-base-100/40 max-h-40 overflow-auto rounded-md border'>
            <div className='divide-base-content/8 divide-y'>
              {shotPreviewItems.map(item => (
                <div key={item.id} className='flex min-w-0 flex-col gap-0.5 px-2.5 py-2'>
                  <div className='text-base-content/85 truncate text-[11px] font-semibold'>
                    {item.fileStem || item.primary}
                  </div>
                  {(item.shotId || item.secondary) && (
                    <div className='text-base-content/55 truncate text-[10px]'>
                      {item.shotId ? `ID: ${item.shotId}` : ''}
                      {item.shotId && item.secondary ? ' • ' : ''}
                      {item.secondary || ''}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function closeOpenToolbarDetails(toolbarNode) {
  toolbarNode.querySelectorAll('details[open]').forEach(detailsNode => {
    detailsNode.open = false;
  });
}

function isToolbarFloatingPanelTarget(target) {
  return target instanceof Element && target.closest('[data-statistics-toolbar-floating-panel]');
}

function useAdvancedSearchSync({
  query,
  parseErrorsLength,
  parseWarningsLength,
  showAdvancedSearch,
  setShowAdvancedSearch,
  setShowDslSelectionPreview,
}) {
  useEffect(() => {
    if (query || parseErrorsLength > 0 || parseWarningsLength > 0) {
      setShowAdvancedSearch(true);
    }
  }, [query, parseErrorsLength, parseWarningsLength, setShowAdvancedSearch]);

  useEffect(() => {
    if (!showAdvancedSearch) {
      setShowDslSelectionPreview(false);
    }
  }, [showAdvancedSearch, setShowDslSelectionPreview]);

  useEffect(() => {
    if (!String(query || '').trim()) {
      setShowDslSelectionPreview(false);
    }
  }, [query, setShowDslSelectionPreview]);
}

function useDslPreviewOutsideDismiss({
  shouldShowDslSelectionPreview,
  isToolbarExpanded,
  dslInputRef,
  setShowDslSelectionPreview,
}) {
  useEffect(() => {
    if (!shouldShowDslSelectionPreview || !isToolbarExpanded) return;

    const handlePointerDown = event => {
      const inputNode = dslInputRef.current;
      if (!inputNode) return;
      if (inputNode.contains(event.target)) return;
      setShowDslSelectionPreview(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [shouldShowDslSelectionPreview, isToolbarExpanded, dslInputRef, setShowDslSelectionPreview]);
}

function useToolbarCollapseBehavior({
  isToolbarExpanded,
  isBusy,
  shouldCollapseToolbar,
  isCollapsedStripExpanded,
  toolbarContainerRef,
  setShowDslSelectionPreview,
  setIsCollapsedStripExpanded,
}) {
  useEffect(() => {
    if (isToolbarExpanded) return;

    setShowDslSelectionPreview(false);
    const toolbarNode = toolbarContainerRef.current;
    if (!toolbarNode) return;
    // Collapse should reset transient UI state so reopened toolbars never show
    // stale dropdowns from the previous expanded session.
    closeOpenToolbarDetails(toolbarNode);
  }, [isToolbarExpanded, setShowDslSelectionPreview, toolbarContainerRef]);

  useEffect(() => {
    if (!isBusy) return;

    const toolbarNode = toolbarContainerRef.current;
    if (!toolbarNode) return;

    closeOpenToolbarDetails(toolbarNode);
  }, [isBusy, toolbarContainerRef]);

  useEffect(() => {
    if (!shouldCollapseToolbar) {
      setIsCollapsedStripExpanded(false);
    }
  }, [shouldCollapseToolbar, setIsCollapsedStripExpanded]);

  useEffect(() => {
    if (!shouldCollapseToolbar || !isCollapsedStripExpanded) return;

    const handlePointerDown = event => {
      const toolbarNode = toolbarContainerRef.current;
      if (!toolbarNode) return;
      if (toolbarNode.contains(event.target)) return;
      if (isToolbarFloatingPanelTarget(event.target)) return;
      setIsCollapsedStripExpanded(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [
    shouldCollapseToolbar,
    isCollapsedStripExpanded,
    toolbarContainerRef,
    setIsCollapsedStripExpanded,
  ]);

  useEffect(() => {
    if (!shouldCollapseToolbar || !isCollapsedStripExpanded) return;

    const handleKeyDown = event => {
      if (event.key !== 'Escape') return;

      const toolbarNode = toolbarContainerRef.current;
      if (!toolbarNode) return;

      const eventTarget = event.target instanceof Element ? event.target : null;
      const activeElement = globalThis.document?.activeElement;
      const isToolbarFocused =
        (eventTarget && toolbarNode.contains(eventTarget)) ||
        isToolbarFloatingPanelTarget(eventTarget) ||
        (activeElement instanceof Element && toolbarNode.contains(activeElement)) ||
        isToolbarFloatingPanelTarget(activeElement);

      if (!isToolbarFocused) return;

      event.preventDefault();
      setIsCollapsedStripExpanded(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    shouldCollapseToolbar,
    isCollapsedStripExpanded,
    toolbarContainerRef,
    setIsCollapsedStripExpanded,
  ]);
}

function useToolbarDropdownBehavior({ toolbarContainerRef, isToolbarExpanded }) {
  useEffect(() => {
    const toolbarNode = toolbarContainerRef.current;
    if (!toolbarNode) return;

    const handleClick = event => {
      if (event.target.closest('[data-statistics-multiselect-trigger]')) {
        closeOpenToolbarDetails(toolbarNode);
        return;
      }

      const summary = event.target.closest('summary');
      if (!summary) return;
      const details = summary.parentElement;
      if (details?.tagName !== 'DETAILS') return;
      if (details.open) return;

      toolbarNode.querySelectorAll('details[open]').forEach(detailsNode => {
        if (detailsNode !== details) {
          detailsNode.open = false;
        }
      });
    };

    toolbarNode.addEventListener('click', handleClick);
    return () => {
      toolbarNode.removeEventListener('click', handleClick);
    };
  }, [toolbarContainerRef]);

  useEffect(() => {
    if (!isToolbarExpanded) return;

    const handlePointerDown = event => {
      const toolbarNode = toolbarContainerRef.current;
      if (!toolbarNode) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      toolbarNode.querySelectorAll('details[data-close-on-outside][open]').forEach(detailsNode => {
        if (detailsNode.contains(target)) return;
        detailsNode.open = false;
      });
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isToolbarExpanded, toolbarContainerRef]);
}

export function StatisticsToolbar({
  shotSource,
  onShotSourceChange,
  profileSource,
  onProfileSourceChange,
  mode,
  onModeChange,
  onGo,
  startLoading = false,
  loading = false,
  metadataLoading = false,
  canGo = true,
  profileSelectionItems,
  selectedProfileNames,
  onSelectedProfileNamesChange,
  onProfilePinToggle,
  shotSelectionItems,
  selectedShotKeys,
  onSelectedShotKeysChange,
  onShotPinToggle,
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
  hasBuiltStatistics = false,
  builtShotCount = 0,
  builtProfileCount = 0,
  builtDateRangeStartMs = null,
  builtDateRangeEndMs = null,
}) {
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(() => !!query);
  const [showDslSelectionPreview, setShowDslSelectionPreview] = useState(
    () => !!String(query || '').trim(),
  );
  const dslInputRef = useRef(null);
  const toolbarContainerRef = useRef(null);
  const [isCollapsedStripExpanded, setIsCollapsedStripExpanded] = useState(false);
  // Keep the toolbar locked while metadata or a statistics run is active, but
  // reserve the centered spinner for short startup phases only.
  const isBusy = startLoading || loading || metadataLoading;
  const showBusyOverlay = startLoading || metadataLoading;
  const canExecute = canGo && !isBusy;
  const { topError, noticeMessage, noticeTone } = getToolbarMessages({
    parseErrors,
    parseWarnings,
    metadataError,
  });
  const hasDateFilter = Boolean(dateFromLocal || dateToLocal);
  const dateRangeDisplay = getDateRangeDisplay({
    dateFromLocal,
    dateToLocal,
    dateFromPreviewLocal,
    dateToPreviewLocal,
  });
  const showDateRangeLabelInTrigger = !dateRangeDisplay.isAuto;
  const { candidateLabel, resetAriaCount } = getCandidateSummary({
    metadataLoading,
    candidateCount,
  });
  const currentShotSourceOption =
    SOURCE_OPTIONS.find(opt => opt.value === shotSource) || SOURCE_OPTIONS[0];
  const currentProfileSourceOption =
    SOURCE_OPTIONS.find(opt => opt.value === profileSource) || SOURCE_OPTIONS[0];
  const currentModeOption = MODE_OPTIONS.find(opt => opt.value === mode) || MODE_OPTIONS[0];
  const hasDslQuery = !!String(query || '').trim();
  const shotSelectionItemMap = new Map((shotSelectionItems || []).map(item => [item.id, item]));
  const selectedShotPreviewItems = (selectedShotKeys || [])
    .map(id => shotSelectionItemMap.get(id))
    .filter(Boolean);
  const selectedProfilePreviewItems = (selectedProfileNames || [])
    .filter(Boolean)
    .map(name => ({ id: name, primary: name }));
  const profilePreviewItems =
    selectedProfilePreviewItems.length > 0
      ? selectedProfilePreviewItems
      : (profileSelectionItems || []).map(item => ({
          id: item.id,
          primary: item.primary || item.id,
        }));
  const shotPreviewItems =
    selectedShotPreviewItems.length > 0 ? selectedShotPreviewItems : shotSelectionItems || [];
  const shouldShowDslSelectionPreview =
    showAdvancedSearch &&
    hasDslQuery &&
    showDslSelectionPreview &&
    (profilePreviewItems.length > 0 || shotPreviewItems.length > 0);
  const shouldCollapseToolbar = Boolean(hasBuiltStatistics);
  // After a run is built, the toolbar collapses into a compact summary strip
  // and only expands again when the user explicitly reopens it.
  const isToolbarExpanded = !shouldCollapseToolbar || isCollapsedStripExpanded;
  const shouldShowSelectionHint = topError || metadataError ? false : isToolbarExpanded;
  const useBlankCollapseLayer = shouldCollapseToolbar && isToolbarExpanded;
  const toolbarPassiveLayerClass = useBlankCollapseLayer ? 'pointer-events-none' : '';
  const toolbarControlClass = useBlankCollapseLayer ? 'pointer-events-auto' : '';
  const busyDropdownClass = isBusy ? 'pointer-events-none opacity-40' : '';
  const collapsedShotCountLabel = formatCountLabel(builtShotCount, 'shot', 'shots');
  const collapsedProfileCountLabel = formatCountLabel(builtProfileCount, 'profile', 'profiles');
  const collapsedDateRangeText = formatCollapsedDateRangeText(
    builtDateRangeStartMs,
    builtDateRangeEndMs,
  );
  const sourceTriggerClasses = getAnalyzerSurfaceTriggerClasses({
    className: `flex h-9 min-h-0 w-[15rem] max-w-full list-none items-center justify-between gap-2 rounded-lg bg-transparent px-2 text-xs font-bold [&::-webkit-details-marker]:hidden ${getNeutralDropdownToneClasses()} ${isBusy ? 'pointer-events-none opacity-40' : ''}`,
  });
  const modeTriggerClasses = getAnalyzerSurfaceTriggerClasses({
    className: `${STATISTICS_TOP_ROW_CONTROL_HEIGHT_CLASS} w-[7rem] list-none justify-between rounded-lg px-2 text-sm font-semibold [&::-webkit-details-marker]:hidden ${getPrimaryDropdownToneClasses()} ${isBusy ? 'pointer-events-none opacity-40' : ''}`,
  });
  const resetButtonClasses = getAnalyzerSurfaceTriggerClasses({
    className: `inline-flex ${STATISTICS_TOP_ROW_CONTROL_HEIGHT_CLASS} w-12 flex-col items-center justify-center gap-0.5 rounded-lg bg-base-content/4 px-0 text-base-content/70 hover:bg-base-content/7 hover:text-base-content disabled:cursor-not-allowed disabled:opacity-40`,
  });
  const runButtonClasses = getAnalyzerSurfaceTriggerClasses({
    className: `inline-flex ${STATISTICS_TOP_ROW_CONTROL_HEIGHT_CLASS} w-[6rem] items-center justify-center rounded-lg px-0 ${STATISTICS_RUN_BUTTON_TONE_CLASS} disabled:cursor-not-allowed disabled:opacity-40`,
  });
  const compactNeutralButtonClasses = getAnalyzerTextButtonClasses({
    className:
      'h-9 min-h-0 rounded-lg bg-transparent px-2 text-xs font-semibold text-base-content/65 hover:text-base-content disabled:cursor-not-allowed disabled:opacity-40',
  });
  const activeCompactNeutralButtonClasses = getAnalyzerTextButtonClasses({
    className:
      'h-9 min-h-0 rounded-lg bg-transparent px-2 text-xs font-semibold text-base-content hover:text-base-content disabled:cursor-not-allowed disabled:opacity-40',
  });
  const dateTriggerClasses = getAnalyzerSurfaceTriggerClasses({
    className: `flex h-9 min-h-0 w-[11.25rem] list-none items-center gap-1.5 rounded-lg bg-transparent px-2 text-left text-xs sm:w-[12.5rem] md:w-[15rem] [&::-webkit-details-marker]:hidden ${
      hasDateFilter ? 'text-base-content' : 'text-base-content/70 hover:text-base-content'
    } ${busyDropdownClass}`,
  });

  useAdvancedSearchSync({
    query,
    parseErrorsLength: parseErrors.length,
    parseWarningsLength: parseWarnings.length,
    showAdvancedSearch,
    setShowAdvancedSearch,
    setShowDslSelectionPreview,
  });
  useDslPreviewOutsideDismiss({
    shouldShowDslSelectionPreview,
    isToolbarExpanded,
    dslInputRef,
    setShowDslSelectionPreview,
  });
  useToolbarCollapseBehavior({
    isToolbarExpanded,
    isBusy,
    shouldCollapseToolbar,
    isCollapsedStripExpanded,
    toolbarContainerRef,
    setShowDslSelectionPreview,
    setIsCollapsedStripExpanded,
  });
  useToolbarDropdownBehavior({ toolbarContainerRef, isToolbarExpanded });

  return (
    <div
      ref={toolbarContainerRef}
      className='relative isolate z-[90] flex w-full min-w-0 flex-col gap-1.5 overflow-visible'
    >
      <ToolbarBusyOverlay visible={showBusyOverlay} />
      {shouldCollapseToolbar && !isToolbarExpanded ? (
        <CollapsedToolbarStrip
          collapsedShotCountLabel={collapsedShotCountLabel}
          collapsedProfileCountLabel={collapsedProfileCountLabel}
          collapsedDateRangeText={collapsedDateRangeText}
          onExpand={() => setIsCollapsedStripExpanded(true)}
        />
      ) : (
        <ExpandedToolbarControls
          useBlankCollapseLayer={useBlankCollapseLayer}
          toolbarPassiveLayerClass={toolbarPassiveLayerClass}
          toolbarControlClass={toolbarControlClass}
          busyDropdownClass={busyDropdownClass}
          setIsCollapsedStripExpanded={setIsCollapsedStripExpanded}
          mode={mode}
          onModeChange={onModeChange}
          isBusy={isBusy}
          modeTriggerClasses={modeTriggerClasses}
          currentModeOption={currentModeOption}
          profileSelectionItems={profileSelectionItems}
          selectedProfileNames={selectedProfileNames}
          onSelectedProfileNamesChange={onSelectedProfileNamesChange}
          onProfilePinToggle={onProfilePinToggle}
          shotSelectionItems={shotSelectionItems}
          selectedShotKeys={selectedShotKeys}
          onSelectedShotKeysChange={onSelectedShotKeysChange}
          onShotPinToggle={onShotPinToggle}
          onClearFilters={onClearFilters}
          resetButtonClasses={resetButtonClasses}
          resetAriaCount={resetAriaCount}
          candidateLabel={candidateLabel}
          onGo={onGo}
          canExecute={canExecute}
          runButtonClasses={runButtonClasses}
          setShowDslSelectionPreview={setShowDslSelectionPreview}
          sourceTriggerClasses={sourceTriggerClasses}
          currentShotSourceOption={currentShotSourceOption}
          currentProfileSourceOption={currentProfileSourceOption}
          shotSource={shotSource}
          onShotSourceChange={onShotSourceChange}
          profileSource={profileSource}
          onProfileSourceChange={onProfileSourceChange}
          dateTriggerClasses={dateTriggerClasses}
          hasDateFilter={hasDateFilter}
          showDateRangeLabelInTrigger={showDateRangeLabelInTrigger}
          dateRangeDisplay={dateRangeDisplay}
          dateFromLocal={dateFromLocal}
          onDateFromChange={onDateFromChange}
          dateToLocal={dateToLocal}
          onDateToChange={onDateToChange}
          compactNeutralButtonClasses={compactNeutralButtonClasses}
          showAdvancedSearch={showAdvancedSearch}
          setShowAdvancedSearch={setShowAdvancedSearch}
          dslInputRef={dslInputRef}
          query={query}
          onQueryChange={onQueryChange}
          activeCompactNeutralButtonClasses={activeCompactNeutralButtonClasses}
        />
      )}

      <DateBasisWarning
        visible={isToolbarExpanded && showDateBasisWarning}
        dateBasisWarningMessage={dateBasisWarningMessage}
        dateBasisMode={dateBasisMode}
        onDateBasisModeChange={onDateBasisModeChange}
        isBusy={isBusy}
        toolbarPassiveLayerClass={toolbarPassiveLayerClass}
        toolbarControlClass={toolbarControlClass}
      />

      <ToolbarNotice
        visible={isToolbarExpanded}
        noticeMessage={noticeMessage}
        noticeTone={noticeTone}
        parseErrors={parseErrors}
        parseWarnings={parseWarnings}
        topError={topError}
        toolbarPassiveLayerClass={toolbarPassiveLayerClass}
      />

      <SelectionHint
        visible={shouldShowSelectionHint}
        selectionHint={selectionHint}
        toolbarPassiveLayerClass={toolbarPassiveLayerClass}
      />

      <DslSelectionPreview
        visible={isToolbarExpanded && shouldShowDslSelectionPreview}
        profilePreviewItems={profilePreviewItems}
        shotPreviewItems={shotPreviewItems}
        toolbarPassiveLayerClass={toolbarPassiveLayerClass}
      />
    </div>
  );
}
