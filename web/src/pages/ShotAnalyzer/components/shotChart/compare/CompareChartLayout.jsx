import { createPortal } from 'preact/compat';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMinus } from '@fortawesome/free-solid-svg-icons/faMinus';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import {
  SHOT_CHART_PRIMARY_LEGEND_LABELS,
  SHOT_CHART_SERIES_LEGEND_LABELS,
  ShotChartControls,
  ShotChartLegendToggles,
} from '../ShotChartControls';
import { COMPARE_DETAIL_METRIC_PAGE_KEYS } from '../constants';
import { CompareChartCanvas } from './CompareChartCanvas';
import {
  CompareChartTitle,
  CompareMobileLegend,
  StatisticsChartMetricSummary,
  getDetailEmptyStaticTooltipContent,
} from './CompareMetricContent';

export function CompareMobileLegendSection({
  hiddenLegendLabels,
  isExpanded,
  isVisible,
  hasWeightData,
  hasWeightFlowData,
  legendColorByLabel,
  onLegendToggle,
  onToggleExpanded,
  visibility,
}) {
  if (!isVisible) return null;

  return (
    <CompareMobileLegend
      hiddenLegendLabels={hiddenLegendLabels}
      isExpanded={isExpanded}
      hasWeightData={hasWeightData}
      hasWeightFlowData={hasWeightFlowData}
      legendColorByLabel={legendColorByLabel}
      onLegendToggle={onLegendToggle}
      onToggleExpanded={onToggleExpanded}
      visibility={visibility}
    />
  );
}

export function CompareControls({
  compareAlignmentMode,
  compareAlignmentOptions,
  compareAnnotationsEnabled,
  compareShotLegendItems,
  compareTargetDisplayMode,
  exportMenuRef,
  hasWeightData,
  hasWeightFlowData,
  hiddenLegendLabels,
  hideCompareControlsRowOnMobile,
  isAnalyzerMobileCompareLayout,
  isFullDisplay,
  legendColorByLabel,
  onCompareAlignmentModeChange,
  onCompareSwap,
  onCompareTargetDisplayModeChange,
  onFullDisplayToggle,
  onLegendToggle,
  shotStylePreset,
  visibility,
}) {
  if (shotStylePreset === 'statistics') return null;

  return (
    <ShotChartControls
      exportMenuRef={exportMenuRef}
      exportMenuState={{
        open: false,
        exportType: 'video',
        includeLegend: false,
        exportFormat: 'mp4',
        showFormatInfo: false,
      }}
      hasWeightData={hasWeightData}
      hasWeightFlowData={hasWeightFlowData}
      hasVideoExportSupport={false}
      isControlsLocked={false}
      isFullDisplay={isFullDisplay}
      isReplayPaused={false}
      isReplaying={false}
      isReplayExporting={false}
      isVideoExportActive={false}
      legendColorByLabel={legendColorByLabel}
      hiddenLegendLabels={hiddenLegendLabels}
      compareShotLegendItems={compareShotLegendItems}
      compareAlignmentMode={compareAlignmentMode}
      compareAlignmentOptions={compareAlignmentOptions}
      onCompareAlignmentModeChange={onCompareAlignmentModeChange}
      onCompareSwap={onCompareSwap}
      compareTargetDisplayMode={compareTargetDisplayMode}
      onCompareTargetDisplayModeChange={onCompareTargetDisplayModeChange}
      showCompareAnnotationToggle={false}
      compareAnnotationsEnabled={compareAnnotationsEnabled}
      onCompareAnnotationsToggle={null}
      isCompareMode={true}
      hideCompareControlsRowOnMobile={hideCompareControlsRowOnMobile}
      onCloseExportMenu={() => {}}
      onExportAction={() => {}}
      onExportMenuToggle={() => {}}
      onExportTypeChange={() => {}}
      onExportFormatChange={() => {}}
      onExportFormatInfoToggle={() => {}}
      onFullDisplayToggle={onFullDisplayToggle}
      onIncludeLegendChange={() => {}}
      onLegendToggle={onLegendToggle}
      onReplayToggle={() => {}}
      onStop={() => {}}
      replayExportStatus={{}}
      replayExportStatusHint=''
      replayExportStatusLabel=''
      shouldShowReplayFocusHint={false}
      shouldLockWebmToggle={false}
      shouldShowWebmToggle={false}
      showMobileLegend={!isAnalyzerMobileCompareLayout || isFullDisplay}
      topLegendLabels={SHOT_CHART_PRIMARY_LEGEND_LABELS}
      visibility={visibility}
    />
  );
}

function CompareDetailChartCard({
  chart,
  chartCardClass,
  compareEntries,
  compareEntriesKey,
  compareTooltipMode,
  detailChartHeight,
  detailChartTitleVariant,
  detailMetricPageByChartId,
  detailStaticCompactVariant,
  enableHoverInfo,
  hasScrubberRange,
  isFullDisplay,
  legendColorByLabel,
  onDetailMetricPageChange,
  resolvedCompareAlignmentMode,
  scrubberMax,
  scrubberMin,
  shouldUseAnalyzerMobileCompareLayout,
  shouldUseMobileStaticCompareLayout,
  shouldUseStatisticsMobileCompactLayout,
  shotStylePreset,
  useStaticTooltip,
}) {
  const metricLabel = chart.tooltipBaseLabel || chart.title;
  const isPagedPumpFlowMetric = shouldUseAnalyzerMobileCompareLayout && metricLabel === 'Pump Flow';
  const activeMetricPageKey = isPagedPumpFlowMetric
    ? detailMetricPageByChartId[chart.id] || COMPARE_DETAIL_METRIC_PAGE_KEYS.PUMP_FLOW
    : null;
  const handleMetricPageChange = isPagedPumpFlowMetric
    ? pageKey => onDetailMetricPageChange(chart.id, pageKey)
    : null;

  return (
    <div className={chartCardClass}>
      <CompareChartTitle
        title={chart.title}
        labelKey={metricLabel}
        variant={detailChartTitleVariant}
        iconColor={legendColorByLabel[metricLabel] || null}
      />
      {shotStylePreset === 'statistics' ? (
        <StatisticsChartMetricSummary compareEntries={compareEntries} metricLabel={metricLabel} />
      ) : null}
      <CompareChartCanvas
        config={chart.config}
        height={detailChartHeight}
        isFullDisplay={isFullDisplay}
        enableHoverInfo={enableHoverInfo}
        compareTooltipMode={compareTooltipMode}
        useCompactStaticTooltip={shouldUseMobileStaticCompareLayout}
        staticCompactVariant={detailStaticCompactVariant}
        staticMetricContext={
          shouldUseAnalyzerMobileCompareLayout
            ? { label: metricLabel, page: activeMetricPageKey }
            : null
        }
        emptyStaticTooltipContent={getDetailEmptyStaticTooltipContent({
          activeMetricPageKey,
          chart,
          compareEntries,
          onMetricPageChange: handleMetricPageChange,
          shouldUseAnalyzerMobileCompareLayout,
          shouldUseStatisticsMobileCompactLayout,
        })}
        disableDirectHoverOnMobile={shouldUseMobileStaticCompareLayout}
        showMobileScrubber={shouldUseMobileStaticCompareLayout && hasScrubberRange}
        mobileScrubberRange={{
          min: scrubberMin,
          max: scrubberMax,
          key: `${compareEntriesKey}-${resolvedCompareAlignmentMode}-${chart.id}`,
        }}
        useStaticTooltip={useStaticTooltip}
      />
    </div>
  );
}

function getVisibleCompareDetailCharts({
  detailCharts,
  isMobileDetailExpanded,
  shouldCollapseDetailCharts,
}) {
  return shouldCollapseDetailCharts && !isMobileDetailExpanded ? [] : detailCharts;
}

function getCompareChartsBodyClassName(isFullDisplay) {
  return isFullDisplay ? 'min-h-0 flex-1 overflow-y-auto pr-1' : 'w-full';
}

function getCompareChartsStackClassName({
  isMobileCompareCollapsed,
  shouldUseAnalyzerMobileCompareLayout,
}) {
  let stackClassName = 'space-y-3';
  if (shouldUseAnalyzerMobileCompareLayout) {
    stackClassName = 'shot-chart-compare-mobile-stack';
  }

  return [
    stackClassName,
    isMobileCompareCollapsed ? 'shot-chart-compare-mobile-stack--collapsed' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function CompareDetailChartsToggle({
  isMobileDetailExpanded,
  setIsMobileDetailExpanded,
  shouldCollapseDetailCharts,
}) {
  if (!shouldCollapseDetailCharts) return null;

  return (
    <button
      type='button'
      className='shot-chart-compare-detail-toggle app-card-surface hover:bg-base-200/60 transition-colors'
      onClick={() => setIsMobileDetailExpanded(expanded => !expanded)}
      aria-expanded={isMobileDetailExpanded}
    >
      <span>{isMobileDetailExpanded ? 'Hide detail charts' : 'Show detail charts'}</span>
      <FontAwesomeIcon
        icon={isMobileDetailExpanded ? faMinus : faPlus}
        className='text-base-content/45 text-xs'
        aria-hidden='true'
      />
    </button>
  );
}

function CompareMainChartCard({
  chartCardClass,
  compareEntries,
  compareEntriesKey,
  compareTooltipMode,
  enableHoverInfo,
  fullDisplayMainChartHeight,
  hasScrubberRange,
  hasWeightData,
  hasWeightFlowData,
  hiddenLegendLabels,
  isFullDisplay,
  legendColorByLabel,
  mainChartCardRef,
  mainChartConfig,
  mainChartTitleContent,
  mainControls,
  mainEmptyStaticTooltipContent,
  mainMobileChartControls,
  mainMobileShotSwitcher,
  mainStaticCompactVariant,
  mobileCompareLegend,
  onLegendToggle,
  resolvedCompareAlignmentMode,
  resolvedMainChartHeight,
  scrubberMax,
  scrubberMin,
  shouldShowDesktopCompareSeriesLegend,
  shouldUseAnalyzerMobileCompareLayout,
  shouldUseStatisticsMobileCompactLayout,
  shouldUseMobileStaticCompareLayout,
  shotStylePreset,
  useStaticTooltip,
  visibility,
}) {
  const shouldShowStatisticsSummaryBeforeChart =
    shotStylePreset === 'statistics' && !shouldUseStatisticsMobileCompactLayout;

  return (
    <div
      ref={mainChartCardRef}
      className={[
        chartCardClass,
        shouldUseAnalyzerMobileCompareLayout ? 'shot-chart-compare-main-card--mobile' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {mainControls}
      {mainMobileShotSwitcher}
      {mainChartTitleContent}
      {shouldShowStatisticsSummaryBeforeChart ? (
        <StatisticsChartMetricSummary compareEntries={compareEntries} />
      ) : null}
      <CompareChartCanvas
        config={mainChartConfig}
        height={isFullDisplay ? fullDisplayMainChartHeight : resolvedMainChartHeight}
        isFullDisplay={isFullDisplay}
        enableHoverInfo={enableHoverInfo}
        compareTooltipMode={compareTooltipMode}
        useCompactStaticTooltip={shouldUseMobileStaticCompareLayout}
        staticCompactVariant={mainStaticCompactVariant}
        emptyStaticTooltipContent={mainEmptyStaticTooltipContent}
        beforeChartContent={mainMobileChartControls}
        disableDirectHoverOnMobile={shouldUseMobileStaticCompareLayout}
        showMobileScrubber={shouldUseMobileStaticCompareLayout && hasScrubberRange}
        mobileScrubberRange={{
          min: scrubberMin,
          max: scrubberMax,
          key: `${compareEntriesKey}-${resolvedCompareAlignmentMode}`,
        }}
        useStaticTooltip={useStaticTooltip}
      />
      {shouldShowDesktopCompareSeriesLegend ? (
        <ShotChartLegendToggles
          labels={SHOT_CHART_SERIES_LEGEND_LABELS}
          hiddenLegendLabels={hiddenLegendLabels}
          hasWeightData={hasWeightData}
          hasWeightFlowData={hasWeightFlowData}
          isControlsLocked={false}
          legendColorByLabel={legendColorByLabel}
          onLegendToggle={onLegendToggle}
          visibility={visibility}
          className='shot-chart-scrubber-legend shot-chart-scrubber-legend--desktop'
        />
      ) : null}
      {mobileCompareLegend}
    </div>
  );
}

export function CompareChartsBody({
  chartCardClass,
  compareEntries,
  compareEntriesKey,
  compareTooltipMode,
  detailChartHeight,
  detailChartTitleVariant,
  detailCharts,
  detailStaticCompactVariant,
  enableHoverInfo,
  fullDisplayMainChartHeight,
  hasScrubberRange,
  hasWeightData,
  hasWeightFlowData,
  hiddenLegendLabels,
  isFullDisplay,
  isMobileDetailExpanded,
  legendColorByLabel,
  mainChartCardRef,
  mainChartConfig,
  mainChartTitleContent,
  mainControls,
  mainEmptyStaticTooltipContent,
  mainMobileChartControls,
  mainMobileShotSwitcher,
  mainStaticCompactVariant,
  mobileCompareLegend,
  detailMetricPageByChartId,
  onDetailMetricPageChange,
  onLegendToggle,
  resolvedCompareAlignmentMode,
  resolvedMainChartHeight,
  scrubberMax,
  scrubberMin,
  setIsMobileDetailExpanded,
  shouldCollapseDetailCharts,
  shouldUseAnalyzerMobileCompareLayout,
  shouldUseMobileStaticCompareLayout,
  shouldUseStatisticsMobileCompactLayout,
  shotStylePreset,
  useStaticTooltip,
  visibility,
}) {
  const visibleDetailCharts = getVisibleCompareDetailCharts({
    detailCharts,
    isMobileDetailExpanded,
    shouldCollapseDetailCharts,
  });
  const isMobileCompareCollapsed =
    shouldUseAnalyzerMobileCompareLayout && shouldCollapseDetailCharts && !isMobileDetailExpanded;
  const shouldShowDesktopCompareSeriesLegend =
    shotStylePreset !== 'statistics' && !shouldUseAnalyzerMobileCompareLayout;

  return (
    <div className={getCompareChartsBodyClassName(isFullDisplay)}>
      <div
        className={getCompareChartsStackClassName({
          isMobileCompareCollapsed,
          shouldUseAnalyzerMobileCompareLayout,
        })}
      >
        <CompareMainChartCard
          chartCardClass={chartCardClass}
          compareEntries={compareEntries}
          compareEntriesKey={compareEntriesKey}
          compareTooltipMode={compareTooltipMode}
          enableHoverInfo={enableHoverInfo}
          fullDisplayMainChartHeight={fullDisplayMainChartHeight}
          hasScrubberRange={hasScrubberRange}
          hasWeightData={hasWeightData}
          hasWeightFlowData={hasWeightFlowData}
          hiddenLegendLabels={hiddenLegendLabels}
          isFullDisplay={isFullDisplay}
          legendColorByLabel={legendColorByLabel}
          mainChartCardRef={mainChartCardRef}
          mainChartConfig={mainChartConfig}
          mainChartTitleContent={mainChartTitleContent}
          mainControls={mainControls}
          mainEmptyStaticTooltipContent={mainEmptyStaticTooltipContent}
          mainMobileChartControls={mainMobileChartControls}
          mainMobileShotSwitcher={mainMobileShotSwitcher}
          mainStaticCompactVariant={mainStaticCompactVariant}
          mobileCompareLegend={mobileCompareLegend}
          onLegendToggle={onLegendToggle}
          resolvedCompareAlignmentMode={resolvedCompareAlignmentMode}
          resolvedMainChartHeight={resolvedMainChartHeight}
          scrubberMax={scrubberMax}
          scrubberMin={scrubberMin}
          shouldShowDesktopCompareSeriesLegend={shouldShowDesktopCompareSeriesLegend}
          shouldUseAnalyzerMobileCompareLayout={shouldUseAnalyzerMobileCompareLayout}
          shouldUseStatisticsMobileCompactLayout={shouldUseStatisticsMobileCompactLayout}
          shouldUseMobileStaticCompareLayout={shouldUseMobileStaticCompareLayout}
          shotStylePreset={shotStylePreset}
          useStaticTooltip={useStaticTooltip}
          visibility={visibility}
        />

        <CompareDetailChartsToggle
          isMobileDetailExpanded={isMobileDetailExpanded}
          setIsMobileDetailExpanded={setIsMobileDetailExpanded}
          shouldCollapseDetailCharts={shouldCollapseDetailCharts}
        />

        {visibleDetailCharts.map(chart => (
          <CompareDetailChartCard
            key={chart.id}
            chart={chart}
            chartCardClass={chartCardClass}
            compareEntries={compareEntries}
            compareEntriesKey={compareEntriesKey}
            compareTooltipMode={compareTooltipMode}
            detailChartHeight={detailChartHeight}
            detailChartTitleVariant={detailChartTitleVariant}
            detailMetricPageByChartId={detailMetricPageByChartId}
            detailStaticCompactVariant={detailStaticCompactVariant}
            enableHoverInfo={enableHoverInfo}
            hasScrubberRange={hasScrubberRange}
            isFullDisplay={isFullDisplay}
            legendColorByLabel={legendColorByLabel}
            onDetailMetricPageChange={onDetailMetricPageChange}
            resolvedCompareAlignmentMode={resolvedCompareAlignmentMode}
            scrubberMax={scrubberMax}
            scrubberMin={scrubberMin}
            shouldUseAnalyzerMobileCompareLayout={shouldUseAnalyzerMobileCompareLayout}
            shouldUseMobileStaticCompareLayout={shouldUseMobileStaticCompareLayout}
            shouldUseStatisticsMobileCompactLayout={shouldUseStatisticsMobileCompactLayout}
            shotStylePreset={shotStylePreset}
            useStaticTooltip={useStaticTooltip}
          />
        ))}
      </div>
    </div>
  );
}

export function CompareChartsShell({ charts, controls, isFullDisplay, onCloseFullDisplay }) {
  if (isFullDisplay && globalThis.document !== undefined) {
    return createPortal(
      <div className='shot-chart-full-display select-none'>
        <button
          type='button'
          className='shot-chart-full-display__backdrop'
          onClick={onCloseFullDisplay}
          aria-label='Close full display'
        />
        <div className='shot-chart-full-display__panel'>
          {controls}
          {charts}
        </div>
      </div>,
      globalThis.document.body,
    );
  }

  return <div className='w-full select-none'>{charts}</div>;
}
