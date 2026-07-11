/**
 * useShotChartFullDisplay.js
 *
 * Owns the overlay-style full-display mode for ShotChart.
 * The hook keeps viewport sizing and document scroll locking out of the
 * main component so ShotChart.jsx can stay focused on chart orchestration.
 */

import { useEffect, useState } from 'preact/hooks';
import { MAIN_CHART_HEIGHT_BIG } from './constants';

function getFullDisplayViewportHeight() {
  if (typeof window === 'undefined') return 0;
  return Math.round(window.visualViewport?.height || window.innerHeight || 0);
}

// Fit both charts into the available viewport height so the overlay does not
// introduce an extra internal scroll area on desktop or mobile browsers.
function getFullDisplayMainChartHeight(viewportHeight, tempChartHeightRatio) {
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) return MAIN_CHART_HEIGHT_BIG;

  const reservedChromeHeight = 136;
  const availableCombinedChartHeight = Math.max(560, viewportHeight - reservedChromeHeight);
  const totalChartRatio = 1 + tempChartHeightRatio;
  return Math.max(420, Math.min(980, Math.round(availableCombinedChartHeight / totalChartRatio)));
}

export function useShotChartFullDisplay({
  isControlsLocked,
  clearAllHoverRef,
  onBeforeToggle,
  mainChartHeight,
  tempChartHeightRatio,
}) {
  const [isFullDisplay, setIsFullDisplay] = useState(false);
  const [fullDisplayViewportHeight, setFullDisplayViewportHeight] = useState(
    getFullDisplayViewportHeight,
  );

  useEffect(() => {
    if (!isFullDisplay) return undefined;

    const documentElement = document.documentElement;
    const body = document.body;
    const previousDocumentOverflow = documentElement.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyOverscroll = body.style.overscrollBehavior;

    const handleViewportResize = () => {
      setFullDisplayViewportHeight(getFullDisplayViewportHeight());
    };

    const handleKeyDown = event => {
      if (event.key !== 'Escape' || isControlsLocked) return;
      setIsFullDisplay(false);
    };

    // Rendered via a portal, the overlay must own page scrolling while it is open.
    documentElement.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'contain';

    handleViewportResize();
    window.addEventListener('resize', handleViewportResize);
    window.visualViewport?.addEventListener('resize', handleViewportResize);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      documentElement.style.overflow = previousDocumentOverflow;
      body.style.overflow = previousBodyOverflow;
      body.style.overscrollBehavior = previousBodyOverscroll;
      window.removeEventListener('resize', handleViewportResize);
      window.visualViewport?.removeEventListener('resize', handleViewportResize);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isControlsLocked, isFullDisplay]);

  const toggleFullDisplay = () => {
    if (isControlsLocked) return;
    // Clear hover and close transient UI before moving the canvases into or out of
    // the portal so the user never carries stale overlay state across layouts.
    clearAllHoverRef.current?.();
    onBeforeToggle?.();
    setIsFullDisplay(current => !current);
  };

  const effectiveMainChartHeight = isFullDisplay
    ? getFullDisplayMainChartHeight(fullDisplayViewportHeight, tempChartHeightRatio)
    : mainChartHeight;

  return {
    isFullDisplay,
    toggleFullDisplay,
    effectiveMainChartHeight,
    effectiveTempChartHeight: Math.round(effectiveMainChartHeight * tempChartHeightRatio),
  };
}
