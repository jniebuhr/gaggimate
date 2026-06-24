// Pure helper functions for StatisticsView: date parsing, profile/shot pinning, selection, candidate filtering, and display formatting
import {
  cleanName,
  getProfileDisplayLabel,
  getProfilePinKey,
  getShotDisplayName,
  getShotPinBucketKey,
  isProfilePinned,
  isShotPinned,
  MAX_PINNED_PROFILES,
  MAX_PINNED_SHOTS_PER_PROFILE,
  PINNED_NO_PROFILE_BUCKET,
} from '../../../ShotAnalyzer/utils/analyzerUtils';
import { resolveShotEffectiveTimestampMs } from '../../utils/statisticsSearchDsl';
import { STATISTICS_SOURCE_FALLBACK } from '../../utils/statisticsRoute';

export function getStatisticsFallbackSource(source) {
  return STATISTICS_SOURCE_FALLBACK[source] || null;
}

export function getInitialProfileName(initialContext) {
  const profileName = initialContext?.profileName;
  if (profileName && profileName !== 'No Profile Loaded') return profileName;
  return '';
}

export function getAvailableProfileNames(profileList) {
  const profileNames = [];
  for (const p of profileList || []) {
    const displayName = getProfileDisplayLabel(p, '');
    if (displayName) profileNames.push(displayName);
  }
  profileNames.sort((a, b) => a.localeCompare(b));
  return [...new Set(profileNames)];
}

export function parseDateInputMs(value, boundary = 'start') {
  if (!value) return { valueMs: null, error: null };

  const normalizedValue = String(value).trim();
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalizedValue);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    const yearNum = Number(year);
    const monthNum = Number(month);
    const dayNum = Number(day);
    const date = new Date(
      yearNum,
      monthNum - 1,
      dayNum,
      boundary === 'end' ? 23 : 0,
      boundary === 'end' ? 59 : 0,
      boundary === 'end' ? 59 : 0,
      boundary === 'end' ? 999 : 0,
    );
    if (
      date.getFullYear() !== yearNum ||
      date.getMonth() + 1 !== monthNum ||
      date.getDate() !== dayNum
    ) {
      return { valueMs: null, error: `Invalid date: ${value}` };
    }
    const valueMs = date.getTime();
    if (!Number.isFinite(valueMs)) {
      return { valueMs: null, error: `Invalid date: ${value}` };
    }
    return { valueMs, error: null };
  }

  const date = new Date(normalizedValue);
  const valueMs = date.getTime();
  if (!Number.isFinite(valueMs)) {
    return { valueMs: null, error: `Invalid date/time: ${value}` };
  }
  return { valueMs, error: null };
}

export function formatDateTimeLocalInputValue(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const date = new Date(ms);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function getShotSelectionKey(shotMeta) {
  if (!shotMeta) return '';
  if (shotMeta.source === 'gaggimate') return `gaggimate:${String(shotMeta.id || '')}`;
  return `browser:${String(shotMeta.storageKey || shotMeta.name || shotMeta.id || '')}`;
}

export function getSourceShortLabel(source) {
  if (source === 'gaggimate') return 'GM';
  if (source === 'browser') return 'WEB';
  return 'SRC';
}

export function formatShotDateTime(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return 'No date';
  try {
    return new Date(ms).toLocaleString(undefined, {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'No date';
  }
}

export function getShotDisplayPrimary(shotMeta) {
  return String(
    shotMeta?.name || shotMeta?.label || shotMeta?.title || shotMeta?.id || 'Unknown Shot',
  );
}

function stripFileExtension(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.replace(/\.[^./\\]{1,8}$/, '');
}

export function getShotFileStem(shotMeta) {
  const fileName = shotMeta?.name || shotMeta?.storageKey;
  if (fileName) return String(stripFileExtension(fileName));
  return String(shotMeta?.label || shotMeta?.title || shotMeta?.id || 'Unknown Shot');
}

export function getShotDisplaySecondary(shotMeta, dateBasisMode) {
  const ts = resolveShotEffectiveTimestampMs(shotMeta, dateBasisMode || 'auto');
  return `${formatShotDateTime(ts)} • ${getSourceShortLabel(shotMeta?.source)}`;
}

export function isStatisticsHotkeyBlockedTarget(target) {
  const activeElement =
    typeof Element !== 'undefined' && target instanceof Element ? target : document.activeElement;
  if (!activeElement) return false;
  const tag = activeElement.tagName?.toLowerCase();
  if (activeElement.isContentEditable) return true;
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button') return true;
  return !!activeElement.closest(
    'input, textarea, select, button, summary, a[href], [contenteditable="true"], [role="textbox"]',
  );
}

export function buildShotSelectionItem(shot, dateBasisMode) {
  return {
    id: getShotSelectionKey(shot),
    primary: getShotDisplayPrimary(shot),
    fileStem: getShotFileStem(shot),
    shotId: String(shot?.id || shot?.storageKey || shot?.name || ''),
    secondary: getShotDisplaySecondary(shot, dateBasisMode),
    searchText: `${shot?.id || ''} ${shot?.profile || ''} ${shot?.name || ''} ${shot?.source || ''}`,
  };
}

export function getStatisticsCompareFallbackKey(entry, index) {
  return (
    entry?.meta?.selectionKey || `${entry?.meta?.source || 'shot'}:${entry?.meta?.id || index}`
  );
}

export function buildStatisticsCompareEntry(entry, { key, isReference = false } = {}) {
  if (!entry?.shotData || !entry?.analysis) return null;

  return {
    key,
    shot: entry.shotData,
    shotName: entry.shotData.name || entry.meta?.id,
    label: entry.meta?.displayName || getShotDisplayName(entry.shotData),
    profile: entry.profileData || null,
    profileName: entry.meta?.profileName,
    results: entry.analysis,
    isReference,
  };
}

export function getPreferredStatisticsDetailSection({
  runMode,
  hasCompareStatistics,
  hasMetricStatistics,
  hasTrendStatistics,
}) {
  if (hasMetricStatistics) return 'metrics';
  if (hasTrendStatistics) return 'trends';
  if (hasCompareStatistics) return 'compare';
  return runMode === 'profile' ? 'phase' : 'profile';
}

export function normalizeStatisticsDetailSection(value) {
  return ['metrics', 'trends', 'compare', 'profile', 'phase'].includes(value) ? value : null;
}

export function resolveStatisticsDetailSectionChoice({
  candidate,
  hasCompareStatistics,
  hasMetricStatistics,
  hasTrendStatistics,
  hasProfileGroupStatistics,
  hasPhaseStatistics,
}) {
  const availabilityBySection = {
    compare: hasCompareStatistics,
    metrics: hasMetricStatistics,
    trends: hasTrendStatistics,
    profile: hasProfileGroupStatistics,
    phase: hasPhaseStatistics,
  };

  if (availabilityBySection[candidate]) {
    return candidate;
  }

  const fallbackOrder = ['compare', 'metrics', 'trends', 'profile', 'phase'];
  const fallbackSection = fallbackOrder.find(section => availabilityBySection[section]);
  if (fallbackSection) {
    return fallbackSection;
  }

  return candidate;
}

export function getCanonicalShotProfilePinKeyFromMap(shotMeta, shotKeyToCanonicalProfile) {
  const shotKey = getShotSelectionKey(shotMeta);
  const canonicalProfile = shotKeyToCanonicalProfile.get(shotKey);
  return canonicalProfile
    ? getProfilePinKey(canonicalProfile)
    : getProfilePinKey(shotMeta?.profile || shotMeta?.profileName || '');
}

export function matchesPinnedShotMetaWithPins(
  shotMeta,
  { shotKeyToCanonicalProfile, pinnedShotsByProfile, pinnedProfiles },
) {
  const shotKey = getShotSelectionKey(shotMeta);
  const profilePinKey = getCanonicalShotProfilePinKeyFromMap(shotMeta, shotKeyToCanonicalProfile);
  return (
    isShotPinnedAnywhere(shotKey, pinnedShotsByProfile) ||
    (profilePinKey ? isProfilePinned(profilePinKey, pinnedProfiles) : false)
  );
}

function isShotPinnedAnywhere(shotKey, pinnedShotsByProfile) {
  if (!shotKey) return false;
  return Object.values(pinnedShotsByProfile).some(bucket => bucket.includes(shotKey));
}

export function getProfilePinDisabledReasonText(profileName, pinnedProfiles) {
  if (isProfilePinned(profileName, pinnedProfiles)) return '';
  if (pinnedProfiles.length >= MAX_PINNED_PROFILES) {
    return `Maximum ${MAX_PINNED_PROFILES} pinned profiles`;
  }
  return '';
}

export function getShotPinDisabledReasonText(
  shotMeta,
  shotKeyToCanonicalProfile,
  pinnedShotsByProfile,
) {
  const bucketKey =
    getCanonicalShotProfilePinKeyFromMap(shotMeta, shotKeyToCanonicalProfile) ||
    getShotPinBucketKey(shotMeta);
  if (isShotPinned(shotMeta, bucketKey, pinnedShotsByProfile)) return '';

  const pinnedCount = (pinnedShotsByProfile[bucketKey] || []).length;
  if (pinnedCount >= MAX_PINNED_SHOTS_PER_PROFILE) {
    return bucketKey === PINNED_NO_PROFILE_BUCKET
      ? `Maximum ${MAX_PINNED_SHOTS_PER_PROFILE} pinned shots without a profile`
      : `Maximum ${MAX_PINNED_SHOTS_PER_PROFILE} pinned shots per profile`;
  }

  return '';
}

export function buildDateBasisWarningState(rawShotCandidates) {
  let missingShotTimestampCount = 0;
  let uploadFallbackCount = 0;
  let noUsableDateCount = 0;

  for (const shot of rawShotCandidates || []) {
    const shotTs = resolveShotEffectiveTimestampMs(shot, 'shot');
    if (Number.isFinite(shotTs)) continue;

    missingShotTimestampCount += 1;
    const uploadTs = resolveShotEffectiveTimestampMs(shot, 'upload');
    if (Number.isFinite(uploadTs)) uploadFallbackCount += 1;
    else noUsableDateCount += 1;
  }

  const showDateBasisWarning = missingShotTimestampCount > 0;
  let dateBasisWarningMessage = null;

  if (showDateBasisWarning) {
    if (uploadFallbackCount > 0 && noUsableDateCount > 0) {
      dateBasisWarningMessage =
        'Some shots have no shot timestamp. Choose how date handling should treat them (Shot = exclude missing, Auto = fallback to upload time, Upload = upload time only). Some shots have no usable date at all and may still be excluded from date filtering.';
    } else if (uploadFallbackCount > 0) {
      dateBasisWarningMessage =
        'Some shots have no shot timestamp. Choose how date handling should treat them (Shot = exclude missing, Auto = fallback to upload time, Upload = upload time only).';
    } else {
      dateBasisWarningMessage =
        'Some shots have no usable shot timestamp. Date filtering may exclude them unless upload time is available.';
    }
  }

  return {
    showDateBasisWarning,
    dateBasisWarningMessage,
    missingShotTimestampCount,
    uploadFallbackCount,
    noUsableDateCount,
  };
}

export function buildBaseFilterState({
  compiledDslFilter,
  visualDateFrom,
  visualDateTo,
  dateBasisMode,
  rawShotCandidates,
}) {
  const parseErrors = [...compiledDslFilter.errors];
  const parseWarnings = [...compiledDslFilter.warnings];

  if (visualDateFrom.error) {
    parseErrors.push({
      code: 'visual_date_from_invalid',
      message: visualDateFrom.error,
    });
  }
  if (visualDateTo.error) {
    parseErrors.push({
      code: 'visual_date_to_invalid',
      message: visualDateTo.error,
    });
  }

  if (
    Number.isFinite(visualDateFrom.valueMs) &&
    Number.isFinite(visualDateTo.valueMs) &&
    visualDateFrom.valueMs > visualDateTo.valueMs
  ) {
    parseErrors.push({
      code: 'visual_date_range_invalid',
      message: 'Date range invalid: From is after To.',
    });
  }

  if (parseErrors.length > 0) {
    return { filteredShots: [], count: null, parseErrors, parseWarnings };
  }

  const filteredShots = (rawShotCandidates || []).filter(shot => {
    if (Number.isFinite(visualDateFrom.valueMs) || Number.isFinite(visualDateTo.valueMs)) {
      const ts = resolveShotEffectiveTimestampMs(shot, dateBasisMode);
      if (!Number.isFinite(ts)) return false;
      if (Number.isFinite(visualDateFrom.valueMs) && ts < visualDateFrom.valueMs) return false;
      if (Number.isFinite(visualDateTo.valueMs) && ts > visualDateTo.valueMs) return false;
    }

    return compiledDslFilter.predicate(shot);
  });

  return {
    filteredShots,
    count: filteredShots.length,
    parseErrors,
    parseWarnings,
  };
}

export function buildCandidateFilterState({
  baseFilterState,
  mode,
  selectedProfileNames,
  selectedShotKeys,
  shotKeyToCanonicalProfile,
}) {
  const parseErrors = [...baseFilterState.parseErrors];
  const parseWarnings = [...baseFilterState.parseWarnings];

  if (parseErrors.length > 0) {
    return { filteredShots: [], count: null, parseErrors, parseWarnings };
  }
  if (mode === 'profile' && selectedProfileNames.length === 0) {
    return { filteredShots: [], count: 0, parseErrors, parseWarnings };
  }
  if (mode === 'shots' && selectedShotKeys.length === 0) {
    return { filteredShots: [], count: 0, parseErrors, parseWarnings };
  }

  const selectedProfileSet = new Set(
    selectedProfileNames.map(name => cleanName(name).toLowerCase()),
  );
  const selectedShotKeySetLocal = new Set(selectedShotKeys);
  const filteredShots = (baseFilterState.filteredShots || []).filter(shot => {
    const shotKey = getShotSelectionKey(shot);
    if (!shotKey) return false;

    if (mode === 'profile') {
      const canonical = shotKeyToCanonicalProfile.get(shotKey);
      const profileKey = canonical ? cleanName(canonical).toLowerCase() : '';
      if (!selectedProfileSet.has(profileKey)) return false;
      if (!selectedShotKeySetLocal.has(shotKey)) return false;
    } else if (mode === 'shots' && !selectedShotKeySetLocal.has(shotKey)) {
      return false;
    }

    return true;
  });

  return {
    filteredShots,
    count: filteredShots.length,
    parseErrors,
    parseWarnings,
  };
}

export function getStatisticsSelectionHint({ mode, selectedProfileNames, selectedShotKeys }) {
  if (mode === 'profile' && selectedProfileNames.length === 0) {
    return 'Select one or more profiles.';
  }
  if (mode === 'shots' && selectedShotKeys.length === 0) {
    return 'Select one or more shots.';
  }
  return null;
}
