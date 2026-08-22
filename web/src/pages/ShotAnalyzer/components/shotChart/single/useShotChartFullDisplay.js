/**
 * useShotChartFullDisplay.js
 *
 * Owns the overlay-style full-display mode for ShotChart.
 * The hook keeps viewport sizing and document scroll locking out of the
 * main component so ShotChart.jsx can stay focused on chart orchestration.
 */

import { useEffect, useState } from 'preact/hooks';
import { MAIN_CHART_HEIGHT_DEFAULT } from '../constants';

function getFullDisplayViewportHeight() {
  const browserWindow = globalThis.window;
  if (!browserWindow) return 0;
  return Math.round(browserWindow.visualViewport?.height || browserWindow.innerHeight || 0);
}

function isFullDisplayAllowedViewport() {
  const browserWindow = globalThis.window;
  if (!browserWindow?.matchMedia) return true;
  return !browserWindow.matchMedia('(max-width: 1023px)').matches;
}

// Fit both charts into the available viewport height when possible. On very
// small viewports the chart area may still scroll, but the initial sizing should
// stay close to the visible overlay instead of forcing a desktop-sized chart.
function getFullDisplayMainChartHeight(viewportHeight, tempChartHeightRatio) {
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) return MAIN_CHART_HEIGHT_DEFAULT;

  const reservedChromeHeight = 136;
  const availableCombinedChartHeight = Math.max(260, viewportHeight - reservedChromeHeight);
  const totalChartRatio = 1 + tempChartHeightRatio;
  const fittedMainHeight = Math.round(availableCombinedChartHeight / totalChartRatio);
  const responsiveMinimum = viewportHeight < 560 ? 220 : 320;
  return Math.max(responsiveMinimum, Math.min(980, fittedMainHeight));
}

export function useShotChartFullDisplay({
  isControlsLocked,
  clearAllHoverRef,
  onBeforeToggle,
  resolvedMainChartHeight,
  tempChartHeightRatio,
}) {
  const [isFullDisplay, setIsFullDisplay] = useState(false);
  const [fullDisplayViewportHeight, setFullDisplayViewportHeight] = useState(
    getFullDisplayViewportHeight,
  );

  useEffect(() => {
    if (!isFullDisplay) return undefined;

    const browserWindow = globalThis.window;
    const browserDocument = globalThis.document;
    if (!browserWindow || !browserDocument) return undefined;

    const documentElement = browserDocument.documentElement;
    const body = browserDocument.body;
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
    browserWindow.addEventListener('resize', handleViewportResize);
    browserWindow.visualViewport?.addEventListener('resize', handleViewportResize);
    browserDocument.addEventListener('keydown', handleKeyDown);

    return () => {
      documentElement.style.overflow = previousDocumentOverflow;
      body.style.overflow = previousBodyOverflow;
      body.style.overscrollBehavior = previousBodyOverscroll;
      browserWindow.removeEventListener('resize', handleViewportResize);
      browserWindow.visualViewport?.removeEventListener('resize', handleViewportResize);
      browserDocument.removeEventListener('keydown', handleKeyDown);
    };
  }, [isControlsLocked, isFullDisplay]);

  useEffect(() => {
    const browserWindow = globalThis.window;
    if (!browserWindow?.matchMedia) return undefined;

    const mediaQuery = browserWindow.matchMedia('(max-width: 1023px)');
    const handleChange = event => {
      if (event.matches) setIsFullDisplay(false);
    };

    if (mediaQuery.matches) setIsFullDisplay(false);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleFullDisplay = () => {
    if (isControlsLocked) return;
    if (!isFullDisplay && !isFullDisplayAllowedViewport()) return;
    // Clear hover and close transient UI before moving the canvases into or out of
    // the portal so the user never carries stale overlay state across layouts.
    clearAllHoverRef.current?.();
    onBeforeToggle?.();
    setIsFullDisplay(current => !current);
  };

  const effectiveMainChartHeight = isFullDisplay
    ? getFullDisplayMainChartHeight(fullDisplayViewportHeight, tempChartHeightRatio)
    : resolvedMainChartHeight;

  return {
    isFullDisplay,
    toggleFullDisplay,
    effectiveMainChartHeight,
    effectiveTempChartHeight: Math.round(effectiveMainChartHeight * tempChartHeightRatio),
  };
}
