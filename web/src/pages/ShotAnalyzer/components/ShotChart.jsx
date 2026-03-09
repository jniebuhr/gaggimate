/**
 * ShotChart.jsx
 * Chart.js visualization component for shot data.
 * Main chart: pressure/flow family + weight + annotations.
 * Sub chart: temperature (Temp + Target T).
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import Chart from 'chart.js/auto';
import annotationPlugin from 'chartjs-plugin-annotation';
import { downloadBlob, downloadJson } from '../../../utils/download';
import { exportReplayImage, exportReplayVideo } from '../services/ReplayVideoExportService';
import { libraryService } from '../services/LibraryService';
import { ShotChartControls, getNextChartHeight } from './shotChart/ShotChartControls';
import {
  areTooltipLayoutsEqual,
  areTooltipStatesEqual,
  buildExternalTooltipState,
  createHiddenExternalTooltipLayout,
  createHiddenExternalTooltipState,
  getExternalTooltipLayout,
  ShotChartExternalTooltip,
  shouldRenderTooltipLabel,
  sortTooltipItems,
} from './shotChart/ShotChartExternalTooltip';
import {
  BREW_BY_TIME_LABEL,
  BREW_BY_WEIGHT_LABEL,
  DEFAULT_REPLAY_EXPORT_CONFIG,
  INITIAL_VISIBILITY,
  MAIN_CHART_HEIGHT_DEFAULT,
  REPLAY_EXPORT_STATUS_LABELS,
  REPLAY_FRAME_INTERVAL_MS,
  STANDARD_LINE_WIDTH,
  TARGET_FLOW_MAX,
  TARGET_PRESSURE_MAX,
  TEMP_CHART_HEIGHT_RATIO,
  THIN_LINE_WIDTH,
  VISIBILITY_KEY_BY_LABEL,
  WATER_DRAWN_PHASE_LABEL,
  WATER_DRAWN_TOTAL_LABEL,
} from './shotChart/constants';
import {
  buildReplayExportFilename,
  buildReplayImageFilename,
  createStripedFillPattern,
  findLastSampleIndexAtOrBeforeX,
  formatAxisTick,
  getLegendColorByLabel,
  getPhaseName,
  getShotChartColors,
  getTooltipColorByLabel,
  getVisibleLegendItemsForExport,
  hoverGuidePlugin,
  readCssColorVar,
  replayRevealPlugin,
  resolveHoverPointColor,
  safeMax,
  safeMin,
  toNumberOrNull,
} from './shotChart/helpers';
import './ShotChart.css';

// Register the annotation plugin for Phase Lines
Chart.register(annotationPlugin);

/**
 * ShotChart Component
 * Renders main and sub chart using Chart.js.
 */
export function ShotChart({ shotData, results }) {
  const hoverAreaRef = useRef(null);
  const mainChartContainerRef = useRef(null);
  const mainChartRef = useRef(null);
  const tempChartRef = useRef(null);
  const exportMenuRef = useRef(null);
  const externalTooltipRef = useRef(null);
  const mainChartInstance = useRef(null);
  const tempChartInstance = useRef(null);
  const chartColorsRef = useRef(null);
  const replayRafRef = useRef(null);
  const replayStartPerfMsRef = useRef(0);
  const replayLastRenderPerfMsRef = useRef(0);
  const replayElapsedOffsetSecRef = useRef(0);
  const replayBaseShotTimeSecRef = useRef(0);
  const replayLastAppliedIndexRef = useRef(-1);
  const replayRuntimeRef = useRef(null);
  const clearAllHoverRef = useRef(() => {});
  const isReplayingRef = useRef(false);
  const isExportingRef = useRef(false);
  const activeExportTypeRef = useRef(null);
  const exportAbortControllerRef = useRef(null);
  const isMountedRef = useRef(true);

  // Keep frame-by-frame replay state in refs so the animation loop does not trigger React renders.
  // Only user-facing state stays in React state.
  const [visibility, setVisibility] = useState(INITIAL_VISIBILITY);
  const [mainChartHeight, setMainChartHeight] = useState(MAIN_CHART_HEIGHT_DEFAULT);
  const [isReplaying, setIsReplaying] = useState(false);
  const [isReplayPaused, setIsReplayPaused] = useState(false);
  const [exportMenuState, setExportMenuState] = useState({
    open: false,
    exportType: DEFAULT_REPLAY_EXPORT_CONFIG.exportType,
    includeLegend: DEFAULT_REPLAY_EXPORT_CONFIG.includeLegend,
  });
  const [isReplayExporting, setIsReplayExporting] = useState(false);
  const [replayExportStatus, setReplayExportStatus] = useState({ status: 'idle', error: null });
  const [externalTooltipState, setExternalTooltipState] = useState(createHiddenExternalTooltipState);
  const [externalTooltipLayout, setExternalTooltipLayout] = useState(createHiddenExternalTooltipLayout);
  if (!chartColorsRef.current) {
    chartColorsRef.current = getShotChartColors();
  }
  const legendColorByLabel = getLegendColorByLabel(chartColorsRef.current);
  const hasWeightData = Boolean(
    shotData?.samples?.some(sample => {
      const rawWeight = sample?.v ?? sample?.w ?? sample?.weight ?? sample?.m;
      const numericWeight = Number(rawWeight);
      return Number.isFinite(numericWeight) && numericWeight > 0;
    }),
  );
  const hasWeightFlowData = Boolean(
    shotData?.samples?.some(sample => {
      const val = Number(sample?.vf ?? sample?.weight_flow);
      return Number.isFinite(val) && val > 0;
    }),
  );
  const activeExportType = activeExportTypeRef.current;
  const isVideoExportActive = isReplayExporting && activeExportType === 'video';
  const isControlsLocked = isReplayExporting;
  const shouldShowReplayFocusHint =
    isVideoExportActive &&
    (replayExportStatus.status === 'preparing' || replayExportStatus.status === 'recording');
  const replayExportStatusLabel = replayExportStatus.error
    ? replayExportStatus.error
    : REPLAY_EXPORT_STATUS_LABELS[replayExportStatus.status] || '';

  const setReplayExportStatusSafely = nextStatus => {
    if (isMountedRef.current) {
      setReplayExportStatus(nextStatus);
    }
  };

  const updateReplayExportStatusSafely = updater => {
    if (isMountedRef.current) {
      setReplayExportStatus(updater);
    }
  };

  useLayoutEffect(() => {
    // The tooltip width depends on rendered content, so measure after paint and then clamp it into the chart box.
    if (!externalTooltipState.visible) {
      setExternalTooltipLayout(prev => {
        const hiddenLayout = createHiddenExternalTooltipLayout();
        return areTooltipLayoutsEqual(prev, hiddenLayout) ? prev : hiddenLayout;
      });
      return;
    }

    const tooltipElement = externalTooltipRef.current;
    const containerElement = mainChartContainerRef.current;
    if (!tooltipElement || !containerElement) return;

    const chartWidth = externalTooltipState.chartWidth || containerElement.clientWidth || 0;
    const chartHeight = externalTooltipState.chartHeight || containerElement.clientHeight || 0;
    const tooltipWidth = tooltipElement.offsetWidth || 0;
    const tooltipHeight = tooltipElement.offsetHeight || 0;

    const nextLayout = getExternalTooltipLayout({
      tooltipState: externalTooltipState,
      tooltipWidth,
      tooltipHeight,
      fallbackWidth: chartWidth,
      fallbackHeight: chartHeight,
    });

    setExternalTooltipLayout(prev => (areTooltipLayoutsEqual(prev, nextLayout) ? prev : nextLayout));
  }, [externalTooltipState]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      exportAbortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    // Delay the global listener to the next tick so the cancel click itself does not immediately dismiss the message.
    if (replayExportStatus.error !== 'Replay export was cancelled.') return undefined;

    let isDisposed = false;
    const handlePointerDown = () => {
      if (isDisposed) return;
      setReplayExportStatus({ status: 'idle', error: null });
    };

    const timerId = window.setTimeout(() => {
      if (isDisposed) return;
      document.addEventListener('pointerdown', handlePointerDown, { once: true });
    }, 0);

    return () => {
      isDisposed = true;
      window.clearTimeout(timerId);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [replayExportStatus.error]);

  useEffect(() => {
    if (!exportMenuState.open) return undefined;

    // Treat the export menu like a lightweight popover: close on outside click or Escape.
    const handlePointerDown = event => {
      const menuNode = exportMenuRef.current;
      if (!menuNode || menuNode.contains(event.target)) return;
      setExportMenuState(prev => ({ ...prev, open: false }));
    };

    const handleKeyDown = event => {
      if (event.key !== 'Escape') return;
      setExportMenuState(prev => ({ ...prev, open: false }));
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [exportMenuState.open]);

  const handleLegendToggle = label => {
    if (isExportingRef.current) return;
    const key = VISIBILITY_KEY_BY_LABEL[label];
    if (!key) return;
    if (label === 'Weight' && !hasWeightData) return;
    if (label === 'Weight Flow' && !hasWeightFlowData) return;
    setVisibility(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const closeExportMenu = () => {
    setExportMenuState(prev => ({ ...prev, open: false }));
  };

  const openExportMenu = () => {
    if (isControlsLocked) return;
    setReplayExportStatus({ status: 'idle', error: null });
    setExportMenuState({
      open: true,
      exportType: DEFAULT_REPLAY_EXPORT_CONFIG.exportType,
      includeLegend: DEFAULT_REPLAY_EXPORT_CONFIG.includeLegend,
    });
  };

  const toggleExportMenu = () => {
    if (exportMenuState.open) {
      closeExportMenu();
      return;
    }
    openExportMenu();
  };

  const handleExportTypeChange = exportType => {
    setExportMenuState(prev => ({ ...prev, exportType }));
  };

  const handleIncludeLegendChange = includeLegend => {
    setExportMenuState(prev => ({ ...prev, includeLegend }));
  };

  const stopReplayAnimation = (clearHover = false) => {
    // Reset both charts back to their fully revealed state and clear any replay-only plugin state.
    if (typeof window !== 'undefined' && replayRafRef.current !== null) {
      window.cancelAnimationFrame(replayRafRef.current);
    }
    replayRafRef.current = null;
    replayStartPerfMsRef.current = 0;
    replayLastRenderPerfMsRef.current = 0;
    replayElapsedOffsetSecRef.current = 0;
    replayLastAppliedIndexRef.current = -1;
    isReplayingRef.current = false;
    setIsReplaying(false);
    setIsReplayPaused(false);
    if (clearHover) clearAllHoverRef.current?.();

    if (mainChartInstance.current) {
      mainChartInstance.current.$replayRevealEnabled = false;
      mainChartInstance.current.$replayRevealX = null;
      mainChartInstance.current.$replayRevealClipActive = false;
    }
    if (tempChartInstance.current) {
      tempChartInstance.current.$replayRevealEnabled = false;
      tempChartInstance.current.$replayRevealX = null;
      tempChartInstance.current.$replayRevealClipActive = false;
    }
  };

  const applyReplayCutoff = (cutoffX, options = {}) => {
    const runtime = replayRuntimeRef.current;
    if (!runtime) return;
    const mainChart = mainChartInstance.current;
    const tempChart = tempChartInstance.current;
    if (!mainChart || !tempChart) return;

    const { mainAnnotationMeta, tempAnnotationMeta, sampleTimesSec, maxTime } = runtime;

    const revealAll = options.revealAll === true || !Number.isFinite(cutoffX);
    const effectiveCutoffX = revealAll ? maxTime : cutoffX;

    // The live replay and the export pipeline both go through this function so annotations and clipping stay identical.
    mainChart.$replayRevealEnabled = !revealAll;
    mainChart.$replayRevealX = !revealAll ? effectiveCutoffX : null;
    tempChart.$replayRevealEnabled = !revealAll;
    tempChart.$replayRevealX = !revealAll ? effectiveCutoffX : null;

    const mainAnnotations = mainChart.options?.plugins?.annotation?.annotations || {};
    for (const meta of mainAnnotationMeta) {
      const annotation = mainAnnotations[meta.key];
      if (!annotation) continue;
      const shouldShow = revealAll || effectiveCutoffX >= meta.time;
      annotation.display = meta.baseDisplay && shouldShow;
    }

    const tempAnnotations = tempChart.options?.plugins?.annotation?.annotations || {};
    for (const meta of tempAnnotationMeta) {
      const annotation = tempAnnotations[meta.key];
      if (!annotation) continue;
      const shouldShow = revealAll || effectiveCutoffX >= meta.time;
      annotation.display = meta.baseDisplay && shouldShow;
    }

    if (revealAll) {
      replayLastAppliedIndexRef.current = sampleTimesSec.length - 1;
    } else {
      replayLastAppliedIndexRef.current = findLastSampleIndexAtOrBeforeX(sampleTimesSec, effectiveCutoffX);
    }

    mainChart.update('none');
    tempChart.update('none');
  };

  const getNowMs = () =>
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();

  const scheduleReplayFrame = frameHandler => {
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') return false;
    replayRafRef.current = window.requestAnimationFrame(frameHandler);
    return true;
  };

  const startReplayLoop = () => {
    const frame = nowMs => {
      if (!isReplayingRef.current) return;
      const currentRuntime = replayRuntimeRef.current;
      if (!currentRuntime) {
        stopReplayAnimation();
        return;
      }

      const elapsedSec = Math.max(
        0,
        replayElapsedOffsetSecRef.current + (nowMs - replayStartPerfMsRef.current) / 1000,
      );
      const cutoffX = replayBaseShotTimeSecRef.current + elapsedSec;
      const sampleIndex = findLastSampleIndexAtOrBeforeX(currentRuntime.sampleTimesSec, cutoffX);
      const reachedEnd = cutoffX >= currentRuntime.maxTime;
      const shouldRenderFrame =
        reachedEnd ||
        replayLastRenderPerfMsRef.current === 0 ||
        nowMs - replayLastRenderPerfMsRef.current >= REPLAY_FRAME_INTERVAL_MS;

      if (shouldRenderFrame) {
        replayLastRenderPerfMsRef.current = nowMs;
        applyReplayCutoff(reachedEnd ? currentRuntime.maxTime : cutoffX, { revealAll: reachedEnd });
      } else if (sampleIndex !== replayLastAppliedIndexRef.current) {
        replayLastAppliedIndexRef.current = sampleIndex;
      }

      if (reachedEnd) {
        stopReplayAnimation();
        return;
      }

      replayRafRef.current = window.requestAnimationFrame(frame);
    };

    if (!scheduleReplayFrame(frame)) {
      const runtime = replayRuntimeRef.current;
      if (runtime) {
        applyReplayCutoff(runtime.maxTime, { revealAll: true });
      }
      stopReplayAnimation();
    }
  };

  const startReplay = () => {
    // Always start from a clean visual state so replayed annotations and hover state do not leak between runs.
    const runtime = replayRuntimeRef.current;
    if (!runtime || !Array.isArray(runtime.sampleTimesSec) || runtime.sampleTimesSec.length === 0) return;
    const mainChart = mainChartInstance.current;
    const tempChart = tempChartInstance.current;
    if (!mainChart || !tempChart) return;

    stopReplayAnimation(true);
    isReplayingRef.current = true;
    setIsReplaying(true);
    setIsReplayPaused(false);
    replayBaseShotTimeSecRef.current = runtime.shotStartSec;
    replayElapsedOffsetSecRef.current = 0;
    replayLastAppliedIndexRef.current = -1;
    applyReplayCutoff(runtime.shotStartSec - 0.001);

    replayStartPerfMsRef.current = getNowMs();
    replayLastRenderPerfMsRef.current = 0;
    startReplayLoop();
  };

  const pauseReplay = () => {
    if (!isReplayingRef.current) return;
    const nowMs = getNowMs();
    if (replayStartPerfMsRef.current > 0) {
      replayElapsedOffsetSecRef.current += Math.max(
        0,
        (nowMs - replayStartPerfMsRef.current) / 1000,
      );
    }
    if (typeof window !== 'undefined' && replayRafRef.current !== null) {
      window.cancelAnimationFrame(replayRafRef.current);
    }
    replayRafRef.current = null;
    replayStartPerfMsRef.current = 0;
    isReplayingRef.current = false;
    setIsReplaying(false);
    setIsReplayPaused(true);
    clearAllHoverRef.current?.();
  };

  const resumeReplay = () => {
    const runtime = replayRuntimeRef.current;
    if (!runtime || !Array.isArray(runtime.sampleTimesSec) || runtime.sampleTimesSec.length === 0) return;
    if (isReplayingRef.current) return;

    isReplayingRef.current = true;
    setIsReplaying(true);
    setIsReplayPaused(false);
    replayStartPerfMsRef.current = getNowMs();
    replayLastRenderPerfMsRef.current = 0;
    clearAllHoverRef.current?.();
    startReplayLoop();
  };

  const stopReplayAndRestoreChart = () => {
    if (activeExportTypeRef.current === 'video') {
      cancelActiveExport();
      return;
    }
    if (isExportingRef.current) return;
    const runtime = replayRuntimeRef.current;
    if (runtime) {
      applyReplayCutoff(runtime.maxTime, { revealAll: true });
    }
    stopReplayAnimation(true);
  };

  const handleReplayClick = () => {
    if (isExportingRef.current) return;
    if (isReplayingRef.current) {
      pauseReplay();
      return;
    }
    if (isReplayPaused) {
      resumeReplay();
      return;
    }
    startReplay();
  };

  const captureReplayVisualSnapshot = () => {
    const runtime = replayRuntimeRef.current;
    if (!runtime) return { mode: 'revealed' };

    // Export temporarily takes ownership of the replay visuals, so capture enough state to restore the user's view afterwards.
    if (!isReplayingRef.current && !isReplayPaused) {
      return { mode: 'revealed' };
    }

    const elapsedSec =
      replayElapsedOffsetSecRef.current +
      (isReplayingRef.current && replayStartPerfMsRef.current > 0
        ? Math.max(0, (getNowMs() - replayStartPerfMsRef.current) / 1000)
        : 0);
    const cutoffX = Math.min(runtime.maxTime, replayBaseShotTimeSecRef.current + elapsedSec);

    if (!Number.isFinite(cutoffX) || cutoffX >= runtime.maxTime) {
      return { mode: 'revealed' };
    }

    return {
      mode: 'cutoff',
      cutoffX,
      elapsedSec: Math.max(0, cutoffX - runtime.shotStartSec),
    };
  };

  const restoreReplayVisualSnapshot = snapshot => {
    const runtime = replayRuntimeRef.current;
    stopReplayAnimation(true);
    if (!runtime) return;

    if (snapshot?.mode === 'cutoff' && Number.isFinite(snapshot.cutoffX)) {
      replayBaseShotTimeSecRef.current = runtime.shotStartSec;
      replayElapsedOffsetSecRef.current = Math.max(
        0,
        snapshot.elapsedSec ?? snapshot.cutoffX - runtime.shotStartSec,
      );
      applyReplayCutoff(snapshot.cutoffX, { revealAll: false });
      setIsReplayPaused(true);
      return;
    }

    applyReplayCutoff(runtime.maxTime, { revealAll: true });
  };

  const beginExportSession = (exportType, abortController = null) => {
    // Separate export lifecycle state from menu state so control locking stays explicit.
    exportAbortControllerRef.current = abortController;
    isExportingRef.current = true;
    activeExportTypeRef.current = exportType;
    if (isMountedRef.current) {
      setIsReplayExporting(true);
    }
  };

  const finishExportSession = () => {
    exportAbortControllerRef.current = null;
    isExportingRef.current = false;
    activeExportTypeRef.current = null;
    if (isMountedRef.current) {
      setIsReplayExporting(false);
    }
  };

  const getResolvedExportConfig = () => ({
    ...DEFAULT_REPLAY_EXPORT_CONFIG,
    exportType: exportMenuState.exportType,
    includeLegend: exportMenuState.includeLegend,
  });

  const getResolvedLegendItems = includeLegend => {
    if (!includeLegend) return [];
    return getVisibleLegendItemsForExport({
      legendColorByLabel,
      visibility,
      hasWeightData,
      hasWeightFlowData,
    });
  };

  const cancelActiveExport = () => {
    if (activeExportTypeRef.current !== 'video') return;
    exportAbortControllerRef.current?.abort();
  };

  const handleVideoExport = async () => {
    const runtime = replayRuntimeRef.current;
    const mainChart = mainChartInstance.current;
    const tempChart = tempChartInstance.current;
    if (!runtime || !mainChart?.canvas || !tempChart?.canvas) {
      setReplayExportStatusSafely({
        status: 'error',
        error: 'Replay export is not ready yet.',
      });
      return;
    }

    const visualSnapshot = captureReplayVisualSnapshot();
    exportAbortControllerRef.current?.abort();
    const abortController = new AbortController();
    beginExportSession('video', abortController);
    setReplayExportStatusSafely({ status: 'preparing', error: null });

    clearAllHoverRef.current?.();
    stopReplayAnimation(true);

    try {
      // Video export replays the chart from the beginning on a separate composition canvas.
      const exportConfig = getResolvedExportConfig();
      const legendItems = getResolvedLegendItems(exportConfig.includeLegend);
      const { blob } = await exportReplayVideo({
        mainCanvas: mainChart.canvas,
        tempCanvas: tempChart.canvas,
        runtime,
        applyReplayCutoff,
        legendItems,
        config: exportConfig,
        signal: abortController.signal,
        onStatusChange: status => {
          updateReplayExportStatusSafely(current => ({ ...current, status, error: null }));
        },
      });

      setReplayExportStatusSafely({ status: 'downloading', error: null });
      downloadBlob(blob, buildReplayExportFilename(shotData, exportConfig.includeLegend));
      restoreReplayVisualSnapshot(visualSnapshot);
      setReplayExportStatusSafely({ status: 'idle', error: null });
    } catch (error) {
      restoreReplayVisualSnapshot(visualSnapshot);
      setReplayExportStatusSafely({
        status: 'error',
        error:
          error?.name === 'AbortError'
            ? 'Replay export was cancelled.'
            : error?.message || 'Replay export failed.',
      });
    } finally {
      finishExportSession();
    }
  };

  const handleImageExport = async () => {
    const runtime = replayRuntimeRef.current;
    const mainChart = mainChartInstance.current;
    const tempChart = tempChartInstance.current;
    if (!runtime || !mainChart?.canvas || !tempChart?.canvas) {
      setReplayExportStatusSafely({
        status: 'error',
        error: 'Replay image export is not ready yet.',
      });
      return;
    }

    const visualSnapshot = captureReplayVisualSnapshot();
    const abortController = new AbortController();
    beginExportSession('image', abortController);
    setReplayExportStatusSafely({ status: 'renderingImage', error: null });

    clearAllHoverRef.current?.();
    stopReplayAnimation(true);

    try {
      // Image export renders the fully revealed end state through the same composition pipeline as video export.
      const exportConfig = getResolvedExportConfig();
      const legendItems = getResolvedLegendItems(exportConfig.includeLegend);
      applyReplayCutoff(runtime.maxTime, { revealAll: true });
      const { blob } = await exportReplayImage({
        mainCanvas: mainChart.canvas,
        tempCanvas: tempChart.canvas,
        legendItems,
        config: exportConfig,
        signal: abortController.signal,
      });
      setReplayExportStatusSafely({ status: 'downloading', error: null });
      downloadBlob(blob, buildReplayImageFilename(shotData, exportConfig.includeLegend));
      restoreReplayVisualSnapshot(visualSnapshot);
      setReplayExportStatusSafely({ status: 'idle', error: null });
    } catch (error) {
      restoreReplayVisualSnapshot(visualSnapshot);
      setReplayExportStatusSafely({
        status: 'error',
        error:
          error?.name === 'AbortError'
            ? 'Replay image export was cancelled.'
            : error?.message || 'Replay image export failed.',
      });
    } finally {
      finishExportSession();
    }
  };

  const handleShotJsonExport = async () => {
    beginExportSession('json');
    setReplayExportStatusSafely({ status: 'preparingJson', error: null });

    try {
      const { exportData, filename } = await libraryService.exportItem(shotData, true);
      setReplayExportStatusSafely({ status: 'downloading', error: null });
      downloadJson(exportData, filename);
      setReplayExportStatusSafely({ status: 'idle', error: null });
    } catch (error) {
      setReplayExportStatusSafely({
        status: 'error',
        error: error?.message || 'Shot JSON export failed.',
      });
    } finally {
      finishExportSession();
    }
  };

  const handleExportAction = async () => {
    if (isExportingRef.current) return;

    closeExportMenu();
    // Dispatch exports here so the menu stays dumb and the export lifecycle remains centralized.
    if (exportMenuState.exportType === 'json') {
      await handleShotJsonExport();
      return;
    }
    if (exportMenuState.exportType === 'image') {
      await handleImageExport();
      return;
    }
    await handleVideoExport();
  };

  useEffect(() => {
    const destroyCharts = () => {
      if (mainChartInstance.current) {
        mainChartInstance.current.destroy();
        mainChartInstance.current = null;
      }
      if (tempChartInstance.current) {
        tempChartInstance.current.destroy();
        tempChartInstance.current = null;
      }
    };

    // Rebuild charts only when the underlying data or visibility changes.
    // Hover and replay updates stay imperative and do not rerun this effect.
    stopReplayAnimation(true);
    replayRuntimeRef.current = null;
    setExternalTooltipState(prev => {
      const hiddenState = createHiddenExternalTooltipState();
      return areTooltipStatesEqual(prev, hiddenState) ? prev : hiddenState;
    });

    // Validation: Ensure data exists before rendering
    if (!shotData || !shotData.samples || shotData.samples.length === 0) {
      destroyCharts();
      return;
    }

    // Cleanup before rebuild to avoid memory leaks/visual glitches
    destroyCharts();

    // Guard: ensure canvas elements are mounted
    if (!mainChartRef.current || !tempChartRef.current) return;

    const COLORS = getShotChartColors();
    chartColorsRef.current = COLORS;

    const mainCanvasCtx = mainChartRef.current.getContext('2d');
    const targetPressureFill = createStripedFillPattern(mainCanvasCtx, COLORS.pressure, {
      baseAlpha: 0.018,
      stripeAlpha: 0.065,
      size: 18,
      lineWidth: 2,
    });
    const targetFlowFill = createStripedFillPattern(mainCanvasCtx, COLORS.flow, {
      baseAlpha: 0.018,
      stripeAlpha: 0.065,
      size: 18,
      lineWidth: 2,
    });
    const tempCanvasCtx = tempChartRef.current.getContext('2d');
    const tempToTargetFill = createStripedFillPattern(tempCanvasCtx, COLORS.temp, {
      baseAlpha: 0.018,
      stripeAlpha: 0.09,
      size: 9,
      lineWidth: 1,
    });
    const brewModeLabel = results?.isBrewByWeight ? BREW_BY_WEIGHT_LABEL : BREW_BY_TIME_LABEL;
    const brewModeColor = results?.isBrewByWeight
      ? readCssColorVar('--analyzer-brew-by-weight-label-bg', COLORS.weight)
      : readCssColorVar('--analyzer-brew-by-time-label-bg', '#475569');
    const brewModeLabelTextColor = results?.isBrewByWeight
      ? readCssColorVar('--analyzer-brew-by-weight-label-text', '#ffffff')
      : readCssColorVar('--analyzer-brew-by-time-label-text', '#ffffff');
    const brewModeBorderColor = results?.isBrewByWeight
      ? readCssColorVar('--analyzer-brew-by-weight-label-border', COLORS.weight)
      : readCssColorVar('--analyzer-brew-by-time-label-border', '#334155');

    const samples = shotData.samples;

    // Use the real last sample time as the x-axis ceiling so replay/export do not end with trailing empty space.
    const maxTime = samples.length > 0 ? (samples[samples.length - 1].t || 0) / 1000 : 0;
    const sampleTimesSec = new Array(samples.length);
    const cumulativeWaterTotalBySample = new Array(samples.length);
    let cumulativeWaterTotal = 0;
    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i] || {};
      const tMs = Number(sample.t) || 0;
      sampleTimesSec[i] = tMs / 1000;
      if (i === 0) {
        cumulativeWaterTotalBySample[i] = 0;
        continue;
      }

      const prevTMs = Number(samples[i - 1]?.t) || tMs;
      const dt = Math.max(0, (tMs - prevTMs) / 1000);
      const flow = Number(sample.fl);
      cumulativeWaterTotal += (Number.isFinite(flow) ? flow : 0) * dt;
      cumulativeWaterTotalBySample[i] = cumulativeWaterTotal;
    }

    const shotStartSec = sampleTimesSec[0] ?? 0;
    // Precompute phase-relative water offsets once so tooltip water values stay cheap during pointer movement.
    const phaseHoverRanges = Array.isArray(results?.phases)
      ? results.phases
          .map(phase => {
            const startRel = Number(phase?.start);
            if (!Number.isFinite(startRel)) return null;
            const endRelRaw = Number(phase?.end);
            const endRel = Number.isFinite(endRelRaw) ? endRelRaw : startRel;
            const startAbs = shotStartSec + startRel;
            const endAbs = shotStartSec + Math.max(startRel, endRel);
            const startSampleIndexFloor = findLastSampleIndexAtOrBeforeX(sampleTimesSec, startAbs);
            const startCumWater =
              startSampleIndexFloor >= 0 ? cumulativeWaterTotalBySample[startSampleIndexFloor] || 0 : 0;
            return {
              label: phase?.displayName || phase?.name || null,
              startAbs,
              endAbs,
              startSampleIndexFloor,
              startCumWater,
            };
          })
          .filter(Boolean)
      : [];

    // Helper to safely extract values from sample objects
    const getVal = (item, keys) => {
      for (const key of keys) {
        if (item[key] !== undefined) return item[key];
      }
      return null;
    };

    // Initialize data series arrays
    const series = {
      pressure: [],
      flow: [],
      puckFlow: [],
      temp: [],
      weight: [],
      weightFlow: [],
      targetPressure: [],
      targetFlow: [],
      targetTemp: [],
    };

    // Parse samples into series
    samples.forEach(sample => {
      const t = (sample.t || 0) / 1000;

      // Extract raw values
      const pressure = toNumberOrNull(getVal(sample, ['cp', 'p', 'pressure']));
      const flow = toNumberOrNull(getVal(sample, ['fl', 'f', 'flow']));
      const puckFlow = toNumberOrNull(getVal(sample, ['pf', 'puck_flow']));
      const temp = toNumberOrNull(getVal(sample, ['ct', 't', 'temperature']));
      const weight = toNumberOrNull(getVal(sample, ['v', 'w', 'weight', 'm']));
      const weightFlow = toNumberOrNull(getVal(sample, ['vf', 'weight_flow']));

      // Extract target values
      const targetPressure = toNumberOrNull(getVal(sample, ['tp', 'target_pressure']));
      const targetFlow = toNumberOrNull(getVal(sample, ['tf', 'target_flow']));
      const targetTemp = toNumberOrNull(getVal(sample, ['tt', 'tr', 'target_temperature']));

      // Populate series
      if (pressure !== null) series.pressure.push({ x: t, y: pressure });
      if (flow !== null) series.flow.push({ x: t, y: flow });
      if (puckFlow !== null) series.puckFlow.push({ x: t, y: puckFlow });
      if (temp !== null) series.temp.push({ x: t, y: temp });
      if (weight !== null && weight >= 0) series.weight.push({ x: t, y: weight });
      if (weightFlow !== null) series.weightFlow.push({ x: t, y: Math.max(0, weightFlow) });

      if (targetPressure !== null) {
        series.targetPressure.push({ x: t, y: Math.min(targetPressure, TARGET_PRESSURE_MAX) });
      }
      if (targetFlow !== null) {
        series.targetFlow.push({ x: t, y: Math.min(targetFlow, TARGET_FLOW_MAX) });
      }
      if (targetTemp !== null) series.targetTemp.push({ x: t, y: targetTemp });
    });

    const hasWeight = series.weight.some(pt => pt.y > 0);

    // Main-axis range is intentionally derived only from pressure/flow family.
    const mainAxisSamples = [
      ...series.pressure,
      ...series.targetPressure,
      ...series.flow,
      ...series.puckFlow,
      ...series.targetFlow,
      ...series.weightFlow,
    ];
    const mainAxisMaxRaw = safeMax(mainAxisSamples.map(p => p.y), 1);
    const mainAxisMax = Math.max(1, mainAxisMaxRaw * 1.02);

    const weightAxisMaxRaw = safeMax(series.weight.map(p => p.y), 1);
    // Keep weight always visible while keeping headroom minimal like the main axis.
    const weightAxisMax = Math.max(1, weightAxisMaxRaw * 1.02);

    const tempAxisSamples = [...series.temp, ...series.targetTemp];
    const tempMinRaw = safeMin(tempAxisSamples.map(p => p.y), 80);
    const tempMaxRaw = safeMax(tempAxisSamples.map(p => p.y), 100);
    const tempRange = Math.max(0.5, tempMaxRaw - tempMinRaw);
    const tempTopPadding = Math.max(0.15, tempRange * 0.02);
    const tempBottomPadding = Math.max(0.25, tempRange * 0.07);
    const tempAxisMin = tempMinRaw - tempBottomPadding;
    const tempAxisMax = tempMaxRaw + tempTopPadding;


    // --- Phase Annotation Logic ---
    const phaseAnnotations = {};
    if (shotData.phaseTransitions && shotData.phaseTransitions.length > 0) {
      if (samples.length > 0) {
        const shotStartTime = (samples[0].t || 0) / 1000;
        phaseAnnotations.shot_start = {
          type: 'line',
          scaleID: 'x',
          value: shotStartTime,
          borderColor: COLORS.phaseLine,
          borderWidth: 1,
          label: {
            display: visibility.phaseNames,
            content: getPhaseName(shotData, 0),
            rotation: -90,
            position: 'start',
            yAdjust: 0,
            xAdjust: 12,
            color: 'rgba(255, 255, 255, 0.95)',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            borderRadius: 3,
            padding: 4,
            font: { size: 9 },
          },
        };
      }

      shotData.phaseTransitions.forEach((transition, index) => {
        let timeInSeconds = 0;
        if (transition.sampleIndex !== undefined && samples[transition.sampleIndex]) {
          timeInSeconds = (samples[transition.sampleIndex].t || 0) / 1000;
        } else if (transition.sampleIndex !== undefined) {
          timeInSeconds = (transition.sampleIndex * (shotData.sampleInterval || 250)) / 1000;
        }

        if (timeInSeconds <= 0.1 && index === 0) return;

        phaseAnnotations[`phase_line_${index}`] = {
          type: 'line',
          scaleID: 'x',
          value: timeInSeconds,
          borderColor: COLORS.phaseLine,
          borderWidth: 1,
          label: {
            display: visibility.phaseNames,
            content: transition.phaseName || `P${transition.phaseNumber + 1}`,
            rotation: -90,
            position: 'start',
            yAdjust: 0,
            xAdjust: 12,
            color: 'rgba(255, 255, 255, 0.95)',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            borderRadius: 3,
            padding: 4,
            font: { size: 9 },
          },
        };

        if (results && results.phases && index > 0) {
          const previousPhaseNumber = shotData.phaseTransitions[index - 1].phaseNumber;
          const endedPhase = results.phases.find(
            p => String(p.number) === String(previousPhaseNumber),
          );

          if (endedPhase && endedPhase.exit && endedPhase.exit.reason) {
            phaseAnnotations[`phase_exit_${index}`] = {
              type: 'line',
              scaleID: 'x',
              value: timeInSeconds,
              borderColor: 'transparent',
              borderWidth: 0,
              label: {
                display: visibility.stops,
                content: endedPhase.exit.reason.toUpperCase(),
                rotation: -90,
                position: 'start',
                yAdjust: 0,
                xAdjust: -12,
                color: 'rgba(255, 255, 255, 0.95)',
                backgroundColor: COLORS.stopLabel,
                borderRadius: 3,
                padding: 4,
                font: { size: 8, weight: 'bold' },
              },
            };
          }
        }
      });

      if (results && results.phases && results.phases.length > 0 && maxTime > 0) {
        const lastPhase = results.phases[results.phases.length - 1];
        if (lastPhase.exit && lastPhase.exit.reason) {
          let finalStopTime = maxTime;
          const isFinalWeightStop =
            lastPhase.exit.type === 'weight' || lastPhase.exit.type === 'volumetric';
          if (isFinalWeightStop) {
            const lastNonExtendedSample = samples.findLast(
              s => !s.systemInfo?.extendedRecording,
            );
            if (lastNonExtendedSample) {
              finalStopTime = (lastNonExtendedSample.t || 0) / 1000;
            }
          }

          phaseAnnotations.shot_end = {
            type: 'line',
            scaleID: 'x',
            value: finalStopTime,
            borderColor: COLORS.phaseLine,
            borderWidth: 1,
            label: {
              display: visibility.stops,
              content:
                lastPhase.exit.type === 'weight' || lastPhase.exit.type === 'volumetric'
                  ? 'WEIGHT STOP TRIGGERED'
                  : lastPhase.exit.reason.toUpperCase(),
              rotation: -90,
              position: 'start',
              yAdjust: 0,
              xAdjust: -12,
              color: 'rgba(255, 255, 255, 0.95)',
              backgroundColor: COLORS.stopLabel,
              borderRadius: 3,
              padding: 4,
              font: { size: 8, weight: 'bold' },
            },
          };
        }
      }
    }

    if (results && maxTime > 0) {
      phaseAnnotations.brew_mode = {
        type: 'line',
        scaleID: 'x',
        value: maxTime,
        borderColor: 'transparent',
        borderWidth: 0,
        label: {
          display: true,
          content: brewModeLabel,
          rotation: -90,
          position: 'start',
          yAdjust: 0,
          xAdjust: 1,
          color: brewModeLabelTextColor,
          backgroundColor: brewModeColor,
          borderColor: brewModeBorderColor,
          borderWidth: 1,
          borderRadius: 3,
          padding: 4,
          font: { size: 9, weight: 'bold' },
        },
      };
    }

    // Temp chart should only mirror the phase separator lines, without any labels.
    const tempPhaseAnnotations = Object.entries(phaseAnnotations).reduce((acc, [key, annotation]) => {
      const isPhaseSeparator =
        key === 'shot_start' || key === 'shot_end' || key.startsWith('phase_line_');
      if (!isPhaseSeparator) return acc;

      acc[key] = {
        ...annotation,
        label: { display: false },
      };
      return acc;
    }, {});

    const getHoverWaterValuesAtX = xValue => {
      if (!Number.isFinite(xValue) || sampleTimesSec.length === 0) {
        return { totalWaterMl: null, phaseWaterMl: null };
      }

      const sampleIndex = findLastSampleIndexAtOrBeforeX(sampleTimesSec, xValue);
      const totalWaterMl = sampleIndex >= 0 ? (cumulativeWaterTotalBySample[sampleIndex] ?? 0) : 0;

      let activePhase = null;
      for (let i = phaseHoverRanges.length - 1; i >= 0; i--) {
        const phaseRange = phaseHoverRanges[i];
        if (xValue >= phaseRange.startAbs && xValue <= phaseRange.endAbs) {
          activePhase = phaseRange;
          break;
        }
      }

      const phaseWaterMl = activePhase
        ? Math.max(0, totalWaterMl - (activePhase.startCumWater ?? 0))
        : null;

      return { totalWaterMl, phaseWaterMl };
    };

    // Hidden overlay series let the shared main tooltip expose water values without drawing extra visible lines.
    const waterTooltipPhaseSeries = sampleTimesSec.map(x => {
      const { phaseWaterMl } = getHoverWaterValuesAtX(x);
      return { x, y: Number.isFinite(phaseWaterMl) ? phaseWaterMl : 0 };
    });
    const waterTooltipTotalSeries = sampleTimesSec.map((x, index) => ({
      x,
      y: Number.isFinite(cumulativeWaterTotalBySample[index]) ? cumulativeWaterTotalBySample[index] : 0,
    }));
    const chartTooltipColorByLabel = getTooltipColorByLabel(COLORS);
    const hideExternalTooltip = () => {
      setExternalTooltipState(prev => {
        const hiddenState = createHiddenExternalTooltipState();
        return areTooltipStatesEqual(prev, hiddenState) ? prev : hiddenState;
      });
    };
    const updateExternalTooltip = ({ chart, tooltip }) => {
      const nextState = buildExternalTooltipState({
        chart,
        tooltip,
        getHoverWaterValuesAtX,
        tooltipColorByLabel: chartTooltipColorByLabel,
      });

      if (!nextState.visible) {
        hideExternalTooltip();
        return;
      }

      setExternalTooltipState(prev => (areTooltipStatesEqual(prev, nextState) ? prev : nextState));
    };

    // Main chart datasets:
    // temp/target-temp datasets are tooltip-only proxies on a hidden axis.
    const mainDatasets = [
      {
        label: 'Phase Names',
        data: [],
        borderColor: COLORS.phaseLine,
        backgroundColor: COLORS.phaseLine,
        yAxisID: 'yMain',
        pointRadius: 0,
        borderWidth: STANDARD_LINE_WIDTH,
        hidden: !visibility.phaseNames,
      },
      {
        label: 'Stops',
        data: [],
        borderColor: COLORS.stopLabel,
        backgroundColor: COLORS.stopLabel,
        yAxisID: 'yMain',
        pointRadius: 0,
        borderWidth: STANDARD_LINE_WIDTH,
        hidden: !visibility.stops,
      },
      {
        label: 'Temp',
        data: series.temp,
        borderColor: COLORS.temp,
        backgroundColor: COLORS.temp,
        yAxisID: 'yTempOverlay',
        pointRadius: 0,
        pointHoverRadius: 0,
        pointHitRadius: 12,
        borderWidth: 0,
        fill: false,
        hidden: !visibility.temp,
      },
      {
        label: 'Target T',
        data: series.targetTemp,
        borderColor: COLORS.tempTarget,
        backgroundColor: COLORS.tempTarget,
        borderDash: [4, 4],
        yAxisID: 'yTempOverlay',
        pointRadius: 0,
        pointHoverRadius: 0,
        pointHitRadius: 12,
        borderWidth: 0,
        fill: false,
        hidden: !visibility.targetTemp,
      },
      {
        label: 'Pressure',
        data: series.pressure,
        borderColor: COLORS.pressure,
        backgroundColor: COLORS.pressure,
        yAxisID: 'yMain',
        pointRadius: 0,
        borderWidth: STANDARD_LINE_WIDTH,
        tension: 0.2,
        hidden: !visibility.pressure,
      },
      {
        label: 'Target P',
        data: series.targetPressure,
        borderColor: COLORS.pressure,
        backgroundColor: targetPressureFill,
        fill: 'origin',
        borderDash: [4, 4],
        yAxisID: 'yMain',
        pointRadius: 0,
        borderWidth: THIN_LINE_WIDTH,
        tension: 0,
        hidden: !visibility.targetPressure,
      },
      {
        label: 'Flow',
        data: series.flow,
        borderColor: COLORS.flow,
        backgroundColor: COLORS.flow,
        yAxisID: 'yMain',
        pointRadius: 0,
        borderWidth: STANDARD_LINE_WIDTH,
        tension: 0.2,
        hidden: !visibility.flow,
      },
      {
        label: 'Target F',
        data: series.targetFlow,
        borderColor: COLORS.flow,
        backgroundColor: targetFlowFill,
        fill: 'origin',
        borderDash: [4, 4],
        yAxisID: 'yMain',
        pointRadius: 0,
        borderWidth: THIN_LINE_WIDTH,
        tension: 0,
        hidden: !visibility.targetFlow,
      },
      {
        label: 'Puck Flow',
        data: series.puckFlow,
        borderColor: COLORS.puckFlow,
        backgroundColor: COLORS.puckFlow,
        fill: false,
        yAxisID: 'yMain',
        pointRadius: 0,
        borderWidth: THIN_LINE_WIDTH,
        tension: 0.2,
        hidden: !visibility.puckFlow,
      },
      {
        label: 'Weight',
        data: series.weight,
        borderColor: COLORS.weight,
        backgroundColor: 'rgba(139, 92, 246, 0.08)',
        fill: 'origin',
        yAxisID: 'yWeight',
        pointRadius: 0,
        borderWidth: THIN_LINE_WIDTH,
        tension: 0.2,
        hidden: !hasWeight || !visibility.weight,
      },
      {
        label: 'Weight Flow',
        data: series.weightFlow,
        borderColor: COLORS.weightFlow,
        backgroundColor: COLORS.weightFlow,
        fill: false,
        yAxisID: 'yMain',
        pointRadius: 0,
        borderWidth: THIN_LINE_WIDTH,
        tension: 0.2,
        hidden: !hasWeightFlowData || !visibility.weightFlow,
      },
      {
        label: WATER_DRAWN_PHASE_LABEL,
        data: waterTooltipPhaseSeries,
        borderColor: COLORS.puckFlow,
        backgroundColor: COLORS.puckFlow,
        yAxisID: 'yWaterOverlay',
        pointRadius: 0,
        pointHoverRadius: 0,
        pointHitRadius: 12,
        borderWidth: 0,
        showLine: false,
        fill: false,
      },
      {
        label: WATER_DRAWN_TOTAL_LABEL,
        data: waterTooltipTotalSeries,
        borderColor: COLORS.flow,
        backgroundColor: COLORS.flow,
        yAxisID: 'yWaterOverlay',
        pointRadius: 0,
        pointHoverRadius: 0,
        pointHitRadius: 12,
        borderWidth: 0,
        showLine: false,
        fill: false,
      },
    ];
    try {
      mainChartInstance.current = new Chart(mainChartRef.current, {
        type: 'line',
        data: { datasets: mainDatasets },
        plugins: [hoverGuidePlugin, replayRevealPlugin],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          elements: {
            point: {
              radius: 0,
              hoverRadius: 4,
              hitRadius: 12,
              borderWidth: 0,
              hoverBorderWidth: 0,
              backgroundColor: resolveHoverPointColor,
              hoverBackgroundColor: resolveHoverPointColor,
              borderColor: resolveHoverPointColor,
              hoverBorderColor: resolveHoverPointColor,
            },
          },
          interaction: {
            mode: 'index',
            intersect: false,
          },
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              enabled: false,
              caretSize: 0,
              caretPadding: 0,
              filter: context => shouldRenderTooltipLabel(context.dataset.label),
              itemSort: sortTooltipItems,
              external: updateExternalTooltip,
            },
            annotation: {
              annotations: phaseAnnotations,
            },
          },
          scales: {
            y: {
              display: false,
              grid: { display: false },
              ticks: { display: false },
            },
            x: {
              type: 'linear',
              display: false,
              max: maxTime,
              ticks: { display: false },
              grid: { display: false },
            },
            yMain: {
              type: 'linear',
              position: 'left',
              min: 0,
              max: mainAxisMax,
              ticks: {
                font: { size: 10 },
                color: COLORS.pressure,
                callback: formatAxisTick,
              },
              grid: {
                color: 'rgba(200, 200, 200, 0.1)',
              },
            },
            yTempOverlay: {
              type: 'linear',
              display: false,
              min: tempAxisMin,
              max: tempAxisMax,
              grid: { display: false },
              ticks: { display: false },
            },
            yWaterOverlay: {
              type: 'linear',
              display: false,
              beginAtZero: true,
              grid: { display: false },
              ticks: { display: false },
            },
            yWeight: {
              type: 'linear',
              display: true,
              position: 'right',
              offset: false,
              beginAtZero: true,
              min: 0,
              max: weightAxisMax,
              ticks: {
                font: { size: 10 },
                color: COLORS.weight,
                callback: formatAxisTick,
              },
              grid: { display: false },
            },
          },
        },
      });
    } catch (e) {
      console.error('Main chart creation failed:', e);
    }

    const tempDatasets = [
      {
        label: 'Temp',
        data: series.temp,
        borderColor: COLORS.temp,
        backgroundColor: tempToTargetFill,
        fill: visibility.targetTemp ? '+1' : false,
        yAxisID: 'yTemp',
        pointRadius: 0,
        borderWidth: STANDARD_LINE_WIDTH,
        tension: 0.2,
        hidden: !visibility.temp,
      },
      {
        label: 'Target T',
        data: series.targetTemp,
        borderColor: COLORS.tempTarget,
        backgroundColor: COLORS.tempTarget,
        borderDash: [4, 4],
        yAxisID: 'yTempRight',
        pointRadius: 0,
        borderWidth: THIN_LINE_WIDTH,
        tension: 0,
        hidden: !visibility.targetTemp,
      },
    ];
    try {
      tempChartInstance.current = new Chart(tempChartRef.current, {
        type: 'line',
        data: { datasets: tempDatasets },
        plugins: [hoverGuidePlugin, replayRevealPlugin],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          layout: {
            padding: { left: 0, right: 0, top: 0, bottom: 0 },
          },
          elements: {
            point: {
              radius: 0,
              hoverRadius: 4,
              hitRadius: 12,
              borderWidth: 0,
              hoverBorderWidth: 0,
              backgroundColor: resolveHoverPointColor,
              hoverBackgroundColor: resolveHoverPointColor,
              borderColor: resolveHoverPointColor,
              hoverBorderColor: resolveHoverPointColor,
            },
          },
          interaction: {
            mode: 'index',
            intersect: false,
          },
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              enabled: false,
            },
            annotation: {
              annotations: tempPhaseAnnotations,
            },
          },
          scales: {
            x: {
              type: 'linear',
              position: 'top',
              max: maxTime,
              ticks: {
                font: { size: 10 },
                color: '#888',
                callback: formatAxisTick,
                padding: 4,
              },
              grid: {
                display: false,
                drawOnChartArea: false,
              },
              border: {
                display: true,
                color: 'rgba(200, 200, 200, 0.18)',
              },
            },
            yTemp: {
              type: 'linear',
              position: 'left',
              min: tempAxisMin,
              max: tempAxisMax,
              ticks: {
                font: { size: 10 },
                color: COLORS.temp,
                callback: formatAxisTick,
              },
              grid: {
                color: 'rgba(200, 200, 200, 0.1)',
              },
            },
            yTempRight: {
              type: 'linear',
              position: 'right',
              min: tempAxisMin,
              max: tempAxisMax,
              ticks: {
                display: true,
                font: { size: 10 },
                color: COLORS.tempTarget,
                callback: formatAxisTick,
              },
              grid: { display: false },
            },
          },
        },
      });
    } catch (e) {
      console.error('Temp chart creation failed:', e);
    }

    const syncTempPlotArea = () => {
      // The temperature chart must mirror the main chart's inner plot width so the shared x-position lines up exactly.
      const mainChart = mainChartInstance.current;
      const tempChart = tempChartInstance.current;
      if (!mainChart || !tempChart || !mainChart.chartArea || !tempChart.chartArea) return;

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

    // Two quick passes help settle chartArea measurements after initial layout.
    const syncTempPlotAreaTwice = () => {
      syncTempPlotArea();
      syncTempPlotArea();
    };
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(syncTempPlotAreaTwice);
    } else {
      syncTempPlotAreaTwice();
    }

    const handleResizeSync = () => {
      if (typeof window !== 'undefined') {
        window.requestAnimationFrame(syncTempPlotAreaTwice);
      } else {
        syncTempPlotAreaTwice();
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResizeSync);
    }

    const clearTooltipState = chart => {
      if (!chart) return;
      chart.$fixedTooltipPointerY = null;
      chart.setActiveElements([]);
      chart.tooltip?.setActiveElements([], { x: 0, y: 0 });
      chart.update('none');
    };

    const findClosestPointIndex = (datasetData, xValue) => {
      if (!Array.isArray(datasetData) || datasetData.length === 0) return -1;
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
    };

    const buildActiveElementsForX = (chart, xValue) => {
      const active = [];
      chart.data.datasets.forEach((dataset, datasetIndex) => {
        const meta = chart.getDatasetMeta(datasetIndex);
        if (!meta || meta.hidden || dataset.hidden) return;
        const index = findClosestPointIndex(dataset.data, xValue);
        if (index >= 0) active.push({ datasetIndex, index });
      });
      return active;
    };

    const applyHoverForChart = (chart, xValue, pointerClientY, showTooltip = true) => {
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
    };

    const clearAllHover = () => {
      clearTooltipState(mainChartInstance.current);
      clearTooltipState(tempChartInstance.current);
      hideExternalTooltip();
    };
    clearAllHoverRef.current = clearAllHover;

    const extractClientPoint = event => {
      if (!event) return null;
      if (Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
        return { clientX: event.clientX, clientY: event.clientY };
      }
      const touch = event.touches?.[0] || event.changedTouches?.[0];
      if (touch && Number.isFinite(touch.clientX) && Number.isFinite(touch.clientY)) {
        return { clientX: touch.clientX, clientY: touch.clientY };
      }
      return null;
    };

    const applyUnifiedHoverFromClientPoint = (clientX, clientY) => {
      // One hover surface spans both canvases so the guide line and tooltip stay synchronized across charts.
      if (isReplayingRef.current) {
        clearAllHover();
        return;
      }
      if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;
      const mainChart = mainChartInstance.current;
      const tempChart = tempChartInstance.current;
      const hoverArea = hoverAreaRef.current;
      if (!mainChart || !tempChart || !hoverArea) return;

      const mainXScale = mainChart.scales?.x;
      if (!mainXScale || !mainChart.canvas) return;

      const areaRect = hoverArea.getBoundingClientRect();
      const verticalTolerance = 20;
      const withinVerticalTolerance =
        clientY >= areaRect.top - verticalTolerance &&
        clientY <= areaRect.bottom + verticalTolerance;
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
        clearAllHover();
        return;
      }
      const point = extractClientPoint(event);
      if (!point) return;
      applyUnifiedHoverFromClientPoint(point.clientX, point.clientY);
    };

    const buildAnnotationReplayMeta = annotations => {
      return Object.entries(annotations || {}).reduce((acc, [key, annotation]) => {
        const time = Number(annotation?.value);
        if (!Number.isFinite(time)) return acc;
        acc.push({
          key,
          time,
          baseDisplay: annotation?.display !== false,
        });
        return acc;
      }, []);
    };

    // Cache replay timing metadata once per chart build so the animation loop can stay lightweight.
    replayRuntimeRef.current = {
      sampleTimesSec: [...sampleTimesSec],
      shotStartSec,
      maxTime,
      mainAnnotationMeta: buildAnnotationReplayMeta(phaseAnnotations),
      tempAnnotationMeta: buildAnnotationReplayMeta(tempPhaseAnnotations),
    };

    const hoverArea = hoverAreaRef.current;
    const supportsPointerEvents = typeof window !== 'undefined' && Boolean(window.PointerEvent);
    if (supportsPointerEvents) {
      hoverArea?.addEventListener('pointerdown', handleUnifiedMove, { passive: true });
      hoverArea?.addEventListener('pointermove', handleUnifiedMove, { passive: true });
      hoverArea?.addEventListener('pointerup', clearAllHover);
      hoverArea?.addEventListener('pointerleave', clearAllHover);
      hoverArea?.addEventListener('pointercancel', clearAllHover);
    } else {
      hoverArea?.addEventListener('mousemove', handleUnifiedMove);
      hoverArea?.addEventListener('mouseleave', clearAllHover);
      hoverArea?.addEventListener('touchstart', handleUnifiedMove, { passive: true });
      hoverArea?.addEventListener('touchmove', handleUnifiedMove, { passive: true });
      hoverArea?.addEventListener('touchend', clearAllHover);
      hoverArea?.addEventListener('touchcancel', clearAllHover);
    }

    return () => {
      exportAbortControllerRef.current?.abort();
      stopReplayAnimation(true);
      clearAllHoverRef.current = () => {};
      replayRuntimeRef.current = null;
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleResizeSync);
      }
      if (supportsPointerEvents) {
        hoverArea?.removeEventListener('pointerdown', handleUnifiedMove);
        hoverArea?.removeEventListener('pointermove', handleUnifiedMove);
        hoverArea?.removeEventListener('pointerup', clearAllHover);
        hoverArea?.removeEventListener('pointerleave', clearAllHover);
        hoverArea?.removeEventListener('pointercancel', clearAllHover);
      } else {
        hoverArea?.removeEventListener('mousemove', handleUnifiedMove);
        hoverArea?.removeEventListener('mouseleave', clearAllHover);
        hoverArea?.removeEventListener('touchstart', handleUnifiedMove);
        hoverArea?.removeEventListener('touchmove', handleUnifiedMove);
        hoverArea?.removeEventListener('touchend', clearAllHover);
        hoverArea?.removeEventListener('touchcancel', clearAllHover);
      }
      destroyCharts();
    };
  }, [shotData, results, visibility]);

  // Render nothing if no data
  if (!shotData || !shotData.samples || shotData.samples.length === 0) {
    return null;
  }

  return (
    <div className='w-full select-none'>
      <ShotChartControls
        exportMenuRef={exportMenuRef}
        exportMenuState={exportMenuState}
        hasWeightData={hasWeightData}
        hasWeightFlowData={hasWeightFlowData}
        isControlsLocked={isControlsLocked}
        isReplayPaused={isReplayPaused}
        isReplaying={isReplaying}
        isReplayExporting={isReplayExporting}
        isVideoExportActive={isVideoExportActive}
        legendColorByLabel={legendColorByLabel}
        mainChartHeight={mainChartHeight}
        onChartHeightToggle={() => setMainChartHeight(current => getNextChartHeight(current))}
        onCloseExportMenu={closeExportMenu}
        onExportAction={handleExportAction}
        onExportMenuToggle={toggleExportMenu}
        onExportTypeChange={handleExportTypeChange}
        onIncludeLegendChange={handleIncludeLegendChange}
        onLegendToggle={handleLegendToggle}
        onReplayToggle={handleReplayClick}
        onStop={stopReplayAndRestoreChart}
        replayExportStatus={replayExportStatus}
        replayExportStatusLabel={replayExportStatusLabel}
        shouldShowReplayFocusHint={shouldShowReplayFocusHint}
        visibility={visibility}
      />

      <div ref={hoverAreaRef} className='w-full'>
        <div ref={mainChartContainerRef} className='relative w-full' style={{ height: `${mainChartHeight}px` }}>
          <canvas ref={mainChartRef} />
          <ShotChartExternalTooltip
            tooltipRef={externalTooltipRef}
            state={externalTooltipState}
            layout={externalTooltipLayout}
          />
        </div>
        <div
          className='relative mt-0 w-full'
          style={{ height: `${Math.round(mainChartHeight * TEMP_CHART_HEIGHT_RATIO)}px` }}
        >
          <canvas ref={tempChartRef} />
        </div>
      </div>
    </div>
  );
}
