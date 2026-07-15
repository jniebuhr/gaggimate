/** Coordinates secondary-shot loading, retries, and automatic profile matching. */

import { libraryService } from '../services/LibraryService';
import { cleanName, getShotIdentityKey, getShotStorageKey } from '../utils/analyzerUtils';
import {
  buildShotWithMetadata,
  getNextDirectionalSelection,
  hasLoadedShotPayload,
  loadPreferredAutoMatchedProfile,
} from './shotSelection';

export function clearCompareSelectionState({
  compareLoadIdRef,
  setCompareShots,
  setComparePendingKeys,
  setCompareResults,
  setCompareIsSearchingProfile,
}) {
  compareLoadIdRef.current += 1;
  setCompareShots([]);
  setComparePendingKeys([]);
  setCompareResults([]);
  setCompareIsSearchingProfile(false);
}

function createCompareShotEntry({ shotKey, shotWithMetadata, item, loadKey }) {
  const matchedProfileName = shotWithMetadata.profile
    ? cleanName(shotWithMetadata.profile)
    : 'No Profile Loaded';

  return {
    key: shotKey,
    shot: shotWithMetadata,
    shotName: shotWithMetadata.name || item.name || String(loadKey),
    profile: null,
    profileName: matchedProfileName,
    profileSelectionMode: 'none',
  };
}

function applyMatchedCompareProfile(setCompareShots, shotKey, matchedProfile) {
  setCompareShots(currentEntries =>
    currentEntries.map(entry =>
      entry.key === shotKey
        ? {
            ...entry,
            profile: matchedProfile.profile || null,
            profileName: matchedProfile.profileName,
            profileSelectionMode: matchedProfile.profile ? 'auto' : 'none',
          }
        : entry,
    ),
  );
}

function isCurrentCompareLoad(loadId, compareLoadIdRef) {
  return loadId === compareLoadIdRef.current;
}

function clearComparePendingSelectionState({
  setPendingCompareSelection,
  setComparePendingKeys,
  setCompareIsSearchingProfile,
}) {
  setPendingCompareSelection(null);
  setComparePendingKeys([]);
  setCompareIsSearchingProfile(false);
}

function applyPendingCompareSelectionState(
  selectionRequest,
  setPendingCompareSelection,
  setComparePendingKeys,
) {
  const nextShotKey = getShotIdentityKey(selectionRequest?.item);
  setPendingCompareSelection({
    shot: selectionRequest.item,
    name: selectionRequest.name,
  });
  setComparePendingKeys(nextShotKey ? [nextShotKey] : []);
}

function getDirectionalCompareSelectionRequest(selectionRequest, loadId) {
  const nextSelection = getNextDirectionalSelection(selectionRequest);
  if (!nextSelection) return null;
  return {
    ...nextSelection,
    loadId,
  };
}

function getActivePrimaryShotKey(pendingPrimarySelectionRef, currentShotRef) {
  const activePrimaryShot = pendingPrimarySelectionRef.current?.shot || currentShotRef.current;
  return activePrimaryShot ? getShotIdentityKey(activePrimaryShot) : '';
}

function shouldAbortCompareLoad({
  requestId,
  compareSelectionRequestIdRef,
  loadId,
  compareLoadIdRef,
}) {
  return (
    requestId !== compareSelectionRequestIdRef.current ||
    !isCurrentCompareLoad(loadId, compareLoadIdRef)
  );
}

function advanceCompareSelectionAfterFailure({
  selectionRequest,
  loadId,
  setPendingCompareSelection,
  setComparePendingKeys,
  clearPendingState,
}) {
  const nextSelection = getDirectionalCompareSelectionRequest(selectionRequest, loadId);
  if (!nextSelection) {
    clearPendingState();
    return null;
  }

  applyPendingCompareSelectionState(
    nextSelection,
    setPendingCompareSelection,
    setComparePendingKeys,
  );
  return nextSelection;
}

function commitLoadedCompareSelection({
  targetShotKey,
  shotWithMetadata,
  item,
  loadKey,
  setCompareShots,
  setPendingCompareSelection,
  setComparePendingKeys,
}) {
  setCompareShots([
    createCompareShotEntry({ shotKey: targetShotKey, shotWithMetadata, item, loadKey }),
  ]);
  setPendingCompareSelection(null);
  setComparePendingKeys([]);
}

function finalizeCompareSelectionAttempt({
  requestId,
  compareSelectionRequestIdRef,
  item,
  setCompareIsSearchingProfile,
}) {
  if (requestId === compareSelectionRequestIdRef.current && !item?.profile) {
    setCompareIsSearchingProfile(false);
  }
}

function createComparePendingStateClearer({
  setPendingCompareSelection,
  setComparePendingKeys,
  setCompareIsSearchingProfile,
}) {
  return () =>
    clearComparePendingSelectionState({
      setPendingCompareSelection,
      setComparePendingKeys,
      setCompareIsSearchingProfile,
    });
}

function getSkippableCompareSelection({
  activeRequest,
  pendingPrimarySelectionRef,
  currentShotRef,
}) {
  const { item } = activeRequest;
  const targetShotKey = getShotIdentityKey(item);
  const activePrimaryShotKey = getActivePrimaryShotKey(pendingPrimarySelectionRef, currentShotRef);

  return {
    shouldSkip: Boolean(activePrimaryShotKey && targetShotKey === activePrimaryShotKey),
    targetShotKey,
  };
}

function getNextCompareSelection({
  activeRequest,
  loadId,
  setPendingCompareSelection,
  setComparePendingKeys,
  clearPendingState,
}) {
  return advanceCompareSelectionAfterFailure({
    selectionRequest: activeRequest,
    loadId,
    setPendingCompareSelection,
    setComparePendingKeys,
    clearPendingState,
  });
}

async function tryLoadActiveCompareSelection({
  activeRequest,
  clearPendingState,
  compareLoadIdRef,
  compareSelectionRequestIdRef,
  importMode,
  requestId,
  setCompareIsSearchingProfile,
  setComparePendingKeys,
  setCompareShots,
  setPendingCompareSelection,
  targetShotKey,
}) {
  const { item, loadId } = activeRequest;

  try {
    const { shotWithMetadata, loadKey } = await loadCompareShotSelection({ item, importMode });
    if (
      shouldAbortCompareLoad({
        requestId,
        compareSelectionRequestIdRef,
        loadId,
        compareLoadIdRef,
      })
    ) {
      return { status: 'aborted' };
    }

    commitLoadedCompareSelection({
      targetShotKey,
      shotWithMetadata,
      item,
      loadKey,
      setCompareShots,
      setPendingCompareSelection,
      setComparePendingKeys,
    });

    await tryAutoMatchCompareShotProfile({
      loadId,
      compareLoadIdRef,
      shotKey: targetShotKey,
      shotWithMetadata,
      setCompareIsSearchingProfile,
      setCompareShots,
    });

    return { status: 'loaded' };
  } catch (error) {
    if (
      shouldAbortCompareLoad({
        requestId,
        compareSelectionRequestIdRef,
        loadId,
        compareLoadIdRef,
      })
    ) {
      return { status: 'aborted' };
    }

    console.warn('Failed to load compare shot:', error);

    return {
      status: 'retry',
      nextRequest: getNextCompareSelection({
        activeRequest,
        loadId,
        setPendingCompareSelection,
        setComparePendingKeys,
        clearPendingState,
      }),
    };
  } finally {
    finalizeCompareSelectionAttempt({
      requestId,
      compareSelectionRequestIdRef,
      item,
      setCompareIsSearchingProfile,
    });
  }
}

export async function executeCompareSelectionLoad({
  requestId,
  selectionRequest,
  importMode,
  compareSelectionRequestIdRef,
  compareLoadIdRef,
  pendingPrimarySelectionRef,
  currentShotRef,
  setPendingCompareSelection,
  setComparePendingKeys,
  setCompareIsSearchingProfile,
  setCompareShots,
}) {
  const clearPendingState = createComparePendingStateClearer({
    setPendingCompareSelection,
    setComparePendingKeys,
    setCompareIsSearchingProfile,
  });

  let activeRequest = selectionRequest;

  while (activeRequest) {
    const { loadId } = activeRequest;
    const { shouldSkip, targetShotKey } = getSkippableCompareSelection({
      activeRequest,
      pendingPrimarySelectionRef,
      currentShotRef,
    });

    if (!targetShotKey) {
      clearPendingState();
      return false;
    }

    if (shouldSkip) {
      activeRequest = getNextCompareSelection({
        activeRequest,
        loadId,
        setPendingCompareSelection,
        setComparePendingKeys,
        clearPendingState,
      });
      if (!activeRequest) return false;
      continue;
    }

    const loadResult = await tryLoadActiveCompareSelection({
      activeRequest,
      clearPendingState,
      compareLoadIdRef,
      compareSelectionRequestIdRef,
      importMode,
      requestId,
      setCompareIsSearchingProfile,
      setComparePendingKeys,
      setCompareShots,
      setPendingCompareSelection,
      targetShotKey,
    });

    if (loadResult.status === 'loaded') return true;
    if (loadResult.status === 'aborted') return false;

    activeRequest = loadResult.nextRequest;
    if (!activeRequest) return false;
  }

  clearPendingState();
  return false;
}

async function loadCompareShotSelection({ item, importMode }) {
  const loadKey = getShotStorageKey(item);
  const loadedShot = hasLoadedShotPayload(item)
    ? item
    : await libraryService.loadShot(loadKey, item.source);
  const shotWithMetadata = buildShotWithMetadata({
    item,
    loadedShot,
    importMode,
    loadKey,
  });

  return {
    loadKey,
    shotWithMetadata,
  };
}

async function tryAutoMatchCompareShotProfile({
  loadId,
  compareLoadIdRef,
  shotKey,
  shotWithMetadata,
  setCompareIsSearchingProfile,
  setCompareShots,
}) {
  if (!shotWithMetadata.profile) {
    return;
  }

  try {
    setCompareIsSearchingProfile(true);
    const allProfiles = await libraryService.getAllProfiles('both');
    if (!isCurrentCompareLoad(loadId, compareLoadIdRef)) return;

    const matchedProfile = await loadPreferredAutoMatchedProfile(shotWithMetadata, allProfiles);
    if (!isCurrentCompareLoad(loadId, compareLoadIdRef)) return;

    if (matchedProfile) {
      applyMatchedCompareProfile(setCompareShots, shotKey, matchedProfile);
    }
  } catch (profileError) {
    if (!isCurrentCompareLoad(loadId, compareLoadIdRef)) return;
    console.warn('Compare profile auto-match failed:', profileError);
  } finally {
    if (isCurrentCompareLoad(loadId, compareLoadIdRef)) {
      setCompareIsSearchingProfile(false);
    }
  }
}
