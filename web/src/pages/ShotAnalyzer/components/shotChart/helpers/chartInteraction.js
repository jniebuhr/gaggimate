import {
  EXTERNAL_TOOLTIP_BOUNDS_PADDING,
  EXTERNAL_TOOLTIP_POINTER_GAP,
  EXTERNAL_TOOLTIP_VERTICAL_OFFSET,
} from '../constants';

export function resolveHoverPointColor(context) {
  const datasetColor = context?.dataset?.borderColor;
  return typeof datasetColor === 'string' && datasetColor.length > 0 ? datasetColor : '#94a3b8';
}

export function createChartPointElementConfig() {
  return {
    radius: 0,
    hoverRadius: 0,
    hitRadius: 12,
    borderWidth: 0,
    hoverBorderWidth: 0,
    backgroundColor: resolveHoverPointColor,
    hoverBackgroundColor: resolveHoverPointColor,
    borderColor: resolveHoverPointColor,
    hoverBorderColor: resolveHoverPointColor,
  };
}

export function computeExternalTooltipPosition({
  anchorX,
  anchorY,
  chartWidth,
  chartHeight,
  tooltipWidth,
  tooltipHeight,
  boundsPadding = EXTERNAL_TOOLTIP_BOUNDS_PADDING,
  pointerGap = EXTERNAL_TOOLTIP_POINTER_GAP,
  verticalOffset = EXTERNAL_TOOLTIP_VERTICAL_OFFSET,
  boundsLeft,
  boundsRight,
  boundsTop,
  boundsBottom,
}) {
  const resolvedBoundsLeft = Number.isFinite(boundsLeft) ? boundsLeft : boundsPadding;
  const resolvedBoundsRight = Number.isFinite(boundsRight)
    ? boundsRight
    : chartWidth - boundsPadding;
  const resolvedBoundsTop = Number.isFinite(boundsTop) ? boundsTop : boundsPadding;
  const resolvedBoundsBottom = Number.isFinite(boundsBottom)
    ? boundsBottom
    : chartHeight - boundsPadding;
  const chartMidX = resolvedBoundsLeft + (resolvedBoundsRight - resolvedBoundsLeft) / 2;
  const showRightOfPointer = anchorX <= chartMidX;
  const preferredX = showRightOfPointer
    ? anchorX + pointerGap
    : anchorX - tooltipWidth - pointerGap;
  const preferredY = anchorY - tooltipHeight / 2 + verticalOffset;
  const maxX = Math.max(resolvedBoundsLeft, resolvedBoundsRight - tooltipWidth - boundsPadding);
  const maxY = Math.max(resolvedBoundsTop, resolvedBoundsBottom - tooltipHeight - boundsPadding);

  // Prefer placing the tooltip to the side of the pointer, then clamp it back
  // into the chart box so long tooltips still stay fully readable.
  return {
    visible: true,
    x: Math.min(maxX, Math.max(resolvedBoundsLeft, preferredX)),
    y: Math.min(maxY, Math.max(resolvedBoundsTop, preferredY)),
  };
}
