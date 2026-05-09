/**
 * analyzerUtils.js
 * Shared Shot Analyzer constants, storage keys, and formatting helpers.
 */
/**
 * LocalStorage keys used by Analyzer and Statistics shared state.
 */
export const ANALYZER_DB_KEYS = {
  SHOTS: 'gaggimate_shots',
  PROFILES: 'gaggimate_profiles',
  PRESETS: 'gaggimate_column_presets',
  USER_STANDARD: 'gaggimate_user_standard_cols',
  COMPARE_TARGET_DISPLAY_MODE: 'gaggimate_compare_target_display_mode',
  COMPARE_ANNOTATIONS_ENABLED: 'gaggimate_compare_annotations_enabled',
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

/**
 * Column Configuration
 * Defines all available metrics that can be displayed in the analysis table
 * * Properties:
 * - id: Unique identifier
 * - label: Display name
 * - type: 'val' (single value) | 'se' (start/end) | 'mm' (min/max) | 'avg' (average) | 'bool' (boolean)
 * - group: Category for UI grouping
 * - default: Whether to show by default
 * - targetType: Matching profile target type (for highlighting)
 */
export const columnConfig = [
  // --- BASIC METRICS ---
  {
    id: 'duration',
    label: 'Duration (s)',
    type: 'val',
    group: 'basics',
    default: true,
    targetType: 'duration',
  },
  {
    id: 'water',
    label: 'Water Drawn (ml)',
    type: 'val',
    group: 'basics',
    default: true,
    targetType: 'pumped',
  },
  {
    id: 'weight',
    label: 'Weight (g)',
    type: 'val',
    group: 'weight',
    default: true,
    targetType: 'weight',
  },
  {
    id: 'w_se',
    label: 'Weight (g)',
    type: 'se',
    group: 'weight',
    default: false,
  },
  {
    id: 'w_mm',
    label: 'Weight (g)',
    type: 'mm',
    group: 'weight',
    default: false,
  },
  {
    id: 'w_avg',
    label: 'Weight (g)',
    type: 'avg',
    group: 'weight',
    default: false,
  },

  // --- WEIGHT FLOW ---
  {
    id: 'wf_se',
    label: 'Weight Flow (g/s)',
    type: 'se',
    group: 'weightflow',
    default: false,
  },
  {
    id: 'wf_mm',
    label: 'Weight Flow (g/s)',
    type: 'mm',
    group: 'weightflow',
    default: false,
  },
  {
    id: 'wf_avg',
    label: 'Weight Flow (g/s)',
    type: 'avg',
    group: 'weightflow',
    default: false,
  },

  // --- PRESSURE ---
  {
    id: 'p_se',
    label: 'Pressure (bar)',
    type: 'se',
    group: 'pressure',
    default: true,
    targetType: 'pressure',
  },
  {
    id: 'p_mm',
    label: 'Pressure (bar)',
    type: 'mm',
    group: 'pressure',
    default: false,
  },
  {
    id: 'p_avg',
    label: 'Pressure (bar)',
    type: 'avg',
    group: 'pressure',
    default: false,
  },

  // --- TARGET PRESSURE ---
  {
    id: 'tp_se',
    label: 'Target Pressure (bar)',
    type: 'se',
    group: 'target_pressure',
    default: false,
  },
  {
    id: 'tp_mm',
    label: 'Target Pressure (bar)',
    type: 'mm',
    group: 'target_pressure',
    default: false,
  },
  {
    id: 'tp_avg',
    label: 'Target Pressure (bar)',
    type: 'avg',
    group: 'target_pressure',
    default: false,
  },

  // --- FLOW ---
  {
    id: 'f_se',
    label: 'Flow (ml/s)',
    type: 'se',
    group: 'flow',
    default: true,
    targetType: 'flow',
  },
  {
    id: 'f_mm',
    label: 'Flow (ml/s)',
    type: 'mm',
    group: 'flow',
    default: false,
  },
  {
    id: 'f_avg',
    label: 'Flow (ml/s)',
    type: 'avg',
    group: 'flow',
    default: false,
  },

  // --- TARGET FLOW ---
  {
    id: 'tf_se',
    label: 'Target Flow (ml/s)',
    type: 'se',
    group: 'target_flow',
    default: false,
  },
  {
    id: 'tf_mm',
    label: 'Target Flow (ml/s)',
    type: 'mm',
    group: 'target_flow',
    default: false,
  },
  {
    id: 'tf_avg',
    label: 'Target Flow (ml/s)',
    type: 'avg',
    group: 'target_flow',
    default: false,
  },

  // --- PUCK FLOW (Resistance) ---
  {
    id: 'pf_se',
    label: 'Puck Flow (ml/s)',
    type: 'se',
    group: 'puckflow',
    default: true,
  },
  {
    id: 'pf_mm',
    label: 'Puck Flow (ml/s)',
    type: 'mm',
    group: 'puckflow',
    default: false,
  },
  {
    id: 'pf_avg',
    label: 'Puck Flow (ml/s)',
    type: 'avg',
    group: 'puckflow',
    default: false,
  },

  // --- TEMPERATURE ---
  {
    id: 't_se',
    label: 'Temperature (℃)',
    type: 'se',
    group: 'temp',
    default: false,
  },
  {
    id: 't_mm',
    label: 'Temperature (℃)',
    type: 'mm',
    group: 'temp',
    default: false,
  },
  {
    id: 't_avg',
    label: 'Temperature (℃)',
    type: 'avg',
    group: 'temp',
    default: true,
  },

  // --- TARGET TEMPERATURE ---
  {
    id: 'tt_se',
    label: 'Target Temp (℃)',
    type: 'se',
    group: 'target_temp',
    default: false,
  },
  {
    id: 'tt_mm',
    label: 'Target Temp (℃)',
    type: 'mm',
    group: 'target_temp',
    default: false,
  },
  {
    id: 'tt_avg',
    label: 'Target Temp (℃)',
    type: 'avg',
    group: 'target_temp',
    default: false,
  },

  // --- SYSTEM INFO ---
  {
    id: 'sys_raw',
    label: 'Raw Data Points',
    type: 'val',
    group: 'system',
    default: false,
  },
  {
    id: 'sys_shot_vol',
    label: 'Start Volumetric',
    type: 'bool',
    group: 'system',
    default: false,
  },
  {
    id: 'sys_curr_vol',
    label: 'Currently Volumetric',
    type: 'bool',
    group: 'system',
    default: false,
  },
  {
    id: 'sys_scale',
    label: 'BT Scale Connected',
    type: 'bool',
    group: 'system',
    default: false,
  },
  {
    id: 'sys_vol_avail',
    label: 'Volumetric Avail.',
    type: 'bool',
    group: 'system',
    default: false,
  },
  {
    id: 'sys_ext',
    label: 'Extended Record',
    type: 'bool',
    group: 'system',
    default: false,
  },
];

/**
 * Group Labels for UI
 * Maps group IDs to human-readable names
 */
export const groups = {
  basics: 'Basic Metrics',
  pressure: 'Pressure (bar)',
  target_pressure: 'Target Pressure (bar)',
  flow: 'Pump Flow (ml/s)',
  target_flow: 'Target Flow (ml/s)',
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
  predictionStopRed: 'var(--analyzer-pred-stop-red)',
  predictionInfoBlue: 'var(--analyzer-pred-info-blue)',
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

export const notesTasteStyles = {
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

/**
 * Tailwind Color Classes for Groups
 */
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

/**
 * Helper Functions
 */

/**
 * Get ALL columns
 * Returns Set of ALL column IDs (for "All" Preset)
 * @returns {Set<string>}
 */
export const getAllColumns = () => {
  const all = new Set();
  columnConfig.forEach(col => all.add(col.id));
  return all;
};

/**
 * Get all column IDs for one logical group.
 * Used by built-in presets such as "System Info".
 * @param {string} groupKey - Column group ID
 * @returns {Set<string>}
 */
export const getColumnsByGroup = groupKey => {
  const columns = new Set();
  columnConfig.forEach(col => {
    if (col.group === groupKey) columns.add(col.id);
  });
  return columns;
};

/**
 * Remove .json extension from filename
 * @param {string} name - Filename
 * @returns {string} Clean name
 */
export const cleanName = name => {
  if (!name) return '';
  return name.replace(/\.json$/i, '');
};

export const getProfileDisplayLabel = (profile, fallback = 'Unknown') => {
  if (typeof profile === 'string') {
    return cleanName(profile).trim() || fallback;
  }

  const rawLabel =
    profile?.label ||
    profile?.data?.label ||
    profile?.name ||
    profile?.data?.name ||
    profile?.fileName ||
    profile?.data?.fileName ||
    profile?.exportName ||
    profile?.data?.exportName ||
    fallback;
  return cleanName(String(rawLabel || '')).trim() || fallback;
};

export const normalizeCompareTargetDisplayMode = value => {
  if (value === COMPARE_TARGET_DISPLAY_MODES.NONE) return value;
  if (value === COMPARE_TARGET_DISPLAY_MODES.MAIN_SHOT_ONLY) return value;
  if (value === COMPARE_TARGET_DISPLAY_MODES.PER_SHOT) return value;
  return COMPARE_TARGET_DISPLAY_MODES.NONE;
};

export const getShotIdentityKey = shot => {
  if (!shot) return '';

  const source = shot.source || 'temp';
  if (source === 'gaggimate') {
    return `gaggimate:${String(shot.id || '')}`;
  }
  if (source === 'temp') {
    return `temp:${String(shot.storageKey || shot.name || shot.id || '')}`;
  }

  return `browser:${String(shot.storageKey || shot.name || shot.id || '')}`;
};

export const getProfilePinKey = profile => {
  let rawValue = '';
  if (!profile) return '';

  if (typeof profile === 'string') {
    rawValue = profile;
  } else {
    rawValue =
      profile.canonicalProfileName ||
      profile.profileName ||
      profile.profile ||
      profile.label ||
      profile.data?.label ||
      profile.name ||
      profile.data?.name ||
      profile.fileName ||
      profile.data?.fileName ||
      profile.exportName ||
      profile.data?.exportName ||
      '';
  }

  const normalized = cleanName(rawValue).trim().toLowerCase();
  return normalized === 'no profile loaded' ? '' : normalized;
};

export const getShotPinBucketKey = shot => {
  const profileKey = getProfilePinKey(shot);
  return profileKey || PINNED_NO_PROFILE_BUCKET;
};

function normalizePinnedProfiles(rawValue) {
  if (!Array.isArray(rawValue)) return [];

  const seen = new Set();
  const normalized = [];
  for (const entry of rawValue) {
    // Persist only canonical profile keys so Analyzer and Statistics can share
    // the same pin state even when the backing source differs.
    const key = getProfilePinKey(entry);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    normalized.push(key);
  }
  return normalized;
}

function normalizePinnedShotsByProfile(rawValue) {
  if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) return {};

  const normalized = {};

  Object.entries(rawValue).forEach(([bucketKey, shotKeys]) => {
    // Each bucket represents one profile context (or the explicit no-profile
    // bucket), so duplicates need to be removed per bucket instead of globally.
    const resolvedBucketKey = String(bucketKey || '').trim() || PINNED_NO_PROFILE_BUCKET;
    if (!Array.isArray(shotKeys)) return;

    const seen = new Set();
    const normalizedShotKeys = [];
    shotKeys.forEach(shotKey => {
      const nextShotKey = String(shotKey || '').trim();
      if (!nextShotKey || seen.has(nextShotKey)) return;
      seen.add(nextShotKey);
      normalizedShotKeys.push(nextShotKey);
    });

    if (normalizedShotKeys.length > 0) {
      normalized[resolvedBucketKey] = normalizedShotKeys;
    }
  });

  return normalized;
}

export const getPinnedProfiles = () =>
  normalizePinnedProfiles(loadFromStorage(ANALYZER_DB_KEYS.PINNED_PROFILES, []));

export const getPinnedShotsByProfile = () =>
  normalizePinnedShotsByProfile(loadFromStorage(ANALYZER_DB_KEYS.PINNED_SHOTS_BY_PROFILE, {}));

export const isProfilePinned = (profile, pinnedProfiles = getPinnedProfiles()) =>
  pinnedProfiles.includes(getProfilePinKey(profile));

export const isShotPinned = (
  shot,
  bucketKey = getShotPinBucketKey(shot),
  pinnedShotsByProfile = getPinnedShotsByProfile(),
) => {
  const shotKey = typeof shot === 'string' ? shot : getShotIdentityKey(shot);
  if (!shotKey) return false;
  return (pinnedShotsByProfile[bucketKey] || []).includes(shotKey);
};

export const isShotPinnedAnywhere = (shot, pinnedShotsByProfile = getPinnedShotsByProfile()) => {
  const shotKey = typeof shot === 'string' ? shot : getShotIdentityKey(shot);
  if (!shotKey) return false;
  return Object.values(pinnedShotsByProfile).some(bucket => bucket.includes(shotKey));
};

export const toggleProfilePin = profile => {
  const profileKey = getProfilePinKey(profile);
  const pinnedProfiles = getPinnedProfiles();
  if (!profileKey) {
    return { changed: false, reason: 'invalid-profile', pinnedProfiles };
  }

  const isPinned = pinnedProfiles.includes(profileKey);
  if (!isPinned && pinnedProfiles.length >= MAX_PINNED_PROFILES) {
    return { changed: false, reason: 'profile-limit', pinnedProfiles };
  }

  const nextPinnedProfiles = isPinned
    ? pinnedProfiles.filter(entry => entry !== profileKey)
    : [...pinnedProfiles, profileKey];

  saveToStorage(ANALYZER_DB_KEYS.PINNED_PROFILES, nextPinnedProfiles);
  return { changed: true, reason: null, pinnedProfiles: nextPinnedProfiles, profileKey };
};

export const toggleShotPin = (shot, explicitBucketKey = '') => {
  const shotKey = typeof shot === 'string' ? shot : getShotIdentityKey(shot);
  const bucketKey = explicitBucketKey || getShotPinBucketKey(shot);
  const pinnedShotsByProfile = getPinnedShotsByProfile();

  if (!shotKey) {
    return { changed: false, reason: 'invalid-shot', pinnedShotsByProfile, bucketKey };
  }

  // Shot pins are scoped to the active profile bucket so the same shot can be
  // promoted differently depending on which profile context is currently active.
  const currentBucket = [...(pinnedShotsByProfile[bucketKey] || [])];
  const isPinned = currentBucket.includes(shotKey);

  if (!isPinned && currentBucket.length >= MAX_PINNED_SHOTS_PER_PROFILE) {
    return { changed: false, reason: 'shot-limit', pinnedShotsByProfile, bucketKey };
  }

  const nextBucket = isPinned
    ? currentBucket.filter(entry => entry !== shotKey)
    : [...currentBucket, shotKey];

  const nextPinnedShotsByProfile = { ...pinnedShotsByProfile };
  if (nextBucket.length > 0) {
    nextPinnedShotsByProfile[bucketKey] = nextBucket;
  } else {
    delete nextPinnedShotsByProfile[bucketKey];
  }

  saveToStorage(ANALYZER_DB_KEYS.PINNED_SHOTS_BY_PROFILE, nextPinnedShotsByProfile);
  return {
    changed: true,
    reason: null,
    pinnedShotsByProfile: nextPinnedShotsByProfile,
    bucketKey,
    shotKey,
  };
};

export const getShotDisplayName = shot => {
  if (!shot) return 'Unknown';

  if (shot.source === 'gaggimate') {
    return `#${shot.id || shot.name || 'Unknown'}`;
  }

  return cleanName(shot.name || shot.storageKey || shot.id || 'Unknown');
};

/**
 * Format timestamp to localized string
 * @param {number} timestamp - Unix timestamp (seconds or milliseconds)
 * @returns {string} Formatted date/time
 */
export const formatTimestamp = timestamp => {
  if (!timestamp) return '';

  // Convert to milliseconds if needed
  const ms = timestamp < 10000000000 ? timestamp * 1000 : timestamp;

  return new Date(ms).toLocaleString([], {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Format duration from samples
 * @param {Array} samples - Shot samples
 * @returns {string} Duration in seconds
 */
export const formatDuration = samples => {
  if (!samples || samples.length === 0) return '0s';

  const duration = (samples[samples.length - 1].t - samples[0].t) / 1000;
  return `${duration.toFixed(1)}s`;
};

/**
 * Auto-detect dose in from profile name (e.g., "18g Turbo")
 * Accepts only one standalone gram value in the 0-30g range and ignores
 * ranges or ambiguous patterns such as "10-20g" or "10 to 20 g".
 * @param {string} profileName - Profile name
 * @returns {number|null} Detected dose or null
 */
const MAX_AUTO_DETECTED_DOSE_GRAMS = 30;
const RANGE_SEPARATOR_CHARS = new Set(['-', '–', '—', '−']);

function isDigitChar(char) {
  return char >= '0' && char <= '9';
}

function isAsciiLetterChar(char) {
  return char >= 'a' && char <= 'z';
}

function isWhitespaceChar(char) {
  return char === ' ' || char === '\n' || char === '\r' || char === '\t';
}

function skipWhitespaceForward(text, index) {
  let cursor = index;
  while (cursor < text.length && isWhitespaceChar(text[cursor])) {
    cursor += 1;
  }
  return cursor;
}

function skipWhitespaceBackward(text, index) {
  let cursor = index;
  while (cursor >= 0 && isWhitespaceChar(text[cursor])) {
    cursor -= 1;
  }
  return cursor;
}

function readAsciiWordForward(text, index) {
  let cursor = index;
  while (cursor < text.length && isAsciiLetterChar(text[cursor])) {
    cursor += 1;
  }
  return text.slice(index, cursor);
}

function readAsciiWordBackward(text, index) {
  let cursor = index;
  while (cursor >= 0 && isAsciiLetterChar(text[cursor])) {
    cursor -= 1;
  }
  return text.slice(cursor + 1, index + 1);
}

function readDoseNumberToken(text, index) {
  let cursor = index;
  let seenDecimalSeparator = false;

  while (cursor < text.length) {
    const char = text[cursor];
    if (isDigitChar(char)) {
      cursor += 1;
      continue;
    }

    const nextChar = text[cursor + 1];
    const previousChar = text[cursor - 1];
    if (
      char === '.' &&
      !seenDecimalSeparator &&
      isDigitChar(previousChar) &&
      isDigitChar(nextChar)
    ) {
      seenDecimalSeparator = true;
      cursor += 1;
      continue;
    }

    break;
  }

  if (cursor === index) return null;

  return {
    raw: text.slice(index, cursor),
    end: cursor,
  };
}

function isRangeValueBefore(text, numberStart) {
  const previousTokenIndex = skipWhitespaceBackward(text, numberStart - 1);
  if (previousTokenIndex < 0) return false;

  const previousChar = text[previousTokenIndex];
  if (RANGE_SEPARATOR_CHARS.has(previousChar)) {
    const beforeSeparatorIndex = skipWhitespaceBackward(text, previousTokenIndex - 1);
    return (
      beforeSeparatorIndex >= 0 &&
      (isDigitChar(text[beforeSeparatorIndex]) || text[beforeSeparatorIndex] === 'g')
    );
  }

  if (!isAsciiLetterChar(previousChar)) return false;

  const previousWord = readAsciiWordBackward(text, previousTokenIndex);
  if (previousWord !== 'to') return false;

  const beforeWordIndex = skipWhitespaceBackward(text, previousTokenIndex - previousWord.length);
  return beforeWordIndex >= 0 && isDigitChar(text[beforeWordIndex]);
}

function isRangeValueAfter(text, unitIndex) {
  const nextTokenIndex = skipWhitespaceForward(text, unitIndex + 1);
  if (nextTokenIndex >= text.length) return false;

  const nextChar = text[nextTokenIndex];
  if (RANGE_SEPARATOR_CHARS.has(nextChar)) {
    const afterSeparatorIndex = skipWhitespaceForward(text, nextTokenIndex + 1);
    return afterSeparatorIndex < text.length && isDigitChar(text[afterSeparatorIndex]);
  }

  if (!isAsciiLetterChar(nextChar)) return false;

  const nextWord = readAsciiWordForward(text, nextTokenIndex);
  if (nextWord !== 'to') return false;

  const afterWordIndex = skipWhitespaceForward(text, nextTokenIndex + nextWord.length);
  return afterWordIndex < text.length && isDigitChar(text[afterWordIndex]);
}

function readDoseCandidate(text, startIndex) {
  const numberToken = readDoseNumberToken(text, startIndex);
  if (!numberToken) {
    return { nextIndex: startIndex + 1, value: null };
  }

  const unitIndex = skipWhitespaceForward(text, numberToken.end);
  if (unitIndex >= text.length || text[unitIndex] !== 'g') {
    return {
      nextIndex: Math.max(startIndex + 1, numberToken.end),
      value: null,
    };
  }

  const charAfterUnit = text[unitIndex + 1];
  if (charAfterUnit && (isAsciiLetterChar(charAfterUnit) || isDigitChar(charAfterUnit))) {
    return {
      nextIndex: unitIndex + 1,
      value: null,
    };
  }

  if (isRangeValueBefore(text, startIndex) || isRangeValueAfter(text, unitIndex)) {
    return {
      nextIndex: unitIndex + 1,
      value: null,
    };
  }

  const value = Number.parseFloat(numberToken.raw);
  return {
    nextIndex: unitIndex + 1,
    value:
      Number.isFinite(value) && value > 0 && value <= MAX_AUTO_DETECTED_DOSE_GRAMS ? value : null,
  };
}

export const detectDoseFromProfileName = profileName => {
  if (!profileName) return null;

  const lower = profileName.toLowerCase();
  const candidates = [];

  let cursor = 0;
  while (cursor < lower.length) {
    if (!isDigitChar(lower[cursor])) {
      cursor += 1;
      continue;
    }

    const candidate = readDoseCandidate(lower, cursor);
    if (candidate.value !== null) {
      candidates.push(candidate.value);
    }
    cursor = candidate.nextIndex;
  }

  return candidates.length === 1 ? candidates[0] : null;
};

/**
 * Calculate ratio from doses
 * @param {number} doseIn - Input dose
 * @param {number} doseOut - Output dose
 * @returns {number|null} Ratio or null
 */
export const calculateRatio = (doseIn, doseOut) => {
  if (!doseIn || !doseOut || doseIn <= 0) return null;
  return parseFloat((doseOut / doseIn).toFixed(2));
};

/**
 * Get default columns
 * Returns Set of default column IDs
 * @returns {Set<string>}
 */
export const getDefaultColumns = () => {
  const defaults = new Set();
  columnConfig.forEach(col => {
    if (col.default) defaults.add(col.id);
  });
  return defaults;
};

/**
 * Group columns by group ID
 * @returns {Object} Grouped columns
 */
export const getGroupedColumns = () => {
  const grouped = {};

  columnConfig.forEach(col => {
    if (!grouped[col.group]) {
      grouped[col.group] = [];
    }
    grouped[col.group].push(col);
  });

  return grouped;
};

/**
 * Storage Helper: Save to localStorage
 * @param {string} key - Storage key
 * @param {any} value - Value to store
 */
export const saveToStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
};

/**
 * Storage Helper: Load from localStorage
 * @param {string} key - Storage key
 * @param {any} defaultValue - Default value if not found
 * @returns {any} Stored value or default
 */
export const loadFromStorage = (key, defaultValue = null) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    console.error('Failed to load from localStorage:', e);
    return defaultValue;
  }
};

/**
 * Get sorted and filtered library items
 * @param {string} collectionKey - ANALYZER_DB_KEYS value
 * @param {Object} options - { search, sortKey, sortOrder }
 * @returns {Array} Sorted items
 */
export const getSortedLibrary = (collectionKey, options = {}) => {
  const { search = '', sortKey = 'shotDate', sortOrder = 'desc' } = options;

  const raw = loadFromStorage(collectionKey, []);
  const orderMult = sortOrder === 'asc' ? 1 : -1;

  // Filter by search
  let items = raw;
  if (search) {
    const searchLower = search.toLowerCase();
    items = raw.filter(item => {
      const name = (item.name || '').toLowerCase();
      const profile = (item.profileName || '').toLowerCase();
      return name.includes(searchLower) || profile.includes(searchLower);
    });
  }

  // Sort
  return items.sort((a, b) => {
    let valA = a[sortKey];
    let valB = b[sortKey];

    // Handle nested properties (e.g., 'data.rating')
    if (sortKey === 'data.rating') {
      valA = a.data?.rating || 0;
      valB = b.data?.rating || 0;
    } else if (sortKey === 'duration') {
      valA = parseFloat(a.duration || 0);
      valB = parseFloat(b.duration || 0);
    } else {
      valA = valA || '';
      valB = valB || '';
    }

    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();

    if (valA < valB) return -1 * orderMult;
    if (valA > valB) return 1 * orderMult;
    return 0;
  });
};

/**
 * Save item to library
 * @param {string} collection - Collection key
 * @param {string} fileName - File name
 * @param {Object} data - Data to save
 */
export const saveToLibrary = (collection, fileName, data) => {
  const library = loadFromStorage(collection, []);
  const displayName =
    collection === ANALYZER_DB_KEYS.PROFILES && data.label ? data.label : fileName;

  const existingIndex = library.findIndex(item => item.name === displayName);

  const entry = {
    name: displayName,
    fileName,
    saveDate: Date.now(),
    shotDate: data.timestamp ? data.timestamp * 1000 : Date.now(),
    profileName: data.profile || 'Manual/Unknown',
    duration: data.samples?.length
      ? ((data.samples[data.samples.length - 1].t - data.samples[0].t) / 1000).toFixed(1)
      : 0,
    data,
  };

  if (existingIndex > -1) {
    library[existingIndex] = entry;
  } else {
    library.push(entry);
  }

  saveToStorage(collection, library);
};

/**
 * Delete item from library
 * @param {string} collection - Collection key
 * @param {string} name - Item name
 */
export const deleteFromLibrary = (collection, name) => {
  const library = loadFromStorage(collection, []);
  const filtered = library.filter(i => i.name !== name);
  saveToStorage(collection, filtered);
};

/**
 * Clear entire library
 * @param {string} collection - Collection key
 */
export const clearLibrary = collection => {
  saveToStorage(collection, []);
};

// Helper style for CSS Masking
