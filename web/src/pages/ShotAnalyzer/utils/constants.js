export const ANALYZER_DB_KEYS = {
  SHOTS: 'gaggimate_shots',
  PROFILES: 'gaggimate_profiles',
  PRESETS: 'gaggimate_column_presets',
  USER_STANDARD: 'gaggimate_user_standard_cols',
  SINGLE_CHART_VISIBILITY: 'gaggimate_single_chart_visibility',
  COMPARE_TARGET_DISPLAY_MODE: 'gaggimate_compare_target_display_mode',
  COMPARE_ANNOTATIONS_ENABLED: 'gaggimate_compare_annotations_enabled',
  COMPARE_CHART_VISIBILITY: 'gaggimate_compare_chart_visibility',
  LIBRARY_SHOTS_SOURCE_FILTER: 'gaggimate_library_shots_source_filter',
  LIBRARY_PROFILES_SOURCE_FILTER: 'gaggimate_library_profiles_source_filter',
  PINNED_PROFILES: 'gaggimate_pinned_profiles',
  PINNED_SHOTS_BY_PROFILE: 'gaggimate_pinned_shots_by_profile',
};

export const MAX_PINNED_PROFILES = 10;
export const MAX_PINNED_SHOTS_PER_PROFILE = 3;
export const PINNED_NO_PROFILE_BUCKET = '__no_profile__';

export const COMPARE_TARGET_DISPLAY_MODES = {
  NONE: 'none',
  PER_SHOT: 'perShot',
  MAIN_SHOT_ONLY: 'mainShotOnly',
};

export const MAX_AUTO_DETECTED_DOSE_GRAMS = 30;

export const TIMESTAMP_SECONDS_THRESHOLD = 10_000_000_000;

export const groups = {
  basics: 'Basic Metrics',
  pressure: 'Pressure (bar)',
  target_pressure: 'Target Pressure (bar)',
  flow: 'Pump Flow (ml/s)',
  target_flow: 'Target Pump Flow (ml/s)',
  puckflow: 'Puck Flow (ml/s)',
  temp: 'Temperature (℃)',
  target_temp: 'Target Temp (℃)',
  weight: 'Weight (g)',
  weightflow: 'Weight Flow (g/s)',
  system: 'System Info',
};

export const utilityColors = {
  stopRed: 'var(--analyzer-pred-stop-red)',
  warningOrange: 'var(--analyzer-warning-orange)',
};

export const analyzerUiColors = {
  warningOrange: 'var(--analyzer-warning-orange)',
  warningOrangeStrong: 'var(--analyzer-warning-orange-strong)',
  warningOrangeShadow: 'var(--analyzer-warning-orange-shadow)',
  sourceBadgeGmBg: 'var(--analyzer-source-gm-badge-bg)',
  sourceBadgeGmBorder: 'var(--analyzer-source-gm-badge-border)',
  sourceBadgeGmText: 'var(--analyzer-source-gm-badge-text)',
  sourceBadgeWebBg: 'var(--analyzer-source-web-badge-bg)',
  sourceBadgeWebBorder: 'var(--analyzer-source-web-badge-border)',
  sourceBadgeWebText: 'var(--analyzer-source-web-badge-text)',
  brewByTimeLabelBg: 'var(--analyzer-brew-by-time-label-bg)',
  brewByTimeLabelBorder: 'var(--analyzer-brew-by-time-label-border)',
  brewByTimeLabelText: 'var(--analyzer-brew-by-time-label-text)',
  brewByWeightLabelBg: 'var(--analyzer-brew-by-weight-label-bg)',
  brewByWeightLabelBorder: 'var(--analyzer-brew-by-weight-label-border)',
  brewByWeightLabelText: 'var(--analyzer-brew-by-weight-label-text)',
  notesTasteBitter: 'var(--analyzer-notes-taste-bitter)',
  notesTasteBalanced: 'var(--analyzer-notes-taste-balanced)',
  notesTasteSour: 'var(--analyzer-notes-taste-sour)',
  phaseLine: 'var(--analyzer-phase-line)',
  stopLabel: 'var(--analyzer-stop-label)',
};

const notesTasteStyles = {
  bitter: {
    color: analyzerUiColors.notesTasteBitter,
    borderColor: analyzerUiColors.notesTasteBitter,
    selectedBackground: 'color-mix(in srgb, var(--analyzer-notes-taste-bitter) 12%, transparent)',
  },
  balanced: {
    color: analyzerUiColors.notesTasteBalanced,
    borderColor: analyzerUiColors.notesTasteBalanced,
    selectedBackground: 'color-mix(in srgb, var(--analyzer-notes-taste-balanced) 12%, transparent)',
  },
  sour: {
    color: analyzerUiColors.notesTasteSour,
    borderColor: analyzerUiColors.notesTasteSour,
    selectedBackground: 'color-mix(in srgb, var(--analyzer-notes-taste-sour) 12%, transparent)',
  },
};

export const getNotesTasteStyle = taste => notesTasteStyles[taste] || null;

export const groupColors = {
  basics: {
    bg: 'bg-base-content/5',
    text: 'text-base-content',
    anchor: '#64748b',
  },
  pressure: {
    bg: 'bg-blue-500/5',
    text: 'text-[var(--analyzer-pressure-text)]',
    anchor: 'var(--analyzer-pressure-anchor)',
  },
  target_pressure: {
    bg: 'bg-blue-500/5',
    text: 'text-[var(--analyzer-target-pressure-text)]',
    anchor: 'var(--analyzer-target-pressure-anchor)',
  },
  flow: {
    bg: 'bg-green-500/5',
    text: 'text-[var(--analyzer-flow-text)]',
    anchor: 'var(--analyzer-flow-anchor)',
  },
  target_flow: {
    bg: 'bg-green-500/5',
    text: 'text-[var(--analyzer-target-flow-text)]',
    anchor: 'var(--analyzer-target-flow-anchor)',
  },
  puckflow: {
    bg: 'bg-emerald-500/5',
    text: 'text-[var(--analyzer-puckflow-text)]',
    anchor: 'var(--analyzer-puckflow-anchor)',
  },
  temp: {
    bg: 'bg-orange-500/5',
    text: 'text-[var(--analyzer-temp-text)]',
    anchor: 'var(--analyzer-temp-anchor)',
  },
  target_temp: {
    bg: 'bg-orange-500/5',
    text: 'text-[var(--analyzer-target-temp-text)]',
    anchor: 'var(--analyzer-target-temp-anchor)',
  },
  weight: {
    bg: 'bg-violet-500/5',
    text: 'text-[var(--analyzer-weight-text)]',
    anchor: 'var(--analyzer-weight-anchor)',
  },
  weightflow: {
    bg: 'bg-violet-500/5',
    text: 'text-[var(--analyzer-weightflow-text)]',
    anchor: 'var(--analyzer-weightflow-anchor)',
  },
  system: {
    bg: 'bg-base-content/5',
    text: 'text-base-content',
    anchor: '#475569',
  },
};
