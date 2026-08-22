export const SHOT_STYLE_PRESETS = {
  analyzer: {
    opacities: [1, 0.46, 0.34, 0.26, 0.2, 0.15],
    lineWidths: [3.4, 3, 2.65, 2.3, 2.05, 1.8],
  },
  statistics: {
    opacities: [0.58, 0.46, 0.34, 0.28, 0.24, 0.22],
    lineWidths: [3.05, 2.85, 2.6, 2.4, 2.2, 2.05],
  },
};

export const DETAIL_CHART_HEIGHT_SMALL = 180;

export const DETAIL_CHART_HEIGHT_BIG = 220;

export const DETAIL_CHART_HEIGHT_FULL = 260;

export const COMPARE_MARKER_TOP_PADDING = 48;

export const COMPARE_ALIGNMENT_SHOT_START = 'shotStart';

export const COMPARE_ALIGNMENT_PHASE_PREFIX = 'phase:';

export const COMPARE_STYLE_LINE_PATTERN = 'linePattern';

export const COMPARE_STYLE_FADE = 'fade';

const MOBILE_COMPARE_CONTEXT_LEGEND_LABELS = ['Phases', 'Stops'];

export const MOBILE_COMPARE_FIXED_SERIES_LABELS = ['Pressure', 'Target P', 'Pump Flow', 'Target F'];

export const MOBILE_COMPARE_CONTEXT_LABEL_SET = new Set(MOBILE_COMPARE_CONTEXT_LEGEND_LABELS);

export const COMPARE_LEGEND_KEY_BY_LABEL = {
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

export const DETAIL_CHARTS = [
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
