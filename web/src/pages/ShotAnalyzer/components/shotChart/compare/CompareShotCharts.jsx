import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import Chart from 'chart.js/auto';
import annotationPlugin from 'chartjs-plugin-annotation';
import { getLegendColorByLabel, getNeutralAxisTickColor, getShotChartColors } from '../helpers';
import {
  buildCompareDetailCharts,
  getAxisRange,
  getCompareAnnotations,
  getCompareMainChartConfig,
  getCompareWeightAxisRange,
  getDetailChartHeight,
  getMainAxisUnitLabels,
  getMainAxisUnitPadding,
} from './compareChartConfig';
import {
  CompareChartsBody,
  CompareChartsShell,
  CompareControls,
  CompareMobileLegendSection,
} from './CompareChartLayout';
import { buildMainChartDatasets, getCompareShotLegendItems } from './compareDatasets';
import {
  CompareMobileChartControls,
  CompareMobileShotSwitcher,
  getMainChartTitleContent,
  getMainEmptyStaticTooltipContent,
} from './CompareMetricContent';
import {
  getAnalyzerCompareValue,
  getCompareEntriesKey,
  getCompareLayoutFlags,
  getCompareModels,
  getCompareXRange,
  getFullDisplayCompareMainChartHeight,
  getHiddenLegendLabels,
  getMobileCompareVisibility,
  getResolvedCompareMainChartHeight,
  getResolvedCompareStyle,
  getScrubberRange,
  getStaticTooltipVariants,
  hasCompareSampleValue,
} from './compareModel';
import {
  getCompareLegendToggleHandler,
  useCompareViewportState,
  useCompareVisibilityState,
  useInitialCompareAlignmentState,
  useResetAnalyzerCompareAlignmentOnSecondaryShotChange,
  useResolvedCompareAlignmentState,
} from './useCompareChartState';
import '../../ShotChart.css';

Chart.register(annotationPlugin);

export function CompareShotCharts({
  compareEntries,
  onCompareSwap = null,
  compareTargetDisplayMode,
  onCompareTargetDisplayModeChange,
  showPhaseAnnotations = true,
  showStopAnnotations = true,
  showBrewModeAnnotation = true,
  enableDualMainChartAnnotations = true,
  showMainChartTitle = true,
  detailChartTitleVariant = 'default',
  enableHoverInfo = true,
  compareTooltipMode = 'compare',
  showCompareShotLegend = true,
  shotStylePreset = 'analyzer',
  showWeightInMainChart = true,
  showWeightFlowInMainChart = true,
}) {
  const exportMenuRef = useRef(null);
  const mainChartCardRef = useRef(null);
  const { setVisibility, visibility } = useCompareVisibilityState({
    enableDualMainChartAnnotations,
    showBrewModeAnnotation,
    showPhaseAnnotations,
    showStopAnnotations,
    shotStylePreset,
  });
  const [compareAlignmentMode, setCompareAlignmentMode] = useInitialCompareAlignmentState();
  useResetAnalyzerCompareAlignmentOnSecondaryShotChange({
    compareEntries,
    setCompareAlignmentMode,
    shotStylePreset,
  });
  const [isFullDisplay, setIsFullDisplay] = useState(false);
  const [detailMetricPageByChartId, setDetailMetricPageByChartId] = useState({});
  const { isMobileCompareLayout, standardChartWidth } = useCompareViewportState({
    isFullDisplay,
    mainChartCardRef,
    shotStylePreset,
  });
  const [isMobileDetailExpanded, setIsMobileDetailExpanded] = useState(false);
  const [isMobileSeriesLegendExpanded, setIsMobileSeriesLegendExpanded] = useState(false);
  const {
    isAnalyzerMobileCompareLayout,
    shouldUseAnalyzerMobileCompareLayout,
    shouldUseMobileStaticCompareLayout,
    shouldUseStatisticsMobileCompactLayout,
  } = getCompareLayoutFlags({
    compareTooltipMode,
    isFullDisplay,
    isMobileCompareLayout,
    shotStylePreset,
  });
  const effectiveVisibility = shouldUseAnalyzerMobileCompareLayout
    ? getMobileCompareVisibility(visibility)
    : visibility;

  const colors = getShotChartColors();
  const legendColorByLabel = getLegendColorByLabel(colors);
  const resolvedCompareStyle = getResolvedCompareStyle(shotStylePreset);
  const compareShotLegendItems = getCompareShotLegendItems({
    colors,
    compareEntries,
    resolvedCompareStyle,
    shotStylePreset,
    showCompareShotLegend,
  });
  const compareEntriesKey = getCompareEntriesKey(compareEntries);
  const handleDetailMetricPageChange = useCallback((chartId, pageKey) => {
    setDetailMetricPageByChartId(previousPages =>
      previousPages[chartId] === pageKey
        ? previousPages
        : {
            ...previousPages,
            [chartId]: pageKey,
          },
    );
  }, []);
  const hiddenLegendLabels = getHiddenLegendLabels({ showPhaseAnnotations, showStopAnnotations });
  const hasWeightData = hasCompareSampleValue(compareEntries, 'v');
  const hasWeightFlowData = hasCompareSampleValue(compareEntries, 'vf');

  useEffect(() => {
    setDetailMetricPageByChartId({});
  }, [compareEntriesKey]);

  const { compareAlignmentOptions, compareModels, resolvedCompareAlignmentMode } = getCompareModels(
    {
      colors,
      compareAlignmentMode,
      compareEntries,
      shotStylePreset,
      visibility: effectiveVisibility,
    },
  );

  useResolvedCompareAlignmentState({
    compareAlignmentMode,
    resolvedCompareAlignmentMode,
    setCompareAlignmentMode,
    shotStylePreset,
  });

  const { detailPhaseAnnotations, mainAnnotations } = getCompareAnnotations({
    compareModels,
    enableDualMainChartAnnotations,
    showBrewModeAnnotation,
    showPhaseAnnotations,
    showStopAnnotations,
    visibility: effectiveVisibility,
  });
  const xRange = getCompareXRange(compareModels);
  const {
    hasRange: hasScrubberRange,
    max: scrubberMax,
    min: scrubberMin,
  } = getScrubberRange(xRange);
  const mainDatasets = buildMainChartDatasets({
    compareModels,
    colors,
    visibility: effectiveVisibility,
    targetDisplayMode: compareTargetDisplayMode,
    shotStylePreset,
    compareStyle: resolvedCompareStyle,
    showWeightInMainChart,
    showWeightFlowInMainChart,
  });
  const mainAxisRange = getAxisRange({
    datasets: mainDatasets.filter(dataset => dataset.yAxisID === 'yMain'),
    beginAtZero: true,
    fallbackMin: 0,
    fallbackMax: 16,
  });
  const weightDatasets = mainDatasets.filter(dataset => dataset.yAxisID === 'yWeight');
  const weightAxisRange = getCompareWeightAxisRange({
    shotStylePreset,
    weightDatasets,
    mainDatasets,
    mainAxisRange,
    compareModelCount: compareModels.length,
  });
  const neutralAxisTickColor = getNeutralAxisTickColor();
  const showWeightAxis = Boolean(
    hasWeightData && showWeightInMainChart && effectiveVisibility.weight,
  );
  const mainAxisUnitLabels = getMainAxisUnitLabels({ showWeightAxis });
  const mainAxisUnitPadding = getMainAxisUnitPadding({
    mainAxisUnitLabels,
    reserveMarkerSpace: shotStylePreset === 'analyzer',
  });

  const mainChartConfig = getCompareMainChartConfig({
    compareModels,
    compareShotLegendItems,
    mainAnnotations,
    mainAxisRange,
    mainAxisUnitLabels,
    mainAxisUnitPadding,
    mainDatasets,
    neutralAxisTickColor,
    showStopAnnotations,
    showWeightAxis,
    weightAxisRange,
    xRange,
  });
  const resolvedMainChartHeight = getResolvedCompareMainChartHeight({
    shotStylePreset,
    standardChartWidth,
  });
  const fullDisplayMainChartHeight = getFullDisplayCompareMainChartHeight();

  const detailChartHeight = getDetailChartHeight(isFullDisplay);

  const detailCharts = buildCompareDetailCharts({
    colors,
    compareModels,
    compareTargetDisplayMode,
    detailPhaseAnnotations,
    includePumpFlowWaterTooltip: shouldUseAnalyzerMobileCompareLayout,
    neutralAxisTickColor,
    resolvedCompareStyle,
    shotStylePreset,
    visibility: effectiveVisibility,
    xRange,
  });

  const handleLegendToggle = getCompareLegendToggleHandler({
    hasWeightData,
    hasWeightFlowData,
    setVisibility,
  });

  const controls = (
    <CompareControls
      compareAlignmentMode={resolvedCompareAlignmentMode}
      compareAlignmentOptions={getAnalyzerCompareValue(
        shotStylePreset,
        compareAlignmentOptions,
        [],
      )}
      compareAnnotationsEnabled={false}
      compareShotLegendItems={compareShotLegendItems}
      compareTargetDisplayMode={compareTargetDisplayMode}
      exportMenuRef={exportMenuRef}
      hasWeightData={hasWeightData}
      hasWeightFlowData={hasWeightFlowData}
      hiddenLegendLabels={hiddenLegendLabels}
      hideCompareControlsRowOnMobile={shouldUseAnalyzerMobileCompareLayout}
      isAnalyzerMobileCompareLayout={isAnalyzerMobileCompareLayout}
      isFullDisplay={isFullDisplay}
      legendColorByLabel={legendColorByLabel}
      onCompareAlignmentModeChange={getAnalyzerCompareValue(
        shotStylePreset,
        setCompareAlignmentMode,
      )}
      onCompareSwap={getAnalyzerCompareValue(shotStylePreset, onCompareSwap)}
      onCompareTargetDisplayModeChange={onCompareTargetDisplayModeChange}
      onFullDisplayToggle={() => setIsFullDisplay(currentValue => !currentValue)}
      onLegendToggle={handleLegendToggle}
      shotStylePreset={shotStylePreset}
      visibility={effectiveVisibility}
    />
  );

  const chartCardClass = [
    shotStylePreset === 'statistics' ? 'shot-chart-statistics-card' : '',
    'app-card-surface rounded-xl px-1.5 py-2 sm:px-2',
  ]
    .filter(Boolean)
    .join(' ');
  const mobileCompareLegend = (
    <CompareMobileLegendSection
      hiddenLegendLabels={hiddenLegendLabels}
      isExpanded={isMobileSeriesLegendExpanded}
      isVisible={shouldUseAnalyzerMobileCompareLayout}
      hasWeightData={hasWeightData}
      hasWeightFlowData={hasWeightFlowData}
      legendColorByLabel={legendColorByLabel}
      onLegendToggle={handleLegendToggle}
      onToggleExpanded={() => setIsMobileSeriesLegendExpanded(expanded => !expanded)}
      visibility={effectiveVisibility}
    />
  );
  const shouldCollapseDetailCharts = shouldUseAnalyzerMobileCompareLayout;
  const mainChartTitleContent = getMainChartTitleContent({
    legendColorByLabel,
    shotStylePreset,
    showMainChartTitle: showMainChartTitle && !shouldUseAnalyzerMobileCompareLayout,
  });
  const mainMobileShotSwitcher = shouldUseAnalyzerMobileCompareLayout ? (
    <CompareMobileShotSwitcher
      compareShotLegendItems={compareShotLegendItems}
      onCompareSwap={getAnalyzerCompareValue(shotStylePreset, onCompareSwap)}
    />
  ) : null;
  const mainMobileChartControls = shouldUseAnalyzerMobileCompareLayout ? (
    <CompareMobileChartControls
      compareAlignmentMode={resolvedCompareAlignmentMode}
      compareAlignmentOptions={getAnalyzerCompareValue(
        shotStylePreset,
        compareAlignmentOptions,
        [],
      )}
      compareTargetDisplayMode={compareTargetDisplayMode}
      onCompareAlignmentModeChange={getAnalyzerCompareValue(
        shotStylePreset,
        setCompareAlignmentMode,
      )}
      onCompareTargetDisplayModeChange={onCompareTargetDisplayModeChange}
    />
  ) : null;
  const staticTooltipVariants = getStaticTooltipVariants({
    shouldUseAnalyzerMobileCompareLayout,
    shouldUseStatisticsMobileCompactLayout,
  });
  const mainEmptyStaticTooltipContent = getMainEmptyStaticTooltipContent({
    compareEntries,
    shouldUseAnalyzerMobileCompareLayout,
    shouldUseStatisticsMobileCompactLayout,
  });

  const charts = (
    <CompareChartsBody
      chartCardClass={chartCardClass}
      compareEntries={compareEntries}
      compareEntriesKey={compareEntriesKey}
      compareTooltipMode={compareTooltipMode}
      detailChartHeight={detailChartHeight}
      detailChartTitleVariant={detailChartTitleVariant}
      detailCharts={detailCharts}
      detailStaticCompactVariant={staticTooltipVariants.detail}
      enableHoverInfo={enableHoverInfo}
      fullDisplayMainChartHeight={fullDisplayMainChartHeight}
      hasScrubberRange={hasScrubberRange}
      hasWeightData={hasWeightData}
      hasWeightFlowData={hasWeightFlowData}
      hiddenLegendLabels={hiddenLegendLabels}
      isFullDisplay={isFullDisplay}
      isMobileDetailExpanded={isMobileDetailExpanded}
      legendColorByLabel={legendColorByLabel}
      mainChartCardRef={mainChartCardRef}
      mainChartConfig={mainChartConfig}
      mainChartTitleContent={mainChartTitleContent}
      mainControls={isFullDisplay ? null : controls}
      mainEmptyStaticTooltipContent={mainEmptyStaticTooltipContent}
      mainMobileChartControls={mainMobileChartControls}
      mainMobileShotSwitcher={mainMobileShotSwitcher}
      mainStaticCompactVariant={staticTooltipVariants.main}
      mobileCompareLegend={mobileCompareLegend}
      detailMetricPageByChartId={detailMetricPageByChartId}
      onDetailMetricPageChange={handleDetailMetricPageChange}
      onLegendToggle={handleLegendToggle}
      resolvedCompareAlignmentMode={resolvedCompareAlignmentMode}
      resolvedMainChartHeight={resolvedMainChartHeight}
      scrubberMax={scrubberMax}
      scrubberMin={scrubberMin}
      setIsMobileDetailExpanded={setIsMobileDetailExpanded}
      shouldCollapseDetailCharts={shouldCollapseDetailCharts}
      shouldUseAnalyzerMobileCompareLayout={shouldUseAnalyzerMobileCompareLayout}
      shouldUseMobileStaticCompareLayout={shouldUseMobileStaticCompareLayout}
      shouldUseStatisticsMobileCompactLayout={shouldUseStatisticsMobileCompactLayout}
      shotStylePreset={shotStylePreset}
      useStaticTooltip={isMobileCompareLayout}
      visibility={effectiveVisibility}
    />
  );

  return (
    <CompareChartsShell
      charts={charts}
      controls={controls}
      isFullDisplay={isFullDisplay}
      onCloseFullDisplay={() => setIsFullDisplay(false)}
    />
  );
}
