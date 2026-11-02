export const CHART_LABEL_FONT_FAMILY =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export function getChartLabelScale(chart) {
  const width = Number(chart?.width) || 0;
  if (width > 0 && width < 420) return 0.82;
  if (width > 0 && width < 640) return 0.9;
  return 1;
}

export function drawFontAwesomeIcon(ctx, { iconDef, x, y, size, color }) {
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

export function drawRoundedRect(ctx, { x, y, width, height, radius }) {
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
