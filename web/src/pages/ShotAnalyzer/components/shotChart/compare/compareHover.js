import { areTooltipStatesEqual } from '../ShotChartExternalTooltip';

export function clearCompareChartHover(chart) {
  if (!chart) return;
  chart.$fixedTooltipPointerY = null;
  chart.$fixedTooltipPointerX = null;
  chart.$fixedTooltipXValue = null;
  chart.setActiveElements([]);
  chart.tooltip?.setActiveElements([], { x: 0, y: 0 });
  chart.update('none');
}

function findClosestPointIndex(datasetData, xValue) {
  if (!Array.isArray(datasetData) || datasetData.length === 0 || !Number.isFinite(xValue)) {
    return -1;
  }

  let low = 0;
  let high = datasetData.length - 1;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const midX = Number(datasetData[mid]?.x);

    if (!Number.isFinite(midX) || midX < xValue) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  const candidateIndexes = [low - 1, low, low + 1];
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;

  candidateIndexes.forEach(index => {
    if (index < 0 || index >= datasetData.length) return;
    const point = datasetData[index];
    const pointX = Number(point?.x);
    const pointY = Number(point?.y);
    if (!Number.isFinite(pointX) || !Number.isFinite(pointY)) return;

    const distance = Math.abs(pointX - xValue);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function buildCompareActiveElements(chart, xValue) {
  if (!chart || !Number.isFinite(xValue)) return [];

  return chart.data.datasets.reduce((active, dataset, datasetIndex) => {
    const meta = chart.getDatasetMeta(datasetIndex);
    if (!meta || meta.hidden || dataset?.hidden || !chart.isDatasetVisible(datasetIndex)) {
      return active;
    }

    const pointIndex = findClosestPointIndex(dataset?.data, xValue);
    if (pointIndex >= 0) {
      active.push({ datasetIndex, index: pointIndex });
    }
    return active;
  }, []);
}

function getDatasetEndX(dataset) {
  const points = Array.isArray(dataset?.data) ? dataset.data : [];
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const pointX = Number(points[index]?.x);
    const pointY = Number(points[index]?.y);
    if (Number.isFinite(pointX) && Number.isFinite(pointY)) return pointX;
  }
  return Number.NEGATIVE_INFINITY;
}

function resolveCompareTitleOnlyDatasetIndex(chart) {
  if (!chart) return -1;
  const cachedIndex = Number(chart.$compareTitleOnlyDatasetIndex);
  if (Number.isInteger(cachedIndex)) {
    const cachedDataset = chart.data.datasets[cachedIndex];
    const cachedMeta = chart.getDatasetMeta(cachedIndex);
    if (
      cachedDataset &&
      cachedMeta &&
      !cachedMeta.hidden &&
      !cachedDataset.hidden &&
      chart.isDatasetVisible(cachedIndex)
    ) {
      return cachedIndex;
    }
  }

  let bestCandidate = null;

  chart.data.datasets.forEach((dataset, datasetIndex) => {
    const meta = chart.getDatasetMeta(datasetIndex);
    if (!meta || meta.hidden || dataset?.hidden || !chart.isDatasetVisible(datasetIndex)) return;

    const endX = getDatasetEndX(dataset);
    if (!bestCandidate || endX > bestCandidate.endX) {
      bestCandidate = { datasetIndex, endX };
    }
  });

  chart.$compareTitleOnlyDatasetIndex = bestCandidate?.datasetIndex ?? -1;
  return chart.$compareTitleOnlyDatasetIndex;
}

function buildCompareTitleOnlyActiveElements(chart, xValue) {
  if (!chart || !Number.isFinite(xValue)) return [];

  const datasetIndex = resolveCompareTitleOnlyDatasetIndex(chart);
  if (datasetIndex < 0) return [];

  const pointIndex = findClosestPointIndex(chart.data.datasets[datasetIndex]?.data, xValue);
  return pointIndex >= 0 ? [{ datasetIndex, index: pointIndex }] : [];
}

function resolveCompareHoverGeometry(chart, clientX, clientY) {
  const xScale = chart?.scales?.x;
  if (!chart?.canvas || !chart?.chartArea || !xScale || !Number.isFinite(clientX)) return null;

  const chartRect = chart.canvas.getBoundingClientRect();
  const minClientX = chartRect.left + chart.chartArea.left;
  const maxClientX = chartRect.left + chart.chartArea.right;
  const clampedClientX = Math.min(maxClientX, Math.max(minClientX, clientX));
  const sourceX = clampedClientX - chartRect.left;
  const xValue = xScale.getValueForPixel(sourceX);

  if (!Number.isFinite(xValue)) return null;

  const xPixel = xScale.getPixelForValue(xValue);
  const minClientY = chartRect.top + chart.chartArea.top;
  const maxClientY = chartRect.top + chart.chartArea.bottom;
  const clampedClientY = Number.isFinite(clientY)
    ? Math.min(maxClientY, Math.max(minClientY, clientY))
    : minClientY;

  return {
    xValue,
    xPixel: Number.isFinite(xPixel) ? xPixel : chart.chartArea.left + 8,
    tooltipY: clampedClientY - chartRect.top,
  };
}

export function applyCompareTitleOnlyHover(chart, clientX, clientY, setExternalTooltipState) {
  const hoverGeometry = resolveCompareHoverGeometry(chart, clientX, clientY);
  if (!hoverGeometry) {
    clearCompareChartHover(chart);
    return;
  }

  const { xValue, xPixel, tooltipY } = hoverGeometry;
  chart.$fixedTooltipPointerX = xPixel;
  chart.$fixedTooltipPointerY = tooltipY;
  chart.$fixedTooltipXValue = xValue;
  chart.setActiveElements([]);
  chart.tooltip?.setActiveElements([], { x: 0, y: 0 });
  chart.draw();

  const nextState = {
    visible: true,
    titleLines: [`${xValue.toFixed(2)} s`],
    phaseSummaries: [],
    rows: [],
    anchorX: xPixel,
    anchorY: tooltipY,
    chartWidth: chart.width,
    chartHeight: chart.height,
    chartAreaLeft: chart.chartArea.left,
    chartAreaRight: chart.chartArea.right,
    chartAreaTop: chart.chartArea.top,
    chartAreaBottom: chart.chartArea.bottom,
  };

  setExternalTooltipState(prev => (areTooltipStatesEqual(prev, nextState) ? prev : nextState));
}

export function applyCompareHover(chart, clientX, clientY, { titleOnly = false } = {}) {
  const hoverGeometry = resolveCompareHoverGeometry(chart, clientX, clientY);
  if (!hoverGeometry) {
    clearCompareChartHover(chart);
    return;
  }
  const { xValue, xPixel, tooltipY } = hoverGeometry;

  // Build hover state from the shared x-position so every visible compare
  // series contributes a single aligned point instead of relying on Chart.js'
  // nearest-dataset heuristics. Statistics title-only tooltips only need one
  // representative point to make Chart.js invoke the external tooltip.
  const active = titleOnly
    ? buildCompareTitleOnlyActiveElements(chart, xValue)
    : buildCompareActiveElements(chart, xValue);
  if (!active.length) {
    clearCompareChartHover(chart);
    return;
  }

  chart.$fixedTooltipPointerX = xPixel;
  chart.$fixedTooltipPointerY = tooltipY;
  chart.$fixedTooltipXValue = xValue;
  chart.setActiveElements(active);
  chart.tooltip?.setActiveElements(active, {
    x: xPixel,
    y: tooltipY,
  });
  chart.update('none');
}

export function applyCompareHoverAtX(chart, xValue, { titleOnly = false } = {}) {
  const xScale = chart?.scales?.x;
  if (!chart?.canvas || !chart?.chartArea || !xScale || !Number.isFinite(Number(xValue))) {
    clearCompareChartHover(chart);
    return;
  }

  const xPixel = xScale.getPixelForValue(Number(xValue));
  if (!Number.isFinite(xPixel)) {
    clearCompareChartHover(chart);
    return;
  }

  const chartRect = chart.canvas.getBoundingClientRect();
  const chartAreaHeight = Number(chart.chartArea.bottom) - Number(chart.chartArea.top);
  const clientY =
    chartRect.top +
    chart.chartArea.top +
    (Number.isFinite(chartAreaHeight) && chartAreaHeight > 0 ? chartAreaHeight / 2 : 0);

  applyCompareHover(chart, chartRect.left + xPixel, clientY, { titleOnly });
}

export function addCompareHoverListeners(
  hoverSurface,
  supportsPointerEvents,
  handleHoverMove,
  clearHover,
) {
  if (supportsPointerEvents) {
    hoverSurface.addEventListener('pointerdown', handleHoverMove, { passive: true });
    hoverSurface.addEventListener('pointermove', handleHoverMove, { passive: true });
    hoverSurface.addEventListener('pointerup', clearHover);
    hoverSurface.addEventListener('pointerleave', clearHover);
    hoverSurface.addEventListener('pointercancel', clearHover);
    return;
  }

  hoverSurface.addEventListener('mousemove', handleHoverMove);
  hoverSurface.addEventListener('mouseleave', clearHover);
  hoverSurface.addEventListener('touchstart', handleHoverMove, { passive: true });
  hoverSurface.addEventListener('touchmove', handleHoverMove, { passive: true });
  hoverSurface.addEventListener('touchend', clearHover);
  hoverSurface.addEventListener('touchcancel', clearHover);
}

export function removeCompareHoverListeners(
  hoverSurface,
  supportsPointerEvents,
  handleHoverMove,
  clearHover,
) {
  if (supportsPointerEvents) {
    hoverSurface.removeEventListener('pointerdown', handleHoverMove);
    hoverSurface.removeEventListener('pointermove', handleHoverMove);
    hoverSurface.removeEventListener('pointerup', clearHover);
    hoverSurface.removeEventListener('pointerleave', clearHover);
    hoverSurface.removeEventListener('pointercancel', clearHover);
    return;
  }

  hoverSurface.removeEventListener('mousemove', handleHoverMove);
  hoverSurface.removeEventListener('mouseleave', clearHover);
  hoverSurface.removeEventListener('touchstart', handleHoverMove);
  hoverSurface.removeEventListener('touchmove', handleHoverMove);
  hoverSurface.removeEventListener('touchend', clearHover);
  hoverSurface.removeEventListener('touchcancel', clearHover);
}
