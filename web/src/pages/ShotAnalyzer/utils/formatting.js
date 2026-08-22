import { COMPARE_TARGET_DISPLAY_MODES, TIMESTAMP_SECONDS_THRESHOLD } from './constants';

export function formatMetricValue(value, digits = 1) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toFixed(digits) : '-';
}

function getDisplayStopReason(reason) {
  if (reason === 'Water Drawn Stop') return 'Pumped Water Stop';
  if (reason === 'Flow Stop') return 'Pump Flow Stop';
  return reason;
}

export function getDisplayStopReasonParts(reason = '') {
  const rawReason = reason ?? '';
  const skippedSuffix = ' (skipped)';
  const hasSkippedSuffix = rawReason.endsWith(skippedSuffix);
  const baseReason = hasSkippedSuffix ? rawReason.slice(0, -skippedSuffix.length) : rawReason;
  const displayReason = getDisplayStopReason(baseReason);
  if (!displayReason) {
    return { skipNotice: '', stopReason: '' };
  }

  if (displayReason === 'Phase skipped') {
    return { skipNotice: 'Phase skipped', stopReason: '' };
  }

  if (displayReason === 'Phase skipped (no preceding phase)') {
    return { skipNotice: 'Phase skipped', stopReason: 'No preceding phase' };
  }

  if (hasSkippedSuffix) {
    return {
      skipNotice: 'Phase skipped',
      stopReason: displayReason,
    };
  }

  return { skipNotice: '', stopReason: displayReason };
}

export const cleanName = name => {
  if (!name) return '';
  return name.replace(/\.json$/i, '');
};

export const formatTimestamp = timestamp => {
  if (!timestamp) return '';
  const ms = timestamp < TIMESTAMP_SECONDS_THRESHOLD ? timestamp * 1000 : timestamp;
  return new Date(ms).toLocaleString([], {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatDuration = samples => {
  if (!samples || samples.length === 0) return '0s';
  const duration = (samples.at(-1).t - samples[0].t) / 1000;
  return `${duration.toFixed(1)}s`;
};

export const getShotDisplayName = shot => {
  if (!shot) return 'Unknown';
  if (shot.source === 'gaggimate') {
    return `#${shot.id || shot.name || 'Unknown'}`;
  }
  return cleanName(shot.name || shot.storageKey || shot.id || 'Unknown');
};

export const calculateRatio = (doseIn, doseOut) => {
  if (!doseIn || !doseOut || doseIn <= 0) return null;
  return Number.parseFloat((doseOut / doseIn).toFixed(2));
};

export const normalizeCompareTargetDisplayMode = value => {
  if (value === COMPARE_TARGET_DISPLAY_MODES.NONE) return value;
  if (value === COMPARE_TARGET_DISPLAY_MODES.MAIN_SHOT_ONLY) return value;
  if (value === COMPARE_TARGET_DISPLAY_MODES.PER_SHOT) return value;
  return COMPARE_TARGET_DISPLAY_MODES.NONE;
};
