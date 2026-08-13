import { useLayoutEffect, useState } from 'preact/hooks';

function resetMeasuredDesktopDetailsHeight(setDesktopSingleDetailsHeight) {
  setDesktopSingleDetailsHeight(prev => (prev === 0 ? prev : 0));
}

function getDesktopSingleChartStyle(singleDesktopDetailsHeight) {
  if (!singleDesktopDetailsHeight) return undefined;
  return { height: `${singleDesktopDetailsHeight}px` };
}

/** Keeps the desktop single chart aligned with the measured details column. */
export function useDesktopShotDetailsHeight({
  analysisResults,
  chartMountKey,
  currentShot,
  isCompareActive,
  shotDetailsColumnRef,
}) {
  const [desktopSingleDetailsHeight, setDesktopSingleDetailsHeight] = useState(0);

  useLayoutEffect(() => {
    if (globalThis.window === undefined) return undefined;
    if (!currentShot || !analysisResults || isCompareActive) {
      resetMeasuredDesktopDetailsHeight(setDesktopSingleDetailsHeight);
      return undefined;
    }

    const detailsElement = shotDetailsColumnRef.current;
    if (!detailsElement) {
      resetMeasuredDesktopDetailsHeight(setDesktopSingleDetailsHeight);
      return undefined;
    }
    if (typeof ResizeObserver === 'undefined') {
      resetMeasuredDesktopDetailsHeight(setDesktopSingleDetailsHeight);
      return undefined;
    }

    const desktopMediaQuery = globalThis.window.matchMedia('(min-width: 1024px)');
    let frameId = 0;
    const updateHeight = () => {
      if (!desktopMediaQuery.matches) {
        resetMeasuredDesktopDetailsHeight(setDesktopSingleDetailsHeight);
        return;
      }

      const nextHeight = Math.round(detailsElement.getBoundingClientRect().height || 0);
      setDesktopSingleDetailsHeight(prev => (Math.abs(prev - nextHeight) <= 1 ? prev : nextHeight));
    };
    const scheduleUpdate = () => {
      globalThis.window.cancelAnimationFrame(frameId);
      frameId = globalThis.window.requestAnimationFrame(updateHeight);
    };
    const resizeObserver = new ResizeObserver(scheduleUpdate);

    resizeObserver.observe(detailsElement);
    desktopMediaQuery.addEventListener('change', scheduleUpdate);
    globalThis.window.addEventListener('resize', scheduleUpdate);
    scheduleUpdate();

    return () => {
      globalThis.window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      desktopMediaQuery.removeEventListener('change', scheduleUpdate);
      globalThis.window.removeEventListener('resize', scheduleUpdate);
    };
  }, [analysisResults, chartMountKey, currentShot, isCompareActive, shotDetailsColumnRef]);

  const singleDesktopDetailsHeight =
    !isCompareActive && desktopSingleDetailsHeight > 0 ? desktopSingleDetailsHeight : 0;

  return {
    singleDesktopDetailsHeight,
    singleDesktopChartStyle: getDesktopSingleChartStyle(singleDesktopDetailsHeight),
  };
}
