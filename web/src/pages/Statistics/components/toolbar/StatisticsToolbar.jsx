// Main StatisticsToolbar component: orchestrates source/mode/date controls, profile/shot selectors, run button, and search help
import { useState, useRef } from 'preact/hooks';
import {
  getAnalyzerSurfaceTriggerClasses,
  getAnalyzerTextButtonClasses,
} from '../../../ShotAnalyzer/components/analyzerControlStyles';
import '../StatisticsToolbar.css';
import {
  SOURCE_OPTIONS,
  MODE_OPTIONS,
  STATISTICS_TOP_ROW_CONTROL_HEIGHT_CLASS,
  STATISTICS_RUN_BUTTON_TONE_CLASS,
} from './constants';
import {
  formatCountLabel,
  formatCollapsedDateRangeText,
  getDateRangeDisplay,
  getCandidateSummary,
  getToolbarMessages,
  getNeutralDropdownToneClasses,
  getPrimaryDropdownToneClasses,
} from './helpers';
import {
  useAdvancedSearchSync,
  useDslPreviewOutsideDismiss,
  useToolbarCollapseBehavior,
  useToolbarDropdownBehavior,
} from './hooks';
import {
  ToolbarBusyOverlay,
  CollapsedToolbarStrip,
  ExpandedToolbarControls,
  DateBasisWarning,
  ToolbarNotice,
  SelectionHint,
  DslSelectionPreview,
} from './subcomponents';

export { STATISTICS_RUN_BUTTON_TONE_CLASS };

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
