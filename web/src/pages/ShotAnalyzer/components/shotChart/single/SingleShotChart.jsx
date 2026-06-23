/* global globalThis */

/** Coordinates the single-chart lifecycle, responsive layout, hover, replay, and export. */

import { createPortal } from 'preact/compat';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import Chart from 'chart.js/auto';
import annotationPlugin from 'chartjs-plugin-annotation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMinus } from '@fortawesome/free-solid-svg-icons/faMinus';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import {
  SHOT_CHART_PRIMARY_LEGEND_LABELS,
  SHOT_CHART_SERIES_LEGEND_LABELS,
  ShotChartControls,
  ShotChartLegendToggles,
  ShotChartMobileReplayActions,
} from '../ShotChartControls';
import {
  areTooltipStatesEqual,
  buildExternalTooltipState,
  createHiddenExternalTooltipLayout,
  createHiddenExternalTooltipState,
  ShotChartExternalTooltip,
  useMeasuredExternalTooltipLayout,
} from '../ShotChartExternalTooltip';
import {
  REPLAY_FRAME_INTERVAL_MS,
  SINGLE_METRIC_PAGE_KEYS,
  TEMP_CHART_HEIGHT_MIN,
  TEMP_CHART_HEIGHT_RATIO,
  VISIBILITY_KEY_BY_LABEL,
} from '../constants';
import {
  buildShotChartReplayModel,
  createStripedFillPattern,
  getLegendColorByLabel,
  getShotChartColors,
  getTooltipColorByLabel,
} from '../helpers';
import { getShotChartBrewModeMeta } from '../labelVisuals';
import { useShotChartFullDisplay } from '../useShotChartFullDisplay';
import { useShotChartReplayExport } from '../useShotChartReplayExport';
import { buildShotChartModel } from '../buildShotChartModel';
import { createShotChartConfigs } from '../createShotChartConfigs';
import {
  applyShotChartHoverAtX,
  attachShotChartHoverSync,
  attachTempChartLayoutSync,
} from '../hoverSync';
import { useMobileScrubberReset } from '../useMobileScrubberReset';
import { MobileChartScrubber } from '../MobileChartScrubber';
import {
  getChartScrubberInsets,
  getScrubberValueFromNativeInputEvent,
  getScrubberValueFromPointerEvent,
  isStaticMobileTooltipViewport,
} from '../scrubberUtils';
import { ANALYZER_DB_KEYS, loadFromStorage, saveToStorage } from '../../../utils/analyzerUtils';
import { ShotChartStaticMetricPreview } from './SingleShotMetricPreview';
import {
  clearViewportResizeBumps,
  getAvailableCombinedChartHeight,
  getBrowserWindow,
  getChartPointerClientY,
  getHoverGuideConnectorStyle,
  getStandardMainChartHeight,
  getSurfaceExternalTooltipState,
  isSmartphoneViewport,
  scheduleViewportResizeBumps,
} from './singleChartLayout';
import {
  EMPTY_SHOT_SAMPLES,
  getClampedScrubXValue,
  getShotChartIdentityKey,
  getShotSampleCapabilities,
  hasFiniteScrubValue,
  HIDDEN_STATIC_TOOLTIP_STATE,
  normalizeSingleChartVisibility,
} from './singleChartState';

Chart.register(annotationPlugin);

export function SingleShotChart({ shotData, results, desktopCardHeight = 0 }) {
  // These refs point to the mounted DOM and Chart.js instances. They stay local
  // to the component because only the top-level orchestrator owns mounting and teardown.
  const hoverAreaRef = useRef(null);
  const chartShellRef = useRef(null);
  const mobileScrubberRef = useRef(null);
  const mobileActionsRef = useRef(null);
  const ignoreScrubInputUntilRef = useRef(0);
  const lastPointerScrubAtRef = useRef(0);
  const mobileLegendRef = useRef(null);
  const desktopLegendRef = useRef(null);
  const mainChartContainerRef = useRef(null);
  const tempChartContainerRef = useRef(null);
  const mainChartRef = useRef(null);
  const tempChartRef = useRef(null);
  const exportMenuRef = useRef(null);
  const externalTooltipRef = useRef(null);
  const [viewportResizeNonce, setViewportResizeNonce] = useState(0);
  const [standardChartSize, setStandardChartSize] = useState({
    width: 0,
    availableCombinedHeight: 0,
  });
  const mainChartInstance = useRef(null);
  const tempChartInstance = useRef(null);
  const chartColorsRef = useRef(null);

  const [visibility, setVisibility] = useState(() =>
    normalizeSingleChartVisibility(loadFromStorage(ANALYZER_DB_KEYS.SINGLE_CHART_VISIBILITY)),
  );
  const [externalTooltipState, setExternalTooltipState] = useState(
    createHiddenExternalTooltipState,
  );
  const [externalTooltipLayout, setExternalTooltipLayout] = useState(
    createHiddenExternalTooltipLayout,
  );
  const [isMobileSeriesLegendExpanded, setIsMobileSeriesLegendExpanded] = useState(false);
  const [useStaticTooltip, setUseStaticTooltip] = useState(isStaticMobileTooltipViewport);
  const [scrubXValue, setScrubXValue] = useState(null);
  const [singleMetricPageKey, setSingleMetricPageKey] = useState(SINGLE_METRIC_PAGE_KEYS.BASICS);
  const [chartMaxTime, setChartMaxTime] = useState(0);
  const [scrubberInsets, setScrubberInsets] = useState({ left: 0, right: 0 });
  const shotIdentityKey = getShotChartIdentityKey(shotData, results);
  const resolvedMainChartHeight = getStandardMainChartHeight(
    standardChartSize.width,
    standardChartSize.availableCombinedHeight,
    Number(desktopCardHeight) > 0,
  );

  // Cache theme-derived chart colors so legend/UI helpers can read them before the
  // next chart build runs. The effect below refreshes the cache whenever charts rebuild.
  if (!chartColorsRef.current) {
    chartColorsRef.current = getShotChartColors();
  }

  const shotSamples = Array.isArray(shotData?.samples) ? shotData.samples : EMPTY_SHOT_SAMPLES;

  const { hasWeightData, hasWeightFlowData } = getShotSampleCapabilities(shotSamples);
  const scrubberMax = Math.max(0, Number(chartMaxTime) || 0);
  const hasActiveScrubValue = hasFiniteScrubValue(scrubXValue);
  const clampedScrubXValue = getClampedScrubXValue(scrubXValue, scrubberMax);
  const mobileStaticTooltipState = hasActiveScrubValue
    ? externalTooltipState
    : HIDDEN_STATIC_TOOLTIP_STATE;
  const updateScrubberInsets = useCallback(() => {
    const nextInsets = getChartScrubberInsets(mainChartInstance.current);
    if (!nextInsets) return;
    setScrubberInsets(prev =>
      prev.left === nextInsets.left && prev.right === nextInsets.right ? prev : nextInsets,
    );
  }, []);
  const updateScrubberFromPointer = useCallback(
    event => {
      if (Date.now() < ignoreScrubInputUntilRef.current) return;
      if (scrubberMax <= 0) return;
      const nextValue = getScrubberValueFromPointerEvent(event, {
        min: 0,
        max: scrubberMax,
        trackElement: mobileScrubberRef.current,
      });
      if (nextValue === null) return;
      lastPointerScrubAtRef.current = Date.now();
      setScrubXValue(nextValue);
    },
    [scrubberMax],
  );
  const updateScrubberFromNativeInput = useCallback(
    event => {
      const nextValue = getScrubberValueFromNativeInputEvent(event, {
        min: 0,
        max: scrubberMax,
        ignoreInputUntil: ignoreScrubInputUntilRef.current,
        lastPointerInputAt: lastPointerScrubAtRef.current,
      });
      if (nextValue !== null) setScrubXValue(nextValue);
    },
    [scrubberMax],
  );

  const legendColorByLabel = getLegendColorByLabel(chartColorsRef.current);
  const hideExternalTooltip = useCallback(() => {
    setExternalTooltipState(prev => {
      const hiddenState = createHiddenExternalTooltipState();
      return areTooltipStatesEqual(prev, hiddenState) ? prev : hiddenState;
    });
  }, []);

  const {
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
    abortActiveExport,
  } = useShotChartReplayExport({
    shotData,
    exportMenuRef,
    chartRefs: { mainChartInstance, tempChartInstance, hoverAreaRef },
    legendColorByLabel,
    visibility,
    hasWeightData,
    hasWeightFlowData,
  });

  const chartLifecycleRef = useRef({
    replayRuntimeRef,
    clearAllHoverRef,
    isReplayingRef,
    isExportingRef,
    stopReplayAnimation,
    abortActiveExport,
  });
  chartLifecycleRef.current.replayRuntimeRef = replayRuntimeRef;
  chartLifecycleRef.current.clearAllHoverRef = clearAllHoverRef;
  chartLifecycleRef.current.isReplayingRef = isReplayingRef;
  chartLifecycleRef.current.isExportingRef = isExportingRef;
  chartLifecycleRef.current.stopReplayAnimation = stopReplayAnimation;
  chartLifecycleRef.current.abortActiveExport = abortActiveExport;
  const resetScrubberHover = useCallback(() => {
    ignoreScrubInputUntilRef.current = Date.now() + 250;
    setScrubXValue(null);
    hideExternalTooltip();
    clearAllHoverRef.current?.();
  }, [clearAllHoverRef, hideExternalTooltip]);

  // Full-display stays as a separate behavioral hook so the chart component only
  // decides where to render, not how the overlay manages viewport and scroll state.
  const { isFullDisplay, toggleFullDisplay, effectiveMainChartHeight, effectiveTempChartHeight } =
    useShotChartFullDisplay({
      isControlsLocked,
      clearAllHoverRef,
      onBeforeToggle: closeExportMenu,
      resolvedMainChartHeight,
      tempChartHeightRatio: TEMP_CHART_HEIGHT_RATIO,
    });
  const renderedTempChartHeight = Math.max(effectiveTempChartHeight, TEMP_CHART_HEIGHT_MIN);
  const hoverGuideConnectorStyle = getHoverGuideConnectorStyle({
    externalTooltipState,
    hasActiveScrubValue,
    hoverAreaElement: hoverAreaRef.current,
    mainChartElement: mainChartContainerRef.current,
    mobileScrubberElement: mobileScrubberRef.current,
    tempChart: tempChartInstance.current,
    tempChartElement: tempChartContainerRef.current,
    useStaticTooltip,
  });

  useMeasuredExternalTooltipLayout({
    containerRef: hoverAreaRef,
    disabled: useStaticTooltip,
    setTooltipLayout: setExternalTooltipLayout,
    tooltipRef: externalTooltipRef,
    tooltipState: externalTooltipState,
  });

  useEffect(() => {
    const browserWindow = getBrowserWindow();
    if (typeof browserWindow?.matchMedia !== 'function') return undefined;

    const mediaQuery = browserWindow.matchMedia('(max-width: 640px)');
    const handleChange = event => {
      setUseStaticTooltip(event.matches);
      if (event.matches) {
        setScrubXValue(null);
        hideExternalTooltip();
      }
    };
    setUseStaticTooltip(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [hideExternalTooltip]);

  useEffect(() => {
    const browserWindow = getBrowserWindow();
    if (!browserWindow) return undefined;

    setStandardChartSize({ width: 0, availableCombinedHeight: 0 });

    const handles = { frameId: 0, timeoutIds: [] };
    scheduleViewportResizeBumps(browserWindow, setViewportResizeNonce, handles, [120, 320]);

    return () => {
      clearViewportResizeBumps(browserWindow, handles);
    };
  }, [shotData]);

  useEffect(() => {
    const browserWindow = getBrowserWindow();
    if (!browserWindow || !useStaticTooltip) return undefined;

    const handles = { frameId: 0, timeoutIds: [] };
    scheduleViewportResizeBumps(browserWindow, setViewportResizeNonce, handles, [80, 180, 360]);

    return () => {
      clearViewportResizeBumps(browserWindow, handles);
    };
  }, [isMobileSeriesLegendExpanded, useStaticTooltip]);

  useEffect(() => {
    setScrubXValue(null);
    hideExternalTooltip();
    setSingleMetricPageKey(SINGLE_METRIC_PAGE_KEYS.BASICS);
  }, [hideExternalTooltip, shotIdentityKey]);

  useMobileScrubberReset({
    enabled: useStaticTooltip,
    hasActiveScrubValue,
    scrubberRef: mobileScrubberRef,
    onReset: resetScrubberHover,
  });

  useEffect(() => {
    const mainChart = mainChartInstance.current;
    const tempChart = tempChartInstance.current;
    const browserWindow = getBrowserWindow();
    if (!mainChart || !tempChart || !browserWindow) return undefined;

    // Full-display mode changes the available canvas box without changing the
    // chart data, so Chart.js needs an explicit resize tick after layout settles.
    const frameId = browserWindow.requestAnimationFrame(() => {
      mainChart.resize();
      tempChart.resize();
      updateScrubberInsets();
    });

    return () => browserWindow.cancelAnimationFrame(frameId);
  }, [effectiveMainChartHeight, isFullDisplay, renderedTempChartHeight, updateScrubberInsets]);

  useEffect(() => {
    const browserWindow = getBrowserWindow();
    if (!browserWindow) return undefined;

    const handles = { frameId: 0, timeoutIds: [] };
    const bumpViewportSize = () => {
      clearViewportResizeBumps(browserWindow, handles);
      scheduleViewportResizeBumps(browserWindow, setViewportResizeNonce, handles, [260, 520]);
    };
    const handleVisualViewportScroll = () => {
      if (isSmartphoneViewport(browserWindow)) {
        bumpViewportSize();
      }
    };

    browserWindow.addEventListener('resize', bumpViewportSize);
    browserWindow.addEventListener('orientationchange', bumpViewportSize);
    browserWindow.visualViewport?.addEventListener('resize', bumpViewportSize);
    browserWindow.visualViewport?.addEventListener('scroll', handleVisualViewportScroll);

    return () => {
      clearViewportResizeBumps(browserWindow, handles);
      browserWindow.removeEventListener('resize', bumpViewportSize);
      browserWindow.removeEventListener('orientationchange', bumpViewportSize);
      browserWindow.visualViewport?.removeEventListener('resize', bumpViewportSize);
      browserWindow.visualViewport?.removeEventListener('scroll', handleVisualViewportScroll);
    };
  }, []);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return undefined;

    const hoverElement = hoverAreaRef.current;
    const shellElement = chartShellRef.current;
    if (!hoverElement) return undefined;

    const measureAvailableCombinedHeight = () => {
      return getAvailableCombinedChartHeight({
        browserWindow: getBrowserWindow(),
        desktopCardHeight,
        desktopLegendElement: desktopLegendRef.current,
        externalTooltipElement: externalTooltipRef.current,
        mobileActionsElement: mobileActionsRef.current,
        mobileLegendElement: mobileLegendRef.current,
        mobileScrubberElement: mobileScrubberRef.current,
        scrubberMax,
        shellElement,
        useStaticTooltip,
      });
    };

    const updateSize = () => {
      const nextSize = {
        width: Math.round(hoverElement.getBoundingClientRect().width || 0),
        availableCombinedHeight: Math.round(measureAvailableCombinedHeight()),
      };
      setStandardChartSize(prev =>
        prev.width === nextSize.width &&
        prev.availableCombinedHeight === nextSize.availableCombinedHeight
          ? prev
          : nextSize,
      );
    };
    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });

    updateSize();
    resizeObserver.observe(hoverElement);
    if (shellElement) resizeObserver.observe(shellElement);
    if (externalTooltipRef.current) resizeObserver.observe(externalTooltipRef.current);
    if (mobileScrubberRef.current) resizeObserver.observe(mobileScrubberRef.current);
    if (mobileActionsRef.current) resizeObserver.observe(mobileActionsRef.current);
    if (mobileLegendRef.current) resizeObserver.observe(mobileLegendRef.current);
    if (desktopLegendRef.current) resizeObserver.observe(desktopLegendRef.current);

    return () => resizeObserver.disconnect();
  }, [
    desktopCardHeight,
    isFullDisplay,
    isMobileSeriesLegendExpanded,
    scrubberMax,
    useStaticTooltip,
    viewportResizeNonce,
  ]);

  const handleLegendToggle = label => {
    if (isExportingRef.current) return;
    const key = VISIBILITY_KEY_BY_LABEL[label];
    if (!key) return;
    if (label === 'Weight' && !hasWeightData) return;
    if (label === 'Weight Flow' && !hasWeightFlowData) return;
    setVisibility(prev => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    saveToStorage(ANALYZER_DB_KEYS.SINGLE_CHART_VISIBILITY, visibility);
  }, [visibility]);

  useEffect(() => {
    const chartLifecycle = chartLifecycleRef.current;
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

    chartLifecycle.stopReplayAnimation(true);
    chartLifecycle.replayRuntimeRef.current = null;
    hideExternalTooltip();

    // Chart.js must be recreated when the data, visible datasets, or render host changes.
    // In full-display mode the canvases move into a portal, so rebuilding is intentional.
    // Replay/export helpers are intentionally excluded from the rebuild triggers because
    // their identity changes during hover/replay state updates and would tear charts down
    // mid-interaction, which breaks the single-chart tooltip and replay lifecycle.
    if (shotSamples.length === 0) {
      setChartMaxTime(0);
      destroyCharts();
      return undefined;
    }

    destroyCharts();
    if (!mainChartRef.current || !tempChartRef.current) return undefined;

    const colors = getShotChartColors();
    chartColorsRef.current = colors;

    const mainCanvasCtx = mainChartRef.current.getContext('2d');
    const tempCanvasCtx = tempChartRef.current.getContext('2d');
    if (!mainCanvasCtx || !tempCanvasCtx) return undefined;

    const targetPressureFill = createStripedFillPattern(mainCanvasCtx, colors.pressure, {
      baseAlpha: 0.018,
      stripeAlpha: 0.065,
      size: 18,
      lineWidth: 2,
    });
    const targetFlowFill = createStripedFillPattern(mainCanvasCtx, colors.flow, {
      baseAlpha: 0.018,
      stripeAlpha: 0.065,
      size: 18,
      lineWidth: 2,
    });
    const tempToTargetFill = createStripedFillPattern(tempCanvasCtx, colors.temp, {
      baseAlpha: 0.018,
      stripeAlpha: 0.09,
      size: 9,
      lineWidth: 1,
    });

    const brewModeMeta = getShotChartBrewModeMeta(results, colors);

    const model = buildShotChartModel({
      shotData,
      results,
      visibility,
      colors,
      brewModeMeta,
      usePhaseNumbers: true,
    });
    setChartMaxTime(model.maxTime || 0);
    const tooltipColorByLabel = getTooltipColorByLabel(colors);
    const updateExternalTooltip = ({ chart, tooltip }) => {
      const tooltipState = buildExternalTooltipState({
        chart,
        tooltip,
        getHoverWaterValuesAtX: model.getHoverWaterValuesAtX,
        tooltipColorByLabel,
        phaseTooltipGroups: [{ rows: model.phaseOverviewRows || [] }],
        showPhaseNames: true,
        showStops: true,
      });

      if (!tooltipState.visible) {
        if (chart.$shotChartHoverSyncActive) return;
        hideExternalTooltip();
        return;
      }

      const nextState = getSurfaceExternalTooltipState({
        tooltipState,
        sourceChart: chart,
        tempChart: tempChartInstance.current,
        hoverAreaElement: hoverAreaRef.current,
        mainChartElement: mainChartContainerRef.current,
        tempChartElement: tempChartContainerRef.current,
      });

      setExternalTooltipState(prev => (areTooltipStatesEqual(prev, nextState) ? prev : nextState));
    };

    // Build configs from the normalized model instead of constructing Chart.js objects inline.
    // Keeping that mapping in one place makes visibility and axis changes easier to reason about.
    const { mainConfig, tempConfig } = createShotChartConfigs({
      model,
      colors,
      visibility,
      hasWeightData,
      hasWeightFlowData,
      targetPressureFill,
      targetFlowFill,
      tempToTargetFill,
      updateExternalTooltip,
      showStopBadges: visibility.stops,
    });

    try {
      mainChartInstance.current = new Chart(mainChartRef.current, mainConfig);
      tempChartInstance.current = new Chart(tempChartRef.current, tempConfig);
    } catch (error) {
      console.error('Shot chart creation failed:', error);
      destroyCharts();
      return undefined;
    }

    const mainChart = mainChartInstance.current;
    const tempChart = tempChartInstance.current;
    if (!mainChart || !tempChart) {
      destroyCharts();
      return undefined;
    }
    const browserWindow = getBrowserWindow();
    if (browserWindow) {
      browserWindow.requestAnimationFrame(updateScrubberInsets);
    } else {
      updateScrubberInsets();
    }

    const detachTempChartLayoutSync = attachTempChartLayoutSync({
      mainChart,
      tempChart,
    });

    // Build the transformed replay model once per chart build so playback only
    // appends precomputed frame chunks instead of reparsing sample data live.
    chartLifecycle.replayRuntimeRef.current = {
      sampleTimesSec: [...model.sampleTimesSec],
      shotStartSec: model.shotStartSec,
      maxTime: model.maxTime,
      ...buildShotChartReplayModel({
        mainDatasets: mainConfig.data.datasets,
        tempDatasets: tempConfig.data.datasets,
        mainAnnotations: model.phaseAnnotations,
        tempAnnotations: model.tempPhaseAnnotations,
        shotStartSec: model.shotStartSec,
        maxTime: model.maxTime,
        frameDurationSec: REPLAY_FRAME_INTERVAL_MS / 1000,
      }),
    };

    const detachHoverSync = attachShotChartHoverSync({
      hoverArea: hoverAreaRef.current,
      mainChart,
      tempChart,
      hideExternalTooltip,
      clearAllHoverRef: chartLifecycle.clearAllHoverRef,
      isReplayingRef: chartLifecycle.isReplayingRef,
      isExportingRef: chartLifecycle.isExportingRef,
      disableDirectHoverOnMobile: true,
    });

    return () => {
      // Abort any running export before destroying the charts so recorder callbacks
      // never try to touch a Chart.js instance that has already been torn down.
      chartLifecycle.abortActiveExport();
      chartLifecycle.stopReplayAnimation(true);
      chartLifecycle.replayRuntimeRef.current = null;
      chartLifecycle.clearAllHoverRef.current = () => {};
      detachHoverSync();
      detachTempChartLayoutSync();
      destroyCharts();
    };
  }, [
    shotData,
    results,
    visibility,
    isFullDisplay,
    shotSamples,
    hasWeightData,
    hasWeightFlowData,
    hideExternalTooltip,
    useStaticTooltip,
    updateScrubberInsets,
  ]);

  useEffect(() => {
    const shouldSuppressHoverGuide = useStaticTooltip && hasActiveScrubValue;
    const charts = [mainChartInstance.current, tempChartInstance.current];
    charts.forEach(chart => {
      if (!chart || chart.$suppressHoverGuide === shouldSuppressHoverGuide) return;
      chart.$suppressHoverGuide = shouldSuppressHoverGuide;
      if (!shouldSuppressHoverGuide) chart.update('none');
    });
  }, [hasActiveScrubValue, useStaticTooltip]);

  useEffect(() => {
    if (!useStaticTooltip || !hasActiveScrubValue) return;
    const mainChart = mainChartInstance.current;
    const tempChart = tempChartInstance.current;
    if (!mainChart || !tempChart) return;

    const pointerClientY = getChartPointerClientY(mainChart);

    applyShotChartHoverAtX({
      mainChart,
      tempChart,
      xValue: clampedScrubXValue,
      pointerClientY,
    });
  }, [clampedScrubXValue, hasActiveScrubValue, useStaticTooltip, visibility]);

  if (shotSamples.length === 0) {
    return null;
  }

  const controls = (
    <ShotChartControls
      exportMenuRef={exportMenuRef}
      exportMenuState={exportMenuState}
      hasWeightData={hasWeightData}
      hasWeightFlowData={hasWeightFlowData}
      hasVideoExportSupport={hasVideoExportSupport}
      isControlsLocked={isControlsLocked}
      isFullDisplay={isFullDisplay}
      isReplayPaused={isReplayPaused}
      isReplaying={isReplaying}
      isReplayExporting={isReplayExporting}
      isVideoExportActive={isVideoExportActive}
      legendColorByLabel={legendColorByLabel}
      onCloseExportMenu={closeExportMenu}
      onExportAction={handleExportAction}
      onExportMenuToggle={toggleExportMenu}
      onExportTypeChange={handleExportTypeChange}
      onExportFormatChange={handleExportFormatChange}
      onExportFormatInfoToggle={handleExportFormatInfoToggle}
      onFullDisplayToggle={toggleFullDisplay}
      onIncludeLegendChange={handleIncludeLegendChange}
      onLegendToggle={handleLegendToggle}
      onReplayToggle={handleReplayClick}
      onStop={stopReplayAndRestoreChart}
      replayExportStatus={replayExportStatus}
      replayExportStatusHint={replayExportStatusHint}
      replayExportStatusLabel={replayExportStatusLabel}
      shouldShowReplayFocusHint={shouldShowReplayFocusHint}
      shouldLockWebmToggle={shouldForceWebmExport}
      shouldShowWebmToggle={!videoExportCapabilities.shouldHideWebmOption}
      separateMobileReplayActions
      showMobileLegend={false}
      topLegendLabels={SHOT_CHART_PRIMARY_LEGEND_LABELS}
      visibility={visibility}
    />
  );
  const mobileScrubber =
    scrubberMax > 0 ? (
      <MobileChartScrubber
        active={hasActiveScrubValue}
        ariaLabel='Scrub shot time'
        insets={scrubberInsets}
        max={scrubberMax}
        onInput={updateScrubberFromNativeInput}
        onPointerUpdate={updateScrubberFromPointer}
        scrubberRef={mobileScrubberRef}
        value={clampedScrubXValue}
        variant='single'
      />
    ) : null;
  const charts = (
    <div
      ref={chartShellRef}
      className={
        isFullDisplay
          ? 'shot-chart-full-display__charts shot-chart-single-layout w-full'
          : 'shot-chart-single-layout w-full'
      }
    >
      <div
        ref={hoverAreaRef}
        className='shot-chart-hover-surface flex w-full flex-1 flex-col justify-center'
      >
        {useStaticTooltip ? (
          <ShotChartExternalTooltip
            tooltipRef={externalTooltipRef}
            state={mobileStaticTooltipState}
            isFullDisplay={isFullDisplay}
            isStatic
            isCompactStatic
            staticCompactVariant='singlePaged'
            staticMetricContext={{ page: singleMetricPageKey }}
            emptyContent={
              <ShotChartStaticMetricPreview
                activePageKey={singleMetricPageKey}
                onPageChange={setSingleMetricPageKey}
                results={results}
              />
            }
          />
        ) : null}
        {useStaticTooltip ? null : (
          <ShotChartExternalTooltip
            tooltipRef={externalTooltipRef}
            state={externalTooltipState}
            layout={externalTooltipLayout}
            isFullDisplay={isFullDisplay}
          />
        )}
        <div className='shot-chart-hover-connector' style={hoverGuideConnectorStyle} />
        <div
          ref={mainChartContainerRef}
          className='shot-chart-interaction-layer relative w-full'
          style={{ height: `${effectiveMainChartHeight}px` }}
        >
          <canvas ref={mainChartRef} />
        </div>
        <div
          ref={tempChartContainerRef}
          className='shot-chart-interaction-layer relative mt-3 w-full'
          style={{ height: `${renderedTempChartHeight}px` }}
        >
          <canvas ref={tempChartRef} />
        </div>
        {mobileScrubber}
      </div>
      {useStaticTooltip ? (
        <div ref={mobileActionsRef}>
          <ShotChartMobileReplayActions
            exportMenuRef={exportMenuRef}
            exportMenuState={exportMenuState}
            hasVideoExportSupport={hasVideoExportSupport}
            isControlsLocked={isControlsLocked}
            isReplayPaused={isReplayPaused}
            isReplaying={isReplaying}
            isReplayExporting={isReplayExporting}
            isVideoExportActive={isVideoExportActive}
            onCloseExportMenu={closeExportMenu}
            onExportAction={handleExportAction}
            onExportMenuToggle={toggleExportMenu}
            onExportTypeChange={handleExportTypeChange}
            onExportFormatChange={handleExportFormatChange}
            onExportFormatInfoToggle={handleExportFormatInfoToggle}
            onIncludeLegendChange={handleIncludeLegendChange}
            onReplayToggle={handleReplayClick}
            onStop={stopReplayAndRestoreChart}
            replayExportStatus={replayExportStatus}
            replayExportStatusHint={replayExportStatusHint}
            replayExportStatusLabel={replayExportStatusLabel}
            shouldLockWebmToggle={shouldForceWebmExport}
            shouldShowWebmToggle={!videoExportCapabilities.shouldHideWebmOption}
          />
        </div>
      ) : null}
      <div
        ref={mobileLegendRef}
        className='shot-chart-scrubber-legend shot-chart-scrubber-legend--mobile'
      >
        <ShotChartLegendToggles
          labels={SHOT_CHART_PRIMARY_LEGEND_LABELS}
          hiddenLegendLabels={[]}
          hasWeightData={hasWeightData}
          hasWeightFlowData={hasWeightFlowData}
          isControlsLocked={isControlsLocked}
          legendColorByLabel={legendColorByLabel}
          onLegendToggle={handleLegendToggle}
          visibility={visibility}
          className='contents'
        />
        <button
          type='button'
          className='shot-chart-scrubber-legend__toggle'
          onClick={() => setIsMobileSeriesLegendExpanded(expanded => !expanded)}
          aria-expanded={isMobileSeriesLegendExpanded}
        >
          <FontAwesomeIcon
            icon={isMobileSeriesLegendExpanded ? faMinus : faPlus}
            className='text-xs'
            aria-hidden='true'
          />
          <span>{isMobileSeriesLegendExpanded ? 'Hide legend' : 'Show legend'}</span>
        </button>
        {isMobileSeriesLegendExpanded ? (
          <ShotChartLegendToggles
            labels={SHOT_CHART_SERIES_LEGEND_LABELS}
            hiddenLegendLabels={[]}
            hasWeightData={hasWeightData}
            hasWeightFlowData={hasWeightFlowData}
            isControlsLocked={isControlsLocked}
            legendColorByLabel={legendColorByLabel}
            onLegendToggle={handleLegendToggle}
            visibility={visibility}
            className='contents'
          />
        ) : null}
      </div>
      <div ref={desktopLegendRef}>
        <ShotChartLegendToggles
          labels={SHOT_CHART_SERIES_LEGEND_LABELS}
          hiddenLegendLabels={[]}
          hasWeightData={hasWeightData}
          hasWeightFlowData={hasWeightFlowData}
          isControlsLocked={isControlsLocked}
          legendColorByLabel={legendColorByLabel}
          onLegendToggle={handleLegendToggle}
          visibility={visibility}
          className='shot-chart-scrubber-legend shot-chart-scrubber-legend--desktop'
        />
      </div>
    </div>
  );

  const browserDocument = globalThis.document;
  if (isFullDisplay && browserDocument) {
    // The portal detaches the chart from analyzer layout containers so parent
    // overflow, transforms, and stacking contexts cannot turn full display into
    // a constrained in-page viewer.
    return createPortal(
      <div className='shot-chart-full-display select-none'>
        <button
          type='button'
          className='shot-chart-full-display__backdrop'
          onClick={() => {
            if (!isControlsLocked) toggleFullDisplay();
          }}
          aria-label='Close full display'
        />
        <div className='shot-chart-full-display__panel'>
          {controls}
          {charts}
        </div>
      </div>,
      browserDocument.body,
    );
  }

  return (
    <div className='flex w-full flex-col select-none lg:h-full'>
      {controls}
      {charts}
    </div>
  );
}
