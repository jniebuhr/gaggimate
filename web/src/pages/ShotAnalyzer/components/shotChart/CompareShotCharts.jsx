/* global globalThis */

import { createPortal } from 'preact/compat';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import Chart from 'chart.js/auto';
import annotationPlugin from 'chartjs-plugin-annotation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ShotChartControls, getNextChartHeight } from './ShotChartControls';
import {
  areTooltipLayoutsEqual,
  areTooltipStatesEqual,
  buildExternalTooltipState,
  createHiddenExternalTooltipLayout,
  createHiddenExternalTooltipState,
  getExternalTooltipLayout,
  ShotChartExternalTooltip,
} from './ShotChartExternalTooltip';
import {
  BREW_BY_TIME_LABEL,
  BREW_BY_WEIGHT_LABEL,
  INITIAL_VISIBILITY,
  MAIN_CHART_HEIGHT_DEFAULT,
} from './constants';
import { buildShotChartModel } from './buildShotChartModel';
import {
  getLegendColorByLabel,
  getSpikeResistantSeriesMax,
  getShotChartColors,
  hoverGuidePlugin,
  readCssColorVar,
  resolveHoverPointColor,
} from './helpers';
import { getShotChartDisplayLabel, getShotChartLabelIcon } from './labelVisuals';
import {
  ANALYZER_DB_KEYS,
  COMPARE_TARGET_DISPLAY_MODES,
  loadFromStorage,
  saveToStorage,
} from '../../utils/analyzerUtils';
import '../ShotChart.css';

Chart.register(annotationPlugin);

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
const COMPARE_POINT_ELEMENT_CONFIG = {
  radius: 0,
  hoverRadius: 4,
  hitRadius: 12,
  borderWidth: 0,
  hoverBorderWidth: 0,
  backgroundColor: resolveHoverPointColor,
  hoverBackgroundColor: resolveHoverPointColor,
  borderColor: resolveHoverPointColor,
  hoverBorderColor: resolveHoverPointColor,
};

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
    title: 'Flow',
    tooltipBaseLabel: 'Flow',
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

let scratchContext = null;

function getScratchContext() {
  if (scratchContext || typeof document === 'undefined') return scratchContext;
  scratchContext = document.createElement('canvas').getContext('2d');
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

function getShotStyle(index, preset = 'analyzer') {
  const stylePreset = SHOT_STYLE_PRESETS[preset] || SHOT_STYLE_PRESETS.analyzer;
  const { opacities, lineWidths } = stylePreset;

  return {
    opacity: opacities[index] ?? opacities[opacities.length - 1],
    lineWidth: lineWidths[index] ?? lineWidths[lineWidths.length - 1],
  };
}

function getComparePointStyle(isTarget = false) {
  return {
    pointRadius: 0,
    pointHoverRadius: isTarget ? 2.5 : 4,
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

function CompareChartTitle({ title, labelKey, variant = 'default', iconColor = null }) {
  if (!title) return null;

  if (variant === 'legend') {
    const icon = getShotChartLabelIcon(labelKey || title);
    const displayLabel = formatCompareChartTitle(getShotChartDisplayLabel(labelKey || title));

    return (
      <div className='text-base-content/80 mb-2 inline-flex items-center gap-1.5 px-0.5 py-1 text-[10px] font-semibold'>
        {icon ? (
          <FontAwesomeIcon
            icon={icon}
            className='text-[10px]'
            style={iconColor ? { color: iconColor } : undefined}
            aria-hidden='true'
          />
        ) : null}
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

function getBrewModeMeta(results, colors) {
  return results?.isBrewByWeight
    ? {
        label: BREW_BY_WEIGHT_LABEL,
        backgroundColor: readCssColorVar('--analyzer-brew-by-weight-label-bg', colors.weight),
        textColor: readCssColorVar('--analyzer-brew-by-weight-label-text', '#ffffff'),
        borderColor: readCssColorVar('--analyzer-brew-by-weight-label-border', colors.weight),
      }
    : {
        label: BREW_BY_TIME_LABEL,
        backgroundColor: readCssColorVar('--analyzer-brew-by-time-label-bg', '#475569'),
        textColor: readCssColorVar('--analyzer-brew-by-time-label-text', '#ffffff'),
        borderColor: readCssColorVar('--analyzer-brew-by-time-label-border', '#334155'),
      };
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

function getPercentileValue(values, percentile) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const clampedPercentile = Math.min(1, Math.max(0, percentile));
  const index = (sorted.length - 1) * clampedPercentile;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  if (lowerIndex === upperIndex) return sorted[lowerIndex];
  const ratio = index - lowerIndex;
  return sorted[lowerIndex] + (sorted[upperIndex] - sorted[lowerIndex]) * ratio;
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

function getDetailChartHeight(mainChartHeight, isFullDisplay) {
  if (isFullDisplay) return DETAIL_CHART_HEIGHT_FULL;
  if (mainChartHeight > MAIN_CHART_HEIGHT_DEFAULT) return DETAIL_CHART_HEIGHT_BIG;
  return DETAIL_CHART_HEIGHT_SMALL;
}

function getCompareTooltipPlugin({
  enableHoverInfo,
  compareTooltipMode,
  hideExternalTooltip,
  setExternalTooltipState,
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

  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < datasetData.length; index += 1) {
    const point = datasetData[index];
    const pointX = Number(point?.x);
    const pointY = Number(point?.y);
    if (!Number.isFinite(pointX) || !Number.isFinite(pointY)) continue;

    const distance = Math.abs(pointX - xValue);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

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

function extractClientPoint(event) {
  if (!event) return null;
  if (Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
    return { clientX: event.clientX, clientY: event.clientY };
  }

  const touch = event.touches?.[0] || event.changedTouches?.[0];
  if (touch && Number.isFinite(touch.clientX) && Number.isFinite(touch.clientY)) {
    return { clientX: touch.clientX, clientY: touch.clientY };
  }

  return null;
}

function applyCompareHover(chart, clientX, clientY) {
  const xScale = chart?.scales?.x;
  if (!chart?.canvas || !xScale || !Number.isFinite(clientX)) return;

  const chartRect = chart.canvas.getBoundingClientRect();
  const minClientX = chartRect.left + chart.chartArea.left;
  const maxClientX = chartRect.left + chart.chartArea.right;
  const clampedClientX = Math.min(maxClientX, Math.max(minClientX, clientX));
  const sourceX = clampedClientX - chartRect.left;
  const xValue = xScale.getValueForPixel(sourceX);

  if (!Number.isFinite(xValue)) {
    clearCompareChartHover(chart);
    return;
  }

  // Build hover state from the shared x-position so every visible compare
  // series contributes a single aligned point instead of relying on Chart.js'
  // nearest-dataset heuristics.
  const active = buildCompareActiveElements(chart, xValue);
  if (!active.length) {
    clearCompareChartHover(chart);
    return;
  }

  const xPixel = xScale.getPixelForValue(xValue);
  const minClientY = chartRect.top + chart.chartArea.top;
  const maxClientY = chartRect.top + chart.chartArea.bottom;
  const clampedClientY = Number.isFinite(clientY)
    ? Math.min(maxClientY, Math.max(minClientY, clientY))
    : minClientY;
  const tooltipY = clampedClientY - chartRect.top;

  chart.$fixedTooltipPointerX = Number.isFinite(xPixel) ? xPixel : null;
  chart.$fixedTooltipPointerY = tooltipY;
  chart.$fixedTooltipXValue = xValue;
  chart.setActiveElements(active);
  chart.tooltip?.setActiveElements(active, {
    x: Number.isFinite(xPixel) ? xPixel : chart.chartArea.left + 8,
    y: tooltipY,
  });
  chart.update('none');
}

function buildCompareLegendItems(compareEntries, colors, shotStylePreset) {
  return compareEntries.map((entry, index) => {
    const shotStyle = getShotStyle(index, shotStylePreset);

    return {
      label: entry.label,
      color: applyColorAlpha(colors.phaseLine, shotStyle.opacity),
      lineWidth: shotStyle.lineWidth,
    };
  });
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
          borderDash: [6, 4],
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
          label: `${entry.label} Flow`,
          compareTooltipBaseLabel: 'Flow',
          data: model.series.flow,
          borderColor: applyColorAlpha(colors.flow, shotStyle.opacity),
          backgroundColor: applyColorAlpha(colors.flow, shotStyle.opacity),
          yAxisID: 'yMain',
          borderWidth: shotStyle.lineWidth,
          tension: 0.2,
          ...getComparePointStyle(false),
          ...compareDatasetMeta,
        }
      : null,
    visibility.targetFlow && showTargets && model.series.targetFlow.length > 0
      ? {
          label: `${entry.label} Target Flow`,
          compareTooltipBaseLabel: 'Target F',
          data: model.series.targetFlow,
          borderColor: applyColorAlpha(colors.flow, Math.max(0.26, shotStyle.opacity * 0.72)),
          backgroundColor: 'transparent',
          yAxisID: 'yMain',
          borderWidth: Math.max(1.2, shotStyle.lineWidth - 1.2),
          borderDash: [6, 4],
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
          borderDash: [6, 4],
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
  showWeightInMainChart = true,
  showWeightFlowInMainChart = true,
}) {
  return compareModels.flatMap(({ entry, model }, index) => {
    const shotStyle = getShotStyle(index, shotStylePreset);
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
  targetDisplayMode,
  visibility,
  shotStylePreset,
}) {
  return compareModels.flatMap(({ entry, model }, index) => {
    const shotStyle = getShotStyle(index, shotStylePreset);
    const actualSeries = model.series[chart.seriesKey] || [];
    const targetSeries = chart.targetSeriesKey ? model.series[chart.targetSeriesKey] || [] : [];
    const baseColor = colors[chart.axisColorKey];
    const showTargets =
      chart.targetSeriesKey &&
      chart.targetVisibleKey &&
      visibility[chart.targetVisibleKey] &&
      shouldShowTargetsForEntry({
        entry,
        targetDisplayMode,
      });
    const compareDatasetMeta = {
      compareTooltipShotLabel: entry.label,
      compareTooltipShotOrder: index,
    };
    return buildDetailChartDatasetSpecs({
      chart,
      entry,
      actualSeries,
      targetSeries,
      baseColor,
      shotStyle,
      compareDatasetMeta,
      visibility,
      showTargets,
    });
  });
}

function createCompareChartConfig(
  config,
  { enableHoverInfo, compareTooltipMode, hideExternalTooltip, setExternalTooltipState },
) {
  return {
    ...config,
    options: {
      ...config.options,
      events: [],
      plugins: {
        ...config.options?.plugins,
        tooltip: getCompareTooltipPlugin({
          enableHoverInfo,
          compareTooltipMode,
          hideExternalTooltip,
          setExternalTooltipState,
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
    ...prefixCompareAnnotations(primaryAnnotations, 'primary', { startLabelSuffix: '1' }),
    ...prefixCompareAnnotations(secondaryAnnotations, 'secondary', {
      ghosted: true,
      startLabelSuffix: '2',
    }),
  };
}

function CompareChartCanvas({
  config,
  height,
  isFullDisplay = false,
  enableHoverInfo = true,
  compareTooltipMode = 'compare',
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const tooltipRef = useRef(null);
  const [externalTooltipState, setExternalTooltipState] = useState(
    createHiddenExternalTooltipState,
  );
  const [externalTooltipLayout, setExternalTooltipLayout] = useState(
    createHiddenExternalTooltipLayout,
  );

  useLayoutEffect(() => {
    if (!externalTooltipState.visible) {
      setExternalTooltipLayout(prev => {
        const hiddenLayout = createHiddenExternalTooltipLayout();
        return areTooltipLayoutsEqual(prev, hiddenLayout) ? prev : hiddenLayout;
      });
      return;
    }

    const tooltipElement = tooltipRef.current;
    const containerElement = containerRef.current;
    if (!tooltipElement || !containerElement) return;

    const chartWidth = externalTooltipState.chartWidth || containerElement.clientWidth || 0;
    const chartHeight = externalTooltipState.chartHeight || containerElement.clientHeight || 0;
    const tooltipWidth = tooltipElement.offsetWidth || 0;
    const tooltipHeight = tooltipElement.offsetHeight || 0;

    const nextLayout = getExternalTooltipLayout({
      tooltipState: externalTooltipState,
      tooltipWidth,
      tooltipHeight,
      fallbackWidth: chartWidth,
      fallbackHeight: chartHeight,
    });

    setExternalTooltipLayout(prev =>
      areTooltipLayoutsEqual(prev, nextLayout) ? prev : nextLayout,
    );
  }, [externalTooltipState]);

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
    chart.$compareTooltipShowDifference = Boolean(config.compareTooltipShowDifference);

    const hoverSurface = containerRef.current || chart.canvas;
    const clearHover = () => {
      clearCompareChartHover(chart);
      hideExternalTooltip();
    };
    const handleHoverMove = event => {
      const point = extractClientPoint(event);
      if (!point) return;
      applyCompareHover(chart, point.clientX, point.clientY);
    };
    const supportsPointerEvents = Boolean(globalThis.window?.PointerEvent);

    if (hoverSurface && enableHoverInfo) {
      addCompareHoverListeners(hoverSurface, supportsPointerEvents, handleHoverMove, clearHover);
    }

    return () => {
      if (hoverSurface && enableHoverInfo) {
        removeCompareHoverListeners(
          hoverSurface,
          supportsPointerEvents,
          handleHoverMove,
          clearHover,
        );
      }

      chart.destroy();
      setExternalTooltipState(createHiddenExternalTooltipState());
      setExternalTooltipLayout(createHiddenExternalTooltipLayout());
    };
  }, [config, enableHoverInfo, compareTooltipMode]);

  return (
    <div ref={containerRef} className='relative w-full' style={{ height: `${height}px` }}>
      <canvas ref={canvasRef} />
      {enableHoverInfo ? (
        <ShotChartExternalTooltip
          tooltipRef={tooltipRef}
          state={externalTooltipState}
          layout={externalTooltipLayout}
          isFullDisplay={isFullDisplay}
        />
      ) : null}
    </div>
  );
}

export function CompareShotCharts({
  compareEntries,
  compareTargetDisplayMode,
  onCompareTargetDisplayModeChange,
  showPhaseAnnotations = true,
  showStopAnnotations = true,
  showBrewModeAnnotation = true,
  showCompareAnnotationToggle = true,
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
  const shouldPersistCompareAnnotations =
    showCompareAnnotationToggle && enableDualMainChartAnnotations;
  const initialCompareAnnotationsEnabled = shouldPersistCompareAnnotations
    ? loadFromStorage(
        ANALYZER_DB_KEYS.COMPARE_ANNOTATIONS_ENABLED,
        Boolean(showPhaseAnnotations || showStopAnnotations || showBrewModeAnnotation),
      )
    : Boolean(showPhaseAnnotations || showStopAnnotations || showBrewModeAnnotation);
  const [visibility, setVisibility] = useState(() => ({
    ...INITIAL_VISIBILITY,
    phaseNames: showPhaseAnnotations && initialCompareAnnotationsEnabled,
    stops: showStopAnnotations && initialCompareAnnotationsEnabled,
    brewModeLabel: showBrewModeAnnotation && initialCompareAnnotationsEnabled,
  }));
  const [compareAnnotationsEnabled, setCompareAnnotationsEnabled] = useState(
    initialCompareAnnotationsEnabled,
  );
  const [mainChartHeight, setMainChartHeight] = useState(MAIN_CHART_HEIGHT_DEFAULT);
  const [isFullDisplay, setIsFullDisplay] = useState(false);

  const colors = getShotChartColors();
  const legendColorByLabel = getLegendColorByLabel(colors);
  const compareShotLegendItems = showCompareShotLegend
    ? buildCompareLegendItems(compareEntries, colors, shotStylePreset)
    : [];
  const hiddenLegendLabels = [
    ...(showPhaseAnnotations ? [] : ['Phase Names']),
    ...(showStopAnnotations ? [] : ['Stops']),
  ];
  const hasWeightData = compareEntries.some(
    entry =>
      Array.isArray(entry.shot?.samples) &&
      entry.shot.samples.some(sample => Number(sample?.v) > 0),
  );
  const hasWeightFlowData = compareEntries.some(
    entry =>
      Array.isArray(entry.shot?.samples) &&
      entry.shot.samples.some(sample => Number(sample?.vf) > 0),
  );

  useEffect(() => {
    if (!shouldPersistCompareAnnotations) return;
    saveToStorage(ANALYZER_DB_KEYS.COMPARE_ANNOTATIONS_ENABLED, Boolean(compareAnnotationsEnabled));
  }, [compareAnnotationsEnabled, shouldPersistCompareAnnotations]);

  const compareModels = compareEntries.map(entry => ({
    entry,
    model: buildShotChartModel({
      shotData: entry.shot,
      results: entry.results,
      visibility,
      colors,
      brewModeMeta: getBrewModeMeta(entry.results, colors),
    }),
  }));

  const mainAnnotations = buildCompareMainAnnotations({
    compareModels,
    annotationsEnabled: compareAnnotationsEnabled,
    showPhaseAnnotations,
    showStopAnnotations,
    showBrewModeAnnotation,
    enableDualMainChartAnnotations,
  });
  const xMax = Math.max(1, ...compareModels.map(entry => entry.model.maxTime || 0));
  const mainDatasets = buildMainChartDatasets({
    compareModels,
    colors,
    visibility,
    targetDisplayMode: compareTargetDisplayMode,
    shotStylePreset,
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
  const hasMainChartWeightData = weightDatasets.length > 0;
  const weightAxisRange = getCompareWeightAxisRange({
    shotStylePreset,
    weightDatasets,
    mainDatasets,
    mainAxisRange,
    compareModelCount: compareModels.length,
  });

  const mainChartConfig = {
    type: 'line',
    data: { datasets: mainDatasets },
    plugins: [hoverGuidePlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      elements: {
        point: COMPARE_POINT_ELEMENT_CONFIG,
      },
      interaction: {
        mode: 'x',
        intersect: false,
      },
      plugins: {
        legend: { display: false },
        annotation: {
          annotations: mainAnnotations,
        },
      },
      scales: {
        x: {
          type: 'linear',
          max: xMax,
          ticks: {
            font: { size: 10 },
            color: '#888',
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
            font: { size: 10 },
            color: colors.pressure,
          },
          grid: {
            color: 'rgba(200, 200, 200, 0.1)',
          },
        },
        yWeight: {
          type: 'linear',
          display: hasMainChartWeightData,
          position: 'right',
          min: weightAxisRange.min,
          max: weightAxisRange.max,
          ticks: {
            font: { size: 10 },
            color: colors.weight,
          },
          grid: { display: false },
        },
      },
    },
  };

  const detailChartHeight = getDetailChartHeight(mainChartHeight, isFullDisplay);

  const detailCharts = DETAIL_CHARTS.map(chart => {
    const datasets = buildDetailChartDatasets({
      chart,
      compareModels,
      colors,
      targetDisplayMode: compareTargetDisplayMode,
      visibility,
      shotStylePreset,
    });

    if (datasets.length === 0) return null;

    const axisRange = getCompareDetailAxisRange({
      chart,
      compareModels,
      datasets,
      shotStylePreset,
    });

    return {
      ...chart,
      config: {
        type: 'line',
        compareTooltipShowDifference: true,
        data: { datasets },
        plugins: [hoverGuidePlugin],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          elements: {
            point: COMPARE_POINT_ELEMENT_CONFIG,
          },
          interaction: {
            mode: 'x',
            intersect: false,
          },
          plugins: {
            legend: { display: false },
            annotation: {
              annotations: {},
            },
          },
          scales: {
            x: {
              type: 'linear',
              max: xMax,
              ticks: {
                font: { size: 10 },
                color: '#888',
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
                color: colors[chart.axisColorKey],
              },
              grid: {
                color: 'rgba(200, 200, 200, 0.1)',
              },
            },
          },
        },
      },
    };
  }).filter(Boolean);

  const handleLegendToggle = label => {
    const key = {
      'Phase Names': 'phaseNames',
      Stops: 'stops',
      Temp: 'temp',
      'Target T': 'targetTemp',
      Pressure: 'pressure',
      'Target P': 'targetPressure',
      Flow: 'flow',
      'Target F': 'targetFlow',
      'Puck Flow': 'puckFlow',
      Weight: 'weight',
      'Weight Flow': 'weightFlow',
    }[label];

    if (!key) return;
    if (label === 'Weight' && !hasWeightData) return;
    if (label === 'Weight Flow' && !hasWeightFlowData) return;
    setVisibility(prevVisibility => ({ ...prevVisibility, [key]: !prevVisibility[key] }));
  };

  const handleCompareAnnotationsToggle = () => {
    const nextEnabled = !compareAnnotationsEnabled;
    setCompareAnnotationsEnabled(nextEnabled);
    setVisibility(prevVisibility => ({
      ...prevVisibility,
      phaseNames: nextEnabled,
      stops: nextEnabled,
      brewModeLabel: nextEnabled,
    }));
  };

  const controls = (
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
      mainChartHeight={mainChartHeight}
      compareShotLegendItems={compareShotLegendItems}
      compareTargetDisplayMode={compareTargetDisplayMode}
      onCompareTargetDisplayModeChange={onCompareTargetDisplayModeChange}
      showCompareAnnotationToggle={showCompareAnnotationToggle && enableDualMainChartAnnotations}
      compareAnnotationsEnabled={
        compareAnnotationsEnabled &&
        (visibility.phaseNames || visibility.stops || visibility.brewModeLabel)
      }
      onCompareAnnotationsToggle={
        showCompareAnnotationToggle && enableDualMainChartAnnotations
          ? handleCompareAnnotationsToggle
          : null
      }
      isCompareMode={true}
      onChartHeightToggle={() =>
        setMainChartHeight(currentHeight => getNextChartHeight(currentHeight))
      }
      onCloseExportMenu={() => {}}
      onExportAction={() => {}}
      onExportMenuToggle={() => {}}
      onExportTypeChange={() => {}}
      onExportFormatChange={() => {}}
      onExportFormatInfoToggle={() => {}}
      onFullDisplayToggle={() => setIsFullDisplay(currentValue => !currentValue)}
      onIncludeLegendChange={() => {}}
      onLegendToggle={handleLegendToggle}
      onReplayToggle={() => {}}
      onStop={() => {}}
      replayExportStatus={{}}
      replayExportStatusHint=''
      replayExportStatusLabel=''
      shouldShowReplayFocusHint={false}
      shouldLockWebmToggle={false}
      shouldShowWebmToggle={false}
      visibility={visibility}
    />
  );

  const chartCardClass = 'bg-base-100/55 rounded-lg p-3';

  const charts = (
    <div className={isFullDisplay ? 'min-h-0 flex-1 overflow-y-auto pr-1' : 'w-full'}>
      <div className='space-y-4'>
        <div className={chartCardClass}>
          {showMainChartTitle ? <CompareChartTitle title='Compare Overlay' /> : null}
          <CompareChartCanvas
            config={mainChartConfig}
            height={isFullDisplay ? 420 : mainChartHeight}
            isFullDisplay={isFullDisplay}
            enableHoverInfo={enableHoverInfo}
            compareTooltipMode={compareTooltipMode}
          />
        </div>

        {detailCharts.map(chart => (
          <div key={chart.id} className={chartCardClass}>
            <CompareChartTitle
              title={chart.title}
              labelKey={chart.tooltipBaseLabel || chart.title}
              variant={detailChartTitleVariant}
              iconColor={legendColorByLabel[chart.tooltipBaseLabel || chart.title] || null}
            />
            <CompareChartCanvas
              config={chart.config}
              height={detailChartHeight}
              isFullDisplay={isFullDisplay}
              enableHoverInfo={enableHoverInfo}
              compareTooltipMode={compareTooltipMode}
            />
          </div>
        ))}
      </div>
    </div>
  );

  if (isFullDisplay && typeof document !== 'undefined') {
    return createPortal(
      <div className='shot-chart-full-display select-none'>
        <button
          type='button'
          className='shot-chart-full-display__backdrop'
          onClick={() => setIsFullDisplay(false)}
          aria-label='Close full display'
        />
        <div className='shot-chart-full-display__panel'>
          {controls}
          {charts}
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <div className='w-full select-none'>
      {controls}
      {charts}
    </div>
  );
}
