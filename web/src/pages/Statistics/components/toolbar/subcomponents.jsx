import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRightLong } from '@fortawesome/free-solid-svg-icons/faArrowRightLong';
import { faCalendarDays } from '@fortawesome/free-solid-svg-icons/faCalendarDays';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons/faChevronDown';
import { faPlay } from '@fortawesome/free-solid-svg-icons/faPlay';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { faUndo } from '@fortawesome/free-solid-svg-icons/faUndo';
// Render-only sub-components for StatisticsToolbar: dropdown trigger buttons, profile/shot menu items, and search help trigger
import { SourceMarker } from '../../../ShotAnalyzer/components/SourceMarker';
import { StatisticsSearchHelp } from '../StatisticsSearchHelp';
import { StatisticsMultiSelectDropdown } from '../StatisticsMultiSelectDropdown';
import {
  STATISTICS_DROPDOWN_PANEL_SURFACE_CLASS,
  STATISTICS_DROPDOWN_PANEL_SURFACE_STYLE,
} from '../statisticsDropdownSurface';
import {
  SOURCE_OPTIONS,
  MODE_OPTIONS,
  DATE_BASIS_OPTIONS,
  STATISTICS_TOP_ROW_CONTROL_HEIGHT_CLASS,
  SEGMENT_GROUP_CLASS,
  WARNING_ORANGE_TEXT_STYLE,
  WARNING_ORANGE_TEXT_MUTED_STYLE,
} from './constants';
import { getMenuItemClasses, getSegmentButtonClasses, getDateBasisOptionTitle } from './helpers';

const STATISTICS_DROPDOWN_PANEL_CLASSES = `dropdown-content mt-2 ${STATISTICS_DROPDOWN_PANEL_SURFACE_CLASS}`;

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

export function ToolbarBusyOverlay({ visible }) {
  if (!visible) return null;

  return (
    <div className='pointer-events-none absolute inset-0 z-30 flex items-center justify-center'>
      <span className='loading loading-spinner loading-md text-base-content/35' />
    </div>
  );
}

export function CollapsedToolbarStrip({
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

export function ModeSelectionDropdown({
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

function closeParentDetails(target) {
  const details = target.closest('details');
  if (details) details.open = false;
}

export function SelectionDropdowns({
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

export function SourceSelectionDropdown({
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

export function DateRangeDropdown({
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

export function AdvancedSearchControls({
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

export function ExpandedToolbarControls({
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

export function DateBasisWarning({
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

export function ToolbarNotice({
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

export function SelectionHint({ visible, selectionHint, toolbarPassiveLayerClass }) {
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

export function DslSelectionPreview({
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
