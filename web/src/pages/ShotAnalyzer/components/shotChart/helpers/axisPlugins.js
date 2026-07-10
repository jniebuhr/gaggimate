import {
  CHART_LABEL_FONT_FAMILY,
  drawFontAwesomeIcon,
  drawRoundedRect,
  getChartLabelScale,
} from './canvasDrawing';
import { readCssColorVar } from './chartTheme';

const NEUTRAL_AXIS_TICK_FALLBACK = '#1f2937';

const AXIS_UNIT_TOP_PADDING = 24;

const AXIS_UNIT_RIGHT_PADDING = 22;

const AXIS_UNIT_X_GAP = 16;

const INSIDE_AXIS_LABEL_BACKGROUND = 'color-mix(in srgb, var(--color-base-100) 86%, transparent)';

const PHASE_LABEL_TOP_INSET = 4;

const PHASE_NUMBER_TOP_OFFSET = 12;

const PHASE_LABEL_FONT =
  '11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const BREW_LABEL_ICONS = ['⏱', '⚖'];

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

function splitLeadingBrewIcon(text) {
  const value = String(text || '');
  const icon = BREW_LABEL_ICONS.find(candidate => value.startsWith(candidate));
  if (!icon) return null;

  const remainder = value.slice(icon.length);
  const label = remainder.trimStart();
  if (!label || label === remainder) return null;

  return { icon, label };
}

function isBrewIconOnly(text) {
  return BREW_LABEL_ICONS.includes(String(text || ''));
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
