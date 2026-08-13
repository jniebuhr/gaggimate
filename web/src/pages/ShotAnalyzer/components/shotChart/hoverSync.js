/**
 * hoverSync.js
 *
 * Contains the cross-chart imperative behavior that keeps the main and
 * temperature charts visually aligned and hover-synchronized.
 */

function clearTooltipState(chart) {
  if (!chart) return;
  chart.$fixedTooltipPointerY = null;
  chart.$externalTooltipSource = null;
  chart.$externalTooltipClientY = null;
  chart.$shotChartHoverSyncActive = false;
  chart.setActiveElements([]);
  chart.tooltip?.setActiveElements([], { x: 0, y: 0 });
  chart.update('none');
}

function findClosestPointIndex(datasetData, xValue) {
  if (!Array.isArray(datasetData) || datasetData.length === 0) return -1;

  // Hover sync operates on the rendered chart datasets, not raw samples. A simple
  // nearest-point scan keeps the logic format-agnostic across replay and static states.
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < datasetData.length; i++) {
    const point = datasetData[i];
    if (!point || typeof point.x !== 'number') continue;

    const distance = Math.abs(point.x - xValue);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }

  return bestIndex;
}

function buildActiveElementsForX(chart, xValue) {
  const active = [];

  chart.data.datasets.forEach((dataset, datasetIndex) => {
    const meta = chart.getDatasetMeta(datasetIndex);
    if (!meta || meta.hidden || dataset.hidden) return;

    const index = findClosestPointIndex(dataset.data, xValue);
    if (index >= 0) active.push({ datasetIndex, index });
  });

  return active;
}

function applyHoverForChart(chart, xValue, pointerClientY, showTooltip = true, options = {}) {
  if (!chart || !Number.isFinite(xValue)) return;

  const active = buildActiveElementsForX(chart, xValue);
  if (!active.length) {
    clearTooltipState(chart);
    return;
  }

  const xPixel = chart.scales?.x?.getPixelForValue(xValue);
  const tooltipX = Number.isFinite(xPixel) ? xPixel : chart.chartArea.left + 8;
  let tooltipY = chart.chartArea.top + 8;

  if (Number.isFinite(pointerClientY) && chart.canvas) {
    // Clamp the tooltip anchor into the plotted region so dragging near the chart
    // edges never sends the tooltip outside the visible drawing area.
    const chartRect = chart.canvas.getBoundingClientRect();
    const minClientY = chartRect.top + chart.chartArea.top;
    const maxClientY = chartRect.top + chart.chartArea.bottom;
    const clampedClientY = Math.min(maxClientY, Math.max(minClientY, pointerClientY));
    tooltipY = clampedClientY - chartRect.top;
  }

  chart.$fixedTooltipPointerY = tooltipY;
  chart.$externalTooltipSource = options.tooltipSource || null;
  chart.$externalTooltipClientY = Number.isFinite(options.tooltipClientY)
    ? options.tooltipClientY
    : null;
  if (showTooltip) chart.$shotChartHoverSyncActive = true;
  chart.setActiveElements(active);
  if (showTooltip) {
    chart.tooltip?.setActiveElements(active, { x: tooltipX, y: tooltipY });
  } else {
    chart.tooltip?.setActiveElements([], { x: 0, y: 0 });
  }
  chart.update('none');
}

export function applyShotChartHoverAtX({
  mainChart,
  tempChart,
  xValue,
  pointerClientY,
  tooltipSource = 'main',
  onHoverXChange,
}) {
  if (!mainChart || !tempChart || !Number.isFinite(xValue)) return;

  applyHoverForChart(mainChart, xValue, pointerClientY, true, {
    tooltipSource,
    tooltipClientY: pointerClientY,
  });
  applyHoverForChart(tempChart, xValue, pointerClientY, false);
  onHoverXChange?.(xValue);
}

export function extractClientPoint(event) {
  if (!event) return null;
  if (Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
    return { clientX: event.clientX, clientY: event.clientY };
  }

  const touch = event.touches?.[0] || event.changedTouches?.[0];
  if (touch && Number.isFinite(touch.clientX) && Number.isFinite(touch.clientY)) {
    return { clientX: touch.clientX, clientY: touch.clientY };
  }

  return null;
}

function getChartClientRects(mainChart, tempChart) {
  if (!mainChart.scales?.x || !mainChart.canvas) return null;

  return {
    mainXScale: mainChart.scales.x,
    mainRect: mainChart.canvas.getBoundingClientRect(),
    tempRect: tempChart.canvas?.getBoundingClientRect?.() || null,
  };
}

function getHoverVerticalTolerance(isTouch) {
  return {
    bottom: isTouch ? 96 : 10,
    top: isTouch ? 48 : 0,
  };
}

function isClientYInRect(clientY, rect, tolerance) {
  return clientY >= rect.top - tolerance.top && clientY <= rect.bottom + tolerance.bottom;
}

function isClientYInChartHoverRange(clientY, mainRect, tempRect, isTouch) {
  const tolerance = getHoverVerticalTolerance(isTouch);
  const withinMainChart = isClientYInRect(clientY, mainRect, tolerance);
  const withinTempChart = tempRect ? isClientYInRect(clientY, tempRect, tolerance) : false;
  const stackBottom = tempRect?.bottom || mainRect.bottom;
  const withinChartStack =
    clientY >= mainRect.top - tolerance.top && clientY <= stackBottom + tolerance.bottom;

  return withinMainChart || withinTempChart || withinChartStack;
}

function getHoverXValueForClientX(mainChart, mainXScale, mainRect, clientX) {
  const minClientX = mainRect.left + (mainChart.chartArea?.left || 0);
  const maxClientX = mainRect.left + (mainChart.chartArea?.right || mainChart.width || 0);
  const clampedClientX = Math.min(maxClientX, Math.max(minClientX, clientX));
  const sourceX = clampedClientX - mainRect.left;

  return mainXScale.getValueForPixel(sourceX);
}

function getTooltipSourceForClientY(tempRect, clientY) {
  return tempRect && clientY >= tempRect.top && clientY <= tempRect.bottom ? 'temp' : 'main';
}

export function attachTempChartLayoutSync({ mainChart, tempChart }) {
  if (!mainChart || !tempChart) return () => {};

  const syncTempPlotArea = () => {
    // The temperature chart must mirror the main chart's inner plot width so the shared x-position lines up exactly.
    if (!mainChart.chartArea || !tempChart.chartArea) return;

    const currentPadding = tempChart.options.layout?.padding || {};
    const currentLeft = Number(currentPadding.left) || 0;
    const currentRight = Number(currentPadding.right) || 0;
    const currentTop = Number(currentPadding.top) || 0;
    const currentBottom = Number(currentPadding.bottom) || 0;
    const mainLeftMargin = mainChart.chartArea.left;
    const mainRightMargin = mainChart.width - mainChart.chartArea.right;
    const tempLeftMargin = tempChart.chartArea.left;
    const tempRightMargin = tempChart.width - tempChart.chartArea.right;
    const targetLeft = Math.max(0, currentLeft + mainLeftMargin - tempLeftMargin);
    const targetRight = Math.max(0, currentRight + mainRightMargin - tempRightMargin);
    const targetTop = currentTop;
    const targetBottom = currentBottom;

    if (
      Math.abs(currentLeft - targetLeft) < 0.5 &&
      Math.abs(currentRight - targetRight) < 0.5 &&
      Math.abs(currentTop - targetTop) < 0.5 &&
      Math.abs(currentBottom - targetBottom) < 0.5
    ) {
      return;
    }

    tempChart.options.layout = tempChart.options.layout || {};
    tempChart.options.layout.padding = {
      left: targetLeft,
      right: targetRight,
      top: targetTop,
      bottom: targetBottom,
    };
    tempChart.update('none');
  };

  const syncTempPlotAreaSettled = () => {
    // Chart.js chartArea measurements can settle over a few passes when hidden
    // axes and layout padding interact, so iterate until the plotted x-range converges.
    for (let pass = 0; pass < 4; pass += 1) {
      syncTempPlotArea();
    }
  };

  const handleResizeSync = () => {
    const browserWindow = globalThis.window;
    if (browserWindow) {
      browserWindow.requestAnimationFrame(syncTempPlotAreaSettled);
    } else {
      syncTempPlotAreaSettled();
    }
  };

  const browserWindow = globalThis.window;
  if (browserWindow) {
    browserWindow.requestAnimationFrame(syncTempPlotAreaSettled);
    browserWindow.addEventListener('resize', handleResizeSync);
  } else {
    syncTempPlotAreaSettled();
  }

  return () => {
    const cleanupWindow = globalThis.window;
    if (cleanupWindow) {
      cleanupWindow.removeEventListener('resize', handleResizeSync);
    }
  };
}

export function attachShotChartHoverSync({
  hoverArea,
  mainChart,
  tempChart,
  hideExternalTooltip,
  clearAllHoverRef,
  isReplayingRef,
  isExportingRef,
  onHoverXChange,
  disableDirectHoverOnMobile = false,
}) {
  if (!hoverArea || !mainChart || !tempChart) return () => {};

  const clearAllHover = () => {
    clearTooltipState(mainChart);
    clearTooltipState(tempChart);
    hideExternalTooltip();
    onHoverXChange?.(null);
  };
  const isDirectMobileHoverDisabled = () =>
    disableDirectHoverOnMobile &&
    Boolean(globalThis.window?.matchMedia?.('(max-width: 640px)').matches);
  clearAllHoverRef.current = clearAllHover;
  let activeTouchPointerId = null;
  let touchHoverActive = false;

  const applyUnifiedHoverFromClientPoint = (clientX, clientY, options = {}) => {
    if (isReplayingRef.current) {
      clearAllHover();
      return;
    }
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;

    const chartRects = getChartClientRects(mainChart, tempChart);
    if (!chartRects) return;

    const { mainXScale, mainRect, tempRect } = chartRects;
    if (!isClientYInChartHoverRange(clientY, mainRect, tempRect, options.isTouch)) {
      if (!options.keepHoverOnMiss) clearAllHover();
      return;
    }

    const xValue = getHoverXValueForClientX(mainChart, mainXScale, mainRect, clientX);
    if (!Number.isFinite(xValue)) {
      clearAllHover();
      return;
    }

    applyShotChartHoverAtX({
      mainChart,
      tempChart,
      xValue,
      pointerClientY: clientY,
      tooltipSource: getTooltipSourceForClientY(tempRect, clientY),
      onHoverXChange,
    });
  };

  const handleUnifiedMove = event => {
    if (isReplayingRef.current || isExportingRef.current) {
      clearAllHover();
      return;
    }

    if (isDirectMobileHoverDisabled()) {
      return;
    }

    const point = extractClientPoint(event);
    if (!point) return;

    const isTouch = event?.pointerType === 'touch' || event?.type?.startsWith('touch');
    if (isTouch) {
      return;
    }

    applyUnifiedHoverFromClientPoint(point.clientX, point.clientY, {
      isTouch,
      keepHoverOnMiss: isTouch,
    });
  };

  const handlePointerEnd = event => {
    if (isDirectMobileHoverDisabled()) return;
    if (event?.pointerType === 'touch') {
      activeTouchPointerId = null;
      touchHoverActive = false;
    }
    clearAllHover();
  };

  const handlePointerDown = event => {
    if (isDirectMobileHoverDisabled()) return;
    if (event?.pointerType === 'touch') {
      activeTouchPointerId = event.pointerId;
      touchHoverActive = false;
      clearAllHover();
      return;
    }
    handleUnifiedMove(event);
  };

  const handlePointerLeave = event => {
    if (event?.pointerType === 'touch' || activeTouchPointerId != null || touchHoverActive) return;
    clearAllHover();
  };

  const handlePointerCancel = event => {
    if (isDirectMobileHoverDisabled()) return;
    if (event?.pointerType === 'touch') {
      activeTouchPointerId = null;
      touchHoverActive = false;
      return;
    }
    clearAllHover();
  };

  const handleTouchStart = event => {
    if (isReplayingRef.current || isExportingRef.current) {
      clearAllHover();
      return;
    }

    if (isDirectMobileHoverDisabled()) {
      return;
    }

    const point = extractClientPoint(event);
    if (!point) return;

    touchHoverActive = true;
    applyUnifiedHoverFromClientPoint(point.clientX, point.clientY, {
      isTouch: true,
      keepHoverOnMiss: true,
    });
  };

  const handleTouchMove = event => {
    if (!touchHoverActive) return;
    const point = extractClientPoint(event);
    if (!point) return;

    applyUnifiedHoverFromClientPoint(point.clientX, point.clientY, {
      isTouch: true,
      keepHoverOnMiss: true,
    });
  };

  const handleTouchEnd = () => {
    if (isDirectMobileHoverDisabled()) return;
    activeTouchPointerId = null;
    touchHoverActive = false;
    clearAllHover();
  };

  const supportsPointerEvents = Boolean(globalThis.window?.PointerEvent);
  if (supportsPointerEvents) {
    hoverArea.addEventListener('pointerdown', handlePointerDown, { passive: true });
    hoverArea.addEventListener('pointermove', handleUnifiedMove, { passive: true });
    hoverArea.addEventListener('pointerup', handlePointerEnd);
    hoverArea.addEventListener('pointerleave', handlePointerLeave);
    hoverArea.addEventListener('pointercancel', handlePointerCancel);
  } else {
    hoverArea.addEventListener('mousemove', handleUnifiedMove);
    hoverArea.addEventListener('mouseleave', clearAllHover);
  }
  hoverArea.addEventListener('touchstart', handleTouchStart, { passive: true });
  hoverArea.addEventListener('touchmove', handleTouchMove, { passive: true });
  hoverArea.addEventListener('touchend', handleTouchEnd);
  document.addEventListener('touchend', handleTouchEnd);

  return () => {
    clearAllHoverRef.current = () => {};
    if (supportsPointerEvents) {
      hoverArea.removeEventListener('pointerdown', handlePointerDown);
      hoverArea.removeEventListener('pointermove', handleUnifiedMove);
      hoverArea.removeEventListener('pointerup', handlePointerEnd);
      hoverArea.removeEventListener('pointerleave', handlePointerLeave);
      hoverArea.removeEventListener('pointercancel', handlePointerCancel);
    } else {
      hoverArea.removeEventListener('mousemove', handleUnifiedMove);
      hoverArea.removeEventListener('mouseleave', clearAllHover);
    }
    hoverArea.removeEventListener('touchstart', handleTouchStart);
    hoverArea.removeEventListener('touchmove', handleTouchMove);
    hoverArea.removeEventListener('touchend', handleTouchEnd);
    document.removeEventListener('touchend', handleTouchEnd);
  };
}
