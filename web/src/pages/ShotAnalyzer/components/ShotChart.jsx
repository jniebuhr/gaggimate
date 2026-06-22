/* global globalThis */
/**
 * ShotChart.jsx
 *
 * Orchestrates Chart.js lifecycle for the Shot Analyzer charts. Heavy logic is
 * delegated to focused builders and hooks so this component mainly wires refs,
 * layout, and render output together.
 */

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
} from './shotChart/ShotChartControls';
import {
  areTooltipStatesEqual,
  buildExternalTooltipState,
  createHiddenExternalTooltipLayout,
  createHiddenExternalTooltipState,
  ShotChartExternalTooltip,
  useMeasuredExternalTooltipLayout,
} from './shotChart/ShotChartExternalTooltip';
import {
  INITIAL_VISIBILITY,
  MAIN_CHART_HEIGHT_DEFAULT,
  REPLAY_FRAME_INTERVAL_MS,
  SINGLE_METRIC_PAGE_KEYS,
  TEMP_CHART_HEIGHT_MIN,
  TEMP_CHART_HEIGHT_RATIO,
  VISIBILITY_KEY_BY_LABEL,
} from './shotChart/constants';
import {
  buildShotChartReplayModel,
  createStripedFillPattern,
  getLegendColorByLabel,
  getShotChartColors,
  getTooltipColorByLabel,
} from './shotChart/helpers';
import { getShotChartBrewModeMeta } from './shotChart/labelVisuals';
import { useShotChartFullDisplay } from './shotChart/useShotChartFullDisplay';
import { useShotChartReplayExport } from './shotChart/useShotChartReplayExport';
import { buildShotChartModel } from './shotChart/buildShotChartModel';
import { createShotChartConfigs } from './shotChart/createShotChartConfigs';
import {
  applyShotChartHoverAtX,
  attachShotChartHoverSync,
  attachTempChartLayoutSync,
} from './shotChart/hoverSync';
import { useMobileScrubberReset } from './shotChart/useMobileScrubberReset';
import { CompareShotCharts } from './shotChart/CompareShotCharts';
import { MobileChartScrubber } from './shotChart/MobileChartScrubber';
import { MobileMetricPager } from './shotChart/MobileMetricPager';
import {
  getChartScrubberInsets,
  getScrubberValueFromNativeInputEvent,
  getScrubberValueFromPointerEvent,
  isStaticMobileTooltipViewport,
} from './shotChart/scrubberUtils';
import {
  ANALYZER_DB_KEYS,
  getShotIdentityKey,
  loadFromStorage,
  saveToStorage,
} from '../utils/analyzerUtils';
import { MetricValueGrid } from './ShotDetailsPanel';
import './ShotChart.css';

Chart.register(annotationPlugin);

const HIDDEN_STATIC_TOOLTIP_STATE = createHiddenExternalTooltipState();

function getDefaultSingleChartVisibility() {
  const showContextOverlaysByDefault = !isStaticMobileTooltipViewport();

  return {
    ...INITIAL_VISIBILITY,
    // Keep the first mobile view quiet; persisted user choices still take precedence.
    phaseNames: showContextOverlaysByDefault,
    stops: showContextOverlaysByDefault,
  };
}

function normalizeSingleChartVisibility(storedVisibility) {
  const defaultVisibility = getDefaultSingleChartVisibility();
  if (!storedVisibility || typeof storedVisibility !== 'object') return defaultVisibility;

  return Object.keys(defaultVisibility).reduce(
    (visibility, key) => ({
      ...visibility,
      [key]:
        typeof storedVisibility[key] === 'boolean' ? storedVisibility[key] : defaultVisibility[key],
    }),
    {},
  );
}

const EMPTY_SHOT_SAMPLES = Object.freeze([]);
const MOBILE_CHART_STACK_GAP = 12;
const MOBILE_SCRUBBER_HEIGHT_FALLBACK = 48;
const MOBILE_COLLAPSED_LEGEND_HEIGHT_FALLBACK = 32;
function getBrowserWindow() {
  return globalThis.window;
}

function isSmartphoneViewport(browserWindow = getBrowserWindow()) {
  if (typeof browserWindow?.matchMedia === 'function') {
    return browserWindow.matchMedia('(max-width: 640px)').matches;
  }
  return Number(browserWindow?.innerWidth) <= 640;
}

function bumpViewportResizeNonce(setViewportResizeNonce) {
  setViewportResizeNonce(n => n + 1);
}

function scheduleViewportResizeBumps(browserWindow, setViewportResizeNonce, handles, delays) {
  handles.frameId = browserWindow.requestAnimationFrame(() =>
    bumpViewportResizeNonce(setViewportResizeNonce),
  );
  handles.timeoutIds = delays.map(delay =>
    browserWindow.setTimeout(() => bumpViewportResizeNonce(setViewportResizeNonce), delay),
  );
}

function clearViewportResizeBumps(browserWindow, handles) {
  browserWindow.cancelAnimationFrame(handles.frameId);
  for (const timeoutId of handles.timeoutIds || []) {
    browserWindow.clearTimeout(timeoutId);
  }
  handles.frameId = 0;
  handles.timeoutIds = [];
}

function getElementHeight(element) {
  return element?.getBoundingClientRect().height || 0;
}

function getAvailableShellHeight({
  hasExternalDesktopCardHeight,
  isSmartphone,
  shellHeight,
  shellTop,
  viewportHeight,
}) {
  if (isSmartphone && shellHeight > 0) {
    return shellHeight;
  }
  if (hasExternalDesktopCardHeight && shellHeight > 0) {
    return shellHeight;
  }
  return viewportHeight - shellTop - 24;
}

function getAvailableCombinedChartHeight({
  browserWindow,
  desktopCardHeight,
  desktopLegendElement,
  externalTooltipElement,
  mobileActionsElement,
  mobileLegendElement,
  mobileScrubberElement,
  scrubberMax,
  shellElement,
  useStaticTooltip,
}) {
  if (!shellElement || !browserWindow) return 0;

  const shellRect = shellElement.getBoundingClientRect();
  const shellTop = shellRect.top || 0;
  const shellHeight = shellRect.height || 0;
  const viewportHeight = browserWindow.visualViewport?.height || browserWindow.innerHeight || 0;
  const smartphoneViewport = isSmartphoneViewport(browserWindow);
  const numericDesktopCardHeight = Number(desktopCardHeight);
  const hasExternalDesktopCardHeight =
    smartphoneViewport === false &&
    Number.isFinite(numericDesktopCardHeight) &&
    numericDesktopCardHeight > 0;
  const staticTooltipHeight = useStaticTooltip ? getElementHeight(externalTooltipElement) : 0;
  const measuredMobileScrubberHeight = useStaticTooltip
    ? getElementHeight(mobileScrubberElement)
    : 0;
  const mobileScrubberHeight =
    useStaticTooltip && scrubberMax > 0
      ? Math.max(measuredMobileScrubberHeight, MOBILE_SCRUBBER_HEIGHT_FALLBACK)
      : measuredMobileScrubberHeight;
  const measuredMobileLegendHeight = getElementHeight(mobileLegendElement);
  const mobileLegendHeight = smartphoneViewport
    ? Math.max(measuredMobileLegendHeight, MOBILE_COLLAPSED_LEGEND_HEIGHT_FALLBACK)
    : measuredMobileLegendHeight;
  const mobileActionsHeight = useStaticTooltip ? getElementHeight(mobileActionsElement) : 0;
  const desktopLegendHeight = getElementHeight(desktopLegendElement);
  const availableShellHeight = getAvailableShellHeight({
    hasExternalDesktopCardHeight,
    isSmartphone: smartphoneViewport,
    shellHeight,
    shellTop,
    viewportHeight,
  });
  const chartStackGap =
    smartphoneViewport || hasExternalDesktopCardHeight ? MOBILE_CHART_STACK_GAP : 0;

  return Math.max(
    0,
    availableShellHeight -
      staticTooltipHeight -
      mobileScrubberHeight -
      mobileLegendHeight -
      mobileActionsHeight -
      desktopLegendHeight -
      chartStackGap,
  );
}

function getChartPointerClientY(chart) {
  const chartRect = chart.canvas?.getBoundingClientRect?.();
  if (!chartRect) return undefined;

  const chartAreaTop = Number(chart.chartArea?.top) || 0;
  const chartAreaHeight = Number(chart.chartArea?.bottom) - Number(chart.chartArea?.top);
  const midpointOffset =
    Number.isFinite(chartAreaHeight) && chartAreaHeight > 0 ? chartAreaHeight / 2 : 0;
  return chartRect.top + chartAreaTop + midpointOffset;
}

function getSingleMetricPageLabels() {
  return [
    {
      key: SINGLE_METRIC_PAGE_KEYS.BASICS,
      label: 'Basics',
    },
    {
      key: SINGLE_METRIC_PAGE_KEYS.PRESSURE_FLOW,
      label: 'Pressure & Pump Flow',
    },
    {
      key: SINGLE_METRIC_PAGE_KEYS.FLOW_VOLUME,
      label: 'Flow & Volume',
    },
    {
      key: SINGLE_METRIC_PAGE_KEYS.TEMPERATURE,
      label: 'Temperature',
    },
  ];
}

function ShotChartStaticMetricPreview({ activePageKey, onPageChange, results }) {
  const pages = getSingleMetricPageLabels();
  const activePage = pages.find(page => page.key === activePageKey) || pages[0];

  return (
    <div className='shot-chart-static-metric-preview'>
      <div className='shot-chart-static-metric-preview__grid'>
        <MetricValueGrid total={results?.total} excludeKeys={['duration', 'w', 'tt']} flat />
      </div>
      <MobileMetricPager
        activePageKey={activePage.key}
        className='shot-chart-mobile-metric-pager--caption'
        onPageChange={onPageChange}
        pages={pages}
        renderPage={page => (
          <div className='shot-chart-single-mobile-page-caption'>
            <span className='shot-chart-single-mobile-page-caption__label'>{page.label}</span>
            <span className='shot-chart-single-mobile-page-caption__hint'>Hover info</span>
          </div>
        )}
      />
    </div>
  );
}

function getStandardMainChartHeight(
  containerWidth,
  availableCombinedHeight = 0,
  fillAvailableDesktopHeight = false,
) {
  const browserWindow = getBrowserWindow();
  if (!browserWindow) return MAIN_CHART_HEIGHT_DEFAULT;
  const measuredCombinedHeight = Number(availableCombinedHeight);
  const isDesktop = browserWindow.innerWidth >= 1024;
  if (isDesktop) {
    const vh = browserWindow.innerHeight;
    if (!Number.isFinite(vh) || vh <= 0) return MAIN_CHART_HEIGHT_DEFAULT;
    const combinedChartHeight = vh * (3 / 5);
    const preferredMainHeight = Math.round(combinedChartHeight / (1 + TEMP_CHART_HEIGHT_RATIO));
    if (
      fillAvailableDesktopHeight &&
      Number.isFinite(measuredCombinedHeight) &&
      measuredCombinedHeight > 0
    ) {
      const availableMainHeight = Math.round(
        measuredCombinedHeight / (1 + TEMP_CHART_HEIGHT_RATIO),
      );
      return Math.max(120, availableMainHeight);
    }
    return preferredMainHeight;
  }
  const numericWidth = Number(containerWidth);
  if (!Number.isFinite(numericWidth) || numericWidth <= 0) return MAIN_CHART_HEIGHT_DEFAULT;
  const preferredCombinedHeight = numericWidth;
  const isSmartphone = browserWindow.innerWidth <= 640;
  if (isSmartphone && Number.isFinite(measuredCombinedHeight) && measuredCombinedHeight > 0) {
    const availableMainHeight = measuredCombinedHeight / (1 + TEMP_CHART_HEIGHT_RATIO);
    return Math.round(Math.max(120, availableMainHeight));
  }
  const combinedChartHeight =
    Number.isFinite(measuredCombinedHeight) && measuredCombinedHeight > 0
      ? Math.min(preferredCombinedHeight, measuredCombinedHeight)
      : preferredCombinedHeight;
  const compactMinimumMainHeight =
    Number.isFinite(measuredCombinedHeight) && measuredCombinedHeight > 0
      ? Math.min(
          MAIN_CHART_HEIGHT_DEFAULT,
          Math.max(180, measuredCombinedHeight / (1 + TEMP_CHART_HEIGHT_RATIO)),
        )
      : MAIN_CHART_HEIGHT_DEFAULT;
  const minimumCombinedHeight = compactMinimumMainHeight * (1 + TEMP_CHART_HEIGHT_RATIO);
  return Math.round(
    Math.max(minimumCombinedHeight, combinedChartHeight) / (1 + TEMP_CHART_HEIGHT_RATIO),
  );
}

function getSurfaceExternalTooltipState({
  tooltipState,
  sourceChart,
  tempChart,
  hoverAreaElement,
  mainChartElement,
  tempChartElement,
}) {
  if (!tooltipState?.visible || !hoverAreaElement || !mainChartElement || !sourceChart?.chartArea) {
    return tooltipState;
  }

  const hoverAreaRect = hoverAreaElement.getBoundingClientRect();
  const mainRect = mainChartElement.getBoundingClientRect();
  const mainOffsetLeft = mainRect.left - hoverAreaRect.left;
  const mainOffsetTop = mainRect.top - hoverAreaRect.top;
  const chartAreaLeft = mainOffsetLeft + tooltipState.chartAreaLeft;
  const chartAreaRight = mainOffsetLeft + tooltipState.chartAreaRight;
  const chartAreaTop = mainOffsetTop + tooltipState.chartAreaTop;
  const chartAreaBottom = mainOffsetTop + tooltipState.chartAreaBottom;
  const tempRect =
    tempChart?.chartArea && tempChartElement ? tempChartElement.getBoundingClientRect() : null;
  const pointerClientY = Number(sourceChart.$externalTooltipClientY);
  const minClientY = mainRect.top + tooltipState.chartAreaTop;
  const maxClientY = tempRect
    ? tempRect.top + tempChart.chartArea.bottom
    : mainRect.top + tooltipState.chartAreaBottom;
  const fallbackClientY = mainRect.top + tooltipState.anchorY;
  const clampedClientY = Math.min(
    maxClientY,
    Math.max(minClientY, Number.isFinite(pointerClientY) ? pointerClientY : fallbackClientY),
  );

  return {
    ...tooltipState,
    anchorX: mainOffsetLeft + tooltipState.anchorX,
    anchorY: clampedClientY - hoverAreaRect.top,
    chartWidth: hoverAreaRect.width,
    chartHeight: hoverAreaRect.height,
    chartAreaLeft,
    chartAreaRight,
    chartAreaTop,
    chartAreaBottom,
    tooltipBoundsLeft: chartAreaLeft,
    tooltipBoundsRight: chartAreaRight,
    tooltipBoundsTop: 0,
    tooltipBoundsBottom: hoverAreaRect.height,
  };
}

function getHoverGuideConnectorStyle({
  externalTooltipState,
  hasActiveScrubValue,
  hoverAreaElement,
  mainChartElement,
  mobileScrubberElement,
  tempChart,
  tempChartElement,
  useStaticTooltip,
}) {
  if (!externalTooltipState.visible) return { display: 'none' };
  if (!hoverAreaElement || !mainChartElement || !tempChartElement || !tempChart?.chartArea) {
    return { display: 'none' };
  }

  const hoverAreaRect = hoverAreaElement.getBoundingClientRect();
  const tempRect = tempChartElement.getBoundingClientRect();
  const guideOverflow = 6;
  const top = (Number(externalTooltipState.chartAreaTop) || 0) - guideOverflow;
  const bottom =
    useStaticTooltip && hasActiveScrubValue && mobileScrubberElement
      ? mobileScrubberElement.getBoundingClientRect().bottom - hoverAreaRect.top
      : tempRect.top - hoverAreaRect.top + tempChart.chartArea.bottom + guideOverflow;

  return {
    display: 'block',
    left: `${externalTooltipState.anchorX}px`,
    top: `${Math.max(0, top)}px`,
    height: `${Math.max(0, bottom - top)}px`,
  };
}

function getShotChartIdentityKey(shotData, results) {
  return getShotIdentityKey(shotData) || `analysis:${results?.id || results?.name || ''}`;
}

function sampleHasWeightData(sample) {
  const rawWeight = sample?.v ?? sample?.w ?? sample?.weight ?? sample?.m;
  const numericWeight = Number(rawWeight);
  return Number.isFinite(numericWeight) && numericWeight > 0;
}

function sampleHasWeightFlowData(sample) {
  const value = Number(sample?.vf ?? sample?.weight_flow);
  return Number.isFinite(value) && value > 0;
}

function getShotSampleCapabilities(shotSamples) {
  return {
    hasWeightData: shotSamples.some(sampleHasWeightData),
    hasWeightFlowData: shotSamples.some(sampleHasWeightFlowData),
  };
}

function hasFiniteScrubValue(scrubXValue) {
  return scrubXValue !== null && scrubXValue !== undefined && Number.isFinite(Number(scrubXValue));
}

function getClampedScrubXValue(scrubXValue, scrubberMax) {
  return hasFiniteScrubValue(scrubXValue)
    ? Math.min(scrubberMax, Math.max(0, Number(scrubXValue)))
    : 0;
}

function SingleShotChart({ shotData, results, desktopCardHeight = 0 }) {
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

export function ShotChart({
  shotData,
  results,
  compareEntries = [],
  isCompareActive = false,
  desktopCardHeight = 0,
  onCompareSwap = null,
  compareTargetDisplayMode,
  onCompareTargetDisplayModeChange,
}) {
  if (isCompareActive && Array.isArray(compareEntries) && compareEntries.length > 1) {
    return (
      <CompareShotCharts
        compareEntries={compareEntries}
        onCompareSwap={onCompareSwap}
        compareTargetDisplayMode={compareTargetDisplayMode}
        onCompareTargetDisplayModeChange={onCompareTargetDisplayModeChange}
        showMainChartTitle={false}
        detailChartTitleVariant='legend'
      />
    );
  }

  return (
    <SingleShotChart shotData={shotData} results={results} desktopCardHeight={desktopCardHeight} />
  );
}
