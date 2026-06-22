/* global globalThis */

import { createPortal } from 'preact/compat';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import Chart from 'chart.js/auto';
import annotationPlugin from 'chartjs-plugin-annotation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRightArrowLeft } from '@fortawesome/free-solid-svg-icons/faArrowRightArrowLeft';
import { faGaugeHigh } from '@fortawesome/free-solid-svg-icons/faGaugeHigh';
import { faMinus } from '@fortawesome/free-solid-svg-icons/faMinus';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import {
  CompareSelect,
  CompareTargetSelect,
  SHOT_CHART_PRIMARY_LEGEND_LABELS,
  SHOT_CHART_SERIES_LEGEND_LABELS,
  ShotChartControls,
  ShotChartLegendToggles,
} from './ShotChartControls';
import {
  areTooltipStatesEqual,
  buildExternalTooltipState,
  createHiddenExternalTooltipLayout,
  createHiddenExternalTooltipState,
  ShotChartExternalTooltip,
  useMeasuredExternalTooltipLayout,
} from './ShotChartExternalTooltip';
import {
  COMPARE_DETAIL_METRIC_PAGE_KEYS,
  INITIAL_VISIBILITY,
  MAIN_CHART_HEIGHT_DEFAULT,
  UNIT_BY_LABEL,
} from './constants';
import { buildShotChartModel } from './buildShotChartModel';
import {
  createChartPointElementConfig,
  finalWeightBadgeOverlayPlugin,
  finalWeightCalloutLinePlugin,
  getLegendColorByLabel,
  getAxisUnitReservedPadding,
  getNeutralAxisTickColor,
  formatResponsiveXAxisTick,
  formatUniqueAxisTick,
  getPercentileValue,
  getSpikeResistantSeriesMax,
  getShotChartColors,
  axisUnitLabelPlugin,
  hoverGuidePlugin,
  phaseLabelOverlayPlugin,
  stopIconOverlayPlugin,
} from './helpers';
import {
  getShotChartBrewModeMeta,
  getShotChartDisplayLabel,
  getShotChartLabelIcon,
} from './labelVisuals';
import { MobileChartScrubber } from './MobileChartScrubber';
import {
  ChartMetricValue,
  MobileMetricGrid,
  MobileMetricPager,
  MobileMetricValue,
} from './MobileMetricPager';
import {
  getChartScrubberInsets,
  getScrubberValueFromNativeInputEvent,
  getScrubberValueFromPointerEvent,
  isStaticMobileTooltipViewport,
} from './scrubberUtils';
import { extractClientPoint } from './hoverSync';
import { useMobileScrubberReset } from './useMobileScrubberReset';
import {
  ANALYZER_DB_KEYS,
  COMPARE_TARGET_DISPLAY_MODES,
  loadFromStorage,
  saveToStorage,
} from '../../utils/analyzerUtils';
import '../ShotChart.css';

Chart.register(annotationPlugin);

const HIDDEN_STATIC_TOOLTIP_STATE = createHiddenExternalTooltipState();

const SHOT_STYLE_PRESETS = {
  analyzer: {
    opacities: [1, 0.46, 0.34, 0.26, 0.2, 0.15],
    lineWidths: [3.4, 3, 2.65, 2.3, 2.05, 1.8],
  },
  statistics: {
    opacities: [0.58, 0.46, 0.34, 0.28, 0.24, 0.22],
    lineWidths: [3.05, 2.85, 2.6, 2.4, 2.2, 2.05],
  },
};
const DETAIL_CHART_HEIGHT_SMALL = 180;
const DETAIL_CHART_HEIGHT_BIG = 220;
const DETAIL_CHART_HEIGHT_FULL = 260;
const COMPARE_MARKER_TOP_PADDING = 48;
const COMPARE_ALIGNMENT_SHOT_START = 'shotStart';
const COMPARE_ALIGNMENT_PHASE_PREFIX = 'phase:';
const COMPARE_STYLE_LINE_PATTERN = 'linePattern';
const COMPARE_STYLE_FADE = 'fade';
const MOBILE_COMPARE_CONTEXT_LEGEND_LABELS = ['Phases', 'Stops'];
const MOBILE_COMPARE_FIXED_SERIES_LABELS = ['Pressure', 'Target P', 'Pump Flow', 'Target F'];
const MOBILE_COMPARE_CONTEXT_LABEL_SET = new Set(MOBILE_COMPARE_CONTEXT_LEGEND_LABELS);
function normalizeCompareAlignmentMode(value, options = []) {
  const optionValues = new Set(options.map(option => option.value));
  if (optionValues.has(value)) return value;
  return COMPARE_ALIGNMENT_SHOT_START;
}

function normalizeCompareVisibility(
  storedVisibility,
  { showPhaseAnnotations, showStopAnnotations, showBrewModeAnnotation },
) {
  const defaultVisibility = {
    ...INITIAL_VISIBILITY,
    phaseNames: false,
    stops: false,
    brewModeLabel: Boolean(showBrewModeAnnotation),
    temp: false,
    puckFlow: false,
    weight: false,
    weightFlow: false,
  };

  const nextVisibility = { ...defaultVisibility };
  if (storedVisibility && typeof storedVisibility === 'object') {
    Object.keys(INITIAL_VISIBILITY).forEach(key => {
      if (typeof storedVisibility[key] === 'boolean') {
        nextVisibility[key] = storedVisibility[key];
      }
    });
  }

  if (!showPhaseAnnotations) nextVisibility.phaseNames = false;
  if (!showStopAnnotations) nextVisibility.stops = false;
  if (!showBrewModeAnnotation) nextVisibility.brewModeLabel = false;

  return nextVisibility;
}

function getMobileCompareVisibility(visibility) {
  return {
    ...visibility,
    brewModeLabel: false,
    pressure: true,
    targetPressure: true,
    flow: true,
    targetFlow: true,
    puckFlow: false,
    temp: false,
    targetTemp: false,
    weight: false,
    weightFlow: false,
  };
}

function getStandardCompareChartHeight(containerWidth) {
  if (globalThis.window === undefined) return MAIN_CHART_HEIGHT_DEFAULT;
  const isSmartphone = globalThis.window.innerWidth <= 640;
  if (isSmartphone) {
    const viewportHeight =
      globalThis.window.visualViewport?.height || globalThis.window.innerHeight || 0;
    const numericWidth = Number(containerWidth);
    const widthBasedHeight =
      Number.isFinite(numericWidth) && numericWidth > 0
        ? Math.round(numericWidth * 0.78)
        : MAIN_CHART_HEIGHT_DEFAULT;
    if (Number.isFinite(viewportHeight) && viewportHeight > 0) {
      return Math.max(230, Math.min(widthBasedHeight, Math.round(viewportHeight * 0.42)));
    }
    return Math.max(230, widthBasedHeight);
  }
  const isDesktop = globalThis.window.innerWidth >= 1024;
  if (isDesktop) {
    const vh = globalThis.window.innerHeight;
    if (!Number.isFinite(vh) || vh <= 0) return MAIN_CHART_HEIGHT_DEFAULT;
    return Math.round(vh * (3 / 5));
  }
  const numericWidth = Number(containerWidth);
  if (!Number.isFinite(numericWidth) || numericWidth <= 0) return MAIN_CHART_HEIGHT_DEFAULT;
  return Math.round(numericWidth * (2 / 3));
}

function getCompareFullDisplayViewportHeight() {
  if (globalThis.window === undefined) return 0;
  return Math.round(globalThis.window.visualViewport?.height || globalThis.window.innerHeight || 0);
}

function getFullDisplayCompareMainChartHeight() {
  const viewportHeight = getCompareFullDisplayViewportHeight();
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) return 420;

  const availableHeight = Math.max(280, viewportHeight - 170);
  const preferredHeight = Math.round(availableHeight * 0.62);
  const minimumHeight = viewportHeight < 560 ? 240 : 320;
  return Math.max(minimumHeight, Math.min(720, preferredHeight));
}

function getCompareMobileLayoutState() {
  return isStaticMobileTooltipViewport();
}

function getStaticTooltipVariants({
  shouldUseAnalyzerMobileCompareLayout,
  shouldUseStatisticsMobileCompactLayout,
}) {
  if (shouldUseStatisticsMobileCompactLayout) {
    return {
      detail: 'statisticsCompact',
      main: 'statisticsCompact',
    };
  }
  if (shouldUseAnalyzerMobileCompareLayout) {
    return {
      detail: 'singleLine',
      main: 'comparePreview',
    };
  }
  return {
    detail: 'default',
    main: 'default',
  };
}

function getCompareLayoutFlags({
  compareTooltipMode,
  isFullDisplay,
  isMobileCompareLayout,
  shotStylePreset,
}) {
  const isAnalyzerMobileCompareLayout = shotStylePreset === 'analyzer' && isMobileCompareLayout;
  const shouldUseAnalyzerMobileCompareLayout = isAnalyzerMobileCompareLayout && !isFullDisplay;
  const shouldUseStatisticsMobileCompactLayout =
    shotStylePreset === 'statistics' &&
    compareTooltipMode === 'compareTitleOnly' &&
    isMobileCompareLayout &&
    !isFullDisplay;

  return {
    isAnalyzerMobileCompareLayout,
    shouldUseAnalyzerMobileCompareLayout,
    shouldUseMobileStaticCompareLayout:
      shouldUseAnalyzerMobileCompareLayout || shouldUseStatisticsMobileCompactLayout,
    shouldUseStatisticsMobileCompactLayout,
  };
}

function getResolvedCompareStyle(shotStylePreset) {
  if (shotStylePreset === 'analyzer') return COMPARE_STYLE_LINE_PATTERN;
  return COMPARE_STYLE_FADE;
}

function getAnalyzerCompareValue(shotStylePreset, value, fallback = null) {
  if (shotStylePreset === 'analyzer') return value;
  return fallback;
}

function getCompareShotLegendItems({
  colors,
  compareEntries,
  resolvedCompareStyle,
  shotStylePreset,
  showCompareShotLegend,
}) {
  if (!showCompareShotLegend) return [];
  return buildCompareLegendItems(compareEntries, colors, shotStylePreset, resolvedCompareStyle);
}

function getCompareEntryKey(entry, index) {
  return entry?.key || entry?.shot?.storageKey || entry?.shot?.id || entry?.label || index;
}

function getCompareEntriesKey(compareEntries) {
  return compareEntries.map((entry, index) => getCompareEntryKey(entry, index)).join('|');
}

function getHiddenLegendLabels({ showPhaseAnnotations, showStopAnnotations }) {
  return [...(showPhaseAnnotations ? [] : ['Phases']), ...(showStopAnnotations ? [] : ['Stops'])];
}

function hasCompareSampleValue(compareEntries, sampleKey) {
  return compareEntries.some(
    entry =>
      Array.isArray(entry.shot?.samples) &&
      entry.shot.samples.some(sample => Number(sample?.[sampleKey]) > 0),
  );
}

function getCompareModels({
  colors,
  compareAlignmentMode,
  compareEntries,
  shotStylePreset,
  visibility,
}) {
  const rawCompareModels = compareEntries.map(entry => ({
    entry,
    model: buildShotChartModel({
      shotData: entry.shot,
      results: entry.results,
      visibility,
      colors,
      brewModeMeta: getShotChartBrewModeMeta(entry.results, colors),
      usePhaseNumbers: true,
    }),
  }));
  const compareAlignmentOptions =
    shotStylePreset === 'analyzer'
      ? getComparePhaseAlignmentOptions(rawCompareModels)
      : [{ value: COMPARE_ALIGNMENT_SHOT_START, label: 'Shot start' }];
  const resolvedCompareAlignmentMode =
    shotStylePreset === 'analyzer'
      ? normalizeCompareAlignmentMode(compareAlignmentMode, compareAlignmentOptions)
      : COMPARE_ALIGNMENT_SHOT_START;
  const compareModels = rawCompareModels.map(({ entry, model }) => ({
    entry,
    model: alignCompareModel(model, resolvedCompareAlignmentMode),
  }));

  return {
    compareAlignmentOptions,
    compareModels,
    resolvedCompareAlignmentMode,
  };
}

function getScrubberRange(xRange) {
  const min = Number.isFinite(xRange.min) ? xRange.min : 0;
  const max = Number.isFinite(xRange.max) ? xRange.max : 0;
  return {
    hasRange: max > min,
    max,
    min,
  };
}

const COMPARE_LEGEND_KEY_BY_LABEL = {
  Phases: 'phaseNames',
  Stops: 'stops',
  Temp: 'temp',
  'Target T': 'targetTemp',
  Pressure: 'pressure',
  'Target P': 'targetPressure',
  'Pump Flow': 'flow',
  'Target F': 'targetFlow',
  'Puck Flow': 'puckFlow',
  Weight: 'weight',
  'Weight Flow': 'weightFlow',
};

function getMainChartTitleContent({ legendColorByLabel, shotStylePreset, showMainChartTitle }) {
  if (shotStylePreset === 'statistics') {
    return (
      <CompareChartTitle
        title='Pressure & Pump Flow'
        variant='statisticsMain'
        icons={[
          {
            key: 'pressure',
            icon: getShotChartLabelIcon('Pressure'),
            color: legendColorByLabel.Pressure || null,
          },
          {
            key: 'flow',
            icon: getShotChartLabelIcon('Pump Flow'),
            color: legendColorByLabel['Pump Flow'] || null,
          },
        ]}
      />
    );
  }

  if (showMainChartTitle) return <CompareChartTitle title='Compare Overlay' />;
  return null;
}

function getMainEmptyStaticTooltipContent({
  compareEntries,
  shouldUseAnalyzerMobileCompareLayout,
  shouldUseStatisticsMobileCompactLayout,
}) {
  if (shouldUseStatisticsMobileCompactLayout) {
    return <StatisticsChartMetricSummary compareEntries={compareEntries} variant='mobileCompact' />;
  }
  if (shouldUseAnalyzerMobileCompareLayout) {
    return <CompareMobileMetricPreview compareEntries={compareEntries} />;
  }
  return null;
}

function getMainAxisUnitLabels({ showWeightAxis }) {
  const labels = [
    {
      scaleId: 'yMain',
      label: `${UNIT_BY_LABEL.Pressure} / ${UNIT_BY_LABEL['Pump Flow']}`,
    },
  ];
  if (showWeightAxis) {
    labels.push({
      scaleId: 'yWeight',
      label: 'g',
      side: 'right',
      yOffset: 0,
    });
  }
  return labels;
}

function getMainAxisUnitPadding({ mainAxisUnitLabels, reserveMarkerSpace }) {
  const padding = getAxisUnitReservedPadding({
    yLabels: mainAxisUnitLabels,
    xLabel: 's',
  });

  if (reserveMarkerSpace) {
    return {
      ...padding,
      top: Math.max(padding.top, COMPARE_MARKER_TOP_PADDING),
    };
  }

  return padding;
}

function getCompareAnnotations({
  compareModels,
  enableDualMainChartAnnotations,
  showBrewModeAnnotation,
  showPhaseAnnotations,
  showStopAnnotations,
  visibility,
}) {
  return {
    detailPhaseAnnotations: buildCompareMainAnnotations({
      compareModels,
      annotationsEnabled: true,
      showPhaseAnnotations: showPhaseAnnotations && visibility.phaseNames,
      showStopAnnotations: false,
      showBrewModeAnnotation: false,
      enableDualMainChartAnnotations,
    }),
    mainAnnotations: buildCompareMainAnnotations({
      compareModels,
      annotationsEnabled: true,
      showPhaseAnnotations: showPhaseAnnotations && visibility.phaseNames,
      showStopAnnotations: showStopAnnotations && visibility.stops,
      showBrewModeAnnotation: showBrewModeAnnotation && visibility.brewModeLabel,
      enableDualMainChartAnnotations,
    }),
  };
}

function getComparePhaseTooltipGroups(compareModels, compareShotLegendItems = []) {
  return compareModels.map(({ entry, model }, index) => ({
    rows: model.phaseOverviewRows || [],
    shotLabel: entry.label || `Shot ${index + 1}`,
    shotNumber: index + 1,
    color: entry.accentColor || compareShotLegendItems[index]?.color || null,
  }));
}

function getCompareMainChartConfig({
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
}) {
  return {
    type: 'line',
    phaseTooltipGroups: getComparePhaseTooltipGroups(compareModels, compareShotLegendItems),
    showPhaseTooltipNames: true,
    showPhaseTooltipStops: showStopAnnotations,
    data: { datasets: mainDatasets },
    plugins: [
      hoverGuidePlugin,
      finalWeightCalloutLinePlugin,
      axisUnitLabelPlugin,
      phaseLabelOverlayPlugin,
      stopIconOverlayPlugin,
      finalWeightBadgeOverlayPlugin,
    ],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      layout: {
        autoPadding: false,
        padding: mainAxisUnitPadding,
      },
      elements: {
        point: createChartPointElementConfig(),
      },
      interaction: {
        mode: 'x',
        intersect: false,
      },
      plugins: {
        legend: { display: false },
        annotation: {
          clip: false,
          annotations: mainAnnotations,
        },
        finalWeightCalloutLine: {
          callouts: Object.entries(mainAnnotations)
            .filter(([key]) => key.endsWith('final_weight_callout_meta'))
            .map(([, annotation]) => annotation),
        },
        axisUnitLabels: {
          yLabels: mainAxisUnitLabels,
          chartLabels: [],
          xLabel: 's',
        },
        phaseLabelOverlay: {
          labels: compareModels.flatMap(({ model }) => model.phaseLabelOverlays || []),
        },
        stopIconOverlay: {
          stops: compareModels.flatMap(({ model }) => model.stopIconOverlays || []),
        },
        finalWeightBadgeOverlay: {
          labels: Object.entries(mainAnnotations)
            .filter(([key]) => key.endsWith('final_weight'))
            .map(([, annotation]) => annotation),
        },
      },
      scales: {
        x: {
          type: 'linear',
          min: xRange.min,
          max: xRange.max,
          ticks: {
            display: true,
            autoSkip: false,
            font: { size: 10 },
            color: neutralAxisTickColor,
            callback: formatResponsiveXAxisTick,
            padding: 4,
            align: 'inner',
            includeBounds: true,
            maxRotation: 0,
            minRotation: 0,
          },
          grid: {
            display: true,
            color: 'rgba(200, 200, 200, 0.08)',
          },
        },
        yMain: {
          type: 'linear',
          position: 'left',
          min: mainAxisRange.min,
          max: mainAxisRange.max,
          ticks: {
            display: true,
            font: { size: 10 },
            color: neutralAxisTickColor,
            callback: formatUniqueAxisTick,
          },
          grid: {
            color: 'rgba(200, 200, 200, 0.1)',
          },
        },
        yWeight: {
          type: 'linear',
          display: showWeightAxis,
          position: 'right',
          min: weightAxisRange.min,
          max: weightAxisRange.max,
          ticks: {
            display: showWeightAxis,
            font: { size: 10 },
            color: neutralAxisTickColor,
            callback: formatUniqueAxisTick,
          },
          grid: { display: false },
          border: { display: false },
        },
      },
    },
  };
}

function getCompareDetailChartConfig({
  axisRange,
  axisUnitLabel,
  compareModels,
  datasets,
  detailAxisUnitPadding,
  detailPhaseAnnotations,
  neutralAxisTickColor,
  xRange,
}) {
  return {
    type: 'line',
    compareTooltipShowDifference: false,
    phaseTooltipGroups: getComparePhaseTooltipGroups(compareModels),
    showPhaseTooltipNames: true,
    showPhaseTooltipStops: false,
    data: { datasets },
    plugins: [hoverGuidePlugin, axisUnitLabelPlugin, phaseLabelOverlayPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      layout: {
        autoPadding: false,
        padding: detailAxisUnitPadding,
      },
      elements: {
        point: createChartPointElementConfig(),
      },
      interaction: {
        mode: 'x',
        intersect: false,
      },
      plugins: {
        legend: { display: false },
        annotation: {
          clip: false,
          annotations: detailPhaseAnnotations,
        },
        axisUnitLabels: {
          yLabels: axisUnitLabel ? [{ scaleId: 'y', label: axisUnitLabel }] : [],
          xLabel: 's',
        },
        phaseLabelOverlay: {
          labels: compareModels.flatMap(({ model }) => model.phaseLabelOverlays || []),
        },
      },
      scales: {
        x: {
          type: 'linear',
          min: xRange.min,
          max: xRange.max,
          ticks: {
            font: { size: 10 },
            color: neutralAxisTickColor,
          },
          grid: {
            display: true,
            color: 'rgba(200, 200, 200, 0.08)',
          },
        },
        y: {
          type: 'linear',
          position: 'left',
          min: axisRange.min,
          max: axisRange.max,
          ticks: {
            font: { size: 10 },
            color: neutralAxisTickColor,
            callback: formatUniqueAxisTick,
          },
          grid: {
            color: 'rgba(200, 200, 200, 0.1)',
          },
        },
      },
    },
  };
}

function buildCompareDetailCharts({
  colors,
  compareModels,
  compareTargetDisplayMode,
  detailPhaseAnnotations,
  includePumpFlowWaterTooltip = false,
  neutralAxisTickColor,
  resolvedCompareStyle,
  shotStylePreset,
  visibility,
  xRange,
}) {
  return DETAIL_CHARTS.map(chart => {
    const datasets = buildDetailChartDatasets({
      chart,
      compareModels,
      colors,
      targetDisplayMode: compareTargetDisplayMode,
      visibility,
      shotStylePreset,
      compareStyle: resolvedCompareStyle,
      includePumpFlowWaterTooltip,
    });

    if (datasets.length === 0) return null;

    const axisRange = getCompareDetailAxisRange({
      chart,
      compareModels,
      datasets,
      shotStylePreset,
    });
    const axisUnitLabel = getDetailChartUnitLabel(chart);
    const detailAxisUnitPadding = getAxisUnitReservedPadding({
      yLabels: axisUnitLabel ? [{ scaleId: 'y', label: axisUnitLabel }] : [],
      xLabel: 's',
    });

    return {
      ...chart,
      config: getCompareDetailChartConfig({
        axisRange,
        axisUnitLabel,
        compareModels,
        datasets,
        detailAxisUnitPadding,
        detailPhaseAnnotations,
        neutralAxisTickColor,
        xRange,
      }),
    };
  }).filter(Boolean);
}

function getDetailEmptyStaticTooltipContent({
  activeMetricPageKey = null,
  chart,
  compareEntries,
  onMetricPageChange = null,
  shouldUseAnalyzerMobileCompareLayout,
  shouldUseStatisticsMobileCompactLayout,
}) {
  const metricLabel = chart.tooltipBaseLabel || chart.title;

  if (shouldUseStatisticsMobileCompactLayout) {
    return (
      <StatisticsChartMetricSummary
        compareEntries={compareEntries}
        metricLabel={metricLabel}
        variant='mobileCompact'
      />
    );
  }
  if (shouldUseAnalyzerMobileCompareLayout) {
    return (
      <CompareMobileMetricPreview
        activePageKey={activeMetricPageKey}
        compareEntries={compareEntries}
        metricLabel={metricLabel}
        onPageChange={onMetricPageChange}
      />
    );
  }
  return null;
}

function CompareMobileLegend({
  hiddenLegendLabels,
  isExpanded,
  hasWeightData,
  hasWeightFlowData,
  legendColorByLabel,
  onLegendToggle,
  onToggleExpanded,
  visibility,
}) {
  const handleMobileLegendToggle = label => {
    if (MOBILE_COMPARE_CONTEXT_LABEL_SET.has(label)) {
      onLegendToggle(label);
    }
  };

  return (
    <div className='shot-chart-scrubber-legend shot-chart-scrubber-legend--mobile shot-chart-scrubber-legend--compare'>
      <ShotChartLegendToggles
        labels={SHOT_CHART_PRIMARY_LEGEND_LABELS}
        hiddenLegendLabels={hiddenLegendLabels}
        hasWeightData={hasWeightData}
        hasWeightFlowData={hasWeightFlowData}
        isControlsLocked={false}
        legendColorByLabel={legendColorByLabel}
        onLegendToggle={handleMobileLegendToggle}
        visibility={visibility}
        className='contents'
      />
      <button
        type='button'
        className='shot-chart-scrubber-legend__toggle'
        onClick={onToggleExpanded}
        aria-expanded={isExpanded}
      >
        <FontAwesomeIcon
          icon={isExpanded ? faMinus : faPlus}
          className='text-xs'
          aria-hidden='true'
        />
        <span>{isExpanded ? 'Hide legend' : 'Show legend'}</span>
      </button>
      {isExpanded ? (
        <ShotChartLegendToggles
          labels={MOBILE_COMPARE_FIXED_SERIES_LABELS}
          hiddenLegendLabels={hiddenLegendLabels}
          hasWeightData={hasWeightData}
          hasWeightFlowData={hasWeightFlowData}
          isControlsLocked={false}
          legendColorByLabel={legendColorByLabel}
          onLegendToggle={handleMobileLegendToggle}
          visibility={visibility}
          className='contents'
        />
      ) : null}
    </div>
  );
}

function CompareMobileShotSwitcher({ compareShotLegendItems, onCompareSwap }) {
  if (!Array.isArray(compareShotLegendItems) || compareShotLegendItems.length === 0) return null;

  const shotItems = compareShotLegendItems.slice(0, 2);

  return (
    <div className='shot-chart-compare-mobile-shot-switcher' aria-label='Compare shots'>
      <div className='shot-chart-compare-mobile-shot-switcher__slot'>
        <CompareMobileShotSwitcherItem item={shotItems[0]} />
      </div>
      <div className='shot-chart-compare-mobile-shot-switcher__swap-slot'>
        {shotItems.length > 1 && onCompareSwap ? (
          <button
            type='button'
            className='shot-chart-compare-mobile-shot-switcher__swap'
            onClick={onCompareSwap}
            title='Swap shot 1 and shot 2'
            aria-label='Swap shot 1 and shot 2'
          >
            <FontAwesomeIcon icon={faArrowRightArrowLeft} aria-hidden='true' />
          </button>
        ) : null}
      </div>
      <div className='shot-chart-compare-mobile-shot-switcher__slot'>
        <CompareMobileShotSwitcherItem item={shotItems[1]} />
      </div>
    </div>
  );
}

function CompareMobileShotSwitcherItem({ item }) {
  if (!item) return null;

  const label = item.label || `Shot ${item.shotNumber || ''}`.trim();

  return (
    <div className='shot-chart-compare-mobile-shot-switcher__item' title={label}>
      <span
        className={[
          'analyzer-compare-shot-badge shot-chart-compare-mobile-shot-switcher__badge',
          item.shotNumber === 2 ? 'analyzer-compare-shot-badge--striped' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ '--analyzer-compare-shot-color': item.badgeColor || item.color }}
        aria-label={`Shot ${item.shotNumber || ''}`}
      >
        {item.shotNumber}
      </span>
      <span className='shot-chart-compare-mobile-shot-switcher__label'>{label}</span>
    </div>
  );
}

function CompareMobileChartControls({
  compareAlignmentMode,
  compareAlignmentOptions,
  compareTargetDisplayMode,
  onCompareAlignmentModeChange,
  onCompareTargetDisplayModeChange,
}) {
  const shouldShowAlignment =
    onCompareAlignmentModeChange &&
    Array.isArray(compareAlignmentOptions) &&
    compareAlignmentOptions.length > 0;
  const shouldShowTargets = Boolean(onCompareTargetDisplayModeChange);

  if (!shouldShowAlignment && !shouldShowTargets) return null;

  return (
    <div className='shot-chart-compare-mobile-chart-controls'>
      {shouldShowAlignment ? (
        <CompareSelect
          onChange={onCompareAlignmentModeChange}
          options={compareAlignmentOptions}
          title='Compare alignment'
          value={compareAlignmentMode}
          widthClass='w-[8.75rem] max-w-[8.75rem]'
        />
      ) : null}
      {shouldShowTargets ? (
        <CompareTargetSelect
          compareTargetDisplayMode={compareTargetDisplayMode}
          onCompareTargetDisplayModeChange={onCompareTargetDisplayModeChange}
        />
      ) : null}
    </div>
  );
}

const DETAIL_CHARTS = [
  {
    id: 'pressure',
    title: 'Pressure',
    tooltipBaseLabel: 'Pressure',
    targetTooltipBaseLabel: 'Target P',
    visibleKey: 'pressure',
    targetVisibleKey: 'targetPressure',
    seriesKey: 'pressure',
    targetSeriesKey: 'targetPressure',
    axisColorKey: 'pressure',
    beginAtZero: true,
  },
  {
    id: 'flow',
    title: 'Pump Flow',
    tooltipBaseLabel: 'Pump Flow',
    targetTooltipBaseLabel: 'Target F',
    visibleKey: 'flow',
    targetVisibleKey: 'targetFlow',
    seriesKey: 'flow',
    targetSeriesKey: 'targetFlow',
    axisColorKey: 'flow',
    beginAtZero: true,
  },
  {
    id: 'puck-flow',
    title: 'Puck Flow',
    tooltipBaseLabel: 'Puck Flow',
    targetTooltipBaseLabel: null,
    visibleKey: 'puckFlow',
    targetVisibleKey: null,
    seriesKey: 'puckFlow',
    targetSeriesKey: null,
    axisColorKey: 'puckFlow',
    beginAtZero: true,
  },
  {
    id: 'weight',
    title: 'Weight',
    tooltipBaseLabel: 'Weight',
    targetTooltipBaseLabel: null,
    visibleKey: 'weight',
    targetVisibleKey: null,
    seriesKey: 'weight',
    targetSeriesKey: null,
    axisColorKey: 'weight',
    beginAtZero: true,
  },
  {
    id: 'weight-flow',
    title: 'Weight Flow',
    tooltipBaseLabel: 'Weight Flow',
    targetTooltipBaseLabel: null,
    visibleKey: 'weightFlow',
    targetVisibleKey: null,
    seriesKey: 'weightFlow',
    targetSeriesKey: null,
    axisColorKey: 'weightFlow',
    beginAtZero: true,
  },
  {
    id: 'temperature',
    title: 'Temperature',
    tooltipBaseLabel: 'Temp',
    targetTooltipBaseLabel: 'Target T',
    visibleKey: 'temp',
    targetVisibleKey: 'targetTemp',
    seriesKey: 'temp',
    targetSeriesKey: 'targetTemp',
    axisColorKey: 'temp',
    beginAtZero: false,
  },
];

function getDetailChartUnitLabel(chart) {
  return UNIT_BY_LABEL[chart.tooltipBaseLabel] || UNIT_BY_LABEL[chart.title] || '';
}

let scratchContext = null;

function getScratchContext() {
  if (scratchContext || globalThis.document === undefined) return scratchContext;
  scratchContext = globalThis.document.createElement('canvas').getContext('2d');
  return scratchContext;
}

function resolveCanvasColor(color) {
  const ctx = getScratchContext();
  if (!ctx || !color) return color;

  try {
    ctx.fillStyle = '#000000';
    ctx.fillStyle = color;
    return ctx.fillStyle || color;
  } catch {
    return color;
  }
}

function applyColorAlpha(color, alpha) {
  const resolvedColor = resolveCanvasColor(color);
  if (!resolvedColor) return color;

  const rgbMatch = resolvedColor.match(
    /^rgba?\(\s*([0-9.]+)[,\s]+([0-9.]+)[,\s]+([0-9.]+)(?:[,\s/]+([0-9.]+))?\s*\)$/i,
  );

  if (rgbMatch) {
    const [, red, green, blue, existingAlpha] = rgbMatch;
    const nextAlpha = Math.max(
      0,
      Math.min(1, Number(existingAlpha ?? 1) * Math.max(0, Math.min(1, alpha))),
    );
    return `rgba(${red}, ${green}, ${blue}, ${nextAlpha})`;
  }

  const hex = resolvedColor.replace('#', '');
  if (hex.length === 3 || hex.length === 4) {
    const normalized = hex
      .split('')
      .map(char => `${char}${char}`)
      .join('');
    return applyColorAlpha(`#${normalized}`, alpha);
  }

  if (hex.length === 6 || hex.length === 8) {
    const red = Number.parseInt(hex.slice(0, 2), 16);
    const green = Number.parseInt(hex.slice(2, 4), 16);
    const blue = Number.parseInt(hex.slice(4, 6), 16);
    const existingAlpha = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1;
    const nextAlpha = Math.max(0, Math.min(1, existingAlpha * Math.max(0, Math.min(1, alpha))));
    return `rgba(${red}, ${green}, ${blue}, ${nextAlpha})`;
  }

  return resolvedColor;
}

function getShotStyle(index, preset = 'analyzer', compareStyle = COMPARE_STYLE_FADE) {
  const stylePreset = SHOT_STYLE_PRESETS[preset] || SHOT_STYLE_PRESETS.analyzer;
  const { opacities, lineWidths } = stylePreset;

  if (preset === 'analyzer' && compareStyle === COMPARE_STYLE_LINE_PATTERN) {
    return {
      opacity: index === 0 ? 1 : 0.92,
      lineWidth: index === 0 ? 3.4 : 3.1,
      dash: index === 0 ? [] : [10, 5],
      targetDash: index === 0 ? [6, 4] : [2, 4, 10, 4],
    };
  }

  return {
    opacity: opacities[index] ?? opacities[opacities.length - 1],
    lineWidth: lineWidths[index] ?? lineWidths[lineWidths.length - 1],
    dash: [],
    targetDash: [6, 4],
  };
}

function getComparePointStyle(isTarget = false) {
  return {
    pointRadius: 0,
    pointHoverRadius: 0,
    pointHitRadius: isTarget ? 10 : 12,
  };
}

function getDetailChartAxisScaleMode(seriesKey) {
  if (seriesKey === 'weight') return 'weight';
  if (seriesKey === 'weightFlow') return 'weightFlow';
  return undefined;
}

function formatCompareChartTitle(title) {
  if (typeof title !== 'string' || title.length === 0) return '';
  if (title.includes(' ')) return title;
  return `${title.charAt(0).toUpperCase()}${title.slice(1).toLowerCase()}`;
}

function getCompareChartLegendTitleData({ iconColor, icons, labelKey, title, variant }) {
  if (variant === 'statisticsMain') {
    return {
      displayLabel: title,
      titleIcons: Array.isArray(icons) ? icons : [],
    };
  }

  const resolvedLabelKey = labelKey || title;
  const icon = getShotChartLabelIcon(resolvedLabelKey);
  return {
    displayLabel: formatCompareChartTitle(getShotChartDisplayLabel(resolvedLabelKey)),
    titleIcons: icon ? [{ key: resolvedLabelKey, icon, color: iconColor }] : [],
  };
}

function CompareChartTitle({
  title,
  labelKey,
  variant = 'default',
  iconColor = null,
  icons = null,
}) {
  if (!title) return null;

  if (variant === 'legend' || variant === 'statisticsMain') {
    const { displayLabel, titleIcons } = getCompareChartLegendTitleData({
      iconColor,
      icons,
      labelKey,
      title,
      variant,
    });

    return (
      <div className='shot-chart-statistics-chart-title text-base-content/80 mb-2 inline-flex items-center gap-1.5 px-0.5 py-1 text-[10px] font-semibold'>
        {titleIcons.map(item => (
          <FontAwesomeIcon
            key={item.key || item.label}
            icon={item.icon}
            className='text-[10px]'
            style={item.color ? { color: item.color } : undefined}
            aria-hidden='true'
          />
        ))}
        <span>{displayLabel}</span>
      </div>
    );
  }

  return (
    <div className='text-base-content/70 mb-2 text-[11px] font-semibold tracking-wide uppercase'>
      {title}
    </div>
  );
}

function CompareMobileTooltipPlaceholder() {
  return null;
}

function CompareMobileTitleOnlyPlaceholder() {
  return null;
}

function averageFiniteValues(values) {
  const finiteValues = values.map(Number).filter(Number.isFinite);
  if (finiteValues.length === 0) return null;
  return finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length;
}

function getStatisticsMetricDefinitions(metricLabel = null) {
  const metricDefinitionsByLabel = {
    Pressure: [
      {
        key: 'peakPressure',
        label: 'Avg. Peak Pressure',
        unit: 'bar',
        color: 'var(--analyzer-pressure-text)',
        icon: faGaugeHigh,
        getValue: total => total?.p?.max,
      },
    ],
    'Pump Flow': [
      {
        key: 'flow',
        label: 'Avg. Pump Flow',
        unit: 'ml/s',
        color: 'var(--analyzer-flow-text)',
        icon: getShotChartLabelIcon('Pump Flow'),
        getValue: total => total?.f?.avg,
      },
    ],
    'Puck Flow': [
      {
        key: 'puckFlow',
        label: 'Avg. Puck Flow',
        unit: 'ml/s',
        color: 'var(--analyzer-puckflow-text)',
        icon: getShotChartLabelIcon('Puck Flow'),
        getValue: total => total?.pf?.avg,
      },
    ],
    Weight: [
      {
        key: 'weight',
        label: 'Weight',
        unit: 'g',
        color: 'var(--analyzer-weight-text)',
        icon: getShotChartLabelIcon('Weight'),
        getValue: total => total?.weight,
      },
    ],
    'Weight Flow': [
      {
        key: 'weightFlow',
        label: 'Avg. Weight Flow',
        unit: 'g/s',
        color: 'var(--analyzer-weightflow-text)',
        icon: getShotChartLabelIcon('Weight Flow'),
        getValue: total => total?.wf?.avg,
      },
    ],
    Temp: [
      {
        key: 'temperature',
        label: 'Avg. Temperature',
        unit: '\u2103',
        color: 'var(--analyzer-temp-text)',
        icon: getShotChartLabelIcon('Temperature'),
        getValue: total => total?.t?.avg,
      },
    ],
  };

  if (metricLabel) return metricDefinitionsByLabel[metricLabel] || [];

  return [
    {
      key: 'peakPressure',
      label: 'Peak Pressure',
      unit: 'bar',
      color: 'var(--analyzer-pressure-text)',
      icon: faGaugeHigh,
      getValue: total => total?.p?.max,
    },
    {
      key: 'flow',
      label: 'Pump Flow',
      unit: 'ml/s',
      color: 'var(--analyzer-flow-text)',
      icon: getShotChartLabelIcon('Pump Flow'),
      getValue: total => total?.f?.avg,
    },
  ];
}

function getStatisticsMetricSummaryRows(compareEntries, metricLabel = null) {
  const totals = compareEntries.map(entry => entry?.results?.total).filter(Boolean);
  if (totals.length === 0) return [];

  return getStatisticsMetricDefinitions(metricLabel)
    .map(definition => ({
      ...definition,
      value: averageFiniteValues(totals.map(total => definition.getValue(total))),
    }))
    .filter(row => Number.isFinite(Number(row.value)));
}

function StatisticsChartMetricSummary({ compareEntries, metricLabel = null, variant = 'desktop' }) {
  const rows = getStatisticsMetricSummaryRows(compareEntries, metricLabel);
  if (rows.length === 0) {
    return variant === 'mobileCompact' ? <CompareMobileTitleOnlyPlaceholder /> : null;
  }
  const isMobileCompact = variant === 'mobileCompact';

  return (
    <div
      className={[
        'shot-chart-statistics-metric-summary',
        isMobileCompact ? 'shot-chart-statistics-metric-summary--mobile' : '',
        isMobileCompact ? 'shot-chart-statistics-metric-summary--mobile-compact' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label='Statistics chart averages'
    >
      {rows.map(row =>
        isMobileCompact ? (
          <MobileMetricValue key={row.key} row={row} />
        ) : (
          <ChartMetricValue
            key={row.key}
            className='shot-chart-statistics-metric-summary__item'
            row={row}
          />
        ),
      )}
    </div>
  );
}

function getCompareMobileMetricRows(entry) {
  const total = entry?.results?.total;
  return [
    {
      key: 'duration',
      label: 'Duration',
      unit: 's',
      getValue: nextTotal => nextTotal?.duration,
    },
    {
      key: 'weight',
      label: 'Weight',
      unit: 'g',
      getValue: nextTotal => nextTotal?.weight,
    },
    {
      key: 'targetTemperature',
      label: 'Temp',
      unit: '\u2103',
      getValue: nextTotal => nextTotal?.tt?.avg,
    },
  ]
    .map(row => ({
      ...row,
      value: row.getValue(total),
    }))
    .filter(row => Number.isFinite(Number(row.value)));
}

function resolveCompareMobileMetricRow(entry, row) {
  const value = row.getValue(entry?.results?.total);
  return Number.isFinite(Number(value)) ? { ...row, value } : null;
}

function getCompareMobileDetailMetricDefinitions(labelKey, pageKey = null) {
  if (labelKey === 'Pump Flow') {
    const pumpFlowRow = {
      key: 'flow',
      label: 'Avg. Pump Flow',
      unit: 'ml/s',
      color: 'var(--analyzer-flow-text)',
      icon: getShotChartLabelIcon('Pump Flow'),
      getValue: total => total?.f?.avg,
    };
    const pumpedWaterRow = {
      key: 'pumpedWater',
      label: 'Pumped Water',
      unit: 'ml',
      color: 'var(--statistics-summary-water)',
      icon: getShotChartLabelIcon('Pumped Water (Total)'),
      getValue: total => total?.water,
    };

    if (pageKey === COMPARE_DETAIL_METRIC_PAGE_KEYS.PUMPED_WATER) return [pumpedWaterRow];
    return [pumpFlowRow];
  }

  const detailRowsByLabel = {
    Pressure: {
      key: 'pressure',
      label: 'Avg. Pressure',
      unit: 'bar',
      color: 'var(--analyzer-pressure-text)',
      icon: getShotChartLabelIcon('Pressure'),
      getValue: nextTotal => nextTotal?.p?.avg,
    },
    'Puck Flow': {
      key: 'puckFlow',
      label: 'Avg. Puck Flow',
      unit: 'ml/s',
      color: 'var(--analyzer-puckflow-text)',
      icon: getShotChartLabelIcon('Puck Flow'),
      getValue: nextTotal => nextTotal?.pf?.avg,
    },
    Weight: {
      key: 'weight',
      label: 'Weight',
      unit: 'g',
      color: 'var(--analyzer-weight-text)',
      icon: getShotChartLabelIcon('Weight'),
      getValue: nextTotal => nextTotal?.weight,
    },
    'Weight Flow': {
      key: 'weightFlow',
      label: 'Avg. Weight Flow',
      unit: 'g/s',
      color: 'var(--analyzer-weightflow-text)',
      icon: getShotChartLabelIcon('Weight Flow'),
      getValue: nextTotal => nextTotal?.wf?.avg,
    },
    Temp: {
      key: 'temperature',
      label: 'Avg. Temperature',
      unit: '\u2103',
      color: 'var(--analyzer-temp-text)',
      icon: getShotChartLabelIcon('Temperature'),
      getValue: nextTotal => nextTotal?.t?.avg,
    },
  };
  const row = detailRowsByLabel[labelKey];
  return row ? [row] : [];
}

function getCompareMobileDetailMetricRows(entry, labelKey, pageKey = null) {
  return getCompareMobileDetailMetricDefinitions(labelKey, pageKey)
    .map(row => resolveCompareMobileMetricRow(entry, row))
    .filter(Boolean);
}

function getCompareMobileDetailMetricPages(compareEntries, metricLabel) {
  if (metricLabel !== 'Pump Flow') return [];

  return [COMPARE_DETAIL_METRIC_PAGE_KEYS.PUMP_FLOW, COMPARE_DETAIL_METRIC_PAGE_KEYS.PUMPED_WATER]
    .map(pageKey => ({
      key: pageKey,
      previewEntries: compareEntries.slice(0, 2).map(entry => ({
        entry,
        rows: getCompareMobileDetailMetricRows(entry, metricLabel, pageKey),
      })),
    }))
    .filter(page => page.previewEntries.some(previewEntry => previewEntry.rows.length > 0));
}

function CompareMobileMetricGrid({ metricLabel = null, previewEntries }) {
  const hasMetrics = previewEntries.some(previewEntry => previewEntry.rows.length > 0);

  if (!hasMetrics) {
    return <CompareMobileTooltipPlaceholder />;
  }

  return (
    <MobileMetricGrid
      ariaLabel='Compare shot metrics'
      className={metricLabel ? 'shot-chart-compare-mobile-metrics--detail' : ''}
      entries={previewEntries.map(({ entry, rows }, index) => ({
        key: entry.key || entry.label || index,
        rows,
      }))}
    />
  );
}

function CompareMobileMetricPreview({
  activePageKey = null,
  compareEntries,
  metricLabel = null,
  onPageChange = null,
}) {
  const metricPages = metricLabel
    ? getCompareMobileDetailMetricPages(compareEntries, metricLabel)
    : [];
  const shouldUsePager = metricPages.length > 1 && typeof onPageChange === 'function';

  if (shouldUsePager) {
    const activePage =
      metricPages.find(page => page.key === activePageKey) || metricPages[0] || null;
    if (!activePage) return <CompareMobileTooltipPlaceholder />;

    return (
      <MobileMetricPager
        activePageKey={activePage.key}
        onPageChange={onPageChange}
        pages={metricPages}
        renderPage={page => (
          <CompareMobileMetricGrid metricLabel={metricLabel} previewEntries={page.previewEntries} />
        )}
      />
    );
  }

  const previewEntries = compareEntries.slice(0, 2).map(entry => ({
    entry,
    rows: metricLabel
      ? getCompareMobileDetailMetricRows(entry, metricLabel, metricPages[0]?.key || activePageKey)
      : getCompareMobileMetricRows(entry),
  }));

  return <CompareMobileMetricGrid metricLabel={metricLabel} previewEntries={previewEntries} />;
}

function getComparePhaseAlignmentOptions(compareModels) {
  const modelRows = compareModels.map(({ model }) =>
    Array.isArray(model?.phaseOverviewRows) ? model.phaseOverviewRows : [],
  );
  if (modelRows.length === 0 || modelRows.some(rows => rows.length === 0)) {
    return [{ value: COMPARE_ALIGNMENT_SHOT_START, label: 'Shot start' }];
  }

  const commonPhaseCount = Math.min(...modelRows.map(rows => rows.length));
  const referenceRows = modelRows[0] || [];
  const phaseOptions = Array.from({ length: commonPhaseCount }, (_, index) => {
    const row = referenceRows[index] || {};
    const phaseNumber = Number.isFinite(Number(row.phaseNumber))
      ? Number(row.phaseNumber)
      : index + 1;
    const phaseName = typeof row.phaseName === 'string' ? row.phaseName.trim() : '';

    return {
      value: `${COMPARE_ALIGNMENT_PHASE_PREFIX}${phaseNumber}`,
      label: formatComparePhaseAlignmentLabel(phaseNumber, phaseName),
    };
  });

  return [{ value: COMPARE_ALIGNMENT_SHOT_START, label: 'Shot start' }, ...phaseOptions];
}

function formatComparePhaseAlignmentLabel(phaseNumber, phaseName) {
  return phaseName ? `Phase ${phaseNumber}: ${phaseName}` : `Phase ${phaseNumber}`;
}

function parsePhaseAlignmentNumber(alignmentMode) {
  if (typeof alignmentMode !== 'string') return null;
  if (!alignmentMode.startsWith(COMPARE_ALIGNMENT_PHASE_PREFIX)) return null;
  const phaseNumber = Number(alignmentMode.slice(COMPARE_ALIGNMENT_PHASE_PREFIX.length));
  return Number.isFinite(phaseNumber) && phaseNumber > 0 ? phaseNumber : null;
}

function findPhaseRowIndex(rows, phaseNumber) {
  if (!Array.isArray(rows)) return -1;
  const byNumberIndex = rows.findIndex(row => Number(row?.phaseNumber) === phaseNumber);
  if (byNumberIndex >= 0) return byNumberIndex;
  const byPositionIndex = phaseNumber - 1;
  return byPositionIndex >= 0 && byPositionIndex < rows.length ? byPositionIndex : -1;
}

function resolvePhaseAlignmentOffset(model, alignmentMode) {
  const phaseNumber = parsePhaseAlignmentNumber(alignmentMode);
  if (!phaseNumber) return 0;

  const rows = Array.isArray(model?.phaseOverviewRows) ? model.phaseOverviewRows : [];
  const phaseIndex = findPhaseRowIndex(rows, phaseNumber);
  if (phaseIndex < 0) return 0;

  for (let index = phaseIndex; index < rows.length; index += 1) {
    const row = rows[index];
    const start = Number(row?.start);
    if (row?.skipped === true || !Number.isFinite(start)) continue;
    return start;
  }

  return 0;
}

function shiftPointX(point, xOffset) {
  if (!point || typeof point !== 'object') return point;
  const x = Number(point.x);
  if (!Number.isFinite(x)) return point;
  return { ...point, x: x - xOffset };
}

function shiftSeriesMap(series, xOffset) {
  if (!series || typeof series !== 'object' || xOffset === 0) return series;

  return Object.fromEntries(
    Object.entries(series).map(([key, points]) => [
      key,
      Array.isArray(points) ? points.map(point => shiftPointX(point, xOffset)) : points,
    ]),
  );
}

function shiftOptionalXValue(value, xOffset) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue - xOffset : value;
}

function shiftAnnotationX(annotation, xOffset) {
  if (!annotation || typeof annotation !== 'object' || xOffset === 0) return annotation;

  const nextAnnotation = { ...annotation };
  ['value', 'xValue', 'xMin', 'xMax'].forEach(key => {
    if (Number.isFinite(Number(nextAnnotation[key]))) {
      nextAnnotation[key] = Number(nextAnnotation[key]) - xOffset;
    }
  });
  return nextAnnotation;
}

function shiftAnnotationMap(annotations, xOffset) {
  if (!annotations || typeof annotations !== 'object' || xOffset === 0) return annotations;
  return Object.fromEntries(
    Object.entries(annotations).map(([key, annotation]) => [
      key,
      shiftAnnotationX(annotation, xOffset),
    ]),
  );
}

function shiftPhaseRows(rows, xOffset) {
  if (!Array.isArray(rows) || xOffset === 0) return rows;
  return rows.map(row => ({
    ...row,
    start: shiftOptionalXValue(row?.start, xOffset),
    end: shiftOptionalXValue(row?.end, xOffset),
  }));
}

function shiftOverlayX(overlays, xOffset) {
  if (!Array.isArray(overlays) || xOffset === 0) return overlays;
  return overlays.map(overlay => ({
    ...overlay,
    xValue: shiftOptionalXValue(overlay?.xValue, xOffset),
  }));
}

function getModelMinTime(model) {
  const sampleTimes = Array.isArray(model?.sampleTimesSec) ? model.sampleTimesSec : [];
  const firstSampleTime = sampleTimes.find(time => Number.isFinite(Number(time)));
  if (Number.isFinite(Number(firstSampleTime))) return Number(firstSampleTime);

  const seriesPoints = Object.values(model?.series || {}).flatMap(points =>
    Array.isArray(points) ? points : [],
  );
  const firstPoint = seriesPoints.find(point => Number.isFinite(Number(point?.x)));
  return Number.isFinite(Number(firstPoint?.x)) ? Number(firstPoint.x) : 0;
}

function alignCompareModel(model, alignmentMode) {
  const xOffset = resolvePhaseAlignmentOffset(model, alignmentMode);
  if (!xOffset) {
    return {
      ...model,
      compareAlignmentOffset: 0,
      minTime: getModelMinTime(model),
    };
  }

  const originalWaterGetter = model.getHoverWaterValuesAtX;
  return {
    ...model,
    compareAlignmentOffset: xOffset,
    minTime: getModelMinTime(model) - xOffset,
    maxTime: Number(model.maxTime || 0) - xOffset,
    shotStartSec: Number(model.shotStartSec || 0) - xOffset,
    sampleTimesSec: Array.isArray(model.sampleTimesSec)
      ? model.sampleTimesSec.map(time => Number(time) - xOffset)
      : model.sampleTimesSec,
    series: shiftSeriesMap(model.series, xOffset),
    phaseAnnotations: shiftAnnotationMap(model.phaseAnnotations, xOffset),
    tempPhaseAnnotations: shiftAnnotationMap(model.tempPhaseAnnotations, xOffset),
    phaseLabelOverlays: shiftOverlayX(model.phaseLabelOverlays, xOffset),
    stopIconOverlays: shiftOverlayX(model.stopIconOverlays, xOffset),
    phaseOverviewRows: shiftPhaseRows(model.phaseOverviewRows, xOffset),
    getHoverWaterValuesAtX:
      typeof originalWaterGetter === 'function'
        ? xValue => originalWaterGetter(Number(xValue) + xOffset)
        : originalWaterGetter,
  };
}

function getCompareXRange(compareModels) {
  const min = Math.min(0, ...compareModels.map(({ model }) => Number(model?.minTime || 0)));
  const max = Math.max(1, ...compareModels.map(({ model }) => Number(model?.maxTime || 0)));
  return max <= min ? { min: 0, max: 1 } : { min, max };
}

function shouldShowTargetsForEntry({ entry, targetDisplayMode }) {
  if (targetDisplayMode === COMPARE_TARGET_DISPLAY_MODES.NONE) {
    return false;
  }

  if (targetDisplayMode === COMPARE_TARGET_DISPLAY_MODES.MAIN_SHOT_ONLY) {
    return entry.isReference;
  }

  return true;
}

function cloneCompareAnnotation(annotation, { ghosted = false } = {}) {
  if (!annotation) return annotation;

  const labelXAdjust = Number(annotation.label?.xAdjust) || 0;

  return {
    ...annotation,
    borderColor: annotation.borderColor,
    label: annotation.label
      ? {
          ...annotation.label,
          position: ghosted ? 'end' : annotation.label.position,
          xAdjust: labelXAdjust,
          yAdjust: Number(annotation.label.yAdjust) || 0,
          color: annotation.label.color,
          backgroundColor: annotation.label.backgroundColor,
          borderColor: annotation.label.borderColor,
          borderWidth: annotation.label.borderWidth,
          font: annotation.label.font,
        }
      : annotation.label,
  };
}

function prefixCompareAnnotations(
  annotations,
  prefix,
  { ghosted = false, startLabelSuffix = null } = {},
) {
  if (!annotations) return {};

  return Object.fromEntries(
    Object.entries(annotations).map(([key, annotation]) => {
      const nextAnnotation = cloneCompareAnnotation(annotation, { ghosted });
      const isPhaseSeparator =
        key === 'shot_start' || key === 'shot_end' || key.startsWith('phase_line_');

      if (isPhaseSeparator && nextAnnotation) {
        nextAnnotation.display = true;
        nextAnnotation.borderWidth = nextAnnotation.borderWidth || 1;
        nextAnnotation.borderColor =
          nextAnnotation.borderColor === 'transparent' || !nextAnnotation.borderColor
            ? 'rgba(107, 114, 128, 0.5)'
            : nextAnnotation.borderColor;
      }

      if (key === 'shot_start' && startLabelSuffix && nextAnnotation?.label?.content) {
        nextAnnotation.label = {
          ...nextAnnotation.label,
          content: `${nextAnnotation.label.content} ${startLabelSuffix}`,
        };
      }

      return [`${prefix}_${key}`, nextAnnotation];
    }),
  );
}

function collectVisibleYValues(datasets) {
  return datasets.flatMap(dataset =>
    (dataset.data || []).map(point => Number(point?.y)).filter(value => Number.isFinite(value)),
  );
}

function getStatisticsAxisPercentile(datasetCount, axisScaleMode) {
  if (axisScaleMode === 'weightFlow') {
    if (datasetCount >= 20) return 0.68;
    if (datasetCount >= 12) return 0.74;
    if (datasetCount >= 8) return 0.78;
    return 0.84;
  }

  if (datasetCount >= 20) return 0.72;
  if (datasetCount >= 12) return 0.78;
  if (datasetCount >= 8) return 0.82;
  return 0.88;
}

function getDetailChartRangeOptions({ shotStylePreset, chartId, compareModelCount }) {
  if (shotStylePreset !== 'statistics') {
    return {
      paddingRatio: 0.05,
      minimumPadding: 0.2,
      maxStrategy: 'absolute',
      maxPercentile: 0.9,
    };
  }

  if (chartId === 'weight') {
    return {
      paddingRatio: 0.08,
      minimumPadding: 1.5,
      maxStrategy: 'datasetPercentile',
      maxPercentile: getStatisticsAxisPercentile(compareModelCount, 'weight'),
    };
  }

  if (chartId === 'weight-flow') {
    return {
      paddingRatio: 0.06,
      minimumPadding: 0.25,
      maxStrategy: 'datasetPercentile',
      maxPercentile: getStatisticsAxisPercentile(compareModelCount, 'weightFlow'),
    };
  }

  return {
    paddingRatio: 0.05,
    minimumPadding: 0.2,
    maxStrategy: 'absolute',
    maxPercentile: 0.9,
  };
}

function getDetailChartHeight(isFullDisplay) {
  if (isFullDisplay) {
    const viewportHeight = getCompareFullDisplayViewportHeight();
    if (viewportHeight > 0 && viewportHeight < 560) return 190;
    if (viewportHeight > 0 && viewportHeight < 760) return DETAIL_CHART_HEIGHT_BIG;
    return DETAIL_CHART_HEIGHT_FULL;
  }
  return DETAIL_CHART_HEIGHT_SMALL;
}

function getCompareTooltipPlugin({
  enableHoverInfo,
  compareTooltipMode,
  hideExternalTooltip,
  setExternalTooltipState,
  phaseTooltipGroups = [],
  showPhaseNames = true,
  showStops = true,
}) {
  const baseTooltipConfig = {
    enabled: false,
    caretSize: 0,
    caretPadding: 0,
  };

  if (!enableHoverInfo) {
    return baseTooltipConfig;
  }

  return {
    ...baseTooltipConfig,
    external: ({ chart, tooltip }) => {
      const nextState = buildExternalTooltipState({
        chart,
        tooltip,
        tooltipMode: compareTooltipMode,
        phaseTooltipGroups,
        showPhaseNames,
        showStops,
      });

      if (!nextState.visible) {
        hideExternalTooltip();
        return;
      }

      setExternalTooltipState(prev => (areTooltipStatesEqual(prev, nextState) ? prev : nextState));
    },
  };
}

function getDatasetScaleMax(dataset) {
  const values = (dataset?.data || [])
    .map(point => Number(point?.y))
    .filter(value => Number.isFinite(value));
  if (values.length === 0) return null;

  if (dataset?.axisScaleMode === 'weight' || dataset?.axisScaleMode === 'weightFlow') {
    return getSpikeResistantSeriesMax(dataset.data, {
      fallback: 0,
      seriesKind: dataset.axisScaleMode,
    });
  }

  return Math.max(...values);
}

function getAxisScaleMax({
  datasets,
  fallbackMax = 1,
  maxStrategy = 'absolute',
  maxPercentile = 0.9,
}) {
  const datasetScaleMaxima = datasets
    .map(getDatasetScaleMax)
    .filter(value => Number.isFinite(value));

  if (datasetScaleMaxima.length === 0) {
    return fallbackMax;
  }

  const max =
    maxStrategy === 'datasetPercentile'
      ? getPercentileValue(datasetScaleMaxima, maxPercentile)
      : Math.max(...datasetScaleMaxima);

  return Number.isFinite(max) ? max : Math.max(...datasetScaleMaxima);
}

function getAxisRange({
  datasets,
  beginAtZero = true,
  fallbackMin = 0,
  fallbackMax = 1,
  paddingRatio = 0.05,
  minimumPadding = 0.2,
  maxStrategy = 'absolute',
  maxPercentile = 0.9,
}) {
  const values = collectVisibleYValues(datasets);
  if (values.length === 0) {
    return { min: fallbackMin, max: fallbackMax };
  }

  let min = Math.min(...values);
  let max = getAxisScaleMax({
    datasets,
    fallbackMax,
    maxStrategy,
    maxPercentile,
  });

  if (beginAtZero) {
    min = 0;
  }

  if (!Number.isFinite(max)) {
    max = Math.max(...values);
  }

  if (max <= min) {
    max = min + 1;
  }

  const padding = Math.max((max - min) * paddingRatio, minimumPadding);

  return {
    min,
    max: max + padding,
  };
}

function getStatisticsMainChartWeightAxisRange({
  weightDatasets,
  mainDatasets,
  mainAxisRange,
  weightMaxPercentile,
}) {
  const baseWeightScaleMax = getAxisScaleMax({
    datasets: weightDatasets,
    fallbackMax: 50,
    maxStrategy: 'datasetPercentile',
    maxPercentile: weightMaxPercentile,
  });

  const referenceDatasets = mainDatasets.filter(
    dataset => dataset.yAxisID === 'yMain' && dataset.axisScaleMode !== 'weightFlow',
  );
  const referenceScaleMax = getAxisScaleMax({
    datasets: referenceDatasets,
    fallbackMax: mainAxisRange.max || 12,
    maxStrategy: 'datasetPercentile',
    maxPercentile: 0.85,
  });

  // Statistics keeps weight visible in the overview, but the main chart should
  // still read primarily as a pressure/flow comparison. This caps how dominant
  // the weight axis may become relative to the main axis family.
  const desiredRatio = Math.min(
    0.6,
    Math.max(0.42, referenceScaleMax / Math.max(1, mainAxisRange.max || 1)),
  );
  const adjustedWeightMax = Math.max(baseWeightScaleMax / desiredRatio, baseWeightScaleMax * 1.08);
  const padding = Math.max(adjustedWeightMax * 0.04, 0.6);

  return {
    min: 0,
    max: adjustedWeightMax + padding,
  };
}

function clearCompareChartHover(chart) {
  if (!chart) return;
  chart.$fixedTooltipPointerY = null;
  chart.$fixedTooltipPointerX = null;
  chart.$fixedTooltipXValue = null;
  chart.setActiveElements([]);
  chart.tooltip?.setActiveElements([], { x: 0, y: 0 });
  chart.update('none');
}

function findClosestPointIndex(datasetData, xValue) {
  if (!Array.isArray(datasetData) || datasetData.length === 0 || !Number.isFinite(xValue)) {
    return -1;
  }

  let low = 0;
  let high = datasetData.length - 1;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const midX = Number(datasetData[mid]?.x);

    if (!Number.isFinite(midX) || midX < xValue) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  const candidateIndexes = [low - 1, low, low + 1];
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;

  candidateIndexes.forEach(index => {
    if (index < 0 || index >= datasetData.length) return;
    const point = datasetData[index];
    const pointX = Number(point?.x);
    const pointY = Number(point?.y);
    if (!Number.isFinite(pointX) || !Number.isFinite(pointY)) return;

    const distance = Math.abs(pointX - xValue);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function buildCompareActiveElements(chart, xValue) {
  if (!chart || !Number.isFinite(xValue)) return [];

  return chart.data.datasets.reduce((active, dataset, datasetIndex) => {
    const meta = chart.getDatasetMeta(datasetIndex);
    if (!meta || meta.hidden || dataset?.hidden || !chart.isDatasetVisible(datasetIndex)) {
      return active;
    }

    const pointIndex = findClosestPointIndex(dataset?.data, xValue);
    if (pointIndex >= 0) {
      active.push({ datasetIndex, index: pointIndex });
    }
    return active;
  }, []);
}

function getDatasetEndX(dataset) {
  const points = Array.isArray(dataset?.data) ? dataset.data : [];
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const pointX = Number(points[index]?.x);
    const pointY = Number(points[index]?.y);
    if (Number.isFinite(pointX) && Number.isFinite(pointY)) return pointX;
  }
  return Number.NEGATIVE_INFINITY;
}

function resolveCompareTitleOnlyDatasetIndex(chart) {
  if (!chart) return -1;
  const cachedIndex = Number(chart.$compareTitleOnlyDatasetIndex);
  if (Number.isInteger(cachedIndex)) {
    const cachedDataset = chart.data.datasets[cachedIndex];
    const cachedMeta = chart.getDatasetMeta(cachedIndex);
    if (
      cachedDataset &&
      cachedMeta &&
      !cachedMeta.hidden &&
      !cachedDataset.hidden &&
      chart.isDatasetVisible(cachedIndex)
    ) {
      return cachedIndex;
    }
  }

  let bestCandidate = null;

  chart.data.datasets.forEach((dataset, datasetIndex) => {
    const meta = chart.getDatasetMeta(datasetIndex);
    if (!meta || meta.hidden || dataset?.hidden || !chart.isDatasetVisible(datasetIndex)) return;

    const endX = getDatasetEndX(dataset);
    if (!bestCandidate || endX > bestCandidate.endX) {
      bestCandidate = { datasetIndex, endX };
    }
  });

  chart.$compareTitleOnlyDatasetIndex = bestCandidate?.datasetIndex ?? -1;
  return chart.$compareTitleOnlyDatasetIndex;
}

function buildCompareTitleOnlyActiveElements(chart, xValue) {
  if (!chart || !Number.isFinite(xValue)) return [];

  const datasetIndex = resolveCompareTitleOnlyDatasetIndex(chart);
  if (datasetIndex < 0) return [];

  const pointIndex = findClosestPointIndex(chart.data.datasets[datasetIndex]?.data, xValue);
  return pointIndex >= 0 ? [{ datasetIndex, index: pointIndex }] : [];
}

function resolveCompareHoverGeometry(chart, clientX, clientY) {
  const xScale = chart?.scales?.x;
  if (!chart?.canvas || !chart?.chartArea || !xScale || !Number.isFinite(clientX)) return null;

  const chartRect = chart.canvas.getBoundingClientRect();
  const minClientX = chartRect.left + chart.chartArea.left;
  const maxClientX = chartRect.left + chart.chartArea.right;
  const clampedClientX = Math.min(maxClientX, Math.max(minClientX, clientX));
  const sourceX = clampedClientX - chartRect.left;
  const xValue = xScale.getValueForPixel(sourceX);

  if (!Number.isFinite(xValue)) return null;

  const xPixel = xScale.getPixelForValue(xValue);
  const minClientY = chartRect.top + chart.chartArea.top;
  const maxClientY = chartRect.top + chart.chartArea.bottom;
  const clampedClientY = Number.isFinite(clientY)
    ? Math.min(maxClientY, Math.max(minClientY, clientY))
    : minClientY;

  return {
    xValue,
    xPixel: Number.isFinite(xPixel) ? xPixel : chart.chartArea.left + 8,
    tooltipY: clampedClientY - chartRect.top,
  };
}

function applyCompareTitleOnlyHover(chart, clientX, clientY, setExternalTooltipState) {
  const hoverGeometry = resolveCompareHoverGeometry(chart, clientX, clientY);
  if (!hoverGeometry) {
    clearCompareChartHover(chart);
    return;
  }

  const { xValue, xPixel, tooltipY } = hoverGeometry;
  chart.$fixedTooltipPointerX = xPixel;
  chart.$fixedTooltipPointerY = tooltipY;
  chart.$fixedTooltipXValue = xValue;
  chart.setActiveElements([]);
  chart.tooltip?.setActiveElements([], { x: 0, y: 0 });
  chart.draw();

  const nextState = {
    visible: true,
    titleLines: [`${xValue.toFixed(2)} s`],
    phaseSummaries: [],
    rows: [],
    anchorX: xPixel,
    anchorY: tooltipY,
    chartWidth: chart.width,
    chartHeight: chart.height,
    chartAreaLeft: chart.chartArea.left,
    chartAreaRight: chart.chartArea.right,
    chartAreaTop: chart.chartArea.top,
    chartAreaBottom: chart.chartArea.bottom,
  };

  setExternalTooltipState(prev => (areTooltipStatesEqual(prev, nextState) ? prev : nextState));
}

function applyCompareHover(chart, clientX, clientY, { titleOnly = false } = {}) {
  const hoverGeometry = resolveCompareHoverGeometry(chart, clientX, clientY);
  if (!hoverGeometry) {
    clearCompareChartHover(chart);
    return;
  }
  const { xValue, xPixel, tooltipY } = hoverGeometry;

  // Build hover state from the shared x-position so every visible compare
  // series contributes a single aligned point instead of relying on Chart.js'
  // nearest-dataset heuristics. Statistics title-only tooltips only need one
  // representative point to make Chart.js invoke the external tooltip.
  const active = titleOnly
    ? buildCompareTitleOnlyActiveElements(chart, xValue)
    : buildCompareActiveElements(chart, xValue);
  if (!active.length) {
    clearCompareChartHover(chart);
    return;
  }

  chart.$fixedTooltipPointerX = xPixel;
  chart.$fixedTooltipPointerY = tooltipY;
  chart.$fixedTooltipXValue = xValue;
  chart.setActiveElements(active);
  chart.tooltip?.setActiveElements(active, {
    x: xPixel,
    y: tooltipY,
  });
  chart.update('none');
}

function applyCompareHoverAtX(chart, xValue, { titleOnly = false } = {}) {
  const xScale = chart?.scales?.x;
  if (!chart?.canvas || !chart?.chartArea || !xScale || !Number.isFinite(Number(xValue))) {
    clearCompareChartHover(chart);
    return;
  }

  const xPixel = xScale.getPixelForValue(Number(xValue));
  if (!Number.isFinite(xPixel)) {
    clearCompareChartHover(chart);
    return;
  }

  const chartRect = chart.canvas.getBoundingClientRect();
  const chartAreaHeight = Number(chart.chartArea.bottom) - Number(chart.chartArea.top);
  const clientY =
    chartRect.top +
    chart.chartArea.top +
    (Number.isFinite(chartAreaHeight) && chartAreaHeight > 0 ? chartAreaHeight / 2 : 0);

  applyCompareHover(chart, chartRect.left + xPixel, clientY, { titleOnly });
}

function buildCompareLegendItems(compareEntries, colors, shotStylePreset, compareStyle) {
  return compareEntries.map((entry, index) => {
    const shotStyle = getShotStyle(index, shotStylePreset, compareStyle);
    const accentColor = getCompareLegendAccentColor(entry);

    return {
      label: entry.label,
      color: accentColor || applyColorAlpha(colors.phaseLine, shotStyle.opacity),
      badgeColor:
        entry.accentColor || accentColor || applyColorAlpha(colors.phaseLine, shotStyle.opacity),
      lineWidth: shotStyle.lineWidth,
      dash: shotStyle.dash,
      shotNumber: index + 1,
    };
  });
}

function getCompareLegendAccentColor(entry) {
  if (!entry.accentColor) return null;
  const accentStrength = Number.isFinite(Number(entry.accentStrength))
    ? Number(entry.accentStrength)
    : 1;
  if (accentStrength >= 1) return entry.accentColor;
  return `color-mix(in srgb, ${entry.accentColor} ${Math.round(
    accentStrength * 100,
  )}%, transparent)`;
}

function buildMainPressureDatasetSpecs({
  entry,
  model,
  visibility,
  colors,
  shotStyle,
  showTargets,
  compareDatasetMeta,
}) {
  return [
    visibility.pressure && model.series.pressure.length > 0
      ? {
          label: `${entry.label} Pressure`,
          compareTooltipBaseLabel: 'Pressure',
          data: model.series.pressure,
          borderColor: applyColorAlpha(colors.pressure, shotStyle.opacity),
          backgroundColor: applyColorAlpha(colors.pressure, shotStyle.opacity),
          yAxisID: 'yMain',
          borderWidth: shotStyle.lineWidth,
          borderDash: shotStyle.dash,
          tension: 0.2,
          ...getComparePointStyle(false),
          ...compareDatasetMeta,
        }
      : null,
    visibility.targetPressure && showTargets && model.series.targetPressure.length > 0
      ? {
          label: `${entry.label} Target Pressure`,
          compareTooltipBaseLabel: 'Target P',
          data: model.series.targetPressure,
          borderColor: applyColorAlpha(colors.pressure, Math.max(0.26, shotStyle.opacity * 0.72)),
          backgroundColor: 'transparent',
          yAxisID: 'yMain',
          borderWidth: Math.max(1.2, shotStyle.lineWidth - 1.2),
          borderDash: shotStyle.targetDash,
          tension: 0,
          order: entry.isReference ? -10 : -20,
          ...getComparePointStyle(true),
          ...compareDatasetMeta,
        }
      : null,
  ];
}

function buildMainFlowDatasetSpecs({
  entry,
  model,
  visibility,
  colors,
  shotStyle,
  showTargets,
  compareDatasetMeta,
}) {
  return [
    visibility.flow && model.series.flow.length > 0
      ? {
          label: `${entry.label} Pump Flow`,
          compareTooltipBaseLabel: 'Pump Flow',
          data: model.series.flow,
          borderColor: applyColorAlpha(colors.flow, shotStyle.opacity),
          backgroundColor: applyColorAlpha(colors.flow, shotStyle.opacity),
          yAxisID: 'yMain',
          borderWidth: shotStyle.lineWidth,
          borderDash: shotStyle.dash,
          tension: 0.2,
          ...getComparePointStyle(false),
          ...compareDatasetMeta,
        }
      : null,
    visibility.targetFlow && showTargets && model.series.targetFlow.length > 0
      ? {
          label: `${entry.label} Target Pump Flow`,
          compareTooltipBaseLabel: 'Target F',
          data: model.series.targetFlow,
          borderColor: applyColorAlpha(colors.flow, Math.max(0.26, shotStyle.opacity * 0.72)),
          backgroundColor: 'transparent',
          yAxisID: 'yMain',
          borderWidth: Math.max(1.2, shotStyle.lineWidth - 1.2),
          borderDash: shotStyle.targetDash,
          tension: 0,
          order: entry.isReference ? -10 : -20,
          ...getComparePointStyle(true),
          ...compareDatasetMeta,
        }
      : null,
    visibility.puckFlow && model.series.puckFlow.length > 0
      ? {
          label: `${entry.label} Puck Flow`,
          compareTooltipBaseLabel: 'Puck Flow',
          data: model.series.puckFlow,
          borderColor: applyColorAlpha(colors.puckFlow, shotStyle.opacity),
          backgroundColor: applyColorAlpha(colors.puckFlow, shotStyle.opacity),
          yAxisID: 'yMain',
          borderWidth: Math.max(1.2, shotStyle.lineWidth - 0.8),
          borderDash: shotStyle.dash,
          tension: 0.2,
          ...getComparePointStyle(false),
          ...compareDatasetMeta,
        }
      : null,
  ];
}

function buildMainWeightDatasetSpecs({
  entry,
  model,
  visibility,
  colors,
  shotStyle,
  compareDatasetMeta,
  showWeightInMainChart,
  showWeightFlowInMainChart,
}) {
  return [
    showWeightInMainChart && visibility.weight && model.series.weight.length > 0
      ? {
          label: `${entry.label} Weight`,
          compareTooltipBaseLabel: 'Weight',
          data: model.series.weight,
          axisScaleMode: 'weight',
          borderColor: applyColorAlpha(colors.weight, shotStyle.opacity),
          backgroundColor: applyColorAlpha(colors.weight, shotStyle.opacity),
          yAxisID: 'yWeight',
          borderWidth: shotStyle.lineWidth,
          borderDash: shotStyle.dash,
          tension: 0.2,
          ...getComparePointStyle(false),
          ...compareDatasetMeta,
        }
      : null,
    showWeightFlowInMainChart && visibility.weightFlow && model.series.weightFlow.length > 0
      ? {
          label: `${entry.label} Weight Flow`,
          compareTooltipBaseLabel: 'Weight Flow',
          data: model.series.weightFlow,
          axisScaleMode: 'weightFlow',
          borderColor: applyColorAlpha(colors.weightFlow, shotStyle.opacity),
          backgroundColor: applyColorAlpha(colors.weightFlow, shotStyle.opacity),
          yAxisID: 'yMain',
          borderWidth: Math.max(1.2, shotStyle.lineWidth - 0.8),
          borderDash: shotStyle.dash,
          tension: 0.2,
          ...getComparePointStyle(false),
          ...compareDatasetMeta,
        }
      : null,
  ];
}

function buildMainChartDatasetSpecs({
  entry,
  model,
  visibility,
  colors,
  shotStyle,
  showTargets,
  compareDatasetMeta,
  showWeightInMainChart,
  showWeightFlowInMainChart,
}) {
  return [
    ...buildMainPressureDatasetSpecs({
      entry,
      model,
      visibility,
      colors,
      shotStyle,
      showTargets,
      compareDatasetMeta,
    }),
    ...buildMainFlowDatasetSpecs({
      entry,
      model,
      visibility,
      colors,
      shotStyle,
      showTargets,
      compareDatasetMeta,
    }),
    ...buildMainWeightDatasetSpecs({
      entry,
      model,
      visibility,
      colors,
      shotStyle,
      compareDatasetMeta,
      showWeightInMainChart,
      showWeightFlowInMainChart,
    }),
  ].filter(Boolean);
}

function buildDetailChartDatasetSpecs({
  chart,
  entry,
  actualSeries,
  targetSeries,
  baseColor,
  shotStyle,
  compareDatasetMeta,
  visibility,
  showTargets,
}) {
  return [
    visibility[chart.visibleKey] && actualSeries.length > 0
      ? {
          label: `${entry.label} ${chart.title}`,
          compareTooltipBaseLabel: chart.tooltipBaseLabel,
          data: actualSeries,
          axisScaleMode: getDetailChartAxisScaleMode(chart.seriesKey),
          borderColor: applyColorAlpha(baseColor, shotStyle.opacity),
          backgroundColor: applyColorAlpha(baseColor, shotStyle.opacity),
          borderWidth: shotStyle.lineWidth,
          borderDash: shotStyle.dash,
          tension: 0.2,
          ...getComparePointStyle(false),
          ...compareDatasetMeta,
        }
      : null,
    showTargets && targetSeries.length > 0
      ? {
          label: `${entry.label} ${chart.title} Target`,
          compareTooltipBaseLabel: chart.targetTooltipBaseLabel,
          data: targetSeries,
          borderColor: applyColorAlpha(baseColor, Math.max(0.26, shotStyle.opacity * 0.72)),
          backgroundColor: 'transparent',
          borderWidth: Math.max(1.2, shotStyle.lineWidth - 1.2),
          borderDash: shotStyle.targetDash,
          tension: 0,
          order: entry.isReference ? -10 : -20,
          ...getComparePointStyle(true),
          ...compareDatasetMeta,
        }
      : null,
  ].filter(Boolean);
}

function buildMainChartDatasets({
  compareModels,
  colors,
  visibility,
  targetDisplayMode,
  shotStylePreset,
  compareStyle,
  showWeightInMainChart = true,
  showWeightFlowInMainChart = true,
}) {
  return compareModels.flatMap(({ entry, model }, index) => {
    const shotStyle = getShotStyle(index, shotStylePreset, compareStyle);
    const showTargets = shouldShowTargetsForEntry({
      entry,
      targetDisplayMode,
    });
    const compareDatasetMeta = {
      compareTooltipShotLabel: entry.label,
      compareTooltipShotOrder: index,
      compareTooltipGetHoverWaterValuesAtX: model.getHoverWaterValuesAtX,
    };
    return buildMainChartDatasetSpecs({
      entry,
      model,
      visibility,
      colors,
      shotStyle,
      showTargets,
      compareDatasetMeta,
      showWeightInMainChart,
      showWeightFlowInMainChart,
    });
  });
}

function buildDetailChartDatasets({
  chart,
  compareModels,
  colors,
  includePumpFlowWaterTooltip = false,
  targetDisplayMode,
  visibility,
  shotStylePreset,
  compareStyle,
}) {
  return compareModels.flatMap(({ entry, model }, index) => {
    const shotStyle = getShotStyle(index, shotStylePreset, compareStyle);
    const actualSeries = model.series[chart.seriesKey] || [];
    const targetSeries = chart.targetSeriesKey ? model.series[chart.targetSeriesKey] || [] : [];
    const baseColor = colors[chart.axisColorKey];
    const showTargets =
      chart.targetSeriesKey &&
      chart.targetVisibleKey &&
      shouldShowTargetsForEntry({
        entry,
        targetDisplayMode,
      });
    const compareDatasetMeta = {
      compareTooltipShotLabel: entry.label,
      compareTooltipShotOrder: index,
      compareTooltipGetHoverWaterValuesAtX:
        includePumpFlowWaterTooltip && chart.tooltipBaseLabel === 'Pump Flow'
          ? model.getHoverWaterValuesAtX
          : null,
    };
    return buildDetailChartDatasetSpecs({
      chart,
      entry,
      actualSeries,
      targetSeries,
      baseColor,
      shotStyle,
      compareDatasetMeta,
      visibility: { ...visibility, [chart.visibleKey]: true },
      showTargets,
    });
  });
}

function createCompareChartConfig(
  config,
  { enableHoverInfo, compareTooltipMode, hideExternalTooltip, setExternalTooltipState },
) {
  const { phaseTooltipGroups, showPhaseTooltipNames, showPhaseTooltipStops, ...chartConfig } =
    config;

  return {
    ...chartConfig,
    options: {
      ...chartConfig.options,
      events: [],
      plugins: {
        ...chartConfig.options?.plugins,
        tooltip: getCompareTooltipPlugin({
          enableHoverInfo,
          compareTooltipMode,
          hideExternalTooltip,
          setExternalTooltipState,
          phaseTooltipGroups,
          showPhaseNames: showPhaseTooltipNames,
          showStops: showPhaseTooltipStops,
        }),
      },
    },
  };
}

function addCompareHoverListeners(
  hoverSurface,
  supportsPointerEvents,
  handleHoverMove,
  clearHover,
) {
  if (supportsPointerEvents) {
    hoverSurface.addEventListener('pointerdown', handleHoverMove, { passive: true });
    hoverSurface.addEventListener('pointermove', handleHoverMove, { passive: true });
    hoverSurface.addEventListener('pointerup', clearHover);
    hoverSurface.addEventListener('pointerleave', clearHover);
    hoverSurface.addEventListener('pointercancel', clearHover);
    return;
  }

  hoverSurface.addEventListener('mousemove', handleHoverMove);
  hoverSurface.addEventListener('mouseleave', clearHover);
  hoverSurface.addEventListener('touchstart', handleHoverMove, { passive: true });
  hoverSurface.addEventListener('touchmove', handleHoverMove, { passive: true });
  hoverSurface.addEventListener('touchend', clearHover);
  hoverSurface.addEventListener('touchcancel', clearHover);
}

function removeCompareHoverListeners(
  hoverSurface,
  supportsPointerEvents,
  handleHoverMove,
  clearHover,
) {
  if (supportsPointerEvents) {
    hoverSurface.removeEventListener('pointerdown', handleHoverMove);
    hoverSurface.removeEventListener('pointermove', handleHoverMove);
    hoverSurface.removeEventListener('pointerup', clearHover);
    hoverSurface.removeEventListener('pointerleave', clearHover);
    hoverSurface.removeEventListener('pointercancel', clearHover);
    return;
  }

  hoverSurface.removeEventListener('mousemove', handleHoverMove);
  hoverSurface.removeEventListener('mouseleave', clearHover);
  hoverSurface.removeEventListener('touchstart', handleHoverMove);
  hoverSurface.removeEventListener('touchmove', handleHoverMove);
  hoverSurface.removeEventListener('touchend', clearHover);
  hoverSurface.removeEventListener('touchcancel', clearHover);
}

function getCompareWeightAxisRange({
  shotStylePreset,
  weightDatasets,
  mainDatasets,
  mainAxisRange,
  compareModelCount,
}) {
  if (shotStylePreset === 'statistics') {
    return getStatisticsMainChartWeightAxisRange({
      weightDatasets,
      mainDatasets,
      mainAxisRange,
      weightMaxPercentile: getStatisticsAxisPercentile(compareModelCount, 'weight'),
    });
  }

  return getAxisRange({
    datasets: weightDatasets,
    beginAtZero: true,
    fallbackMin: 0,
    fallbackMax: 50,
    paddingRatio: 0.05,
    minimumPadding: 0.2,
  });
}

function getCompareDetailAxisRange({ chart, compareModels, datasets, shotStylePreset }) {
  if (chart.id === 'temperature') {
    return {
      min: Math.min(...compareModels.map(entry => entry.model.tempAxisMin || 80)),
      max: Math.max(...compareModels.map(entry => entry.model.tempAxisMax || 100)),
    };
  }

  const detailChartRangeOptions = getDetailChartRangeOptions({
    shotStylePreset,
    chartId: chart.id,
    compareModelCount: compareModels.length,
  });

  return getAxisRange({
    datasets,
    beginAtZero: chart.beginAtZero,
    fallbackMin: chart.beginAtZero ? 0 : 80,
    fallbackMax: chart.beginAtZero ? 12 : 100,
    paddingRatio: detailChartRangeOptions.paddingRatio,
    minimumPadding: detailChartRangeOptions.minimumPadding,
    maxStrategy: detailChartRangeOptions.maxStrategy,
    maxPercentile: detailChartRangeOptions.maxPercentile,
  });
}

function getResolvedCompareMainChartHeight({ shotStylePreset, standardChartWidth }) {
  if (shotStylePreset === 'analyzer') {
    return getStandardCompareChartHeight(standardChartWidth);
  }
  return MAIN_CHART_HEIGHT_DEFAULT;
}

function filterCompareAnnotations(
  annotations,
  { annotationsEnabled = true, showPhaseAnnotations, showStopAnnotations, showBrewModeAnnotation },
) {
  if (!annotations) return {};
  if (!annotationsEnabled) return {};

  return Object.fromEntries(
    Object.entries(annotations).filter(([key]) => {
      if (!showPhaseAnnotations && (key === 'shot_start' || key.startsWith('phase_line_'))) {
        return false;
      }
      if (!showStopAnnotations && (key === 'shot_end' || key.startsWith('phase_exit_'))) {
        return false;
      }
      if (!showBrewModeAnnotation && key === 'brew_mode') {
        return false;
      }
      return true;
    }),
  );
}

function buildCompareMainAnnotations({
  compareModels,
  annotationsEnabled,
  showPhaseAnnotations,
  showStopAnnotations,
  showBrewModeAnnotation,
  enableDualMainChartAnnotations,
}) {
  if (!enableDualMainChartAnnotations || compareModels.length === 0) return {};

  const primaryAnnotations = filterCompareAnnotations(compareModels[0]?.model?.phaseAnnotations, {
    annotationsEnabled,
    showPhaseAnnotations,
    showStopAnnotations,
    showBrewModeAnnotation,
  });

  const secondaryAnnotations = filterCompareAnnotations(compareModels[1]?.model?.phaseAnnotations, {
    annotationsEnabled,
    showPhaseAnnotations,
    showStopAnnotations,
    showBrewModeAnnotation,
  });

  // Only the main compare chart gets duplicated annotations. Detail charts stay
  // intentionally quieter to avoid stacking two label sets per metric.
  return {
    ...prefixCompareAnnotations(primaryAnnotations, 'primary'),
    ...prefixCompareAnnotations(secondaryAnnotations, 'secondary', { ghosted: true }),
  };
}

function CompareChartCanvas({
  config,
  height,
  chartInstanceRef = null,
  isFullDisplay = false,
  enableHoverInfo = true,
  compareTooltipMode = 'compare',
  useCompactStaticTooltip = false,
  staticCompactVariant = 'default',
  hideEmptyStaticTooltip = false,
  emptyStaticTooltipContent = null,
  beforeChartContent = null,
  disableDirectHoverOnMobile = false,
  showMobileScrubber = false,
  mobileScrubberRange = null,
  staticMetricContext = null,
  useStaticTooltip = false,
}) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const containerRef = useRef(null);
  const scrubberRef = useRef(null);
  const tooltipRef = useRef(null);
  const ignoreScrubInputUntilRef = useRef(0);
  const lastPointerScrubAtRef = useRef(0);
  const hoverFrameRef = useRef(null);
  const pendingHoverPointRef = useRef(null);
  const [externalTooltipState, setExternalTooltipState] = useState(
    createHiddenExternalTooltipState,
  );
  const [externalTooltipLayout, setExternalTooltipLayout] = useState(
    createHiddenExternalTooltipLayout,
  );
  const [scrubXValue, setScrubXValue] = useState(null);
  const [scrubberInsets, setScrubberInsets] = useState({ left: 0, right: 0 });

  const scrubberMin = Number(mobileScrubberRange?.min);
  const scrubberMax = Number(mobileScrubberRange?.max);
  const scrubberKey = mobileScrubberRange?.key || `${scrubberMin}:${scrubberMax}`;
  const hasMobileScrubberRange =
    Number.isFinite(scrubberMin) && Number.isFinite(scrubberMax) && scrubberMax > scrubberMin;
  const hasActiveScrubValue = typeof scrubXValue === 'number' && Number.isFinite(scrubXValue);
  const activeScrubXValue = hasActiveScrubValue
    ? Math.min(scrubberMax, Math.max(scrubberMin, Number(scrubXValue)))
    : null;
  const updateScrubberInsets = useCallback(() => {
    const nextInsets = getChartScrubberInsets(chartRef.current);
    if (!nextInsets) return;
    setScrubberInsets(prev =>
      prev.left === nextInsets.left && prev.right === nextInsets.right ? prev : nextInsets,
    );
  }, []);

  const updateScrubberFromPointer = event => {
    if (Date.now() < ignoreScrubInputUntilRef.current) return;
    if (!hasMobileScrubberRange) return;

    if (hoverFrameRef.current != null) {
      globalThis.cancelAnimationFrame?.(hoverFrameRef.current);
      globalThis.clearTimeout?.(hoverFrameRef.current);
      hoverFrameRef.current = null;
      pendingHoverPointRef.current = null;
    }

    const nextValue = getScrubberValueFromPointerEvent(event, {
      min: scrubberMin,
      max: scrubberMax,
      trackElement: scrubberRef.current,
    });
    if (nextValue === null) return;

    lastPointerScrubAtRef.current = Date.now();
    setScrubXValue(nextValue);
  };

  const updateScrubberFromNativeInput = event => {
    const nextValue = getScrubberValueFromNativeInputEvent(event, {
      min: scrubberMin,
      max: scrubberMax,
      ignoreInputUntil: ignoreScrubInputUntilRef.current,
      lastPointerInputAt: lastPointerScrubAtRef.current,
    });
    if (nextValue !== null) {
      setScrubXValue(nextValue);
    }
  };

  const resetScrubberHover = useCallback(() => {
    ignoreScrubInputUntilRef.current = Date.now() + 250;
    setScrubXValue(null);
    const chart = chartRef.current;
    if (chart) {
      clearCompareChartHover(chart);
    }
    setExternalTooltipState(prev => {
      const hiddenState = createHiddenExternalTooltipState();
      return areTooltipStatesEqual(prev, hiddenState) ? prev : hiddenState;
    });
  }, []);

  useMobileScrubberReset({
    enabled: useStaticTooltip && showMobileScrubber,
    hasActiveScrubValue,
    scrubberRef,
    onReset: resetScrubberHover,
  });

  useMeasuredExternalTooltipLayout({
    containerRef,
    disabled: useStaticTooltip,
    setTooltipLayout: setExternalTooltipLayout,
    tooltipRef,
    tooltipState: externalTooltipState,
  });

  useEffect(() => {
    setScrubXValue(null);
  }, [scrubberKey]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const shouldSuppressHoverGuide = useStaticTooltip && showMobileScrubber && hasActiveScrubValue;
    if (chart.$suppressHoverGuide === shouldSuppressHoverGuide) return;

    chart.$suppressHoverGuide = shouldSuppressHoverGuide;
    if (!shouldSuppressHoverGuide) chart.update('none');
  }, [hasActiveScrubValue, showMobileScrubber, useStaticTooltip]);

  useEffect(() => {
    if (
      !enableHoverInfo ||
      !useStaticTooltip ||
      !showMobileScrubber ||
      !hasMobileScrubberRange ||
      !hasActiveScrubValue
    ) {
      return;
    }

    const chart = chartRef.current;
    if (!chart) return;

    if (compareTooltipMode === 'compareTitleOnly') {
      const xScale = chart.scales?.x;
      if (!chart.canvas || !chart.chartArea || !xScale) {
        clearCompareChartHover(chart);
        return;
      }

      const xPixel = xScale.getPixelForValue(activeScrubXValue);
      if (!Number.isFinite(xPixel)) {
        clearCompareChartHover(chart);
        return;
      }
      const chartRect = chart.canvas.getBoundingClientRect();
      const chartAreaHeight = Number(chart.chartArea.bottom) - Number(chart.chartArea.top);
      const clientY =
        chartRect.top +
        chart.chartArea.top +
        (Number.isFinite(chartAreaHeight) && chartAreaHeight > 0 ? chartAreaHeight / 2 : 0);
      applyCompareTitleOnlyHover(chart, chartRect.left + xPixel, clientY, setExternalTooltipState);
      return;
    }

    applyCompareHoverAtX(chart, activeScrubXValue);
  }, [
    activeScrubXValue,
    compareTooltipMode,
    enableHoverInfo,
    hasActiveScrubValue,
    hasMobileScrubberRange,
    showMobileScrubber,
    useStaticTooltip,
  ]);

  useEffect(() => {
    if (!canvasRef.current) return undefined;

    const hideExternalTooltip = () => {
      setExternalTooltipState(prev => {
        const hiddenState = createHiddenExternalTooltipState();
        return areTooltipStatesEqual(prev, hiddenState) ? prev : hiddenState;
      });
    };
    const nextConfig = createCompareChartConfig(config, {
      enableHoverInfo,
      compareTooltipMode,
      hideExternalTooltip,
      setExternalTooltipState,
    });

    const chart = new Chart(canvasRef.current, nextConfig);
    chartRef.current = chart;
    chart.$compareTooltipShowDifference = Boolean(config.compareTooltipShowDifference);
    if (chartInstanceRef) {
      chartInstanceRef.current = chart;
    }

    const hoverSurface = containerRef.current || chart.canvas;
    const clearPendingHoverFrame = () => {
      if (hoverFrameRef.current != null) {
        globalThis.cancelAnimationFrame?.(hoverFrameRef.current);
        globalThis.clearTimeout?.(hoverFrameRef.current);
        hoverFrameRef.current = null;
      }
      pendingHoverPointRef.current = null;
    };
    const clearHover = () => {
      clearPendingHoverFrame();
      clearCompareChartHover(chart);
      hideExternalTooltip();
    };
    const flushHoverMove = () => {
      hoverFrameRef.current = null;
      const point = pendingHoverPointRef.current;
      pendingHoverPointRef.current = null;
      if (!point) return;

      if (compareTooltipMode === 'compareTitleOnly') {
        applyCompareTitleOnlyHover(chart, point.clientX, point.clientY, setExternalTooltipState);
        return;
      }

      applyCompareHover(chart, point.clientX, point.clientY);
    };
    const handleHoverMove = event => {
      pendingHoverPointRef.current = extractClientPoint(event);
      if (!pendingHoverPointRef.current || hoverFrameRef.current != null) return;
      hoverFrameRef.current = globalThis.requestAnimationFrame
        ? globalThis.requestAnimationFrame(flushHoverMove)
        : globalThis.setTimeout(flushHoverMove, 16);
    };
    const supportsPointerEvents = Boolean(globalThis.window?.PointerEvent);
    const shouldAttachHover = enableHoverInfo && !(disableDirectHoverOnMobile && useStaticTooltip);

    if (hoverSurface && shouldAttachHover) {
      addCompareHoverListeners(hoverSurface, supportsPointerEvents, handleHoverMove, clearHover);
    }

    if (globalThis.window === undefined) {
      updateScrubberInsets();
    } else {
      globalThis.window.requestAnimationFrame(updateScrubberInsets);
    }

    return () => {
      if (hoverSurface && shouldAttachHover) {
        removeCompareHoverListeners(
          hoverSurface,
          supportsPointerEvents,
          handleHoverMove,
          clearHover,
        );
      }

      clearPendingHoverFrame();
      if (chartInstanceRef?.current === chart) {
        chartInstanceRef.current = null;
      }
      if (chartRef.current === chart) {
        chartRef.current = null;
      }
      chart.destroy();
      setExternalTooltipState(createHiddenExternalTooltipState());
      setExternalTooltipLayout(createHiddenExternalTooltipLayout());
    };
  }, [
    chartInstanceRef,
    config,
    disableDirectHoverOnMobile,
    enableHoverInfo,
    compareTooltipMode,
    updateScrubberInsets,
    useStaticTooltip,
  ]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || globalThis.window === undefined) return undefined;

    const frameId = globalThis.window.requestAnimationFrame(() => {
      chart.resize();
      updateScrubberInsets();
    });

    return () => globalThis.window.cancelAnimationFrame(frameId);
  }, [height, isFullDisplay, updateScrubberInsets, useStaticTooltip]);

  const shouldRenderMobileScrubber =
    enableHoverInfo && useStaticTooltip && showMobileScrubber && hasMobileScrubberRange;
  const mobileStaticTooltipState =
    shouldRenderMobileScrubber && !hasActiveScrubValue
      ? HIDDEN_STATIC_TOOLTIP_STATE
      : externalTooltipState;
  const shouldRenderStaticTooltip =
    enableHoverInfo &&
    useStaticTooltip &&
    (!hideEmptyStaticTooltip || mobileStaticTooltipState.visible);
  const mobileHoverConnectorStyle = (() => {
    if (!shouldRenderMobileScrubber || !hasActiveScrubValue || !externalTooltipState.visible) {
      return { display: 'none' };
    }

    const containerElement = containerRef.current;
    const scrubberElement = scrubberRef.current;
    const chart = chartRef.current;
    const xScale = chart?.scales?.x;
    if (!containerElement || !scrubberElement || !chart?.canvas || !chart?.chartArea || !xScale) {
      return { display: 'none' };
    }

    const xPixel = xScale.getPixelForValue(activeScrubXValue);
    if (!Number.isFinite(xPixel)) return { display: 'none' };

    const containerRect = containerElement.getBoundingClientRect();
    const canvasRect = chart.canvas.getBoundingClientRect();
    const scrubberRect = scrubberElement.getBoundingClientRect();
    const guideOverflow = 6;
    const top = canvasRect.top - containerRect.top + chart.chartArea.top - guideOverflow;
    const bottom = scrubberRect.bottom - containerRect.top;

    return {
      display: 'block',
      left: `${canvasRect.left - containerRect.left + xPixel}px`,
      top: `${Math.max(0, top)}px`,
      height: `${Math.max(0, bottom - top)}px`,
    };
  })();

  return (
    <div ref={containerRef} className='shot-chart-compare-canvas-shell relative w-full'>
      {shouldRenderStaticTooltip ? (
        <ShotChartExternalTooltip
          tooltipRef={tooltipRef}
          state={mobileStaticTooltipState}
          isFullDisplay={isFullDisplay}
          isStatic
          isCompactStatic={useCompactStaticTooltip}
          staticCompactVariant={staticCompactVariant}
          staticMetricContext={staticMetricContext}
          emptyContent={emptyStaticTooltipContent}
        />
      ) : null}
      {beforeChartContent}
      <div
        className='shot-chart-interaction-layer relative w-full'
        style={{ height: `${height}px` }}
      >
        <canvas ref={canvasRef} />
        {enableHoverInfo && !useStaticTooltip ? (
          <ShotChartExternalTooltip
            tooltipRef={tooltipRef}
            state={externalTooltipState}
            layout={externalTooltipLayout}
            isFullDisplay={isFullDisplay}
          />
        ) : null}
      </div>
      <div className='shot-chart-hover-connector' style={mobileHoverConnectorStyle} />
      {shouldRenderMobileScrubber ? (
        <MobileChartScrubber
          active={hasActiveScrubValue}
          ariaLabel='Scrub compare time'
          insets={scrubberInsets}
          max={scrubberMax}
          min={scrubberMin}
          onInput={updateScrubberFromNativeInput}
          onPointerUpdate={updateScrubberFromPointer}
          scrubberRef={scrubberRef}
          value={activeScrubXValue ?? scrubberMin}
          variant='compare'
        />
      ) : null}
    </div>
  );
}

function useCompareVisibilityState({
  enableDualMainChartAnnotations,
  showBrewModeAnnotation,
  showPhaseAnnotations,
  showStopAnnotations,
  shotStylePreset,
}) {
  const shouldPersistCompareVisibility =
    shotStylePreset === 'analyzer' && enableDualMainChartAnnotations;
  const [visibility, setVisibility] = useState(() =>
    normalizeCompareVisibility(
      shouldPersistCompareVisibility
        ? loadFromStorage(ANALYZER_DB_KEYS.COMPARE_CHART_VISIBILITY)
        : null,
      { showPhaseAnnotations, showStopAnnotations, showBrewModeAnnotation },
    ),
  );

  useEffect(() => {
    if (!shouldPersistCompareVisibility) return;
    saveToStorage(ANALYZER_DB_KEYS.COMPARE_CHART_VISIBILITY, visibility);
  }, [shouldPersistCompareVisibility, visibility]);

  return { setVisibility, visibility };
}

function useInitialCompareAlignmentState() {
  return useState(() => COMPARE_ALIGNMENT_SHOT_START);
}

function useResolvedCompareAlignmentState({
  compareAlignmentMode,
  resolvedCompareAlignmentMode,
  setCompareAlignmentMode,
  shotStylePreset,
}) {
  useEffect(() => {
    if (shotStylePreset !== 'analyzer') return;
    if (resolvedCompareAlignmentMode === compareAlignmentMode) return;
    setCompareAlignmentMode(resolvedCompareAlignmentMode);
  }, [
    compareAlignmentMode,
    resolvedCompareAlignmentMode,
    setCompareAlignmentMode,
    shotStylePreset,
  ]);
}

function useResetAnalyzerCompareAlignmentOnSecondaryShotChange({
  compareEntries,
  setCompareAlignmentMode,
  shotStylePreset,
}) {
  const secondaryShotKey = getCompareEntryKey(compareEntries?.[1], 1);

  useLayoutEffect(() => {
    if (shotStylePreset !== 'analyzer') return;
    setCompareAlignmentMode(COMPARE_ALIGNMENT_SHOT_START);
  }, [secondaryShotKey, setCompareAlignmentMode, shotStylePreset]);
}

function useCompareViewportState({ isFullDisplay, mainChartCardRef, shotStylePreset }) {
  const [viewportResizeNonce, setViewportResizeNonce] = useState(0);
  const [standardChartWidth, setStandardChartWidth] = useState(0);
  const [isMobileCompareLayout, setIsMobileCompareLayout] = useState(getCompareMobileLayoutState);

  useEffect(() => {
    const handleResize = () => setViewportResizeNonce(n => n + 1);
    globalThis.window?.addEventListener('resize', handleResize);
    return () => globalThis.window?.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (globalThis.window?.matchMedia === undefined) {
      return undefined;
    }

    const mediaQuery = globalThis.window.matchMedia('(max-width: 640px)');
    const handleChange = event => setIsMobileCompareLayout(event.matches);
    setIsMobileCompareLayout(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return undefined;
    if (shotStylePreset !== 'analyzer') return undefined;

    const targetElement = mainChartCardRef.current;
    if (!targetElement) return undefined;

    const updateWidth = () => {
      setStandardChartWidth(Math.round(targetElement.getBoundingClientRect().width || 0));
    };
    const resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      const nextWidth = entry?.contentRect?.width ?? targetElement.getBoundingClientRect().width;
      setStandardChartWidth(Math.round(nextWidth || 0));
    });

    updateWidth();
    resizeObserver.observe(targetElement);

    return () => resizeObserver.disconnect();
  }, [isFullDisplay, mainChartCardRef, shotStylePreset, viewportResizeNonce]);

  return { isMobileCompareLayout, standardChartWidth };
}

function getCompareLegendToggleHandler({ hasWeightData, hasWeightFlowData, setVisibility }) {
  return label => {
    const key = COMPARE_LEGEND_KEY_BY_LABEL[label];

    if (!key) return;
    if (label === 'Weight' && !hasWeightData) return;
    if (label === 'Weight Flow' && !hasWeightFlowData) return;
    setVisibility(prevVisibility => ({ ...prevVisibility, [key]: !prevVisibility[key] }));
  };
}

function CompareMobileLegendSection({
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

function CompareControls({
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

function CompareChartsBody({
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

function CompareChartsShell({ charts, controls, isFullDisplay, onCloseFullDisplay }) {
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
