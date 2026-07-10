export function isTypingTarget(target) {
  const activeElement =
    typeof Element !== 'undefined' && target instanceof Element ? target : document.activeElement;
  if (!activeElement) return false;
  const tag = activeElement.tagName?.toLowerCase();
  if (activeElement.isContentEditable) return true;
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return !!activeElement.closest(
    'input, textarea, select, [contenteditable="true"], [role="textbox"]',
  );
}

export function getAnalyzerActionBarNavigationState({
  hasShot,
  shotList,
  activeShot,
  getShotNotesKey,
}) {
  const currentIndex = hasShot
    ? shotList.findIndex(
        shot =>
          getShotNotesKey(shot) === getShotNotesKey(activeShot) &&
          shot.source === activeShot?.source,
      )
    : -1;

  return {
    currentIndex,
    canGoPrev: hasShot && currentIndex > 0,
    canGoNext: hasShot && currentIndex >= 0 && currentIndex < shotList.length - 1,
  };
}

export function getAnalyzerActionBarDisplayState({ currentShot, selectedShot }) {
  const displayShot = selectedShot || currentShot;
  return {
    displayShot,
    hasDisplayShot: Boolean(displayShot),
  };
}
