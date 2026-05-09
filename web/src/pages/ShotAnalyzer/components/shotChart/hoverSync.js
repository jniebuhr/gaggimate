/**
 * hoverSync.js
 *
 * Contains the cross-chart imperative behavior that keeps the main and
 * temperature charts visually aligned and hover-synchronized.
 */

function clearTooltipState(chart) {
  if (!chart) return;
  chart.$fixedTooltipPointerY = null;
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

function applyHoverForChart(chart, xValue, pointerClientY, showTooltip = true) {
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
  chart.setActiveElements(active);
  if (showTooltip) {
    chart.tooltip?.setActiveElements(active, { x: tooltipX, y: tooltipY });
  } else {
    chart.tooltip?.setActiveElements([], { x: 0, y: 0 });
  }
  chart.update('none');
}

function extractClientPoint(event) {
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

export function attachTempChartLayoutSync({ mainChart, tempChart }) {
  if (!mainChart || !tempChart) return () => {};

  const syncTempPlotArea = () => {
    // The temperature chart must mirror the main chart's inner plot width so the shared x-position lines up exactly.
    if (!mainChart.chartArea || !tempChart.chartArea) return;

    const mainLeftMargin = mainChart.chartArea.left;
    const mainRightMargin = mainChart.width - mainChart.chartArea.right;
    const tempLeftMargin = tempChart.chartArea.left;
    const tempRightMargin = tempChart.width - tempChart.chartArea.right;
    const leftPadding = Math.max(0, mainLeftMargin - tempLeftMargin);
    const rightPadding = Math.max(0, mainRightMargin - tempRightMargin);
    const currentPadding = tempChart.options.layout?.padding || {};
    const currentLeft = Number(currentPadding.left) || 0;
    const currentRight = Number(currentPadding.right) || 0;

    if (Math.abs(currentLeft - leftPadding) < 0.5 && Math.abs(currentRight - rightPadding) < 0.5) {
      return;
    }

    tempChart.options.layout = tempChart.options.layout || {};
    tempChart.options.layout.padding = {
      left: leftPadding,
      right: rightPadding,
      top: 0,
      bottom: 0,
    };
    tempChart.update('none');
  };

  const syncTempPlotAreaTwice = () => {
    // Chart.js chartArea measurements can settle across two frames during initial
    // layout, so a second pass avoids one-pixel drift between both x-ranges.
    syncTempPlotArea();
    syncTempPlotArea();
  };

  const handleResizeSync = () => {
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(syncTempPlotAreaTwice);
    } else {
      syncTempPlotAreaTwice();
    }
  };

  if (typeof window !== 'undefined') {
    window.requestAnimationFrame(syncTempPlotAreaTwice);
    window.addEventListener('resize', handleResizeSync);
  } else {
    syncTempPlotAreaTwice();
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', handleResizeSync);
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
}) {
  if (!hoverArea || !mainChart || !tempChart) return () => {};

  const clearAllHover = () => {
    clearTooltipState(mainChart);
    clearTooltipState(tempChart);
    hideExternalTooltip();
  };
  clearAllHoverRef.current = clearAllHover;

  const applyUnifiedHoverFromClientPoint = (clientX, clientY) => {
    // One hover surface spans both canvases so the guide line and tooltip stay synchronized across charts.
    if (isReplayingRef.current) {
      clearAllHover();
      return;
    }
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;

    const mainXScale = mainChart.scales?.x;
    if (!mainXScale || !mainChart.canvas) return;

    const areaRect = hoverArea.getBoundingClientRect();
    const verticalTolerance = 20;
    const withinVerticalTolerance =
      clientY >= areaRect.top - verticalTolerance && clientY <= areaRect.bottom + verticalTolerance;
    if (!withinVerticalTolerance) {
      clearAllHover();
      return;
    }

    const mainRect = mainChart.canvas.getBoundingClientRect();
    const minClientX = mainRect.left + (mainChart.chartArea?.left || 0);
    const maxClientX = mainRect.left + (mainChart.chartArea?.right || mainChart.width || 0);
    const clampedClientX = Math.min(maxClientX, Math.max(minClientX, clientX));
    const sourceX = clampedClientX - mainRect.left;
    const xValue = mainXScale.getValueForPixel(sourceX);
    if (!Number.isFinite(xValue)) {
      clearAllHover();
      return;
    }

    applyHoverForChart(mainChart, xValue, clientY, true);
    applyHoverForChart(tempChart, xValue, clientY, false);
  };

  const handleUnifiedMove = event => {
    if (isReplayingRef.current || isExportingRef.current) {
      // Replay/export own the chart visuals. Clear any pointer state immediately so
      // user interaction never competes with the animation or recorded output.
      clearAllHover();
      return;
    }

    const point = extractClientPoint(event);
    if (!point) return;

    applyUnifiedHoverFromClientPoint(point.clientX, point.clientY);
  };

  const supportsPointerEvents = typeof window !== 'undefined' && Boolean(window.PointerEvent);
  if (supportsPointerEvents) {
    // Pointer Events cover mouse, pen, and touch in one path where supported.
    hoverArea.addEventListener('pointerdown', handleUnifiedMove, { passive: true });
    hoverArea.addEventListener('pointermove', handleUnifiedMove, { passive: true });
    hoverArea.addEventListener('pointerup', clearAllHover);
    hoverArea.addEventListener('pointerleave', clearAllHover);
    hoverArea.addEventListener('pointercancel', clearAllHover);
  } else {
    // Keep an explicit mouse/touch fallback for browsers that still lack Pointer Events.
    hoverArea.addEventListener('mousemove', handleUnifiedMove);
    hoverArea.addEventListener('mouseleave', clearAllHover);
    hoverArea.addEventListener('touchstart', handleUnifiedMove, { passive: true });
    hoverArea.addEventListener('touchmove', handleUnifiedMove, { passive: true });
    hoverArea.addEventListener('touchend', clearAllHover);
    hoverArea.addEventListener('touchcancel', clearAllHover);
  }

  return () => {
    clearAllHoverRef.current = () => {};
    if (supportsPointerEvents) {
      hoverArea.removeEventListener('pointerdown', handleUnifiedMove);
      hoverArea.removeEventListener('pointermove', handleUnifiedMove);
      hoverArea.removeEventListener('pointerup', clearAllHover);
      hoverArea.removeEventListener('pointerleave', clearAllHover);
      hoverArea.removeEventListener('pointercancel', clearAllHover);
    } else {
      hoverArea.removeEventListener('mousemove', handleUnifiedMove);
      hoverArea.removeEventListener('mouseleave', clearAllHover);
      hoverArea.removeEventListener('touchstart', handleUnifiedMove);
      hoverArea.removeEventListener('touchmove', handleUnifiedMove);
      hoverArea.removeEventListener('touchend', clearAllHover);
      hoverArea.removeEventListener('touchcancel', clearAllHover);
    }
  };
}
