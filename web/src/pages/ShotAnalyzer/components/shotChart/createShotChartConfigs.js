/**
 * createShotChartConfigs.js
 *
 * Builds the Chart.js config objects for the main and temperature charts from
 * the normalized ShotChart model.
 */

import {
  STANDARD_LINE_WIDTH,
  THIN_LINE_WIDTH,
  WATER_DRAWN_PHASE_LABEL,
  WATER_DRAWN_TOTAL_LABEL,
} from './constants';
import { shouldRenderTooltipLabel, sortTooltipItems } from './ShotChartExternalTooltip';
import {
  axisUnitLabelPlugin,
  createChartPointElementConfig,
  finalWeightBadgeOverlayPlugin,
  finalWeightCalloutLinePlugin,
  formatResponsiveXAxisTick,
  formatUniqueAxisTick,
  getAxisUnitReservedPadding,
  getNeutralAxisTickColor,
  hoverGuidePlugin,
  phaseBackgroundOverlayPlugin,
  phaseLabelOverlayPlugin,
  replayRevealPlugin,
  stopIconOverlayPlugin,
} from './helpers';

const MAIN_CHART_MARKER_TOP_PADDING = 48;

export function createShotChartConfigs({
  model,
  colors,
  visibility,
  hasWeightData,
  hasWeightFlowData,
  targetPressureFill,
  targetFlowFill,
  tempToTargetFill,
  updateExternalTooltip,
  showStopBadges = true,
}) {
  const showWeightSeries = Boolean(hasWeightData && model.hasWeight);
  const neutralAxisTickColor = getNeutralAxisTickColor();
  const mainAxisUnitLabels = [
    { scaleId: 'yMain', label: 'bar / ml/s' },
    { scaleId: 'yMain', label: 'Phase', side: 'center', yOffset: 0 },
  ];
  const showWeightAxis = Boolean(showWeightSeries && visibility.weight);
  if (showWeightAxis) {
    mainAxisUnitLabels.push({
      scaleId: 'yWeight',
      label: 'g',
      side: 'right',
      yOffset: 0,
    });
  }
  const mainChartInsideLabels = [];
  const tempAxisUnitLabels = [{ scaleId: 'yTemp', label: '°C', side: 'left' }];
  const mainAxisUnitPadding = getAxisUnitReservedPadding({ yLabels: mainAxisUnitLabels });
  mainAxisUnitPadding.top = Math.max(mainAxisUnitPadding.top, MAIN_CHART_MARKER_TOP_PADDING);
  const tempAxisUnitPadding = getAxisUnitReservedPadding({
    yLabels: tempAxisUnitLabels,
    xLabel: 's',
    reserveXLabelSpace: false,
  });

  // The main chart carries all primary series plus a few hidden helper datasets
  // that exist only for tooltip composition and replay/export consistency.
  const mainDatasets = [
    {
      label: 'Phases',
      data: [],
      borderColor: colors.phaseLine,
      backgroundColor: colors.phaseLine,
      yAxisID: 'yMain',
      pointRadius: 0,
      borderWidth: STANDARD_LINE_WIDTH,
      hidden: !visibility.phaseNames,
    },
    {
      label: 'Stops',
      data: [],
      borderColor: colors.stopLabel,
      backgroundColor: colors.stopLabel,
      yAxisID: 'yMain',
      pointRadius: 0,
      borderWidth: STANDARD_LINE_WIDTH,
      hidden: !visibility.stops,
    },
    {
      label: 'Temp',
      data: model.series.temp,
      borderColor: colors.temp,
      backgroundColor: colors.temp,
      yAxisID: 'yTempOverlay',
      pointRadius: 0,
      pointHoverRadius: 0,
      pointHitRadius: 12,
      borderWidth: 0,
      fill: false,
      hidden: !visibility.temp,
    },
    {
      label: 'Target T',
      data: model.series.targetTemp,
      borderColor: colors.tempTarget,
      backgroundColor: colors.tempTarget,
      borderDash: [4, 4],
      yAxisID: 'yTempOverlay',
      pointRadius: 0,
      pointHoverRadius: 0,
      pointHitRadius: 12,
      borderWidth: 0,
      fill: false,
      hidden: !visibility.targetTemp,
    },
    {
      label: 'Pressure',
      data: model.series.pressure,
      borderColor: colors.pressure,
      backgroundColor: colors.pressure,
      yAxisID: 'yMain',
      pointRadius: 0,
      borderWidth: STANDARD_LINE_WIDTH,
      tension: 0.2,
      hidden: !visibility.pressure,
    },
    {
      label: 'Target P',
      data: model.series.targetPressure,
      borderColor: colors.pressure,
      backgroundColor: targetPressureFill,
      fill: false,
      borderDash: [4, 4],
      yAxisID: 'yMain',
      pointRadius: 0,
      borderWidth: THIN_LINE_WIDTH,
      tension: 0,
      hidden: !visibility.targetPressure,
    },
    {
      label: 'Pump Flow',
      data: model.series.flow,
      borderColor: colors.flow,
      backgroundColor: colors.flow,
      yAxisID: 'yMain',
      pointRadius: 0,
      borderWidth: STANDARD_LINE_WIDTH,
      tension: 0.2,
      hidden: !visibility.flow,
    },
    {
      label: 'Target F',
      data: model.series.targetFlow,
      borderColor: colors.flow,
      backgroundColor: targetFlowFill,
      fill: false,
      borderDash: [4, 4],
      yAxisID: 'yMain',
      pointRadius: 0,
      borderWidth: THIN_LINE_WIDTH,
      tension: 0,
      hidden: !visibility.targetFlow,
    },
    {
      label: 'Puck Flow',
      data: model.series.puckFlow,
      borderColor: colors.puckFlow,
      backgroundColor: colors.puckFlow,
      fill: false,
      yAxisID: 'yMain',
      pointRadius: 0,
      borderWidth: THIN_LINE_WIDTH,
      tension: 0.2,
      hidden: !visibility.puckFlow,
    },
    {
      label: 'Weight',
      data: model.series.weight,
      borderColor: colors.weight,
      backgroundColor: colors.weight,
      fill: false,
      yAxisID: 'yWeight',
      pointRadius: 0,
      borderWidth: STANDARD_LINE_WIDTH,
      tension: 0.2,
      hidden: !showWeightSeries || !visibility.weight,
    },
    {
      label: 'Weight Flow',
      data: model.series.weightFlow,
      borderColor: colors.weightFlow,
      backgroundColor: colors.weightFlow,
      fill: false,
      yAxisID: 'yMain',
      pointRadius: 0,
      borderWidth: THIN_LINE_WIDTH,
      tension: 0.2,
      hidden: !hasWeightFlowData || !visibility.weightFlow,
    },
    {
      label: WATER_DRAWN_PHASE_LABEL,
      data: model.waterTooltipPhaseSeries,
      borderColor: colors.puckFlow,
      backgroundColor: colors.puckFlow,
      yAxisID: 'yWaterOverlay',
      pointRadius: 0,
      pointHoverRadius: 0,
      pointHitRadius: 12,
      borderWidth: 0,
      showLine: false,
      fill: false,
    },
    {
      label: WATER_DRAWN_TOTAL_LABEL,
      data: model.waterTooltipTotalSeries,
      borderColor: colors.flow,
      backgroundColor: colors.flow,
      yAxisID: 'yWaterOverlay',
      pointRadius: 0,
      pointHoverRadius: 0,
      pointHitRadius: 12,
      borderWidth: 0,
      showLine: false,
      fill: false,
    },
  ];

  // The temperature chart remains intentionally small: it mirrors the shared x-axis
  // while keeping its own left/right temperature scales and fill treatment.
  const tempDatasets = [
    {
      label: 'Temp',
      data: model.series.temp,
      borderColor: colors.temp,
      backgroundColor: tempToTargetFill,
      fill: false,
      yAxisID: 'yTemp',
      pointRadius: 0,
      borderWidth: STANDARD_LINE_WIDTH,
      tension: 0.2,
      hidden: !visibility.temp,
    },
    {
      label: 'Target T',
      data: model.series.targetTemp,
      borderColor: colors.tempTarget,
      backgroundColor: colors.tempTarget,
      borderDash: [4, 4],
      yAxisID: 'yTempRight',
      pointRadius: 0,
      borderWidth: THIN_LINE_WIDTH,
      tension: 0,
      hidden: !visibility.targetTemp,
    },
  ];

  return {
    mainConfig: {
      type: 'line',
      data: { datasets: mainDatasets },
      plugins: [
        phaseBackgroundOverlayPlugin,
        hoverGuidePlugin,
        replayRevealPlugin,
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
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            enabled: false,
            caretSize: 0,
            caretPadding: 0,
            // The external tooltip owns all rendering. The built-in tooltip still
            // provides item ordering/filtering so both paths share one data model.
            filter: context => shouldRenderTooltipLabel(context.dataset.label),
            itemSort: sortTooltipItems,
            callbacks: {
              title: tooltipItems => {
                const xValue = tooltipItems?.[0]?.parsed?.x;
                return Number.isFinite(xValue) ? `${xValue.toFixed(2)} s` : '';
              },
            },
            external: updateExternalTooltip,
          },
          annotation: {
            clip: false,
            annotations: model.phaseAnnotations,
          },
          phaseBackgroundOverlay: {
            ranges: model.phaseBackgroundRanges,
          },
          finalWeightCalloutLine: {
            callouts: [model.phaseAnnotations?.final_weight_callout_meta].filter(Boolean),
          },
          axisUnitLabels: {
            yLabels: mainAxisUnitLabels,
            chartLabels: mainChartInsideLabels,
          },
          phaseLabelOverlay: {
            labels: model.phaseLabelOverlays,
          },
          stopIconOverlay: {
            stops: showStopBadges ? model.stopIconOverlays : [],
          },
          finalWeightBadgeOverlay: {
            labels: [model.phaseAnnotations?.final_weight].filter(Boolean),
          },
        },
        scales: {
          y: {
            display: false,
            grid: { display: false },
            ticks: { display: false },
          },
          x: {
            type: 'linear',
            display: false,
            max: model.maxTime,
            ticks: { display: false },
            grid: { display: false },
          },
          yMain: {
            type: 'linear',
            position: 'left',
            min: 0,
            max: model.mainAxisMax,
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
          yTempOverlay: {
            type: 'linear',
            display: false,
            // Keep temperature series on the main chart only as hover/tooltip proxies.
            // A hidden overlay axis prevents them from distorting the pressure/flow scale.
            min: model.tempAxisMin,
            max: model.tempAxisMax,
            grid: { display: false },
            ticks: { display: false },
          },
          yWaterOverlay: {
            type: 'linear',
            display: false,
            beginAtZero: true,
            // Water values are never drawn directly; this axis only exists so their
            // hidden helper datasets remain valid Chart.js datasets.
            grid: { display: false },
            ticks: { display: false },
          },
          yWeight: {
            type: 'linear',
            display: showWeightAxis,
            position: 'right',
            offset: false,
            beginAtZero: true,
            min: 0,
            max: model.weightAxisMax,
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
    },
    tempConfig: {
      type: 'line',
      data: { datasets: tempDatasets },
      plugins: [phaseBackgroundOverlayPlugin, replayRevealPlugin, axisUnitLabelPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        layout: {
          autoPadding: false,
          padding: tempAxisUnitPadding,
        },
        elements: {
          point: createChartPointElementConfig(),
        },
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            enabled: false,
          },
          annotation: {
            annotations: model.tempPhaseAnnotations,
          },
          phaseBackgroundOverlay: {
            ranges: model.phaseBackgroundRanges,
          },
          axisUnitLabels: {
            yLabels: tempAxisUnitLabels,
            xLabel: 's',
            xLabelPlacement: 'inside',
            xLabelYOffset: 0,
          },
        },
        scales: {
          x: {
            type: 'linear',
            position: 'bottom',
            max: model.maxTime,
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
              display: false,
              drawOnChartArea: false,
            },
            border: {
              display: true,
              color: 'rgba(200, 200, 200, 0.18)',
            },
          },
          yTemp: {
            type: 'linear',
            position: 'left',
            min: model.tempAxisMin,
            max: model.tempAxisMax,
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
          yTempRight: {
            type: 'linear',
            display: showWeightAxis,
            position: 'right',
            min: model.tempAxisMin,
            max: model.tempAxisMax,
            grid: { display: false },
            border: { display: false },
            ticks: {
              display: showWeightAxis,
              font: { size: 10 },
              color: 'rgba(0, 0, 0, 0)',
              callback: formatUniqueAxisTick,
            },
          },
        },
      },
    },
  };
}
