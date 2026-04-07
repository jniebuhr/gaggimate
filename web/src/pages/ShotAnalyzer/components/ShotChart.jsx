/**
 * ShotChart.jsx
 *
 * Orchestrates Chart.js lifecycle for the Shot Analyzer charts. Heavy logic is
 * delegated to focused builders and hooks so this component mainly wires refs,
 * layout, and render output together.
 */

import { createPortal } from 'preact/compat';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import Chart from 'chart.js/auto';
import annotationPlugin from 'chartjs-plugin-annotation';
import { ShotChartControls, getNextChartHeight } from './shotChart/ShotChartControls';
import {
  areTooltipLayoutsEqual,
  areTooltipStatesEqual,
  buildExternalTooltipState,
  createHiddenExternalTooltipLayout,
  createHiddenExternalTooltipState,
  getExternalTooltipLayout,
  ShotChartExternalTooltip,
} from './shotChart/ShotChartExternalTooltip';
import {
  BREW_BY_TIME_LABEL,
  BREW_BY_WEIGHT_LABEL,
  INITIAL_VISIBILITY,
  MAIN_CHART_HEIGHT_DEFAULT,
  REPLAY_FRAME_INTERVAL_MS,
  TEMP_CHART_HEIGHT_RATIO,
  VISIBILITY_KEY_BY_LABEL,
} from './shotChart/constants';
import {
  buildShotChartReplayModel,
  createStripedFillPattern,
  getLegendColorByLabel,
  getShotChartColors,
  getTooltipColorByLabel,
  readCssColorVar,
} from './shotChart/helpers';
import { useShotChartFullDisplay } from './shotChart/useShotChartFullDisplay';
import { useShotChartReplayExport } from './shotChart/useShotChartReplayExport';
import { buildShotChartModel } from './shotChart/buildShotChartModel';
import { createShotChartConfigs } from './shotChart/createShotChartConfigs';
import { attachShotChartHoverSync, attachTempChartLayoutSync } from './shotChart/hoverSync';
import './ShotChart.css';

Chart.register(annotationPlugin);

export function ShotChart({ shotData, results }) {
  // These refs point to the mounted DOM and Chart.js instances. They stay local
  // to the component because only the top-level orchestrator owns mounting and teardown.
  const hoverAreaRef = useRef(null);
  const mainChartContainerRef = useRef(null);
  const mainChartRef = useRef(null);
  const tempChartRef = useRef(null);
  const exportMenuRef = useRef(null);
  const externalTooltipRef = useRef(null);
  const mainChartInstance = useRef(null);
  const tempChartInstance = useRef(null);
  const chartColorsRef = useRef(null);

  const [visibility, setVisibility] = useState(INITIAL_VISIBILITY);
  const [mainChartHeight, setMainChartHeight] = useState(MAIN_CHART_HEIGHT_DEFAULT);
  const [externalTooltipState, setExternalTooltipState] = useState(
    createHiddenExternalTooltipState,
  );
  const [externalTooltipLayout, setExternalTooltipLayout] = useState(
    createHiddenExternalTooltipLayout,
  );

  // Cache theme-derived chart colors so legend/UI helpers can read them before the
  // next chart build runs. The effect below refreshes the cache whenever charts rebuild.
  if (!chartColorsRef.current) {
    chartColorsRef.current = getShotChartColors();
  }

  const hasWeightData = Boolean(
    shotData?.samples?.some(sample => {
      const rawWeight = sample?.v ?? sample?.w ?? sample?.weight ?? sample?.m;
      const numericWeight = Number(rawWeight);
      return Number.isFinite(numericWeight) && numericWeight > 0;
    }),
  );
  const hasWeightFlowData = Boolean(
    shotData?.samples?.some(sample => {
      const value = Number(sample?.vf ?? sample?.weight_flow);
      return Number.isFinite(value) && value > 0;
    }),
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

  // Full-display stays as a separate behavioral hook so the chart component only
  // decides where to render, not how the overlay manages viewport and scroll state.
  const { isFullDisplay, toggleFullDisplay, effectiveMainChartHeight, effectiveTempChartHeight } =
    useShotChartFullDisplay({
      isControlsLocked,
      clearAllHoverRef,
      onBeforeToggle: closeExportMenu,
      mainChartHeight,
      tempChartHeightRatio: TEMP_CHART_HEIGHT_RATIO,
    });

  useLayoutEffect(() => {
    // Tooltip size depends on the rendered content, so measure after paint and
    // clamp it into the current chart bounds before applying coordinates.
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

    setExternalTooltipLayout(prev =>
      areTooltipLayoutsEqual(prev, nextLayout) ? prev : nextLayout,
    );
  }, [externalTooltipState]);

  useEffect(() => {
    const mainChart = mainChartInstance.current;
    const tempChart = tempChartInstance.current;
    if (!mainChart || !tempChart || typeof window === 'undefined') return undefined;

    // Full-display mode changes the available canvas box without changing the
    // chart data, so Chart.js needs an explicit resize tick after layout settles.
    const frameId = window.requestAnimationFrame(() => {
      mainChart.resize();
      tempChart.resize();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [effectiveMainChartHeight, isFullDisplay]);

  const handleLegendToggle = label => {
    if (isExportingRef.current) return;
    const key = VISIBILITY_KEY_BY_LABEL[label];
    if (!key) return;
    if (label === 'Weight' && !hasWeightData) return;
    if (label === 'Weight Flow' && !hasWeightFlowData) return;
    setVisibility(prev => ({ ...prev, [key]: !prev[key] }));
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

    stopReplayAnimation(true);
    replayRuntimeRef.current = null;
    hideExternalTooltip();

    // Chart.js must be recreated when the data, visible datasets, or render host changes.
    // In full-display mode the canvases move into a portal, so rebuilding is intentional.
    if (!shotData?.samples?.length) {
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

    const brewModeMeta = results?.isBrewByWeight
      ? {
          label: BREW_BY_WEIGHT_LABEL,
          backgroundColor: readCssColorVar('--analyzer-brew-by-weight-label-bg', colors.weight),
          textColor: readCssColorVar('--analyzer-brew-by-weight-label-text', '#ffffff'),
          borderColor: readCssColorVar('--analyzer-brew-by-weight-label-border', colors.weight),
        }
      : {
          label: BREW_BY_TIME_LABEL,
          backgroundColor: readCssColorVar('--analyzer-brew-by-time-label-bg', '#475569'),
          textColor: readCssColorVar('--analyzer-brew-by-time-label-text', '#ffffff'),
          borderColor: readCssColorVar('--analyzer-brew-by-time-label-border', '#334155'),
        };

    const model = buildShotChartModel({
      shotData,
      results,
      visibility,
      colors,
      brewModeMeta,
    });
    const tooltipColorByLabel = getTooltipColorByLabel(colors);
    const updateExternalTooltip = ({ chart, tooltip }) => {
      const nextState = buildExternalTooltipState({
        chart,
        tooltip,
        getHoverWaterValuesAtX: model.getHoverWaterValuesAtX,
        tooltipColorByLabel,
      });

      if (!nextState.visible) {
        hideExternalTooltip();
        return;
      }

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

    const detachTempChartLayoutSync = attachTempChartLayoutSync({
      mainChart,
      tempChart,
    });

    // Build the transformed replay model once per chart build so playback only
    // appends precomputed frame chunks instead of reparsing sample data live.
    replayRuntimeRef.current = {
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
      clearAllHoverRef,
      isReplayingRef,
      isExportingRef,
    });

    return () => {
      // Abort any running export before destroying the charts so recorder callbacks
      // never try to touch a Chart.js instance that has already been torn down.
      abortActiveExport();
      stopReplayAnimation(true);
      replayRuntimeRef.current = null;
      clearAllHoverRef.current = () => {};
      detachHoverSync();
      detachTempChartLayoutSync();
      destroyCharts();
    };
  }, [
    shotData,
    results,
    visibility,
    isFullDisplay,
    hasWeightData,
    hasWeightFlowData,
    hideExternalTooltip,
  ]);

  if (!shotData?.samples?.length) {
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
      mainChartHeight={mainChartHeight}
      onChartHeightToggle={() => setMainChartHeight(current => getNextChartHeight(current))}
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
      visibility={visibility}
    />
  );

  const charts = (
    <div
      ref={hoverAreaRef}
      className={isFullDisplay ? 'shot-chart-full-display__charts' : 'w-full'}
    >
      {/* The shared hover area wraps both canvases so one pointer move can drive
          the aligned guide line, tooltip, and active points across both charts. */}
      <div
        ref={mainChartContainerRef}
        className='relative w-full'
        style={{ height: `${effectiveMainChartHeight}px` }}
      >
        <canvas ref={mainChartRef} />
        <ShotChartExternalTooltip
          tooltipRef={externalTooltipRef}
          state={externalTooltipState}
          layout={externalTooltipLayout}
          isFullDisplay={isFullDisplay}
        />
      </div>
      <div className='relative mt-0 w-full' style={{ height: `${effectiveTempChartHeight}px` }}>
        <canvas ref={tempChartRef} />
      </div>
    </div>
  );

  if (isFullDisplay && typeof document !== 'undefined') {
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
      document.body,
    );
  }

  return (
    <div className='w-full select-none'>
      {controls}
      {charts}
    </div>
  );
}
