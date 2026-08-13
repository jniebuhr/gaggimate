function clampScrubberValue(value, min, max) {
  const numericValue = Number(value);
  const numericMin = Number(min);
  const numericMax = Number(max);

  if (
    !Number.isFinite(numericValue) ||
    !Number.isFinite(numericMin) ||
    !Number.isFinite(numericMax)
  ) {
    return null;
  }

  return Math.min(numericMax, Math.max(numericMin, numericValue));
}

function roundScrubberValue(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Number(numericValue.toFixed(1)) : null;
}

export function getChartScrubberInsets(chart) {
  const chartArea = chart?.chartArea;
  if (!chart || !chartArea) return null;

  return {
    left: Math.max(0, Math.round(Number(chartArea.left) || 0)),
    right: Math.max(0, Math.round((Number(chart.width) || 0) - (Number(chartArea.right) || 0))),
  };
}

export function isStaticMobileTooltipViewport() {
  if (globalThis.window?.matchMedia === undefined) return false;
  return globalThis.window.matchMedia('(max-width: 640px)').matches;
}

export function getScrubberValueFromPointerEvent(event, { min, max, trackElement }) {
  const numericMin = Number(min);
  const numericMax = Number(max);
  if (!event || !trackElement || !Number.isFinite(numericMin) || !Number.isFinite(numericMax)) {
    return null;
  }

  const rect = trackElement.getBoundingClientRect();
  const width = Number(rect.width) || 0;
  if (width <= 0 || !Number.isFinite(event.clientX)) return null;

  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / width));
  return roundScrubberValue(numericMin + (numericMax - numericMin) * ratio);
}

export function getScrubberValueFromNativeInputEvent(
  event,
  { min, max, ignoreInputUntil = 0, lastPointerInputAt = 0 },
) {
  const now = Date.now();
  if (now < ignoreInputUntil || now - lastPointerInputAt < 120) return null;

  return roundScrubberValue(clampScrubberValue(event?.currentTarget?.value, min, max));
}
