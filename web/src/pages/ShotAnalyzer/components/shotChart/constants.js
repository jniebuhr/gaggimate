export const TARGET_FLOW_MAX = 12;
export const TARGET_PRESSURE_MAX = 16;
export const STANDARD_LINE_WIDTH = 4;
export const THIN_LINE_WIDTH = STANDARD_LINE_WIDTH / 2;

export const BREW_BY_TIME_LABEL = 'BREW BY TIME';
export const BREW_BY_WEIGHT_LABEL = 'BREW BY WEIGHT';

export const MAIN_CHART_HEIGHT_SMALL = 280;
export const MAIN_CHART_HEIGHT_BIG = 560;
export const MAIN_CHART_HEIGHT_DEFAULT = MAIN_CHART_HEIGHT_SMALL;
export const TEMP_CHART_HEIGHT_RATIO = 80 / MAIN_CHART_HEIGHT_SMALL;

export const REPLAY_TARGET_FPS = 30;
export const REPLAY_FRAME_INTERVAL_MS = 1000 / REPLAY_TARGET_FPS;

export const DEFAULT_REPLAY_EXPORT_CONFIG = {
  exportType: 'video',
  exportFormat: 'mp4',
  includeLegend: false,
  layoutPreset: 'chart_native',
  videoSource: null,
  videoCrop: null,
  chartPlacement: null,
};

export function getReplayExportStatusLabel(status, exportFormat = 'mp4') {
  switch (status) {
    case 'idle':
      return '';
    case 'preparing':
      return exportFormat === 'webm' ? 'Preparing WebM export...' : 'Preparing MP4 export...';
    case 'renderingImage':
      return 'Rendering PNG export...';
    case 'preparingJson':
      return 'Preparing shot JSON...';
    case 'recording':
      return 'Recording replay...';
    case 'downloading':
      return 'Downloading export...';
    case 'error':
      return 'Replay export failed.';
    default:
      return '';
  }
}

export function getReplayExportStatusHint() {
  return '';
}

export const EXTERNAL_TOOLTIP_FALLBACK_OFFSET_X = 12;
export const EXTERNAL_TOOLTIP_POINTER_GAP = 10;
export const EXTERNAL_TOOLTIP_BOUNDS_PADDING = 4;
export const EXTERNAL_TOOLTIP_VERTICAL_OFFSET = 0;

export const CHART_COLOR_FALLBACKS = {
  temp: '#F0561D',
  tempTarget: '#731F00',
  pressure: '#0066CC',
  flow: '#63993D',
  puckFlow: '#059669',
  weight: '#8B5CF6',
  weightFlow: '#6d28d9',
  phaseLine: 'rgba(107, 114, 128, 0.5)',
  stopLabel: 'rgba(220, 38, 38, 0.85)',
};

export const CHART_COLOR_TOKEN_MAP = {
  temp: '--analyzer-temp-anchor',
  tempTarget: '--analyzer-target-temp-anchor',
  pressure: '--analyzer-pressure-anchor',
  flow: '--analyzer-flow-anchor',
  puckFlow: '--analyzer-puckflow-anchor',
  weight: '--analyzer-weight-anchor',
  weightFlow: '--analyzer-weightflow-anchor',
  phaseLine: '--analyzer-phase-line',
  stopLabel: '--analyzer-stop-label',
};

export const WATER_DRAWN_PHASE_LABEL = 'Water Drawn (Phase)';
export const WATER_DRAWN_TOTAL_LABEL = 'Water Drawn (Total)';

export const LEGEND_BLOCK_LABELS = new Set(['Phase Names', 'Stops']);
export const LEGEND_DASHED_LABELS = new Set(['Target T', 'Target P', 'Target F']);
export const LEGEND_THIN_LINE_LABELS = new Set([
  'Target T',
  'Target P',
  'Target F',
  'Puck Flow',
  'Weight',
  'Weight Flow',
]);

export const TOOLTIP_WATER_LABELS = new Set([WATER_DRAWN_PHASE_LABEL, WATER_DRAWN_TOTAL_LABEL]);
export const TOOLTIP_BOTTOM_LABELS = new Set(['Temp', 'Target T']);

export const LEGEND_ORDER = [
  'Phase Names',
  'Stops',
  'Pressure',
  'Target P',
  'Flow',
  'Target F',
  'Puck Flow',
  'Weight',
  'Weight Flow',
  'Temp',
  'Target T',
];

export const TOOLTIP_ORDER = [
  'Phase Names',
  'Stops',
  'Pressure',
  'Target P',
  'Flow',
  'Target F',
  'Puck Flow',
  'Weight Flow',
  'Weight',
  WATER_DRAWN_PHASE_LABEL,
  WATER_DRAWN_TOTAL_LABEL,
  'Temp',
  'Target T',
];

export const TOOLTIP_INDEX = TOOLTIP_ORDER.reduce((acc, label, index) => {
  acc[label] = index;
  return acc;
}, {});

export const TOOLTIP_GROUP_BY_LABEL = {
  Pressure: 'pressure',
  'Target P': 'pressure',
  Flow: 'flow',
  'Target F': 'flow',
  'Puck Flow': 'flow',
  Weight: 'weight',
  'Weight Flow': 'weight',
  [WATER_DRAWN_PHASE_LABEL]: 'water',
  [WATER_DRAWN_TOTAL_LABEL]: 'water',
  Temp: 'temp',
  'Target T': 'temp',
};

export const VISIBILITY_KEY_BY_LABEL = {
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
};

export const INITIAL_VISIBILITY = {
  phaseNames: true,
  stops: true,
  temp: true,
  targetTemp: true,
  pressure: true,
  targetPressure: true,
  flow: true,
  targetFlow: true,
  puckFlow: true,
  weight: true,
  weightFlow: true,
};

export const UNIT_BY_LABEL = {
  Temp: '°C',
  'Target T': '°C',
  Pressure: 'bar',
  'Target P': 'bar',
  Flow: 'ml/s',
  'Target F': 'ml/s',
  'Puck Flow': 'ml/s',
  Weight: 'g',
  'Weight Flow': 'g/s',
  [WATER_DRAWN_PHASE_LABEL]: 'ml',
  [WATER_DRAWN_TOTAL_LABEL]: 'ml',
};
