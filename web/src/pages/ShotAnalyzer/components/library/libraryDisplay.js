import { libraryService } from '../../services/LibraryService';
import {
  cleanName,
  getProfileDisplayLabel,
  getProfilePinKey,
  getShotIdentityKey,
  getShotStorageKey,
  isProfilePinned,
  isShotPinned,
  MAX_PINNED_PROFILES,
  MAX_PINNED_SHOTS_PER_PROFILE,
  PINNED_NO_PROFILE_BUCKET,
} from '../../utils/analyzerUtils';
import {
  doesProfileMatchProfile,
  getLibraryRequestSource,
  hasLoadedProfileMismatch,
} from './libraryData';

export function getLibraryPanelDisplayState({
  currentShot,
  currentProfile,
  currentShotName,
  currentProfileName,
  pendingPrimarySelection,
  secondaryShot,
  secondaryProfile,
  secondaryShotName,
  secondaryProfileName,
  pendingCompareSelection,
  isSearchingProfile,
  compareIsSearchingProfile,
  collapsed,
}) {
  const primaryDisplayShot = pendingPrimarySelection?.shot || currentShot;
  const primaryDisplayShotName = pendingPrimarySelection?.name || currentShotName;
  const primaryDisplayProfile = pendingPrimarySelection ? null : currentProfile;
  const primaryDisplayProfileName = pendingPrimarySelection
    ? cleanName(primaryDisplayShot?.profile || 'No Profile Loaded')
    : currentProfileName;
  const secondaryDisplayShot = pendingCompareSelection?.shot || secondaryShot;
  const secondaryDisplayShotName = pendingCompareSelection?.name || secondaryShotName;
  const secondaryDisplayProfile = pendingCompareSelection ? null : secondaryProfile;
  const secondaryDisplayProfileName = pendingCompareSelection
    ? cleanName(secondaryDisplayShot?.profile || 'No Profile Loaded')
    : secondaryProfileName;
  const isPrimarySelectionPending = Boolean(pendingPrimarySelection);
  const isCompareSelectionPending = Boolean(pendingCompareSelection);
  const primaryProfileMismatch = hasLoadedProfileMismatch(
    primaryDisplayShot,
    primaryDisplayProfile,
    primaryDisplayProfileName,
  );
  const secondaryProfileMismatch = hasLoadedProfileMismatch(
    secondaryDisplayShot,
    secondaryDisplayProfile,
    secondaryDisplayProfileName,
  );
  const isPrimaryProfileSearching = !isPrimarySelectionPending && isSearchingProfile;
  const isCompareProfileSearching = !isCompareSelectionPending && compareIsSearchingProfile;
  const normalizedPrimaryExpectedProfileName = cleanName(
    primaryDisplayShot?.profile || '',
  ).toLowerCase();
  const normalizedCompareExpectedProfileName = cleanName(
    secondaryDisplayShot?.profile || '',
  ).toLowerCase();

  return {
    primaryDisplayShot,
    primaryDisplayShotName,
    primaryDisplayProfile,
    primaryDisplayProfileName,
    secondaryDisplayShot,
    secondaryDisplayShotName,
    secondaryDisplayProfile,
    secondaryDisplayProfileName,
    isPrimarySelectionPending,
    isCompareSelectionPending,
    primaryProfileMismatch,
    secondaryProfileMismatch,
    isPrimaryProfileSearching,
    isCompareProfileSearching,
    normalizedPrimaryExpectedProfileName,
    normalizedCompareExpectedProfileName,
    canRetryPrimaryProfileSearch:
      !pendingPrimarySelection &&
      !primaryDisplayProfile &&
      !isPrimaryProfileSearching &&
      Boolean(normalizedPrimaryExpectedProfileName) &&
      normalizedPrimaryExpectedProfileName !== 'no profile loaded',
    canRetryCompareProfileSearch:
      !pendingCompareSelection &&
      !secondaryDisplayProfile &&
      !isCompareProfileSearching &&
      Boolean(normalizedCompareExpectedProfileName) &&
      normalizedCompareExpectedProfileName !== 'no profile loaded',
    selectionPromotionsEnabled: !collapsed,
  };
}

export function getShotCompareBadgeNumber({
  compareMode,
  item,
  primaryDisplayShot,
  compareSecondaryShotKey,
}) {
  if (!compareMode) return null;
  const itemKey = getShotIdentityKey(item);
  if (!itemKey) return null;
  if (primaryDisplayShot && itemKey === getShotIdentityKey(primaryDisplayShot)) return 1;
  if (compareSecondaryShotKey && itemKey === compareSecondaryShotKey) return 2;
  return null;
}

export function getProfileCompareBadgeNumber({
  compareMode,
  item,
  primaryDisplayProfile,
  primaryDisplayProfileName,
  secondaryDisplayProfile,
  secondaryDisplayProfileName,
}) {
  if (!compareMode) return null;
  if (
    primaryDisplayProfile &&
    doesProfileMatchProfile(item, primaryDisplayProfile, primaryDisplayProfileName)
  ) {
    return 1;
  }
  if (
    secondaryDisplayProfile &&
    doesProfileMatchProfile(item, secondaryDisplayProfile, secondaryDisplayProfileName)
  ) {
    return 2;
  }
  return null;
}

export function getLibraryProfileDeleteKey(item) {
  return item.source === 'gaggimate' ? item.profileId || item.id : item.label || item.name;
}

export function createLibraryProfileStatsContext({
  compareMode,
  currentShot,
  profileItem,
  secondaryShot,
  shotsSourceFilter,
}) {
  const profileSource = profileItem.source || profileItem.src || 'both';
  const statsInitialContext = {
    profileName: getProfileDisplayLabel(profileItem, ''),
    shotSource:
      currentShot?.source ||
      secondaryShot?.source ||
      getLibraryRequestSource(shotsSourceFilter) ||
      'both',
    profileSource,
    source: profileSource,
  };

  if (compareMode) {
    statsInitialContext.preferredDetailSection = 'compare';
  }

  return statsInitialContext;
}

export function getNormalizedCurrentProfileName(profile, profileMismatch, profileName) {
  return profile && !profileMismatch ? cleanName(profileName).toLowerCase() : '';
}

function getRealProfilePinKey(profileValue) {
  const key = getProfilePinKey(profileValue);
  return key && key !== 'no profile loaded' ? key : '';
}

export function getActiveShotPinBucketKey({
  primaryDisplayProfile,
  primaryProfileMismatch,
  primaryDisplayProfileName,
}) {
  return primaryDisplayProfile && !primaryProfileMismatch
    ? getRealProfilePinKey(primaryDisplayProfileName)
    : '';
}

export function getPinnedShotBucketKeyForItem(item, pinnedShotsByProfile) {
  const shotKey = getShotIdentityKey(item);
  if (!shotKey) return '';

  return (
    Object.entries(pinnedShotsByProfile).find(([, shotKeys]) => shotKeys.includes(shotKey))?.[0] ||
    ''
  );
}

export function getProfilePinDisabledReasonForItem(item, pinnedProfiles) {
  if (isProfilePinned(item, pinnedProfiles)) return '';
  return pinnedProfiles.length >= MAX_PINNED_PROFILES
    ? `Maximum ${MAX_PINNED_PROFILES} pinned profiles`
    : '';
}

export function getShotPinDisabledReasonForItem({
  item,
  getEffectiveShotPinBucketKey,
  pinnedShotsByProfile,
}) {
  const bucketKey = getEffectiveShotPinBucketKey(item);
  if (isShotPinned(item, bucketKey, pinnedShotsByProfile)) return '';

  const pinnedCount = (pinnedShotsByProfile[bucketKey] || []).length;
  if (pinnedCount < MAX_PINNED_SHOTS_PER_PROFILE) return '';

  return bucketKey === PINNED_NO_PROFILE_BUCKET
    ? `Maximum ${MAX_PINNED_SHOTS_PER_PROFILE} pinned shots without a profile`
    : `Maximum ${MAX_PINNED_SHOTS_PER_PROFILE} pinned shots per profile`;
}

export function getLibraryTargetMobileSection(target) {
  return target === 'primaryProfile' || target === 'secondaryProfile' ? 'profiles' : 'shots';
}

export function getSecondaryImportSlot(currentShot) {
  return currentShot ? 'secondary' : 'primary';
}

export function getSecondaryShotPanelTarget(primaryDisplayShot) {
  return primaryDisplayShot ? 'secondaryShot' : 'primaryShot';
}

export function getShotRowActionIntent({
  collapsed,
  compareMode,
  currentShot,
  item,
  librarySelectionTarget,
  primaryDisplayShot,
  secondaryShot,
}) {
  const primaryShotKey = primaryDisplayShot ? getShotIdentityKey(primaryDisplayShot) : '';
  const committedSecondaryShotKey = secondaryShot ? getShotIdentityKey(secondaryShot) : '';
  const itemShotKey = item ? getShotIdentityKey(item) : '';

  if (librarySelectionTarget === 'secondaryShot') {
    return !primaryDisplayShot || !itemShotKey || itemShotKey === primaryShotKey
      ? { type: 'ignore' }
      : { type: 'selectSecondary' };
  }

  if (compareMode && committedSecondaryShotKey && itemShotKey === committedSecondaryShotKey) {
    return { type: 'swap' };
  }

  const keepLibraryOpen = compareMode && !currentShot;
  return {
    type: 'selectPrimary',
    closeLibrary: !keepLibraryOpen,
    requestSelectionScroll: !collapsed && !keepLibraryOpen,
  };
}

export function executeShotRowActionIntent({
  compareMode,
  handleSwapCompareSlots,
  intent,
  item,
  onCompareShotToggle,
  onShotSelect,
  setCollapsed,
}) {
  if (intent.type === 'ignore') return;
  if (intent.type === 'selectSecondary') {
    setCollapsed(true);
    onCompareShotToggle?.({ item, debounceMs: 0 }, true);
    return;
  }

  if (intent.type === 'swap') {
    setCollapsed(true);
    handleSwapCompareSlots();
    return;
  }

  if (intent.closeLibrary) {
    setCollapsed(true);
  }
  onShotSelect?.({
    item,
    preserveCompare: compareMode,
    requestSelectionScroll: intent.requestSelectionScroll,
    debounceMs: 0,
  });
}

export function executeProfileRowAction({
  item,
  librarySelectionTarget,
  onCompareProfileLoad,
  onProfileLoad,
  secondaryShot,
  setCollapsed,
}) {
  if (librarySelectionTarget === 'secondaryProfile') {
    if (!secondaryShot) return;
    onCompareProfileLoad?.(item.data || item, getProfileDisplayLabel(item, ''), item.source);
    setCollapsed(true);
    return;
  }

  onProfileLoad(item.data || item, getProfileDisplayLabel(item, ''), item.source);
  setCollapsed(true);
}

export function executeStatusBarCompareToggle({
  compareMode,
  onCompareModeToggle,
  openLibraryForTarget,
  primaryDisplayShot,
}) {
  onCompareModeToggle?.();
  if (!compareMode) {
    openLibraryForTarget(getSecondaryShotPanelTarget(primaryDisplayShot));
  }
}

export function maybeOpenSecondaryProfilePanel({ openLibraryForTarget, secondaryDisplayShot }) {
  if (!secondaryDisplayShot) return;
  openLibraryForTarget('secondaryProfile');
}

export function applyChangedProfilePins(result, setPinnedProfiles) {
  if (!result.changed) return;
  setPinnedProfiles(result.pinnedProfiles);
}

export function applyChangedShotPins(result, setPinnedShotsByProfile) {
  if (!result.changed) return;
  setPinnedShotsByProfile(result.pinnedShotsByProfile);
}

export function getShotPinToggleBucketKey({
  getEffectiveShotPinBucketKey,
  getPinnedShotBucketKey,
  item,
  shotsPinnedFirst,
}) {
  return (shotsPinnedFirst && getPinnedShotBucketKey(item)) || getEffectiveShotPinBucketKey(item);
}

export async function deleteLibraryItem(item) {
  if (item.duration !== undefined || item.samples) {
    await libraryService.deleteShot(getShotStorageKey(item), item.source);
    return;
  }
  await libraryService.deleteProfile(getLibraryProfileDeleteKey(item), item.source);
}

export function getLibraryExportHandler(item, isShot, handleExport) {
  return item ? () => handleExport(item, isShot) : null;
}

export function createPrimaryStatsHandler({
  onShowStats,
  primaryDisplayProfile,
  primaryDisplayProfileName,
  primaryDisplayShot,
}) {
  return () =>
    onShowStats?.({
      shotSource: primaryDisplayShot?.source || 'both',
      profileSource: primaryDisplayProfile?.source || 'both',
      profileName: primaryDisplayProfileName,
    });
}

export function createSecondaryStatsHandler({
  onShowStats,
  primaryDisplayShot,
  secondaryDisplayProfile,
  secondaryDisplayProfileName,
  secondaryDisplayShot,
}) {
  return () =>
    onShowStats?.({
      shotSource: secondaryDisplayShot?.source || primaryDisplayShot?.source || 'both',
      profileSource: secondaryDisplayProfile?.source || 'both',
      profileName: secondaryDisplayProfileName,
    });
}
