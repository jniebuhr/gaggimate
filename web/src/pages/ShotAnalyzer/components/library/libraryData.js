import {
  cleanName,
  getProfileDisplayLabel,
  isProfilePinned,
  isShotPinnedAnywhere,
  loadFromStorage,
} from '../../utils/analyzerUtils';

export function getStoredLibrarySourceFilter(storageKey) {
  const storedValue = loadFromStorage(storageKey, 'all');
  return storedValue === 'gaggimate' || storedValue === 'browser' || storedValue === 'all'
    ? storedValue
    : 'all';
}

export function getLibraryRequestSource(sourceFilter) {
  return sourceFilter === 'all' ? 'both' : sourceFilter;
}

function getLibraryShotSearchPriority(item, query) {
  const normalizedId = String(item?.id || '').toLowerCase();
  const normalizedName = (item?.name || item?.label || item?.title || '').toLowerCase();
  return normalizedName.includes(query) || normalizedId.includes(query) ? 0 : 1;
}

function applyLibrarySort(items, cfg) {
  return [...items].sort((a, b) => {
    let valA;
    let valB;

    switch (cfg.key) {
      case 'shotDate':
        valA = a.timestamp || 0;
        valB = b.timestamp || 0;
        break;
      case 'name':
        valA = getProfileDisplayLabel(a, a.profile || '').toLowerCase();
        valB = getProfileDisplayLabel(b, b.profile || '').toLowerCase();
        break;
      case 'data.rating':
        valA = a.rating || 0;
        valB = b.rating || 0;
        break;
      case 'duration':
        valA = Number.parseFloat(a.duration) || 0;
        valB = Number.parseFloat(b.duration) || 0;
        break;
      default:
        valA = a[cfg.key];
        valB = b[cfg.key];
    }

    if (valA < valB) return cfg.order === 'asc' ? -1 : 1;
    if (valA > valB) return cfg.order === 'asc' ? 1 : -1;
    return 0;
  });
}

function promoteLibraryItems(items, predicate) {
  const promoted = [];
  const remaining = [];

  items.forEach(item => {
    if (predicate(item)) promoted.push(item);
    else remaining.push(item);
  });

  return [...promoted, ...remaining];
}

function filterLibraryShots(shotsData, shotSearch, profileSearch) {
  let filteredShots = shotsData;

  if (shotSearch) {
    const normalizedShotSearch = shotSearch.toLowerCase();
    filteredShots = shotsData.filter(shot => {
      const nameMatch = (shot.name || shot.label || shot.title || '')
        .toLowerCase()
        .includes(normalizedShotSearch);
      const profileMatch = (shot.profile || shot.profileName || '')
        .toLowerCase()
        .includes(normalizedShotSearch);
      const idMatch = String(shot.id || '')
        .toLowerCase()
        .includes(normalizedShotSearch);
      const fileMatch = (shot.fileName || shot.exportName || '')
        .toLowerCase()
        .includes(normalizedShotSearch);

      return nameMatch || profileMatch || idMatch || fileMatch;
    });

    filteredShots.sort(
      (a, b) =>
        getLibraryShotSearchPriority(a, normalizedShotSearch) -
        getLibraryShotSearchPriority(b, normalizedShotSearch),
    );
  }

  if (!profileSearch) return filteredShots;

  const normalizedProfileSearch = profileSearch.toLowerCase();
  return filteredShots.filter(shot =>
    (shot.profile || shot.profileName || '').toLowerCase().includes(normalizedProfileSearch),
  );
}

function filterLibraryProfiles(profilesData, profileSearch) {
  if (!profileSearch) return profilesData;
  const normalizedProfileSearch = profileSearch.toLowerCase();
  return profilesData.filter(profile =>
    getProfileDisplayLabel(profile, '').toLowerCase().includes(normalizedProfileSearch),
  );
}

function getProfileIdentityId(profile) {
  return String(
    profile?.profileId || profile?.id || profile?.data?.profileId || profile?.data?.id || '',
  ).trim();
}

function doesProfileMatchShot(profile, shot, fallbackProfileName = '') {
  if (!profile || !shot) return false;

  const shotProfileId = String(shot.profileId || '').trim();
  const profileId = getProfileIdentityId(profile);
  if (shotProfileId && profileId) {
    return shotProfileId === profileId;
  }

  const expectedProfileName = cleanName(shot.profile || '').toLowerCase();
  if (!expectedProfileName) return false;

  return getProfileDisplayLabel(profile, fallbackProfileName).toLowerCase() === expectedProfileName;
}

export function doesProfileLabelMatchShot(profile, shot, fallbackProfileName = '') {
  if (!profile || !shot) return false;

  const expectedProfileName = cleanName(shot.profile || '').toLowerCase();
  if (!expectedProfileName) return doesProfileMatchShot(profile, shot, fallbackProfileName);

  const profileLabel = cleanName(
    getProfileDisplayLabel(profile, fallbackProfileName),
  ).toLowerCase();
  return profileLabel === expectedProfileName;
}

export function doesProfileMatchProfile(profile, selectedProfile, selectedProfileName = '') {
  if (!profile || !selectedProfile) return false;

  const profileId = getProfileIdentityId(profile);
  const selectedProfileId = getProfileIdentityId(selectedProfile);
  if (profileId && selectedProfileId) {
    return profileId === selectedProfileId;
  }

  const selectedLabel = getProfileDisplayLabel(selectedProfile, selectedProfileName).toLowerCase();
  return getProfileDisplayLabel(profile, '').toLowerCase() === selectedLabel;
}

export function hasLoadedProfileMismatch(shot, profile, fallbackProfileName = '') {
  return Boolean(shot && profile && !doesProfileLabelMatchShot(profile, shot, fallbackProfileName));
}

export function buildPromotedLibraryItems({
  shotsData,
  profilesData,
  shotSearch,
  profileSearch,
  shotsSort,
  profilesSort,
  normalizedCurrentProfileName,
  normalizedCurrentShotProfileName,
  pinnedProfiles,
  pinnedShotsByProfile,
  shotsPinnedFirst,
  profilesPinnedFirst,
  selectionPromotionsEnabled = true,
}) {
  const filteredShots = filterLibraryShots(shotsData, shotSearch, profileSearch);
  const filteredProfiles = filterLibraryProfiles(profilesData, profileSearch);
  const hasActiveProfileMatch =
    selectionPromotionsEnabled &&
    normalizedCurrentProfileName &&
    normalizedCurrentProfileName !== 'no profile loaded';
  const hasActiveShotProfileMatch =
    selectionPromotionsEnabled &&
    normalizedCurrentShotProfileName &&
    normalizedCurrentShotProfileName !== 'no profile loaded';
  const promoteMatchedShots = item =>
    hasActiveProfileMatch &&
    cleanName(item.profile || '').toLowerCase() === normalizedCurrentProfileName;
  const promoteMatchedProfiles = item =>
    hasActiveShotProfileMatch &&
    doesProfileLabelMatchShot(item, { profile: normalizedCurrentShotProfileName });

  let nextShots = applyLibrarySort(filteredShots, shotsSort);
  if (shotsPinnedFirst) {
    nextShots = promoteLibraryItems(nextShots, item =>
      isShotPinnedAnywhere(item, pinnedShotsByProfile),
    );
  } else {
    nextShots = promoteLibraryItems(nextShots, promoteMatchedShots);
  }

  let nextProfiles = applyLibrarySort(filteredProfiles, profilesSort);
  if (selectionPromotionsEnabled) {
    nextProfiles = promoteLibraryItems(nextProfiles, promoteMatchedProfiles);
  }
  if (profilesPinnedFirst) {
    nextProfiles = promoteLibraryItems(nextProfiles, item => isProfilePinned(item, pinnedProfiles));
  }

  return { nextShots, nextProfiles };
}

export function buildShotNavigationItems({
  shotsData,
  shotsSort,
  shotsPinnedFirst,
  pinnedShotsByProfile,
}) {
  let nextShots = applyLibrarySort(shotsData, shotsSort);

  if (shotsPinnedFirst) {
    nextShots = promoteLibraryItems(nextShots, item =>
      isShotPinnedAnywhere(item, pinnedShotsByProfile),
    );
  }

  return nextShots;
}
