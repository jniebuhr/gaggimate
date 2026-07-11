import { REPLAY_TARGET_FPS } from '../components/shotChart/constants';

const EXPORT_FPS = REPLAY_TARGET_FPS;
const EXPORT_PADDING = 24;
const EXPORT_SECTION_GAP = 18;
const EXPORT_CARD_PADDING = 12;
const EXPORT_CARD_RADIUS = 18;
const EXPORT_LEGEND_GAP = 10;
const EXPORT_LEGEND_ITEM_GAP = 18;
const EXPORT_LEGEND_ROW_GAP = 12;
const EXPORT_CARD_SHADOW_BLUR = 28;
const EXPORT_OVERLAY_LANDSCAPE = { width: 1920, height: 1080 };
const EXPORT_OVERLAY_PORTRAIT = { width: 1080, height: 1920 };
function isLikelySafariBrowser() {
  if (typeof window === 'undefined' || typeof window.navigator === 'undefined') return false;
  const userAgent = window.navigator.userAgent || '';
  const vendor = window.navigator.vendor || '';
  return (
    /Safari/i.test(userAgent) &&
    /Apple/i.test(vendor) &&
    !/Chrome|Chromium|CriOS|Firefox|FxiOS|Edg|EdgiOS|Android/i.test(userAgent)
  );
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw new DOMException('Replay export aborted.', 'AbortError');
  }
}

function getNowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    throwIfAborted(signal);
    const handleAbort = () => {
      window.clearTimeout(timerId);
      reject(new DOMException('Replay export aborted.', 'AbortError'));
    };
    const timerId = window.setTimeout(
      () => {
        signal?.removeEventListener('abort', handleAbort);
        resolve();
      },
      Math.max(0, ms),
    );

    signal?.addEventListener('abort', handleAbort, { once: true });
  });
}

function waitForAnimationFrame(signal) {
  return new Promise((resolve, reject) => {
    throwIfAborted(signal);
    const handleAbort = () => {
      window.cancelAnimationFrame(frameId);
      reject(new DOMException('Replay export aborted.', 'AbortError'));
    };
    const frameId = window.requestAnimationFrame(() => {
      signal?.removeEventListener('abort', handleAbort);
      resolve();
    });

    signal?.addEventListener('abort', handleAbort, { once: true });
  });
}

function makeEven(value) {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

function readCssVar(variableName, fallback) {
  if (typeof window === 'undefined' || !window.document?.documentElement) return fallback;
  const value = window
    .getComputedStyle(window.document.documentElement)
    .getPropertyValue(variableName)
    .trim();
  return value || fallback;
}

function getExportThemeColors() {
  return {
    pageBackground: readCssVar('--color-base-100', '#ffffff'),
    pageText: readCssVar('--color-base-content', '#0f172a'),
    surface: readCssVar('--statistics-summary-surface-muted', 'rgba(255, 255, 255, 0.96)'),
    surfaceStrong: readCssVar('--statistics-summary-surface-strong', 'rgba(255, 255, 255, 0.985)'),
    border: readCssVar('--statistics-summary-border', 'rgba(15, 23, 42, 0.08)'),
    shadow: readCssVar('--statistics-summary-shadow', 'rgba(15, 23, 42, 0.12)'),
  };
}

function createRoundedRectPath(ctx, x, y, width, height, radius) {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
}

function drawCard(ctx, x, y, width, height, colors) {
  ctx.save();
  ctx.shadowColor = colors.shadow;
  ctx.shadowBlur = EXPORT_CARD_SHADOW_BLUR;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 10;
  createRoundedRectPath(ctx, x, y, width, height, EXPORT_CARD_RADIUS);
  ctx.fillStyle = colors.surfaceStrong;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 1;
  ctx.strokeStyle = colors.border;
  ctx.stroke();
  ctx.restore();
}

function getChartStackSize(mainCanvas, tempCanvas) {
  return {
    width: Math.max(mainCanvas.width, tempCanvas.width),
    height: mainCanvas.height + tempCanvas.height + EXPORT_SECTION_GAP,
  };
}

function measureLegendRows(ctx, legendItems, maxWidth) {
  if (!legendItems.length) return [];

  const rows = [];
  let currentRow = [];
  let currentWidth = 0;

  for (const item of legendItems) {
    const textWidth = ctx.measureText(item.label).width;
    const swatchWidth = item.style === 'block' ? 18 : 22;
    const itemWidth = swatchWidth + EXPORT_LEGEND_GAP + textWidth;
    const nextWidth =
      currentRow.length === 0 ? itemWidth : currentWidth + EXPORT_LEGEND_ITEM_GAP + itemWidth;

    if (currentRow.length > 0 && nextWidth > maxWidth) {
      rows.push(currentRow);
      currentRow = [item];
      currentWidth = itemWidth;
      continue;
    }

    currentRow.push(item);
    currentWidth = nextWidth;
  }

  if (currentRow.length > 0) rows.push(currentRow);
  return rows;
}

function drawLegendSwatch(ctx, item, x, y) {
  ctx.save();
  ctx.strokeStyle = item.color;
  ctx.fillStyle = item.color;
  ctx.lineWidth = item.lineWidth || 3;

  if (item.style === 'block') {
    createRoundedRectPath(ctx, x, y - 6, 18, 12, 4);
    ctx.fill();
    ctx.restore();
    return 18;
  }

  if (item.style === 'dashed') {
    ctx.setLineDash([6, 5]);
  }

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 22, y);
  ctx.stroke();
  ctx.restore();
  return 22;
}

function drawLegend(ctx, legendItems, bounds, colors) {
  if (!legendItems.length) return;

  ctx.save();
  ctx.font = '600 14px Montserrat, sans-serif';
  ctx.textBaseline = 'middle';
  const rows = measureLegendRows(ctx, legendItems, bounds.width);

  let currentY = bounds.y + 14;
  for (const row of rows) {
    let currentX = bounds.x;
    for (const item of row) {
      const swatchWidth = drawLegendSwatch(ctx, item, currentX, currentY);
      currentX += swatchWidth + EXPORT_LEGEND_GAP;
      ctx.fillStyle = colors.pageText;
      ctx.fillText(item.label, currentX, currentY);
      currentX += ctx.measureText(item.label).width + EXPORT_LEGEND_ITEM_GAP;
    }
    currentY += 14 + EXPORT_LEGEND_ROW_GAP;
  }
  ctx.restore();
}

function getOverlayCanvasSize(layoutPreset, chartStackSize) {
  if (layoutPreset === 'overlay_landscape') return EXPORT_OVERLAY_LANDSCAPE;
  if (layoutPreset === 'overlay_portrait') return EXPORT_OVERLAY_PORTRAIT;
  return {
    width: chartStackSize.width + EXPORT_PADDING * 2 + EXPORT_CARD_PADDING * 2,
    height: chartStackSize.height + EXPORT_PADDING * 2 + EXPORT_CARD_PADDING * 3,
  };
}

function resolveChartFrame({
  layoutPreset,
  chartPlacement,
  outputWidth,
  outputHeight,
  chartStackSize,
}) {
  if (layoutPreset === 'chart_native') {
    return {
      x: EXPORT_PADDING,
      y: EXPORT_PADDING,
      width: outputWidth - EXPORT_PADDING * 2,
      height: outputHeight - EXPORT_PADDING * 2,
    };
  }

  if (
    chartPlacement &&
    Number.isFinite(chartPlacement.x) &&
    Number.isFinite(chartPlacement.y) &&
    Number.isFinite(chartPlacement.width) &&
    Number.isFinite(chartPlacement.height)
  ) {
    return {
      x: Math.round(chartPlacement.x * outputWidth),
      y: Math.round(chartPlacement.y * outputHeight),
      width: Math.round(chartPlacement.width * outputWidth),
      height: Math.round(chartPlacement.height * outputHeight),
    };
  }

  const horizontalInset = layoutPreset === 'overlay_portrait' ? 56 : 72;
  const verticalInset = layoutPreset === 'overlay_portrait' ? 84 : 72;
  const availableWidth = outputWidth - horizontalInset * 2;
  const availableHeight = outputHeight - verticalInset * 2;
  const scale = Math.min(
    availableWidth / chartStackSize.width,
    Math.max(0.2, availableHeight / chartStackSize.height),
  );
  const width = Math.round(chartStackSize.width * scale);
  const height = Math.round(chartStackSize.height * scale);

  return {
    x: Math.round((outputWidth - width) / 2),
    y: Math.round(outputHeight - height - verticalInset),
    width,
    height,
  };
}

function resolveCompositionLayout({ config, mainCanvas, tempCanvas, legendItems }) {
  const chartStackSize = getChartStackSize(mainCanvas, tempCanvas);
  const baseCanvasSize = getOverlayCanvasSize(config.layoutPreset, chartStackSize);
  const colors = getExportThemeColors();
  let legendSectionHeight = 0;
  if (config.includeLegend && legendItems.length > 0) {
    const measurementCanvas = document.createElement('canvas');
    const measurementCtx = measurementCanvas.getContext('2d');
    if (measurementCtx) {
      measurementCtx.font = '600 14px Montserrat, sans-serif';
      const maxLegendWidth = baseCanvasSize.width - EXPORT_PADDING * 2 - EXPORT_CARD_PADDING * 2;
      const legendRows = measureLegendRows(measurementCtx, legendItems, maxLegendWidth);
      legendSectionHeight =
        EXPORT_CARD_PADDING * 2 +
        legendRows.length * 14 +
        Math.max(0, legendRows.length - 1) * EXPORT_LEGEND_ROW_GAP;
    }
  }
  const outputWidth = makeEven(baseCanvasSize.width);
  const outputHeight = makeEven(
    config.layoutPreset === 'chart_native'
      ? baseCanvasSize.height + legendSectionHeight
      : baseCanvasSize.height,
  );

  // Compute a single normalized layout up front so video and image export share the exact same
  // card/frame geometry regardless of which export path invoked the compositor.
  const chartFrame = resolveChartFrame({
    layoutPreset: config.layoutPreset,
    chartPlacement: config.chartPlacement,
    outputWidth,
    outputHeight,
    chartStackSize,
  });

  const chartScale = Math.min(
    (chartFrame.width - EXPORT_CARD_PADDING * 2) / chartStackSize.width,
    (chartFrame.height -
      EXPORT_CARD_PADDING * 2 -
      (config.includeLegend && legendItems.length > 0 && config.layoutPreset === 'chart_native'
        ? legendSectionHeight
        : 0)) /
      chartStackSize.height,
  );
  const scaledMainWidth = Math.round(mainCanvas.width * chartScale);
  const scaledMainHeight = Math.round(mainCanvas.height * chartScale);
  const scaledTempWidth = Math.round(tempCanvas.width * chartScale);
  const scaledTempHeight = Math.round(tempCanvas.height * chartScale);
  const stackWidth = Math.max(scaledMainWidth, scaledTempWidth);
  const stackHeight = scaledMainHeight + scaledTempHeight + EXPORT_SECTION_GAP;
  const stackX = Math.round(chartFrame.x + (chartFrame.width - stackWidth) / 2);
  const stackY = Math.round(
    chartFrame.y +
      EXPORT_CARD_PADDING +
      (config.includeLegend && legendItems.length > 0 && config.layoutPreset === 'chart_native'
        ? legendSectionHeight
        : 0) +
      Math.max(0, chartFrame.height - stackHeight - EXPORT_CARD_PADDING * 2) / 2,
  );
  const legendBounds =
    config.includeLegend && legendItems.length > 0
      ? {
          x: chartFrame.x + EXPORT_CARD_PADDING,
          y: chartFrame.y + EXPORT_CARD_PADDING,
          width: chartFrame.width - EXPORT_CARD_PADDING * 2,
          height: legendSectionHeight - EXPORT_CARD_PADDING * 2,
        }
      : null;

  return {
    outputWidth,
    outputHeight,
    colors,
    chartFrame,
    legendBounds,
    mainBounds: {
      x: stackX + Math.round((stackWidth - scaledMainWidth) / 2),
      y: stackY,
      width: scaledMainWidth,
      height: scaledMainHeight,
    },
    tempBounds: {
      x: stackX + Math.round((stackWidth - scaledTempWidth) / 2),
      y: stackY + scaledMainHeight + EXPORT_SECTION_GAP,
      width: scaledTempWidth,
      height: scaledTempHeight,
    },
  };
}

function drawVideoLayer(ctx, layout, config) {
  const { videoSource, videoCrop } = config;
  if (!videoSource) return;

  const sourceWidth = videoSource.videoWidth || videoSource.width || 0;
  const sourceHeight = videoSource.videoHeight || videoSource.height || 0;
  if (!sourceWidth || !sourceHeight) return;

  const crop = videoCrop || { x: 0, y: 0, width: 1, height: 1 };
  const sx = Math.max(0, Math.min(sourceWidth, crop.x * sourceWidth));
  const sy = Math.max(0, Math.min(sourceHeight, crop.y * sourceHeight));
  const sw = Math.max(1, Math.min(sourceWidth - sx, crop.width * sourceWidth));
  const sh = Math.max(1, Math.min(sourceHeight - sy, crop.height * sourceHeight));
  ctx.drawImage(videoSource, sx, sy, sw, sh, 0, 0, layout.outputWidth, layout.outputHeight);
}

function renderCompositionFrame(ctx, layout, { config, mainCanvas, tempCanvas, legendItems }) {
  ctx.save();
  ctx.fillStyle = layout.colors.pageBackground;
  ctx.fillRect(0, 0, layout.outputWidth, layout.outputHeight);
  drawVideoLayer(ctx, layout, config);
  drawCard(
    ctx,
    layout.chartFrame.x,
    layout.chartFrame.y,
    layout.chartFrame.width,
    layout.chartFrame.height,
    layout.colors,
  );

  ctx.drawImage(
    mainCanvas,
    layout.mainBounds.x,
    layout.mainBounds.y,
    layout.mainBounds.width,
    layout.mainBounds.height,
  );
  ctx.drawImage(
    tempCanvas,
    layout.tempBounds.x,
    layout.tempBounds.y,
    layout.tempBounds.width,
    layout.tempBounds.height,
  );

  if (layout.legendBounds) {
    drawLegend(ctx, legendItems, layout.legendBounds, layout.colors);
  }
  ctx.restore();
}

function createCompositionCanvas({ mainCanvas, tempCanvas, legendItems, config }) {
  const compositionCanvas = document.createElement('canvas');
  const layout = resolveCompositionLayout({
    config,
    mainCanvas,
    tempCanvas,
    legendItems,
  });
  compositionCanvas.width = layout.outputWidth;
  compositionCanvas.height = layout.outputHeight;
  const ctx = compositionCanvas.getContext('2d', { alpha: false });
  if (!ctx) {
    throw new Error('Replay export canvas could not be created.');
  }

  return { compositionCanvas, layout, ctx };
}

function canvasToBlob(canvas, mimeType) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error('Replay image export could not be created.'));
        return;
      }
      resolve(blob);
    }, mimeType);
  });
}

function resolveRecorderMimeType(targetFormat) {
  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') return null;
  const candidates =
    targetFormat === 'mp4'
      ? ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=h264', 'video/mp4']
      : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];

  return (
    candidates.find(mimeType => {
      if (typeof window.MediaRecorder.isTypeSupported !== 'function') return true;
      return window.MediaRecorder.isTypeSupported(mimeType);
    }) || null
  );
}

export function getVideoExportCapabilities() {
  const preferredMp4MimeType = resolveRecorderMimeType('mp4');
  const preferredWebmMimeType = resolveRecorderMimeType('webm');
  const canRecordMp4 = Boolean(preferredMp4MimeType && preferredMp4MimeType.includes('mp4'));
  const canRecordWebm = Boolean(preferredWebmMimeType && preferredWebmMimeType.includes('webm'));
  const shouldHideWebmOption = isLikelySafariBrowser() || !canRecordWebm;

  // Keep capability detection centralized so the UI and the recorder agree on which formats are
  // actually viable before an export session starts.
  return {
    canRecordMp4,
    canRecordWebm,
    shouldHideWebmOption,
    defaultExportFormat: !shouldHideWebmOption && !canRecordMp4 ? 'webm' : 'mp4',
  };
}

async function recordCanvas(canvas, fps, renderFrames, signal, recorderMimeType) {
  if (typeof canvas.captureStream !== 'function') {
    throw new Error('Canvas capture is not supported in this browser.');
  }
  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') {
    throw new Error('MediaRecorder is not supported in this browser.');
  }

  const stream = canvas.captureStream(fps);
  const chunks = [];
  let recorderError = null;
  let stopHandler = null;
  let errorHandler = null;
  let dataHandler = null;

  const recorder = recorderMimeType
    ? new MediaRecorder(stream, {
        mimeType: recorderMimeType,
        videoBitsPerSecond: 10_000_000,
      })
    : new MediaRecorder(stream, {
        videoBitsPerSecond: 10_000_000,
      });

  const stopPromise = new Promise((resolve, reject) => {
    dataHandler = event => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    };
    errorHandler = event => {
      recorderError = event?.error || new Error('Replay recording failed.');
      reject(recorderError);
    };
    stopHandler = () => {
      if (recorderError) {
        reject(recorderError);
        return;
      }
      resolve(
        new Blob(chunks, {
          type: recorder.mimeType || recorderMimeType || 'video/webm',
        }),
      );
    };

    recorder.addEventListener('dataavailable', dataHandler);
    recorder.addEventListener('error', errorHandler);
    recorder.addEventListener('stop', stopHandler);
  });

  const cleanup = () => {
    recorder.removeEventListener('dataavailable', dataHandler);
    recorder.removeEventListener('error', errorHandler);
    recorder.removeEventListener('stop', stopHandler);
    stream.getTracks().forEach(track => track.stop());
  };

  // The recorder lifecycle is intentionally wrapped here so exportReplayVideo can focus on replay
  // timing and composition, while this helper owns MediaRecorder event handling and cleanup.
  const abortHandler = () => {
    try {
      if (recorder.state !== 'inactive') recorder.stop();
    } catch {
      // Ignore stop races during abort.
    }
  };

  signal?.addEventListener('abort', abortHandler, { once: true });

  try {
    recorder.start();
    await renderFrames();
    if (recorder.state !== 'inactive') recorder.stop();
    return await stopPromise;
  } finally {
    signal?.removeEventListener('abort', abortHandler);
    cleanup();
  }
}

export async function exportReplayVideo({
  mainCanvas,
  tempCanvas,
  runtime,
  applyReplayFrame,
  legendItems = [],
  config,
  onStatusChange,
  signal,
}) {
  throwIfAborted(signal);
  if (!mainCanvas || !tempCanvas || !runtime) {
    throw new Error('Replay export is not ready yet.');
  }

  const { compositionCanvas, layout, ctx } = createCompositionCanvas({
    mainCanvas,
    tempCanvas,
    legendItems,
    config,
  });

  const recorderMimeType = resolveRecorderMimeType(config.exportFormat);
  if (!recorderMimeType) {
    throw new Error(
      config.exportFormat === 'mp4'
        ? 'This browser cannot record MP4 video. Please use WebM export instead.'
        : 'No supported video recorder was found for replay export.',
    );
  }

  const totalDurationSec = Math.max(
    0,
    Number.isFinite(runtime.totalDurationSec)
      ? runtime.totalDurationSec
      : runtime.maxTime - runtime.shotStartSec,
  );
  const totalFrames = Math.max(
    1,
    Number.isFinite(runtime.frameCount)
      ? runtime.frameCount
      : Math.ceil(totalDurationSec * EXPORT_FPS),
  );
  const frameDurationMs =
    totalDurationSec > 0 ? (totalDurationSec * 1000) / totalFrames : 1000 / EXPORT_FPS;

  const renderFrames = async () => {
    // Use an absolute schedule instead of chaining rAF + timeout delays.
    // That keeps the recorded replay duration aligned with the live replay timing.
    const recordingStartMs = getNowMs();

    applyReplayFrame(-1, { forceReset: true });
    renderCompositionFrame(ctx, layout, {
      config,
      mainCanvas,
      tempCanvas,
      legendItems,
    });

    for (let frameIndex = 0; frameIndex <= totalFrames; frameIndex++) {
      throwIfAborted(signal);

      // Drive the export from the same replay frame function as the live chart so recorded timing
      // follows the transformed replay model instead of falling back to simple visual clipping.
      applyReplayFrame(frameIndex);
      renderCompositionFrame(ctx, layout, {
        config,
        mainCanvas,
        tempCanvas,
        legendItems,
      });

      if (frameIndex === totalFrames) continue;

      const nextFrameDueMs = recordingStartMs + (frameIndex + 1) * frameDurationMs;
      await wait(Math.max(0, nextFrameDueMs - getNowMs()), signal);
    }
  };

  onStatusChange?.('recording');
  const recordedBlob = await recordCanvas(
    compositionCanvas,
    EXPORT_FPS,
    renderFrames,
    signal,
    recorderMimeType,
  );

  return {
    blob: recordedBlob,
    mimeType: recordedBlob.type || recorderMimeType,
    width: layout.outputWidth,
    height: layout.outputHeight,
    fps: EXPORT_FPS,
  };
}

export async function exportReplayImage({
  mainCanvas,
  tempCanvas,
  legendItems = [],
  config,
  signal,
}) {
  throwIfAborted(signal);
  if (!mainCanvas || !tempCanvas) {
    throw new Error('Replay image export is not ready yet.');
  }

  const { compositionCanvas, layout, ctx } = createCompositionCanvas({
    mainCanvas,
    tempCanvas,
    legendItems,
    config,
  });

  // Wait one animation frame so any final Chart.js draw triggered just before export has landed
  // on the source canvases before the static PNG composition is captured.
  await waitForAnimationFrame(signal);
  renderCompositionFrame(ctx, layout, {
    config,
    mainCanvas,
    tempCanvas,
    legendItems,
  });

  const blob = await canvasToBlob(compositionCanvas, 'image/png');
  return {
    blob,
    mimeType: 'image/png',
    width: layout.outputWidth,
    height: layout.outputHeight,
  };
}
