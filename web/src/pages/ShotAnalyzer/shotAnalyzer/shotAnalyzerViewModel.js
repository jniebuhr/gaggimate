import { getShotDisplayName, getShotIdentityKey } from '../utils/analyzerUtils';
import { buildStatisticsProfileHref } from '../../Statistics/utils/statisticsRoute';
import { buildShotDetailsEntries, getCompareDetailsKey } from './ActiveAnalysisView';

/** Builds the derived chart, compare, details, and statistics navigation state. */
export function buildShotAnalyzerViewModel({
  analysisResults,
  compareMode,
  comparePendingKeys,
  compareResults,
  compareShots,
  currentProfile,
  currentProfileName,
  currentShot,
  currentShotName,
  pendingCompareSelection,
  pendingPrimarySelection,
}) {
  const displayCurrentShot = pendingPrimarySelection?.shot || currentShot;
  const statsHref = buildStatisticsProfileHref({
    source: currentProfile?.source,
    profileName: currentProfileName,
  });

  const currentShotKey = currentShot ? getShotIdentityKey(currentShot) : '';
  const displayCurrentShotKey = displayCurrentShot ? getShotIdentityKey(displayCurrentShot) : '';
  const compareSelectionKeys = new Set(comparePendingKeys);
  compareShots.forEach(entry => compareSelectionKeys.add(entry.key));
  if (compareMode && displayCurrentShotKey) compareSelectionKeys.add(displayCurrentShotKey);

  const compareSelectedCount = compareSelectionKeys.size;
  const compareHasSecondaryShot = compareShots.length > 0 || Boolean(pendingCompareSelection);
  const compareSecondaryShot = compareShots[0] || null;
  const displayCompareSecondaryShot =
    pendingCompareSelection?.shot || compareSecondaryShot?.shot || null;
  const displayCompareSecondaryShotKey = displayCompareSecondaryShot
    ? getShotIdentityKey(displayCompareSecondaryShot)
    : '';
  const compareSecondaryProfile = compareSecondaryShot?.profile || null;
  const compareSecondaryStatsHref = buildStatisticsProfileHref({
    source: compareSecondaryProfile?.source,
    profileName: compareSecondaryShot?.profileName,
  });
  const referenceCompareEntry =
    currentShot && analysisResults
      ? {
          key: currentShotKey,
          shot: currentShot,
          shotName: currentShotName,
          label: getShotDisplayName(currentShot),
          profile: currentProfile,
          profileName: currentProfileName,
          results: analysisResults,
          isReference: true,
        }
      : null;
  const compareEntryByKey = new Map(compareResults.map(entry => [entry.key, entry.results]));
  const compareCollection = referenceCompareEntry
    ? [
        referenceCompareEntry,
        ...compareShots
          .map(entry => ({
            key: entry.key,
            shot: entry.shot,
            shotName: entry.shotName,
            label: getShotDisplayName(entry.shot),
            profile: entry.profile,
            profileName: entry.profileName,
            results: compareEntryByKey.get(entry.key) || null,
            isReference: false,
          }))
          .filter(entry => entry.results),
      ]
    : [];
  const compareCollectionWithAccents = compareCollection.map((entry, index) => ({
    ...entry,
    accentColor: 'var(--color-primary)',
    accentStrength: index === 0 ? 1 : 0.7,
  }));
  const isCompareActive =
    compareMode && compareHasSecondaryShot && compareCollectionWithAccents.length > 1;
  const shotDetailsEntries = buildShotDetailsEntries({
    isCompareActive,
    compareCollectionWithAccents,
    referenceCompareEntry,
  });
  const chartMountKey = [
    isCompareActive ? 'compare' : 'single',
    currentShot?.storageKey || currentShot?.id || currentShotName || 'shot',
  ].join(':');
  const compareDetailsKey = getCompareDetailsKey(isCompareActive, shotDetailsEntries);

  return {
    chartMountKey,
    compareCollectionWithAccents,
    compareDetailsKey,
    compareHasSecondaryShot,
    compareSecondaryProfile,
    compareSecondaryShot,
    compareSecondaryStatsHref,
    compareSelectedCount,
    compareSelectionKeys,
    displayCompareSecondaryShotKey,
    isCompareActive,
    shotDetailsEntries,
    statsHref,
  };
}

export function persistStatisticsInitialContext({
  context = {},
  currentProfile,
  currentProfileName,
  currentShot,
}) {
  const {
    shotSource = currentShot?.source || 'both',
    profileSource = currentProfile?.source || 'both',
    profileName = currentProfileName,
    preferredDetailSection = null,
  } = context;
  const statsInitialContext = {
    profileName,
    shotSource,
    profileSource,
    source: profileSource,
  };
  if (preferredDetailSection) {
    statsInitialContext.preferredDetailSection = preferredDetailSection;
  }
  sessionStorage.setItem('statsInitialContext', JSON.stringify(statsInitialContext));
}
