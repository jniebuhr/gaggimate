/* global globalThis */

/**
 * helpers.js
 *
 * Collects low-level ShotChart helpers that are intentionally reused across
 * chart setup, replay preparation, tooltip layout, and export.
 */

import {
  CHART_COLOR_FALLBACKS,
  CHART_COLOR_TOKEN_MAP,
  EXTERNAL_TOOLTIP_BOUNDS_PADDING,
  EXTERNAL_TOOLTIP_POINTER_GAP,
  EXTERNAL_TOOLTIP_VERTICAL_OFFSET,
  LEGEND_BLOCK_LABELS,
  LEGEND_DASHED_LABELS,
  LEGEND_ORDER,
  LEGEND_THIN_LINE_LABELS,
  STANDARD_LINE_WIDTH,
  THIN_LINE_WIDTH,
  VISIBILITY_KEY_BY_LABEL,
  WATER_DRAWN_PHASE_LABEL,
  WATER_DRAWN_TOTAL_LABEL,
} from './constants';

const NEUTRAL_AXIS_TICK_FALLBACK = '#1f2937';
const AXIS_UNIT_TOP_PADDING = 24;
const AXIS_UNIT_RIGHT_PADDING = 22;
const AXIS_UNIT_X_GAP = 16;
const INSIDE_AXIS_LABEL_BACKGROUND = 'color-mix(in srgb, var(--color-base-100) 86%, transparent)';
const PHASE_LABEL_TOP_INSET = 4;
const PHASE_NUMBER_TOP_OFFSET = 12;
const PHASE_LABEL_FONT =
  '11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const PHASE_BACKGROUND_FILL_FALLBACK = 'rgba(107, 114, 128, 0.085)';
const CHART_LABEL_FONT_FAMILY =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
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

function getChartLabelScale(chart) {
  const width = Number(chart?.width) || 0;
  if (width > 0 && width < 420) return 0.82;
  if (width > 0 && width < 640) return 0.9;
  return 1;
}

export function getNeutralAxisTickColor() {
  return readCssColorVar('--color-base-content', NEUTRAL_AXIS_TICK_FALLBACK);
}

export function getAxisUnitReservedPadding(pluginOptions = {}) {
  const yLabels = Array.isArray(pluginOptions.yLabels) ? pluginOptions.yLabels : [];
  const reserveXLabelSpace = pluginOptions.reserveXLabelSpace !== false;
  return {
    top: yLabels.length > 0 ? AXIS_UNIT_TOP_PADDING : 0,
    right: pluginOptions.xLabel && reserveXLabelSpace ? AXIS_UNIT_RIGHT_PADDING : 0,
    bottom: 0,
    left: 0,
  };
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

function drawFontAwesomeIcon(ctx, { iconDef, x, y, size, color }) {
  const icon = iconDef?.icon;
  const pathData = icon?.[4];
  if (!pathData) return;

  const width = Number(icon?.[0]) || 512;
  const height = Number(icon?.[1]) || 512;
  const scale = size / Math.max(width, height);

  ctx.save();
  ctx.fillStyle = color;
  ctx.translate(x - (width * scale) / 2, y - (height * scale) / 2);
  ctx.scale(scale, scale);
  ctx.fill(new Path2D(pathData));
  ctx.restore();
}

function splitLeadingBrewIcon(text) {
  const match = /^([⏱⚖])\s+(.+)$/.exec(String(text || ''));
  if (!match) return null;
  return { icon: match[1], label: match[2] };
}

function isBrewIconOnly(text) {
  return /^[⏱⚖]$/.test(String(text || ''));
}

function getAxisLabelBackgroundAnchor({ x, y, width, height, align, baseline }) {
  let left = x;
  if (align === 'right') left = x - width;
  else if (align === 'center') left = x - width / 2;
  const top = baseline === 'middle' ? y - height / 2 : y - 2;
  return { left, top };
}

function getAlignedStartX({ x, width, align }) {
  if (align === 'right') return x - width;
  if (align === 'center') return x - width / 2;
  return x;
}

function drawAxisUnitBackground(ctx, { x, y, width, height, align, baseline }) {
  const { left, top } = getAxisLabelBackgroundAnchor({ x, y, width, height, align, baseline });
  ctx.save();
  ctx.globalAlpha = 0.82;
  ctx.fillStyle = readCssColorVar('--color-base-100', INSIDE_AXIS_LABEL_BACKGROUND);
  ctx.beginPath();
  drawRoundedRect(ctx, {
    x: left,
    y: top,
    width,
    height,
    radius: 999,
  });
  ctx.fill();
  ctx.restore();
}

function drawIconAxisUnitLabel(
  ctx,
  { x, y, text, align, baseline, fontSize, textFont, background, iconDef },
) {
  const iconSize = fontSize + 5;
  const labelText = String(text || '');
  ctx.font = textFont;
  const labelWidth = labelText ? ctx.measureText(labelText).width : 0;
  const iconGap = labelText ? 4 : 0;
  const totalWidth = iconSize + iconGap + labelWidth;
  const startX = getAlignedStartX({ x, width: totalWidth, align });

  if (background) {
    drawAxisUnitBackground(ctx, {
      x,
      y,
      width: totalWidth + 10,
      height: Math.max(fontSize, iconSize) + 6,
      align,
      baseline,
    });
  }

  drawFontAwesomeIcon(ctx, {
    iconDef,
    x: startX + iconSize / 2,
    y: baseline === 'middle' ? y : y + iconSize / 2 - 1,
    size: iconSize,
    color: getNeutralAxisTickColor(),
  });

  if (!labelText) return;
  ctx.font = textFont;
  ctx.textAlign = 'left';
  ctx.fillText(labelText, startX + iconSize + iconGap, y);
}

function drawBrewAxisUnitLabel(
  ctx,
  { x, y, brewLabel, align, baseline, fontSize, textFont, background },
) {
  const iconGap = 4;
  const iconFontSize = fontSize + 4;
  const iconFont = `600 ${iconFontSize}px ${CHART_LABEL_FONT_FAMILY}`;

  ctx.font = textFont;
  const labelWidth = ctx.measureText(brewLabel.label).width;
  ctx.font = iconFont;
  const iconWidth = ctx.measureText(brewLabel.icon).width;
  const totalWidth = iconWidth + iconGap + labelWidth;
  const startX = getAlignedStartX({ x, width: totalWidth, align });
  const iconBaselineOffset = (fontSize - iconFontSize) / 2 - 1;

  if (background) {
    drawAxisUnitBackground(ctx, {
      x,
      y,
      width: totalWidth + 10,
      height: Math.max(fontSize, iconFontSize) + 6,
      align,
      baseline,
    });
  }

  ctx.textAlign = 'left';
  ctx.font = iconFont;
  ctx.fillText(brewLabel.icon, startX, y + iconBaselineOffset);
  ctx.font = textFont;
  ctx.fillText(brewLabel.label, startX + iconWidth + iconGap, y);
}

function getAxisUnitSideX({ side, chart, scale }) {
  if (side === 'center') return (chart.chartArea.left + chart.chartArea.right) / 2;
  if (side === 'right')
    return Math.min(chart.width - 2, (scale.right ?? chart.chartArea.right) - 2);
  return Math.max(2, (scale.left ?? chart.chartArea.left) + 2);
}

function getAxisUnitSideAlign(side) {
  if (side === 'center') return 'center';
  if (side === 'right') return 'right';
  return 'left';
}

function getChartLabelPosition({ chart, position, xOffset, yOffset }) {
  const rightAligned = position === 'bottom-right' || position === 'top-right';
  const x = rightAligned
    ? Math.min(chart.width - 2, chart.chartArea.right - 2 + xOffset)
    : chart.chartArea.left + 2 + xOffset;

  if (position === 'bottom-right') {
    return {
      x,
      y: Math.max(chart.chartArea.top + 2, chart.chartArea.bottom - 18 + yOffset),
      align: 'right',
    };
  }

  if (position === 'top-right') {
    return {
      x,
      y: chart.chartArea.top + 10 + yOffset,
      align: 'right',
    };
  }

  return {
    x,
    y: chart.chartArea.top + 2 + yOffset,
    align: 'left',
  };
}

function getLegendItemStyle(label) {
  if (LEGEND_BLOCK_LABELS.has(label)) return 'block';
  if (LEGEND_DASHED_LABELS.has(label)) return 'dashed';
  return 'line';
}

function drawAxisUnitLabel(
  ctx,
  {
    x,
    y,
    text,
    align = 'left',
    baseline = 'top',
    fontSize = 10,
    background = false,
    iconDef = null,
  },
) {
  if (!text && !iconDef) return;

  ctx.save();
  const isStandaloneBrewIcon = isBrewIconOnly(text);
  ctx.globalAlpha = isStandaloneBrewIcon ? 1 : 0.58;
  ctx.fillStyle = getNeutralAxisTickColor();
  const resolvedFontSize = isStandaloneBrewIcon ? fontSize + 5 : fontSize;
  const textFont = `600 ${resolvedFontSize}px ${CHART_LABEL_FONT_FAMILY}`;
  const brewLabel = splitLeadingBrewIcon(text);
  ctx.textAlign = align;
  ctx.textBaseline = baseline;

  if (iconDef) {
    drawIconAxisUnitLabel(ctx, {
      iconDef,
      x,
      y,
      text,
      align,
      baseline,
      fontSize,
      textFont,
      background,
    });
    ctx.restore();
    return;
  }

  if (brewLabel) {
    drawBrewAxisUnitLabel(ctx, {
      x,
      y,
      brewLabel,
      align,
      baseline,
      fontSize,
      textFont,
      background,
    });
    ctx.restore();
    return;
  }

  ctx.font = textFont;
  if (background) {
    const textWidth = ctx.measureText(String(text)).width;
    drawAxisUnitBackground(ctx, {
      x,
      y,
      width: textWidth + 10,
      height: resolvedFontSize + 6,
      align,
      baseline,
    });
  }
  ctx.fillText(text, x, y);
  ctx.restore();
}

export const axisUnitLabelPlugin = {
  id: 'axisUnitLabels',
  afterDraw(chart, _args, pluginOptions = {}) {
    if (!chart?.chartArea || !chart?.scales) return;

    const { top } = chart.chartArea;
    const yLabels = Array.isArray(pluginOptions.yLabels) ? pluginOptions.yLabels : [];
    const chartLabels = Array.isArray(pluginOptions.chartLabels) ? pluginOptions.chartLabels : [];
    const labelScale = getChartLabelScale(chart);

    yLabels.forEach(({ scaleId, label, side = 'left', fontSize = 10, yOffset }, index) => {
      const scale = chart.scales[scaleId];
      if (!scale || scale.display === false) return;

      const y = Math.max(2, top - 22) + (yOffset == null ? index * 14 : yOffset);
      drawAxisUnitLabel(chart.ctx, {
        x: getAxisUnitSideX({ side, chart, scale }),
        y,
        text: label,
        align: getAxisUnitSideAlign(side),
        fontSize: fontSize * labelScale,
      });
    });

    const xScale = chart.scales[pluginOptions.xScaleId || 'x'];
    if (xScale && pluginOptions.xLabel) {
      const placeInside = pluginOptions.xLabelPlacement === 'inside';
      const yOffset = Number(pluginOptions.xLabelYOffset) || 0;
      drawAxisUnitLabel(chart.ctx, {
        x: placeInside
          ? Math.min(chart.width - 8, xScale.right + AXIS_UNIT_X_GAP)
          : Math.min(chart.width - 2, xScale.right + AXIS_UNIT_X_GAP),
        y: Math.max(xScale.top + 2, xScale.bottom - 12 + yOffset),
        text: pluginOptions.xLabel,
        align: 'left',
        fontSize: 10 * labelScale,
      });
    }

    chartLabels.forEach(
      ({ label, iconDef, position = 'bottom-right', fontSize = 10, xOffset = 0, yOffset = 0 }) => {
        if (!label && !iconDef) return;

        const { x, y, align } = getChartLabelPosition({ chart, position, xOffset, yOffset });

        drawAxisUnitLabel(chart.ctx, {
          x,
          y,
          text: label,
          iconDef,
          align,
          fontSize: fontSize * labelScale,
          background: true,
        });
      },
    );
  },
};

function drawRoundedRect(ctx, { x, y, width, height, radius }) {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, radius);
    return;
  }

  const right = x + width;
  const bottom = y + height;
  ctx.moveTo(x + radius, y);
  ctx.lineTo(right - radius, y);
  ctx.quadraticCurveTo(right, y, right, y + radius);
  ctx.lineTo(right, bottom - radius);
  ctx.quadraticCurveTo(right, bottom, right - radius, bottom);
  ctx.lineTo(x + radius, bottom);
  ctx.quadraticCurveTo(x, bottom, x, bottom - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
}

export const phaseLabelOverlayPlugin = {
  id: 'phaseLabelOverlay',
  afterDraw(chart, _args, pluginOptions = {}) {
    if (!chart?.chartArea || !chart?.scales?.x) return;

    const labels = Array.isArray(pluginOptions.labels) ? pluginOptions.labels : [];
    if (labels.length === 0) return;

    const ctx = chart.ctx;
    const top = chart.chartArea.top + PHASE_LABEL_TOP_INSET;
    const labelScale = getChartLabelScale(chart);

    ctx.save();
    ctx.font = PHASE_LABEL_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    labels.forEach(labelMeta => {
      if (!labelMeta?.display) return;

      const text = String(labelMeta.label || '');
      if (!text) return;

      const x = chart.scales.x.getPixelForValue(labelMeta.xValue);
      if (!Number.isFinite(x)) return;

      const isPhaseNumber = Boolean(labelMeta.usePhaseNumbers);
      ctx.font = isPhaseNumber
        ? `700 ${10 * labelScale}px ${CHART_LABEL_FONT_FAMILY}`
        : `${11 * labelScale}px ${CHART_LABEL_FONT_FAMILY}`;
      const textWidth = ctx.measureText(text).width;
      const boxWidth = textWidth + 8 * labelScale;
      const boxHeight = 19 * labelScale;
      const badgeWidth = Math.max(21 * labelScale, textWidth + 13 * labelScale);
      const badgeHeight = 17 * labelScale;
      const centerY = isPhaseNumber
        ? chart.chartArea.top + PHASE_NUMBER_TOP_OFFSET
        : top + boxWidth / 2;

      ctx.save();
      ctx.translate(x, centerY);
      if (!isPhaseNumber) ctx.rotate(-Math.PI / 2);

      if (isPhaseNumber) {
        ctx.save();
        ctx.globalAlpha = 0.82;
        ctx.fillStyle = readCssColorVar('--color-base-100', INSIDE_AXIS_LABEL_BACKGROUND);
        ctx.beginPath();
        drawRoundedRect(ctx, {
          x: -badgeWidth / 2,
          y: -badgeHeight / 2,
          width: badgeWidth,
          height: badgeHeight,
          radius: 999,
        });
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = getNeutralAxisTickColor();
      } else {
        ctx.save();
        ctx.globalAlpha = 0.82;
        ctx.fillStyle = readCssColorVar('--color-base-100', INSIDE_AXIS_LABEL_BACKGROUND);
        ctx.beginPath();
        drawRoundedRect(ctx, {
          x: -boxWidth / 2,
          y: -boxHeight / 2,
          width: boxWidth,
          height: boxHeight,
          radius: 999,
        });
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = getNeutralAxisTickColor();
      }
      ctx.fillText(text, 0, 0);
      ctx.restore();
    });

    ctx.restore();
  },
};

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

export const replayRevealPlugin = {
  id: 'replayReveal',
  beforeDatasetsDraw(chart) {
    if (!chart?.$replayRevealEnabled || !chart.chartArea || !chart.scales?.x) return;
    const cutoffX = Number(chart.$replayRevealX);
    if (!Number.isFinite(cutoffX)) return;

    const cutoffPixelRaw = chart.scales.x.getPixelForValue(cutoffX);
    const cutoffPixel = Math.min(
      chart.chartArea.right,
      Math.max(
        chart.chartArea.left,
        Number.isFinite(cutoffPixelRaw) ? cutoffPixelRaw : chart.chartArea.left,
      ),
    );
    const clipWidth = Math.max(0, cutoffPixel - chart.chartArea.left);

    // Clip only the plotted area so axes, ticks, and annotations can still be
    // controlled independently while the data itself is progressively revealed.
    chart.ctx.save();
    chart.ctx.beginPath();
    chart.ctx.rect(
      chart.chartArea.left,
      chart.chartArea.top,
      clipWidth,
      chart.chartArea.bottom - chart.chartArea.top,
    );
    chart.ctx.clip();
    chart.$replayRevealClipActive = true;
  },
  afterDatasetsDraw(chart) {
    if (!chart?.$replayRevealClipActive) return;
    chart.ctx.restore();
    chart.$replayRevealClipActive = false;
  },
};

export function readCssColorVar(variableName, fallback) {
  const rootElement = globalThis.window?.document?.documentElement;
  if (rootElement) {
    const value = globalThis.window
      .getComputedStyle(rootElement)
      .getPropertyValue(variableName)
      .trim();
    return value || fallback;
  }
  return fallback;
}

export function getShotChartColors() {
  // Resolve all chart colors from CSS variables in one place so the rest of the
  // chart stack can work with concrete values instead of repeatedly touching the DOM.
  return Object.keys(CHART_COLOR_FALLBACKS).reduce((acc, key) => {
    acc[key] = readCssColorVar(CHART_COLOR_TOKEN_MAP[key], CHART_COLOR_FALLBACKS[key]);
    return acc;
  }, {});
}

const SCALE_SPIKE_WINDOW_SEC = 2;
const SCALE_SPIKE_SUPPORT_RATIO = 0.85;
const SCALE_SPIKE_FALLBACK_PERCENTILE = 0.95;
const SCALE_SPIKE_BASELINE_LOOKBACK_SEC = 0.75;

function getMedianValue(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middleIndex = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middleIndex];
  return (sorted[middleIndex - 1] + sorted[middleIndex]) / 2;
}

function getFiniteSeriesPoints(points) {
  return (points || [])
    .map(point => ({
      x: Number(point?.x),
      y: Number(point?.y),
    }))
    .filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
}

export function getPercentileValue(values, percentile) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const clampedPercentile = Math.min(1, Math.max(0, percentile));
  const index = (sorted.length - 1) * clampedPercentile;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  if (lowerIndex === upperIndex) return sorted[lowerIndex];
  const ratio = index - lowerIndex;
  return sorted[lowerIndex] + (sorted[upperIndex] - sorted[lowerIndex]) * ratio;
}

function isTransientScaleSpikePoint({
  rawFinitePoints,
  point,
  index,
  windowSec,
  minTransientRise,
  recoveryTolerance,
}) {
  const baselineValues = rawFinitePoints
    .slice(0, index)
    .filter(candidate => point.x - candidate.x <= SCALE_SPIKE_BASELINE_LOOKBACK_SEC)
    .map(candidate => candidate.y);
  const futureValues = rawFinitePoints
    .slice(index + 1)
    .filter(candidate => candidate.x - point.x <= windowSec)
    .map(candidate => candidate.y);

  if (baselineValues.length === 0 || futureValues.length === 0) return false;

  const baseline = getMedianValue(baselineValues);
  if (!Number.isFinite(baseline)) return false;

  const rise = point.y - baseline;
  if (rise < minTransientRise) return false;

  // Ignore brief touch-induced scale spikes that rise sharply and then fall
  // back near the local baseline within the look-ahead window.
  const futureMin = Math.min(...futureValues);
  return futureMin <= baseline + recoveryTolerance;
}

function getSpikeResistantSeriesPeak(
  points,
  {
    windowSec = SCALE_SPIKE_WINDOW_SEC,
    supportRatio = SCALE_SPIKE_SUPPORT_RATIO,
    fallbackPercentile = SCALE_SPIKE_FALLBACK_PERCENTILE,
    seriesKind = 'weight',
  } = {},
) {
  const rawFinitePoints = getFiniteSeriesPoints(points);
  if (rawFinitePoints.length === 0) return null;

  const seriesValues = rawFinitePoints.map(point => point.y);
  const seriesMin = Math.min(...seriesValues);
  const seriesMax = Math.max(...seriesValues);
  const seriesRange = Math.max(0, seriesMax - seriesMin);
  const minTransientRise =
    seriesKind === 'weightFlow'
      ? Math.max(0.6, seriesRange * 0.18)
      : Math.max(1.25, seriesRange * 0.12);
  const recoveryTolerance =
    seriesKind === 'weightFlow'
      ? Math.max(0.2, seriesRange * 0.05)
      : Math.max(0.35, seriesRange * 0.04);

  const finitePoints = rawFinitePoints.filter((point, index) => {
    return !isTransientScaleSpikePoint({
      rawFinitePoints,
      point,
      index,
      windowSec,
      minTransientRise,
      recoveryTolerance,
    });
  });

  if (finitePoints.length === 0) return null;

  const rawMaxPoint = finitePoints.reduce((maxPoint, point) => {
    if (!maxPoint || point.y > maxPoint.y) return point;
    return maxPoint;
  }, null);
  const totalDuration = Math.max(0, finitePoints[finitePoints.length - 1].x - finitePoints[0].x);
  if (totalDuration <= windowSec) {
    return rawMaxPoint;
  }

  let sustainedPeak = null;
  for (let i = 0; i < finitePoints.length; i += 1) {
    const candidate = finitePoints[i];
    if (!Number.isFinite(candidate.y) || candidate.y <= 0) continue;
    const { startX, endX } = getSupportedSeriesWindow({
      finitePoints,
      index: i,
      supportRatio,
    });

    // A candidate max is only accepted when it stays near that level long
    // enough; otherwise we fall back to a percentile-based ceiling.
    if (endX - startX > windowSec) {
      sustainedPeak = !sustainedPeak || candidate.y > sustainedPeak.y ? candidate : sustainedPeak;
    }
  }

  if (sustainedPeak) return sustainedPeak;

  const percentileMax = getPercentileValue(
    finitePoints.map(point => point.y),
    fallbackPercentile,
  );
  if (!Number.isFinite(percentileMax)) return rawMaxPoint;

  const percentilePeak = finitePoints.reduce((bestPoint, point) => {
    if (point.y > percentileMax) return bestPoint;
    if (!bestPoint || point.y > bestPoint.y) return point;
    return bestPoint;
  }, null);

  return percentilePeak || rawMaxPoint;
}

export function getSpikeResistantSeriesMax(points, options = {}) {
  const { fallback = 1, ...peakOptions } = options;
  const peak = getSpikeResistantSeriesPeak(points, peakOptions);
  return Math.max(fallback, Number.isFinite(peak?.y) ? peak.y : fallback);
}

function getSupportedSeriesWindow({ finitePoints, index, supportRatio }) {
  const candidate = finitePoints[index];
  const threshold = candidate.y * supportRatio;
  let startX = candidate.x;
  let endX = candidate.x;

  for (let left = index - 1; left >= 0; left -= 1) {
    if (finitePoints[left].y < threshold) break;
    startX = finitePoints[left].x;
  }

  for (let right = index + 1; right < finitePoints.length; right += 1) {
    if (finitePoints[right].y < threshold) break;
    endX = finitePoints[right].x;
  }

  return { startX, endX };
}

export function getLegendColorByLabel(colors) {
  return {
    Phases: colors.phaseLine,
    Stops: colors.stopLabel,
    Temp: colors.temp,
    'Target T': colors.tempTarget,
    Pressure: colors.pressure,
    'Target P': colors.pressure,
    'Pump Flow': colors.flow,
    'Target F': colors.flow,
    'Puck Flow': colors.puckFlow,
    Weight: colors.weight,
    'Weight Flow': colors.weightFlow,
  };
}

export function getTooltipColorByLabel(colors) {
  return {
    ...getLegendColorByLabel(colors),
    [WATER_DRAWN_PHASE_LABEL]: 'color-mix(in srgb, var(--statistics-summary-water) 84%, black)',
    [WATER_DRAWN_TOTAL_LABEL]: 'var(--statistics-summary-water)',
  };
}

export function getVisibleLegendItemsForExport({
  legendColorByLabel,
  visibility,
  hasWeightData,
  hasWeightFlowData,
}) {
  // Exported legends should reflect the same visibility rules as the live chart,
  // including data-dependent series such as weight and weight flow.
  return LEGEND_ORDER.reduce((items, label) => {
    if (label === 'Weight' && !hasWeightData) return items;
    if (label === 'Weight Flow' && !hasWeightFlowData) return items;

    const key = VISIBILITY_KEY_BY_LABEL[label];
    if (key && !visibility[key]) return items;

    items.push({
      label,
      color: legendColorByLabel[label] || '#94a3b8',
      style: getLegendItemStyle(label),
      lineWidth: LEGEND_THIN_LINE_LABELS.has(label) ? THIN_LINE_WIDTH : STANDARD_LINE_WIDTH,
    });
    return items;
  }, []);
}

function stripExportFileExtension(value) {
  return String(value || '')
    .trim()
    .replace(/\.[^./\\]{1,8}$/, '');
}

function sanitizeExportFilenameSegment(value) {
  return stripExportFileExtension(value)
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function resolveShotExportStem(shotData, fallbackStem) {
  const profileValue =
    typeof shotData?.profile === 'string'
      ? shotData.profile
      : shotData?.profile?.label || shotData?.profile?.name || '';
  // Prefer the storage/name fields first so exported files stay stable even when
  // display labels contain punctuation or are not unique.
  return (
    sanitizeExportFilenameSegment(
      shotData?.name || shotData?.storageKey || shotData?.id || profileValue || fallbackStem,
    ) || fallbackStem
  );
}

export function buildReplayExportFilename(shotData, includeLegend, exportFormat = 'mp4') {
  const stem = resolveShotExportStem(shotData, 'shot-analyzer-replay');
  const extension = exportFormat === 'webm' ? 'webm' : 'mp4';
  return `${stem}${includeLegend ? '-with-legend' : ''}-replay.${extension}`;
}

export function buildReplayImageFilename(shotData, includeLegend) {
  const stem = resolveShotExportStem(shotData, 'shot-analyzer-chart');
  return `${stem}${includeLegend ? '-with-legend' : ''}.png`;
}

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

export function getPhaseName(shot, phaseNumber) {
  if (shot.phaseTransitions?.length > 0) {
    const transition = shot.phaseTransitions.find(t => t.phaseNumber === phaseNumber);
    if (transition?.phaseName) {
      return transition.phaseName;
    }
  }

  if (shot.profile?.phases?.[phaseNumber]) {
    return shot.profile.phases[phaseNumber].name;
  }

  return phaseNumber === 0 ? 'Start' : `P${phaseNumber + 1}`;
}

export function toNumberOrNull(value) {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatAxisTick(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  const rounded = Math.round(numeric);
  const absolute = Math.abs(rounded).toString().padStart(2, '0');
  return rounded < 0 ? `-${absolute}` : absolute;
}

export function formatUniqueAxisTick(value, index, ticks) {
  if (Array.isArray(ticks) && index === ticks.length - 1) return '';

  const formatted = formatAxisTick(value);
  if (!Array.isArray(ticks) || !Number.isInteger(index) || index <= 0) return formatted;

  const previousValue = ticks[index - 1]?.value;
  return formatAxisTick(previousValue) === formatted ? '' : formatted;
}

export function formatResponsiveXAxisTick(value, index, ticks) {
  const formatted = formatAxisTick(value);
  const tickCount = Array.isArray(ticks) ? ticks.length : 0;
  if (tickCount <= 0) return formatted;

  const scaleWidth = Number(this?.width) || Number(this?.chart?.width) || 0;
  let maxVisibleTicks = 8;
  if (scaleWidth < 300) maxVisibleTicks = 4;
  else if (scaleWidth < 460) maxVisibleTicks = 5;
  if (tickCount <= maxVisibleTicks) return formatted;

  const lastIndex = tickCount - 1;
  if (index === 0 || index === lastIndex) return formatted;

  const interval = Math.ceil(lastIndex / Math.max(1, maxVisibleTicks - 1));
  return index % interval === 0 ? formatted : '';
}

export function createStripedFillPattern(canvasCtx, color, options = {}) {
  if (!canvasCtx || globalThis.window === undefined) return color;

  const size = options.size ?? 8;
  const lineWidth = options.lineWidth ?? 1;
  const baseAlpha = options.baseAlpha ?? 0.02;
  const stripeAlpha = options.stripeAlpha ?? 0.1;

  const patternCanvas = globalThis.window.document.createElement('canvas');
  patternCanvas.width = size;
  patternCanvas.height = size;

  const patternCtx = patternCanvas.getContext('2d');
  if (!patternCtx) return color;

  // Use a tiny offscreen canvas so fills can share one repeatable striped pattern
  // without depending on large gradient objects or per-point drawing.
  patternCtx.clearRect(0, 0, size, size);
  patternCtx.fillStyle = color;
  patternCtx.globalAlpha = baseAlpha;
  patternCtx.fillRect(0, 0, size, size);

  patternCtx.strokeStyle = color;
  patternCtx.globalAlpha = stripeAlpha;
  patternCtx.lineWidth = lineWidth;
  patternCtx.lineCap = 'butt';
  patternCtx.beginPath();
  patternCtx.moveTo(0, size);
  patternCtx.lineTo(size, 0);
  patternCtx.stroke();

  return canvasCtx.createPattern(patternCanvas, 'repeat') || color;
}

export function safeMax(arr, fallback = 0) {
  let max = -Infinity;
  for (const value of arr) {
    if (value > max) max = value;
  }
  return max === -Infinity ? fallback : max;
}

export function safeMin(arr, fallback = 0) {
  let min = Infinity;
  for (const value of arr) {
    if (value < min) min = value;
  }
  return min === Infinity ? fallback : min;
}

export function findLastSampleIndexAtOrBeforeX(sampleTimesSec, xValue) {
  if (!Array.isArray(sampleTimesSec) || sampleTimesSec.length === 0 || !Number.isFinite(xValue)) {
    return -1;
  }
  if (xValue < sampleTimesSec[0]) return -1;

  // Hover, replay, and water lookups all need the latest sample at or before a
  // given x-value, so keep this as a binary search rather than rescanning arrays.
  let low = 0;
  let high = sampleTimesSec.length - 1;
  let best = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const midValue = sampleTimesSec[mid];
    if (!Number.isFinite(midValue)) {
      high = mid - 1;
      continue;
    }
    if (midValue <= xValue) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
}

function clampReplayIndex(value, maxIndex) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(maxIndex, value));
}

function getReplayFrameIndex(xValue, shotStartSec, durationSec, frameCount) {
  if (frameCount <= 0 || durationSec <= 0) return 0;
  // Replay annotations are mapped onto the same normalized frame timeline as the
  // dataset chunks so both appear in lockstep during playback/export.
  const progress = (xValue - shotStartSec) / durationSec;
  return clampReplayIndex(Math.floor(progress * frameCount), frameCount);
}

function pushReplayPoint(points, point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
  const lastPoint = points[points.length - 1];
  if (lastPoint && lastPoint.x === point.x && lastPoint.y === point.y) return;
  points.push(point);
}

function buildReplayBoundaryPoint(lastVisiblePoint, nextPoint, frameTime) {
  if (lastVisiblePoint && nextPoint && nextPoint.x > lastVisiblePoint.x) {
    // Interpolate the frame boundary so replay motion stays visually smooth even
    // when several source samples fall between two replay frames.
    const progress = (frameTime - lastVisiblePoint.x) / (nextPoint.x - lastVisiblePoint.x);
    const clampedProgress = Math.max(0, Math.min(1, progress));
    return {
      x: frameTime,
      y: lastVisiblePoint.y + (nextPoint.y - lastVisiblePoint.y) * clampedProgress,
    };
  }

  if (lastVisiblePoint) {
    return {
      x: frameTime,
      y: lastVisiblePoint.y,
    };
  }

  if (nextPoint) {
    return {
      x: frameTime,
      y: nextPoint.y,
    };
  }

  return null;
}

function buildCarryReplayPoints(intervalPoints, frameBoundaryPoint) {
  const points = [];
  for (const point of intervalPoints) {
    pushReplayPoint(points, point);
  }

  // Most datasets should simply grow forward over time. Appending the boundary
  // point keeps the line continuous between frame buckets.
  pushReplayPoint(points, frameBoundaryPoint);

  return points;
}

function buildExtremaReplayPoints(intervalPoints, frameBoundaryPoint) {
  const points = [];

  if (intervalPoints.length > 0) {
    let minIndex = 0;
    let maxIndex = 0;
    for (let i = 1; i < intervalPoints.length; i++) {
      if (intervalPoints[i].y < intervalPoints[minIndex].y) minIndex = i;
      if (intervalPoints[i].y > intervalPoints[maxIndex].y) maxIndex = i;
    }

    const candidateIndices = [0, minIndex, maxIndex, intervalPoints.length - 1]
      .filter((value, index, values) => values.indexOf(value) === index)
      .sort((a, b) => a - b);

    // Preserve the first, last, and local extrema inside each frame bucket so
    // spiky datasets do not flatten out when replay runs below raw sample rate.
    for (const candidateIndex of candidateIndices) {
      pushReplayPoint(points, intervalPoints[candidateIndex]);
    }
  }

  pushReplayPoint(points, frameBoundaryPoint);

  return points;
}

function getReplayDatasetStrategy(label) {
  switch (label) {
    case 'Pressure':
    case 'Pump Flow':
    case 'Puck Flow':
    case 'Weight Flow':
      return 'extrema';
    default:
      return 'carry';
  }
}

function buildReplayDatasetMeta({
  data,
  label,
  shotStartSec,
  maxTime,
  frameCount,
  frameDurationSec,
}) {
  const fullData = Array.isArray(data)
    ? data.filter(point => point && Number.isFinite(point.x) && Number.isFinite(point.y))
    : [];
  const activeData = [];
  const frameChunks = Array.from({ length: frameCount + 1 }, () => []);

  if (!fullData.length) {
    return { fullData, activeData, frameChunks };
  }

  const durationSec = Math.max(0, maxTime - shotStartSec);
  const strategy = getReplayDatasetStrategy(label);
  let pointCursor = 0;
  let lastVisiblePoint = null;
  let previousFrameTime = shotStartSec;

  // Pre-slice every dataset into replay frame chunks once. Live replay can then
  // append cheap immutable chunks instead of reprocessing the full series per frame.
  for (let frameIndex = 0; frameIndex <= frameCount; frameIndex++) {
    const frameTime = shotStartSec + Math.min(durationSec, frameIndex * frameDurationSec);
    const intervalPoints = [];

    while (pointCursor < fullData.length && fullData[pointCursor].x <= frameTime) {
      const point = fullData[pointCursor];
      if (frameIndex === 0 || point.x > previousFrameTime) {
        intervalPoints.push(point);
      }
      lastVisiblePoint = point;
      pointCursor += 1;
    }

    const nextPoint = pointCursor < fullData.length ? fullData[pointCursor] : null;
    const frameBoundaryPoint = buildReplayBoundaryPoint(lastVisiblePoint, nextPoint, frameTime);

    frameChunks[frameIndex] =
      strategy === 'extrema'
        ? buildExtremaReplayPoints(intervalPoints, frameBoundaryPoint)
        : buildCarryReplayPoints(intervalPoints, frameBoundaryPoint);

    previousFrameTime = frameTime;
  }

  return {
    fullData,
    activeData,
    frameChunks,
  };
}

function buildReplayAnnotationMeta(annotations, shotStartSec, maxTime, frameCount) {
  const durationSec = Math.max(0, maxTime - shotStartSec);
  return Object.entries(annotations || {}).reduce((acc, [key, annotation]) => {
    const time = Number(annotation?.value);
    if (!Number.isFinite(time)) return acc;

    acc.push({
      key,
      time,
      baseDisplay: annotation?.display !== false,
      frameIndex: getReplayFrameIndex(time, shotStartSec, durationSec, frameCount),
    });
    return acc;
  }, []);
}

export function buildShotChartReplayModel({
  mainDatasets,
  tempDatasets,
  mainAnnotations,
  tempAnnotations,
  shotStartSec,
  maxTime,
  frameDurationSec,
}) {
  const durationSec = Math.max(0, maxTime - shotStartSec);
  const frameCount = Math.max(1, Math.ceil(durationSec / Math.max(frameDurationSec, 0.001)));

  // Build one replay runtime description that can be shared by both live replay
  // and export. The caller stays responsible only for applying frames over time.
  return {
    frameCount,
    totalDurationSec: durationSec,
    mainReplayDatasets: (mainDatasets || []).map(dataset =>
      buildReplayDatasetMeta({
        data: dataset?.data,
        label: dataset?.label,
        shotStartSec,
        maxTime,
        frameCount,
        frameDurationSec,
      }),
    ),
    tempReplayDatasets: (tempDatasets || []).map(dataset =>
      buildReplayDatasetMeta({
        data: dataset?.data,
        label: dataset?.label,
        shotStartSec,
        maxTime,
        frameCount,
        frameDurationSec,
      }),
    ),
    mainAnnotationMeta: buildReplayAnnotationMeta(
      mainAnnotations,
      shotStartSec,
      maxTime,
      frameCount,
    ),
    tempAnnotationMeta: buildReplayAnnotationMeta(
      tempAnnotations,
      shotStartSec,
      maxTime,
      frameCount,
    ),
  };
}
