/**
 * useShotChartReplayExport.js
 *
 * Owns the replay and export state machine for ShotChart. The hook keeps the
 * imperative frame loop and export session lifecycle out of ShotChart.jsx so
 * the component can stay focused on chart orchestration and rendering.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import { downloadBlob, downloadJson } from '../../../../utils/download';
import {
  exportReplayImage,
  exportReplayVideo,
  getVideoExportCapabilities,
} from '../../services/ReplayVideoExportService';
import { libraryService } from '../../services/LibraryService';
import {
  DEFAULT_REPLAY_EXPORT_CONFIG,
  getReplayExportStatusHint,
  getReplayExportStatusLabel,
  REPLAY_FRAME_INTERVAL_MS,
} from './constants';
import {
  buildReplayExportFilename,
  buildReplayImageFilename,
  getVisibleLegendItemsForExport,
} from './helpers';

export function useShotChartReplayExport({
  shotData,
  exportMenuRef,
  chartRefs,
  legendColorByLabel,
  visibility,
  hasWeightData,
  hasWeightFlowData,
}) {
  const replayRafRef = useRef(null);
  const replayStartPerfMsRef = useRef(0);
  const replayElapsedOffsetSecRef = useRef(0);
  const replayLastAppliedFrameRef = useRef(-1);
  const replayRuntimeRef = useRef(null);
  const clearAllHoverRef = useRef(() => {});
  const chartInteractionStateRef = useRef({
    disabled: false,
    mainEvents: undefined,
    tempEvents: undefined,
    hoverAreaPointerEvents: '',
  });
  const isReplayingRef = useRef(false);
  const isExportingRef = useRef(false);
  const activeExportTypeRef = useRef(null);
  const exportAbortControllerRef = useRef(null);
  const isMountedRef = useRef(true);

  const [isReplaying, setIsReplaying] = useState(false);
  const [isReplayPaused, setIsReplayPaused] = useState(false);
  const [exportMenuState, setExportMenuState] = useState({
    open: false,
    exportType: DEFAULT_REPLAY_EXPORT_CONFIG.exportType,
    exportFormat: DEFAULT_REPLAY_EXPORT_CONFIG.exportFormat,
    includeLegend: DEFAULT_REPLAY_EXPORT_CONFIG.includeLegend,
    showFormatInfo: false,
  });
  const [isReplayExporting, setIsReplayExporting] = useState(false);
  const [replayExportStatus, setReplayExportStatus] = useState({ status: 'idle', error: null });

  // Capability detection lives here so the UI and export handlers resolve the same
  // effective format instead of duplicating browser-specific decisions in multiple places.
  const videoExportCapabilities = getVideoExportCapabilities();
  const hasVideoExportSupport =
    videoExportCapabilities.canRecordMp4 || videoExportCapabilities.canRecordWebm;
  const shouldForceWebmExport =
    !videoExportCapabilities.canRecordMp4 && !videoExportCapabilities.shouldHideWebmOption;
  const effectiveVideoExportFormat = !hasVideoExportSupport
    ? null
    : shouldForceWebmExport
      ? 'webm'
      : exportMenuState.exportFormat === 'webm' && !videoExportCapabilities.shouldHideWebmOption
        ? 'webm'
        : 'mp4';
  const activeExportType = activeExportTypeRef.current;
  const isVideoExportActive =
    hasVideoExportSupport && isReplayExporting && activeExportType === 'video';
  const isControlsLocked = isReplayExporting;
  const shouldShowReplayFocusHint =
    isVideoExportActive &&
    (replayExportStatus.status === 'preparing' || replayExportStatus.status === 'recording');
  const replayExportStatusLabel = replayExportStatus.error
    ? replayExportStatus.error
    : getReplayExportStatusLabel(replayExportStatus.status, effectiveVideoExportFormat || 'mp4');
  const replayExportStatusHint = getReplayExportStatusHint(replayExportStatus.status);

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

  const getMainChart = () => chartRefs.mainChartInstance.current;
  const getTempChart = () => chartRefs.tempChartInstance.current;
  const getHoverArea = () => chartRefs.hoverAreaRef.current;

  const restoreFullReplayVisuals = () => {
    const runtime = replayRuntimeRef.current;
    const mainChart = getMainChart();
    const tempChart = getTempChart();
    if (!runtime || !mainChart || !tempChart) return;

    // Replay swaps datasets over to incremental active arrays. Restoring the
    // original dataset references is the fastest path back to the static chart.
    runtime.mainReplayDatasets?.forEach((datasetMeta, datasetIndex) => {
      if (!datasetMeta || !mainChart.data.datasets[datasetIndex]) return;
      mainChart.data.datasets[datasetIndex].data = datasetMeta.fullData;
      datasetMeta.activeData.length = 0;
    });

    runtime.tempReplayDatasets?.forEach((datasetMeta, datasetIndex) => {
      if (!datasetMeta || !tempChart.data.datasets[datasetIndex]) return;
      tempChart.data.datasets[datasetIndex].data = datasetMeta.fullData;
      datasetMeta.activeData.length = 0;
    });

    const mainAnnotations = mainChart.options?.plugins?.annotation?.annotations || {};
    for (const meta of runtime.mainAnnotationMeta || []) {
      const annotation = mainAnnotations[meta.key];
      if (annotation) annotation.display = meta.baseDisplay;
    }

    const tempAnnotations = tempChart.options?.plugins?.annotation?.annotations || {};
    for (const meta of runtime.tempAnnotationMeta || []) {
      const annotation = tempAnnotations[meta.key];
      if (annotation) annotation.display = meta.baseDisplay;
    }

    mainChart.update('none');
    tempChart.update('none');
  };

  const stopReplayAnimation = (clearHover = false) => {
    // A full stop always resets both the animation loop and the replay-only dataset state.
    // That guarantees replay restarts from a known clean baseline.
    if (typeof window !== 'undefined' && replayRafRef.current !== null) {
      window.cancelAnimationFrame(replayRafRef.current);
    }
    replayRafRef.current = null;
    replayStartPerfMsRef.current = 0;
    replayElapsedOffsetSecRef.current = 0;
    replayLastAppliedFrameRef.current = -1;
    isReplayingRef.current = false;
    setIsReplaying(false);
    setIsReplayPaused(false);
    if (clearHover) clearAllHoverRef.current?.();

    const mainChart = getMainChart();
    const tempChart = getTempChart();
    if (mainChart) {
      mainChart.$replayRevealEnabled = false;
      mainChart.$replayRevealX = null;
      mainChart.$replayRevealClipActive = false;
    }
    if (tempChart) {
      tempChart.$replayRevealEnabled = false;
      tempChart.$replayRevealX = null;
      tempChart.$replayRevealClipActive = false;
    }

    restoreFullReplayVisuals();
  };

  const applyReplayFrame = (frameIndex, options = {}) => {
    const runtime = replayRuntimeRef.current;
    const mainChart = getMainChart();
    const tempChart = getTempChart();
    if (!runtime || !mainChart || !tempChart) return;

    // Replay datasets are prepared as per-frame chunks ahead of time. At runtime the
    // frame loop only appends the next chunk, which keeps live replay cheap enough
    // while still performing a real Chart.js re-render.
    const appendReplayChunk = (activeData, frameChunk) => {
      if (!Array.isArray(frameChunk) || frameChunk.length === 0) return;
      for (const point of frameChunk) {
        if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
        const lastPoint = activeData[activeData.length - 1];
        if (lastPoint && lastPoint.x === point.x && lastPoint.y === point.y) continue;
        activeData.push(point);
      }
    };

    const clampedFrameIndex = Math.max(-1, Math.min(runtime.frameCount, frameIndex));
    const shouldReset =
      options.forceReset === true || clampedFrameIndex < replayLastAppliedFrameRef.current;
    const startFrame = shouldReset ? 0 : replayLastAppliedFrameRef.current + 1;

    runtime.mainReplayDatasets?.forEach((datasetMeta, datasetIndex) => {
      const dataset = mainChart.data.datasets[datasetIndex];
      if (!dataset || !datasetMeta) return;
      if (shouldReset) {
        datasetMeta.activeData.length = 0;
        dataset.data = datasetMeta.activeData;
      } else if (dataset.data !== datasetMeta.activeData) {
        dataset.data = datasetMeta.activeData;
      }

      for (let currentFrame = startFrame; currentFrame <= clampedFrameIndex; currentFrame++) {
        appendReplayChunk(datasetMeta.activeData, datasetMeta.frameChunks[currentFrame]);
      }
    });

    runtime.tempReplayDatasets?.forEach((datasetMeta, datasetIndex) => {
      const dataset = tempChart.data.datasets[datasetIndex];
      if (!dataset || !datasetMeta) return;
      if (shouldReset) {
        datasetMeta.activeData.length = 0;
        dataset.data = datasetMeta.activeData;
      } else if (dataset.data !== datasetMeta.activeData) {
        dataset.data = datasetMeta.activeData;
      }

      for (let currentFrame = startFrame; currentFrame <= clampedFrameIndex; currentFrame++) {
        appendReplayChunk(datasetMeta.activeData, datasetMeta.frameChunks[currentFrame]);
      }
    });

    const mainAnnotations = mainChart.options?.plugins?.annotation?.annotations || {};
    for (const meta of runtime.mainAnnotationMeta || []) {
      const annotation = mainAnnotations[meta.key];
      if (!annotation) continue;
      annotation.display = meta.baseDisplay && clampedFrameIndex >= meta.frameIndex;
    }

    const tempAnnotations = tempChart.options?.plugins?.annotation?.annotations || {};
    for (const meta of runtime.tempAnnotationMeta || []) {
      const annotation = tempAnnotations[meta.key];
      if (!annotation) continue;
      annotation.display = meta.baseDisplay && clampedFrameIndex >= meta.frameIndex;
    }

    replayLastAppliedFrameRef.current = clampedFrameIndex;
    mainChart.update('none');
    tempChart.update('none');
  };

  const applyReplayCutoff = (cutoffX, options = {}) => {
    const runtime = replayRuntimeRef.current;
    const mainChart = getMainChart();
    const tempChart = getTempChart();
    if (!runtime || !mainChart || !tempChart) return;

    const revealAll = options.revealAll === true || !Number.isFinite(cutoffX);
    const effectiveCutoffX = revealAll ? runtime.maxTime : cutoffX;

    // Export still uses reveal clipping because it can reuse the fully rendered
    // charts without mutating the replay dataset state mid-session.
    mainChart.$replayRevealEnabled = !revealAll;
    mainChart.$replayRevealX = !revealAll ? effectiveCutoffX : null;
    tempChart.$replayRevealEnabled = !revealAll;
    tempChart.$replayRevealX = !revealAll ? effectiveCutoffX : null;

    const mainAnnotations = mainChart.options?.plugins?.annotation?.annotations || {};
    for (const meta of runtime.mainAnnotationMeta || []) {
      const annotation = mainAnnotations[meta.key];
      if (!annotation) continue;
      annotation.display = meta.baseDisplay && (revealAll || effectiveCutoffX >= meta.time);
    }

    const tempAnnotations = tempChart.options?.plugins?.annotation?.annotations || {};
    for (const meta of runtime.tempAnnotationMeta || []) {
      const annotation = tempAnnotations[meta.key];
      if (!annotation) continue;
      annotation.display = meta.baseDisplay && (revealAll || effectiveCutoffX >= meta.time);
    }

    mainChart.update('none');
    tempChart.update('none');
  };

  const getNowMs = () =>
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();

  const scheduleReplayFrame = frameHandler => {
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      return false;
    }
    replayRafRef.current = window.requestAnimationFrame(frameHandler);
    return true;
  };

  const startReplayLoop = () => {
    const frame = nowMs => {
      if (!isReplayingRef.current) return;
      const runtime = replayRuntimeRef.current;
      if (!runtime) {
        stopReplayAnimation();
        return;
      }

      const elapsedSec = Math.max(
        0,
        replayElapsedOffsetSecRef.current + (nowMs - replayStartPerfMsRef.current) / 1000,
      );
      const clampedElapsedSec = Math.min(runtime.totalDurationSec, elapsedSec);
      const frameIndex = Math.min(
        runtime.frameCount,
        Math.floor(clampedElapsedSec / (REPLAY_FRAME_INTERVAL_MS / 1000)),
      );
      const reachedEnd = clampedElapsedSec >= runtime.totalDurationSec;

      // requestAnimationFrame may tick faster than the replay FPS target. Skip
      // redundant redraws until the transformed replay model advances to the next frame.
      if (frameIndex !== replayLastAppliedFrameRef.current) {
        applyReplayFrame(frameIndex);
      }

      if (reachedEnd) {
        if (replayLastAppliedFrameRef.current !== runtime.frameCount) {
          applyReplayFrame(runtime.frameCount);
        }
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
    const runtime = replayRuntimeRef.current;
    const mainChart = getMainChart();
    const tempChart = getTempChart();
    if (!runtime || !Array.isArray(runtime.sampleTimesSec) || runtime.sampleTimesSec.length === 0)
      return;
    if (!mainChart || !tempChart) return;

    // Starting from frame -1 clears all replay datasets before the first visible
    // frame is appended, so the chart visibly builds from nothing each run.
    stopReplayAnimation(true);
    isReplayingRef.current = true;
    setIsReplaying(true);
    setIsReplayPaused(false);
    replayElapsedOffsetSecRef.current = 0;
    replayLastAppliedFrameRef.current = -1;
    applyReplayFrame(-1, { forceReset: true });

    replayStartPerfMsRef.current = getNowMs();
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
    if (!runtime || !Array.isArray(runtime.sampleTimesSec) || runtime.sampleTimesSec.length === 0)
      return;
    if (isReplayingRef.current) return;

    isReplayingRef.current = true;
    setIsReplaying(true);
    setIsReplayPaused(false);
    replayStartPerfMsRef.current = getNowMs();
    clearAllHoverRef.current?.();
    startReplayLoop();
  };

  const captureReplayVisualSnapshot = () => {
    const runtime = replayRuntimeRef.current;
    if (!runtime) return { mode: 'revealed' };

    // Export temporarily takes control over the chart state. Snapshot just enough
    // replay timing information to restore the user's visible position afterwards.
    if (!isReplayingRef.current && !isReplayPaused) {
      return { mode: 'revealed' };
    }

    const elapsedSec =
      replayElapsedOffsetSecRef.current +
      (isReplayingRef.current && replayStartPerfMsRef.current > 0
        ? Math.max(0, (getNowMs() - replayStartPerfMsRef.current) / 1000)
        : 0);
    if (!Number.isFinite(elapsedSec) || elapsedSec >= runtime.totalDurationSec) {
      return { mode: 'revealed' };
    }

    return {
      mode: 'liveReplay',
      frameIndex: replayLastAppliedFrameRef.current,
      elapsedSec: Math.max(0, elapsedSec),
    };
  };

  const restoreReplayVisualSnapshot = snapshot => {
    const runtime = replayRuntimeRef.current;
    stopReplayAnimation(true);
    if (!runtime) return;

    // Export is free to fully reset the charts internally as long as we restore
    // the same replay frame the user had before the export started.
    if (snapshot?.mode === 'liveReplay') {
      replayElapsedOffsetSecRef.current = Math.max(0, snapshot.elapsedSec ?? 0);
      applyReplayFrame(snapshot.frameIndex ?? -1, { forceReset: true });
      setIsReplayPaused(true);
      return;
    }

    applyReplayCutoff(runtime.maxTime, { revealAll: true });
  };

  const beginExportSession = (exportType, abortController = null) => {
    const interactionState = chartInteractionStateRef.current;
    const mainChart = getMainChart();
    const tempChart = getTempChart();
    const hoverArea = getHoverArea();

    if (!interactionState.disabled) {
      interactionState.mainEvents = mainChart?.options?.events;
      interactionState.tempEvents = tempChart?.options?.events;
      interactionState.hoverAreaPointerEvents = hoverArea?.style.pointerEvents || '';
      interactionState.disabled = true;
    }

    // Exports should capture only chart output. Temporarily disabling pointer-driven
    // events prevents hover markers, guide lines, and tooltip redraws from leaking in.
    clearAllHoverRef.current?.();
    if (mainChart) {
      mainChart.options.events = [];
      mainChart.update('none');
    }
    if (tempChart) {
      tempChart.options.events = [];
      tempChart.update('none');
    }
    if (hoverArea) {
      hoverArea.style.pointerEvents = 'none';
    }

    exportAbortControllerRef.current = abortController;
    isExportingRef.current = true;
    activeExportTypeRef.current = exportType;
    if (isMountedRef.current) {
      setIsReplayExporting(true);
    }
  };

  const finishExportSession = () => {
    const interactionState = chartInteractionStateRef.current;
    const mainChart = getMainChart();
    const tempChart = getTempChart();
    const hoverArea = getHoverArea();

    // Restore the exact event configuration that existed before export so replay,
    // hover, and shared pointer handling continue to behave identically afterwards.
    if (hoverArea) {
      hoverArea.style.pointerEvents = interactionState.hoverAreaPointerEvents || '';
    }
    if (mainChart) {
      if (interactionState.mainEvents === undefined) {
        delete mainChart.options.events;
      } else {
        mainChart.options.events = interactionState.mainEvents;
      }
      mainChart.update('none');
    }
    if (tempChart) {
      if (interactionState.tempEvents === undefined) {
        delete tempChart.options.events;
      } else {
        tempChart.options.events = interactionState.tempEvents;
      }
      tempChart.update('none');
    }

    interactionState.disabled = false;
    interactionState.mainEvents = undefined;
    interactionState.tempEvents = undefined;
    interactionState.hoverAreaPointerEvents = '';
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
    exportFormat: effectiveVideoExportFormat,
    includeLegend: exportMenuState.includeLegend,
  });

  const getResolvedLegendItems = includeLegend => {
    if (!includeLegend) return [];
    // Legend export should mirror the currently visible chart state rather than the
    // raw dataset list, so hidden series stay hidden in exported media too.
    return getVisibleLegendItemsForExport({
      legendColorByLabel,
      visibility,
      hasWeightData,
      hasWeightFlowData,
    });
  };

  const abortActiveExport = () => {
    if (activeExportTypeRef.current !== 'video') return;
    exportAbortControllerRef.current?.abort();
  };

  const handleVideoExport = async () => {
    if (!hasVideoExportSupport || !effectiveVideoExportFormat) {
      setReplayExportStatusSafely({
        status: 'error',
        error: 'Video export is not supported in this browser.',
      });
      return;
    }

    const runtime = replayRuntimeRef.current;
    const mainChart = getMainChart();
    const tempChart = getTempChart();
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
      // Video export reuses the same replay frame model as live playback, but drives
      // it on a detached composition canvas so app chrome never becomes part of the media.
      const exportConfig = getResolvedExportConfig();
      const legendItems = getResolvedLegendItems(exportConfig.includeLegend);
      const { blob } = await exportReplayVideo({
        mainCanvas: mainChart.canvas,
        tempCanvas: tempChart.canvas,
        runtime,
        applyReplayFrame,
        legendItems,
        config: exportConfig,
        signal: abortController.signal,
        onStatusChange: status => {
          updateReplayExportStatusSafely(current => ({ ...current, status, error: null }));
        },
      });

      setReplayExportStatusSafely({ status: 'downloading', error: null });
      downloadBlob(
        blob,
        buildReplayExportFilename(shotData, exportConfig.includeLegend, exportConfig.exportFormat),
      );
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
    const mainChart = getMainChart();
    const tempChart = getTempChart();
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
      // PNG export shares the same layout/composition inputs as video export so stills
      // and recordings stay visually aligned when users switch between export modes.
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
      // Keep JSON export routed through LibraryService so naming and file contents
      // stay identical to the analyzer/library export path elsewhere in the app.
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

  const closeExportMenu = () => {
    setExportMenuState(prev => ({ ...prev, open: false }));
  };

  const openExportMenu = () => {
    if (isControlsLocked) return;
    setReplayExportStatus({ status: 'idle', error: null });
    setExportMenuState({
      open: true,
      exportType: hasVideoExportSupport ? DEFAULT_REPLAY_EXPORT_CONFIG.exportType : 'image',
      exportFormat: hasVideoExportSupport ? videoExportCapabilities.defaultExportFormat : 'mp4',
      includeLegend: DEFAULT_REPLAY_EXPORT_CONFIG.includeLegend,
      showFormatInfo: false,
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
    if (exportType === 'video' && !hasVideoExportSupport) return;
    setExportMenuState(prev => ({ ...prev, exportType }));
  };

  const handleExportFormatChange = exportFormat => {
    setExportMenuState(prev => ({ ...prev, exportFormat }));
  };

  const handleIncludeLegendChange = includeLegend => {
    setExportMenuState(prev => ({ ...prev, includeLegend }));
  };

  const handleExportFormatInfoToggle = () => {
    setExportMenuState(prev => ({ ...prev, showFormatInfo: !prev.showFormatInfo }));
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

  const stopReplayAndRestoreChart = () => {
    if (activeExportTypeRef.current === 'video') {
      abortActiveExport();
      return;
    }
    if (isExportingRef.current) return;
    stopReplayAnimation(true);
  };

  const handleExportAction = async () => {
    if (isExportingRef.current) return;

    closeExportMenu();
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
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      exportAbortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (replayExportStatus.error !== 'Replay export was cancelled.') return undefined;
    if (typeof window === 'undefined') return undefined;

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

    // The export menu behaves like a lightweight popover: close on outside click
    // or Escape without pushing that responsibility back into the controls component.
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
  }, [exportMenuState.open, exportMenuRef]);

  useEffect(() => {
    // Keep menu state aligned with runtime format capabilities. This avoids ending
    // up with a stale "video/mp4" selection after browser capability changes or refactors.
    setExportMenuState(prev => {
      const nextExportType =
        !hasVideoExportSupport && prev.exportType === 'video' ? 'image' : prev.exportType;
      const nextExportFormat = !hasVideoExportSupport
        ? prev.exportFormat
        : shouldForceWebmExport
          ? 'webm'
          : videoExportCapabilities.shouldHideWebmOption && prev.exportFormat === 'webm'
            ? 'mp4'
            : prev.exportFormat;

      if (nextExportType === prev.exportType && nextExportFormat === prev.exportFormat) {
        return prev;
      }

      return {
        ...prev,
        exportType: nextExportType,
        exportFormat: nextExportFormat,
      };
    });
  }, [hasVideoExportSupport, shouldForceWebmExport, videoExportCapabilities.shouldHideWebmOption]);

  return {
    replayRuntimeRef,
    clearAllHoverRef,
    isReplayingRef,
    isExportingRef,
    isReplaying,
    isReplayPaused,
    exportMenuState,
    isReplayExporting,
    replayExportStatus,
    videoExportCapabilities,
    hasVideoExportSupport,
    isVideoExportActive,
    isControlsLocked,
    shouldShowReplayFocusHint,
    shouldForceWebmExport,
    effectiveVideoExportFormat,
    replayExportStatusLabel,
    replayExportStatusHint,
    closeExportMenu,
    toggleExportMenu,
    handleExportTypeChange,
    handleExportFormatChange,
    handleIncludeLegendChange,
    handleExportFormatInfoToggle,
    handleReplayClick,
    stopReplayAndRestoreChart,
    handleExportAction,
    stopReplayAnimation,
    applyReplayFrame,
    applyReplayCutoff,
    abortActiveExport,
  };
}
