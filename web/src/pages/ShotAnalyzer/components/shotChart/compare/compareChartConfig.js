import { areTooltipStatesEqual, buildExternalTooltipState } from '../ShotChartExternalTooltip';
import { UNIT_BY_LABEL } from '../constants';
import {
  createChartPointElementConfig,
  finalWeightBadgeOverlayPlugin,
  finalWeightCalloutLinePlugin,
  getAxisUnitReservedPadding,
  formatResponsiveXAxisTick,
  formatUniqueAxisTick,
  getPercentileValue,
  getSpikeResistantSeriesMax,
  axisUnitLabelPlugin,
  hoverGuidePlugin,
  phaseLabelOverlayPlugin,
  stopIconOverlayPlugin,
} from '../helpers';
import {
  COMPARE_MARKER_TOP_PADDING,
  DETAIL_CHARTS,
  DETAIL_CHART_HEIGHT_BIG,
  DETAIL_CHART_HEIGHT_FULL,
  DETAIL_CHART_HEIGHT_SMALL,
} from './compareConstants';
import { buildDetailChartDatasets } from './compareDatasets';
import { getDetailChartUnitLabel } from './CompareMetricContent';
import { getCompareFullDisplayViewportHeight, prefixCompareAnnotations } from './compareModel';

export function getMainAxisUnitLabels({ showWeightAxis }) {
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

export function getMainAxisUnitPadding({ mainAxisUnitLabels, reserveMarkerSpace }) {
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

export function getCompareAnnotations({
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

export function getCompareMainChartConfig({
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

export function buildCompareDetailCharts({
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

export function getDetailChartHeight(isFullDisplay) {
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

export function getAxisRange({
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

export function createCompareChartConfig(
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

export function getCompareWeightAxisRange({
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
