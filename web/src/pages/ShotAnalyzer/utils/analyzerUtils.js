/**
 * analyzerUtils.js
 * * Configuration and utility functions for Shot Analyzer
 * * Contains:
 * - Column definitions for analysis table
 * - Group labels for UI organization
 * - Storage keys for localStorage
 * - Helper functions for data formatting
 */

import DeepDiveLogoOutline from '../assets/deepdive.svg';

/**
 * LocalStorage Keys for Analyzer Data
 */
export const ANALYZER_DB_KEYS = {
  SHOTS: 'gaggimate_shots',
  PROFILES: 'gaggimate_profiles',
  PRESETS: 'gaggimate_column_presets',
  USER_STANDARD: 'gaggimate_user_standard_cols',
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
    label: 'Target Pressure',
    type: 'se',
    group: 'target_pressure',
    default: false,
  },
  {
    id: 'tp_mm',
    label: 'Target Pressure',
    type: 'mm',
    group: 'target_pressure',
    default: false,
  },
  {
    id: 'tp_avg',
    label: 'Target Pressure',
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
    label: 'Target Flow',
    type: 'se',
    group: 'target_flow',
    default: false,
  },
  {
    id: 'tf_mm',
    label: 'Target Flow',
    type: 'mm',
    group: 'target_flow',
    default: false,
  },
  {
    id: 'tf_avg',
    label: 'Target Flow',
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
    label: 'Target Temp',
    type: 'se',
    group: 'target_temp',
    default: false,
  },
  {
    id: 'tt_mm',
    label: 'Target Temp',
    type: 'mm',
    group: 'target_temp',
    default: false,
  },
  {
    id: 'tt_avg',
    label: 'Target Temp',
    type: 'avg',
    group: 'target_temp',
    default: false,
  },

  // --- WEIGHT DETAILS ---
  {
    id: 'w_se',
    label: 'Weight Details (g)',
    type: 'se',
    group: 'weight_det',
    default: false,
  },
  {
    id: 'w_mm',
    label: 'Weight Details (g)',
    type: 'mm',
    group: 'weight_det',
    default: false,
  },
  {
    id: 'w_avg',
    label: 'Weight Details (g)',
    type: 'avg',
    group: 'weight_det',
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
  weight_det: 'Weight Details (g)',
  system: 'System Info',
};

/**
 * Tailwind Color Classes for Groups
 * Used for color-coding table columns and UI elements
 */
export const groupColors = {
  basics: {
    bg: 'bg-slate-500/10',
    text: 'text-slate-500',
    border: 'border-slate-500/20',
  },
  pressure: {
    bg: 'bg-sky-500/10',
    text: 'text-sky-500',
    border: 'border-sky-500/20',
  },
  target_pressure: {
    bg: 'bg-sky-500/5',
    text: 'text-sky-400',
    border: 'border-sky-500/10',
  },
  flow: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-500',
    border: 'border-emerald-500/20',
  },
  target_flow: {
    bg: 'bg-emerald-500/5',
    text: 'text-emerald-400',
    border: 'border-emerald-500/10',
  },
  puckflow: {
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-500',
    border: 'border-cyan-500/20',
  },
  temp: {
    bg: 'bg-orange-500/10',
    text: 'text-orange-500',
    border: 'border-orange-500/20',
  },
  target_temp: {
    bg: 'bg-orange-500/5',
    text: 'text-orange-400',
    border: 'border-orange-500/10',
  },
  weight: {
    bg: 'bg-purple-500/10',
    text: 'text-purple-500',
    border: 'border-purple-500/20',
  },
  weight_det: {
    bg: 'bg-purple-500/5',
    text: 'text-purple-400',
    border: 'border-purple-500/10',
  },
  system: {
    bg: 'bg-slate-500/10',
    text: 'text-slate-500',
    border: 'border-slate-500/20',
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
 * Remove .json extension from filename
 * @param {string} name - Filename
 * @returns {string} Clean name
 */
export const cleanName = name => {
  if (!name) return '';
  return name.replace(/\.json$/i, '');
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
 * Scans all 'g' occurrences from right-to-left to handle cases like "My Great 18g Profile"
 * @param {string} profileName - Profile name
 * @returns {number|null} Detected dose or null
 */
export const detectDoseFromProfileName = profileName => {
  if (!profileName) return null;

  // Find dose patterns like "18g", "20.5g" without regex (avoids ReDoS, SonarQube S5852)
  const lower = profileName.toLowerCase();
  let searchPos = lower.length;
  let gIndex;

  // Scan all 'g' occurrences from right-to-left
  while ((gIndex = lower.lastIndexOf('g', searchPos - 1)) !== -1) {
    if (gIndex < 1) {
      searchPos = gIndex;
      continue;
    }

    // Walk backwards from 'g' to collect the number
    let start = gIndex;
    while (
      start > 0 &&
      ((lower[start - 1] >= '0' && lower[start - 1] <= '9') || lower[start - 1] === '.')
    ) {
      start--;
    }

    if (start < gIndex) {
      const candidate = lower.slice(start, gIndex);
      const value = parseFloat(candidate);
      if (!isNaN(value) && value > 0) {
        return value;
      }
    }

    searchPos = gIndex;
  }

  return null;
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
export const maskStyle = {
  maskImage: `url(${DeepDiveLogoOutline})`,
  WebkitMaskImage: `url(${DeepDiveLogoOutline})`,
  maskSize: 'contain',
  WebkitMaskSize: 'contain',
  maskRepeat: 'no-repeat',
  WebkitMaskRepeat: 'no-repeat',
  maskPosition: 'center',
  WebkitMaskPosition: 'center',
};
