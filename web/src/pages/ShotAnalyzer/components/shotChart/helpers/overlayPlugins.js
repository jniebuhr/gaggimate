import { getNeutralAxisTickColor } from './axisPlugins';
import {
  CHART_LABEL_FONT_FAMILY,
  drawFontAwesomeIcon,
  drawRoundedRect,
  getChartLabelScale,
} from './canvasDrawing';
import { readCssColorVar } from './chartTheme';

const PHASE_BACKGROUND_FILL_FALLBACK = 'rgba(107, 114, 128, 0.085)';

const STOP_ICON_BADGE_RADIUS = 8.5;

const STOP_ICON_BADGE_DROP_WIDTH_RATIO = 2.26;

const STOP_ICON_BADGE_DROP_HEIGHT_RATIO = 3.24;

const STOP_ICON_BADGE_ICON_Y_OFFSET_RATIO = -0.14;

const STOP_ICON_SIZE = 12;

const GLASS_SURFACE_SHADOW_FALLBACK = {
  offsetX: 0,
  offsetY: 14,
  blur: 36,
  color: 'rgba(15, 23, 42, 0.16)',
};

const CSS_LENGTH_PATTERN = /^(-?\d+(?:\.\d+)?)(?:px)?$/;

function parseShadowLengthToken(token) {
  const match = CSS_LENGTH_PATTERN.exec(String(token || ''));
  return match ? Number(match[1]) : null;
}

export const hoverGuidePlugin = {
  id: 'hoverGuide',
  afterDatasetsDraw(chart, _args, pluginOptions) {
    if (chart?.$suppressHoverGuide) return;

    const active = chart.getActiveElements?.() || chart.tooltip?.getActiveElements?.() || [];
    const x = Number.isFinite(chart?.$fixedTooltipPointerX)
      ? chart.$fixedTooltipPointerX
      : active[0]?.element?.x;
    if (!Number.isFinite(x)) return;

    const overflow = Number(pluginOptions?.overflow) || 6;
    const { top, bottom } = chart.chartArea;
    const ctx = chart.ctx;
    ctx.save();
    // Draw the guide after datasets so it stays visible above fills and lines
    // without needing a dedicated overlay canvas.
    ctx.beginPath();
    ctx.strokeStyle = pluginOptions?.color || getNeutralAxisTickColor();
    ctx.lineWidth = pluginOptions?.lineWidth || 2.5;
    ctx.setLineDash(pluginOptions?.dash || []);
    ctx.moveTo(x, Math.max(0, top - overflow));
    ctx.lineTo(x, Math.min(chart.height, bottom + overflow));
    ctx.stroke();
    ctx.restore();
  },
};

function resolveFinalWeightCalloutAnchor(chart, callout) {
  const xScale = chart.scales[callout.xScaleID || 'x'];
  const yScale = chart.scales[callout.yScaleID || 'yWeight'];
  if (!xScale || !yScale) return null;

  const xValue = Number(callout.xValue);
  const yValue = Number(callout.yValue);
  if (!Number.isFinite(xValue) || !Number.isFinite(yValue)) return null;

  const startX = xScale.getPixelForValue(xValue);
  const startY = yScale.getPixelForValue(yValue);
  if (!Number.isFinite(startX) || !Number.isFinite(startY)) return null;

  return { startX, startY };
}

function resolveFinalWeightCalloutEnd(callout, anchor) {
  const xAdjust = Number(callout.xAdjust) || 0;
  const yAdjust = Number(callout.yAdjust) || 0;
  const length = Math.hypot(xAdjust, yAdjust);
  if (!Number.isFinite(length) || length <= 0) return null;

  const edgeInset = Number(callout.edgeInset) || 12;
  return {
    endX: anchor.startX + xAdjust - (xAdjust / length) * edgeInset,
    endY: anchor.startY + yAdjust - (yAdjust / length) * edgeInset,
  };
}

function resolveFinalWeightCalloutLine(chart, callout) {
  if (!callout?.visible) return null;
  const anchor = resolveFinalWeightCalloutAnchor(chart, callout);
  if (!anchor) return null;
  const end = resolveFinalWeightCalloutEnd(callout, anchor);
  if (!end) return null;

  return {
    ...anchor,
    ...end,
    color: callout.color || '#8b5cf6',
    lineWidth: Number(callout.lineWidth) || 2.5,
  };
}

function drawFinalWeightCalloutLine(ctx, line) {
  ctx.beginPath();
  ctx.strokeStyle = line.color;
  ctx.lineWidth = line.lineWidth;
  ctx.lineCap = 'round';
  ctx.moveTo(line.startX, line.startY);
  ctx.lineTo(line.endX, line.endY);
  ctx.stroke();
}

export const finalWeightCalloutLinePlugin = {
  id: 'finalWeightCalloutLine',
  afterDatasetsDraw(chart, _args, pluginOptions = {}) {
    if (!chart?.chartArea || !chart?.scales) return;

    const callouts = Array.isArray(pluginOptions.callouts) ? pluginOptions.callouts : [];
    if (callouts.length === 0) return;

    chart.ctx.save();
    for (const callout of callouts) {
      const line = resolveFinalWeightCalloutLine(chart, callout);
      if (line) drawFinalWeightCalloutLine(chart.ctx, line);
    }
    chart.ctx.restore();
  },
};

export const phaseBackgroundOverlayPlugin = {
  id: 'phaseBackgroundOverlay',
  beforeDatasetsDraw(chart, _args, pluginOptions = {}) {
    if (!chart?.chartArea || !chart?.scales) return;

    const ranges = Array.isArray(pluginOptions.ranges) ? pluginOptions.ranges : [];
    if (ranges.length === 0) return;

    const xScale = chart.scales[pluginOptions.xScaleID || 'x'];
    if (!xScale) return;

    const { left, right, top, bottom } = chart.chartArea;
    const ctx = chart.ctx;
    const defaultFillStyle =
      pluginOptions.color ||
      readCssColorVar('--analyzer-phase-background', PHASE_BACKGROUND_FILL_FALLBACK);

    ctx.save();
    ranges.forEach(range => {
      if (!range?.visible || !range?.shaded) return;

      const startX = xScale.getPixelForValue(Number(range.startX));
      const endX = xScale.getPixelForValue(Number(range.endX));
      if (!Number.isFinite(startX) || !Number.isFinite(endX)) return;

      const x = Math.max(left, Math.min(startX, endX));
      const width = Math.min(right, Math.max(startX, endX)) - x;
      if (width <= 0) return;

      ctx.fillStyle = range.color || defaultFillStyle;
      ctx.fillRect(x, top, width, bottom - top);
    });
    ctx.restore();
  },
};

function shouldDrawStopIcon(stop, shouldFilterByReplayTime, stopRevealX) {
  if (!stop?.visible || !stop?.iconDef) return false;
  return !shouldFilterByReplayTime || Number(stop.xValue) <= stopRevealX;
}

function resolveStopIconLayout(chart, stop, labelScale) {
  const xScale = chart.scales[stop.xScaleID || 'x'];
  const yScale = chart.scales[stop.yScaleID || 'yMain'];
  if (!xScale || !yScale) return null;

  const centerX = xScale.getPixelForValue(Number(stop.xValue));
  const yPixel = yScale.getPixelForValue(Number(stop.yValue));
  if (!Number.isFinite(centerX) || !Number.isFinite(yPixel)) return null;

  const radius = (Number(stop.badgeRadius) || STOP_ICON_BADGE_RADIUS) * labelScale;
  const badgeHeight = radius * STOP_ICON_BADGE_DROP_HEIGHT_RATIO;
  return {
    badgeHeight,
    badgeWidth: radius * STOP_ICON_BADGE_DROP_WIDTH_RATIO,
    centerX,
    centerY: yPixel - badgeHeight / 2,
    labelScale,
  };
}

function getStopIconShadowOffset(value, fallback) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function drawStopIcon(ctx, stop, layout, shadow) {
  const { badgeHeight, badgeWidth, centerX, centerY, labelScale } = layout;
  ctx.save();
  ctx.shadowColor = stop.shadowColor || shadow.color;
  ctx.shadowBlur = Number(stop.shadowBlur) || shadow.blur;
  ctx.shadowOffsetX = getStopIconShadowOffset(stop.shadowOffsetX, shadow.offsetX);
  ctx.shadowOffsetY = getStopIconShadowOffset(stop.shadowOffsetY, shadow.offsetY);
  ctx.fillStyle = stop.backgroundColor || '#dc2626';
  ctx.beginPath();
  drawStopBadgeDropPath(ctx, {
    centerX,
    centerY,
    width: badgeWidth,
    height: badgeHeight,
  });
  ctx.fill();
  ctx.restore();

  drawFontAwesomeIcon(ctx, {
    iconDef: stop.iconDef,
    x: centerX,
    y: centerY + badgeHeight * STOP_ICON_BADGE_ICON_Y_OFFSET_RATIO,
    size: (Number(stop.iconSize) || STOP_ICON_SIZE) * labelScale,
    color: stop.color || '#dc2626',
  });
}

export const stopIconOverlayPlugin = {
  id: 'stopIconOverlay',
  afterDraw(chart, _args, pluginOptions = {}) {
    if (!chart?.chartArea || !chart?.scales) return;

    const stops = Array.isArray(pluginOptions.stops) ? pluginOptions.stops : [];
    if (stops.length === 0) return;

    const labelScale = getChartLabelScale(chart);
    const stopRevealX = Number(chart.$replayStopRevealX);
    const shouldFilterByReplayTime =
      chart.$replayStopRevealEnabled === true && Number.isFinite(stopRevealX);
    const shadow = getGlassSurfaceShadowSettings();

    for (const stop of [...stops].reverse()) {
      if (!shouldDrawStopIcon(stop, shouldFilterByReplayTime, stopRevealX)) continue;
      const layout = resolveStopIconLayout(chart, stop, labelScale);
      if (layout) drawStopIcon(chart.ctx, stop, layout, shadow);
    }
  },
};

function getGlassSurfaceShadowSettings() {
  const value = readCssColorVar('--app-glass-surface-shadow', '0 14px 36px rgba(15, 23, 42, 0.16)');
  const [offsetXToken, offsetYToken, blurToken, ...colorTokens] = String(value).trim().split(/\s+/);
  const offsetX = parseShadowLengthToken(offsetXToken);
  const offsetY = parseShadowLengthToken(offsetYToken);
  const blur = parseShadowLengthToken(blurToken);
  const color = colorTokens.join(' ').trim();

  if (offsetX === null || offsetY === null || blur === null || !color) {
    return GLASS_SURFACE_SHADOW_FALLBACK;
  }

  return {
    offsetX,
    offsetY,
    blur,
    color,
  };
}

function drawStopBadgeDropPath(ctx, { centerX, centerY, width, height }) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const topY = centerY - halfHeight;
  const bottomY = centerY + halfHeight;
  const upperSideY = centerY - halfHeight * 0.24;
  const bellyY = centerY + halfHeight * 0.12;
  const lowerTaperY = centerY + halfHeight * 0.42;
  const tipControlY = centerY + halfHeight * 0.82;

  ctx.moveTo(centerX, topY);
  ctx.bezierCurveTo(
    centerX + halfWidth * 0.62,
    topY,
    centerX + halfWidth,
    centerY - halfHeight * 0.78,
    centerX + halfWidth,
    upperSideY,
  );
  ctx.bezierCurveTo(
    centerX + halfWidth,
    centerY + halfHeight * 0.06,
    centerX + halfWidth * 0.88,
    bellyY,
    centerX + halfWidth * 0.66,
    lowerTaperY,
  );
  ctx.bezierCurveTo(
    centerX + halfWidth * 0.42,
    centerY + halfHeight * 0.68,
    centerX + halfWidth * 0.16,
    tipControlY,
    centerX,
    bottomY,
  );
  ctx.bezierCurveTo(
    centerX - halfWidth * 0.16,
    tipControlY,
    centerX - halfWidth * 0.42,
    centerY + halfHeight * 0.68,
    centerX - halfWidth * 0.66,
    lowerTaperY,
  );
  ctx.bezierCurveTo(
    centerX - halfWidth * 0.88,
    bellyY,
    centerX - halfWidth,
    centerY + halfHeight * 0.06,
    centerX - halfWidth,
    upperSideY,
  );
  ctx.bezierCurveTo(
    centerX - halfWidth,
    centerY - halfHeight * 0.78,
    centerX - halfWidth * 0.62,
    topY,
    centerX,
    topY,
  );
  ctx.closePath();
}

function getFinalWeightBadgeText(content) {
  return Array.isArray(content) ? String(content[0] || '') : String(content || '');
}

function getFinalWeightBadgeScale(chart, scaleId, fallbackScaleId) {
  return chart.scales[scaleId || fallbackScaleId] || null;
}

function getFinalWeightBadgeCoordinate(scale, value, adjustment) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;

  const coordinate = scale.getPixelForValue(numericValue) + (Number(adjustment) || 0);
  return Number.isFinite(coordinate) ? coordinate : null;
}

function getFinalWeightBadgeStyle(chart, label) {
  const labelScale = getChartLabelScale(chart);
  const padding =
    typeof label.padding === 'object' && label.padding
      ? label.padding
      : { x: Number(label.padding) || 6, y: Number(label.padding) || 4 };

  return {
    effectiveFontSize: (Number(label.font?.size) || 12) * labelScale,
    fontWeight: label.font?.weight || 'bold',
    labelScale,
    padding,
  };
}

function resolveFinalWeightBadgeLayout(chart, label) {
  if (!label || label.visible === false) return null;

  const xScale = getFinalWeightBadgeScale(chart, label.xScaleID, 'x');
  const yScale = getFinalWeightBadgeScale(chart, label.yScaleID, 'yWeight');
  if (!xScale || !yScale) return null;

  const text = getFinalWeightBadgeText(label.content);
  if (!text) return null;

  const x = getFinalWeightBadgeCoordinate(xScale, label.xValue, label.xAdjust);
  const y = getFinalWeightBadgeCoordinate(yScale, label.yValue, label.yAdjust);
  if (x === null || y === null) return null;

  return {
    ...getFinalWeightBadgeStyle(chart, label),
    text,
    x,
    y,
  };
}

function drawFinalWeightBadge(chart, label) {
  const layout = resolveFinalWeightBadgeLayout(chart, label);
  if (!layout) return;

  const { effectiveFontSize, fontWeight, labelScale, padding, text, x, y } = layout;
  const ctx = chart.ctx;
  ctx.save();
  ctx.font = `${fontWeight} ${effectiveFontSize}px ${CHART_LABEL_FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const textWidth = ctx.measureText(text).width;
  const boxWidth = textWidth + (Number(padding.x) || 0) * 2 * labelScale;
  const boxHeight = effectiveFontSize + (Number(padding.y) || 0) * 2 * labelScale;

  ctx.fillStyle = label.backgroundColor || '#8b5cf6';
  ctx.beginPath();
  drawRoundedRect(ctx, {
    x: x - boxWidth / 2,
    y: y - boxHeight / 2,
    width: boxWidth,
    height: boxHeight,
    radius: label.borderRadius || 999,
  });
  ctx.fill();

  if (label.borderWidth) {
    ctx.lineWidth = label.borderWidth;
    ctx.strokeStyle = label.borderColor || '#ffffff';
    ctx.stroke();
  }

  ctx.fillStyle = label.color || '#ffffff';
  ctx.fillText(text, x, y);
  ctx.restore();
}

export const finalWeightBadgeOverlayPlugin = {
  id: 'finalWeightBadgeOverlay',
  afterDraw(chart, _args, pluginOptions = {}) {
    if (!chart?.chartArea || !chart?.scales) return;

    const labels = Array.isArray(pluginOptions.labels) ? pluginOptions.labels : [];
    for (const label of labels) drawFinalWeightBadge(chart, label);
  },
};
